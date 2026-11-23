// Hunt one flow: Kane drives it with silent-failure checks, then Senyap reads the
// evidence pack, seals a senyap pack, and lets Kane's verdict judge it. A flow
// fails if Kane confirms a product bug (740) OR the pack shows a silent failure.
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kane, packOf, verdict } from './kane.js';
import { huntObjective, observeObjective } from './objectives.js';
import { readPack } from './pack.js';
import { producePack } from './producer.js';

export const POLICY = resolve(fileURLToPath(import.meta.url), '../../policies/senyap.policy.yaml');

/**
 * Map Kane's outcome plus the pack verdict to one status:
 * silent_failure (740, or the pack fails the senyap policy), failed (a functional
 * assertion failed: 710/720/730), clean, not_run (never started, infra, blockers),
 * inconclusive (Kane could not finish verifying: 3xx/4xx/750/timeouts; not the app's fault).
 */
export function classify({ exitCode, end, policyPassed, probeOnly = false }) {
  const rc = end?.result_code ?? null;
  // A probe only speaks for a flow Kane actually ran. When the probe is the only thing that
  // failed and Kane says the run itself went wrong, the data is wrong because the flow never
  // happened (QuietBench tududi #904: Kane never renamed the task, 720 automation_bug), so the
  // run is inconclusive. Kane passing while the probe fails is exactly the false green it's for.
  if (probeOnly && policyPassed === false) {
    const without = classify({ exitCode, end, policyPassed: true });
    return without === 'inconclusive' || without === 'not_run' ? without : 'silent_failure';
  }
  if (rc === 740 || policyPassed === false) return 'silent_failure';
  // Kane's own bug-detection verdict says whether a failed assertion was the app's
  // fault. QuietBench (tududi, fixed build): 710 with family automation_bug, because
  // Kane clicked the label instead of the switch. That is not a reason to block.
  const family = end?.verdict?.family;
  if ((rc === 710 || rc === 720 || rc === 730) && (family === 'automation_bug' || family === 'environment_issue')) return 'inconclusive';
  if (rc === 710 || rc === 720 || rc === 730) return 'failed';
  if (rc === 100 && end?.status === 'passed') return 'clean';
  if (exitCode === 2 || (rc >= 500 && rc < 700)) return 'not_run';
  return 'inconclusive';
}

/**
 * Two phases, each Kane primitive where it is reliable:
 * 1. observe: Kane runs the flow (plus the reload check) with no network/console
 *    analyzers; Senyap reads the pack's HAR + console and Kane's verdict judges it.
 * 2. confirm: only when the evidence shows something, Kane runs again with its
 *    DevTools analyzers so it confirms the bug (740) and writes the root cause.
 * Kane's analyzers time out proving that nothing failed on a clean page (750,
 * seen repeatedly) but answer fast when something did, so they only run then.
 */
export async function huntFlow(opts) {
  let observe = await huntOnce({ ...opts, phase: 'observe' });
  // Kane itself could not finish (e.g. a capture timed out): one fresh try.
  if (observe.status === 'inconclusive') observe = { ...(await huntOnce({ ...opts, phase: 'observe' })), retriedAfter: observe.kane };
  if (observe.status !== 'silent_failure' && observe.status !== 'failed') return observe;
  const confirm = await huntOnce({ ...opts, phase: 'confirm' });
  // The evidence already proved it; the confirm run adds Kane's diagnosis when it gets one.
  return {
    ...observe,
    status: confirm.status === 'silent_failure' || confirm.status === 'failed' ? confirm.status : observe.status,
    kane: confirm.kane.result_code === 740 ? confirm.kane : observe.kane,
    observe: { status: observe.status, kane: observe.kane, findings: observe.findings.length },
    confirm: { status: confirm.status, kane: confirm.kane, findings: confirm.findings.length },
    credits: (observe.kane.credits ?? 0) + (observe.retriedAfter?.credits ?? 0) + (confirm.kane.credits ?? 0),
    findings: dedupe([...observe.findings, ...confirm.findings]),
  };
}

const dedupe = (fs) => [...new Map(fs.map((f) => [`${f.kind}|${f.method ?? ''}|${f.url ?? ''}|${f.detail ?? ''}`, f])).values()];

/** Run a user shell command (reset/probe); never throws. */
export function sh(cmd, { timeoutSec = 120 } = {}) {
  try { return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutSec * 1000 }) }; }
  catch (e) { return { ok: false, code: e.status ?? null, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() || e.message }; }
}

/** A failed probe as a finding: the data is wrong though the screen and the traffic looked right. */
export const probeFinding = (probe, r) => ({ kind: 'probe_failed', severity: 'blocking', step: null, url: null, detail: `\`${probe}\` exited ${r.code ?? 'with an error'}: ${r.out.slice(-300)}` });

