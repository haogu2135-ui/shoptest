const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T-profile-support-app-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320-app', width: 320, height: 568 },
  { name: 'phone-390-app', width: 390, height: 844 },
];
const requestedViewportNames = String(process.env.SHOPTEST_MOBILE_APP_VIEWPORTS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const viewportsToRun = requestedViewportNames.length
  ? viewports.filter((viewport) => requestedViewportNames.includes(viewport.name))
  : viewports;

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

const supportOrder = {
  id: 8801,
  orderNo: 'SO-CUSTOMER-20260608-00008801-LONG',
  status: 'RETURN_REQUESTED',
  totalAmount: 2386.75,
  paymentMethod: 'MERCADO_PAGO_INSTALLMENTS',
  createdAt: '2026-06-08T02:20:00Z',
  shippingAddress: '123 Long Return Address, Interior 42, Colonia Centro, Ciudad de Mexico, MX 01000',
  recipientName: 'Maria Long Customer',
  recipientPhone: '+52 55 1234 5678',
  returnable: true,
};

const supportOrders = [
  supportOrder,
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

const supportSessions = [
  {
    id: 7001,
    assignedAdminName: 'support.audit.agent',
    status: 'OPEN',
    unreadByUser: 0,
    lastMessage: `[ORDER]${JSON.stringify(supportOrder)}`,
    lastMessageAt: '2026-06-08T04:40:00Z',
    createdAt: '2026-06-08T03:10:00Z',
    updatedAt: '2026-06-08T04:40:00Z',
  },
];

const supportMessages = [
  {
    id: 90001,
    sessionId: 7001,
    senderRole: 'USER',
    content: 'I requested a return yesterday and need the next step before the carrier pickup window closes.',
    isReadByUser: true,
    createdAt: '2026-06-08T04:35:00Z',
  },
  {
    id: 90002,
    sessionId: 7001,
    senderRole: 'USER',
    content: `[ORDER]${JSON.stringify(supportOrder)}`,
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

const orderItems = [
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

const paymentChannels = [
  { code: 'STRIPE', displayName: 'Stripe card', status: 'ACTIVE', recommended: true },
  { code: 'PAYPAL', displayName: 'PayPal wallet', status: 'ACTIVE' },
  { code: 'BANK_TRANSFER', displayName: 'Bank transfer with very long channel name', status: 'ACTIVE' },
];

function ensureDirs() {
  fs.mkdirSync(outDir, { recursive: true });
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installRuntime(page) {
  await page.addInitScript(() => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      supportWebSocketUrl: '/ws/support',
      apiGatewayEnabled: false,
      apiGatewayPrefix: '/gateway',
      mobileVersionManifestUrl: '/downloads/mobile-version.json',
      mobileCurrentVersionCode: 10077,
      mobileCurrentVersionName: '1.0.77',
    };
    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
      Plugins: {
        App: {
          addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
          minimizeApp: () => Promise.resolve(),
        },
        Browser: { open: () => Promise.resolve() },
      },
    };
    localStorage.setItem('token', 'profile-support-app-audit-token');
    localStorage.setItem('refreshToken', 'profile-support-app-audit-refresh-token');
    localStorage.setItem('userId', '501');
    localStorage.setItem('role', 'USER');
    localStorage.setItem('shop-language', 'en');
    localStorage.setItem('currency', 'USD');
    localStorage.setItem('shopmx.cookie-consent.v1', JSON.stringify({
      version: 1,
      acceptedAt: '2026-08-21T09:15:00.000Z',
      essentialOnly: false,
    }));
    sessionStorage.clear();
  });
}

async function installMocks(page) {
  const apiRequests = [];
  await page.route('**/downloads/mobile-version.json', (route) => fulfillJson(route, {
    platform: 'android',
    appId: 'com.shoptest.mobile',
    versionName: '1.0.77',
    versionCode: 10077,
    minSupportedVersionCode: 10035,
    mandatory: false,
    releaseSigned: true,
    fileName: 'shoptest-1.0.77.apk',
    apkUrl: '/downloads/shoptest-1.0.77.apk',
  }));

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;
    apiRequests.push({ method, pathname, search: url.search });

    if (pathname === '/api/app/config') {
      return fulfillJson(route, { runtimeMode: 'test', paymentSimulationEnabled: true, emailCodeEnabled: true });
    }
    if (pathname === '/api/auth/refresh') {
      return fulfillJson(route, { token: 'profile-support-app-audit-token', refreshToken: 'profile-support-app-audit-refresh-token' });
    }
    if (pathname === '/api/users/profile') return fulfillJson(route, profile);
    if (pathname === '/api/users/email-code/config') return fulfillJson(route, { enabled: false, ttlMinutes: 10 });
    if (pathname === '/api/orders/me') return fulfillJson(route, [...orders, ...supportOrders]);
    if (pathname === '/api/addresses/me') return fulfillJson(route, addresses);
    if (pathname === '/api/pet-profiles') return fulfillJson(route, pets);
    if (pathname === '/api/payments/channels') return fulfillJson(route, paymentChannels);
    if (pathname === '/api/cart/me') return fulfillJson(route, []);
    if (pathname === '/api/support/unread-count') return fulfillJson(route, { count: 2 });
    if (pathname === '/api/notifications/me/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/wishlist/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/stock-alerts/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/support/session' && method === 'POST') return fulfillJson(route, supportSessions[0]);
    if (pathname === '/api/support/session' && method === 'GET') return fulfillJson(route, supportSessions[0]);
    if (pathname === '/api/support/sessions') return fulfillJson(route, supportSessions);
    if (/^\/api\/support\/sessions\/\d+\/messages$/.test(pathname)) return fulfillJson(route, supportMessages);
    if (/^\/api\/support\/sessions\/\d+\/read$/.test(pathname)) return route.fulfill({ status: 204, body: '' });
    if (/^\/api\/support\/sessions\/\d+\/close$/.test(pathname)) return fulfillJson(route, { ...supportSessions[0], status: 'CLOSED' });
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
        session: supportSessions[0],
      });
    }
    const orderItemsMatch = pathname.match(/^\/api\/orders\/(\d+)\/items$/);
    if (orderItemsMatch) return fulfillJson(route, orderItems);
    const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
    if (orderMatch) {
      const id = Number(orderMatch[1]);
      return fulfillJson(route, [...orders, ...supportOrders].find((item) => item.id === id) || supportOrder);
    }
    if (pathname === '/api/categories') return fulfillJson(route, []);
    if (pathname === '/api/announcements/active') return fulfillJson(route, []);
    if (pathname.startsWith('/api/products')) return fulfillJson(route, { items: [], total: 0, page: 0, size: 12, totalPages: 0 });

    return fulfillJson(route, {});
  });
  return apiRequests;
}

