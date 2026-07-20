import fs from 'fs';
import path from 'path';

const readFrontendRoot = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');

describe('commercial ops contracts', () => {
  it('keeps a runnable HTTP commercial smoke entry for live storefront+API gates', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const smoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');

    expect(pkg.scripts['test:commercial-smoke']).toContain('commercial-http-smoke.js');
    expect(smoke).toContain('/api/products');
    expect(smoke).toContain('/api/payments/channels');
    expect(smoke).toContain('/api/app/config');
    expect(smoke).toContain('mexico payment rails present');
    expect(smoke).toContain('MERCADO_PAGO');
    expect(smoke).toContain('/checkout');
    expect(smoke).toContain('robots.txt');
    expect(smoke).toContain('/api/orders/checkout/guest');
    expect(smoke).toContain('/api/payments');
    expect(smoke).toContain('/api/orders/track');
    expect(smoke).toContain('guest checkout PENDING_PAYMENT');
    expect(smoke).toContain('payment has paymentUrl');
  });

  it('keeps local UI server proxying API to the backend origin', () => {
    const serve = readFrontendRoot('scripts', 'serve-build.js');
    expect(serve).toContain('SHOPTEST_BACKEND_ORIGIN');
    expect(serve).toContain('/api');
    expect(serve).toMatch(/8081|BACKEND_ORIGIN|backendOrigin/);
  });

  it('keeps commercial security and static cache headers on the local UI server', () => {
    const serve = readFrontendRoot('scripts', 'serve-build.js');
    const smoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');
    expect(serve).toContain('commercialSecurityHeaders');
    expect(serve).toContain('X-Content-Type-Options');
    expect(serve).toContain('X-Frame-Options');
    expect(serve).toContain('Referrer-Policy');
    expect(serve).toContain('max-age=31536000, immutable');
    expect(serve).toContain("rel.startsWith('static/')");
    expect(smoke).toContain('ui security headers');
    expect(smoke).toContain('static js long-cache immutable');
  });

  it('keeps a Playwright commercial browser smoke entry for rendered storefront gates', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const browserSmoke = readFrontendRoot('scripts', 'commercial-browser-smoke.js');
    expect(pkg.scripts['test:commercial-browser-smoke']).toContain('commercial-browser-smoke.js');
    expect(browserSmoke).toContain("require('playwright')");
    expect(browserSmoke).toContain('/cart');
    expect(browserSmoke).toContain('/checkout');
    expect(browserSmoke).toContain('/track-order');
    expect(browserSmoke).toContain('skip link present');
    expect(browserSmoke).toContain('no page errors');
  });
});
