#!/usr/bin/env node
// senyap: catch the bugs that fail silently. See README.md.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { huntFlow, brief, saveReport, POLICY } from '../src/hunt.js';
import { readPack } from '../src/pack.js';
import { producePack } from '../src/producer.js';
import { verdict } from '../src/kane.js';
import { loadConfig } from '../src/config.js';
import { VERSION } from '../src/version.js';

const HELP = `senyap ${VERSION}: catch the bugs that fail silently (powered by Kane CLI)

  senyap hunt [--url <u>] [--flow "<flow>"]...   Kane drives each flow and checks under the screen
  senyap check <kane .evidence pack>...           Judge packs Kane already wrote (testmd, testrun, CI)
  senyap guard                                    Agent Stop hook: block "done" until flows are clean
  senyap lock [--flow "<flow>"]                   Save clean flows as regression *_test.md files
  senyap init [--agent claude|codex|cursor|all]   Write senyap.config.json and install the agent hook

Flows and URL default to senyap.config.json. Exit 0 clean, 1 silent failure, 2 Kane did not run.`;

const [cmd, ...rest] = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: rest, allowPositionals: true,
  options: { url: { type: 'string' }, flow: { type: 'string', multiple: true }, json: { type: 'boolean' }, headed: { type: 'boolean' }, agent: { type: 'string' }, 'no-persistence': { type: 'boolean' } },
});

const commands = {
  async hunt() {
    const cfg = loadConfig();
    const url = values.url ?? cfg.url;
    const flows = values.flow ?? cfg.flows;
    if (!url || !flows?.length) throw new Error('need --url and at least one --flow (or senyap.config.json)');
    const results = [];
    for (const flow of flows) {
      log(`▶ ${flow}`);
      const r = await huntFlow({ url, flow, headless: !values.headed, persistence: !values['no-persistence'] && cfg.persistence !== false });
      log(`  ${icon(r.status)} ${r.status}  kane=${r.kane.status}/${r.kane.result_code}  findings=${r.findings.length}  ${r.kane.test_url ?? ''}`);
      results.push(r);
    }
    saveReport(results);
    if (values.json) console.log(JSON.stringify(results, null, 2)); else console.log('\n' + brief(results));
    return results.some((r) => r.status === 'not_run') && !results.some((r) => r.status === 'silent_failure') ? 2 : results.some((r) => r.status !== 'clean') ? 1 : 0;
  },
  async check() {
    if (!positionals.length) throw new Error('give one or more Kane .evidence packs');
    let worst = 0;
    for (const p of positionals) {
      const pack = await readPack(p);
      mkdirSync(join('.senyap', 'packs'), { recursive: true });
      const sealed = await producePack(pack, { outDir: join('.senyap', 'packs'), sourcePack: p });
      const v = await verdict(sealed, POLICY);
      const failed = v.doc?.policies?.flatMap((x) => x.failed_gate_ids) ?? [];
      for (const t of pack.tests) log(`${icon(t.falseGreen || failed.length ? 'silent_failure' : 'clean')} ${t.id}  kane=${t.kaneStatus}  findings=${t.findings.length}${t.falseGreen ? '  FALSE GREEN' : ''}`);
      log(`  verdict: ${v.passed ? 'pass' : `fail (${failed.join(', ')})`}  ${sealed}`);
      worst = Math.max(worst, v.passed ? 0 : 1);
    }
    return worst;
  },
  async guard() { return (await import('../src/guard.js')).guard({ agent: values.agent }); },
  async lock() { return (await import('../src/lock.js')).lockCommand(values); },
  async init() { return (await import('../src/init.js')).init(values); },
};

function icon(s) { return { clean: '✔', silent_failure: '✖', failed: '✖', not_run: '…' }[s] ?? '?'; }
function log(m) { process.stderr.write(m + '\n'); }

if (!cmd || cmd === '-h' || cmd === '--help' || !commands[cmd]) { console.log(HELP); process.exit(cmd && !['-h', '--help'].includes(cmd) ? 2 : 0); }
commands[cmd]().then((code) => process.exit(code ?? 0), (e) => { log(`senyap: ${e.message}`); process.exit(2); });