function viewportConfig(viewport) {
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel Audit) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 ShopTestAndroidApp/${viewport.name}`,
  };
}

async function waitForProfile(page) {
  await page.waitForSelector('.profile-page', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('.profile-tabs', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
}

async function waitForSupportOpen(page) {
  await page.waitForSelector('.app-support-launcher', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('shop:open-support'));
  });
  await page.waitForSelector('.customer-support-widget__panel', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('.customer-support-widget__orderCard', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(900);
}

async function screenshot(page, viewport, stateName) {
  const file = `${viewport.name}-${stateName}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  return file;
}

async function collectSnapshot(page, viewport, stateName) {
  return page.evaluate(({ viewportName, stateName: currentStateName }) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const selectorFor = (el) => {
      if (!el) return '';
      const className = String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 160);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${className ? `.${className}` : ''}`;
    };
    const rectForElement = (el) => {
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector: selectorFor(el),
        text: textOf(el).slice(0, 260) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        position: style.position,
        zIndex: style.zIndex,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        fontSize: style.fontSize,
      };
    };
    const rectOf = (selector) => rectForElement(document.querySelector(selector));
    const visibleRatioOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return rect.width && rect.height ? (width * height) / (rect.width * rect.height) : 0;
    };
    const hitAt = (selector, label, xFactor = 0.5, yFactor = 0.5) => {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width * xFactor));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height * yFactor));
      const hit = document.elementFromPoint(x, y);
      return {
        label,
        selector,
        point: { x, y },
        targetSelector: selectorFor(el),
        targetText: textOf(el).slice(0, 180),
        hitSelector: selectorFor(hit),
        hitText: textOf(hit).slice(0, 180),
        hitInsideTarget: Boolean(hit && el.contains(hit)),
      };
    };
    const stackAt = (selector, label) => {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      return {
        label,
        selector,
        point: { x, y },
        stack: document.elementsFromPoint(x, y).slice(0, 8).map((item) => ({
          selector: selectorFor(item),
          text: textOf(item).slice(0, 120),
        })),
      };
    };
    const visiblePopupRows = Array.from(document.querySelectorAll([
      '.shop-cascader__popup .shop-cascader__option',
      '.shop-select__popup .shop-select__option',
      '.support-order-select-popup .shop-select__option',
    ].join(','))).filter(visible).map((el) => {
      const rect = rectForElement(el);
      return {
        ...rect,
        visibleRatio: visibleRatioOf(rect.selector),
      };
    }).slice(0, 40);

    return {
      viewportName,
      stateName: currentStateName,
      url: window.location.href,
      bodyClasses: document.body.className,
      htmlClasses: document.documentElement.className,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      rects: {
        bottomNav: rectOf('.shop-nav__bottomBar'),
        profilePage: rectOf('.profile-page'),
        profileTabs: rectOf('.profile-tabs__nav'),
        profileAddressModal: rectOf('.profile-address-modal .shop-modal__content'),
        profileModal: rectOf('.profile-mobile-safe-modal .shop-modal__content'),
        profileModalBody: rectOf('.profile-mobile-safe-modal .shop-modal__body'),
        profileModalFooter: rectOf('.profile-mobile-safe-modal .shop-modal__footer'),
        addressCascader: rectOf('.profile-address-modal .shop-cascader'),
        petDatePicker: rectOf('.profile-pet-modal__field'),
        cascaderDropdown: rectOf('.shop-cascader__popup'),
        selectDropdown: rectOf('.shop-select__popup'),
        pickerDropdown: null,
        supportPanel: rectOf('.customer-support-widget__panel'),
        supportBackdrop: rectOf('.customer-support-widget__backdrop'),
        supportComposer: rectOf('.customer-support-widget__composer'),
        supportOrderSelect: rectOf('.customer-support-widget__orderSelect'),
        supportOrderPopup: rectOf('.support-order-select-popup'),
        supportOrderOption: rectOf('.support-order-select-popup .shop-select__option'),
        supportOrderModal: rectOf('.customer-support-widget__orderModal .shop-modal__content'),
        supportOrderModalBody: rectOf('.customer-support-widget__orderModal .shop-modal__body'),
        supportOrderModalClose: rectOf('.customer-support-widget__orderModal .shop-modal__close'),
      },
      visibleRatios: {
        cascaderDropdown: visibleRatioOf('.shop-cascader__popup'),
        selectDropdown: visibleRatioOf('.shop-select__popup'),
        pickerDropdown: null,
        supportOrderPopup: visibleRatioOf('.support-order-select-popup'),
        supportOrderOption: visibleRatioOf('.support-order-select-popup .shop-select__option'),
        supportOrderModal: visibleRatioOf('.customer-support-widget__orderModal .shop-modal__content'),
        supportOrderModalClose: visibleRatioOf('.customer-support-widget__orderModal .shop-modal__close'),
      },
      hits: [
        hitAt('.shop-cascader__popup .shop-cascader__option', 'profile-cascader-option'),
        hitAt('.shop-select__popup .shop-select__option', 'profile-select-option'),
        hitAt('.profile-pet-modal__field input[type="date"]', 'profile-date-input'),
        hitAt('.support-order-select-popup .shop-select__option', 'support-order-option'),
        hitAt('.customer-support-widget__orderModal .shop-modal__content', 'support-order-modal-content'),
        hitAt('.customer-support-widget__orderModal .shop-modal__close', 'support-order-modal-close'),
        hitAt('.customer-support-widget__orderModal .shop-modal__body', 'support-order-modal-body'),
      ],
      stacks: [
        stackAt('.shop-cascader__popup .shop-cascader__option', 'profile-cascader-option'),
        stackAt('.shop-select__popup .shop-select__option', 'select-option'),
        stackAt('.profile-pet-modal__field input[type="date"]', 'profile-date-input'),
        stackAt('.support-order-select-popup .shop-select__option', 'support-order-option'),
        stackAt('.customer-support-widget__orderModal .shop-modal__content', 'support-order-modal-content'),
        stackAt('.customer-support-widget__orderModal .shop-modal__close', 'support-order-modal-close'),
      ].filter(Boolean),
      visiblePopupRows,
    };
  }, { viewportName: viewport.name, stateName });
}

async function capture(page, viewport, stateName, snapshots) {
  // Android's native date input can terminate headless Chromium while being
  // painted; keep the DOM snapshot for that state without forcing a bitmap.
  const skipScreenshots = process.env.SHOPTEST_MOBILE_APP_SKIP_SCREENSHOTS === '1';
  const file = skipScreenshots || stateName === 'profile-pet-birthday-picker'
    ? null
    : await screenshot(page, viewport, stateName);
  const snapshot = await collectSnapshot(page, viewport, stateName);
  snapshot.screenshot = file;
  snapshots.push(snapshot);
}

async function gotoProfile(page, tab) {
  await page.goto(`${baseUrl}/profile?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForProfile(page);
}

async function openAddressModal(page) {
  await page.locator('.profile-tabs__panel:not([hidden]) .profile-block-button.profile-section-action').first().evaluate((button) => button.click());
  await page.waitForSelector('.profile-address-modal .shop-modal__content', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
}

async function openPetModal(page) {
  await page.locator('.profile-tabs__panel:not([hidden]) .profile-block-button.profile-section-action').first().evaluate((button) => button.click());
  await page.waitForSelector('.profile-mobile-safe-modal .shop-modal__content', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
}

async function closeOpenModal(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(400);
}

async function scrollModalTo(page, bodySelector, targetSelector) {
  await page.evaluate(({ bodySelector: modalBodySelector, targetSelector: target }) => {
    const body = document.querySelector(modalBodySelector);
    const element = document.querySelector(target);
    if (!body || !element) return;
    const bodyRect = body.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    body.scrollTop += targetRect.top - bodyRect.top - 18;
  }, { bodySelector, targetSelector });
  await page.waitForTimeout(350);
}

async function runProfileStates(page, viewport, snapshots) {
  await gotoProfile(page, 'addresses');
  await capture(page, viewport, 'profile-addresses-top', snapshots);
  await openAddressModal(page);
  await capture(page, viewport, 'profile-address-modal-open', snapshots);
  await scrollModalTo(page, '.profile-address-modal .shop-modal__body', '.profile-address-modal .shop-cascader');
  await page.locator('.profile-address-modal .shop-cascader').click();
  await page.waitForSelector('.shop-cascader__popup', { state: 'visible', timeout: 7000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'profile-address-region-cascader', snapshots);

  await gotoProfile(page, 'pets');
  await capture(page, viewport, 'profile-pets-top', snapshots);
  await openPetModal(page);
  await capture(page, viewport, 'profile-pet-modal-open', snapshots);
  const petSelects = page.locator('.profile-mobile-safe-modal .shop-select');
  if (await petSelects.count()) {
    await petSelects.first().click();
    await page.waitForSelector('.shop-select__popup', { state: 'visible', timeout: 7000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    await capture(page, viewport, 'profile-pet-type-select', snapshots);
  }

  await gotoProfile(page, 'pets');
  await openPetModal(page);
  await scrollModalTo(page, '.profile-mobile-safe-modal .shop-modal__body', '.profile-pet-modal__field');
  // Native date pickers are OS-owned surfaces and can close headless Chromium;
  // audit the field's in-modal geometry and hit target instead.
  await capture(page, viewport, 'profile-pet-birthday-picker', snapshots);

  await gotoProfile(page, 'pets');
  await openPetModal(page);
  await scrollModalTo(page, '.profile-mobile-safe-modal .shop-modal__body', '.profile-mobile-safe-modal .ant-form-item:last-child .shop-select');
  const freshPetSelects = page.locator('.profile-mobile-safe-modal .shop-select');
  if ((await freshPetSelects.count()) > 1) {
    await freshPetSelects.nth(1).click();
    await page.waitForSelector('.shop-select__popup', { state: 'visible', timeout: 7000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    await capture(page, viewport, 'profile-pet-size-select', snapshots);
  }
}

async function runSupportStates(page, viewport, snapshots) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForSupportOpen(page);
  await capture(page, viewport, 'support-open', snapshots);

  await page.locator('.customer-support-widget__composer').evaluate((composer) => {
    composer.scrollTop = composer.scrollHeight;
  });
  await page.waitForTimeout(300);
  await page.locator('.customer-support-widget__orderSelect').click({ timeout: 10000 });
  await page.waitForSelector('.support-order-select-popup', { state: 'visible', timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'support-order-select-open', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(300);

  const viewOrder = page.locator('.customer-support-widget__linkButton').first();
  await viewOrder.scrollIntoViewIfNeeded().catch(() => undefined);
  await viewOrder.click({ timeout: 10000 });
  await page.waitForSelector('.customer-support-widget__orderModal .shop-modal__content', { state: 'visible', timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(700);
  await capture(page, viewport, 'support-order-modal-open', snapshots);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext(viewportConfig(viewport));
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await installRuntime(page);
  const apiRequests = await installMocks(page);

  const consoleMessages = [];
  const networkFailures = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500), url: page.url() });
    }
  });
  page.on('requestfailed', (request) => {
    networkFailures.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText || '' });
  });

  const snapshots = [];
  let error = null;
  try {
    const only = process.env.SHOPTEST_MOBILE_APP_ONLY || '';
    if (only !== 'support') await runProfileStates(page, viewport, snapshots);
    if (only !== 'profile') await runSupportStates(page, viewport, snapshots);
  } catch (runError) {
    error = {
      message: runError?.message || String(runError),
      stack: runError?.stack ? String(runError.stack).slice(0, 1200) : '',
      url: page.url(),
    };
    await screenshot(page, viewport, 'failed').catch(() => undefined);
  }

  await context.close().catch(() => undefined);
  return { viewport, snapshots, consoleMessages, networkFailures, apiRequests, error };
}

function hitMissesTarget(hit, expectedClassFragments) {
  if (!hit) return false;
  if (hit.hitInsideTarget) return false;
  const hitSelector = String(hit.hitSelector || '');
  return !expectedClassFragments.some((fragment) => hitSelector.includes(fragment));
}

function analyze(results) {
  const issues = [];
  const profileStates = new Set([
    'profile-address-region-cascader',
    'profile-pet-type-select',
    'profile-pet-birthday-picker',
    'profile-pet-size-select',
  ]);

  for (const result of results) {
    for (const snapshot of result.snapshots) {
      const { viewportName, stateName } = snapshot;

      if (profileStates.has(stateName)) {
        const relevantLabels = stateName === 'profile-address-region-cascader'
          ? ['profile-cascader-option']
          : stateName === 'profile-pet-birthday-picker'
            ? ['profile-date-input']
            : ['profile-select-option'];
        const relevantHits = snapshot.hits.filter((hit) => hit && relevantLabels.includes(hit.label));
        const badHits = relevantHits.filter((hit) => hitMissesTarget(hit, [
          'shop-cascader__option',
          'shop-select__option',
          'profile-pet-modal__field',
        ]));
        if (badHits.length) {
          issues.push({
            type: 'profile-editor-popup-under-modal',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              badHits,
              popupRects: {
                cascaderDropdown: snapshot.rects.cascaderDropdown,
                selectDropdown: snapshot.rects.selectDropdown,
                pickerDropdown: snapshot.rects.pickerDropdown,
                modal: snapshot.rects.profileModal,
                modalFooter: snapshot.rects.profileModalFooter,
              },
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName === 'support-order-select-open') {
        const optionHit = snapshot.hits.find((hit) => hit?.label === 'support-order-option');
        if (hitMissesTarget(optionHit, ['shop-select__option'])) {
          issues.push({
            type: 'support-order-select-under-panel',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              optionHit,
              optionStack: snapshot.stacks.find((stack) => stack.label === 'support-order-option'),
              rects: {
                supportPanel: snapshot.rects.supportPanel,
                supportComposer: snapshot.rects.supportComposer,
                supportOrderPopup: snapshot.rects.supportOrderPopup,
                supportOrderOption: snapshot.rects.supportOrderOption,
              },
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName === 'support-order-modal-open') {
        const modalHit = snapshot.hits.find((hit) => hit?.label === 'support-order-modal-content');
        const closeHit = snapshot.hits.find((hit) => hit?.label === 'support-order-modal-close');
        const badHits = [modalHit, closeHit].filter((hit) => hitMissesTarget(hit, ['shop-modal__content', 'shop-modal__close']));
        if (badHits.length) {
          issues.push({
            type: 'support-order-modal-under-panel',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              badHits,
              modalStack: snapshot.stacks.find((stack) => stack.label === 'support-order-modal-content'),
              closeStack: snapshot.stacks.find((stack) => stack.label === 'support-order-modal-close'),
              rects: {
                supportPanel: snapshot.rects.supportPanel,
                supportOrderModal: snapshot.rects.supportOrderModal,
                supportOrderModalClose: snapshot.rects.supportOrderModalClose,
              },
              screenshot: snapshot.screenshot,
            },
          });
        }
      }
    }
  }
  return issues;
}

function writeReport(results, issues) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports: viewportsToRun,
    mockScope: [
      'authenticated profile APIs',
      'addresses, pets, orders and order items',
      'support sessions/messages/orders',
      'nav count endpoints',
    ],
    results,
    issues,
    consoleMessageCount: results.reduce((sum, result) => sum + result.consoleMessages.length, 0),
    networkFailureCount: results.reduce((sum, result) => sum + result.networkFailures.length, 0),
    runErrors: results.filter((result) => result.error),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Mobile App Profile and Support UI Audit');
  lines.push('');
  lines.push(`Date: ${report.generatedAt}`);
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push('Mode: Playwright, mocked APIs, Android App WebView simulation.');
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('- Viewports: `320x568`, `390x844`.');
  lines.push('- States: profile address modal/cascader, profile pet modal/type select/birthday picker/size select, support widget open, support order select, support order detail modal.');
  lines.push('- Mock scope: authenticated customer profile, addresses, pets, orders, support sessions/messages, order detail, nav counters.');
  lines.push('- Evidence: `report.json` plus viewport screenshots in this directory.');
  lines.push(`- Console warnings/errors: ${report.consoleMessageCount}; network failures: ${report.networkFailureCount}; run errors: ${report.runErrors.length}.`);
  lines.push('');
  lines.push('## Automated Findings');
  lines.push('');
  if (!issues.length) {
    lines.push('- No new profile/support App UI findings were promoted by the hit-test checks.');
  } else {
    for (const issue of issues) {
      lines.push(`- ${issue.severity.toUpperCase()} ${issue.type} (${issue.viewportName}, ${issue.stateName}) screenshot: \`${issue.evidence.screenshot}\``);
    }
  }
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), `${lines.join('\n')}\n`);
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.SHOPTEST_PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const results = [];
  for (const viewport of viewportsToRun) {
    results.push(await runViewport(browser, viewport));
  }
  await browser.close();
  const issues = analyze(results);
  writeReport(results, issues);
  console.log(JSON.stringify({
    outDir,
    viewportCount: viewportsToRun.length,
    issueCount: issues.length,
    issueTypes: [...new Set(issues.map((issue) => issue.type))].sort(),
    runErrors: results.filter((result) => result.error).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
