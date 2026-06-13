const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0500-admin-system-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'landscape-740', width: 740, height: 360 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
];

const permissions = [
  'dashboard',
  'system',
  'system:status',
  'support',
  'support:read-state',
];

const systemStatus = {
  status: 'DEGRADED',
  healthy: false,
  ready: false,
  checkedAt: '2026-06-08T05:00:00Z',
  application: {
    name: 'shop-backend-production-cluster-east-long-name-for-status-card',
    runtimeMode: 'production',
    serverPort: '8081',
    profiles: ['prod', 'nacos-config', 'redis-required'],
    time: '2026-06-08T05:00:00Z',
  },
  runtime: {
    javaVersion: '21.0.5-temurin-long-runtime-build',
    javaVendor: 'Eclipse Adoptium',
    osName: 'Linux',
    osVersion: '6.8.0-1017-oracle',
    processors: 12,
    uptimeMs: 987654321,
    startTimeMs: 1780880000000,
  },
  memory: {
    maxBytes: 2147483648,
    totalBytes: 1835008000,
    freeBytes: 107374182,
    usedBytes: 1727633818,
    usedPercent: 86.7,
  },
  disk: {
    path: '/var/lib/shoptest/runtime/uploads-and-generated-assets-with-long-path',
    totalBytes: 53687091200,
    freeBytes: 4294967296,
    usedBytes: 49392123904,
    usedPercent: 92,
  },
  database: {
    url: 'jdbc:mysql://****:****@primary-db.internal.shoptest.example:3306/shoptest?useSSL=true&allowPublicKeyRetrieval=false&serverTimezone=UTC',
    driver: 'com.mysql.cj.jdbc.Driver',
    status: 'DOWN',
    healthy: false,
    ready: false,
    required: true,
    checkedAt: '2026-06-08T05:00:00Z',
    latencyMs: 2000,
    error: "Communications link failure: timed out after 2000ms while checking primary-db.internal.shoptest.example",
  },
  redis: {
    host: 'redis-cache-production-east.internal.shoptest.example',
    port: '6379',
    database: '0',
    status: 'UP',
    healthy: true,
    ready: true,
    required: true,
    checkedAt: '2026-06-08T05:00:00Z',
    latencyMs: 18,
    ping: 'PONG',
  },
  nacos: {
    serverAddr: 'nacos-prod.internal.shoptest.example:8848',
    status: 'DEGRADED',
    healthy: false,
    ready: false,
    configEnabled: true,
    discoveryEnabled: true,
    registerEnabled: false,
    namespace: 'production-commerce-namespace-with-long-name',
    group: 'SHOPTEST_PRODUCTION_GROUP',
    checkedAt: '2026-06-08T05:00:00Z',
    latencyMs: 840,
    serverStatus: 'WARN',
    dataId: 'shop-backend-production.yaml',
    warnings: [
      'Discovery registration is disabled, so this instance will not appear in service registry.',
      'Config snapshot is older than the last successful deployment.',
    ],
    errors: ['Nacos heartbeat latency exceeded the 800 ms operational threshold.'],
    error: '',
  },
  productionConfig: {
    runtimeMode: 'production',
    status: 'DEGRADED',
    healthy: false,
    ready: false,
    required: true,
    checkedAt: '2026-06-08T05:00:00Z',
    issues: [
      'Payment channel VISA is enabled but missing a provider checkout URL for production traffic.',
      'Mail account transactional-prod has no verified sender configured.',
    ],
    warnings: [
      'CORS origins include a staging host and should be reviewed before launch.',
      'Nacos namespace is configured but registration is disabled.',
    ],
    checks: {
      mail: { status: 'DEGRADED', configuredAccountCount: 1 },
      paymentChannels: { status: 'DEGRADED', availableCheckoutChannelCount: 1, enabledChannelCount: 5 },
      cors: { status: 'WARN', corsOriginCount: 9 },
    },
  },
};

async function installMocks(page) {
  await page.route('**/api/auth/refresh', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token: 'ui-audit-token', refreshToken: 'ui-audit-refresh-token' }),
  }));

  await page.route('**/api/users/profile**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 910, username: 'system.audit.admin', role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', status: 'ACTIVE' }),
  }));

  await page.route('**/api/admin/me/permissions**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', permissions }),
  }));

  await page.route('**/api/admin/support/unread-count', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ count: 0 }),
  }));

  await page.route('**/api/admin/system/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(systemStatus),
  }));
}

