// senyap lock: once a flow is clean, freeze it as a Kane *_test.md so every later
// run replays it from cache and still checks underneath the screen. Kane's own
// policies gate it: no failed step, every test has a check, and no step "healed"
// (a heal re-authors a step and can paper over a regression).
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kane, packOf } from './kane.js';
import { LOCK_ASSERTS } from './objectives.js';
import { loadConfig } from './config.js';

export const LOCK_POLICY = resolve(fileURLToPath(import.meta.url), '../../policies/senyap-lock.policy.yaml');
export const TEST_DIR = 'senyap-tests';

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** The *_test.md text for one flow. Trigger and asserts share one step (#133). */
export function testMd({ url, flow }) {
  return [
    '---', `url: ${url}`, 'tags: [senyap]', 'headless: true', 'max_steps: 30', '---', '',
    `# ${flow}`, '',
    '## Run the flow and check underneath the screen',
    `${flow.trim().replace(/\.$/, '')}.`,
    ...LOCK_ASSERTS, '',
  ].join('\n');
}

export function writeTest({ url, flow }) {
  mkdirSync(TEST_DIR, { recursive: true });
  const file = join(TEST_DIR, `${slug(flow)}_test.md`);
  writeFileSync(file, testMd({ url, flow }));
  return file;
}

/** Newest sealed pack testmd left in .testmuai/evidence (fallback when run_end has no session_dir). */
function newestPack(dir = join('.testmuai', 'evidence')) {
  if (!existsSync(dir)) return null;
  const packs = readdirSync(dir).filter((f) => f.endsWith('.evidence')).map((f) => join(dir, f));
  return packs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null;
}

export async function runLocked(file, { timeoutSec = 400 } = {}) {
  const r = await kane(['testmd', 'run', file, '--agent', '--headless', '--bug-detection', 'continue', '--no-adaptive-heal', '--policy', LOCK_POLICY], { timeoutSec });
  return { exitCode: r.exitCode, end: r.end, pack: packOf(r.end) ?? newestPack() };
}

export async function lockCommand(values) {
  const cfg = loadConfig();
  const url = values.url ?? cfg.url;
  const flows = values.flow ?? cfg.flows ?? [];
  if (!url || !flows.length) throw new Error('need --url and --flow (or senyap.config.json)');
  const { readPack } = await import('./pack.js');
  let worst = 0;
  for (const flow of flows) {
    const file = writeTest({ url, flow });
    process.stderr.write(`▶ ${file}\n`);
    const r = await runLocked(file);
    const pack = r.pack ? await readPack(r.pack) : null;
    const silent = pack?.tests.some((t) => t.findings.some((f) => f.severity === 'blocking')) ?? false;
    const ok = r.exitCode === 0 && !silent;
    process.stderr.write(`  ${ok ? '✔ locked' : '✖ not clean'}  kane exit ${r.exitCode}${silent ? ', silent failures in the pack' : ''}  ${r.end?.test_url ?? ''}\n`);
    worst = Math.max(worst, ok ? 0 : 1);
  }
  return worst;
}
