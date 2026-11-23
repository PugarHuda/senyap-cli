// Senyap on the public demos of open-source apps, looking for silent failures nobody planted.
// usage: node bench/tools/wild.js [name...]  -> bench/wild-results.json
// Every hit is checked by hand before anything is reported upstream (see bench/WILD.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { huntFlow } from '../../src/hunt.js';

const BENCH = resolve(fileURLToPath(import.meta.url), '../..');
const OUT = join(BENCH, 'wild-results.json');
const LOGIN = 'Log in with the demo credentials shown on the login page (if there is no login, skip this)';
export const TARGETS = {
  linkding: { url: 'https://demo.linkding.link', flow: `${LOGIN}, add a bookmark for https://example.org with the title "QB wild" and the tag qbwild, save it, and check it is in the bookmark list` },
  memos: { url: 'https://demo.usememos.com', flow: `${LOGIN}, write a memo that says "QB wild check" and save it, and check it appears in the memo list` },
  mealie: { url: 'https://demo.mealie.io', flow: `${LOGIN}, create a new recipe named "QB Wild Toast" by hand, save it, and check the recipe page shows that name` },
  grocy: { url: 'https://demo.grocy.info', flow: `${LOGIN}, open the shopping list, add 1 of any product to it, save, and check it is on the shopping list` },
  listmonk: { url: 'https://demo.listmonk.app', flow: `${LOGIN}, create a new list named "QB wild", save it, and check it is in the lists table` },
  kimai: { url: 'https://demo.kimai.org', flow: `${LOGIN}, create a new customer named "QB Wild" with any required fields, save it, and check it is in the customer list` },
  actual: { url: 'https://demo.actualbudget.org', flow: 'Start the demo budget, add a transaction of 5.00 named "QB wild" to any account, save it, and check it is in that account\'s transaction list' },
};

const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TARGETS);
const work = join(BENCH, '..', '.senyap', 'wild');
mkdirSync(work, { recursive: true });
for (const n of names) {
  if (results[n]) continue;
  const { url, flow } = TARGETS[n];
  const r = await huntFlow({ url, flow, workDir: work });
  results[n] = { url, flow, at: new Date().toISOString(), status: r.status, credits: r.credits ?? r.kane.credits, kane: r.kane, observe: r.observe, confirm: r.confirm,
    findings: r.findings.map(({ kind, severity, method, url: u, status, detail, step }) => ({ kind, severity, method, url: u, status, step, detail: detail?.slice(0, 300) })), kanePack: r.kanePack };
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.error(n, r.status, r.kane.result_code, r.findings.filter((f) => f.severity === 'blocking').map((f) => `${f.kind} ${f.method ?? ''} ${f.url ?? ''} ${f.status ?? ''}`).join(' | '));
}
