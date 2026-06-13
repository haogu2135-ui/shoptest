const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0520-admin-support-codex');
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
  'support',
  'support:reply',
  'support:assign',
  'support:close',
  'support:reopen',
  'support:read-state',
  'orders',
  'coupons:birthday-reissue',
];

const orderContext = {
  id: 8801,
  orderNo: 'SO-RETURN-20260608-00008801-LONG',
  status: 'RETURN_REQUESTED',
  totalAmount: 2386.75,
  paymentMethod: 'MERCADO_PAGO_INSTALLMENTS',
  createdAt: '2026-06-08T02:20:00Z',
};

const sessions = [
  {
    id: 7001,
    userId: 501,
    username: 'maria.customer.with.a.very.long.name.waiting.for.return.approval',
    assignedAdminId: 0,
    assignedAdminName: '',
    status: 'OPEN',
    unreadByAdmin: 5,
    lastMessage: `[ORDER]${JSON.stringify(orderContext)}`,
    lastMessageAt: '2026-06-08T04:40:00Z',
    createdAt: '2026-06-08T03:10:00Z',
    updatedAt: '2026-06-08T04:40:00Z',
  },
  {
    id: 7002,
    userId: 502,
    username: 'shipment-delay-customer',
    assignedAdminId: 910,
    assignedAdminName: 'system.audit.admin',
    status: 'OPEN',
    unreadByAdmin: 2,
    lastMessage: 'The tracking page has not moved for five days and the birthday coupon expires today.',
    lastMessageAt: '2026-06-08T04:20:00Z',
    createdAt: '2026-06-08T02:45:00Z',
    updatedAt: '2026-06-08T04:20:00Z',
  },
  {
    id: 7003,
    userId: 503,
    username: 'closed-case-review',
    assignedAdminId: 911,
    assignedAdminName: 'ops lead',
    status: 'CLOSED',
    unreadByAdmin: 0,
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
    senderName: 'Maria',
    content: 'I requested a return yesterday and need to know the next step before the carrier pickup window closes.',
    isReadByAdmin: false,
    createdAt: '2026-06-08T04:35:00Z',
  },
  {
    id: 90002,
    sessionId: 7001,
    senderRole: 'USER',
    senderName: 'Maria',
    content: `[ORDER]${JSON.stringify(orderContext)}`,
    isReadByAdmin: false,
    createdAt: '2026-06-08T04:36:00Z',
  },
  {
    id: 90003,
    sessionId: 7001,
    senderRole: 'USER',
    senderName: 'Maria',
    content: 'The item is unopened. Please confirm whether I should ship it back to the warehouse or wait for approval first.',
    isReadByAdmin: false,
    createdAt: '2026-06-08T04:40:00Z',
  },
];

const detailOrder = {
  id: orderContext.id,
  orderNo: orderContext.orderNo,
  userId: 501,
  customerUsername: sessions[0].username,
  totalAmount: orderContext.totalAmount,
  originalAmount: 2486.75,
  discountAmount: 100,
  shippingFee: 0,
  status: orderContext.status,
  paymentMethod: orderContext.paymentMethod,
  shippingAddress: '123 Long Return Address, Interior 42, Colonia Centro, Ciudad de Mexico, MX 01000',
  recipientName: 'Maria Long Customer',
  recipientPhone: '+52 55 1234 5678',
  createdAt: orderContext.createdAt,
};

