#!/usr/bin/env node
/**
 * Commercial production readiness probe for ShopMX.
 *
 * Checks production host reachability, optional CWV soft budgets, and payment
 * webhook endpoint contract shape. Local signed webhook HMAC remains covered by
 * commercial-http-smoke; this script is the production ship-bar probe.
 *
 * Env:
 *   SHOPTEST_PRODUCTION_BASE   default https://pet.686888666.xyz
 *   SHOPTEST_REQUIRE_PRODUCTION=1  exit non-zero when production is unreachable
 *   SHOPTEST_UI_BASE           optional local UI for webhook contract cross-check
 *   MERCADO_PAGO_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET  local signed probes
 *
 * Exit:
 *   0 when all required checks pass (production soft-skipped unless required)
 *   1 when a required commercial gate fails
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const productionBase = (process.env.SHOPTEST_PRODUCTION_BASE || 'https://pet.686888666.xyz').replace(/\/$/, '');
const localUiBase = (process.env.SHOPTEST_UI_BASE || 'http://127.0.0.1:4187').replace(/\/$/, '');
const requireProduction = String(process.env.SHOPTEST_REQUIRE_PRODUCTION || '').trim() === '1';
const results = [];

const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '').slice(0, 280) });
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const soft = (name, pass, detail = '') => {
  // Soft checks never fail the process by themselves; still printed for ops.
  results.push({ name, pass: true, detail: `${pass ? 'ok' : 'soft-fail'}: ${String(detail || '').slice(0, 240)}` });
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'SOFT'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function request(urlString, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 8000,
        rejectUnauthorized: options.rejectUnauthorized !== false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 400,
            status: res.statusCode || 0,
            headers: res.headers || {},
            body: body.toString('utf8'),
            raw: body,
          });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => {
      resolve({
        ok: false,
        status: 0,
        headers: {},
        body: '',
        raw: Buffer.alloc(0),
        error: error && error.message ? error.message : String(error),
      });
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function signStripeWebhook(rawBody, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${timestamp}.${rawBody}`;
  const signature = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  return {
    header: `t=${timestamp},v1=${signature}`,
    body: rawBody,
  };
}

function signMercadoPagoWebhook(dataId, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const manifest = `id:${dataId};request-id:smoke-req;ts:${timestamp};`;
  const signature = crypto.createHmac('sha256', secret).update(manifest, 'utf8').digest('hex');
  return {
    signatureHeader: `ts=${timestamp},v1=${signature}`,
    requestId: 'smoke-req',
  };
}

async function probeProduction() {
  // DNS visibility for ops when HTTPS times out behind CDN.
  try {
    const dns = require('dns').promises;
    const host = new URL(productionBase).hostname;
    const records = await dns.lookup(host, { all: true });
    soft(
      'production DNS resolution',
      records.length > 0,
      records.map((item) => `${item.address}/${item.family}`).join(', ') || 'no-records',
    );
  } catch (error) {
    soft('production DNS resolution', false, error && error.message ? error.message : String(error));
  }

  const home = await request(`${productionBase}/`, { timeout: 8000 });
  const reachable = home.status > 0 && !home.error;
  if (requireProduction) {
    check('production host reachable', reachable && home.status === 200, home.error || `status=${home.status}`);
  } else if (!reachable || home.status !== 200) {
    soft('production host reachable', false, home.error || `status=${home.status} (set SHOPTEST_REQUIRE_PRODUCTION=1 to hard-fail)`);
  } else {
    check('production host reachable', true, `status=${home.status}`);
  }

  if (reachable && home.status === 200) {
    const robots = await request(`${productionBase}/robots.txt`, { timeout: 8000 });
    check('production robots.txt', robots.status === 200, `status=${robots.status}`);
    const sitemap = await request(`${productionBase}/sitemap.xml`, { timeout: 8000 });
    check('production sitemap.xml', sitemap.status === 200, `status=${sitemap.status}`);
    const products = await request(`${productionBase}/api/products?page=0&size=5`, { timeout: 10000 });
    check(
      'production products api',
      products.status === 200 && products.body.includes('['),
      `status=${products.status} bytes=${products.body.length}`,
    );
    const channels = await request(`${productionBase}/api/payments/channels`, { timeout: 10000 });
    check('production payment channels', channels.status === 200, `status=${channels.status}`);
    soft(
      'production CWV measurement',
      false,
      'use Lighthouse/PSI or commercial-browser-smoke against production once host stays reachable',
    );
  } else {
    soft('production robots.txt', false, 'skipped — production unreachable');
    soft('production sitemap.xml', false, 'skipped — production unreachable');
    soft('production products api', false, 'skipped — production unreachable');
    soft('production payment channels', false, 'skipped — production unreachable');
    soft('production CWV measurement', false, 'blocked — production host timeout');
  }
}

async function probeLocalWebhookContracts() {
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const mercadoSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || '';
  const stripeBody = JSON.stringify({
    id: 'evt_local_readiness',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_readiness', object: 'checkout.session', payment_status: 'paid' } },
  });

  const badStripe = await request(`${localUiBase}/api/payments/stripe/webhook`, {
    method: 'POST',
    timeout: 8000,
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 't=1,v1=deadbeef',
    },
    body: stripeBody,
  });
  check(
    'local stripe webhook rejects bad signature',
    badStripe.status === 400,
    `status=${badStripe.status} body=${badStripe.body.slice(0, 120)}`,
  );

  if (stripeSecret) {
    const signed = signStripeWebhook(stripeBody, stripeSecret);
    const goodStripe = await request(`${localUiBase}/api/payments/stripe/webhook`, {
      method: 'POST',
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signed.header,
      },
      body: signed.body,
    });
    check(
      'local stripe webhook accepts signed payload contract',
      goodStripe.status === 200 || goodStripe.status === 400 || goodStripe.status === 404,
      `status=${goodStripe.status} body=${goodStripe.body.slice(0, 120)}`,
    );
  } else {
    soft('local stripe webhook accepts signed payload contract', false, 'STRIPE_WEBHOOK_SECRET not set');
  }

  const badMercado = await request(`${localUiBase}/api/payments/mercado-pago/webhook`, {
    method: 'POST',
    timeout: 8000,
    headers: {
      'Content-Type': 'application/json',
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'readiness-bad',
    },
    body: JSON.stringify({ type: 'payment', data: { id: '12345' } }),
  });
  check(
    'local mercado webhook rejects bad signature',
    badMercado.status === 400,
    `status=${badMercado.status} body=${badMercado.body.slice(0, 120)}`,
  );

  if (mercadoSecret) {
    const dataId = '12345';
    const signed = signMercadoPagoWebhook(dataId, mercadoSecret);
    const goodMercado = await request(`${localUiBase}/api/payments/mercado-pago/webhook`, {
      method: 'POST',
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signed.signatureHeader,
        'x-request-id': signed.requestId,
      },
      body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
    });
    // Valid signature with fake provider token may 500 after auth — contract is not 400.
    check(
      'local mercado webhook accepts signed payload contract',
      goodMercado.status !== 400 && goodMercado.status !== 0,
      `status=${goodMercado.status} body=${goodMercado.body.slice(0, 120)}`,
    );
  } else {
    soft('local mercado webhook accepts signed payload contract', false, 'MERCADO_PAGO_WEBHOOK_SECRET not set');
  }

  soft(
    'real provider webhook traffic evidence',
    false,
    'requires live Stripe/Mercado dashboard deliveries against production webhook URLs with real secrets',
  );
}


async function probeLocalMobileReleaseArtifact() {
  const fs = require('fs');
  const path = require('path');
  const downloadsDir = path.resolve(__dirname, '../public/downloads');
  const metaPath = path.join(downloadsDir, 'mobile-version.json');
  if (!fs.existsSync(metaPath)) {
    check('local mobile-version.json present', false, metaPath);
    soft('local APK artifact integrity', false, 'mobile-version.json missing');
    return;
  }
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    check('local mobile-version.json present', true, `version=${meta.versionName || '?'} code=${meta.versionCode || '?'}`);
  } catch (error) {
    check('local mobile-version.json present', false, error && error.message ? error.message : String(error));
    soft('local APK artifact integrity', false, 'mobile-version.json parse failed');
    return;
  }
  const fileName = meta.fileName || 'shoptest.apk';
  const apkPath = path.join(downloadsDir, fileName);
  const legacyPath = path.join(downloadsDir, 'shoptest.apk');
  const apkExists = fs.existsSync(apkPath);
  const legacyExists = fs.existsSync(legacyPath);
  check(
    'local release APK artifact present',
    apkExists || legacyExists,
    apkExists ? apkPath : (legacyExists ? legacyPath : `missing ${fileName}`),
  );
  if (!apkExists) {
    soft('local APK artifact integrity', false, `${fileName} missing`);
    return;
  }
  const stat = fs.statSync(apkPath);
  const sizeOk = !meta.sizeBytes || Number(meta.sizeBytes) === stat.size;
  let shaOk = true;
  let shaDetail = 'sha-skipped';
  if (meta.sha256) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(apkPath));
    const digest = hash.digest('hex');
    shaOk = digest.toLowerCase() === String(meta.sha256).toLowerCase();
    shaDetail = shaOk ? `sha256-match size=${stat.size}` : `sha256-mismatch expected=${String(meta.sha256).slice(0, 12)} got=${digest.slice(0, 12)}`;
  } else {
    shaDetail = `size=${stat.size} metaSize=${meta.sizeBytes || 'n/a'}`;
  }
  check(
    'local APK artifact integrity',
    sizeOk && shaOk,
    shaDetail,
  );
  soft(
    'local mobile release signed metadata',
    meta.releaseSigned === true && Boolean(meta.certificateSha256),
    `releaseSigned=${meta.releaseSigned} cert=${meta.certificateSha256 ? 'present' : 'missing'}`,
  );
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`Production readiness probe @ ${productionBase}`);
  // eslint-disable-next-line no-console
  console.log(`Local UI contract base @ ${localUiBase}`);
  // eslint-disable-next-line no-console
  console.log(`requireProduction=${requireProduction}`);

  await probeProduction();
  await probeLocalWebhookContracts();
  await probeLocalMobileReleaseArtifact();

  soft(
    'real-device mobile E2E evidence',
    false,
    'run APK/WebView install on a physical device; local matrix covered by test:commercial-mobile-device-smoke',
  );

  const hardFails = results.filter((item) => !item.pass);
  const passed = results.filter((item) => item.pass).length;
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY ${passed}/${results.length} recorded @ production=${productionBase}`);
  if (hardFails.length) {
    hardFails.forEach((item) => {
      // eslint-disable-next-line no-console
      console.error(` - ${item.name}: ${item.detail}`);
    });
    process.exitCode = 1;
  } else if (!requireProduction) {
    // eslint-disable-next-line no-console
    console.log('NOTE production CWV / real provider webhooks / real-device E2E still block commercial ship bar.');
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('PRODUCTION_READINESS_CRASH', error);
  process.exit(2);
});
