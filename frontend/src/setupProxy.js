const { createProxyMiddleware } = require('http-proxy-middleware');

const backendTarget = process.env.REACT_APP_DEV_PROXY_TARGET || process.env.DEV_PROXY_TARGET || 'http://localhost:8081';

module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
      logLevel: 'warn',
    })
  );

  app.use(
    '/ws',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      ws: true,
      logLevel: 'warn',
    })
  );
};