const detailItems = [
  {
    id: 81001,
    orderId: orderContext.id,
    productId: 3001,
    quantity: 2,
    price: 899.5,
    productName: 'Premium orthopedic dog bed with washable cover and extra-long product naming for support modal stress',
    imageUrl: '/assets/placeholders/product.svg',
    selectedSpecs: 'Size: Large; Color: Charcoal',
  },
  {
    id: 81002,
    orderId: orderContext.id,
    productId: 3002,
    quantity: 1,
    price: 587.75,
    productName: 'Automatic feeder replacement motor kit',
    imageUrl: '/assets/placeholders/product.svg',
    selectedSpecs: 'Model: Pro',
  },
];

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
    body: JSON.stringify({ count: 7 }),
  }));

  await page.route('**/api/admin/support/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/api/admin/support/summary') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSessions: 3,
          openSessions: 2,
          closedSessions: 1,
          unreadSessions: 2,
          unreadMessages: 7,
          unassignedOpenSessions: 1,
          myOpenSessions: 1,
          staleOpenSessions: 1,
          staleMinutes: 30,
          responseScore: 42,
          checkedAt: '2026-06-08T05:20:00Z',
        }),
      });
    }
    if (url.pathname === '/api/admin/support/sessions' && method === 'GET') {
      const status = url.searchParams.get('status');
      const needsReply = url.searchParams.get('needsReply') === 'true';
      let items = sessions;
      if (status && status !== 'ALL') items = items.filter((item) => item.status === status);
      if (needsReply) items = items.filter((item) => Number(item.unreadByAdmin || 0) > 0);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          total: items.length,
          page: 1,
          size: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }),
      });
    }
    const sessionMessageMatch = url.pathname.match(/\/api\/admin\/support\/sessions\/(\d+)\/messages$/);
    if (sessionMessageMatch && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(messages) });
    }
    if (sessionMessageMatch && method === 'POST') {
      const body = await route.request().postDataJSON().catch(() => ({ content: '' }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            id: 90020,
            sessionId: 7001,
            senderRole: 'ADMIN',
            senderName: 'system.audit.admin',
            content: body.content || 'Reply',
            isReadByAdmin: true,
            createdAt: '2026-06-08T05:21:00Z',
          },
          session: { ...sessions[0], unreadByAdmin: 0, assignedAdminId: 910, assignedAdminName: 'system.audit.admin' },
        }),
      });
    }
    if (url.pathname.endsWith('/read')) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.endsWith('/assign')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...sessions[0], assignedAdminId: 910, assignedAdminName: 'system.audit.admin' }) });
    }
    if (url.pathname.endsWith('/close')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...sessions[0], status: 'CLOSED' }) });
    }
    if (url.pathname.endsWith('/reopen')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...sessions[2], status: 'OPEN' }) });
    }
    if (url.pathname.endsWith('/birthday-coupons/reissue')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ granted: 1 }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/api/admin/orders/*/items', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(detailItems),
  }));

  await page.route('**/api/admin/orders/*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(detailOrder),
  }));
}

async function waitForPage(page) {
  await page.waitForSelector('.support-management', { timeout: 30000 });
  await page.waitForSelector('.support-management__queueItem', { timeout: 30000 });
  await page.waitForTimeout(500);
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
        hitText: textOf(hit).slice(0, 140),
      };
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
          text: textOf(el).slice(0, 140),
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
    const buttons = Array.from(document.querySelectorAll('.support-management button, .support-management .ant-btn')).map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        text: textOf(el).slice(0, 80),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        visible: rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight,
      };
    });
    return {
      state: stateName,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollY: window.scrollY,
      },
      rects: {
        adminHeader: rectOf('.admin-layout__header'),
        pageHeader: rectOf('.support-management__header'),
        insight: rectOf('.support-management__insightBar'),
        insightStats: rectOf('.support-management__insightStats'),
        layout: rectOf('.support-management__layout'),
        queuePane: rectOf('.support-management__queuePane'),
        activeQueueItem: rectOf('.support-management__queueItem.is-active'),
        conversationPane: rectOf('.support-management__conversationPane'),
        conversationHeader: rectOf('.support-management__conversationHeader'),
        headerActions: rectOf('.support-management__conversationHeader > .ant-space:last-child'),
        messagesPane: rectOf('.support-management__messagesPane'),
        orderCard: rectOf('.support-management__orderCard'),
        orderWorkflow: rectOf('.support-management__orderWorkflow'),
        composer: rectOf('.support-management__composer'),
        replyReadiness: rectOf('.support-management__replyReadiness'),
        textarea: rectOf('.support-management__textarea textarea, .support-management textarea'),
        composerActions: rectOf('.support-management__composerActions'),
        modal: rectOf('.support-management__orderModal .ant-modal-content'),
        popup: rectOf('.ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
      },
      visibleRatios: {
        conversationPane: visibleRatioOf('.support-management__conversationPane'),
        conversationHeader: visibleRatioOf('.support-management__conversationHeader'),
        messagesPane: visibleRatioOf('.support-management__messagesPane'),
        orderWorkflow: visibleRatioOf('.support-management__orderWorkflow'),
        composer: visibleRatioOf('.support-management__composer'),
        modal: visibleRatioOf('.support-management__orderModal .ant-modal-content'),
        popup: visibleRatioOf('.ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
      },
      buttons,
      overflowEls,
      hits: [
        centerHit('.support-management__queueItem.is-active'),
        centerHit('.support-management__conversationHeader button'),
        centerHit('.support-management__orderLink'),
        centerHit('.support-management__composer button'),
        centerHit('.support-management__orderModal .ant-modal-close'),
        centerHit('.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons .ant-btn-primary'),
      ],
    };
  }, state);
}

async function capture(page, viewportName, stateName) {
  const metrics = await collectMetrics(page, stateName);
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}.png`), fullPage: false });
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}-full.png`), fullPage: true });
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
    await page.goto(`${baseUrl}/admin/support`, { waitUntil: 'networkidle' });
    await waitForPage(page);
    const states = [];
    states.push(await capture(page, viewport.name, 'top-unselected'));

    await page.locator('.support-management__queueItem').first().click();
    await page.waitForSelector('.support-management__conversationHeader', { timeout: 30000 });
    await page.waitForSelector('.support-management__orderCard', { timeout: 30000 });
    await page.waitForTimeout(400);
    states.push(await capture(page, viewport.name, 'selected-after-click'));

    await page.evaluate(() => {
      const conversation = document.querySelector('.support-management__conversationPane');
      if (conversation) conversation.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(250);
    states.push(await capture(page, viewport.name, 'selected-conversation-start'));

    await page.evaluate(() => {
      const pane = document.querySelector('.support-management__messagesPane');
      if (pane) pane.scrollTop = pane.scrollHeight;
      const composer = document.querySelector('.support-management__composer');
      if (composer) composer.scrollIntoView({ block: 'end' });
    });
    await page.waitForTimeout(250);
    states.push(await capture(page, viewport.name, 'composer'));

    const closeButton = page.locator('.support-management__conversationHeader button').filter({ hasText: /Close|关闭|Cerrar/ }).first();
    if (await closeButton.count()) {
      await closeButton.click();
      await page.waitForSelector('.ant-popover:not(.ant-popover-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      states.push(await capture(page, viewport.name, 'close-popconfirm'));
      await page.keyboard.press('Escape').catch(() => undefined);
    }

    await page.locator('.support-management__orderLink').first().click().catch(() => undefined);
    await page.waitForSelector('.support-management__orderModal .ant-modal-content', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    states.push(await capture(page, viewport.name, 'order-modal'));

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
