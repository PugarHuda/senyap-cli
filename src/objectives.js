// Objectives that make Kane look under the screen. Measured on a probe app whose
// UI says "Saved!" while the API answers 500: the plain objective passed (code
// 100); the same flow with these checks came back 740 confirmed_product_bug.

import { envOf } from './pack.js';

/**
 * The environment rule is relative to the app's own host: an app served from
 * 127.0.0.1 can't be asked to avoid localhost (Kane got stuck on exactly that,
 * result_code 330/750), but it must not call staging; production must avoid both.
 */
export function envCheck(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { /* no url: strictest rule */ }
  const env = envOf(host);
  if (env === 'local') return 'no request went to a staging, dev, test or other pre-production host';
  if (env === 'preprod') return 'no request went to a localhost address';
  return 'no request went to a localhost address or to a staging, dev, test or other pre-production host';
}

export function silentChecks(url) {
  return [
    'no network request returned an HTTP 4xx or 5xx status or failed to complete',
    'the browser console shows no errors and no uncaught exceptions',
    envCheck(url),
  ];
}

/** Phase 1: just the flow (and persistence); the pack is the judge of what happened underneath. */
export function observeObjective(flow, { persistence = true } = {}) {
  const f = flow.trim().replace(/\.$/, '');
  return persistence ? `${f}. Then reload the page and verify that the result of the flow is still there.` : `${f}.`;
}

/** Phase 2 (confirm): the flow plus Kane's DevTools checks. */
export function huntObjective(flow, { persistence = true, url } = {}) {
  const checks = silentChecks(url);
  if (persistence) checks.push('after reloading the page the result of the flow is still there');
  return `${flow.trim().replace(/\.$/, '')}. Then verify that ${checks.join(', that ')}.`;
}

/** Assert lines used when a fixed flow is locked as a regression _test.md. */
export function lockAsserts(url) {
  return [
    'Assert: no API calls returned 4xx or 5xx',
    'Assert: no network requests failed',
    'Assert: no console errors',
    `Assert: ${envCheck(url)}`,
  ];
}
