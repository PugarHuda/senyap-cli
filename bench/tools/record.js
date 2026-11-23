// usage: node record.js  -> rebuilds ../results.json + ../RESULTS.md from tools/meta.json + scratch/<bug>-A/A.json + results/<bug>-{pre,post}.json
// Superseded senyap 0.1.1 reports live in results/v011/<bug>-{pre,post}.json (+ .credits) and are shown in their own table.
const fs = require('fs'), path = require('path');
const Q = path.resolve(__dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'meta.json'), 'utf8'));
const rd = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const num = p => { try { return +fs.readFileSync(p, 'utf8'); } catch { return null; } };
const sen = (p, creditsFile) => {
  const rep = rd(p); if (!rep) return null;
  const r = rep.results[0];
  const fs_ = r.findings || [];
  return { senyap: r.observe ? '0.1.2' : '0.1.1', status: r.status, result_code: r.kane?.result_code ?? null, reason_code: r.kane?.reason_code ?? null,
    verdict_family: r.kane?.verdict?.family ?? null,
    observe: r.observe ? { status: r.observe.status, result_code: r.observe.kane?.result_code, test_url: r.observe.kane?.test_url } : null,
    test_url: r.observe?.kane?.test_url ?? r.kane?.test_url ?? null, confirm_test_url: r.confirm?.kane?.test_url ?? null,
    blocking: fs_.filter(f => (f.severity ?? 'blocking') === 'blocking').length,
    findings: fs_.map(f => [f.severity ?? 'blocking', f.kind, f.method, f.url, f.status, (f.detail || f.text || '').slice(0, 160)].filter(Boolean).join(' ')),
    falseGreen: !!r.falseGreen, confirm_status: r.confirm?.status ?? null, retried: !!r.retriedAfter,
    credits: num(creditsFile) ?? r.credits ?? r.kane?.credits ?? null };
};
const S = (bug, ph) => sen(path.join(Q, 'results', `${bug}-${ph}.json`), path.join(Q, 'scratch', `${bug}-${ph}`, 'credits.txt'));
const L = (bug, ph) => sen(path.join(Q, 'results', 'v011', `${bug}-${ph}.json`), path.join(Q, 'results', 'v011', `${bug}-${ph}.credits`));
const out = meta.map(m => {
  const a = rd(path.join(Q, 'scratch', m.bug + '-A', 'A.json'));
  const legacy = { B: L(m.bug, 'pre'), C: L(m.bug, 'post') };
  return { bug: m.bug, app: m.app, issue_url: m.issue_url, fix_url: m.fix_url, pre_sha: m.pre_sha, fix_sha: m.fix_sha, flow: m.flow,
    A: a && { status: a.status, result_code: a.result_code, reason_code: a.reason_code, test_url: a.test_url, credits: num(path.join(Q, 'scratch', m.bug + '-A', 'credits.txt')) ?? a.credits, summary: a.summary },
    B: S(m.bug, 'pre'), C: S(m.bug, 'post'), superseded_v011: (legacy.B || legacy.C) ? legacy : undefined, notes: m.notes || '' };
});
fs.writeFileSync(path.join(Q, 'results.json'), JSON.stringify(out, null, 2));
console.log(out.map(o => `${o.bug}: A=${o.A?.status}/${o.A?.result_code} B=${o.B?.status}/${o.B?.result_code} C=${o.C?.status}/${o.C?.result_code}`).join('\n'));

const cell = (x, sen) => !x ? 'not run' : `${x.status} (${x.result_code ?? '-'}${x.reason_code ? ' ' + x.reason_code.replace('assertion_error.', '') : ''})` +
  (sen ? `, ${x.blocking} blocking / ${x.findings.length} findings${x.falseGreen ? ', falseGreen' : ''}${x.observe ? `, observe ${x.observe.status}/${x.observe.result_code}` : ''}` : '');
const link = (x, n) => x?.test_url ? `[${n}](${x.test_url})` + (x.confirm_test_url && x.confirm_test_url !== x.test_url ? ` [${n}c](${x.confirm_test_url})` : '') : '';
const bad = s => s === 'silent_failure' || s === 'failed';
const caughtA = o => o.A && o.A.status === 'failed' && o.A.result_code === 740;
const sum = k => out.reduce((s, o) => s + (+o[k]?.credits || 0), 0);
const n = f => out.filter(f).length;
const md = [`# QuietBench results`, '', `Generated ${new Date().toISOString()} by tools/record.js from results.json. B and C columns are senyap 0.1.2 unless marked; superseded 0.1.1 rows are in their own table below.`, '',
  '| Bug | Plain Kane on buggy (A) | Senyap on buggy (B) | Senyap on fixed (C) | Kane links |', '|---|---|---|---|---|',
  ...out.map(o => `| [${o.bug}](${o.issue_url}) | ${cell(o.A)} | ${cell(o.B, 1)} | ${cell(o.C, 1)} | ${[link(o.A, 'A'), link(o.B, 'B'), link(o.C, 'C')].filter(Boolean).join(' · ')} |`),
  '', '## Totals (current rows)', '',
  `- Bugs in the table: ${out.length}`,
  `- Caught by plain Kane (A failed with 740 confirmed_product_bug): ${n(caughtA)}/${n(o => o.A)}`,
  `- Caught by Senyap (B silent_failure or failed): ${n(o => o.B && bad(o.B.status))}/${n(o => o.B)}`,
  `- Senyap false alarms on the fixed build (C silent_failure or failed): ${n(o => o.C && bad(o.C.status))}/${n(o => o.C)}`,
  `- Senyap clean on the fixed build: ${n(o => o.C?.status === 'clean')}/${n(o => o.C)}`,
  `- Inconclusive / not_run Senyap results: B ${n(o => o.B && !bad(o.B.status) && o.B.status !== 'clean')}, C ${n(o => o.C && !bad(o.C.status) && o.C.status !== 'clean')}`,
  `- Senyap clean on the buggy build (missed): ${n(o => o.B?.status === 'clean')}`,
  `- Credits (Kane session sums): A ${sum('A').toFixed(1)}, B ${sum('B').toFixed(1)}, C ${sum('C').toFixed(1)}, total ${(sum('A') + sum('B') + sum('C')).toFixed(1)}`,
  '', '## Superseded senyap 0.1.1 rows (kept for the record)', '', '| Bug | Senyap 0.1.1 on buggy | Senyap 0.1.1 on fixed | credits |', '|---|---|---|---|',
  ...out.filter(o => o.superseded_v011).map(o => { const l = o.superseded_v011; return `| ${o.bug} | ${cell(l.B, 1)} | ${cell(l.C, 1)} | ${((+l.B?.credits || 0) + (+l.C?.credits || 0)).toFixed(1)} |`; }),
  '', '## Per-bug notes', '', ...out.map(o => `- **${o.bug}** (${o.pre_sha} -> ${o.fix_sha}). Flow: "${o.flow}". ${o.notes}`)];
let extra = ''; try { extra = fs.readFileSync(path.join(__dirname, 'results_extra.md'), 'utf8'); } catch {}
fs.writeFileSync(path.join(Q, 'RESULTS.md'), md.join('\n') + '\n' + (extra ? '\n' + extra : ''));
