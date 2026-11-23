// senyap init: write senyap.config.json and register `senyap guard` as the Stop
// hook of Claude Code, Codex and/or Cursor in this project, then install Kane's
// own agent skill so the agent can call kane-cli itself while fixing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kane } from './kane.js';
import { VERSION } from './version.js';
import { DEFAULT_FLOW } from './config.js';
import { pin } from './guard.js';

const BIN = resolve(fileURLToPath(import.meta.url), '../../bin/senyap.js');
// Installed from npm -> npx pinned to this exact version (never "whatever is latest" on
// every stop); run from a checkout -> node <abs path>.
const senyapCmd = (args) => (BIN.includes('node_modules') ? `npx --yes senyap@${VERSION} ${args}` : `node "${BIN.replace(/\\/g, '/')}" ${args}`);
const guardCmd = (agent) => senyapCmd(`guard --agent ${agent}`);

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
function writeJson(p, v) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); }

/** Add our command to a Claude/Codex style { hooks: { Stop: [ { hooks: [...] } ] } } file, once. */
function addStopHook(file, cmd) {
  const cfg = readJson(file, {});
  cfg.hooks ??= {};
  cfg.hooks.Stop ??= [];
  const all = cfg.hooks.Stop.flatMap((g) => g.hooks ?? []);
  if (!all.some((h) => String(h.command).includes('senyap') && String(h.command).includes('guard'))) {
    cfg.hooks.Stop.push({ hooks: [{ type: 'command', command: cmd, timeout: 1800 }] });
  }
  writeJson(file, cfg);
}

/** Claude Code PreToolUse: the agent can't edit senyap.config.json or senyap-tests/. */
function addProtectHook(file, cmd) {
  const cfg = readJson(file, {});
  cfg.hooks ??= {};
  cfg.hooks.PreToolUse ??= [];
  if (!cfg.hooks.PreToolUse.flatMap((g) => g.hooks ?? []).some((h) => String(h.command).includes('senyap') && String(h.command).includes('protect'))) {
    cfg.hooks.PreToolUse.push({ matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash', hooks: [{ type: 'command', command: cmd, timeout: 30 }] });
  }
  writeJson(file, cfg);
}

export const INSTALLERS = {
  claude: () => { addStopHook('.claude/settings.json', guardCmd('claude')); addProtectHook('.claude/settings.json', senyapCmd('protect')); return '.claude/settings.json (Stop guard + PreToolUse protect)'; },
  codex: () => { addStopHook('.codex/hooks.json', guardCmd('codex')); return '.codex/hooks.json (trust it once with /hooks in Codex)'; },
  cursor: () => {
    const cfg = readJson('.cursor/hooks.json', { version: 1, hooks: {} });
    cfg.hooks.stop ??= [];
    if (!cfg.hooks.stop.some((h) => String(h.command).includes('senyap'))) cfg.hooks.stop.push({ command: guardCmd('cursor') });
    writeJson('.cursor/hooks.json', cfg);
    return '.cursor/hooks.json';
  },
};

export async function init({ agent = 'all', url, flow } = {}) {
  if (!existsSync('senyap.config.json')) {
    writeJson('senyap.config.json', {
      url: url ?? 'http://localhost:3000',
      flows: flow ?? [DEFAULT_FLOW],
      persistence: true,
      maxAttempts: 3,
    });
    console.error('wrote senyap.config.json: put your app URL and the user flows that matter in it');
  }
  const agents = agent === 'all' ? Object.keys(INSTALLERS) : agent.split(',');
  for (const a of agents) {
    if (!INSTALLERS[a]) throw new Error(`unknown agent "${a}" (claude, codex, cursor, all)`);
    console.error(`hooked ${a}: ${INSTALLERS[a]()}`);
  }
  // The human ran init: what the config says now is what the guard holds the agent to.
  pin();
  const skill = await kane(['install', 'skill'], { timeoutSec: 120 });
  console.error(skill.exitCode === 0 ? 'installed Kane CLI agent skill (kane-cli install skill)' : 'Kane skill not installed; run: npx @testmuai/kane-cli-skill');
  return 0;
}
