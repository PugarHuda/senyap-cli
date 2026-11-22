// Thin wrapper over the kane-cli binary: run it in agent mode, collect NDJSON,
// and enforce our own kill timer (kane's --timeout is not always honoured, #138).
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let entry;
/**
 * [command, prefixArgs] for kane-cli. On Windows the npm shim is a .cmd that
 * needs a shell, and a shell would split our objectives on spaces, so we run
 * the package's own JS entry with node instead.
 */
function kaneCommand() {
  if (process.env.SENYAP_KANE_BIN) return [process.env.SENYAP_KANE_BIN, []];
  if (process.platform !== 'win32') return ['kane-cli', []];
  if (!entry) {
    const root = execFileSync(process.execPath, [join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'), 'root', '-g'], { encoding: 'utf8' }).trim();
    const pkgDir = join(root, '@testmuai', 'kane-cli');
    entry = join(pkgDir, JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).bin['kane-cli']);
  }
  return [process.execPath, [entry]];
}

// Two kane-cli browser runs started in the same second on one machine wrote the same
// mixed traffic into both evidence packs (QuietBench: Uptime Kuma + Memos). So Senyap
// never starts a browser run while another Senyap-started one is going.
const LOCK = join(tmpdir(), 'senyap-kane-run.lock');
const STALE_MS = 30 * 60 * 1000;
async function withRunLock(fn) {
  for (;;) {
    try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - statSync(LOCK).mtimeMs > STALE_MS) unlinkSync(LOCK); } catch { /* raced */ }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try { return await fn(); } finally { try { unlinkSync(LOCK); } catch { /* already gone */ } }
}
const BROWSER_RUNS = new Set(['run', 'testmd', 'testrun', 'explore']);

/** Run kane-cli with args; resolves { exitCode, events, end, stderr }. Never rejects on a failed test. */
export function kane(args, opts = {}) {
  return BROWSER_RUNS.has(args[0]) ? withRunLock(() => spawnKane(args, opts)) : spawnKane(args, opts);
}

function spawnKane(args, { timeoutSec = 300, cwd = process.cwd(), onEvent } = {}) {
  return new Promise((resolve, reject) => {
    const [cmd, pre] = kaneCommand();
    const child = spawn(cmd, [...pre, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
    const events = [];
    let buf = '', stderr = '', killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, (timeoutSec + 30) * 1000);
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('{')) continue;
        try { const e = JSON.parse(line); events.push(e); onEvent?.(e); } catch { /* not an event line */ }
      }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (buf.trim().startsWith('{')) { try { events.push(JSON.parse(buf)); } catch { /* partial line */ } }
      const end = [...events].reverse().find((e) => e.type === 'run_end' || e.type === 'testmd_end' || e.type === 'testrun_end' || e.type === 'done') ?? null;
      resolve({ exitCode: killed ? 3 : code, killed, events, end, stderr });
    });
  });
}

/** The sealed evidence pack a run wrote, found from run_end.session_dir. */
export function packOf(end) {
  const dir = end?.session_dir && join(end.session_dir, 'evidence');
  if (!dir || !existsSync(dir)) return null;
  const packs = readdirSync(dir).filter((f) => f.endsWith('.evidence'));
  return packs.length ? join(dir, packs.sort().at(-1)) : null;
}

/** Judge a pack with Kane's own verdict command. */
export async function verdict(pack, policyFile) {
  const r = await kane(['evidence', 'verdict', pack, '--policy', policyFile, '--json'], { timeoutSec: 60 });
  const raw = r.events.at(-1) ?? null;
  return { exitCode: r.exitCode, passed: r.exitCode === 0, doc: raw, stderr: r.stderr };
}
