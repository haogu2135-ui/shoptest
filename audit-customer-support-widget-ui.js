const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0515-customer-support-widget-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'landscape-740', width: 740, height: 360 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
];

const orderContext = {
  id: 8801,
  orderNo: 'SO-CUSTOMER-20260608-00008801-LONG',
  status: 'RETURN_REQUESTED',
  totalAmount: 2386.75,
  paymentMethod: 'MERCADO_PAGO_INSTALLMENTS',
  createdAt: '2026-06-08T02:20:00Z',
};

const orders = [
  {
    ...orderContext,
    originalAmount: 2486.75,
    discountAmount: 100,
    shippingFee: 0,
    shippingAddress: '123 Long Return Address, Interior 42, Colonia Centro, Ciudad de Mexico, MX 01000',
    recipientName: 'Maria Long Customer',
    recipientPhone: '+52 55 1234 5678',
    returnable: true,
  },
  {
    id: 8802,
    orderNo: 'SO-CUSTOMER-20260608-00008802-DELAY',
    status: 'SHIPPED',
    totalAmount: 129.99,
    paymentMethod: 'STRIPE',
    trackingNumber: 'MX-TRACK-VERY-LONG-00008802',
    createdAt: '2026-06-07T18:45:00Z',
  },
];

const sessions = [
  {
    id: 7001,
    assignedAdminName: 'support.audit.agent',
    status: 'OPEN',
    unreadByUser: 0,
    lastMessage: `[ORDER]${JSON.stringify(orderContext)}`,
    lastMessageAt: '2026-06-08T04:40:00Z',
    createdAt: '2026-06-08T03:10:00Z',
    updatedAt: '2026-06-08T04:40:00Z',
  },
  {
    id: 7002,
    assignedAdminName: 'returns lead',
    status: 'CLOSED',
    unreadByUser: 0,
    lastMessage: 'Thanks, the refund arrived.',
    lastMessageAt: '2026-06-07T16:00:00Z',
    createdAt: '2026-06-07T13:00:00Z',
    updatedAt: '2026-06-07T16:00:00Z',
  },
];

const messages = [
  {
    id: 90001,
    sessionId: 7001,
    senderRole: 'USER',
    content: 'I requested a return yesterday and need to know the next step before the carrier pickup window closes.',
    isReadByUser: true,
    createdAt: '2026-06-08T04:35:00Z',
  },
  {
    id: 90002,
    sessionId: 7001,
    senderRole: 'USER',
    content: `[ORDER]${JSON.stringify(orderContext)}`,
    isReadByUser: true,
    createdAt: '2026-06-08T04:36:00Z',
  },
  {
    id: 90003,
    sessionId: 7001,
    senderRole: 'ADMIN',
    content: 'Please open the order detail in this chat so we can confirm the return address and item list.',
    isReadByUser: false,
    createdAt: '2026-06-08T04:40:00Z',
  },
];

