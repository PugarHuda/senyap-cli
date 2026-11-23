// usage: node credits.js "<flow>" <fromISO> <toISO> A|S  -> sum of Kane session credits for that flow in the window
// A = plain-Kane objective ("<flow>. Then verify that it worked."), S = every other objective built from the flow (Senyap observe/confirm).
const fs = require('fs'), path = require('path'), os = require('os');
const [flow, from, to, mode] = process.argv.slice(2);
const dir = path.join(os.homedir(), '.testmuai/kaneai/sessions');
let sum = 0, n = 0;
for (const s of fs.readdirSync(dir)) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, s, 'session.json'), 'utf8')); } catch { continue; }
  const obj = j.runs?.[0]?.objective || '';
  if (!obj.includes(flow) || j.started_at < from || j.started_at > to) continue;
  if ((obj === flow + '. Then verify that it worked.') !== (mode === 'A')) continue;
  sum += +j.credits_consumed || 0; n++;
}
console.log(sum.toFixed(2), n);
