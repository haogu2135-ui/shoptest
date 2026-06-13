const { chromium } = require('./frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://127.0.0.1:4200';
const outDir = path.join(__dirname, 'app-ui-audit-20260608T0410-admin-registry-codex');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'small-320', width: 320, height: 568, mobile: true },
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'landscape-740', width: 740, height: 360, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false },
  { name: 'desktop-1366', width: 1366, height: 900, mobile: false },
];

const profile = {
  id: 9101,
  username: 'ui-audit-admin',
  email: 'ui-audit@example.com',
  role: 'SUPER_ADMIN',
  roleCode: 'SUPER_ADMIN',
};

const permissions = [
  'dashboard',
  'registry',
  'support',
];

const instances = [
  {
    serviceId: 'shop-backend',
    host: '10.42.12.18',
    port: 8081,
    secure: false,
    uri: 'http://10.42.12.18:8081',
    metadata: {
      version: '2026.06.08-long-build-metadata',
      zone: 'iad-prod-a',
      profile: 'prod,registry,nacos',
      commit: 'a1b2c3d4e5f678901234567890abcdef',
    },
  },
  {
    serviceId: 'payment-worker-super-long-service-name-for-production',
    host: '10.42.12.29',
    port: 9094,
    secure: false,
    uri: 'http://10.42.12.29:9094/internal/payment/callback/consumer',
    metadata: {
      version: '2026.06.08',
      zone: 'iad-prod-b',
      owner: 'settlement-platform',
    },
  },
  {
    serviceId: 'notification-worker',
    host: '10.42.12.31',
    port: 9095,
    secure: false,
    uri: 'http://10.42.12.31:9095/internal/notification',
    metadata: {
      version: '2026.06.08',
      zone: 'iad-prod-a',
      queue: 'transactional-email-and-sms',
    },
  },
];

const registryStatus = {
  applicationName: 'shop-backend',
  discoveryEnabled: true,
  registerEnabled: true,
  nacosServerAddr: 'nacos-prod.internal.example.com:8848',
  namespace: 'prod-shop-namespace-with-long-id',
  group: 'SHOP_PRODUCTION_GROUP',
  serverPort: '8081',
  configuredIp: '10.42.12.18',
  configuredPort: '8081',
  ephemeral: true,
  weight: '1.0',
  discoveryClientDescription: 'CompositeDiscoveryClient(nacosDiscoveryClient, simpleDiscoveryClient)',
  profiles: ['prod', 'nacos', 'gateway', 'observability'],
  healthy: true,
  instanceCount: 1,
  knownServices: ['shop-backend', 'payment-worker-super-long-service-name-for-production', 'notification-worker'],
  serviceSummaries: [
    { serviceId: 'shop-backend', instanceCount: 1, instances: [instances[0]] },
    { serviceId: 'payment-worker-super-long-service-name-for-production', instanceCount: 1, instances: [instances[1]] },
    { serviceId: 'notification-worker', instanceCount: 1, instances: [instances[2]] },
  ],
  instances,
};

function fulfillJson(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installRoutes(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    if (method === 'GET' && pathname === '/users/profile') return fulfillJson(route, profile);
    if (method === 'GET' && pathname === '/admin/me/permissions') {
      return fulfillJson(route, { role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', permissions });
    }
    if (method === 'GET' && pathname === '/admin/support/unread-count') return fulfillJson(route, { count: 2 });
    if (method === 'GET' && pathname === '/support/unread-count') return fulfillJson(route, { count: 0 });
    if (method === 'GET' && pathname === '/admin/registry') return fulfillJson(route, registryStatus);
    return fulfillJson(route, {});
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

async function metrics(page) {
  return await page.evaluate(() => {
    const rectFor = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        r: Math.round(rect.right),
        b: Math.round(rect.bottom),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        display: style.display,
        position: style.position,
        top: style.top,
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
      };
    };
    const allRects = (selector) => Array.from(document.querySelectorAll(selector)).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        index,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        r: Math.round(rect.right),
        b: Math.round(rect.bottom),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
      };
    });
    const hit = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return {
        x,
        y,
        tag: el?.tagName || null,
        className: el?.className || null,
        text: (el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      };
    };
    const centerHit = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        selector,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          r: Math.round(rect.right),
          b: Math.round(rect.bottom),
        },
        hit: hit(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)),
      };
    };
    return {
      url: location.href,
      scrollY: Math.round(window.scrollY),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
      },
      documentElement: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      selectors: [
        '.admin-layout__header',
        '.admin-layout__content',
        '.registry-management',
        '.registry-management__hero',
        '.registry-management__stats',
        '.registry-management__alert',
        '.registry-management__grid',
        '.registry-management__gateway',
        '.registry-management__card',
        '.registry-management__card .ant-card-extra',
        '.registry-management__card .ant-card-extra .ant-input-affix-wrapper',
        '.registry-management__card .ant-table-wrapper',
        '.registry-management__card .ant-table-content',
      ].map(rectFor),
      statsCards: allRects('.registry-management__stats .ant-card'),
      cards: allRects('.registry-management__card'),
      cardHeads: allRects('.registry-management__card .ant-card-head'),
      descriptions: allRects('.registry-management .ant-descriptions-view'),
      tables: allRects('.registry-management .ant-table-wrapper'),
      hits: [
        centerHit('.registry-management__hero'),
        centerHit('.registry-management__card .ant-card-extra .ant-input-affix-wrapper'),
        centerHit('.registry-management .ant-table-wrapper'),
        hit(24, 70),
        hit(Math.round(window.innerWidth / 2), 70),
        hit(Math.round(window.innerWidth / 2), 120),
        hit(Math.round(window.innerWidth / 2), 180),
      ],
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
      localStorage.setItem('token', 'ui-audit-token');
      localStorage.setItem('refreshToken', 'ui-audit-refresh');
      localStorage.setItem('role', 'SUPER_ADMIN');
      localStorage.setItem('shop-language', 'en');
    });
    const page = await context.newPage();
    await installRoutes(page);
    await page.goto(`${baseUrl}/admin/registry`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.registry-management', { timeout: 15000 });
    await page.waitForTimeout(500);
    await screenshot(page, `${vp.name}-top`);
    const top = await metrics(page);
    const scrollTargets = [
      { key: 'stats-past', y: 260 },
      { key: 'gateway', y: 720 },
      { key: 'service-table', selector: '.registry-management__card:has-text("Discovered services")' },
      { key: 'details-table', selector: '.registry-management__card:has-text("Current service instance details")' },
    ];
    const states = { top };
    for (const target of scrollTargets) {
      if (target.selector) {
        const locator = page.locator(target.selector).first();
        if (await locator.count()) {
          await locator.scrollIntoViewIfNeeded();
          await page.waitForTimeout(250);
        }
      } else {
        await page.evaluate((y) => window.scrollTo(0, y), target.y);
        await page.waitForTimeout(250);
      }
      await screenshot(page, `${vp.name}-${target.key}`);
      states[target.key] = await metrics(page);
    }
    results.push({ viewport: vp, states });
    await fs.promises.writeFile(path.join(outDir, `${vp.name}.json`), JSON.stringify(results[results.length - 1], null, 2));
    await context.close();
  }
  await browser.close();
  await fs.promises.writeFile(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`wrote ${outDir}`);
})();
