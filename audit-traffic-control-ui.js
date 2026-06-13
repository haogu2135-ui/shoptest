const { chromium } = require('./frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://127.0.0.1:4200';
const outDir = path.join(__dirname, 'app-ui-audit-20260608T0335-admin-traffic-control-codex');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: 'small-320', width: 320, height: 568, mobile: true },
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'landscape-740', width: 740, height: 360, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: false },
  { name: 'desktop-1366', width: 1366, height: 900, mobile: false },
];

const permissions = [
  'dashboard',
  'traffic-control',
  'traffic-control:rate-limit-clear',
  'traffic-control:circuit-reset',
  'support',
];

const profile = {
  id: 9001,
  username: 'ui-audit-admin',
  email: 'ui-audit@example.com',
  role: 'SUPER_ADMIN',
  roleCode: 'SUPER_ADMIN',
};

const trafficStatus = {
  rateLimit: {
    enabled: true,
    publicPerMinute: 120,
    authenticatedPerMinute: 600,
    adminPerMinute: 1800,
    windowSeconds: 60,
    activeBuckets: 1842,
    acceptedRequests: 3842291,
    rejectedRequests: 296,
  },
  circuitBreakerConfig: {
    enabled: true,
    failureThreshold: 5,
    openSeconds: 90,
    halfOpenSuccessThreshold: 3,
  },
  circuits: [
    {
      name: 'payment-gateway-primary-with-long-provider-name',
      state: 'OPEN',
      failureCount: 128,
      halfOpenSuccessCount: 0,
      openedUntil: '2026-06-08T04:04:00Z',
      lastFailureMessage: 'POST https://payments.internal.example.com/v1/charges timed out after 30000 ms while retry queue was saturated',
    },
    {
      name: 'inventory-reservation-service',
      state: 'HALF_OPEN',
      failureCount: 7,
      halfOpenSuccessCount: 2,
      openedUntil: '2026-06-08T03:46:00Z',
      lastFailureMessage: 'HTTP 503 Service Unavailable from reserve-stock endpoint',
    },
    {
      name: 'email-notification-worker',
      state: 'CLOSED',
      failureCount: 0,
      halfOpenSuccessCount: 3,
      lastFailureMessage: '',
    },
  ],
};

function jsonRoute(body, status = 200) {
  return async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  };
}

async function installRoutes(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    if (method === 'GET' && pathname === '/users/profile') return jsonRoute(profile)(route);
    if (method === 'GET' && pathname === '/admin/me/permissions') {
      return jsonRoute({ role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', permissions })(route);
    }
    if (method === 'GET' && pathname === '/admin/support/unread-count') return jsonRoute({ count: 3 })(route);
    if (method === 'GET' && pathname === '/support/unread-count') return jsonRoute({ count: 0 })(route);
    if (method === 'POST' && pathname === '/admin/traffic-control/rate-limit/clear') {
      return jsonRoute({ ...trafficStatus, rateLimit: { ...trafficStatus.rateLimit, activeBuckets: 0 } })(route);
    }
    if (method === 'POST' && pathname === '/admin/traffic-control/circuit-breakers/reset') {
      return jsonRoute({
        ...trafficStatus,
        circuits: trafficStatus.circuits.map((item) => ({ ...item, state: 'CLOSED', failureCount: 0 })),
      })(route);
    }
    if (method === 'GET' && pathname === '/admin/traffic-control') return jsonRoute(trafficStatus)(route);
    return jsonRoute({})(route);
  });
}

async function snapshot(page, name) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

