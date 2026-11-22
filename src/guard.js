// Agent Stop hook. When the coding agent says it is done, Senyap has Kane drive
// the configured flows. Silent failures block the stop and hand the agent a brief;
// after maxAttempts the human is called in instead. Works for Claude Code
// (decision/reason) and Cursor (followup_message); the output shape is picked
// from --agent or from the hook payload.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { huntFlow, brief, saveReport } from './hunt.js';
import { loadConfig } from './config.js';

const STATE = join('.senyap', 'guard-state.json');

function readStdin() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

/** Fingerprint of the working tree, so an unchanged tree is never re-hunted. */
export function treeHash(cwd = process.cwd()) {
  try {
    const diff = execFileSync('git', ['diff', 'HEAD', '--', '.', ':(exclude).senyap'], { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd, encoding: 'utf8' });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
    return createHash('sha256').update(head + diff + untracked).digest('hex');
  } catch { return null; } // ponytail: not a git repo -> always hunt
}

export async function guard({ agent } = {}) {
  const payload = readStdin();
  const flavour = agent ?? (payload.hook_event_name ? 'claude' : payload.conversation_id ? 'cursor' : 'claude');
  const cfg = loadConfig();
  const max = cfg.maxAttempts ?? 3;
  mkdirSync('.senyap', { recursive: true });
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { attempts: 0, cleanHash: null };
  const hash = treeHash();
  if (hash && hash === state.cleanHash) return allow(flavour, null);
  if (!cfg.url || !cfg.flows?.length) return allow(flavour, 'Senyap: no senyap.config.json flows; skipping.');

  const results = [];
  for (const flow of cfg.flows) results.push(await huntFlow({ url: cfg.url, flow, persistence: cfg.persistence !== false }));
  saveReport(results);
  const failing = results.filter((r) => r.status === 'silent_failure' || r.status === 'failed');
  if (!failing.length) {
    writeFileSync(STATE, JSON.stringify({ attempts: 0, cleanHash: hash, cleanAt: new Date().toISOString() }));
    return allow(flavour, results.some((r) => r.status === 'not_run') ? 'Senyap: Kane could not run some flows (see .senyap/report.json).' : 'Senyap: Kane checked every flow; nothing failed underneath the screen.');
  }
  state.attempts += 1;
  writeFileSync(STATE, JSON.stringify(state));
  if (state.attempts > max) {
    writeFileSync(STATE, JSON.stringify({ attempts: 0, cleanHash: null, escalatedAt: new Date().toISOString() }));
    return allow(flavour, `Senyap: ${failing.length} flow(s) still fail silently after ${max} attempts. A human needs to look: .senyap/BRIEF.md`);
  }
  return block(flavour, `${brief(results)}\n\nAttempt ${state.attempts} of ${max}. The full report is .senyap/report.json; Kane's evidence packs are linked there.`);
}

function allow(flavour, message) {
  if (message) process.stdout.write(JSON.stringify(flavour === 'cursor' ? {} : { systemMessage: message }));
  return 0;
}

function block(flavour, reason) {
  process.stdout.write(JSON.stringify(flavour === 'cursor' ? { followup_message: reason } : { decision: 'block', reason }));
  return 0;
}
