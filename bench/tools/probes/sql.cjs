// usage: node sql.cjs <db file> "<sql>" [<regex the JSON rows must match>]
// Probe: prints the rows, exits 0 when they match the regex, 1 when not.
// Reset: a write statement without a regex; exits 0 when it ran.
const { DatabaseSync } = require('node:sqlite');
const [db, sql, expect] = process.argv.slice(2);
const conn = new DatabaseSync(db);
conn.exec('PRAGMA busy_timeout = 5000');
if (!expect) { conn.exec(sql); console.log('ok'); process.exit(0); }
const rows = JSON.stringify(conn.prepare(sql).all());
console.log(rows);
process.exit(new RegExp(expect).test(rows) ? 0 : 1);