async function waitForPage(page) {
  await page.waitForSelector('.system-monitor', { timeout: 30000 });
  await page.waitForSelector('.system-monitor__stats .ant-card', { timeout: 30000 });
  await page.waitForSelector('.system-monitor__resourceGrid .ant-card', { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function collectMetrics(page, state) {
  return page.evaluate((stateName) => {
    const rectOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        position: style.position,
        zIndex: style.zIndex,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      };
    };

    const textOf = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');

    const visibleRatio = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const area = rect.width * rect.height;
      return area ? (width * height) / area : 0;
    };

    const stats = Array.from(document.querySelectorAll('.system-monitor__stats .ant-card')).map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        text: textOf(el),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        visibleRatio: visibleRatio(el),
      };
    });

    const cards = Array.from(document.querySelectorAll('.system-monitor__card')).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const title = el.querySelector('.ant-card-head-title');
      return {
        index,
        title: title ? textOf(title) : '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        visibleRatio: visibleRatio(el),
      };
    });

    const descriptionItems = Array.from(document.querySelectorAll('.system-monitor .ant-descriptions-item')).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const label = el.querySelector('.ant-descriptions-item-label');
      const content = el.querySelector('.ant-descriptions-item-content');
      const labelRect = label?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      return {
        index,
        text: textOf(el).slice(0, 180),
        label: label ? textOf(label) : '',
        content: content ? textOf(content).slice(0, 160) : '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        labelRect: labelRect ? { x: labelRect.x, y: labelRect.y, width: labelRect.width, height: labelRect.height, right: labelRect.right, bottom: labelRect.bottom } : null,
        contentRect: contentRect ? { x: contentRect.x, y: contentRect.y, width: contentRect.width, height: contentRect.height, right: contentRect.right, bottom: contentRect.bottom } : null,
      };
    });

    const tags = Array.from(document.querySelectorAll('.system-monitor .ant-tag')).map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        text: textOf(el),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        visibleRatio: visibleRatio(el),
      };
    });

    const overflowEls = Array.from(document.querySelectorAll('body *'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return null;
        const overflowRight = rect.right - window.innerWidth;
        const overflowLeft = -rect.left;
        if (overflowRight <= 1 && overflowLeft <= 1) return null;
        return {
          selector: el.className ? `${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g, '.')}` : el.tagName.toLowerCase(),
          text: textOf(el).slice(0, 120),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
          overflowRight,
          overflowLeft,
        };
      })
      .filter(Boolean)
      .sort((left, right) => Math.max(right.overflowRight, right.overflowLeft) - Math.max(left.overflowRight, left.overflowLeft))
      .slice(0, 40);

    const centerHit = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        selector,
        point: { x, y },
        hitTag: hit?.tagName || null,
        hitClass: hit?.className ? String(hit.className) : '',
        hitText: hit ? textOf(hit).slice(0, 120) : '',
      };
    };

    return {
      state: stateName,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      rects: {
        adminHeader: rectOf('.admin-layout__header'),
        adminContent: rectOf('.admin-layout__content'),
        page: rectOf('.system-monitor'),
        hero: rectOf('.system-monitor__hero'),
        stats: rectOf('.system-monitor__stats'),
        alert: rectOf('.system-monitor__alert'),
        resourceGrid: rectOf('.system-monitor__resourceGrid'),
        opsTips: rectOf('.system-monitor__card:last-of-type'),
      },
      stats,
      cards,
      descriptionItems,
      tags,
      overflowEls,
      hits: [
        centerHit('.system-monitor__hero .ant-btn'),
        centerHit('.system-monitor__stats .ant-card:nth-child(1)'),
        centerHit('.system-monitor__card:nth-of-type(2)'),
        centerHit('.system-monitor__card:last-of-type'),
      ],
    };
  }, state);
}

async function captureState(page, viewportName, stateName, fileName) {
  const metrics = await collectMetrics(page, stateName);
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${fileName}.png`), fullPage: false });
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${fileName}-full.png`), fullPage: true });
  return metrics;
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await installMocks(page);
    await page.addInitScript(() => {
      localStorage.setItem('token', 'ui-audit-token');
      localStorage.setItem('refreshToken', 'ui-audit-refresh-token');
      localStorage.setItem('role', 'SUPER_ADMIN');
    });
    const consoleMessages = [];
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });
    await page.goto(`${baseUrl}/admin/system`, { waitUntil: 'networkidle' });
    await waitForPage(page);

    const states = [];
    states.push(await captureState(page, viewport.name, 'top', 'top'));

    await page.evaluate(() => window.scrollTo(0, Math.floor(window.innerHeight * 0.72)));
    await page.waitForTimeout(250);
    states.push(await captureState(page, viewport.name, 'middle', 'middle'));

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    states.push(await captureState(page, viewport.name, 'bottom', 'bottom'));

    report.push({
      viewport,
      url: page.url(),
      consoleMessages,
      states,
    });
    await fs.promises.writeFile(path.join(outDir, `${viewport.name}.json`), JSON.stringify(report[report.length - 1], null, 2));
    await page.close();
  }

  await browser.close();
  await fs.promises.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Wrote ${outDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
