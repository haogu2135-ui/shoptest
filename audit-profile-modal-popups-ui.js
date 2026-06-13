const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0501-profile-modal-popups-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'landscape-740', width: 740, height: 360 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
];

const profile = {
  id: 501,
  username: 'profile.ui.audit',
  email: 'profile.audit@example.com',
  phone: '+5255550100',
  role: 'USER',
  roleCode: 'USER',
  status: 'ACTIVE',
};

const addresses = [
  {
    id: 701,
    recipientName: 'Mariana Long Recipient Name',
    phone: '+52 55 5555 0101',
    address: 'Mexico / Ciudad de Mexico / Coyoacan / Av Universidad 3000, interior 1208, long delivery note',
    isDefault: true,
  },
  {
    id: 702,
    recipientName: 'Backup Pickup Desk',
    phone: '+52 55 5555 0102',
    address: 'Mexico / Jalisco / Guadalajara / Long secondary address used to exercise profile cards',
    isDefault: false,
  },
];

const pets = [
  {
    id: 801,
    name: 'Nube',
    petType: 'DOG',
    breed: 'Senior mixed breed with a long breed label',
    birthday: '',
    weight: 18.4,
    size: 'MEDIUM',
  },
  {
    id: 802,
    name: 'Luna',
    petType: 'CAT',
    breed: '',
    birthday: '2021-02-14',
    weight: 4.2,
    size: '',
  },
];

const orders = [
  {
    id: 901,
    orderNo: 'PROF-UI-20260608-PENDING-PAYMENT-LONG',
    status: 'PENDING_PAYMENT',
    totalAmount: 168.88,
    originalAmount: 188.88,
    discountAmount: 20,
    shippingFee: 0,
    paymentMethod: 'STRIPE',
    shippingAddress: addresses[0].address,
    createdAt: '2026-06-08T02:10:00Z',
  },
  {
    id: 902,
    orderNo: 'PROF-UI-20260608-SHIPPED',
    status: 'SHIPPED',
    totalAmount: 78.5,
    originalAmount: 78.5,
    shippingFee: 5,
    paymentMethod: 'PAYPAL',
    trackingNumber: 'TRACK-LONG-000000123456789',
    trackingCarrierCode: 'DHL',
    shippingAddress: addresses[1].address,
    createdAt: '2026-06-07T18:10:00Z',
  },
];

const orderItems = [
  {
    id: 1001,
    productId: 3001,
    productName: 'Premium orthopedic recovery dog bed with washable cover',
    quantity: 1,
    price: 168.88,
    imageUrl: 'https://example.com/dog-bed.jpg',
    selectedSpecs: { Size: 'Large', Color: 'Sage' },
  },
];

const paymentChannels = [
  { code: 'STRIPE', name: 'Stripe card', status: 'ACTIVE', recommended: true },
  { code: 'PAYPAL', name: 'PayPal wallet', status: 'ACTIVE' },
  { code: 'BANK_TRANSFER', name: 'Bank transfer with very long channel name', status: 'ACTIVE' },
];

async function fulfillJson(route, body) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installMocks(page) {
  await page.route('**/api/**', (route) => fulfillJson(route, {}));
  await page.route('**/api/auth/refresh', (route) => fulfillJson(route, {
    token: 'profile-ui-audit-token',
    refreshToken: 'profile-ui-audit-refresh-token',
  }));
  await page.route('**/api/users/profile**', (route) => fulfillJson(route, profile));
  await page.route('**/api/users/email-code/config**', (route) => fulfillJson(route, { enabled: false, ttlMinutes: 10 }));
  await page.route('**/api/orders/*/items**', (route) => fulfillJson(route, orderItems));
  await page.route('**/api/orders/me**', (route) => fulfillJson(route, orders));
  await page.route('**/api/addresses/me**', (route) => fulfillJson(route, addresses));
  await page.route('**/api/pet-profiles**', (route) => fulfillJson(route, pets));
  await page.route('**/api/payments/channels**', (route) => fulfillJson(route, paymentChannels));
  await page.route('**/api/payments/order/**', (route) => fulfillJson(route, {
    id: 1201,
    orderId: 901,
    orderNo: orders[0].orderNo,
    amount: orders[0].totalAmount,
    status: 'PENDING',
    channel: 'STRIPE',
  }));
  await page.route('**/api/cart/**', (route) => fulfillJson(route, []));
  await page.route('**/api/wishlist/**', (route) => fulfillJson(route, []));
  await page.route('**/api/notifications/**', (route) => fulfillJson(route, { count: 0, items: [] }));
  await page.route('**/api/app-config**', (route) => fulfillJson(route, {}));
}

