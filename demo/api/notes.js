// Hosted Senyap demo: the notes app with its silent bugs (/) and the fixed one (/fixed/).
// Notes live in a cookie so they survive a reload on serverless, with no database.
const MAX = 20;

function readNotes(req) {
  const m = /(?:^|;\s*)notes=([^;]+)/.exec(req.headers.cookie ?? '');
  try { return m ? JSON.parse(Buffer.from(decodeURIComponent(m[1]), 'base64url').toString('utf8')) : []; } catch { return []; }
}

function writeNotes(res, notes) {
  const v = Buffer.from(JSON.stringify(notes.slice(-MAX))).toString('base64url');
  res.setHeader('set-cookie', `notes=${v}; Path=/; Max-Age=86400; SameSite=Lax; Secure; HttpOnly`);
}

// The bug: the "query" is built by string concatenation, so an apostrophe breaks it.
function insertQuery(text) {
  const q = `INSERT INTO notes (text) VALUES ('${text}')`;
  if ((q.match(/'/g) ?? []).length !== 2) throw new Error(`syntax error near "${text}"`);
  return q;
}

export default async function handler(req, res) {
  const fixed = new URL(req.url, 'http://x').searchParams.get('v') === 'fixed';
  const notes = readNotes(req);
  if (req.method === 'GET') return res.status(200).json(notes);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    if (!fixed) insertQuery(text);
    const note = { id: Date.now(), text };
    writeNotes(res, [...notes, note]);
    return res.status(201).json(note);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
