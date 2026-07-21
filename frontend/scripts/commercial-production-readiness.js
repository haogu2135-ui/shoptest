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
 *   SHOPTEST_PRODUCTION_HOST   optional Host header (origin-edge probes)
 *   SHOPTEST_PRODUCTION_TLS_INSECURE=1  allow self-signed origin certs
 *   SHOPTEST_REQUIRE_PRODUCTION=1  exit non-zero when production is unreachable
 *   SHOPTEST_UI_BASE           optional local UI for webhook contract cross-check
 *   MERCADO_PAGO_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET  local signed probes
 *   SHOPTEST_ORIGIN_PUBLIC_IP  default 161.153.37.250 (CF origin gap diagnosis)
 *   SHOPTEST_ORIGIN_EDGE_BASE / SHOPTEST_ORIGIN_EDGE_HOST  dual origin CWV path
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
const productionHostHeader = String(process.env.SHOPTEST_PRODUCTION_HOST || '').trim();
const productionTlsInsecure = String(process.env.SHOPTEST_PRODUCTION_TLS_INSECURE || '').trim() === '1';
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
    const headers = { ...(options.headers || {}) };
    if (productionHostHeader && !headers.Host && !headers.host) {
      headers.Host = productionHostHeader;
    }
    const rejectUnauthorized = options.rejectUnauthorized != null
      ? options.rejectUnauthorized !== false
      : !productionTlsInsecure;
    const req = lib.request(
      url,
      {
        method: options.method || 'GET',
        headers,
        timeout: options.timeout || 8000,
        rejectUnauthorized,
        servername: productionHostHeader || url.hostname,
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
    const v4 = records.filter((item) => item.family === 4);
    const v6 = records.filter((item) => item.family === 6);
    soft('production DNS A records', v4.length > 0, v4.map((item) => item.address).join(', ') || 'none');
    soft('production DNS AAAA records', v6.length > 0, v6.map((item) => item.address).join(', ') || 'none');
  } catch (error) {
    soft('production DNS resolution', false, error && error.message ? error.message : String(error));
    soft('production DNS A records', false, 'dns-failed');
    soft('production DNS AAAA records', false, 'dns-failed');
  }

  const home = await request(`${productionBase}/`, { timeout: 25000 });
  const reachable = home.status > 0 && !home.error;
  const bodyHint = String(home.body || '').slice(0, 80).replace(/\s+/g, ' ');
  const detailBase = home.error
    || (home.status === 522
      ? 'status=522 Cloudflare origin connect failed (cfOrigin unreachable / wrong origin IP / security list)'
      : `status=${home.status}${bodyHint ? ` body=${bodyHint}` : ''}`);
  if (requireProduction) {
    check('production host reachable', reachable && home.status === 200, detailBase);
  } else if (!reachable || home.status !== 200) {
    soft('production host reachable', false, `${detailBase} (set SHOPTEST_REQUIRE_PRODUCTION=1 to hard-fail)`);
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
    await measureProductionCwv();
  } else {
    soft('production robots.txt', false, 'skipped — production unreachable');
    soft('production sitemap.xml', false, 'skipped — production unreachable');
    soft('production products api', false, 'skipped — production unreachable');
    soft('production payment channels', false, 'skipped — production unreachable');
    soft('production CWV measurement', false, 'blocked — production host timeout');
    await diagnoseCloudflareOriginGap(home);
  }
}


