// Objectives that make Kane look under the screen. Measured on a probe app whose
// UI says "Saved!" while the API answers 500: the plain objective passed (code
// 100); the same flow with these checks came back 740 confirmed_product_bug.

export const SILENT_CHECKS = [
  'no network request returned an HTTP 4xx or 5xx status or failed to complete',
  'the browser console shows no errors and no uncaught exceptions',
  'no request went to a localhost, staging, dev or test host',
];

/** The hunt objective for one user flow. */
export function huntObjective(flow, { persistence = true } = {}) {
  const checks = [...SILENT_CHECKS];
  if (persistence) checks.push('after reloading the page the result of the flow is still there');
  return `${flow.trim().replace(/\.$/, '')}. Then verify that ${checks.join(', that ')}.`;
}

/** Assert lines used when a fixed flow is locked as a regression _test.md. */
export const LOCK_ASSERTS = [
  'Assert: no API calls returned 4xx or 5xx',
  'Assert: no network requests failed',
  'Assert: no console errors',
  'Assert: no request URL contains "localhost", "staging." or "dev."',
];
