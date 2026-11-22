// Hunt one flow: Kane drives it with silent-failure checks, then Senyap reads the
// evidence pack, seals a senyap pack, and lets Kane's verdict judge it. A flow
// fails if Kane confirms a product bug (740) OR the pack shows a silent failure.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kane, packOf, verdict } from './kane.js';
import { huntObjective } from './objectives.js';
import { readPack } from './pack.js';
import { producePack } from './producer.js';

export const POLICY = resolve(fileURLToPath(import.meta.url), '../../policies/senyap.policy.yaml');

export async function huntFlow({ url, flow, workDir = '.senyap', timeoutSec = 300, headless = true, persistence = true, onEvent }) {
  const objective = huntObjective(flow, { persistence });
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
  const kaneBug = end.result_code === 740;
  const didNotRun = run.exitCode === 2 || (end.result_code >= 500 && end.result_code < 700);
  return {
    flow, url, objective,
    status: didNotRun ? 'not_run' : kaneBug || (judged && !judged.passed) ? 'silent_failure' : end.status === 'passed' ? 'clean' : 'failed',
    kane: { status: end.status, result_code: end.result_code, reason_code: end.reason_code, summary: end.summary, verdict: end.verdict ?? null, credits: end.credits_consumed, test_url: end.test_url, exitCode: run.exitCode },
    falseGreen: pack?.tests.some((t) => t.falseGreen) ?? false,
    findings, kanePack, senyapPack, policyVerdict: judged && { passed: judged.passed, doc: judged.doc },
  };
}

/** Markdown brief a coding agent can act on. */
export function brief(results) {
  const bad = results.filter((r) => r.status === 'silent_failure' || r.status === 'failed');
  if (!bad.length) return 'Senyap: every flow is clean underneath the screen.';
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