async function collectMetrics(page) {
  return await page.evaluate(() => {
    const rectFor = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector,
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
        zIndex: style.zIndex,
      };
    };
    const allRects = (selector) => Array.from(document.querySelectorAll(selector)).map((el, index) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        index,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
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
    const hitAtCenter = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.round(rect.left + rect.width / 2);
      const y = Math.round(rect.top + rect.height / 2);
      const hit = document.elementFromPoint(x, y);
      return {
        selector,
        point: { x, y },
        targetTag: hit?.tagName || null,
        targetClass: hit?.className || null,
        targetText: (hit?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      };
    };
    return {
      url: location.href,
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
        '.admin-layout',
        '.admin-layout__header',
        '.admin-layout__content',
        '.traffic-control',
        '.traffic-control__hero',
        '.traffic-control__actions',
        '.traffic-control__stats',
        '.traffic-control__grid',
        '.traffic-control__alert',
        '.traffic-control__card',
        '.traffic-control__card .ant-table-wrapper',
        '.traffic-control__card .ant-table-container',
        '.traffic-control__card .ant-table-content',
        '.traffic-control__card .ant-table',
      ].map(rectFor),
      buttons: allRects('.traffic-control__actions .ant-btn, .traffic-control__card .ant-table .ant-btn'),
      heroButtonDetails: Array.from(document.querySelectorAll('.traffic-control__actions .ant-btn')).map((button, index) => {
        const buttonRect = button.getBoundingClientRect();
        const spans = Array.from(button.querySelectorAll('span')).map((span) => {
          const rect = span.getBoundingClientRect();
          const style = window.getComputedStyle(span);
          return {
            text: (span.textContent || '').trim(),
            className: span.className,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            r: Math.round(rect.right),
            b: Math.round(rect.bottom),
            color: style.color,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            overflow: style.overflow,
            whiteSpace: style.whiteSpace,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          };
        });
        const style = window.getComputedStyle(button);
        return {
          index,
          text: (button.textContent || '').trim().replace(/\s+/g, ' '),
          ariaLabel: button.getAttribute('aria-label'),
          title: button.getAttribute('title'),
          className: button.className,
          x: Math.round(buttonRect.x),
          y: Math.round(buttonRect.y),
          w: Math.round(buttonRect.width),
          h: Math.round(buttonRect.height),
          r: Math.round(buttonRect.right),
          b: Math.round(buttonRect.bottom),
          color: style.color,
          background: style.background,
          backgroundColor: style.backgroundColor,
          display: style.display,
          alignItems: style.alignItems,
          justifyContent: style.justifyContent,
          overflow: style.overflow,
          whiteSpace: style.whiteSpace,
          textIndent: style.textIndent,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          spans,
        };
      }),
      statsCards: allRects('.traffic-control__stats .ant-card'),
      configRows: allRects('.traffic-control__configList span'),
      tableCells: allRects('.traffic-control__card .ant-table-cell'),
      cardHeads: allRects('.traffic-control__card .ant-card-head-title'),
      hitTests: [
        hitAtCenter('.traffic-control__actions .ant-btn'),
        hitAtCenter('.traffic-control__card .ant-table .ant-btn'),
      ],
    };
  });
}

async function openPopconfirm(page, target, label) {
  const locator = page.locator(target).first();
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  let clickError = null;
  try {
    await locator.click({ timeout: 5000 });
  } catch (error) {
    clickError = String(error?.message || error).slice(0, 1000);
  }
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => {
    const pop = document.querySelector('.ant-popover, .shop-mobile-popup-layer');
    const rect = pop?.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll('.ant-popover .ant-btn, .shop-mobile-popup-layer .ant-btn')).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim(),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        r: Math.round(r.right),
        b: Math.round(r.bottom),
        hit: (() => {
          const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
          return { tag: hit?.tagName || null, cls: hit?.className || null, text: (hit?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) };
        })(),
      };
    });
    return {
      popover: rect ? {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        r: Math.round(rect.right),
        b: Math.round(rect.bottom),
        text: (pop.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
        className: pop.className,
      } : null,
      buttons,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
    };
  });
  metrics.clickError = clickError;
  await snapshot(page, `${label}-popconfirm`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(4, 4).catch(() => {});
  await page.waitForTimeout(150);
  return metrics;
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
    const consoleMessages = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        consoleMessages.push({ type: message.type(), text: message.text() });
      }
    });
    await installRoutes(page);
    await page.goto(`${baseUrl}/admin/traffic-control`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.traffic-control', { timeout: 15000 });
    await page.waitForTimeout(500);
    await snapshot(page, `${vp.name}-top`);
    const topMetrics = await collectMetrics(page);
    await page.evaluate(() => window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.45)));
    await page.waitForTimeout(250);
    await snapshot(page, `${vp.name}-mid-scroll`);
    const midMetrics = await collectMetrics(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
    await snapshot(page, `${vp.name}-bottom`);
    const bottomMetrics = await collectMetrics(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const clearPopconfirm = await openPopconfirm(page, '.traffic-control__actions .ant-btn:has-text("Clear")', `${vp.name}-clear-rate-limit`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
    const rowPopconfirm = await openPopconfirm(page, '.traffic-control__card .ant-table .ant-btn:has-text("Reset")', `${vp.name}-row-reset`);
    results.push({
      viewport: vp,
      topMetrics,
      midMetrics,
      bottomMetrics,
      clearPopconfirm,
      rowPopconfirm,
      consoleMessages,
    });
    await fs.promises.writeFile(path.join(outDir, `${vp.name}.json`), JSON.stringify(results[results.length - 1], null, 2));
    await context.close();
  }
  await browser.close();
  await fs.promises.writeFile(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`wrote ${outDir}`);
})();
