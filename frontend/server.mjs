// Custom Next.js server. It exists for one reason: the API proxy must forward the
// real client IP, because the backend's login rate limit keys on X-Forwarded-For.
// Next.js keeps a client-sent X-Forwarded-For (it only fills the header when it is
// missing), so with `next dev` / `next start` a browser could fake a new IP on every
// attempt. Here the header is replaced with the TCP peer address before Next.js runs.
//
//   node server.mjs         development (Turbopack, hot reload)
//   node server.mjs start   production (run `npm run build` first)
import { createServer } from 'node:http';

const production = process.argv[2] === 'start';
// Must be set before Next.js loads, hence the dynamic import below.
process.env.NODE_ENV = production ? 'production' : 'development';

const { default: next } = await import('next');

const hostname = '127.0.0.1';
const port = 3000;

const app = next({ dev: !production, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();

createServer((req, res) => {
  // Trust only the socket. A reverse proxy placed in front later needs its own trusted-hop rule.
  const ip = req.socket.remoteAddress;
  if (ip) req.headers['x-forwarded-for'] = ip;
  else delete req.headers['x-forwarded-for'];
  void handle(req, res);
}).listen(port, hostname, () => {
  console.log(`> Frontend on http://${hostname}:${port} (${process.env.NODE_ENV})`);
});
