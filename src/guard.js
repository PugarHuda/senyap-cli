// Agent Stop hook. When the coding agent says it is done, Senyap has Kane drive
// the configured flows. Silent failures block the stop and hand the agent a brief;
// after maxAttempts the human is called in instead. Works for Claude Code and Codex
// (decision/reason) and Cursor (followup_message).
//
// The agent must not be able to talk its way past the gate, so:
// - the guard's state lives outside the repo (~/.senyap/state), not in a file the agent edits;
// - senyap.config.json and senyap-tests/ are pinned to what a human approved: if they
//   change, the stop is blocked until they are restored or a human runs `senyap approve`;
// - the agent can only ADD flows, through .senyap/proposed-flows.json. They are hunted
//   right away (stricter, never looser) and a human promotes them with `senyap approve`.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { huntFlow, brief, saveReport } from './hunt.js';
import { loadConfig, flowsOf } from './config.js';

export const PROPOSED = join('.senyap', 'proposed-flows.json');
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** Where this repo's guard state lives: outside the working tree. */
export function stateFile(cwd = process.cwd()) {
  const dir = process.env.SENYAP_STATE_DIR ?? join(homedir(), '.senyap', 'state');
  return join(dir, `${sha(resolve(cwd).toLowerCase()).slice(0, 16)}.json`);
}
export const readState = (cwd) => { try { return JSON.parse(readFileSync(stateFile(cwd), 'utf8')); } catch { return { attempts: 0, cleanHash: null, approved: null }; } };
export function writeState(cwd, s) { const f = stateFile(cwd); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, JSON.stringify(s, null, 2)); }

/** Fingerprint of what a human approved: the config and the locked tests. */
export function guardedHash(cwd = process.cwd()) {
  const h = createHash('sha256');
  const cfg = join(cwd, 'senyap.config.json');
  h.update(existsSync(cfg) ? readFileSync(cfg) : 'no-config');
  const tests = join(cwd, 'senyap-tests');
  if (existsSync(tests)) for (const f of readdirSync(tests).sort()) h.update(f).update(readFileSync(join(tests, f)));
  return h.digest('hex');
}

/** Flows the agent proposed (strings only: an agent never gets to add shell probes). */
export function proposedFlows(cwd = process.cwd()) {
  try {
    const v = JSON.parse(readFileSync(join(cwd, PROPOSED), 'utf8'));
    return (Array.isArray(v) ? v : []).map((f) => (typeof f === 'string' ? f : f?.flow)).filter((f) => typeof f === 'string' && f.trim()).slice(0, 5);
  } catch { return []; }
}