async function waitForProfile(page) {
  await page.waitForSelector('.profile-page', { timeout: 30000 });
  await page.waitForSelector('.profile-tabs', { timeout: 30000 });
  await page.waitForTimeout(650);
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
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        zIndex: style.zIndex,
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
        hitText: textOf(hit).slice(0, 220),
      };
    };
    const optionRows = Array.from(document.querySelectorAll(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option, .ant-cascader-dropdown .ant-cascader-menu-item, .ant-picker-dropdown .ant-picker-cell-in-view',
    )).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: textOf(el).slice(0, 120),
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
    }).slice(0, 80);
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
        };
      })
      .filter(Boolean)
      .slice(0, 80);
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
        page: rectOf('.profile-page'),
        tabs: rectOf('.profile-tabs > .ant-tabs-nav'),
        addressReadiness: rectOf('.profile-address-readiness'),
        petInsights: rectOf('.profile-pet-insights'),
        modal: rectOf('.profile-mobile-safe-modal .ant-modal-content'),
        addressModal: rectOf('.profile-address-modal .ant-modal-content'),
        modalBody: rectOf('.profile-mobile-safe-modal .ant-modal-body'),
        addressModalBody: rectOf('.profile-address-modal .ant-modal-body'),
        modalFooter: rectOf('.profile-mobile-safe-modal .ant-modal-footer'),
        addressModalFooter: rectOf('.profile-address-modal .ant-modal-footer'),
        addressCascader: rectOf('.profile-address-modal .ant-cascader'),
        petTypeSelect: rectOf('.profile-mobile-safe-modal .ant-select'),
        petDatePicker: rectOf('.profile-pet-modal__field.ant-picker'),
        petSizeSelect: rectOf('.profile-mobile-safe-modal .ant-form-item:last-child .ant-select'),
        selectDropdown: rectOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
        cascaderDropdown: rectOf('.ant-cascader-dropdown'),
        pickerDropdown: rectOf('.ant-picker-dropdown'),
        popup: rectOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-cascader-dropdown, .ant-picker-dropdown'),
      },
      visibleRatios: {
        modal: visibleRatioOf('.profile-mobile-safe-modal .ant-modal-content'),
        modalBody: visibleRatioOf('.profile-mobile-safe-modal .ant-modal-body'),
        modalFooter: visibleRatioOf('.profile-mobile-safe-modal .ant-modal-footer'),
        addressCascader: visibleRatioOf('.profile-address-modal .ant-cascader'),
        petDatePicker: visibleRatioOf('.profile-pet-modal__field.ant-picker'),
        selectDropdown: visibleRatioOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
        cascaderDropdown: visibleRatioOf('.ant-cascader-dropdown'),
        pickerDropdown: visibleRatioOf('.ant-picker-dropdown'),
        popup: visibleRatioOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-cascader-dropdown, .ant-picker-dropdown'),
      },
      optionRows,
      overflowEls,
      hits: [
        centerHit('.ant-cascader-dropdown .ant-cascader-menu-item'),
        centerHit('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'),
        centerHit('.ant-picker-dropdown .ant-picker-cell-in-view'),
        centerHit('.profile-address-modal .ant-cascader'),
        centerHit('.profile-pet-modal__field.ant-picker'),
        centerHit('.profile-mobile-safe-modal .ant-modal-footer .ant-btn-primary'),
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

async function goProfile(page, tab) {
  await page.goto(`${baseUrl}/profile?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await waitForProfile(page);
}

async function openAddressModal(page) {
  await page.locator('.profile-block-button.profile-section-action').first().evaluate((button) => button.click());
  await page.waitForSelector('.profile-address-modal .ant-modal-content', { timeout: 10000 });
  await page.waitForTimeout(350);
}

async function openPetModal(page) {
  await page.locator('.profile-block-button.profile-section-action').first().evaluate((button) => button.click());
  await page.waitForSelector('.profile-mobile-safe-modal .ant-modal-content', { timeout: 10000 });
  await page.waitForTimeout(350);
}

async function scrollModalTo(page, modalBodySelector, targetSelector) {
  await page.evaluate(({ modalBodySelector: bodySelector, targetSelector: target }) => {
    const body = document.querySelector(bodySelector);
    const element = document.querySelector(target);
    if (!body || !element) return;
    const bodyRect = body.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    body.scrollTop += targetRect.top - bodyRect.top - 18;
  }, { modalBodySelector, targetSelector });
  await page.waitForTimeout(300);
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await installMocks(page);
    await page.addInitScript(() => {
      localStorage.setItem('token', 'profile-ui-audit-token');
      localStorage.setItem('refreshToken', 'profile-ui-audit-refresh-token');
      localStorage.setItem('role', 'USER');
      localStorage.setItem('shop-language', 'en');
    });
    const consoleMessages = [];
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    const states = [];
    await goProfile(page, 'addresses');
    states.push(await capture(page, viewport.name, 'addresses-top', true));
    await openAddressModal(page);
    states.push(await capture(page, viewport.name, 'address-modal-open', true));
    await scrollModalTo(page, '.profile-address-modal .ant-modal-body', '.profile-address-modal .ant-cascader');
    await page.locator('.profile-address-modal .ant-cascader').click();
    await page.waitForSelector('.ant-cascader-dropdown', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    states.push(await capture(page, viewport.name, 'address-region-cascader', true));

    await goProfile(page, 'pets');
    states.push(await capture(page, viewport.name, 'pets-top', true));
    await openPetModal(page);
    states.push(await capture(page, viewport.name, 'pet-modal-open', true));
    const petSelects = page.locator('.profile-mobile-safe-modal .ant-select');
    if (await petSelects.count()) {
      await petSelects.first().click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      states.push(await capture(page, viewport.name, 'pet-type-select', true));
    }

    await goProfile(page, 'pets');
    await openPetModal(page);
    await scrollModalTo(page, '.profile-mobile-safe-modal .ant-modal-body', '.profile-pet-modal__field.ant-picker');
    await page.locator('.profile-pet-modal__field.ant-picker').click();
    await page.waitForSelector('.ant-picker-dropdown', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    states.push(await capture(page, viewport.name, 'pet-birthday-picker', true));

    await goProfile(page, 'pets');
    await openPetModal(page);
    await scrollModalTo(page, '.profile-mobile-safe-modal .ant-modal-body', '.profile-mobile-safe-modal .ant-form-item:last-child .ant-select');
    const freshPetSelects = page.locator('.profile-mobile-safe-modal .ant-select');
    if ((await freshPetSelects.count()) > 1) {
      await freshPetSelects.nth(1).click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      states.push(await capture(page, viewport.name, 'pet-size-select', true));
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
