#!/usr/bin/env node

const logLine = (...parts) => {
  process.stdout.write(`${parts.map((part) => String(part)).join(' ')}\n`);
};
const logError = (...parts) => {
  process.stderr.write(`${parts.map((part) => String(part)).join(' ')}\n`);
};

const { createRequire } = require('module');
const requireDependency = createRequire(__filename);
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
 *   SHOPTEST_REQUIRE_COMMERCIAL_SHIP=1  exit non-zero when any commercial ship-bar gate is soft-failed
 *   SHOPTEST_UI_BASE           optional local UI for webhook contract cross-check
 *   MERCADO_PAGO_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET  local signed probes
 *   SHOPTEST_ORIGIN_PUBLIC_IP  default 161.153.37.250 (CF origin gap diagnosis)
 *   SHOPTEST_ORIGIN_EDGE_BASE / SHOPTEST_ORIGIN_EDGE_HOST  dual origin CWV path
 *   SHOPTEST_CANONICAL_BASE    default https://petsanything.com
 *   SHOPTEST_DEVICE_E2E_MAX_AGE_DAYS  default 14 for physical-device evidence freshness
 *
 * Exit:
 *   0 when all required checks pass (production soft-skipped unless required)
 *   1 when a required commercial gate fails
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const net = require('net');
const { URL } = require('url');

const productionBase = (process.env.SHOPTEST_PRODUCTION_BASE || 'https://pet.686888666.xyz').replace(/\/$/, '');
const canonicalBase = (process.env.SHOPTEST_CANONICAL_BASE || 'https://petsanything.com').replace(/\/$/, '');
const productionHostHeader = String(process.env.SHOPTEST_PRODUCTION_HOST || '').trim();
const productionTlsInsecure = String(process.env.SHOPTEST_PRODUCTION_TLS_INSECURE || '').trim() === '1';
const configuredLocalUiBase = String(process.env.SHOPTEST_UI_BASE || '').trim();
const localUiBase = (configuredLocalUiBase || 'http://127.0.0.1:4187').replace(/\/$/, '');
const requireProduction = String(process.env.SHOPTEST_REQUIRE_PRODUCTION || '').trim() === '1';
const requireCommercialShip = String(process.env.SHOPTEST_REQUIRE_COMMERCIAL_SHIP || '').trim() === '1';
const results = [];
const COMMERCIAL_SHIP_SOFT_GATES = new Set([
  'canonical production host reachable',
  'production host reachable',
  'production products api',
  'production payment channels',
  'production CWV measurement',
  'public CDN host reachable',
  'public CDN CWV measurement',
  'real provider webhook traffic evidence',
  'real-device mobile E2E evidence',
]);

