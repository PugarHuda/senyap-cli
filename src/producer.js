// Turn the silent findings of a Kane pack into an evidence pack of our own, with
// a `senyap` metric catalog, so Kane's own `evidence verdict` can gate on hidden
// 5xx, console errors and false greens. This is the extension point the evidence
// format offers producers (a catalog snapshot in meta/metrics-catalog.yaml).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { finalize } from '@testmuai/evidence-cli';
import { stringify } from 'yaml';
import { VERSION } from './version.js';

const COUNTED = ['http_5xx', 'http_4xx', 'request_failed', 'console_error', 'js_exception', 'env_leak', 'mixed_content', 'slow_response', 'probe_failed', 'insecure_cookie'];

const sumMetric = (label, kind) => ({
  type: 'count', unit: 'findings', label, per_test: true,
  verify: { aggregate: 'sum', path: `senyap.counts.${kind}`, where: `has(test.senyap) && has(test.senyap.counts.${kind})` },
  merge: 'recompute',
});

export const CATALOG = {
  catalog: 'senyap',
  version: 2,
  description: 'Silent failures Senyap reads from Kane evidence packs (logs/*-network.har, logs/*-console.ndjson).',
  metrics: {
    'silent.http_5xx': sumMetric('Hidden 5xx responses', 'http_5xx'),
    'silent.http_4xx': sumMetric('Hidden 4xx responses', 'http_4xx'),
    'silent.request_failed': sumMetric('Requests with no response', 'request_failed'),
    'silent.console_errors': sumMetric('Console errors', 'console_error'),
    'silent.js_exceptions': sumMetric('Uncaught JS exceptions', 'js_exception'),
    'silent.env_leaks': sumMetric('Calls to another environment', 'env_leak'),
    'silent.mixed_content': sumMetric('http calls from https pages', 'mixed_content'),
    'silent.slow_responses': sumMetric('Responses over 3 s', 'slow_response'),
    'silent.probe_failures': sumMetric('Data probes that disagreed with the screen', 'probe_failed'),
    'silent.insecure_cookies': sumMetric('Session cookies without Secure/HttpOnly', 'insecure_cookie'),
    'false_green_tests': {
      type: 'count', unit: 'tests', label: 'Tests Kane passed while the page failed underneath', per_test: true,
      verify: { aggregate: 'count', where: 'has(test.senyap) && test.senyap.false_green == true' }, merge: 'recompute',
    },
  },
};

/**
 * Write and seal `<outDir>/<runId>-senyap.evidence` from a readPack() result.
 * Returns the sealed pack path.
 */
export async function producePack(kane, { outDir, sourcePack }) {
  const name = `${kane.runId}-senyap`;
  const dir = join(outDir, `${name}.evidence`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'meta'), { recursive: true });
  const catalogYaml = stringify(CATALOG);
  writeFileSync(join(dir, 'meta', 'metrics-catalog.yaml'), catalogYaml);
  const now = new Date().toISOString();
  writeFileSync(join(dir, 'run.yaml'), stringify({
    evidence: '0.1', run_id: name, status: 'running', title: `Senyap: ${kane.title}`, started: now,
    environment: { producer: { name: 'senyap', version: VERSION }, source_run: kane.runId, surfaces: kane.surfaceHost ? [kane.surfaceHost] : [] },
    metrics_catalog: { id: CATALOG.catalog, version: CATALOG.version, sha256: createHash('sha256').update(catalogYaml).digest('hex'), source: 'bundled' },
  }));
  for (const t of kane.tests) {
    const td = join(dir, 'tests', t.id);
    mkdirSync(td, { recursive: true });
    // The definition is the Kane test this verdict is about: a pointer, not a copy.
    writeFileSync(join(td, 'kane-source.json'), JSON.stringify({ kane_pack: sourcePack, kane_run_id: kane.runId, execution_id: t.executionId, test_url: t.testUrl }, null, 2));
    const counts = Object.fromEntries(COUNTED.map((k) => [k, t.findings.filter((f) => f.kind === k).length]));
    writeFileSync(join(td, 'result.yaml'), stringify({
      evidence: '0.1', test: t.id, status: t.falseGreen ? 'failed' : t.kaneStatus, definition: { path: 'kane-source.json' },
      steps: t.steps.map((s) => ({ id: s.id, ordinal: s.ordinal, status: s.status, kind: s.kind })),
      external_id: { execution_id: t.executionId, sharable_link: t.testUrl },
      senyap: { kane_status: t.kaneStatus, false_green: t.falseGreen, counts, findings: t.findings },
    }));
  }
  const res = await finalize(dir, { endedAt: new Date().toISOString() });
  return res.sealedPath ?? `${dir}`;
}