const detailItems = [
  {
    id: 81001,
    productId: 3001,
    quantity: 2,
    price: 899.5,
    productName: 'Premium orthopedic dog bed with washable cover and extra-long product naming for support modal stress',
    imageUrl: '/assets/placeholders/product.svg',
    selectedSpecs: 'Size: Large; Color: Charcoal',
  },
  {
    id: 81002,
    productId: 3002,
    quantity: 1,
    price: 587.75,
    productName: 'Automatic feeder replacement motor kit',
    imageUrl: '/assets/placeholders/product.svg',
    selectedSpecs: 'Model: Pro',
  },
];

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installMocks(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname === '/api/auth/refresh') {
      return fulfillJson(route, { token: 'ui-audit-token', refreshToken: 'ui-audit-refresh-token' });
    }
    if (pathname === '/api/users/profile') {
      return fulfillJson(route, {
        id: 501,
        username: 'maria.customer.with.a.very.long.name',
        role: 'USER',
        roleCode: 'USER',
        status: 'ACTIVE',
      });
    }
    if (pathname === '/api/support/unread-count') {
      return fulfillJson(route, { count: 2 });
    }
    if (pathname === '/api/support/session' && method === 'POST') {
      return fulfillJson(route, sessions[0]);
    }
    if (pathname === '/api/support/sessions') {
      return fulfillJson(route, sessions);
    }
    const supportMessagesMatch = pathname.match(/^\/api\/support\/sessions\/(\d+)\/messages$/);
    if (supportMessagesMatch) {
      return fulfillJson(route, messages);
    }
    if (pathname === '/api/support/messages' && method === 'POST') {
      const body = await request.postDataJSON().catch(() => ({ content: '' }));
      return fulfillJson(route, {
        message: {
          id: 90020,
          sessionId: 7001,
          senderRole: 'USER',
          content: body.content || 'Reply',
          isReadByUser: true,
          createdAt: '2026-06-08T05:15:00Z',
        },
        session: sessions[0],
      });
    }
    if (/^\/api\/support\/sessions\/\d+\/read$/.test(pathname)) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (/^\/api\/support\/sessions\/\d+\/close$/.test(pathname)) {
      return fulfillJson(route, { ...sessions[0], status: 'CLOSED' });
    }
    if (pathname === '/api/orders/me') {
      return fulfillJson(route, orders);
    }
    const orderItemsMatch = pathname.match(/^\/api\/orders\/(\d+)\/items$/);
    if (orderItemsMatch) {
      return fulfillJson(route, detailItems);
    }
    const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
    if (orderMatch) {
      return fulfillJson(route, orders.find((item) => item.id === Number(orderMatch[1])) || orders[0]);
    }

    if (pathname.includes('/categories')) return fulfillJson(route, []);
    if (pathname.includes('/brands')) return fulfillJson(route, []);
    if (pathname.includes('/coupons')) return fulfillJson(route, []);
    if (pathname.includes('/cart')) return fulfillJson(route, []);
    if (pathname.includes('/products')) {
      return fulfillJson(route, { items: [], total: 0, page: 1, size: 12, totalPages: 0 });
    }
    return fulfillJson(route, {});
  });
}

async function waitForSupportOpen(page) {
  await page.waitForSelector('.app-support-launcher', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('shop:open-support'));
  });
  await page.waitForSelector('.customer-support-widget__panel', { timeout: 30000 });
  await page.waitForSelector('.customer-support-widget__orderCard', { timeout: 30000 });
  await page.waitForTimeout(600);
}

