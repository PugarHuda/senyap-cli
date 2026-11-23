// usage: node check.cjs <probe|reset> <bug> <db file>
// QuietBench's data checks: what Senyap's `probe` and `reset` run for the bugs that
// leave nothing in the network or console. Each probe reads the app's own database.
const { DatabaseSync } = require('node:sqlite');
const [mode, bug, db] = process.argv.slice(2);
const SPECS = {
  // The monitor must never run after an unchanged Edit + Save. "Still paused at the end"
  // is not enough: in run A, Kane's agent pressed Pause itself before checking. A paused
  // monitor writes no heartbeats, so any heartbeat means it was resumed at some point.
  kuma3713: { probe: ['SELECT count(*) AS beats FROM heartbeat', /"beats":0/], reset: 'DELETE FROM heartbeat' },
  // The rename must be stored, not just toasted.
  tududi904: { probe: ["SELECT name FROM tasks WHERE name LIKE 'QB %'", /"QB renamed"/], reset: 'DELETE FROM tasks' },
  // Both preferences must be stored after the second update.
  // (GENERAL is protojson: {"appearance":"dark","memoVisibility":"PUBLIC"})
  memos4978: { probe: ["SELECT value FROM user_setting WHERE key = 'GENERAL'", /(?=.*\\"appearance\\":\\"dark\\")(?=.*\\"memoVisibility\\":\\"PUBLIC\\")/], reset: "DELETE FROM user_setting WHERE key = 'GENERAL'" },
};
const spec = SPECS[bug];
const conn = new DatabaseSync(db);
conn.exec('PRAGMA busy_timeout = 5000');
if (mode === 'reset') { if (spec.reset) conn.exec(spec.reset); console.log('reset', bug); process.exit(0); }
const [sql, expect] = spec.probe;
const rows = JSON.stringify(conn.prepare(sql).all());
console.log(rows);
process.exit(expect.test(rows) ? 0 : 1);