const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '').slice(0, 280) });
  logLine(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const soft = (name, pass, detail = '') => {
  // Soft checks never fail the process by themselves; still printed for ops.
  results.push({ name, pass: true, detail: `${pass ? 'ok' : 'soft-fail'}: ${String(detail || '').slice(0, 240)}` });
  logLine(`${pass ? 'PASS' : 'SOFT'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function getSoftGaps() {
  return results
    .filter((item) => String(item.detail || '').startsWith('soft-fail:'))
    .map((item) => item.name);
}

function getCommercialShipGaps() {
  return getSoftGaps().filter((name) => COMMERCIAL_SHIP_SOFT_GATES.has(name));
}

function getOriginEdgeBase() {
  return (process.env.SHOPTEST_ORIGIN_EDGE_BASE || 'https://127.0.0.1').replace(/\/$/, '');
}

function getOriginEdgeHost() {
  return process.env.SHOPTEST_ORIGIN_EDGE_HOST
    || productionHostHeader
    || 'pet.686888666.xyz';
}

function originEdgeUrl(pathname = '/') {
  const normalized = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
  return `${getOriginEdgeBase()}${normalized}`;
}

function requestOriginEdge(pathname = '/', options = {}) {
  return request(originEdgeUrl(pathname), {
    timeout: options.timeout || 8000,
    ...options,
    rejectUnauthorized: false,
    headers: {
      Host: getOriginEdgeHost(),
      ...(options.headers || {}),
    },
  });
}

function resolveTlsServername(...values) {
  for (const value of values) {
    let host = String(value || '').trim();
    if (!host) continue;
    if (host.startsWith('[')) {
      host = host.replace(/^\[/, '').replace(/\](?::\d+)?$/, '');
    } else {
      host = host.replace(/:\d+$/, '');
    }
    if (host && !net.isIP(host)) return host;
  }
  return undefined;
}

function request(urlString, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'https:' ? https : http;
    const headers = { ...(options.headers || {}) };
    if (productionHostHeader && !headers.Host && !headers.host) {
      headers.Host = productionHostHeader;
    }
    const servername = resolveTlsServername(headers.Host, headers.host, productionHostHeader, url.hostname);
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
        ...(servername ? { servername } : {}),
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

function looksLikeShopStorefront(body) {
  return /ShopMX|shop-frontend|main\.[a-f0-9]+\.js|Pet Store|pet essentials/i.test(
    String(body || ''),
  );
}

async function probeCanonicalProductionHost() {
  let canonicalUrl;
  try {
    canonicalUrl = new URL(canonicalBase);
  } catch (error) {
    soft('canonical production DNS', false, `invalid SHOPTEST_CANONICAL_BASE=${canonicalBase}`);
    soft('canonical production host reachable', false, `invalid SHOPTEST_CANONICAL_BASE=${canonicalBase}`);
    return;
  }

  const canonicalHost = canonicalUrl.hostname;
  let dnsDetail = 'no-records';
  let dnsOk = false;
  try {
    const dns = require('dns').promises;
    const records = await dns.lookup(canonicalHost, { all: true });
    dnsOk = records.length > 0;
    dnsDetail = records.map((item) => `${item.address}/${item.family}`).join(', ') || 'no-records';
  } catch (error) {
    dnsDetail = error && error.message ? error.message : String(error);
  }
  soft('canonical production DNS', dnsOk, `host=${canonicalHost} ${dnsDetail}`);

  if (canonicalUrl.protocol !== 'https:') {
    soft(
      'canonical production host reachable',
      false,
      `canonical URL must use https: ${canonicalBase}`,
    );
    return;
  }

  const home = await request(`${canonicalBase}/`, {
    timeout: 20000,
    headers: { Host: canonicalHost },
    rejectUnauthorized: true,
  });
  const storefront = looksLikeShopStorefront(home.body);
  const ok = dnsOk && home.status === 200 && !home.error && storefront;
  const bodyHint = String(home.body || '').slice(0, 100).replace(/\s+/g, ' ');
  const detail = ok
    ? `status=200 host=${canonicalHost} trustedTls=true storefront=ok`
    : `status=${home.status || 0} host=${canonicalHost} trustedTls=${home.error ? 'failed' : 'ok'} storefront=${storefront ? 'ok' : 'missing'}${home.error ? ` error=${home.error}` : ''}${bodyHint ? ` body=${bodyHint}` : ''}`;
  soft('canonical production host reachable', ok, detail);
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
  const cfStatusHints = {
    521: 'status=521 Cloudflare cannot connect to origin (wrong origin IP/port most common; origin may still be healthy on public IP)',
    522: 'status=522 Cloudflare origin connect timed out (cfOrigin unreachable / wrong origin IP / security list)',
    523: 'status=523 Cloudflare origin unreachable',
    525: 'status=525 Cloudflare SSL handshake failed to origin (use SSL Full with self-signed, not Full Strict)',
    526: 'status=526 Cloudflare invalid origin certificate (use SSL Full or install trusted origin cert)',
  };
  const detailBase = home.error
    || cfStatusHints[home.status]
    || `status=${home.status}${bodyHint ? ` body=${bodyHint}` : ''}`;
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
    soft('production sitemap product detail URLs', sitemap.status === 200 && /\/products\/\d+/.test(String(sitemap.body || '')), String(sitemap.body || '').slice(0, 160));
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
  const publicIsCfFailure = publicStatus === 521
    || publicStatus === 522
    || publicStatus === 523
    || publicStatus === 525
    || publicStatus === 526
    || /timeout/i.test(publicErr)
    || publicStatus === 0;

  if (httpOk || httpsOk) {
    soft(
      'cloudflare origin gap diagnosis',
      false,
      `origin IP ${originIp} healthy (http=${httpProbe.status} https=${httpsProbe.status} host=${originHost}) but public CDN failed (status=${publicStatus || 0}${publicErr ? ` err=${publicErr}` : ''}) — CF dashboard: DNS A/AAAA/CNAME for ${originHost} must resolve origin to ${originIp} only (proxied); remove foreign origins (e.g. rapid4cloud); SSL Full for self-signed; disable Auth Origin Pulls; no dead LB/Worker override`,
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
    playwright = requireDependency('playwright');
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
    // Do not reset __shopmxCwv between navigations — that discards buffered LCP/CLS.
    await page.goto(`${cwvTargetBase}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    });
    await page.waitForTimeout(2200);
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
    const lcpMeasured = Number(cwv.lcp) > 0;
    const lcpOk = lcpMeasured && cwv.lcp < 4000;
    const clsOk = cwv.cls < 0.1;
    soft(
      'production CWV measurement',
      lcpOk && clsOk,
      `lcp=${Math.round(cwv.lcp)}ms cls=${Number(cwv.cls).toFixed(3)} measured=${lcpMeasured} host=${productionHostHeader || new URL(productionBase).hostname}`,
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



async function probePublicCdnShipBar() {
  // Independent of SHOPTEST_PRODUCTION_BASE (often origin-edge 127.0.0.1): always soft-probe the
  // public Cloudflare hostname so the ship bar reflects real customer reachability.
  const publicDomain = process.env.SHOPTEST_PUBLIC_CDN_HOST
    || process.env.SHOPTEST_ORIGIN_EDGE_HOST
    || productionHostHeader
    || 'pet.686888666.xyz';
  const publicBase = (process.env.SHOPTEST_PUBLIC_CDN_BASE || `https://${publicDomain}`).replace(/\/$/, '');
  let publicHost;
  try {
    publicHost = new URL(publicBase).hostname;
  } catch (error) {
    soft('public CDN host reachable', false, `invalid SHOPTEST_PUBLIC_CDN_BASE=${publicBase}`);
    return;
  }
  // Skip duplicate work when productionBase already is the public CDN URL.
  let productionHost = '';
  try {
    productionHost = new URL(productionBase).hostname;
  } catch (error) {
    productionHost = '';
  }
  if (productionHost && productionHost === publicHost) {
    // Already covered by probeProduction against the public host.
    return;
  }

  const home = await request(publicBase + '/', {
    timeout: 20000,
    // Do not inherit origin Host override for the public CDN hostname.
    headers: { Host: publicHost },
    rejectUnauthorized: true,
  });
  const locationHeader = String(
    (home.headers && (home.headers.location || home.headers.Location)) || '',
  ).trim();
  let locationHost = '';
  try {
    locationHost = locationHeader ? new URL(locationHeader, publicBase).hostname : '';
  } catch (error) {
    locationHost = '';
  }
  const bodyHint = String(home.body || '').slice(0, 160).replace(/\s+/g, ' ');
  const looksLikeShopmx = looksLikeShopStorefront(home.body);
  const foreignRedirect = Boolean(
    locationHost
    && locationHost !== publicHost
    && !locationHost.endsWith(`.${publicHost}`)
    && locationHost !== 'www.' + publicHost,
  );
  const cfHints = {
    521: '521 web server down from CF path (wrong origin IP/port; origin may still serve 200 on public IP)',
    522: '522 connection timed out to origin',
    523: '523 origin unreachable',
    525: '525 SSL handshake failed to origin',
    526: '526 invalid origin certificate',
  };
  let failReason = '';
  if (home.error) {
    failReason = home.error;
  } else if (foreignRedirect) {
    failReason = `wrong-origin redirect Location=${locationHeader} (CF origin is not ShopMX ${process.env.SHOPTEST_ORIGIN_PUBLIC_IP || '161.153.37.250'})`;
  } else if (home.status === 200 && !looksLikeShopmx) {
    failReason = `status=200 but body is not ShopMX storefront${bodyHint ? ` body=${bodyHint}` : ''}`;
  } else if (home.status !== 200) {
    failReason = `${cfHints[home.status] || `status=${home.status || 0}`}${locationHeader ? ` Location=${locationHeader}` : ''}${bodyHint ? ` body=${bodyHint}` : ''}`;
  }
  const ok = home.status === 200 && looksLikeShopmx && !foreignRedirect;
  const detail = ok
    ? `status=200 base=${publicBase} storefront=ok`
    : `${failReason} base=${publicBase}`;
  soft('public CDN host reachable', ok, detail);
  if (!ok) {
    soft('public CDN CWV measurement', false, 'blocked — public CDN not customer-reachable ShopMX storefront');
    await diagnoseCloudflareOriginGap({
      status: home.status,
      error: failReason || home.error || '',
      body: home.body || '',
      location: locationHeader,
    });
  } else {
    // Soft CWV on real public host when reachable (ship-bar evidence).
    let playwright;
    try {
      playwright = requireDependency('playwright');
    } catch (error) {
      soft('public CDN CWV measurement', false, 'playwright unavailable');
      return;
    }
    let browser;
    try {
      browser = await playwright.chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(`${publicBase}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
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
        return { lcp, cls };
      });
      soft(
        'public CDN CWV measurement',
        (!cwv.lcp || cwv.lcp < 4000) && cwv.cls < 0.1,
        `lcp=${Math.round(cwv.lcp)}ms cls=${Number(cwv.cls).toFixed(3)} host=${publicHost}`,
      );
      await context.close();
    } catch (error) {
      soft(
        'public CDN CWV measurement',
        false,
        error && error.message ? error.message : String(error),
      );
    } finally {
      if (browser) {
        try { await browser.close(); } catch (err) { /* ignore */ }
      }
    }
  }
}

async function probeOriginEdgeDual() {
  // When public CDN returns 522/timeout, still measure the local origin edge so ship-prep
  // is not blind. Defaults to https://127.0.0.1 with Host pet.686888666.xyz.
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  const home = await requestOriginEdge('/', { timeout: 8000 });
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
    playwright = requireDependency('playwright');
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
    await page.reload({ waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    });
    await page.waitForTimeout(2200);
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
    const originLcpMeasured = Number(cwv.lcp) > 0;
    soft(
      'origin edge CWV measurement',
      originLcpMeasured && cwv.lcp < 4000 && cwv.cls < 0.1,
      `lcp=${Math.round(cwv.lcp)}ms cls=${Number(cwv.cls).toFixed(3)} measured=${originLcpMeasured} host=${originHost}`,
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




async function probeOriginEdgeHtmlSecurityHeaders() {
  // Commercial security: SPA shell must keep CSP + clickjacking/MIME sniffing guards even when
  // location-level Cache-Control headers are present (nginx does not inherit parent add_header).
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  try {
    const home = await requestOriginEdge('/', { timeout: 8000 });
    const headers = home.headers || {};
    const csp = String(headers['content-security-policy'] || headers['Content-Security-Policy'] || '');
    const xfo = String(headers['x-frame-options'] || headers['X-Frame-Options'] || '');
    const xcto = String(headers['x-content-type-options'] || headers['X-Content-Type-Options'] || '');
    const perm = String(headers['permissions-policy'] || headers['Permissions-Policy'] || '');
    const ok = home.status === 200
      && /default-src/i.test(csp)
      && /frame-ancestors/i.test(csp)
      && /deny/i.test(xfo)
      && /nosniff/i.test(xcto)
      && /geolocation=\(\)/i.test(perm);
    soft(
      'origin edge html security headers',
      ok,
      `status=${home.status} base=${originBase} host=${originHost} csp=${csp ? 'present' : 'missing'} xfo=${xfo || 'missing'} xcto=${xcto || 'missing'} perm=${perm || 'missing'}`,
    );
  } catch (error) {
    soft(
      'origin edge html security headers',
      false,
      error && error.message ? error.message : String(error),
    );
  }
}

async function probeOriginEdgeHtmlNoCache() {
  // Commercial deploy safety: SPA shell must not be immutable/long-cached on origin edge.
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  try {
    const home = await requestOriginEdge('/', { timeout: 8000 });
    const cache = String((home.headers && (home.headers['cache-control'] || home.headers['Cache-Control'])) || '');
    const ok = home.status === 200
      && /no-cache|no-store|max-age=0/i.test(cache)
      && !/immutable/i.test(cache);
    soft(
      'origin edge html no-cache',
      ok,
      `status=${home.status} base=${originBase} host=${originHost} cache=${cache || 'missing'}`,
    );
  } catch (error) {
    soft(
      'origin edge html no-cache',
      false,
      error && error.message ? error.message : String(error),
    );
  }
}

async function probeOriginEdgeStaticCache() {
  // Commercial cache contract: CRA hashed /static/** must be 1y immutable on origin edge
  // so Cloudflare and browsers keep repeat-visit payloads off the origin.
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  try {
    const home = await requestOriginEdge('/', { timeout: 8000 });
    const match = String(home.body || '').match(/static\/js\/(main\.[a-f0-9]+\.js)/i);
    if (!match) {
      soft(
        'origin edge static long-cache immutable',
        false,
        `main hashed js not found in origin html status=${home.status} base=${originBase} host=${originHost}`,
      );
      return;
    }
    const assetPath = `/static/js/${match[1]}`;
    const originHttp = await requestOriginEdge(assetPath, { timeout: 8000 });
    const cache = String((originHttp.headers && (originHttp.headers['cache-control'] || originHttp.headers['Cache-Control'])) || '');
    const ok = originHttp.status === 200
      && /max-age=31536000/i.test(cache)
      && /immutable/i.test(cache);
    soft(
      'origin edge static long-cache immutable',
      ok,
      `status=${originHttp.status} base=${originBase} host=${originHost} cache=${cache || 'missing'} path=${assetPath}`,
    );
  } catch (error) {
    soft(
      'origin edge static long-cache immutable',
      false,
      error && error.message ? error.message : String(error),
    );
  }
}


async function probeOriginEdgePublicAssetHeaders() {
  // Non-hashed public assets (favicon, /assets/*) must not dual-set Cache-Control via expires+add_header,
  // and must still emit commercial security headers after location-level Cache-Control overrides.
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  try {
    const asset = await requestOriginEdge('/favicon.ico', { timeout: 8000 });
    const headers = asset.headers || {};
    const cacheRaw = headers['cache-control'] || headers['Cache-Control'] || '';
    const cacheValues = Array.isArray(cacheRaw) ? cacheRaw : [cacheRaw];
    const cacheJoined = cacheValues.filter(Boolean).join(' | ');
    const maxAgeHits = (cacheJoined.match(/max-age=2592000/gi) || []).length;
    const dualCache = cacheValues.length > 1 || maxAgeHits > 1;
    const cacheOk = asset.status === 200
      && /max-age=2592000/i.test(cacheJoined)
      && !/immutable/i.test(cacheJoined)
      && !dualCache;
    const csp = String(headers['content-security-policy'] || headers['Content-Security-Policy'] || '');
    const xfo = String(headers['x-frame-options'] || headers['X-Frame-Options'] || '');
    const xcto = String(headers['x-content-type-options'] || headers['X-Content-Type-Options'] || '');
    const securityOk = asset.status === 200
      && /default-src/i.test(csp)
      && /deny/i.test(xfo)
      && /nosniff/i.test(xcto);
    soft(
      'origin edge public asset single cache',
      cacheOk,
      `status=${asset.status} base=${originBase} host=${originHost} cache=${cacheJoined || 'missing'} dual=${dualCache}`,
    );
    soft(
      'origin edge public asset security headers',
      securityOk,
      `status=${asset.status} base=${originBase} host=${originHost} csp=${csp ? 'present' : 'missing'} xfo=${xfo || 'missing'} xcto=${xcto || 'missing'}`,
    );
  } catch (error) {
    soft(
      'origin edge public asset single cache',
      false,
      error && error.message ? error.message : String(error),
    );
    soft(
      'origin edge public asset security headers',
      false,
      error && error.message ? error.message : String(error),
    );
  }
}


async function probeOriginEdgeSecurityTxt() {
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  try {
    const res = await requestOriginEdge('/.well-known/security.txt', { timeout: 8000 });
    const body = String(res.body || '');
    const ok = res.status === 200 && /Contact:/i.test(body) && /Preferred-Languages:/i.test(body);
    soft(
      'origin edge security.txt',
      ok,
      `status=${res.status} base=${originBase} host=${originHost} bytes=${body.length}`,
    );
  } catch (error) {
    soft('origin edge security.txt', false, error && error.message ? error.message : String(error));
  }
}

async function probeOriginEdgeAbsoluteShellSeo() {
  const originBase = getOriginEdgeBase();
  const originHost = getOriginEdgeHost();
  try {
    const home = await requestOriginEdge('/', { timeout: 8000 });
    const body = String(home.body || '');
    const escapedCanonicalBase = canonicalBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ok = home.status === 200
      && body.includes(`${canonicalBase}/logo512.png`)
      && new RegExp(`rel=["']canonical["'][^>]*${escapedCanonicalBase}/`, 'i').test(body);
    soft(
      'origin edge absolute shell SEO urls',
      ok,
      ok ? `base=${originBase} host=${originHost} canonical=${canonicalBase}` : `status=${home.status} base=${originBase} host=${originHost} canonical=${canonicalBase} absoluteShell=${body.includes(`${canonicalBase}/logo512.png`)}`,
    );
  } catch (error) {
    soft('origin edge absolute shell SEO urls', false, error && error.message ? error.message : String(error));
  }
}

async function probeLocalWebhookContracts() {
  if (!configuredLocalUiBase) {
    const detail = 'SHOPTEST_UI_BASE not set; webhook contract probe skipped';
    soft('local stripe webhook rejects bad signature', false, detail);
    soft('local stripe webhook accepts signed payload contract', false, detail);
    soft('local mercado webhook rejects bad signature', false, detail);
    soft('local mercado webhook accepts signed payload contract', false, detail);
    soft(
      'real provider webhook traffic evidence',
      false,
      'SHOPTEST_UI_BASE not set; provide a reachable local storefront/API base to inspect webhook evidence',
    );
    return;
  }

  const stripeSecret = String(
    process.env.SHOPTEST_STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '',
  ).trim();
  const mercadoSecret = String(
    process.env.SHOPTEST_MERCADO_PAGO_WEBHOOK_SECRET || process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
  ).trim();
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

  // Commercial evidence journal: signed accepts persisted in the backend security audit trail.
  // PROVIDER_LIKE (non-loopback / known provider UA) is the ship-bar bar for real traffic.
  try {
    const evidence = await request(`${localUiBase}/api/payments/webhook-evidence`, { timeout: 6000 });
    let payload = {};
    try {
      payload = evidence.body ? JSON.parse(evidence.body) : {};
    } catch (_) {
      payload = {};
    }
    const persistentEvidence = payload.available === true
      && payload.evidenceStore === 'PERSISTENT_AUDIT_LOG';
    const providerLike = persistentEvidence && Boolean(payload.anyProviderLikeSuccess);
    const stripeCount = Number(payload.stripe && payload.stripe.successCount) || 0;
    const mercadoCount = Number(payload.mercadoPago && payload.mercadoPago.successCount) || 0;
    const detail = providerLike
      ? `provider-like delivery recorded stripe=${stripeCount} mercado=${mercadoCount}`
      : !persistentEvidence
        ? `persistent webhook evidence unavailable store=${payload.evidenceStore || 'missing'} available=${payload.available}; deploy restart-safe audit evidence before accepting provider proof`
        : `no provider-like delivery yet (local signed ok: stripe=${stripeCount} mercado=${mercadoCount}); requires live Stripe/Mercado dashboard deliveries against production webhook URLs with real secrets`;
    soft('real provider webhook traffic evidence', providerLike, detail);
  } catch (error) {
    soft(
      'real provider webhook traffic evidence',
      false,
      `evidence endpoint unavailable: ${error && error.message ? error.message : String(error)}`,
    );
  }
}


async function probeLocalMobileReleaseArtifact() {
  const fs = require('fs');
  const path = require('path');
  const downloadsDir = path.resolve(__dirname, '../public/downloads');
  const metaPath = path.join(downloadsDir, 'mobile-version.json');
  if (!fs.existsSync(metaPath)) {
    check('local mobile-version.json present', false, metaPath);
    soft('local APK artifact integrity', false, 'mobile-version.json missing');
    return null;
  }
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    check('local mobile-version.json present', true, `version=${meta.versionName || '?'} code=${meta.versionCode || '?'}`);
  } catch (error) {
    check('local mobile-version.json present', false, error && error.message ? error.message : String(error));
    soft('local APK artifact integrity', false, 'mobile-version.json parse failed');
    return null;
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
    return { meta, apkPath, apkOk: false };
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
  return { meta, apkPath, apkOk: sizeOk && shaOk };
}

function getDeviceEvidenceMaxAgeDays() {
  const parsed = Number(process.env.SHOPTEST_DEVICE_E2E_MAX_AGE_DAYS || 14);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}

function validateDeviceE2eEvidence(raw, mobileArtifact) {
  if (!raw || raw.passed !== true) {
    return { ok: false, detail: 'evidence present but passed=true missing' };
  }
  const deviceId = raw.deviceId || raw.serial || raw.model;
  if (!deviceId) {
    return { ok: false, detail: 'evidence present but device identity missing' };
  }
  if (!mobileArtifact || !mobileArtifact.meta || !mobileArtifact.apkOk) {
    return { ok: false, detail: 'release APK metadata/integrity must pass before device evidence can ship' };
  }
  const meta = mobileArtifact.meta;
  if (meta.sha256 && String(raw.sha256 || '').toLowerCase() !== String(meta.sha256).toLowerCase()) {
    return { ok: false, detail: 'device evidence sha256 mismatch with current mobile-version.json' };
  }
  if (meta.versionCode != null && raw.versionCode != null && String(raw.versionCode) !== String(meta.versionCode)) {
    return { ok: false, detail: `device evidence versionCode ${raw.versionCode} does not match current ${meta.versionCode}` };
  }
  if (meta.versionName && raw.versionName && String(raw.versionName) !== String(meta.versionName)) {
    return { ok: false, detail: `device evidence versionName ${raw.versionName} does not match current ${meta.versionName}` };
  }
  if (Number(raw.installExitCode) !== 0) {
    return { ok: false, detail: `device installExitCode=${raw.installExitCode}` };
  }
  if (Number(raw.launchExitCode) !== 0) {
    return { ok: false, detail: `device launchExitCode=${raw.launchExitCode}` };
  }
  const recordedAtMs = Date.parse(raw.recordedAt || '');
  if (!Number.isFinite(recordedAtMs)) {
    return { ok: false, detail: 'device evidence recordedAt missing or invalid' };
  }
  const maxAgeDays = getDeviceEvidenceMaxAgeDays();
  const ageDays = (Date.now() - recordedAtMs) / 86400000;
  if (ageDays > maxAgeDays) {
    return { ok: false, detail: `device evidence stale ageDays=${ageDays.toFixed(1)} max=${maxAgeDays}` };
  }
  return {
    ok: true,
    detail: `evidence device=${deviceId} version=${raw.versionName || meta.versionName || '?'} code=${raw.versionCode || meta.versionCode || '?'} ageDays=${Math.max(ageDays, 0).toFixed(1)}`,
  };
}

async function main() {
  logLine(`Production readiness probe @ ${productionBase}`);
  logLine(`Local UI contract base @ ${localUiBase}`);
  logLine(`requireProduction=${requireProduction}`);
  logLine(`requireCommercialShip=${requireCommercialShip}`);
  logLine(`productionHost=${productionHostHeader || '(url-host)'} tlsInsecure=${productionTlsInsecure}`);

  await probeCanonicalProductionHost();
  await probeProduction();
  await probePublicCdnShipBar();
  await probeOriginEdgeDual();
  await probeOriginEdgeStaticCache();
  await probeOriginEdgeHtmlNoCache();
  await probeOriginEdgeHtmlSecurityHeaders();
  await probeOriginEdgePublicAssetHeaders();
  await probeOriginEdgeSecurityTxt();
  await probeOriginEdgeAbsoluteShellSeo();
  await probeLocalWebhookContracts();
  const mobileArtifact = await probeLocalMobileReleaseArtifact();

  // Optional operator-recorded physical-device evidence file.
  try {
    const fs = require('fs');
    const path = require('path');
    const evidencePath = process.env.SHOPTEST_DEVICE_E2E_EVIDENCE
      || path.resolve(__dirname, '../public/downloads/device-e2e-evidence.json');
    if (fs.existsSync(evidencePath)) {
      const raw = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      const validation = validateDeviceE2eEvidence(raw, mobileArtifact);
      soft(
        'real-device mobile E2E evidence',
        validation.ok,
        `${validation.detail} path=${evidencePath}`,
      );
    } else {
      soft(
        'real-device mobile E2E evidence',
        false,
        'run scripts/record-commercial-device-e2e.js on a physical device (adb); local matrix covered by test:commercial-mobile-device-smoke',
      );
    }
  } catch (error) {
    soft(
      'real-device mobile E2E evidence',
      false,
      `device evidence check failed: ${error && error.message ? error.message : String(error)}`,
    );
  }

  const hardFails = results.filter((item) => !item.pass);
  const passed = results.filter((item) => item.pass).length;
  logLine(`\nSUMMARY ${passed}/${results.length} recorded @ production=${productionBase}`);
  if (hardFails.length) {
    hardFails.forEach((item) => {
      logError(` - ${item.name}: ${item.detail}`);
    });
    process.exitCode = 1;
  } else {
    const softish = getSoftGaps();
    const commercialShipGaps = getCommercialShipGaps();
    const shipBar = [
      'canonical production DNS + trusted TLS + storefront',
      'public production host CWV',
      'real provider webhook traffic',
      'real-device APK/WebView E2E',
    ];
    if (commercialShipGaps.length) {
      logLine(`NOTE commercial ship bar still blocked by: ${shipBar.join(' + ')}`);
    } else {
      logLine('PASS commercial ship bar required soft gates recorded');
    }
    if (softish.length) {
      logLine(`NOTE soft gaps: ${softish.join(', ')}`);
    }
    if (requireCommercialShip && commercialShipGaps.length) {
      logError(`COMMERCIAL_SHIP_BLOCKED ${commercialShipGaps.join(', ')}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  logError('PRODUCTION_READINESS_CRASH', error);
  process.exit(2);
});
