#!/usr/bin/env node
/**
 * Commercial HTTP smoke for ShopMX storefront + API proxy.
 * Usage: SHOPTEST_UI_BASE=http://127.0.0.1:4187 node scripts/commercial-http-smoke.js
 * Exit 0 only when all critical commercial probes pass.
 */
const base = (process.env.SHOPTEST_UI_BASE || 'http://127.0.0.1:4187').replace(/\/$/, '');
const results = [];

const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '').slice(0, 240) });
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function head(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'HEAD',
      headers: { Accept: '*/*' },
      signal: controller.signal,
    });
    return { status: res.status, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function post(path, body, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body: buf };
  } finally {
    clearTimeout(timer);
  }
}

async function get(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: '*/*' },
      signal: controller.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body: buf };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const home = await get('/');
  check('ui home 200', home.status === 200, home.status);
  check('ui home html', home.body.includes('id="root"') || home.body.includes("id='root'"));

  const homeHead = await head('/');
  const sec = (name) => String(homeHead.headers.get(name) || '');
  check('ui security headers', (
    sec('x-content-type-options').toLowerCase() === 'nosniff'
    && sec('x-frame-options').toUpperCase() === 'SAMEORIGIN'
    && /strict-origin/i.test(sec('referrer-policy'))
  ), `xcto=${sec('x-content-type-options')};xfo=${sec('x-frame-options')};rp=${sec('referrer-policy')}`);
  check('ui html cache no-cache', /no-cache|no-store|max-age=0/i.test(sec('cache-control')), sec('cache-control'));

  const mainJsMatch = home.body.toString('utf8').match(/\/static\/js\/main\.[^"'\s]+\.js/);
  if (mainJsMatch) {
    const assetHead = await head(mainJsMatch[0]);
    const cache = String(assetHead.headers.get('cache-control') || '');
    check('static js long-cache immutable', /max-age=31536000/i.test(cache) && /immutable/i.test(cache), cache);
  } else {
    check('static js long-cache immutable', false, 'main js not found in home html');
  }

  for (const path of ['/products', '/cart', '/checkout', '/login', '/register', '/coupons', '/track-order', '/wishlist', '/history']) {
    const res = await get(path);
    check(`spa ${path}`, res.status === 200 && (res.body.includes('id="root"') || res.body.includes("id='root'")), res.status);
  }

  const products = await get('/api/products?page=0&size=5');
  check('api products proxy', products.status === 200, products.status);
  let items = [];
  if (products.status === 200) {
    const data = JSON.parse(products.body.toString('utf8'));
    items = data.items || data.content || [];
    check('api products has items', items.length >= 1, `count=${items.length}`);
  }

  for (const path of ['/api/categories', '/api/brands', '/api/coupons/public', '/api/payments/channels', '/api/app/config']) {
    const res = await get(path);
    check(`api ${path}`, res.status === 200, res.status);
  }

  const channels = await get('/api/payments/channels');
  if (channels.status === 200) {
    const list = JSON.parse(channels.body.toString('utf8'));
    check('payment channels available', Array.isArray(list) && list.length >= 1, `count=${list.length}`);
    const codes = new Set(list.map((c) => c.code));
    check('mexico payment rails present', ['MERCADO_PAGO', 'OXXO', 'SPEI'].some((c) => codes.has(c)), [...codes].slice(0, 8).join(','));
  }

  const config = await get('/api/app/config');
  if (config.status === 200) {
    const cfg = JSON.parse(config.body.toString('utf8'));
    check('shipping commerce config', cfg.defaultShippingFee != null || cfg.freeShippingThreshold != null, JSON.stringify({
      defaultShippingFee: cfg.defaultShippingFee,
      freeShippingThreshold: cfg.freeShippingThreshold,
    }));
  }

  const pid = items[0]?.id || 2;
  const detail = await get(`/api/products/${pid}`);
  check('api product detail', detail.status === 200, `id=${pid} status=${detail.status}`);


  // Commercial conversion path: guest checkout → payment create → order track
  const productId = Number(pid) || 2;
  const guestEmail = `smoke.guest.${Date.now()}@example.com`;
  const idempotencyKey = `commercial-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const checkoutRes = await post('/api/orders/checkout/guest', {
    guestEmail,
    guestName: 'Commercial Smoke Guest',
    guestPhone: '5512345678',
    shippingAddress: 'Av. Reforma 222, Ciudad de Mexico, CDMX 06600, MX',
    paymentMethod: 'MERCADO_PAGO',
    items: [{ productId, quantity: 1 }],
  }, { 'Idempotency-Key': idempotencyKey });
  check('guest checkout 200', checkoutRes.status === 200, checkoutRes.status);
  let orderId = null;
  let orderNo = '';
  if (checkoutRes.status === 200) {
    const order = JSON.parse(checkoutRes.body.toString('utf8'));
    orderId = order.id;
    orderNo = order.orderNo || '';
    check('guest checkout PENDING_PAYMENT', order.status === 'PENDING_PAYMENT', order.status);
    check('guest checkout orderNo', Boolean(orderNo), orderNo);
    check('guest checkout guestOrder', order.guestOrder === true, String(order.guestOrder));
  }

  if (orderId && orderNo) {
    const payRes = await post('/api/payments', {
      orderId,
      channel: 'MERCADO_PAGO',
      guestEmail,
      orderNo,
    });
    check('payment create 200', payRes.status === 200, payRes.status);
    if (payRes.status === 200) {
      const payment = JSON.parse(payRes.body.toString('utf8'));
      check('payment PENDING', payment.status === 'PENDING', payment.status);
      check('payment has paymentUrl', Boolean(payment.paymentUrl) && String(payment.paymentUrl).startsWith('http'), String(payment.paymentUrl || '').slice(0, 80));
      check('payment channel MERCADO_PAGO', payment.channel === 'MERCADO_PAGO', payment.channel);
    }

    const trackRes = await post('/api/orders/track', { orderNo, email: guestEmail });
    check('guest order track 200', trackRes.status === 200, trackRes.status);
    if (trackRes.status === 200) {
      const track = JSON.parse(trackRes.body.toString('utf8'));
      const trackedOrder = track.order || track;
      check('guest order track orderNo match', (trackedOrder.orderNo || '') === orderNo, trackedOrder.orderNo || Object.keys(track).join(','));
    }
  } else {
    check('payment create skipped', false, 'missing order from guest checkout');
    check('guest order track skipped', false, 'missing order from guest checkout');
  }

  const robots = await get('/robots.txt');
  check('robots.txt', robots.status === 200 && /user-agent/i.test(robots.body.toString('utf8')), robots.status);
  const sitemap = await get('/sitemap.xml');
  check('sitemap.xml', sitemap.status === 200 && sitemap.body.includes('<urlset'), sitemap.status);

  const passed = results.filter((r) => r.pass).length;
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY ${passed}/${results.length} passed @ ${base}`);
  if (passed !== results.length) {
    results.filter((r) => !r.pass).forEach((r) => console.error(` - ${r.name}: ${r.detail}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('SMOKE_CRASH', error);
  process.exit(2);
});