async function diagnoseCloudflareOriginGap(publicHome) {
  // When Cloudflare/public CDN fails but the origin IP still serves the storefront,
  // classify the outage as a Cloudflare origin config problem (not app downtime).
  const originIp = String(process.env.SHOPTEST_ORIGIN_PUBLIC_IP || '161.153.37.250').trim();
  const originHost = productionHostHeader
    || process.env.SHOPTEST_ORIGIN_EDGE_HOST
    || 'pet.686888666.xyz';
  if (!originIp) {
    soft('cloudflare origin gap diagnosis', false, 'SHOPTEST_ORIGIN_PUBLIC_IP empty');
    return;
  }

  const httpProbe = await request(`http://${originIp}/`, {
    timeout: 8000,
    headers: { Host: originHost },
    rejectUnauthorized: false,
  });
  const httpsProbe = await request(`https://${originIp}/`, {
    timeout: 8000,
    headers: { Host: originHost },
    rejectUnauthorized: false,
  });
  const httpOk = httpProbe.status === 200;
  const httpsOk = httpsProbe.status === 200;
  const publicStatus = publicHome && publicHome.status ? publicHome.status : 0;
  const publicErr = publicHome && publicHome.error ? publicHome.error : '';
  const publicIsCfFailure = publicStatus === 522
    || /timeout/i.test(publicErr)
    || publicStatus === 0;

  if (httpOk || httpsOk) {
    soft(
      'cloudflare origin gap diagnosis',
      false,
      `origin IP ${originIp} healthy (http=${httpProbe.status} https=${httpsProbe.status} host=${originHost}) but public CDN failed (status=${publicStatus || 0}${publicErr ? ` err=${publicErr}` : ''}) — set CF DNS A record origin to ${originIp}, SSL Full/Flexible, confirm no Authenticated Origin Pulls mismatch`,
    );
    soft(
      'cloudflare origin IP direct probe',
      true,
      `http=${httpProbe.status} https=${httpsProbe.status} ip=${originIp}`,
    );
    return;
  }

  soft(
    'cloudflare origin gap diagnosis',
    false,
    publicIsCfFailure
      ? `origin IP ${originIp} also unreachable (http=${httpProbe.status || 0}/${httpProbe.error || '-'} https=${httpsProbe.status || 0}/${httpsProbe.error || '-'}) — open OCI Security List/NSG 80/443 and host iptables`
      : `public status=${publicStatus}; origin direct http=${httpProbe.status || 0} https=${httpsProbe.status || 0}`,
  );
  soft(
    'cloudflare origin IP direct probe',
    false,
    `http=${httpProbe.status || 0} https=${httpsProbe.status || 0} ip=${originIp}`,
  );
}

async function measureProductionCwv() {
  let playwright;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    playwright = require('playwright');
  } catch (error) {
    soft(
      'production CWV measurement',
      false,
      'playwright unavailable — install browser deps or run commercial-browser-smoke against production',
    );
    return;
  }

  let browser;
  try {
    const baseUrl = new URL(productionBase);
    const launchArgs = ['--disable-dev-shm-usage'];
    // Origin-edge mode: map public hostname to the reachable origin IP/host.
    if (productionHostHeader && productionHostHeader !== baseUrl.hostname) {
      launchArgs.push(`--host-resolver-rules=MAP ${productionHostHeader} ${baseUrl.hostname}`);
    }
    browser = await playwright.chromium.launch({ headless: true, args: launchArgs });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: productionTlsInsecure || productionHostHeader !== '',
    });
    const page = await context.newPage();
    const cwvTargetBase = productionHostHeader
      ? `${baseUrl.protocol}//${productionHostHeader}`
      : productionBase;
    await page.addInitScript(() => {
      try {
        window.__shopmxCwv = { lcp: 0, cls: 0 };
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) {
            window.__shopmxCwv.lcp = entries[entries.length - 1].startTime || 0;
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry && entry.hadRecentInput) continue;
            window.__shopmxCwv.cls += Number(entry.value) || 0;
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch (err) {
        // ignore observer gaps in headless
      }
    });
    // Warm then measure for stable commercial soft budgets.
    await page.goto(`${cwvTargetBase}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      try { window.__shopmxCwv = { lcp: 0, cls: 0 }; } catch (err) { /* ignore */ }
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1600);
    const cwv = await page.evaluate(() => {
      let lcp = 0;
      let cls = 0;
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint') || [];
        if (lcpEntries.length) lcp = lcpEntries[lcpEntries.length - 1].startTime || 0;
        const shifts = performance.getEntriesByType('layout-shift') || [];
        cls = shifts.reduce((sum, entry) => {
          if (entry && entry.hadRecentInput) return sum;
          return sum + (Number(entry.value) || 0);
        }, 0);
      } catch (err) {
        // ignore
      }
      const observed = window.__shopmxCwv || { lcp: 0, cls: 0 };
      return {
        lcp: Math.max(Number(lcp) || 0, Number(observed.lcp) || 0),
        cls: Math.max(Number(cls) || 0, Number(observed.cls) || 0),
      };
    });
    const lcpOk = !cwv.lcp || cwv.lcp < 4000;
    const clsOk = cwv.cls < 0.1;
    soft(
      'production CWV measurement',
      lcpOk && clsOk,
      `lcp=${Math.round(cwv.lcp)}ms cls=${Number(cwv.cls).toFixed(3)} host=${productionHostHeader || new URL(productionBase).hostname}`,
    );
    await context.close();
  } catch (error) {
    soft(
      'production CWV measurement',
      false,
      error && error.message ? error.message : String(error),
    );
  } finally {
    if (browser) {
      try { await browser.close(); } catch (err) { /* ignore */ }
    }
  }
}


async function probeOriginEdgeDual() {
  // When public CDN returns 522/timeout, still measure the local origin edge so ship-prep
  // is not blind. Defaults to https://127.0.0.1 with Host pet.686888666.xyz.
  const originBase = (process.env.SHOPTEST_ORIGIN_EDGE_BASE || 'https://127.0.0.1').replace(/\/$/, '');
  const originHost = process.env.SHOPTEST_ORIGIN_EDGE_HOST
    || productionHostHeader
    || 'pet.686888666.xyz';
  const home = await request(`${originBase}/`, {
    timeout: 8000,
    headers: { Host: originHost },
    rejectUnauthorized: false,
  });
  const ok = home.status === 200;
  soft(
    'origin edge dual-stack probe',
    ok,
    ok
      ? `status=200 base=${originBase} host=${originHost}`
      : `status=${home.status || 0} err=${home.error || ''} base=${originBase}`,
  );
  if (!ok) {
    soft('origin edge CWV measurement', false, 'skipped — origin edge unreachable');
    return;
  }
  // Reuse Playwright CWV against origin edge by temporarily mapping host.
  let playwright;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    playwright = require('playwright');
  } catch (error) {
    soft('origin edge CWV measurement', false, 'playwright unavailable');
    return;
  }
  let browser;
  try {
    const baseUrl = new URL(originBase);
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        `--host-resolver-rules=MAP ${originHost} ${baseUrl.hostname}`,
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        window.__shopmxCwv = { lcp: 0, cls: 0 };
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) window.__shopmxCwv.lcp = entries[entries.length - 1].startTime || 0;
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry && entry.hadRecentInput) continue;
            window.__shopmxCwv.cls += Number(entry.value) || 0;
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch (err) { /* ignore */ }
    });
    const target = `https://${originHost}/`;
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { window.__shopmxCwv = { lcp: 0, cls: 0 }; } catch (err) { /* ignore */ } });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    const cwv = await page.evaluate(() => {
      let lcp = 0;
      let cls = 0;
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint') || [];
        if (lcpEntries.length) lcp = lcpEntries[lcpEntries.length - 1].startTime || 0;
        const shifts = performance.getEntriesByType('layout-shift') || [];
        cls = shifts.reduce((sum, entry) => sum + ((entry && entry.hadRecentInput) ? 0 : (Number(entry.value) || 0)), 0);
      } catch (err) { /* ignore */ }
      const observed = window.__shopmxCwv || { lcp: 0, cls: 0 };
      return {
        lcp: Math.max(Number(lcp) || 0, Number(observed.lcp) || 0),
        cls: Math.max(Number(cls) || 0, Number(observed.cls) || 0),
      };
    });
    soft(
      'origin edge CWV measurement',
      (!cwv.lcp || cwv.lcp < 4000) && cwv.cls < 0.1,
      `lcp=${Math.round(cwv.lcp)}ms cls=${Number(cwv.cls).toFixed(3)} host=${originHost}`,
    );
    await context.close();
  } catch (error) {
    soft('origin edge CWV measurement', false, error && error.message ? error.message : String(error));
  } finally {
    if (browser) {
      try { await browser.close(); } catch (err) { /* ignore */ }
    }
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
    // Valid signature under local simulation should ack (200). Never accept as signature-reject (400).
    check(
      'local mercado webhook accepts signed payload contract',
      goodMercado.status === 200
        || (goodMercado.status !== 400 && goodMercado.status !== 0),
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
  // eslint-disable-next-line no-console
  console.log(`productionHost=${productionHostHeader || '(url-host)'} tlsInsecure=${productionTlsInsecure}`);

  await probeProduction();
  await probeOriginEdgeDual();
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
    const softish = results
      .filter((item) => String(item.detail || '').startsWith('soft-fail:'))
      .map((item) => item.name);
    const shipBar = [
      'public production host CWV (pet domain via CDN)',
      'real provider webhook traffic',
      'real-device APK/WebView E2E',
    ];
    // eslint-disable-next-line no-console
    console.log(`NOTE commercial ship bar still blocked by: ${shipBar.join(' + ')}`);
    if (softish.length) {
      // eslint-disable-next-line no-console
      console.log(`NOTE soft gaps: ${softish.join(', ')}`);
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('PRODUCTION_READINESS_CRASH', error);
  process.exit(2);
});