async function huntOnce({ url, flow, probe, reset, phase, workDir = '.senyap', timeoutSec = 300, headless = true, persistence = true, onEvent }) {
  // Every attempt starts from the same app state (QuietBench: Uptime Kuma's retry ran
  // against a monitor the first attempt had already resumed).
  if (reset) {
    const r = sh(reset);
    if (!r.ok) return { flow, url, phase, status: 'not_run', kane: { status: 'not_run', reason_code: 'reset_failed', summary: r.out.slice(-300) }, falseGreen: false, findings: [] };
  }
  const objective = phase === 'observe' ? observeObjective(flow, { persistence }) : huntObjective(flow, { persistence, url });
  const args = ['run', objective, '--url', url, '--agent', '--bug-detection', 'continue', '--timeout', String(timeoutSec), '--max-steps', '30'];
  if (headless) args.push('--headless');
  const run = await kane(args, { timeoutSec, onEvent });
  const end = run.end ?? {};
  const kanePack = packOf(end);
  let pack = null, senyapPack = null, judged = null;
  // The probe asks the app's own data whether the flow really happened.
  const probed = probe && run.exitCode !== 2 ? sh(probe) : null;
  const probeFail = probed && !probed.ok ? probeFinding(probe, probed) : null;
  if (kanePack) {
    pack = await readPack(kanePack);
    if (probeFail && pack.tests[0]) { pack.tests[0].findings.push(probeFail); pack.tests[0].falseGreen ||= pack.tests[0].kaneStatus === 'passed'; }
    mkdirSync(join(workDir, 'packs'), { recursive: true });
    senyapPack = await producePack(pack, { outDir: join(workDir, 'packs'), sourcePack: kanePack });
    judged = await verdict(senyapPack, POLICY);
  }
  const findings = pack?.tests.flatMap((t) => t.findings) ?? (probeFail ? [probeFail] : []);
  return {
    flow, url, phase, objective,
    status: classify({ exitCode: run.exitCode, end, policyPassed: judged ? judged.passed : probeFail ? false : null,
      probeOnly: !!probeFail && !findings.some((f) => f.severity === 'blocking' && f.kind !== 'probe_failed') }),
    kane: { status: end.status, result_code: end.result_code, reason_code: end.reason_code, summary: end.summary, verdict: end.verdict ?? null, credits: end.credits_consumed, test_url: end.test_url, exitCode: run.exitCode },
    falseGreen: pack?.tests.some((t) => t.falseGreen) ?? false,
    findings, kanePack, senyapPack, policyVerdict: judged && { passed: judged.passed, doc: judged.doc },
  };
}

/** Static part of a URL path an agent can grep for: /api/notes/42 -> /api/notes. */
export function routeOf(url) {
  let path = '';
  try { path = new URL(url).pathname; } catch { return null; }
  const keep = [];
  for (const seg of path.split('/').filter(Boolean)) {
    if (/^\d+$|^[0-9a-f-]{16,}$|^[A-Za-z0-9_-]{20,}$/i.test(seg)) break;
    keep.push(seg);
  }
  return keep.length ? '/' + keep.join('/') : null;
}

/** Where the code behind a failing call probably lives: tracked files that mention its route. */
export function suspects(findings, cwd = process.cwd()) {
  const out = new Map();
  for (const f of findings) {
    const route = f.url && routeOf(f.url);
    if (!route || out.has(route)) continue;
    let hits = [];
    try {
      hits = execFileSync('git', ['grep', '-n', '-I', '-F', '-e', route, '--', '.', ':!*.min.js', ':!*.map', ':!.senyap', ':!*.lock', ':!package-lock.json', ':!*.md'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n').filter(Boolean).slice(0, 3).map((l) => l.split(':').slice(0, 2).join(':'));
    } catch { /* not a git repo, or no match */ }
    out.set(route, hits);
  }
  return [...out].filter(([, hits]) => hits.length);
}

/** Markdown brief a coding agent can act on. */
export function brief(results, { cwd } = {}) {
  const bad = results.filter((r) => r.status === 'silent_failure' || r.status === 'failed');
  if (!bad.length) {
    const unsure = results.filter((r) => r.status !== 'clean');
    if (!unsure.length) return 'Senyap: every flow is clean underneath the screen.';
    return ['Senyap: nothing failed in the evidence Kane captured, but Kane could not finish verifying:', ...unsure.map((r) => `- ${r.flow}: ${r.status} (result_code ${r.kane.result_code}, ${r.kane.reason_code ?? 'no reason'}) ${r.kane.test_url ?? ''}`)].join('\n');
  }
  const out = ['# Senyap found silent failures', '', 'Kane CLI drove these flows in a real browser. The screen may look fine; what is listed below failed underneath. Fix the application code (not the test), then stop again so Senyap can re-check.', ''];
  for (const r of bad) {
    out.push(`## ${r.flow}`, `- Kane: \`${r.kane.status}\` (result_code ${r.kane.result_code}${r.kane.reason_code ? `, ${r.kane.reason_code}` : ''})${r.falseGreen ? ' — **Kane passed the screen, the network/console did not**' : ''}`, `- Run: ${r.kane.test_url ?? 'n/a'}`);
    if (r.kane.summary) out.push(`- Kane summary: ${r.kane.summary.replace(/\n+/g, ' / ')}`);
    const blocking = r.findings.filter((x) => x.severity === 'blocking');
    for (const f of blocking) {
      out.push(`- \`${f.kind}\` ${f.method ?? ''} ${f.url ?? ''} ${f.status ? `→ ${f.status}` : ''} ${f.detail ? `: ${f.detail}` : ''}${f.step ? ` (Kane step ${f.step}${f.stepKind ? `, ${f.stepKind}` : ''})` : ''}`.replace(/\s+/g, ' '));
      if (f.requestBody) out.push(`  - request body: \`${f.requestBody.replace(/\s+/g, ' ')}\``);
    }
    const sus = suspects(blocking, cwd);
    if (sus.length) out.push('- Code that calls these routes:', ...sus.map(([route, hits]) => `  - \`${route}\`: ${hits.join(', ')}`));
    out.push(`- Re-check just this flow: \`npx senyap hunt --flow ${JSON.stringify(r.flow)}\``);
    out.push('');
  }
  return out.join('\n');
}

export function saveReport(results, workDir = '.senyap') {
  mkdirSync(workDir, { recursive: true });
  writeFileSync(join(workDir, 'report.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  writeFileSync(join(workDir, 'BRIEF.md'), brief(results));
  return join(workDir, 'BRIEF.md');
}
