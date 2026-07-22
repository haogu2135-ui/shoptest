const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const buildRoot = path.resolve(__dirname, '..', 'build');
const host = process.env.SHOPTEST_UI_HOST || '127.0.0.1';
const port = Number(process.env.SHOPTEST_UI_PORT || 4187);
const backendOrigin = new URL(process.env.SHOPTEST_BACKEND_ORIGIN || process.env.REACT_APP_DEV_PROXY_TARGET || 'http://127.0.0.1:8081');
const proxyClient = backendOrigin.protocol === 'https:' ? https : http;

const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

/** Commercial baseline security headers for storefront static responses. */
function commercialSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    // Commercial storefront CSP baseline (matches backend intent; allows product CDN images).
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: http: data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: http: wss: ws:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  };
}

function cacheControlFor(filePath) {
  const rel = path.relative(buildRoot, filePath).split(path.sep).join('/');
  const ext = path.extname(filePath).toLowerCase();
  // Hashed CRA bundles under /static are content-addressed → long cache.
  if (rel.startsWith('static/')) {
    return 'public, max-age=31536000, immutable';
  }
  // Fonts / images in public root can cache briefly; HTML and config stay fresh.
  if (['.woff', '.woff2', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico'].includes(ext)) {
    return 'public, max-age=86400';
  }
  if (rel === 'runtime-config.js' || rel === 'home-hero-vars.css' || rel === 'index.html' || ext === '.html' || rel === 'robots.txt' || rel === 'sitemap.xml' || rel === 'manifest.json' || rel === '.well-known/security.txt') {
    return 'no-cache';
  }
  return 'no-store';
}

function safeBuildPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(buildRoot, normalizedPath);
  return filePath.startsWith(buildRoot) ? filePath : null;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, body) => {
    if (error) {
      res.writeHead(404, { 'Cache-Control': 'no-store', ...commercialSecurityHeaders() });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Cache-Control': cacheControlFor(filePath),
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      ...commercialSecurityHeaders(),
    });
    res.end(body);
  });
}

function destroyQuietly(stream) {
  if (stream && !stream.destroyed) {
    stream.destroy();
  }
}

function proxyHttp(req, res, stripApiPrefix) {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const pathname = stripApiPrefix
    ? requestUrl.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
    : requestUrl.pathname;
  const proxyReq = proxyClient.request({
    protocol: backendOrigin.protocol,
    hostname: backendOrigin.hostname,
    port: backendOrigin.port || (backendOrigin.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: `${pathname}${requestUrl.search}`,
    headers: {
      ...req.headers,
      host: backendOrigin.host,
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': 'http',
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.on('error', () => destroyQuietly(res));
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    if (res.destroyed || res.writableEnded) return;
    if (!res.headersSent) {
      res.writeHead(502, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('backend unavailable');
  });
  req.on('error', () => destroyQuietly(proxyReq));
  res.on('error', () => destroyQuietly(proxyReq));
  req.pipe(proxyReq);
}

function handleStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const filePath = safeBuildPath(requestUrl.pathname);
  if (!filePath) {
    res.writeHead(403, { 'Cache-Control': 'no-store', ...commercialSecurityHeaders() });
    res.end('forbidden');
    return;
  }

  fs.stat(filePath, (error, stat) => {
    let resolvedFile = filePath;
    if (!error && stat.isDirectory()) {
      resolvedFile = path.join(filePath, 'index.html');
    }
    if (!error && stat.isFile()) {
      sendFile(res, resolvedFile);
      return;
    }
    if (path.extname(filePath)) {
      sendFile(res, filePath);
      return;
    }
    sendFile(res, path.join(buildRoot, 'index.html'));
  });
}

function writeUpgradeHeaders(clientSocket, proxyRes) {
  const headers = [`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage || 'Switching Protocols'}`];
  Object.entries(proxyRes.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.push(`${name}: ${item}`));
      return;
    }
    if (value !== undefined) headers.push(`${name}: ${value}`);
  });
  clientSocket.write(`${headers.join('\r\n')}\r\n\r\n`);
}

function proxySitemapWithStaticFallback(req, res) {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const proxyReq = proxyClient.request({
    protocol: backendOrigin.protocol,
    hostname: backendOrigin.hostname,
    port: backendOrigin.port || (backendOrigin.protocol === 'https:' ? 443 : 80),
    method: 'GET',
    path: `/sitemap.xml${requestUrl.search || ''}`,
    headers: {
      host: backendOrigin.host,
      accept: req.headers.accept || 'application/xml,text/xml,*/*',
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': 'http',
    },
    timeout: 8000,
  }, (proxyRes) => {
    const status = proxyRes.statusCode || 502;
    if (status >= 500) {
      destroyQuietly(proxyRes);
      handleStatic(req, res);
      return;
    }
    const headers = {
      ...commercialSecurityHeaders(),
      'Cache-Control': 'public, max-age=300',
      'Content-Type': proxyRes.headers['content-type'] || 'application/xml; charset=utf-8',
    };
    res.writeHead(status, headers);
    proxyRes.on('error', () => destroyQuietly(res));
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
  });
  proxyReq.on('error', () => {
    if (res.destroyed || res.writableEnded || res.headersSent) return;
    handleStatic(req, res);
  });
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  if (requestUrl.pathname.startsWith('/api/')) {
    proxyHttp(req, res, true);
    return;
  }
  if (requestUrl.pathname.startsWith('/uploads/') || requestUrl.pathname.startsWith('/ws/')) {
    proxyHttp(req, res, false);
    return;
  }
  // Prefer live product-aware sitemap from backend; fall back to static marketing sitemap.
  if (requestUrl.pathname === '/sitemap.xml' && (req.method === 'GET' || req.method === 'HEAD')) {
    proxySitemapWithStaticFallback(req, res);
    return;
  }
  handleStatic(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  if (!requestUrl.pathname.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  const proxyReq = proxyClient.request({
    protocol: backendOrigin.protocol,
    hostname: backendOrigin.hostname,
    port: backendOrigin.port || (backendOrigin.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: `${requestUrl.pathname}${requestUrl.search}`,
    headers: {
      ...req.headers,
      host: backendOrigin.host,
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': 'http',
    },
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    const closeBoth = () => {
      destroyQuietly(socket);
      destroyQuietly(proxySocket);
    };
    socket.on('error', closeBoth);
    proxySocket.on('error', closeBoth);
    writeUpgradeHeaders(socket, proxyRes);
    if (head.length && !proxySocket.destroyed) proxySocket.write(head);
    if (proxyHead.length && !socket.destroyed) socket.write(proxyHead);
    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyReq.on('response', (proxyRes) => {
    socket.on('error', () => destroyQuietly(proxyRes));
    proxyRes.on('error', () => destroyQuietly(socket));
    writeUpgradeHeaders(socket, proxyRes);
    proxyRes.pipe(socket);
  });

  proxyReq.on('error', () => {
    if (socket.destroyed) return;
    socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 19\r\n\r\nbackend unavailable');
    socket.destroy();
  });
  socket.on('error', () => destroyQuietly(proxyReq));

  proxyReq.end();
});

server.listen(port, host, () => {
  console.log(`shoptest-ui-server http://${host}:${port} -> ${backendOrigin.origin}`);
});
