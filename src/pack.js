// Read a Kane evidence pack (sealed .evidence zip or directory) and pull out the
// signals a green screenshot hides: failed HTTP calls, console errors, calls that
// leak to another environment, and slow responses. Everything comes from files
// Kane itself wrote (logs/*-network.har, logs/*-console.ndjson, result.yaml).
import { openContainer } from '@testmuai/evidence-cli';
import { parse as parseYaml } from 'yaml';

const NOISE = [/\/favicon\.ico(\?|$)/i];
const ENV_HOST = /(^|[.-])(localhost|127\.0\.0\.1|0\.0\.0\.0|staging|stage|dev|test|sandbox|preview|qa)([.-]|$)/i;
export const SLOW_MS = 3000; // ponytail: same default as `kane-cli explore --slow-budget response=3s`

/** Classify one HAR entry; returns a finding or null. */
export function classifyRequest(entry, surfaceHost) {
  const url = entry.request?.url ?? '';
  if (NOISE.some((re) => re.test(url))) return null;
  const status = entry.response?.status ?? 0;
  const base = { step: entry._step ?? null, method: entry.request?.method, url, status, ms: Math.round(entry.time ?? 0) };
  if (entry._failed || status === 0) return { kind: 'request_failed', severity: 'blocking', ...base, detail: entry._failure_reason ?? 'no response' };
  if (status >= 500) return { kind: 'http_5xx', severity: 'blocking', ...base, detail: entry.response?.content?.text?.slice(0, 300) ?? '' };
  if (status >= 400 && entry._resource_type !== 'document') return { kind: 'http_4xx', severity: 'blocking', ...base, detail: entry.response?.content?.text?.slice(0, 300) ?? '' };
  let host = '';
  try { host = new URL(url).hostname; } catch { /* data: or blob: url */ }
  if (host && surfaceHost && host !== surfaceHost && ENV_HOST.test(host) && !ENV_HOST.test(surfaceHost)) {
    return { kind: 'env_leak', severity: 'blocking', ...base, detail: `page on ${surfaceHost} called ${host}` };
  }
  if (url.startsWith('http://') && surfaceHost && base.url && pageIsHttps(entry)) return { kind: 'mixed_content', severity: 'warning', ...base, detail: 'http request from an https page' };
  if (base.ms > SLOW_MS) return { kind: 'slow_response', severity: 'warning', ...base, detail: `${base.ms} ms` };
  return null;
}

const pageIsHttps = (entry) => (entry.request?.headers ?? []).some((h) => /^referer$/i.test(h.name) && h.value.startsWith('https://'));

/** Classify one console line; returns a finding or null. */
export function classifyConsole(line) {
  if (line.marker || !line.level) return null;
  if (line.level !== 'error' && !line.is_exception) return null;
  return { kind: line.is_exception ? 'js_exception' : 'console_error', severity: 'blocking', step: line.step ?? null, url: line.url, detail: String(line.text ?? '').slice(0, 300) };
}

/** Read every test in a pack and return its Kane status plus the silent findings. */
export async function readPack(packPath) {
  const pack = await openContainer(packPath);
  const run = parseYaml((await pack.readManifest()) ?? '{}') ?? {};
  const surfaceHost = hostOf(run.environment?.surfaces?.[0]);
  const tests = [];
  for (const id of await pack.listTestIds()) {
    const result = parseYaml((await pack.readResult(id)) ?? '{}') ?? {};
    const findings = [];
    for (const entry of await pack.listDir(`tests/${id}/logs`)) {
      const text = entry.isDir ? null : await pack.readText(`tests/${id}/logs/${entry.name}`);
      if (!text) continue;
      if (entry.name.endsWith('-network.har')) {
        for (const e of JSON.parse(text).log?.entries ?? []) { const f = classifyRequest(e, surfaceHost); if (f) findings.push(f); }
      } else if (entry.name.endsWith('-console.ndjson')) {
        for (const raw of text.split('\n')) { if (!raw.trim()) continue; const f = classifyConsole(JSON.parse(raw)); if (f) findings.push(f); }
      }
    }
    const blocking = findings.filter((f) => f.severity === 'blocking');
    tests.push({
      id, kaneStatus: result.status, testUrl: result.external_id?.sharable_link ?? null, executionId: result.external_id?.execution_id ?? null,
      steps: result.steps ?? [], findings, falseGreen: result.status === 'passed' && blocking.length > 0,
    });
  }
  return { runId: run.run_id, title: run.title, surfaceHost, runKind: run.environment?.run_kind, tests };
}

function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }
