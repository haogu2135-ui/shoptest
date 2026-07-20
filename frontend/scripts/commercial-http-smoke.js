#!/usr/bin/env node
/**
 * Commercial HTTP smoke for ShopMX storefront + API proxy.
 * Usage: SHOPTEST_UI_BASE=http://127.0.0.1:4187 node scripts/commercial-http-smoke.js
 * Exit 0 only when all critical commercial probes pass.
 */
const crypto = require('crypto');
const base = (process.env.SHOPTEST_UI_BASE || 'http://127.0.0.1:4187').replace(/\/$/, '');
const paymentCallbackSecret = String(process.env.SHOPTEST_PAYMENT_CALLBACK_SECRET || process.env.PAYMENT_CALLBACK_SECRET || '').trim();
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


function javaPlainAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return String(amount);
  // Mimic BigDecimal.stripTrailingZeros().toPlainString() for common shop amounts.
  let s = num.toFixed(8).replace(/\.?0+$/, '');
  if (s === '-0') s = '0';
  return s;
}

function signPaymentCallback({ orderNo, channel, transactionId, status, amount, callbackTimestamp, secret }) {
  const payload = [
    orderNo,
    String(channel || '').toUpperCase(),
    transactionId,
    String(status || '').toUpperCase(),
    javaPlainAmount(amount),
    String(callbackTimestamp),
  ].join('|');
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
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

async function get(path, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: '*/*', ...extraHeaders },
      signal: controller.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body: buf };
  } finally {
    clearTimeout(timer);
  }
}


async function runAuthenticatedConversion(authToken, contactEmail, recipientPhone, productId) {
  const authHeaders = { Authorization: `Bearer ${authToken}` };
  const profileRes = await get('/api/users/profile', authHeaders);
  check('auth profile 200', profileRes.status === 200, profileRes.status);
  if (profileRes.status === 200) {
    const profile = JSON.parse(profileRes.body.toString('utf8'));
    check('auth profile has identity', Boolean(profile.id || profile.username || profile.email), JSON.stringify({
      id: profile.id,
      username: profile.username,
    }).slice(0, 120));
  }

  const cartAddRes = await post(`/api/cart/me/add?productId=${encodeURIComponent(String(productId))}&quantity=1`, {}, authHeaders);
  check('auth cart add 200', cartAddRes.status === 200, cartAddRes.status);
  const cartRes = await get('/api/cart/me', authHeaders);
  check('auth cart has items', cartRes.status === 200, cartRes.status);
  let cartItemIds = [];
  if (cartRes.status === 200) {
    const cartItems = JSON.parse(cartRes.body.toString('utf8'));
    const list = Array.isArray(cartItems) ? cartItems : (cartItems.items || []);
    cartItemIds = list.map((item) => item.id).filter(Boolean);
    check('auth cart item ids', cartItemIds.length >= 1, `count=${cartItemIds.length}`);
  }

  const authCheckoutRes = await post('/api/orders/checkout/me', {
    cartItemIds,
    shippingAddress: 'Calle Madero 10, Ciudad de Mexico, CDMX 06000, MX',
    recipientName: 'Auth Buyer',
    recipientPhone: recipientPhone || '5511223344',
    contactEmail: contactEmail || undefined,
    paymentMethod: 'MERCADO_PAGO',
  }, { ...authHeaders, 'Idempotency-Key': `auth-checkout-${Date.now()}` });
  check('auth checkout 200', authCheckoutRes.status === 200, authCheckoutRes.status);
  let authOrderId = null;
  let authOrderNo = '';
  let authOrderAmount = null;
  if (authCheckoutRes.status === 200) {
    const authOrder = JSON.parse(authCheckoutRes.body.toString('utf8'));
    authOrderId = authOrder.id;
    authOrderNo = authOrder.orderNo || '';
    authOrderAmount = authOrder.totalAmount;
    check('auth checkout PENDING_PAYMENT', authOrder.status === 'PENDING_PAYMENT', authOrder.status);
    check('auth checkout not guest', authOrder.guestOrder === false, String(authOrder.guestOrder));
  }

  if (!(authOrderId && authOrderNo)) return;

  const authPayRes = await post('/api/payments', {
    orderId: authOrderId,
    channel: 'MERCADO_PAGO',
  }, authHeaders);
  check('auth payment create 200', authPayRes.status === 200, authPayRes.status);
  let authPaymentId = null;
  if (authPayRes.status === 200) {
    const authPayment = JSON.parse(authPayRes.body.toString('utf8'));
    authPaymentId = authPayment.id;
    check('auth payment PENDING', authPayment.status === 'PENDING', authPayment.status);
    check('auth payment has paymentUrl', Boolean(authPayment.paymentUrl) && String(authPayment.paymentUrl).startsWith('http'), String(authPayment.paymentUrl || '').slice(0, 80));
  }

  if (!(paymentCallbackSecret && authPaymentId)) {
    check('auth paid-callback path skipped', true, paymentCallbackSecret ? 'missing payment id' : 'set PAYMENT_CALLBACK_SECRET to enable');
    return;
  }

  const callbackTimestamp = Math.floor(Date.now() / 1000);
  const transactionId = `TXN${callbackTimestamp}AUTH`;
  const amount = Number(authOrderAmount);
  const signature = signPaymentCallback({
    orderNo: authOrderNo,
    channel: 'MERCADO_PAGO',
    transactionId,
    status: 'PAID',
    amount,
    callbackTimestamp,
    secret: paymentCallbackSecret,
  });
  const callbackRes = await post('/api/payments/callback', {
    orderNo: authOrderNo,
    channel: 'MERCADO_PAGO',
    transactionId,
    status: 'PAID',
    amount,
    callbackTimestamp,
    signature,
  });
  check('auth payment callback received', callbackRes.status === 200, callbackRes.status);

  const ordersRes = await get('/api/orders/me', authHeaders);
  check('auth orders me 200', ordersRes.status === 200, ordersRes.status);
  if (ordersRes.status === 200) {
    const page = JSON.parse(ordersRes.body.toString('utf8'));
    const list = page.items || page.content || (Array.isArray(page) ? page : []);
    const matched = list.find((item) => item.id === authOrderId || item.orderNo === authOrderNo);
    check('auth order paid fulfillment', Boolean(matched) && matched.status !== 'PENDING_PAYMENT', matched ? matched.status : 'missing');
  }

  const latestRes = await get(`/api/payments/order/${authOrderId}/latest`, authHeaders);
  check('auth paid payment latest', latestRes.status === 200, latestRes.status);
  if (latestRes.status === 200) {
    const latest = JSON.parse(latestRes.body.toString('utf8'));
    check('auth paid payment status PAID', latest.status === 'PAID', latest.status);
  }
}

