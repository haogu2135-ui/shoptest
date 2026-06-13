const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0425-admin-orders-codex');
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
  'orders',
  'orders:export',
  'orders:status',
  'orders:fulfillment',
  'orders:payment',
  'orders:refund',
  'support',
];

const longAddress = '123 Long Return Address, Interior 42, Warehouse Gate B, Colonia Centro, Ciudad de Mexico, Mexico 01000 with delivery-note second-floor-security-desk';

const orders = [
  {
    id: 88010,
    orderNo: 'SO-REFUND-20260608-00008810-LONG',
    userId: 501,
    username: 'maria.customer.with.a.very.long.name',
    customerUsername: 'maria.customer.with.a.very.long.name',
    customerDisplayName: 'Maria customer waiting for return approval',
    customerType: 'REGISTERED',
    customerEmail: 'maria.long.customer@example.com',
    customerPhone: '+52 55 1234 5678',
    recipientName: 'Maria Long Customer',
    recipientPhone: '+52 55 1234 5678',
    contactEmail: 'maria.long.customer@example.com',
    shippingAddress: longAddress,
    totalAmount: 2386.75,
    originalAmount: 2486.75,
    discountAmount: 100,
    shippingFee: 0,
    status: 'RETURN_REQUESTED',
    paymentMethod: 'MERCADO_PAGO_INSTALLMENTS',
    trackingNumber: 'MX-RETURN-CUSTOMER-HANDOFF-20260608-00008810',
    trackingCarrierCode: 'DHL-MX',
    trackingCarrierName: 'DHL Mexico Express',
    returnReason: 'Customer reports unopened item and requests return before carrier pickup window closes; manual supervisor review required.',
    returnTrackingNumber: '',
    createdAt: '2026-06-07T02:20:00Z',
    updatedAt: '2026-06-08T03:55:00Z',
  },
  {
    id: 88011,
    orderNo: 'SO-SHIP-20260608-00008811-LONG',
    userId: 502,
    username: 'shipment-delay-customer',
    customerUsername: 'shipment-delay-customer',
    customerDisplayName: 'Shipment delay customer',
    customerType: 'GUEST',
    guestOrder: true,
    customerEmail: 'guest.shipment@example.com',
    recipientName: 'Guest Shipment Customer',
    recipientPhone: '+1 415 555 0101',
    contactEmail: 'guest.shipment@example.com',
    shippingAddress: '456 Fulfillment Avenue, Dock 7, San Jose, CA 95112',
    totalAmount: 149.98,
    status: 'PENDING_SHIPMENT',
    paymentMethod: 'STRIPE',
    createdAt: '2026-06-06T01:15:00Z',
    updatedAt: '2026-06-08T01:40:00Z',
  },
  {
    id: 88012,
    orderNo: 'SO-RETURN-SHIPPED-20260608-00008812',
    userId: 503,
    username: 'return-shipped-customer',
    customerDisplayName: 'Return shipped customer',
    customerType: 'REGISTERED',
    customerEmail: 'return.shipped@example.com',
    recipientName: 'Return Shipped Customer',
    recipientPhone: '+1 212 555 0199',
    shippingAddress: '789 Returns Lane, Brooklyn, NY 11201',
    totalAmount: 328.9,
    status: 'RETURN_SHIPPED',
    paymentMethod: 'PAYPAL',
    returnReason: 'Wrong size.',
    returnTrackingNumber: 'RET-TRACK-20260608-8812',
    createdAt: '2026-06-05T16:30:00Z',
    updatedAt: '2026-06-08T02:10:00Z',
  },
];

const items = [
  {
    id: 99001,
    orderId: 88010,
    productId: 3001,
    quantity: 2,
    price: 899.5,
    productName: 'Premium orthopedic dog bed with washable cover and extra-long product naming for order detail modal stress',
    selectedSpecs: 'Size: Large; Color: Charcoal; Warranty: Extended return service',
  },
  {
    id: 99002,
    orderId: 88010,
    productId: 3002,
    quantity: 1,
    price: 587.75,
    productName: 'Automatic feeder replacement motor kit',
    selectedSpecs: 'Model: Pro; Region: MX',
  },
];

