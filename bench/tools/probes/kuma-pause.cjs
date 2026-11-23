// Reset for kuma3713: pause "QB Self" again through Uptime Kuma's own socket API, so
// every Kane attempt starts from a paused monitor. Run from the uptime-kuma checkout.
const { io } = require(require.resolve('socket.io-client', { paths: [process.cwd()] }));
const s = io('http://localhost:3011', { transports: ['websocket'] });
const emit = (...a) => new Promise((r) => s.emit(...a, r));
const timer = setTimeout(() => { console.error('timeout'); process.exit(1); }, 20000);
s.on('monitorList', async (list) => {
  const m = Object.values(list).find((x) => x.name === 'QB Self');
  if (!m) return;
  const r = await emit('pauseMonitor', m.id);
  clearTimeout(timer);
  console.log('pause', r.ok);
  process.exit(r.ok ? 0 : 1);
});
s.on('connect', async () => {
  const r = await emit('login', { username: 'qb', password: 'QuietBench123!', token: '' });
  if (!r.ok) { console.error('login failed', r.msg); process.exit(1); }
});
