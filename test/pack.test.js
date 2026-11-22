import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequest, classifyConsole, envOf } from '../src/pack.js';
import { huntObjective } from '../src/objectives.js';
import { testMd } from '../src/lock.js';

const har = (url, status, extra = {}) => ({ request: { method: 'POST', url, headers: [] }, response: { status, content: { text: '{"error":"x"}' } }, time: 40, _step: '0-3', ...extra });

test('hidden 5xx and 4xx are blocking, favicon 404 is noise', () => {
  assert.equal(classifyRequest(har('http://127.0.0.1:4800/api/notes', 500), '127.0.0.1').kind, 'http_5xx');
  assert.equal(classifyRequest(har('http://127.0.0.1:4800/api/notes', 422), '127.0.0.1').kind, 'http_4xx');
  assert.equal(classifyRequest(har('http://127.0.0.1:4800/favicon.ico', 404), '127.0.0.1'), null);
  assert.equal(classifyRequest(har('http://127.0.0.1:4800/api/notes', 201), '127.0.0.1'), null);
});

test('a call to another environment is an env leak, even when it failed', () => {
  const f = classifyRequest(har('http://staging.notes-analytics.test/collect', 0, { _failed: true, _failure_reason: 'net::ERR_NAME_NOT_RESOLVED' }), '127.0.0.1');
  assert.equal(f.kind, 'env_leak');
  assert.match(f.detail, /ERR_NAME_NOT_RESOLVED/);
  assert.equal(classifyRequest(har('http://localhost:3000/api', 200), 'shop.example.com').kind, 'env_leak');
  assert.equal(classifyRequest(har('https://cdn.example.net/a.js', 200), 'shop.example.com'), null);
  assert.deepEqual(['localhost', 'api.staging.acme.io', 'acme.io'].map(envOf), ['local', 'preprod', 'prod']);
});

test('dropped requests and slow responses', () => {
  assert.equal(classifyRequest(har('https://api.example.com/x', 0, { _failed: true }), 'example.com').kind, 'request_failed');
  assert.equal(classifyRequest(har('https://api.example.com/x', 200, { time: 5000 }), 'example.com').kind, 'slow_response');
});

test('console errors and exceptions count, markers and info do not', () => {
  assert.equal(classifyConsole({ level: 'error', text: 'save failed 500' }).kind, 'console_error');
  assert.equal(classifyConsole({ level: 'warning', is_exception: true, text: 'TypeError' }).kind, 'js_exception');
  assert.equal(classifyConsole({ level: 'info', text: 'hi' }), null);
  assert.equal(classifyConsole({ marker: 'step', step: '0-3' }), null);
});

test('objectives and locked tests carry the under-the-screen checks', () => {
  const o = huntObjective('Add a note and save it.');
  assert.match(o, /^Add a note and save it\. Then verify that no network request returned an HTTP 4xx or 5xx/);
  assert.match(o, /after reloading the page/);
  const md = testMd({ url: 'http://127.0.0.1:4800/', flow: 'Add a note' });
  assert.match(md, /^---\nurl: http:\/\/127\.0\.0\.1:4800\/\n/);
  assert.equal(md.match(/^## /gm).length, 1, 'trigger and asserts share one step (#133)');
  assert.match(md, /Assert: no API calls returned 4xx or 5xx/);
});

test('Kane outcomes map to the right status', async () => {
  const { classify } = await import('../src/hunt.js');
  assert.equal(classify({ exitCode: 1, end: { result_code: 740 }, policyPassed: true }), 'silent_failure');
  assert.equal(classify({ exitCode: 0, end: { result_code: 100, status: 'passed' }, policyPassed: false }), 'silent_failure', 'false green');
  assert.equal(classify({ exitCode: 1, end: { result_code: 720 }, policyPassed: true }), 'failed');
  assert.equal(classify({ exitCode: 0, end: { result_code: 100, status: 'passed' }, policyPassed: true }), 'clean');
  assert.equal(classify({ exitCode: 1, end: { result_code: 560 }, policyPassed: null }), 'not_run');
  assert.equal(classify({ exitCode: 2, end: null, policyPassed: null }), 'not_run');
  assert.equal(classify({ exitCode: 1, end: { result_code: 750 }, policyPassed: true }), 'inconclusive', 'kane checkpoint capture timeout is not the app');
  assert.equal(classify({ exitCode: 3, end: null, policyPassed: null }), 'inconclusive');
});

test('noise every app makes is reported, not blocking (QuietBench: tududi)', async () => {
  const { classify } = await import('../src/hunt.js');
  const probe = classifyRequest({ request: { method: 'GET', url: 'http://127.0.0.1:3002/api/profile', headers: [] }, response: { status: 401 }, time: 5 }, '127.0.0.1');
  assert.equal(probe.kind, 'auth_probe'); assert.equal(probe.severity, 'warning');
  const put401 = classifyRequest({ request: { method: 'PUT', url: 'http://127.0.0.1:3002/api/profile', headers: [] }, response: { status: 401 }, time: 5 }, '127.0.0.1');
  assert.equal(put401.kind, 'http_4xx', 'a write that is refused still blocks');
  assert.equal(classifyConsole({ level: 'error', step: '0-5', text: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)' }, '0-1'), null, 'echo of a HAR entry');
  assert.equal(classifyConsole({ level: 'error', step: '0-1', text: 'Error loading translations' }, '0-1').kind, 'ambient_console');
  assert.equal(classifyConsole({ level: 'error', step: '0-10', text: 'Failed to save settings' }, '0-1').kind, 'console_error');
  assert.equal(classify({ exitCode: 1, end: { result_code: 710, verdict: { family: 'automation_bug' } }, policyPassed: true }), 'inconclusive');
  assert.equal(classify({ exitCode: 1, end: { result_code: 710, verdict: { family: 'application_issue' } }, policyPassed: true }), 'failed');
});