const payments = [
  {
    id: 77001,
    orderId: 88010,
    orderNo: 'SO-REFUND-20260608-00008810-LONG',
    channel: 'MERCADO_PAGO_INSTALLMENTS',
    status: 'PAID',
    amount: 2386.75,
    transactionId: 'MP-TRANSACTION-20260608-00008810-VERY-LONG-REFERENCE',
    refundReference: '',
    createdAt: '2026-06-07T02:21:00Z',
  },
  {
    id: 77002,
    orderId: 88010,
    orderNo: 'SO-REFUND-20260608-00008810-LONG',
    channel: 'MANUAL_RECONCILIATION',
    status: 'RECONCILE_REQUIRED',
    amount: 2386.75,
    transactionId: 'OPS-RECONCILE-20260608-00008810-LONG',
    refundReference: 'MANUAL-REFUND-REVIEW-PENDING-20260608-00008810',
    createdAt: '2026-06-08T03:00:00Z',
  },
];

const carriers = [
  { id: 1, name: 'DHL Mexico Express', trackingCode: 'DHL-MX', active: true },
  { id: 2, name: 'FedEx International Priority', trackingCode: 'FDX-IP', active: true },
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
    body: JSON.stringify({ id: 910, username: 'order.audit.admin', role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', status: 'ACTIVE' }),
  }));

  await page.route('**/api/admin/me/permissions**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', permissions }),
  }));

  await page.route('**/api/admin/support/unread-count', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ count: 3 }),
  }));

  await page.route('**/api/admin/logistics-carriers**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(carriers),
  }));

  await page.route('**/api/admin/orders/page**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: orders,
      total: orders.length,
      page: 1,
      size: 20,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      summary: {
        NEEDS_ACTION: 3,
        SLA_OVERDUE: 2,
        SLA_DUE_SOON: 1,
        MISSING_TRACKING: 1,
        PENDING_SHIPMENT: 1,
        AFTER_SALES: 2,
        RETURN_REQUESTED: 1,
        RETURN_SHIPPED: 1,
        REFUNDING: 1,
        REFUNDED: 0,
      },
    }),
  }));

  await page.route('**/api/admin/orders/*/items', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(items),
  }));

  await page.route('**/api/admin/orders/*/payments', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payments),
  }));

  await page.route('**/api/admin/orders/*/status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));

  await page.route('**/api/admin/orders/*/refund', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'ok', payment: { ...payments[0], status: 'REFUNDED', refundReference: 'REFUND-20260608-0001' } }),
  }));

  await page.route('**/api/admin/orders/batch-ship', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: 1, failed: 0 }),
  }));
}

async function waitForPage(page) {
  await page.waitForSelector('.order-management-page', { timeout: 30000 });
  await page.waitForSelector('.order-management-page__table .ant-table-row', { timeout: 30000 });
  await page.waitForTimeout(600);
}

