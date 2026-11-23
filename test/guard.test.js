import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { guard, protect, pin, stateFile, PROPOSED } from '../src/guard.js';
import { classify, brief, routeOf, sh, probeFinding } from '../src/hunt.js';
import { classifyRequest, classifyCookies, redact } from '../src/pack.js';
import { DEFAULT_FLOW } from '../src/config.js';

process.env.SENYAP_STATE_DIR = mkdtempSync(join(tmpdir(), 'senyap-state-'));

/** A throwaway git repo with an app file that calls /api/notes. */
function repo(config) {
  const cwd = mkdtempSync(join(tmpdir(), 'senyap-repo-'));
  const git = (...a) => execFileSync('git', a, { cwd, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  writeFileSync(join(cwd, 'app.js'), "fetch('/api/notes', { method: 'POST' });\n");
  writeFileSync(join(cwd, 'senyap.config.json'), JSON.stringify(config));
  git('add', '.'); git('commit', '-qm', 'init');
  pin(cwd); // what `senyap init` does
  return cwd;
}

const silent = (opts) => ({ flow: opts.flow, url: opts.url, status: 'silent_failure', falseGreen: true,
  kane: { status: 'passed', result_code: 100, test_url: 'https://tm/x' },
  findings: [{ kind: 'http_5xx', severity: 'blocking', method: 'POST', url: 'http://127.0.0.1:4800/api/notes', status: 500, step: '0-5', stepKind: 'click', requestBody: '{"text":"Don\'t"}' }] });
const clean = (opts) => ({ flow: opts.flow, url: opts.url, status: 'clean', kane: { status: 'passed', result_code: 100 }, findings: [] });

async function stop(cwd, hunt, agent) {
  let printed = '';
  const calls = [];
  await guard({ cwd, agent, payload: {}, hunt: async (o) => { calls.push(o); return hunt(o); }, out: (s) => { printed += s; } });
  return { out: printed ? JSON.parse(printed) : null, calls };
}

test('guard blocks a silent failure with an actionable brief, then hands over to a human', async () => {
  const cwd = repo({ url: 'http://127.0.0.1:4800', flows: ['Add a note and save it'], maxAttempts: 2 });
  const first = await stop(cwd, silent);
  assert.equal(first.out.decision, 'block');
  assert.match(first.out.reason, /Kane passed the screen/);
  assert.match(first.out.reason, /Kane step 0-5, click/);
  assert.match(first.out.reason, /request body/);
  assert.match(first.out.reason, /`\/api\/notes`: app\.js:1/);
  assert.match(first.out.reason, /Attempt 1 of 2/);
  assert.equal((await stop(cwd, silent)).out.decision, 'block');
  const third = await stop(cwd, silent);
  assert.equal(third.out.decision, undefined);
  assert.match(third.out.systemMessage, /A human needs to look/);
});

test('a clean tree is remembered and not re-hunted', async () => {
  const cwd = repo({ url: 'http://127.0.0.1:4800', flows: ['Add a note and save it'] });
  assert.match((await stop(cwd, clean)).out.systemMessage, /nothing failed/);
  const again = await stop(cwd, clean);
  assert.equal(again.calls.length, 0);
  assert.equal(again.out, null);
});

test('an agent that weakens the checks is blocked without a hunt', async () => {
  const cwd = repo({ url: 'http://127.0.0.1:4800', flows: ['Add a note and save it'] });
  writeFileSync(join(cwd, 'senyap.config.json'), JSON.stringify({ url: 'http://127.0.0.1:4800', flows: [] }));
  const r = await stop(cwd, clean);
  assert.equal(r.out.decision, 'block');
  assert.match(r.out.reason, /checks were changed/);
  assert.equal(r.calls.length, 0);
  mkdirSync(join(cwd, 'senyap-tests'));
  writeFileSync(join(cwd, 'senyap-tests', 'x_test.md'), '# weaker');
  assert.equal((await stop(cwd, clean)).out.decision, 'block');
});

test('deleting the guard state fails closed: no approval on record, no hunt', async () => {
  const cwd = repo({ url: 'http://127.0.0.1:4800', flows: ['Add a note and save it'] });
  rmSync(stateFile(cwd));
  const r = await stop(cwd, clean);
  assert.equal(r.out.decision, 'block');
  assert.match(r.out.reason, /no human-approved checks/);
  assert.equal(r.calls.length, 0);
});

test('request bodies are redacted before they reach a brief', () => {
  assert.equal(redact('{"username":"qb","password":"QuietBench123!","text":"hi"}'), '{"username":"qb","password":"***","text":"hi"}');
  assert.equal(redact('user=qb&passwd=hunter2&next=%2F'), 'user=qb&passwd=***&next=%2F');
  assert.equal(redact('{"api_key":"abc","payment_key":"pk_test_51QbZoo"}'), '{"api_key":"***","payment_key":"***"}');
  assert.equal(redact('key sk_live_abcdef123 and Bearer eyJhbGciOi.x.y'), 'key sk_live_*** and Bearer ***');
  const f = classifyRequest({ request: { method: 'POST', url: 'http://127.0.0.1:1/api/login', headers: [], postData: { text: '{"password":"QuietBench123!"}' } }, response: { status: 500 }, time: 1 }, '127.0.0.1');
  assert.doesNotMatch(f.requestBody, /QuietBench123/);
});

test('with only the placeholder flow the agent is asked to propose one, and proposals are hunted', async () => {
  const cwd = repo({ url: 'http://127.0.0.1:4800', flows: [DEFAULT_FLOW] });
  const ask = await stop(cwd, clean);
  assert.match(ask.out.reason, /needs a user flow/);
  assert.equal(ask.calls.length, 0);
  mkdirSync(join(cwd, '.senyap'), { recursive: true });
  writeFileSync(join(cwd, PROPOSED), JSON.stringify(['Add a note and save it', { flow: 'Delete it', probe: 'rm -rf /' }, 42]));
  const r = await stop(cwd, clean);
  assert.deepEqual(r.calls.map((c) => [c.flow, c.probe]), [['Add a note and save it', undefined], ['Delete it', undefined]]);
});

test('cursor gets a followup_message, not a decision', async () => {
  const cwd = repo({ url: 'http://127.0.0.1:4800', flows: ['Add a note and save it'] });
  const r = await stop(cwd, silent, 'cursor');
  assert.match(r.out.followup_message, /Senyap found silent failures/);
});

test('protect denies edits to the checks and lets app edits through', () => {
  const run = (payload) => { let s = ''; protect({ payload, out: (x) => { s = x; } }); return s ? JSON.parse(s).hookSpecificOutput.permissionDecision : 'allow'; };
  assert.equal(run({ tool_name: 'Edit', tool_input: { file_path: 'C:\\app\\senyap.config.json' } }), 'deny');
  assert.equal(run({ tool_name: 'Write', tool_input: { file_path: '/app/senyap-tests/add_test.md' } }), 'deny');
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'npx senyap approve' } }), 'deny');
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'echo {} > senyap.config.json' } }), 'deny');
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'rm ~/.senyap/state/abc.json' } }), 'deny');
  assert.equal(run({ tool_name: 'Edit', tool_input: { file_path: '/app/src/notes.js' } }), 'allow');
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'npm test' } }), 'allow');
});

