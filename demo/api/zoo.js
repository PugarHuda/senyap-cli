// Silent bug zoo API: /zoo/?bug=<kind>. Each kind breaks one thing underneath a page
// that always says "Saved!". Nothing is stored; the zoo is about what the traffic shows.
export default async function handler(req, res) {
  const bug = new URL(req.url, 'http://x').searchParams.get('bug') ?? 'none';
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (bug === 'http_5xx') return res.status(500).json({ error: 'db down' });
  if (bug === 'http_4xx') return res.status(422).json({ error: 'text is invalid' });
  return res.status(201).json({ id: Date.now() });
}