async function scrollMainTableToActions(page) {
  await page.evaluate(() => {
    const scroller = document.querySelector('.order-management-page__table .ant-table-content')
      || document.querySelector('.order-management-page__table');
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  });
  await page.waitForTimeout(250);
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
        text: textOf(el).slice(0, 220),
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
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
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
        hitText: textOf(hit).slice(0, 160),
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
          text: textOf(el).slice(0, 160),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
          overflowRight,
          overflowLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      })
      .filter(Boolean)
      .sort((left, right) => Math.max(right.overflowRight, right.overflowLeft) - Math.max(left.overflowRight, left.overflowLeft))
      .slice(0, 50);
    const summaryCards = Array.from(document.querySelectorAll('.order-management-page__summaryCard')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: textOf(el),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        right: rect.right,
        visibleRatio: rect.width && rect.height
          ? (Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))) / (rect.width * rect.height)
          : 0,
      };
    });
    const modalTables = Array.from(document.querySelectorAll('.ant-modal-content .ant-table-wrapper, .ant-modal-content .ant-table-content')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        selector: el.className ? `${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g, '.')}` : el.tagName.toLowerCase(),
        text: textOf(el).slice(0, 180),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowRight: rect.right - window.innerWidth,
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
        title: rectOf('.order-management-page > h4.ant-typography'),
        summaryGrid: rectOf('.order-management-page__summaryGrid'),
        toolbar: rectOf('.order-management-page__toolbar'),
        table: rectOf('.order-management-page__table'),
        tableContent: rectOf('.order-management-page__table .ant-table-content'),
        mainActionCell: rectOf('.order-management-page__table .ant-table-row:first-child .order-management-page__actions'),
        detailModal: rectOf('.order-management-page__detailModal .ant-modal-content'),
        detailBody: rectOf('.order-management-page__detailModal .ant-modal-body'),
        refundModal: rectOf('.order-management-page__refundModal .ant-modal-content'),
        refundBody: rectOf('.order-management-page__refundModal .ant-modal-body'),
        shippingModal: rectOf('.order-management-page__shippingModal .ant-modal-content'),
        popup: rectOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-confirm'),
      },
      visibleRatios: {
        summaryGrid: visibleRatioOf('.order-management-page__summaryGrid'),
        table: visibleRatioOf('.order-management-page__table'),
        mainActionCell: visibleRatioOf('.order-management-page__table .ant-table-row:first-child .order-management-page__actions'),
        detailModal: visibleRatioOf('.order-management-page__detailModal .ant-modal-content'),
        refundModal: visibleRatioOf('.order-management-page__refundModal .ant-modal-content'),
        shippingModal: visibleRatioOf('.order-management-page__shippingModal .ant-modal-content'),
        popup: visibleRatioOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-confirm'),
      },
      summaryCards,
      modalTables,
      overflowEls,
      hits: [
        centerHit('.order-management-page__table .ant-table-row:first-child .order-management-page__actions button'),
        centerHit('.order-management-page__detailModal .ant-modal-close'),
        centerHit('.order-management-page__refundModal .ant-modal-footer .ant-btn-primary'),
        centerHit('.order-management-page__refundModal .ant-table-wrapper'),
        centerHit('.order-management-page__shippingModal .ant-modal-footer .ant-btn-primary'),
        centerHit('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'),
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

async function closeAnyModal(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await page.locator('.ant-modal-close').last().click({ timeout: 1000 }).catch(() => undefined);
  await page.waitForTimeout(250);
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
    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: 'networkidle' });
    await waitForPage(page);
    const states = [];
    states.push(await capture(page, viewport.name, 'top'));

    await scrollMainTableToActions(page);
    states.push(await capture(page, viewport.name, 'table-actions'));

    await page.locator('.order-management-page__actions button').filter({ hasText: /Items|商品|Artículos/i }).first().click();
    await page.waitForSelector('.order-management-page__detailModal .ant-modal-content', { timeout: 10000 });
    await page.waitForTimeout(500);
    states.push(await capture(page, viewport.name, 'detail-modal'));
    await closeAnyModal(page);

    await scrollMainTableToActions(page);
    await page.locator('.order-management-page__actions button').filter({ hasText: /Refund now|退款|Reembolsar/i }).first().click();
    await page.waitForSelector('.order-management-page__refundModal .ant-modal-content', { timeout: 10000 });
    await page.waitForTimeout(500);
    states.push(await capture(page, viewport.name, 'refund-modal'));
    await closeAnyModal(page);

    await scrollMainTableToActions(page);
    const transition = page.locator('.order-management-page__transitionSelect').first();
    if (await transition.count()) {
      await transition.click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      states.push(await capture(page, viewport.name, 'transition-dropdown'));
      await page.keyboard.press('Escape').catch(() => undefined);
    }

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
