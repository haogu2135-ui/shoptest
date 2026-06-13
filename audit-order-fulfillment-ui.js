const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0423-admin-order-fulfillment-codex');
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

const orders = [
  {
    id: 88110,
    orderNo: 'SO-SHIP-20260608-000088110-LONG-FULFILLMENT',
    userId: 701,
    username: 'long.fulfillment.customer.waiting.for.shipment',
    customerUsername: 'long.fulfillment.customer.waiting.for.shipment',
    customerDisplayName: 'Long Fulfillment Customer Waiting For Shipment',
    customerType: 'REGISTERED',
    customerEmail: 'long.fulfillment.customer@example.com',
    customerPhone: '+1 415 555 0101',
    recipientName: 'Long Fulfillment Customer',
    recipientPhone: '+1 415 555 0101',
    contactEmail: 'long.fulfillment.customer@example.com',
    shippingAddress: '456 Fulfillment Avenue, Dock 7, South Warehouse Gate, San Jose, CA 95112 with fragile-handling note and long receiving-office instructions',
    totalAmount: 149.98,
    status: 'PENDING_SHIPMENT',
    paymentMethod: 'STRIPE',
    createdAt: '2026-06-06T01:15:00Z',
    updatedAt: '2026-06-08T01:40:00Z',
  },
  {
    id: 88111,
    orderNo: 'SO-SHIP-20260608-000088111-BATCH',
    userId: 702,
    username: 'batch.ship.customer',
    customerDisplayName: 'Batch Ship Customer',
    customerType: 'GUEST',
    guestOrder: true,
    customerEmail: 'batch.ship.customer@example.com',
    recipientName: 'Batch Ship Customer',
    recipientPhone: '+1 212 555 0199',
    contactEmail: 'batch.ship.customer@example.com',
    shippingAddress: '789 Batch Lane, Brooklyn, NY 11201',
    totalAmount: 328.9,
    status: 'PENDING_SHIPMENT',
    paymentMethod: 'PAYPAL',
    createdAt: '2026-06-05T16:30:00Z',
    updatedAt: '2026-06-08T02:10:00Z',
  },
  {
    id: 88112,
    orderNo: 'SO-TRACK-20260608-000088112-LONG',
    userId: 703,
    username: 'tracking.customer.with.long.reference',
    customerDisplayName: 'Tracking Customer With Long Reference',
    customerType: 'REGISTERED',
    customerEmail: 'tracking.customer@example.com',
    recipientName: 'Tracking Customer',
    recipientPhone: '+1 650 555 0170',
    shippingAddress: '200 Tracking Road, Austin, TX 73301',
    totalAmount: 2386.75,
    status: 'SHIPPED',
    paymentMethod: 'MERCADO_PAGO_INSTALLMENTS',
    trackingNumber: 'LONG-CARRIER-TRACKING-NUMBER-20260608-000088112-EXTRA-LONG',
    trackingCarrierCode: 'LONG-CARRIER-CODE-INTL-EXPRESS',
    trackingCarrierName: 'International Express Carrier With Very Long Name',
    createdAt: '2026-06-07T02:20:00Z',
    updatedAt: '2026-06-08T03:55:00Z',
  },
];

const items = [
  {
    id: 99110,
    orderId: 88110,
    productId: 4001,
    quantity: 2,
    price: 74.99,
    productName: 'Fulfillment stress product with long label instructions',
    selectedSpecs: 'Size: Large; Color: Blue; Packing: Fragile',
  },
];

const carriers = [
  { id: 1, name: 'International Express Carrier With Very Long Name', trackingCode: 'LONG-CARRIER-CODE-INTL-EXPRESS', active: true },
  { id: 2, name: 'FedEx International Priority', trackingCode: 'FDX-IP', active: true },
  { id: 3, name: 'DHL Mexico Express', trackingCode: 'DHL-MX', active: true },
];

const logisticsResult = {
  trackingNumber: 'LONG-CARRIER-TRACKING-NUMBER-20260608-000088112-EXTRA-LONG',
  carrier: 'LONG-CARRIER-CODE-INTL-EXPRESS',
  status: 'IN_TRANSIT',
  summary: 'The parcel is moving through a long-haul transfer hub and still needs manual customs review before final-mile dispatch.',
  events: [
    {
      time: '2026-06-08T02:45:00Z',
      location: 'International transfer hub with an unusually long facility name, Zone 12, Dock 408',
      description: 'Customs review started for multi-item pet care shipment with extended documentation notes.',
    },
    {
      time: '2026-06-07T19:20:00Z',
      location: 'Origin warehouse south fulfillment dock',
      description: 'Shipment picked up by carrier.',
    },
  ],
};

