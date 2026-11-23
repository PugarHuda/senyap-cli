// ponytail: Node 26 removed buffer.SlowBuffer; old deps (buffer-equal-constant-time via jwa) read its prototype at load. Env shim only, app code untouched.
const b = require('buffer'); if (!b.SlowBuffer) { const S = function SlowBuffer(n) { return Buffer.allocUnsafeSlow(n); }; S.prototype = Buffer.prototype; b.SlowBuffer = S; }