/** Fingerprint of the working tree (plus proposals), so an unchanged tree is never re-hunted. */
export function treeHash(cwd = process.cwd()) {
  try {
    const diff = execFileSync('git', ['diff', 'HEAD', '--', '.', ':(exclude).senyap'], { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', '.', ':(exclude).senyap'], { cwd, encoding: 'utf8' });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
    return sha(head + diff + untracked + JSON.stringify(proposedFlows(cwd)));
  } catch { return null; } // ponytail: not a git repo -> always hunt
}

function readStdin() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

const CHANGED = `# Senyap: the checks were changed

senyap.config.json or senyap-tests/ changed since a human approved them, so Senyap will not judge this stop against weaker checks.
- Put them back: \`git checkout -- senyap.config.json senyap-tests\`
- To check MORE, add plain-English flows to \`${PROPOSED.replace(/\\/g, '/')}\` (a JSON array of strings) instead.
- If the change is intended, the human runs \`npx senyap approve\` in a terminal.`;

const NEED_FLOW = `# Senyap needs a user flow

senyap.config.json has no real user flow yet, so Kane has nothing to drive. Write 1-3 plain-English flows that exercise what you just built or changed into \`${PROPOSED.replace(/\\/g, '/')}\` as a JSON array, for example:

["Add a note that says \\"Don't forget the milk\\", save it, and check it is in the list"]

Then stop again: Kane CLI runs them right away, and a human promotes them with \`npx senyap approve\`.`;

export async function guard({ agent, payload = readStdin(), hunt = huntFlow, cwd = process.cwd(), out = (s) => process.stdout.write(s) } = {}) {
  const flavour = agent ?? (payload.hook_event_name ? 'claude' : payload.conversation_id ? 'cursor' : 'claude');
  const allow = (message) => { if (message) out(JSON.stringify(flavour === 'cursor' ? {} : { systemMessage: message })); return 0; };
  const block = (reason) => { out(JSON.stringify(flavour === 'cursor' ? { followup_message: reason } : { decision: 'block', reason })); return 0; };
  const cfg = loadConfig(join(cwd, 'senyap.config.json'));
  const max = cfg.maxAttempts ?? 3;
  const state = readState(cwd);
  const guarded = guardedHash(cwd);
  state.approved ??= guarded; // first stop after install: trust what is there (init approves too)

  /** One failed attempt: block with the reason, or hand over to the human after `max`. */
  const strike = (reason, extra = '') => {
    state.attempts = (state.attempts ?? 0) + 1;
    if (state.attempts > max) {
      writeState(cwd, { ...state, attempts: 0, cleanHash: null, escalatedAt: new Date().toISOString() });
      return allow(`Senyap: still not clean after ${max} attempts. A human needs to look: .senyap/BRIEF.md`);
    }
    writeState(cwd, state);
    return block(`${reason}\n\nAttempt ${state.attempts} of ${max}.${extra}`);
  };

  if (guarded !== state.approved) return strike(CHANGED);
  const hash = treeHash(cwd);
  if (hash && hash === state.cleanHash) return allow(null);
  if (!cfg.url) return allow('Senyap: no url in senyap.config.json; skipping.');

  const flows = [...flowsOf(cfg), ...proposedFlows(cwd).map((flow) => ({ flow, proposed: true }))];
  if (!flows.length) return strike(NEED_FLOW);

  const results = [];
  for (const f of flows) results.push({ ...(await hunt({ url: cfg.url, flow: f.flow, probe: f.probe, reset: cfg.reset, persistence: cfg.persistence !== false, workDir: join(cwd, '.senyap') })), proposed: !!f.proposed });
  saveReport(results, join(cwd, '.senyap'));
  const failing = results.filter((r) => r.status === 'silent_failure' || r.status === 'failed');
  if (!failing.length) {
    const unsure = results.filter((r) => r.status === 'not_run' || r.status === 'inconclusive');
    // Only a fully verified tree is remembered as clean; an unsure one is re-hunted next stop.
    writeState(cwd, { ...state, attempts: 0, cleanHash: unsure.length ? null : hash, at: new Date().toISOString() });
    return allow(unsure.length
      ? `Senyap: Kane could not finish verifying ${unsure.length} flow(s) (${unsure.map((r) => r.kane.reason_code ?? r.status).join(', ')}); nothing failed in the evidence it did capture. See .senyap/report.json.`
      : 'Senyap: Kane checked every flow; nothing failed underneath the screen.');
  }
  return strike(brief(results, { cwd }), ' The full report is .senyap/report.json; Kane\'s evidence packs are linked there.');
}

/** `senyap approve`: a human promotes proposed flows and re-pins the config. Refuses without a terminal. */
export async function approve({ cwd = process.cwd(), tty = process.stdin.isTTY } = {}) {
  if (!tty) { process.stderr.write('senyap approve must be run by a human in a terminal.\n'); return 2; }
  const cfgPath = join(cwd, 'senyap.config.json');
  const cfg = loadConfig(cfgPath);
  const proposed = proposedFlows(cwd).filter((f) => !(cfg.flows ?? []).some((g) => (typeof g === 'string' ? g : g.flow) === f));
  process.stderr.write(proposed.length ? `Proposed flows:\n${proposed.map((f) => `  + ${f}`).join('\n')}\n` : 'No proposed flows.\n');
  process.stderr.write('This also approves the current senyap.config.json and senyap-tests/.\n');
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const ok = /^y/i.test(await rl.question('Approve? [y/N] '));
  rl.close();
  if (!ok) return 1;
  if (proposed.length) writeFileSync(cfgPath, JSON.stringify({ ...cfg, flows: [...flowsOf(cfg).map((f) => (f.probe ? f : f.flow)), ...proposed] }, null, 2) + '\n');
  rmSync(join(cwd, PROPOSED), { force: true });
  writeState(cwd, { ...readState(cwd), approved: guardedHash(cwd), attempts: 0, cleanHash: null });
  process.stderr.write('approved\n');
  return 0;
}

// ponytail: protect() stops the obvious moves (Edit/Write on the checks, `senyap approve`,
// writing the state dir); a determined agent with a shell can still get around it. The
// guarded hash at stop time is what actually catches a changed config.
const GUARDED_PATH = /(^|[\\/])(senyap\.config\.json|senyap-tests[\\/]|\.senyap[\\/]state)/;
const GUARDED_CMD = /senyap(\.js)?["']?\s+approve|>\s*["']?senyap\.config\.json|\.senyap[\\/]state|senyap-tests[\\/]\S*\s*$|(rm|mv|cp|sed -i|tee)\b[^|;&]*senyap(\.config\.json|-tests)/;

/** Claude Code PreToolUse hook: deny edits to the checks. */
export function protect({ payload = readStdin(), out = (s) => process.stdout.write(s) } = {}) {
  const input = payload.tool_input ?? {};
  const hit = payload.tool_name === 'Bash' ? GUARDED_CMD.test(input.command ?? '') : GUARDED_PATH.test(input.file_path ?? input.notebook_path ?? '');
  if (hit) out(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `Senyap: senyap.config.json and senyap-tests/ are the human-approved checks. Fix the app, not the checks. To check more, add flows to ${PROPOSED.replace(/\\/g, '/')}.` } }));
  return 0;
}
