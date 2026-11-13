// Local dev server mimicking vercel.json routing + /api/csv.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const csv = require('../api/csv.js');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.json': 'application/json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = u.pathname;
  if (p === '/') { res.writeHead(307, { Location: '/setup' }); return res.end(); }
  if (p === '/api/csv') return csv(req, res);
  if (p === '/setup') p = '/setup.html';
  if (/^\/b\/[^/]+$/.test(p)) p = '/b.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(process.env.PORT || 4173, () => console.log('listening'));
