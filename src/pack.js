// Read a Kane evidence pack (sealed .evidence zip or directory) and pull out the
// signals a green screenshot hides: failed HTTP calls, console errors, calls that
// leak to another environment, and slow responses. Everything comes from files
// Kane itself wrote (logs/*-network.har, logs/*-console.ndjson, result.yaml).
import { openContainer } from '@testmuai/evidence-cli';
import { parse as parseYaml } from 'yaml';

const NOISE = [/\/favicon\.ico(\?|$)/i];
const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?)$/i;
const PRE_PROD = /(^|[.-])(staging|stage|dev|test|sandbox|preview|qa|uat)([.-]|$)/i;
/** Which environment a host belongs to: local, preprod or prod. */
export const envOf = (host) => (LOCAL_HOST.test(host) ? 'local' : PRE_PROD.test(host) ? 'preprod' : 'prod');
export const SLOW_MS = 3000; // ponytail: same default as `kane-cli explore --slow-budget response=3s`

/** Classify one HAR entry; returns a finding or null. */
export function classifyRequest(entry, surfaceHost, loadStep = null) {
  const url = entry.request?.url ?? '';
  if (NOISE.some((re) => re.test(url))) return null;
  const status = entry.response?.status ?? 0;
  const body = entry.request?.postData?.text;
  const base = { step: entry._step ?? null, method: entry.request?.method, url, status, ms: Math.round(entry.time ?? 0), ...(body ? { requestBody: redact(body).slice(0, 300) } : {}) };
  let host = '';
  try { host = new URL(url).hostname; } catch { /* data: or blob: url */ }
  // A call to another environment is the root cause even when it also failed.
  if (host && surfaceHost && host !== surfaceHost && envOf(host) !== 'prod' && envOf(host) !== envOf(surfaceHost)) {
    return { kind: 'env_leak', severity: 'blocking', ...base, detail: `page on ${surfaceHost} called ${host}${entry._failed ? ` (${entry._failure_reason ?? 'failed'})` : ''}` };
  }
  // A payment/API test key sent from production: the env leak that still answers 200.
  const key = host && surfaceHost && envOf(surfaceHost) === 'prod' && TEST_KEY.exec(`${url} ${body ?? ''} ${(entry.request?.headers ?? []).map((h) => h.value).join(' ')}`);
  if (key) return { kind: 'env_leak', severity: 'blocking', ...base, detail: `test key ${key[0].slice(0, 12)}… sent from production ${surfaceHost}` };
  // ERR_ABORTED is the browser cancelling a request because the page navigated away,
  // e.g. an open event stream cut by the reload check (QuietBench: memos GET /api/v1/sse).
  if (entry._failed && /ERR_ABORTED/.test(entry._failure_reason ?? '')) return { kind: 'aborted', severity: 'warning', ...base, detail: entry._failure_reason };
  if (entry._failed || status === 0) return { kind: 'request_failed', severity: 'blocking', ...base, detail: entry._failure_reason ?? 'no response' };
  if (status >= 500) return { kind: 'http_5xx', severity: 'blocking', ...base, detail: entry.response?.content?.text?.slice(0, 300) ?? '' };
  // How apps ask "am I logged in?" before the login form: a GET answering 401/403 at any
  // time, or any 401/403 while the page first loads (QuietBench: tududi GET /api/profile,
  // memos POST .../AuthService/RefreshToken). A write refused after the flow acts still blocks.
  if ((status === 401 || status === 403) && ((base.method ?? 'GET') === 'GET' || (loadStep && base.step === loadStep))) return { kind: 'auth_probe', severity: 'warning', ...base, detail: entry.response?.content?.text?.slice(0, 300) ?? '' };
  if (status >= 400 && entry._resource_type !== 'document') return { kind: 'http_4xx', severity: 'blocking', ...base, detail: entry.response?.content?.text?.slice(0, 300) ?? '' };
  if (url.startsWith('http://') && surfaceHost && base.url && pageIsHttps(entry)) return { kind: 'mixed_content', severity: 'warning', ...base, detail: 'http request from an https page' };
  if (base.ms > SLOW_MS) return { kind: 'slow_response', severity: 'warning', ...base, detail: `${base.ms} ms` };
  return null;
}

const TEST_KEY = /\b(?:pk|sk|rk)_test_[A-Za-z0-9]{8,}/;
const SECRET_FIELD = 'pass(?:word|wd)?|token|secret|api[_-]?key|access[_-]?key|private[_-]?key|authorization|auth|credential|otp|card|cvc|cvv|ssn|payment[_-]?key';

/**
 * Mask secrets in a request body before it goes into a brief, a report or a PR comment:
 * JSON and form fields whose name looks secret (login forms Kane fills in), and API keys.
 */