async function fulfillJson(route, body) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installMocks(page) {
  await page.route('**/api/auth/refresh', (route) => fulfillJson(route, {
    token: 'ui-audit-token',
    refreshToken: 'ui-audit-refresh-token',
  }));

  await page.route('**/api/users/profile**', (route) => fulfillJson(route, {
    id: 910,
    username: 'order.fulfillment.audit.admin',
    role: 'SUPER_ADMIN',
    roleCode: 'SUPER_ADMIN',
    status: 'ACTIVE',
  }));

  await page.route('**/api/admin/me/permissions**', (route) => fulfillJson(route, {
    role: 'SUPER_ADMIN',
    roleCode: 'SUPER_ADMIN',
    permissions,
  }));

  await page.route('**/api/admin/support/unread-count', (route) => fulfillJson(route, { count: 2 }));
  await page.route('**/api/admin/logistics-carriers**', (route) => fulfillJson(route, carriers));
  await page.route('**/api/admin/orders/*/items', (route) => fulfillJson(route, items));
  await page.route('**/api/admin/orders/*/payments', (route) => fulfillJson(route, []));
  await page.route('**/api/admin/orders/*/status', (route) => fulfillJson(route, { ok: true }));
  await page.route('**/api/admin/orders/batch-ship', (route) => fulfillJson(route, { success: 2, failed: 0 }));
  await page.route('**/api/logistics/track**', (route) => fulfillJson(route, logisticsResult));
  await page.route('**/api/admin/orders/page**', (route) => fulfillJson(route, {
    items: orders,
    total: orders.length,
    page: 1,
    size: 20,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
    summary: {
      NEEDS_ACTION: 2,
      SLA_OVERDUE: 1,
      SLA_DUE_SOON: 1,
      MISSING_TRACKING: 0,
      PENDING_SHIPMENT: 2,
      AFTER_SALES: 0,
      RETURN_REQUESTED: 0,
      RETURN_SHIPPED: 0,
      REFUNDING: 0,
      REFUNDED: 0,
    },
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
        text: textOf(el).slice(0, 260),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
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
        hitText: textOf(hit).slice(0, 180),
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
          text: textOf(el).slice(0, 180),
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
      .slice(0, 40);
    const buttons = Array.from(document.querySelectorAll('.ant-modal-content .ant-btn, .order-management-page__toolbar .ant-btn, .order-management-page__actions .ant-btn')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: textOf(el),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    const optionRows = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: textOf(el),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        visibleRatio: rect.width && rect.height
          ? (Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))) / (rect.width * rect.height)
          : 0,
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
        table: rectOf('.order-management-page__table'),
        tableContent: rectOf('.order-management-page__table .ant-table-content'),
        batchButton: rectOf('.order-management-page__toolbar .ant-btn-primary'),
        rowSelection: rectOf('.shop-admin-selection-table .ant-table-selection-column'),
        actionCell: rectOf('.order-management-page__table .ant-table-row:first-child .order-management-page__actions'),
        shippingModal: rectOf('.order-management-page__shippingModal .ant-modal-content'),
        shippingBody: rectOf('.order-management-page__shippingModal .ant-modal-body'),
        shippingCarrier: rectOf('.order-management-page__shippingModal .ant-select'),
        shippingInput: rectOf('.order-management-page__shippingModal input'),
        shippingCheckbox: rectOf('.order-management-page__shippingModal .ant-checkbox-wrapper'),
        batchModal: rectOf('.order-management-page__batchShipModal .ant-modal-content'),
        batchBody: rectOf('.order-management-page__batchShipModal .ant-modal-body'),
        batchHint: rectOf('.order-management-page__batchShipModal p'),
        batchInput: rectOf('.order-management-page__batchShipModal input'),
        batchCarrier: rectOf('.order-management-page__batchShipModal .ant-select'),
        trackingModal: rectOf('.order-management-page__trackingModal .ant-modal-content'),
        trackingBody: rectOf('.order-management-page__trackingModal .ant-modal-body'),
        trackingWidget: rectOf('.seventeen-track-widget'),
        trackingSearch: rectOf('.seventeen-track-widget__search'),
        trackingResults: rectOf('.seventeen-track-widget__results'),
        trackingSummary: rectOf('.seventeen-track-widget__summary'),
        trackingEvents: rectOf('.seventeen-track-widget__events'),
        dropdown: rectOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
        modalConfirm: rectOf('.ant-modal-confirm'),
      },
      visibleRatios: {
        actionCell: visibleRatioOf('.order-management-page__table .ant-table-row:first-child .order-management-page__actions'),
        shippingModal: visibleRatioOf('.order-management-page__shippingModal .ant-modal-content'),
        shippingCarrier: visibleRatioOf('.order-management-page__shippingModal .ant-select'),
        shippingInput: visibleRatioOf('.order-management-page__shippingModal input'),
        shippingCheckbox: visibleRatioOf('.order-management-page__shippingModal .ant-checkbox-wrapper'),
        batchModal: visibleRatioOf('.order-management-page__batchShipModal .ant-modal-content'),
        batchInput: visibleRatioOf('.order-management-page__batchShipModal input'),
        batchCarrier: visibleRatioOf('.order-management-page__batchShipModal .ant-select'),
        trackingModal: visibleRatioOf('.order-management-page__trackingModal .ant-modal-content'),
        trackingResults: visibleRatioOf('.seventeen-track-widget__results'),
        dropdown: visibleRatioOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
        modalConfirm: visibleRatioOf('.ant-modal-confirm'),
      },
      buttons,
      optionRows,
      overflowEls,
      hits: [
        centerHit('.order-management-page__shippingModal .ant-select'),
        centerHit('.order-management-page__shippingModal .ant-modal-footer .ant-btn-primary'),
        centerHit('.order-management-page__batchShipModal .ant-select'),
        centerHit('.order-management-page__batchShipModal .ant-modal-footer .ant-btn-primary'),
        centerHit('.seventeen-track-widget__search .ant-btn'),
        centerHit('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'),
      ],
    };
  }, state);
}

async function capture(page, viewportName, stateName, fullPage = false) {
  const metrics = await collectMetrics(page, stateName);
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}.png`), fullPage: false });
  if (fullPage) {
    await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}-full.png`), fullPage: true });
  }
  return metrics;
}

async function closeAnyModal(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(200);
  await page.locator('.ant-modal-close').last().click({ timeout: 1000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

async function openShippingModal(page) {
  await scrollMainTableToActions(page);
  const shipRow = page.locator('.order-management-page__table .ant-table-tbody .ant-table-row').nth(0);
  await shipRow.locator('.order-management-page__transitionSelect').click();
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 });
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: /Shipped|已发货|Enviado/i }).first().click();
  await page.waitForSelector('.order-management-page__shippingModal .ant-modal-content', { timeout: 10000 });
  await page.waitForTimeout(350);
}

async function openBatchShipModal(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPage(page);
  await page.evaluate(() => {
    const scroller = document.querySelector('.order-management-page__table .ant-table-content');
    if (scroller) scroller.scrollLeft = 0;
  });
  await page.waitForTimeout(200);
  const firstCheckbox = page.locator('.shop-admin-selection-table .ant-table-tbody .ant-checkbox-wrapper').first();
  const secondCheckbox = page.locator('.shop-admin-selection-table .ant-table-tbody .ant-checkbox-wrapper').nth(1);
  await firstCheckbox.click({ force: true });
  await secondCheckbox.click({ force: true });
  await page.waitForTimeout(250);
  await page.locator('.order-management-page__toolbar .ant-btn-primary').filter({ hasText: /Batch ship|批量发货|Enviar lote/i }).first().click();
  await page.waitForSelector('.order-management-page__batchShipModal .ant-modal-content', { timeout: 10000 });
  await page.waitForTimeout(350);
}

async function openTrackingModal(page) {
  await scrollMainTableToActions(page);
  const trackRow = page.locator('.order-management-page__table .ant-table-tbody .ant-table-row').nth(2);
  await trackRow.locator('button').filter({ hasText: /^Track$|^追踪$|^Rastrear$/i }).first().click();
  await page.waitForSelector('.order-management-page__trackingModal .ant-modal-content', { timeout: 10000 });
  await page.waitForSelector('.seventeen-track-widget__results', { timeout: 10000 });
  await page.waitForTimeout(900);
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

    await openShippingModal(page);
    states.push(await capture(page, viewport.name, 'shipping-modal', true));
    await page.locator('.order-management-page__shippingModal .ant-select').click();
    await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 });
    await page.waitForTimeout(250);
    states.push(await capture(page, viewport.name, 'shipping-carrier-dropdown', true));
    await closeAnyModal(page);

    await openBatchShipModal(page);
    states.push(await capture(page, viewport.name, 'batch-ship-modal', true));
    await page.locator('.order-management-page__batchShipModal .ant-select').click();
    await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 });
    await page.waitForTimeout(250);
    states.push(await capture(page, viewport.name, 'batch-carrier-dropdown', true));
    await closeAnyModal(page);

    await openTrackingModal(page);
    states.push(await capture(page, viewport.name, 'tracking-modal', true));
    await closeAnyModal(page);

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
