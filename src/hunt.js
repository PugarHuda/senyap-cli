// Hunt one flow: Kane drives it with silent-failure checks, then Senyap reads the
// evidence pack, seals a senyap pack, and lets Kane's verdict judge it. A flow
// fails if Kane confirms a product bug (740) OR the pack shows a silent failure.
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
export function classify({ exitCode, end, policyPassed }) {
  const rc = end?.result_code ?? null;
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

async function huntOnce({ url, flow, phase, workDir = '.senyap', timeoutSec = 300, headless = true, persistence = true, onEvent }) {
  const objective = phase === 'observe' ? observeObjective(flow, { persistence }) : huntObjective(flow, { persistence, url });
  const args = ['run', objective, '--url', url, '--agent', '--bug-detection', 'continue', '--timeout', String(timeoutSec), '--max-steps', '30'];
  if (headless) args.push('--headless');
  const run = await kane(args, { timeoutSec, onEvent });
  const end = run.end ?? {};
  const kanePack = packOf(end);
  let pack = null, senyapPack = null, judged = null;
  if (kanePack) {
    pack = await readPack(kanePack);
    mkdirSync(join(workDir, 'packs'), { recursive: true });
    senyapPack = await producePack(pack, { outDir: join(workDir, 'packs'), sourcePack: kanePack });
    judged = await verdict(senyapPack, POLICY);
  }
  const findings = pack?.tests.flatMap((t) => t.findings) ?? [];
  return {
    flow, url, phase, objective,
    status: classify({ exitCode: run.exitCode, end, policyPassed: judged ? judged.passed : null }),
    kane: { status: end.status, result_code: end.result_code, reason_code: end.reason_code, summary: end.summary, verdict: end.verdict ?? null, credits: end.credits_consumed, test_url: end.test_url, exitCode: run.exitCode },
    falseGreen: pack?.tests.some((t) => t.falseGreen) ?? false,
    findings, kanePack, senyapPack, policyVerdict: judged && { passed: judged.passed, doc: judged.doc },
  };
}

/** Markdown brief a coding agent can act on. */
export function brief(results) {
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
    for (const f of r.findings.filter((x) => x.severity === 'blocking')) out.push(`- \`${f.kind}\` ${f.method ?? ''} ${f.url ?? ''} ${f.status ? `→ ${f.status}` : ''} ${f.detail ? `: ${f.detail}` : ''}`.replace(/\s+/g, ' '));
    out.push('');
  }
  return out.join('\n');
}

export function saveReport(results, workDir = '.senyap') {
  mkdirSync(workDir, { recursive: true });
  writeFileSync(join(workDir, 'report.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  writeFileSync(join(workDir, 'BRIEF.md'), brief(results));
}
