// Gather the real outputs shown in the video into src/data.json. Nothing here is typed by hand:
// terminal lines come from public/data/*.txt (captured runs), the loop from the Claude Code
// transcript (public/data/loop.json), the benchmark from ../../quietbench/results.json when present.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`./public/data/${f}`, import.meta.url), 'utf8');
const clean = (t) => t.replace(/\r/g, '').replace(/\s+https:\/\/test-manager\.lambdatest\.com\S+/g, '').replace(/\s+\S*\.senyap[\\/]packs[\\/]\S+/g, '').trim();

const plain = JSON.parse(read('plain-run-end.json'));
const loop = JSON.parse(read('loop.json'));
const durations = JSON.parse(readFileSync(new URL('./public/vo/durations.json', import.meta.url), 'utf8'));

const firstLines = (t, n) => clean(t).split('\n').filter((l) => l.trim()).slice(0, n);
const hunt = (f) => firstLines(read(f), 2).map((l) => l.replace(/^\s+/, ''));

const claudeDone = loop.find((x) => x.who === 'Claude Code').text;
const brief = loop.find((x) => x.who === 'Senyap' && /Stop hook feedback/.test(x.text)).text;
const fixMsg = loop.filter((x) => x.who === 'Claude Code').at(-1).text;
const finalMsg = loop.filter((x) => x.who === 'Senyap').at(-1).text.replace(/^Stop says: /, '');

let bench = null;
const qb = new URL('../../quietbench/results.json', import.meta.url);
if (existsSync(qb)) bench = JSON.parse(readFileSync(qb, 'utf8'));

writeFileSync(new URL('./src/data.json', import.meta.url), JSON.stringify({
  durations,
  plain: {
    cmd: `kane-cli run "Type 'hello' in the note field, click Save, and verify the note was really saved" --agent`,
    lines: [`{"type":"run_end","status":"${plain.status}","result_code":${plain.result_code},`, `  "reason_code":"${plain.reason_code}",`, `  "summary":"${plain.summary}"}`],
  },
  check: { cmd: 'senyap check <that run\'s .evidence pack>', lines: firstLines(read('check.txt'), 2) },
  init: { cmd: 'npx senyap init --agent claude', lines: ['hooked claude: .claude/settings.json', 'installed Kane CLI agent skill (kane-cli install skill)'] },
  tryBuggy: hunt('hunt-buggy.txt'),
  tryFixed: hunt('hunt-fixed.txt'),
  claudeDone, brief, fixMsg, finalMsg,
  bench,
}, null, 1));
console.log('wrote src/data.json', bench ? `with ${bench.length} benchmark rows` : 'without benchmark');
