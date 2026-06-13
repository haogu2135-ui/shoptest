const { chromium } = require('./frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://127.0.0.1:4200';
const outDir = path.join(__dirname, 'app-ui-audit-20260608T0430-admin-logs-codex');
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
  id: 9201,
  username: 'ui-audit-admin',
  email: 'ui-audit@example.com',
  role: 'SUPER_ADMIN',
  roleCode: 'SUPER_ADMIN',
};

const permissions = [
  'dashboard',
  'logs',
  'logs:debug',
  'logs:download',
  'support',
];

const logStatus = {
  loggerName: 'com.example.shop.service.payment.VeryLongIncidentLoggerName',
  configuredLevel: 'INHERITED',
  effectiveLevel: 'INFO',
  debugEnabled: false,
  logDirectory: '/var/log/shoptest/backend/current/production/with/a/very/long/path/that/operators/need/to-copy',
  logFileName: 'shop-backend-production-2026-06-08.log',
  availableFiles: [
    'shop-backend-production-2026-06-08.log',
    'shop-backend-production-2026-06-07.log',
    'shop-backend-error-2026-06-08.log',
    'audit-security-incidents-2026-06.log',
  ],
  totalLogBytes: 98234123,
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
    if (method === 'GET' && pathname === '/admin/support/unread-count') return fulfillJson(route, { count: 1 });
    if (method === 'GET' && pathname === '/support/unread-count') return fulfillJson(route, { count: 0 });
    if (method === 'GET' && pathname === '/admin/logs') return fulfillJson(route, logStatus);
    if (method === 'PUT' && pathname === '/admin/logs/debug') return fulfillJson(route, { ...logStatus, debugEnabled: true, effectiveLevel: 'DEBUG' });
    if (method === 'GET' && pathname === '/admin/logs/download') {
      return route.fulfill({ status: 200, contentType: 'text/plain;charset=utf-8', body: '2026-06-08 04:30:00 INFO audit log sample\n' });
    }
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
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 260),
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
        visibility: style.visibility,
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
        '.log-management',
        '.log-management__hero',
        '.log-management__actions',
        '.log-management__stats',
        '.log-management__grid',
        '.log-management__control',
        '.log-management__switchRow',
        '.log-management__download',
        '.log-management__download .ant-picker',
        '.log-management__download .ant-space-compact',
        '.log-management__download .ant-select',
        '.log-management__download .ant-input',
        '.log-management__download .ant-btn',
        '.ant-picker-dropdown',
        '.ant-select-dropdown',
        '.ant-popover',
        '.shop-mobile-popup-layer',
      ].map(rectFor),
      buttons: allRects('.log-management .ant-btn, .log-management .ant-switch, .log-management .ant-picker, .log-management .ant-select-selector, .log-management .ant-input'),
      popovers: allRects('.ant-popover, .ant-picker-dropdown, .ant-select-dropdown, .shop-mobile-popup-layer'),
      hits: [
        centerHit('.log-management__switchRow .ant-switch'),
        centerHit('.log-management__download .ant-picker'),
        centerHit('.log-management__download .ant-select'),
        centerHit('.log-management__download .ant-input'),
        centerHit('.log-management__download .ant-btn'),
        centerHit('.ant-picker-dropdown'),
        centerHit('.ant-select-dropdown'),
        centerHit('.ant-popover'),
        hit(Math.round(window.innerWidth / 2), 70),
        hit(Math.round(window.innerWidth / 2), 120),
        hit(Math.round(window.innerWidth / 2), 180),
      ],
    };
  });
}

async function clickAndCapture(page, locator, label) {
  let clickError = null;
  try {
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(350);
  } catch (error) {
    clickError = String(error?.message || error).slice(0, 1200);
  }
  await screenshot(page, label);
  const state = await metrics(page);
  state.clickError = clickError;
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(4, 4).catch(() => {});
  await page.waitForTimeout(200);
  return state;
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
    await page.goto(`${baseUrl}/admin/logs`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.log-management', { timeout: 15000 });
    await page.waitForTimeout(500);
    await screenshot(page, `${vp.name}-top`);
    const top = await metrics(page);
    await page.locator('.log-management__download').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await screenshot(page, `${vp.name}-download-panel`);
    const downloadPanel = await metrics(page);
    const rangeOpen = await clickAndCapture(page, page.locator('.log-management__download .ant-picker').first(), `${vp.name}-range-open`);
    const levelOpen = await clickAndCapture(page, page.locator('.log-management__download .ant-select').first(), `${vp.name}-level-open`);
    const debugOpen = await clickAndCapture(page, page.locator('.log-management__switchRow .ant-switch').first(), `${vp.name}-debug-popconfirm`);
    results.push({ viewport: vp, states: { top, downloadPanel, rangeOpen, levelOpen, debugOpen } });
    await fs.promises.writeFile(path.join(outDir, `${vp.name}.json`), JSON.stringify(results[results.length - 1], null, 2));
    await context.close();
  }
  await browser.close();
  await fs.promises.writeFile(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  console.log(`wrote ${outDir}`);
})();