async function collectMetrics(page, state) {
  return page.evaluate((stateName) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const rectOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector,
        text: textOf(el).slice(0, 180),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    };
    const visibleRatioOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return rect.width && rect.height ? (width * height) / (rect.width * rect.height) : 0;
    };
    const hitAt = (selector, label, xFactor = 0.5, yFactor = 0.5) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width * xFactor));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height * yFactor));
      const hit = document.elementFromPoint(x, y);
      return {
        label,
        selector,
        point: { x, y },
        hitTag: hit?.tagName || null,
        hitClass: hit?.className ? String(hit.className) : '',
        hitText: textOf(hit).slice(0, 160),
        hitInsideTarget: Boolean(hit && el.contains(hit)),
        targetText: textOf(el).slice(0, 160),
      };
    };
    const stackAtCenter = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const stack = document.elementsFromPoint(x, y).slice(0, 8).map((item) => ({
        tag: item.tagName,
        className: item.className ? String(item.className) : '',
        text: textOf(item).slice(0, 120),
      }));
      return { selector, point: { x, y }, stack };
    };
    const zOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return window.getComputedStyle(el).zIndex;
    };
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
      .slice(0, 30);

    return {
      state: stateName,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      url: window.location.href,
      bodyClasses: document.body.className,
      body: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollY: window.scrollY,
      },
      zIndexes: {
        panel: zOf('.customer-support-widget__panel'),
        backdrop: zOf('.customer-support-widget__backdrop'),
        modalRoot: zOf('.ant-modal-root'),
        modalMask: zOf('.ant-modal-mask'),
        modalWrap: zOf('.ant-modal-wrap'),
        modal: zOf('.customer-support-widget__orderModal'),
        modalContent: zOf('.customer-support-widget__orderModal .ant-modal-content'),
        selectPopup: zOf('.support-order-select-popup'),
      },
      rects: {
        navBottom: rectOf('.shop-nav__bottomBar'),
        supportPanel: rectOf('.customer-support-widget__panel'),
        supportBackdrop: rectOf('.customer-support-widget__backdrop'),
        header: rectOf('.customer-support-widget__header'),
        sessionPicker: rectOf('.customer-support-widget__sessionPicker'),
        messages: rectOf('.customer-support-widget__messages'),
        orderCard: rectOf('.customer-support-widget__orderCard'),
        viewOrderButton: rectOf('.customer-support-widget__linkButton'),
        composer: rectOf('.customer-support-widget__composer'),
        orderSelect: rectOf('.customer-support-widget__orderSelect'),
        actions: rectOf('.customer-support-widget__actions'),
        modalRoot: rectOf('.ant-modal-root'),
        modalMask: rectOf('.ant-modal-mask'),
        modalWrap: rectOf('.ant-modal-wrap'),
        modal: rectOf('.customer-support-widget__orderModal'),
        modalContent: rectOf('.customer-support-widget__orderModal .ant-modal-content'),
        modalBody: rectOf('.customer-support-widget__orderModal .ant-modal-body'),
        modalClose: rectOf('.customer-support-widget__orderModal .ant-modal-close'),
        selectPopup: rectOf('.support-order-select-popup'),
        selectOption: rectOf('.support-order-select-popup .ant-select-item-option-content'),
      },
      visibleRatios: {
        supportPanel: visibleRatioOf('.customer-support-widget__panel'),
        messages: visibleRatioOf('.customer-support-widget__messages'),
        composer: visibleRatioOf('.customer-support-widget__composer'),
        modalContent: visibleRatioOf('.customer-support-widget__orderModal .ant-modal-content'),
        modalClose: visibleRatioOf('.customer-support-widget__orderModal .ant-modal-close'),
        selectPopup: visibleRatioOf('.support-order-select-popup'),
        selectOption: visibleRatioOf('.support-order-select-popup .ant-select-item-option-content'),
      },
      hits: [
        hitAt('.customer-support-widget__panel', 'panel-center'),
        hitAt('.customer-support-widget__linkButton', 'view-order-button-center'),
        hitAt('.customer-support-widget__orderSelect', 'order-select-center'),
        hitAt('.support-order-select-popup .ant-select-item-option-content', 'select-option-center'),
        hitAt('.customer-support-widget__orderModal .ant-modal-content', 'modal-content-center'),
        hitAt('.customer-support-widget__orderModal .ant-modal-close', 'modal-close-center'),
        hitAt('.customer-support-widget__orderModal .ant-modal-body', 'modal-body-center'),
      ],
      stacks: {
        modalContent: stackAtCenter('.customer-support-widget__orderModal .ant-modal-content'),
        modalClose: stackAtCenter('.customer-support-widget__orderModal .ant-modal-close'),
        selectOption: stackAtCenter('.support-order-select-popup .ant-select-item-option-content'),
      },
      overflowEls,
    };
  }, state);
}

async function capture(page, viewportName, stateName) {
  const metrics = await collectMetrics(page, stateName);
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}.png`), fullPage: false });
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}-full.png`), fullPage: true });
  return metrics;
}

async function openOrderSelect(page) {
  await page.locator('.customer-support-widget__orderSelect').click({ timeout: 10000 });
  await page.waitForSelector('.support-order-select-popup', { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function openOrderDetail(page) {
  const viewOrder = page.locator('.customer-support-widget__linkButton').first();
  await viewOrder.scrollIntoViewIfNeeded().catch(() => undefined);
  await viewOrder.click({ timeout: 10000 });
  await page.waitForSelector('.customer-support-widget__orderModal .ant-modal-content', { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await installMocks(page);
    await page.addInitScript(() => {
      window.__SHOP_RUNTIME_CONFIG__ = {
        apiBaseUrl: '/api',
        supportWebSocketUrl: '/ws/support',
        apiGatewayEnabled: false,
        apiGatewayPrefix: '/gateway',
      };
      localStorage.setItem('token', 'ui-audit-token');
      localStorage.setItem('refreshToken', 'ui-audit-refresh-token');
      localStorage.setItem('userId', '501');
      localStorage.setItem('role', 'USER');
    });
    const consoleMessages = [];
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForSupportOpen(page);
    const states = [];
    states.push(await capture(page, viewport.name, 'support-open'));

    await openOrderSelect(page);
    states.push(await capture(page, viewport.name, 'order-select-open'));
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(250);

    await openOrderDetail(page);
    states.push(await capture(page, viewport.name, 'order-modal-open'));

    report.push({ viewport, url: page.url(), consoleMessages, states });
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