async function main() {
  const home = await get('/');
  check('ui home 200', home.status === 200, home.status);
  check('ui home html', home.body.includes('id="root"') || home.body.includes("id='root'"));

  const homeHead = await head('/');
  const sec = (name) => String(homeHead.headers.get(name) || home.headers.get(name) || '');
  const xcto = sec('x-content-type-options');
  const xfo = sec('x-frame-options');
  const rp = sec('referrer-policy');
  const csp = sec('content-security-policy');
  check('ui security headers', Boolean(xcto && xfo && rp), `xcto=${xcto};xfo=${xfo};rp=${rp}`);
  check('ui content-security-policy', /default-src/.test(csp) && /frame-ancestors/.test(csp), csp.slice(0, 120));
  check('ui html cache no-cache', /no-cache|no-store|max-age=0/i.test(sec('cache-control')), sec('cache-control'));

  const mainJsMatch = home.body.toString('utf8').match(/\/static\/js\/main\.[^"'\s]+\.js/);
  if (mainJsMatch) {
    const assetHead = await head(mainJsMatch[0]);
    const cache = String(assetHead.headers.get('cache-control') || '');
    check('static js long-cache immutable', /max-age=31536000/i.test(cache) && /immutable/i.test(cache), cache);
  } else {
    check('static js long-cache immutable', false, 'main js not found in home html');
  }

  for (const path of ['/products', '/cart', '/checkout', '/login', '/register', '/coupons', '/track-order', '/wishlist', '/history', '/forgot-password', '/compare', '/privacy', '/terms']) {
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
  if (checkoutRes.status === 429) {
    check('guest checkout rate-limit handled', true, 'skipped guest conversion while checkout is rate-limited');
  } else {
    check('guest checkout 200', checkoutRes.status === 200, checkoutRes.status);
  }
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
    let paymentId = null;
    let paymentAmount = null;
    if (payRes.status === 200) {
      const payment = JSON.parse(payRes.body.toString('utf8'));
      paymentId = payment.id;
      paymentAmount = payment.amount;
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

    if (paymentCallbackSecret && paymentId) {
      const syncRes = await post(`/api/payments/${paymentId}/sync`, { guestEmail, orderNo });
      check('payment sync 200', syncRes.status === 200, syncRes.status);

      const callbackTimestamp = Math.floor(Date.now() / 1000);
      const transactionId = `TXN${callbackTimestamp}SMOKE`;
      const amount = Number(paymentAmount);
      const signature = signPaymentCallback({
        orderNo,
        channel: 'MERCADO_PAGO',
        transactionId,
        status: 'PAID',
        amount,
        callbackTimestamp,
        secret: paymentCallbackSecret,
      });
      const callbackRes = await post('/api/payments/callback', {
        orderNo,
        channel: 'MERCADO_PAGO',
        transactionId,
        status: 'PAID',
        amount,
        callbackTimestamp,
        signature,
      });
      check('payment callback received', callbackRes.status === 200, callbackRes.status);
      if (callbackRes.status === 200) {
        const cb = JSON.parse(callbackRes.body.toString('utf8'));
        check('payment callback accepted', cb.received === true, JSON.stringify(cb).slice(0, 120));
      }

      const paidTrack = await post('/api/orders/track', { orderNo, email: guestEmail });
      check('paid order track 200', paidTrack.status === 200, paidTrack.status);
      if (paidTrack.status === 200) {
        const track = JSON.parse(paidTrack.body.toString('utf8'));
        const trackedOrder = track.order || track;
        check(
          'paid order leaves PENDING_PAYMENT',
          trackedOrder.status && trackedOrder.status !== 'PENDING_PAYMENT',
          trackedOrder.status,
        );
        check(
          'paid order fulfillment status',
          ['PENDING_SHIPMENT', 'PAID', 'SHIPPED', 'COMPLETED'].includes(String(trackedOrder.status || '')),
          trackedOrder.status,
        );
      }

      const latestPay = await post(`/api/payments/guest/order/${orderId}/latest`, { guestEmail, orderNo });
      check('paid payment latest 200', latestPay.status === 200, latestPay.status);
      if (latestPay.status === 200) {
        const latest = JSON.parse(latestPay.body.toString('utf8'));
        check('paid payment status PAID', latest.status === 'PAID', latest.status);
      }

      const paymentPage = await get(`/payment/${encodeURIComponent(orderNo)}?guestEmail=${encodeURIComponent(guestEmail)}`);
      check('payment instructions spa', paymentPage.status === 200 && (paymentPage.body.includes('id="root"') || paymentPage.body.includes("id='root'")), paymentPage.status);
    } else {
      check('payment paid-callback path skipped', true, 'set SHOPTEST_PAYMENT_CALLBACK_SECRET or PAYMENT_CALLBACK_SECRET to enable');
    }
  } else if (checkoutRes.status !== 429) {
    check('payment create skipped', false, 'missing order from guest checkout');
    check('guest order track skipped', false, 'missing order from guest checkout');
  }

  // Authenticated commercial conversion: register → login → cart → checkout → optional paid callback
  // Optional fixed credentials avoid register rate-limit during continuous commercial runs.
  const smokeAuthUser = String(process.env.SHOPTEST_SMOKE_AUTH_USER || '').trim();
  const smokeAuthPassword = String(process.env.SHOPTEST_SMOKE_AUTH_PASSWORD || '').trim();
  const authSuffix = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  let registeredUsername = smokeAuthUser || `sb${authSuffix}`.slice(0, 24);
  let registeredEmail = `smoke.buyer.${authSuffix}@example.com`;
  const authPassword = smokeAuthPassword || 'ShopMx!AuthSmoke99';
  const authPhone = `55${String(Date.now()).slice(-8)}`;

  if (smokeAuthUser && smokeAuthPassword) {
    const loginExisting = await post('/api/auth/login', {
      username: smokeAuthUser,
      password: smokeAuthPassword,
    });
    check('auth login existing credentials', loginExisting.status === 200, loginExisting.status);
    if (loginExisting.status === 200) {
      const session = JSON.parse(loginExisting.body.toString('utf8'));
      const token = session.token || session.accessToken || '';
      check('auth login token', Boolean(token), token ? 'present' : 'missing');
      if (token) {
        await runAuthenticatedConversion(token, registeredEmail, authPhone, productId);
      }
    }
  } else {
    const registerRes = await post('/api/auth/register', {
      username: registeredUsername,
      email: registeredEmail,
      password: authPassword,
      phone: authPhone,
    });
    if (registerRes.status === 429) {
      check('auth register rate-limit handled', true, 'skipped auth conversion while register is rate-limited');
    } else {
      check('auth register 200', registerRes.status === 200, registerRes.status);
      if (registerRes.status === 200) {
        const reg = JSON.parse(registerRes.body.toString('utf8'));
        registeredUsername = reg.username || registeredUsername;
        check('auth register username', Boolean(registeredUsername), registeredUsername);
        const loginRes = await post('/api/auth/login', {
          username: registeredUsername,
          password: authPassword,
        });
        check('auth login 200', loginRes.status === 200, loginRes.status);
        if (loginRes.status === 200) {
          const session = JSON.parse(loginRes.body.toString('utf8'));
          const token = session.token || session.accessToken || '';
          check('auth login token', Boolean(token), token ? 'present' : 'missing');
          if (token) {
            await runAuthenticatedConversion(token, registeredEmail, authPhone, productId);
          } else {
            check('auth conversion path skipped', false, 'login token missing');
          }
        }
      }
    }
  }

  const robots = await get('/robots.txt');
  const robotsBody = robots.body.toString('utf8');
  check('robots.txt', robots.status === 200 && /user-agent/i.test(robotsBody), robots.status);
  check('robots.txt allows privacy', robots.status === 200 && /Allow:\s*\/privacy/i.test(robotsBody), robotsBody.slice(0, 120));
  check('robots.txt allows terms', robots.status === 200 && /Allow:\s*\/terms/i.test(robotsBody), robotsBody.slice(0, 120));
  const sitemap = await get('/sitemap.xml');
  const sitemapBody = sitemap.body.toString('utf8');
  check('sitemap.xml', sitemap.status === 200 && sitemapBody.includes('<urlset'), sitemap.status);
  check('sitemap.xml includes privacy', sitemap.status === 200 && sitemapBody.includes('/privacy'), sitemapBody.slice(0, 120));
  check('sitemap.xml includes terms', sitemap.status === 200 && sitemapBody.includes('/terms'), sitemapBody.slice(0, 120));

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
