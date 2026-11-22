// Demo app for Senyap: a notes app whose screen always looks fine.
// It ships with two silent bugs (see README.md). Run: node server.js [port]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const notes = [{ id: 1, text: 'Welcome to Notes' }];
const page = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

// Builds the "query" the storage layer runs. Real apps do this with SQL.
function insertQuery(text) {
  const q = `INSERT INTO notes (text) VALUES ('${text}')`;
  if ((q.match(/'/g) ?? []).length !== 2) throw new Error('syntax error near "' + text + '"');
  return q;
}

createServer((req, res) => {
  const send = (status, body, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  if (req.url === '/' && req.method === 'GET') return send(200, page, 'text/html');
  if (req.url === '/api/notes' && req.method === 'GET') return send(200, notes);
  if (req.url === '/api/notes' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; });
    return req.on('end', () => {
      try {
        const { text } = JSON.parse(body || '{}');
        insertQuery(text);
        const note = { id: notes.length + 1, text };
        notes.push(note);
        send(201, note);
      } catch (e) { send(500, { error: e.message }); }
    });
  }
  send(404, { error: 'not found' });
}).listen(Number(process.argv[2] ?? 4800), () => console.log(`notes-app on http://127.0.0.1:${process.argv[2] ?? 4800}`));