export function redact(text) {
  return String(text)
    .replace(new RegExp(`("[^"]*(?:${SECRET_FIELD})[^"]*"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'gi'), '$1"***"')
    .replace(new RegExp(`((?:^|[&?])[^=&]*(?:${SECRET_FIELD})[^=&]*=)[^&]*`, 'gi'), '$1***')
    .replace(/\b((?:pk|sk|rk)_(?:test|live)_)[A-Za-z0-9]{4,}/g, '$1***')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1***');
}

const SESSION_COOKIE =/sess|auth|token|sid|jwt|login/i;

/** Session cookies an https page sets without Secure or HttpOnly (reported, never blocking). */
export function classifyCookies(entry) {
  const url = entry.request?.url ?? '';
  if (!url.startsWith('https://')) return [];
  return (entry.response?.headers ?? [])
    .filter((h) => /^set-cookie$/i.test(h.name))
    .flatMap((h) => String(h.value).split('\n'))
    .map((c) => ({ name: c.split('=')[0].trim(), missing: [!/;\s*secure/i.test(c) && 'Secure', !/;\s*httponly/i.test(c) && 'HttpOnly'].filter(Boolean) }))
    .filter((c) => SESSION_COOKIE.test(c.name) && c.missing.length)
    .map((c) => ({ kind: 'insecure_cookie', severity: 'warning', step: entry._step ?? null, url, detail: `cookie ${c.name} set without ${c.missing.join(' and ')}` }));
}

const pageIsHttps = (entry) => (entry.request?.headers ?? []).some((h) => /^referer$/i.test(h.name) && h.value.startsWith('https://'));

// Chrome's own echo of a failed request; the HAR entry already carries it (and its severity).
const ECHO = /^Failed to load resource: (the server responded with a status of \d+|net::)/;

/**
 * Classify one console line; returns a finding or null. `loadStep` is the run's first
 * (navigate) step: errors logged while the page first loads, before the flow does
 * anything, are reported as `ambient` warnings. They are real, but this flow didn't
 * cause them (QuietBench: tududi logs an i18n error on every load, fixed or not).
 */
export function classifyConsole(line, loadStep = null) {
  if (line.marker || !line.level) return null;
  if (line.level !== 'error' && !line.is_exception) return null;
  const text = String(line.text ?? '');
  if (!line.is_exception && ECHO.test(text)) return null;
  const base = { step: line.step ?? null, url: line.url, detail: text.slice(0, 300) };
  if (loadStep && line.step === loadStep) return { kind: 'ambient_console', severity: 'warning', ...base };
  return { kind: line.is_exception ? 'js_exception' : 'console_error', severity: 'blocking', ...base };
}

/** Read every test in a pack and return its Kane status plus the silent findings. */
export async function readPack(packPath) {
  const pack = await openContainer(packPath);
  const run = parseYaml((await pack.readManifest()) ?? '{}') ?? {};
  const surfaceHost = hostOf(run.environment?.surfaces?.[0]);
  const tests = [];
  for (const id of await pack.listTestIds()) {
    const result = parseYaml((await pack.readResult(id)) ?? '{}') ?? {};
    const first = (result.steps ?? [])[0];
    const loadStep = first?.kind === 'navigate' ? first.id : null;
    const findings = [];
    for (const entry of await pack.listDir(`tests/${id}/logs`)) {
      const text = entry.isDir ? null : await pack.readText(`tests/${id}/logs/${entry.name}`);
      if (!text) continue;
      if (entry.name.endsWith('-network.har')) {
        for (const e of JSON.parse(text).log?.entries ?? []) { const f = classifyRequest(e, surfaceHost, loadStep); if (f) findings.push(f); findings.push(...classifyCookies(e)); }
      } else if (entry.name.endsWith('-console.ndjson')) {
        for (const raw of text.split('\n')) { if (!raw.trim()) continue; const f = classifyConsole(JSON.parse(raw), loadStep); if (f) findings.push(f); }
      }
    }
    const kinds = Object.fromEntries((result.steps ?? []).map((st) => [st.id, st.kind]));
    for (const f of findings) if (f.step && kinds[f.step]) f.stepKind = kinds[f.step];
    const blocking = findings.filter((f) => f.severity === 'blocking');
    tests.push({
      id, kaneStatus: result.status, testUrl: result.external_id?.sharable_link ?? null, executionId: result.external_id?.execution_id ?? null,
      steps: result.steps ?? [], findings, falseGreen: result.status === 'passed' && blocking.length > 0,
    });
  }
  return { runId: run.run_id, title: run.title, surfaceHost, runKind: run.environment?.run_kind, tests };
}

function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }
