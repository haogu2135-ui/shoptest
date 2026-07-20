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
    expect(smoke).toContain('guest checkout rate-limit handled');
    expect(smoke).toContain('payment has paymentUrl');
    expect(smoke).toContain('signPaymentCallback');
    expect(smoke).toContain('payment callback received');
    expect(smoke).toContain('paid payment status PAID');
    expect(smoke).toContain('auth register 200');
    expect(smoke).toContain('auth register rate-limit handled');
    expect(smoke).toContain('auth checkout 200');
    expect(smoke).toContain('auth payment create 200');
    expect(smoke).toContain('auth paid payment status PAID');
    expect(smoke).toContain('SHOPTEST_PAYMENT_CALLBACK_SECRET');
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
    expect(serve).toContain('Content-Security-Policy');
    expect(serve).toContain('max-age=31536000, immutable');
    expect(serve).toContain("rel.startsWith('static/')");
    expect(smoke).toContain('ui security headers');
    expect(smoke).toContain('static js long-cache immutable');
  });

  it('keeps a Playwright commercial browser smoke entry for rendered storefront gates', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const browserSmoke = readFrontendRoot('scripts', 'commercial-browser-smoke.js');
    const httpSmoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');
    expect(pkg.scripts['test:commercial-browser-smoke']).toContain('commercial-browser-smoke.js');
    expect(browserSmoke).toContain("require('playwright')");
    expect(browserSmoke).toContain('/cart');
    expect(browserSmoke).toContain('/checkout');
    expect(browserSmoke).toContain('/track-order');
    expect(browserSmoke).toContain('skip link present');
    expect(browserSmoke).toContain('no page errors');
    expect(browserSmoke).toContain('home main content');
    expect(browserSmoke).toContain('cart empty multi-path CTAs');
    expect(browserSmoke).toContain('products catalog populated');
    expect(browserSmoke).toContain('browser auth login success');
    expect(browserSmoke).toContain('browser auth register rate-limit handled');
    expect(browserSmoke).toContain('/api/auth/register');
    expect(browserSmoke).toContain('readMainText');
    expect(browserSmoke).toContain('home LCP soft budget');
    expect(browserSmoke).toContain('home CLS soft budget');
    expect(browserSmoke).toContain('product-mobile-buybar');
    expect(browserSmoke).toContain('login legal agreement notice');
    expect(browserSmoke).toContain('wishlist guest multi-path auth gate');
    expect(browserSmoke).toContain('notifications guest multi-path auth gate');
    expect(browserSmoke).toContain('profile guest multi-path auth gate');
    expect(browserSmoke).toContain('compare empty multi-path CTAs');
    expect(browserSmoke).toContain('product detail bottom nav hidden for buybar');
    expect(browserSmoke).toContain('__shopmxCwv');
    expect(browserSmoke).toContain('PerformanceObserver');
    expect(httpSmoke).toContain('robots.txt allows privacy');
    expect(httpSmoke).toContain('sitemap.xml includes terms');
    expect(browserSmoke).toContain('/forgot-password');
    expect(browserSmoke).toContain('/privacy');
    expect(browserSmoke).toContain('cookie consent banner');
    expect(browserSmoke).toContain('cookie consent sticky rail selectors');
    expect(browserSmoke).toContain('customer-support-widget__button');
    expect(browserSmoke).toContain('shop-nav__bottomBar');
    expect(browserSmoke).toContain('/terms');
    expect(browserSmoke).toContain('/wishlist');
    expect(browserSmoke).toContain('/history');
    // Fixed smoke credentials avoid register thrash; login selectors must not match language Select.
    expect(browserSmoke).toContain('SHOPTEST_SMOKE_AUTH_USER');
    expect(browserSmoke).toContain('SHOPTEST_SMOKE_AUTH_PASSWORD');
    expect(browserSmoke).toContain('form.shopee-login-form input[autocomplete="username"]');
    expect(browserSmoke).toContain("localStorage.getItem('token')");
    expect(browserSmoke).toContain('([1-9]\\d*)\\s+products?');
    expect(httpSmoke).toContain('SHOPTEST_SMOKE_AUTH_USER');
    expect(httpSmoke).toContain('PAYMENT_CALLBACK_SECRET');
  });

  it('keeps Mercado Pago webhook endpoint wired for MX production paid recovery', () => {
    const paymentController = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/controller/PaymentController.java'), 'utf8');
    const paymentService = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/service/PaymentService.java'), 'utf8');
    const security = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/config/SecurityConfig.java'), 'utf8');
    expect(paymentController).toContain('/mercado-pago/webhook');
    expect(paymentController).toContain('handleMercadoPagoWebhook');
    expect(paymentService).toContain('verifyMercadoPagoSignature');
    expect(paymentService).toContain('fetchMercadoPagoPayment');
    expect(security).toContain('/payments/mercado-pago/webhook');
  });

  it('keeps admin system status payment webhook readiness surface for ops', () => {
    const adminSystem = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/controller/AdminSystemController.java'), 'utf8');
    const systemMonitor = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SystemMonitor.tsx'), 'utf8');
    expect(adminSystem).toContain('adminOperationalStatusPayload');
    expect(adminSystem).toContain('enrichPaymentProviderWebhookReadiness');
    expect(adminSystem).toContain('webhookReadyChannelCount');
    expect(adminSystem).toContain('payment.mercado-pago.webhook-secret');
    expect(adminSystem).toContain('stripe.webhook-secret');
    expect(systemMonitor).toContain('paymentWebhooks');
    expect(systemMonitor).toContain('channelWebhookReady');
    expect(systemMonitor).toContain('webhookReadyChannelCount');
    expect(systemMonitor).toContain('data-webhook-status');
  });

  it('keeps admin dashboard drilldown into payment provider webhook readiness', () => {
    const dashboard = fs.readFileSync(path.join(__dirname, '..', 'pages', 'AdminDashboard.tsx'), 'utf8');
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8'));
    expect(dashboard).toContain("navigate('/admin/system')");
    expect(dashboard).toContain('providerReadinessAction');
    expect(dashboard).toContain('data-admin-payment-provider-readiness');
    expect(en.pages.adminDashboard.paymentReturnOps.providerReadinessAction).toBeTruthy();
  });

});
