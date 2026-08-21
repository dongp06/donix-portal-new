import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import next from 'next';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.TB_NEXT_INTERNAL_PORT || port + 100);
const apiOrigin = new URL(process.env.API_URL || 'http://localhost:3002');

function proxyRequest(req, res, targetOrigin) {
  const target = new URL(req.url || '/', targetOrigin);
  const transport = target.protocol === 'https:' ? https : http;
  const clientAddress = req.socket.remoteAddress || 'unknown';
  const upstream = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        // The public origin must survive the internal web -> API hop so DPoP
        // htu and OAuth redirect checks see the URL the browser used. Never
        // copy caller-supplied forwarded headers through this boundary.
        'x-forwarded-host': req.headers.host || target.host,
        'x-forwarded-proto': req.socket.encrypted ? 'https' : 'http',
        'x-forwarded-for': clientAddress,
        'accept-encoding': 'identity',
      },
    },
    (response) => {
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) res.setHeader(name, value);
      }
      // Node exposes Set-Cookie as an array. Keep every cookie as a separate
      // header and do not rewrite Domain/Path/Secure attributes at the web
      // proxy boundary; auth cookie host binding is an API contract.
      const setCookies = response.headers['set-cookie'];
      if (setCookies) res.setHeader('set-cookie', Array.isArray(setCookies) ? setCookies : [setCookies]);
      if (!res.hasHeader('x-content-type-options')) res.setHeader('x-content-type-options', 'nosniff');
      if (!res.hasHeader('x-frame-options')) res.setHeader('x-frame-options', 'DENY');
      if (!res.hasHeader('referrer-policy')) res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
      if (!res.hasHeader('permissions-policy')) res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
      if (!res.hasHeader('cross-origin-resource-policy')) res.setHeader('cross-origin-resource-policy', 'same-origin');
      if (!res.hasHeader('x-dns-prefetch-control')) res.setHeader('x-dns-prefetch-control', 'off');
      if (!res.hasHeader('origin-agent-cluster')) res.setHeader('origin-agent-cluster', '?1');
      const publicProtocol = String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http'))
        .split(',', 1)[0]
        .trim()
        .toLowerCase();
      if (publicProtocol === 'https' && !res.hasHeader('strict-transport-security')) {
        res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
      }
      res.statusCode = response.statusCode || 502;
      response.pipe(res);
    },
  );
  let completed = false;
  const fail = () => {
    if (completed || res.headersSent) return;
    completed = true;
    res.writeHead(503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': '2',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    res.end(JSON.stringify({
      success: false,
      error: 'API temporarily unavailable.',
      code: 'API_UNAVAILABLE',
    }));
  };
  upstream.setTimeout(30_000, () => upstream.destroy());
  upstream.on('response', () => { completed = false; });
  upstream.on('error', fail);
  req.on('error', fail);
  req.pipe(upstream);
}

const nextApp = next({ dev: false, hostname: '127.0.0.1', port: internalPort, dir: webRoot });
await nextApp.prepare();
const handle = nextApp.getRequestHandler();
const internalServer = http.createServer((req, res) => {
  void Promise.resolve(handle(req, res));
});
await new Promise((resolve, reject) => {
  internalServer.once('error', reject);
  internalServer.listen(internalPort, '127.0.0.1', resolve);
});

const server = http.createServer((req, res) => {
  const requestPath = req.url?.split('?', 1)[0] || '/';
  if (requestPath === '/api' || requestPath.startsWith('/api/')) {
    proxyRequest(req, res, apiOrigin);
    return;
  }
  proxyRequest(req, res, new URL(`http://127.0.0.1:${internalPort}`));
});

server.listen(port, hostname, () => {
  console.log(`Web listening on http://${hostname}:${port}`);
  console.log(`Next renderer loopback: http://127.0.0.1:${internalPort}`);
  console.log('JavaScript delivery: normal Next assets with post-build obfuscation');
});