test('classify maps Kane outcomes and the pack verdict to one status', () => {
  assert.equal(classify({ exitCode: 0, end: { result_code: 100, status: 'passed' }, policyPassed: false }), 'silent_failure');
  assert.equal(classify({ exitCode: 1, end: { result_code: 740 } }), 'silent_failure');
  assert.equal(classify({ exitCode: 1, end: { result_code: 720, verdict: { family: 'automation_bug' } } }), 'inconclusive');
  assert.equal(classify({ exitCode: 1, end: { result_code: 720, verdict: { family: 'product_bug' } } }), 'failed');
  assert.equal(classify({ exitCode: 0, end: { result_code: 100, status: 'passed' }, policyPassed: true }), 'clean');
  assert.equal(classify({ exitCode: 2, end: {} }), 'not_run');
  assert.equal(classify({ exitCode: 3, end: { result_code: 750 } }), 'inconclusive');
});

test('probes: a failing data check becomes a blocking finding', () => {
  assert.equal(sh('node -e "process.exit(0)"').ok, true);
  const r = sh('node -e "console.log(\'monitor active=1\'); process.exit(1)"');
  assert.equal(r.ok, false);
  const f = probeFinding('check-monitor', r);
  assert.equal(f.kind, 'probe_failed');
  assert.equal(f.severity, 'blocking');
  assert.match(f.detail, /exited 1: monitor active=1/);
});

test('test keys from production and insecure session cookies', () => {
  const entry = (url, extra = {}) => ({ request: { method: 'POST', url, headers: [], postData: { text: 'key=pk_test_51Habcdefgh' } }, response: { status: 200, headers: [] }, time: 10, ...extra });
  assert.equal(classifyRequest(entry('https://api.stripe.com/v1/tokens'), 'shop.example.com').kind, 'env_leak');
  assert.equal(classifyRequest(entry('https://api.stripe.com/v1/tokens'), 'staging.example.com'), null);
  const cookies = classifyCookies({ request: { url: 'https://shop.example.com/login' }, response: { headers: [
    { name: 'Set-Cookie', value: 'session_id=abc; Path=/; HttpOnly' },
    { name: 'set-cookie', value: 'theme=dark; Path=/' },
    { name: 'Set-Cookie', value: 'auth=x; Secure; HttpOnly' },
  ] } });
  assert.deepEqual(cookies.map((c) => c.detail), ['cookie session_id set without Secure']);
  assert.equal(cookies[0].severity, 'warning');
});

test('routeOf keeps the greppable part of a URL', () => {
  assert.equal(routeOf('http://x/api/notes/42'), '/api/notes');
  assert.equal(routeOf('http://x/api/v1/users/01M81V2EG0623DQRHQE21PDZQ2/setting'), '/api/v1/users');
  assert.equal(routeOf('not a url'), null);
});

test('a clean brief says so', () => {
  assert.match(brief([{ status: 'clean', kane: {} }]), /every flow is clean/);
});
