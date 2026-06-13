const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T-account-utilities-app-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320-app', width: 320, height: 568 },
  { name: 'phone-390-app', width: 390, height: 844 },
];

const now = Date.parse('2026-06-08T08:35:00Z');

const products = [
  {
    id: 6101,
    name: 'Ultra long name orthopedic pet sofa bed with washable cooling cover and reinforced non-slip base for recovery browsing',
    description: 'A long description used to stress history cards on narrow Android App screens.',
    price: 1499,
    effectivePrice: 1199,
    originalPrice: 1699,
    discount: 29,
    effectiveDiscountPercent: 29,
    stock: 3,
    categoryId: 10,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'SleepWell Pets Long Brand Name',
    averageRating: 4.8,
    reviewCount: 128,
    tag: 'orthopedic',
  },
  {
    id: 6102,
    name: 'Sensitive skin salmon kibble subscription starter pack with extra long product label',
    description: 'Option product for detail resume state.',
    price: 899,
    effectivePrice: 799,
    originalPrice: 999,
    discount: 20,
    stock: 12,
    categoryId: 11,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'NutriPet',
    averageRating: 4.5,
    reviewCount: 82,
    optionGroups: [{ name: 'Bag size', values: ['2 kg', '7 kg'] }],
    tag: 'food',
  },
  {
    id: 6103,
    name: 'LED reflective waterproof harness with unusually long color and size naming for stock alert cards',
    description: 'Ready stock alert product.',
    price: 699,
    effectivePrice: 599,
    originalPrice: 799,
    discount: 25,
    stock: 2,
    categoryId: 12,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'TrailPaw',
    averageRating: 4.7,
    reviewCount: 44,
    tag: 'harness',
  },
  {
    id: 6104,
    name: 'Replacement water fountain filter pack currently unavailable with long waiting label',
    description: 'Waiting stock alert product.',
    price: 259,
    stock: 0,
    categoryId: 13,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'AquaPet',
    averageRating: 4.3,
    reviewCount: 39,
    tag: 'filter',
  },
];

const notifications = [
  {
    id: 7101,
    type: 'ORDER',
    title: 'Order SO-20260608-ACCOUNT-UTILITIES-LONG-NOTIFICATION moved to carrier handoff',
    message: 'Your package has a very long carrier update message that should wrap cleanly in the notification list without pushing actions off screen.',
    contentFormat: 'TEXT',
    isRead: false,
    createdAt: '2026-06-08T07:55:00Z',
  },
  {
    id: 7102,
    type: 'PROMOTION',
    title: 'Limited coupon reminder with rich content',
    message: '<p><strong>Save 20%</strong> on orthopedic beds today. <a href="/coupons">Open coupons</a> before the campaign window closes.</p><ul><li>Long benefit copy should remain readable.</li><li>No horizontal scroll should be introduced.</li></ul>',
    contentFormat: 'HTML',
    isRead: false,
    createdAt: '2026-06-08T06:45:00Z',
  },
  {
    id: 7103,
    type: 'DELIVERY',
    title: 'Delivery appointment needs confirmation',
    message: 'Carrier is asking for a delivery window confirmation and this should leave the delete action reachable.',
    contentFormat: 'TEXT',
    isRead: true,
    createdAt: '2026-06-07T19:15:00Z',
  },
  {
    id: 7104,
    type: 'SYSTEM',
    title: 'Security reminder',
    message: 'Review account activity from the profile security panel.',
    contentFormat: 'TEXT',
    isRead: true,
    createdAt: '2026-06-07T14:05:00Z',
  },
];

const stockAlerts = [
  {
    productId: 6103,
    productName: products[2].name,
    imageUrl: products[2].imageUrl,
    createdAt: '2026-06-07T20:10:00Z',
  },
  {
    productId: 6104,
    productName: products[3].name,
    imageUrl: products[3].imageUrl,
    createdAt: '2026-06-06T12:20:00Z',
  },
  {
    productId: 6102,
    productName: products[1].name,
    imageUrl: products[1].imageUrl,
    createdAt: '2026-06-05T10:00:00Z',
  },
];

const historyPreferences = {
  categories: { 10: 3, 11: 2, 12: 1 },
  brands: { 'SleepWell Pets Long Brand Name': 3, NutriPet: 2, TrailPaw: 1 },
  tags: { orthopedic: 3, food: 2, harness: 1 },
  recent: [6101, 6102, 6103],
  recentEntries: [
    { productId: 6101, viewedAt: now - 45 * 60 * 1000 },
    { productId: 6102, viewedAt: now - 4 * 60 * 60 * 1000 },
    { productId: 6103, viewedAt: now - 28 * 60 * 60 * 1000 },
  ],
  updatedAt: now,
};

const paymentOrder = {
  id: 8101,
  orderNo: 'PAY-ACCOUNT-UTILITIES-20260608-LONG',
  status: 'PENDING_PAYMENT',
  totalAmount: 2386.75,
  originalAmount: 2486.75,
  discountAmount: 100,
  paymentMethod: 'BANK_TRANSFER_WITH_LONG_REFERENCE',
  shippingFee: 0,
  createdAt: '2026-06-08T06:30:00Z',
  guestOrder: true,
};

const latestPayment = {
  id: 9101,
  orderId: paymentOrder.id,
  orderNo: paymentOrder.orderNo,
  channel: 'BANK_TRANSFER_WITH_LONG_REFERENCE',
  status: 'PENDING',
  amount: paymentOrder.totalAmount,
  expiresAt: '2026-06-10T06:30:00Z',
  createdAt: '2026-06-08T06:30:00Z',
};

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

function viewportConfig(viewport) {
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel Account Audit) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 ShopTestAndroidApp/${viewport.name}`,
  };
}

async function installRuntime(page) {
  await page.addInitScript(({ stockAlertsSeed, historySeed, orderNo }) => {
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
    localStorage.setItem('token', 'account-utilities-app-audit-token');
    localStorage.setItem('refreshToken', 'account-utilities-app-audit-refresh-token');
    localStorage.setItem('userId', '777');
    localStorage.setItem('username', 'account.utilities.audit');
    localStorage.setItem('role', 'USER');
    localStorage.setItem('shop-language', 'en');
    localStorage.setItem('currency', 'USD');
    localStorage.setItem('shop-stock-alerts', JSON.stringify(stockAlertsSeed));
    localStorage.setItem('shop-product-view-preferences', JSON.stringify(historySeed));
    localStorage.setItem('shop-guest-support-context', JSON.stringify({
      orderNo,
      email: 'guest.account.audit@example.com',
      savedAt: Date.now(),
    }));
    sessionStorage.clear();
  }, { stockAlertsSeed: stockAlerts, historySeed: historyPreferences, orderNo: paymentOrder.orderNo });
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
    const pathname = url.pathname;
    const method = request.method();
    apiRequests.push({ method, pathname, search: url.search });

    if (pathname === '/api/app/config') {
      return fulfillJson(route, {
        runtimeMode: 'test',
        paymentSimulationEnabled: true,
        emailCodeEnabled: true,
        defaultShippingFee: 0,
      });
    }
    if (pathname === '/api/auth/refresh') {
      return fulfillJson(route, {
        token: 'account-utilities-app-audit-token',
        refreshToken: 'account-utilities-app-audit-refresh-token',
      });
    }
    if (pathname === '/api/announcements/active') return fulfillJson(route, []);
    if (pathname === '/api/support/unread-count') return fulfillJson(route, { count: 1 });
    if (pathname === '/api/notifications/me/unread-count') return fulfillJson(route, { count: 2 });
    if (pathname === '/api/wishlist/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/stock-alerts/me/count') return fulfillJson(route, { count: stockAlerts.length });
    if (pathname === '/api/users/profile') {
      return fulfillJson(route, {
        id: 777,
        username: 'account.utilities.audit',
        email: 'account.audit@example.com',
        role: 'USER',
        roleCode: 'USER',
        status: 'ACTIVE',
      });
    }
    if (pathname === '/api/cart/me') return fulfillJson(route, []);
    if (pathname === '/api/cart/items' && method === 'POST') return fulfillJson(route, { id: 9301, quantity: 1 });
    if (pathname === '/api/notifications/me') {
      return fulfillJson(route, notifications);
    }
    if (/^\/api\/notifications\/\d+\/read$/.test(pathname) && method === 'PUT') {
      return fulfillJson(route, { success: true });
    }
    if (pathname === '/api/notifications/me/read-all' && method === 'PUT') {
      return fulfillJson(route, { success: true });
    }
    if (/^\/api\/notifications\/\d+$/.test(pathname) && method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/products/by-ids') {
      const ids = url.searchParams.getAll('ids').map(Number);
      return fulfillJson(route, products.filter((product) => ids.includes(product.id)));
    }
    if (pathname === '/api/orders/track' && method === 'POST') {
      return fulfillJson(route, { order: paymentOrder, items: [], payments: [latestPayment], detailsRestricted: false });
    }
    if (pathname === '/api/orders/me') {
      return fulfillJson(route, [paymentOrder]);
    }
    if (pathname === `/api/payments/order/${paymentOrder.id}/latest`) {
      return fulfillJson(route, latestPayment);
    }
    if (pathname === `/api/payments/order/${paymentOrder.id}`) {
      return fulfillJson(route, [latestPayment]);
    }
    if (pathname === '/api/payments/channels') {
      return fulfillJson(route, [
        { code: 'STRIPE', displayName: 'Stripe card', status: 'ACTIVE', recommended: true },
        { code: 'BANK_TRANSFER_WITH_LONG_REFERENCE', displayName: 'Bank transfer with long reference', status: 'ACTIVE' },
      ]);
    }
    if (pathname.startsWith('/api/support')) {
      return fulfillJson(route, { count: 0 });
    }

    return fulfillJson(route, {});
  });
  return apiRequests;
}

async function waitForVisible(page, selector, timeout = 20000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
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
      const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(centerX, centerY);
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
        lineHeight: style.lineHeight,
        centerHit: hit ? {
          selector: selectorFor(hit),
          text: textOf(hit).slice(0, 160),
          inside: el.contains(hit),
        } : null,
      };
    };
    const rectOf = (selector) => rectForElement(document.querySelector(selector));
    const overlap = (a, b) => {
      if (!a || !b) return null;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { overlaps: x > 1 && y > 1, x, y, area: x * y };
    };
    const hitAt = (selector, label, xFactor = 0.5, yFactor = 0.5) => {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return null;
      }
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
      if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return null;
      }
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

    const bottomNav = rectOf('.shop-nav__bottomBar');
    const interactiveSelector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '.ant-select-selector',
      '.ant-popover-buttons button',
    ].join(',');

    const smallTargets = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160) || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '',
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
        };
      })
      .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44))
      .slice(0, 60);

    const tinyVisibleText = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el) && textOf(el) && !Array.from(el.children).some((child) => visible(child) && textOf(child)))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize || '0');
        if (!Number.isFinite(fontSize) || fontSize >= 12) return null;
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160),
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
          color: style.color,
        };
      })
      .filter(Boolean)
      .slice(0, 60);

    const overflowElements = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const overflowRight = rect.right - window.innerWidth;
        const overflowLeft = -rect.left;
        const scrollOverflow = el.scrollWidth - el.clientWidth;
        if (overflowRight <= 1 && overflowLeft <= 1 && scrollOverflow <= 1) return null;
        const style = window.getComputedStyle(el);
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160),
          top: rect.top,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          overflowRight,
          overflowLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
        };
      })
      .filter(Boolean)
      .slice(0, 80);

    const bottomNavTop = bottomNav ? bottomNav.top : window.innerHeight;
    const bottomObscured = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= bottomNavTop || rect.top >= window.innerHeight) return null;
        const overlapPx = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, bottomNavTop);
        if (overlapPx <= 1) return null;
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          overlapPx,
        };
      })
      .filter(Boolean)
      .slice(0, 60);

    const actionBarSelectors = [
      '.stock-alerts__mobileAction',
      '.browsing-history__mobileAction',
      '.payment-instructions-page__actions',
      '.notifications-page__loadMore',
    ];
    const actionBars = Object.fromEntries(actionBarSelectors.map((selector) => [selector, rectOf(selector)]));

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
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
      rects: {
        bottomNav,
        notificationsPage: rectOf('.notifications-page'),
        notificationsHeader: rectOf('.notifications-page__header'),
        notificationsAssistant: rectOf('.notifications-page__assistant'),
        notificationsActionPlan: rectOf('.notifications-page__actionPlan'),
        notificationsFirstItem: rectOf('.notifications-page__item'),
        notificationsDeletePopover: rectOf('.notifications-delete-popconfirm'),
        stockAlerts: rectOf('.stock-alerts'),
        stockCard: rectOf('.stock-alerts > .ant-card'),
        stockHeader: rectOf('.stock-alerts__header'),
        stockMobileAction: rectOf('.stock-alerts__mobileAction'),
        stockFirstItem: rectOf('.stock-alerts__item'),
        stockPopconfirm: rectOf('.stock-alerts-popconfirm'),
        browsingHistory: rectOf('.browsing-history'),
        historyHero: rectOf('.browsing-history__hero'),
        historyAssistant: rectOf('.browsing-history__assistant'),
        historyRecovery: rectOf('.browsing-history__recovery'),
        historyNextAction: rectOf('.browsing-history__nextAction'),
        historyMobileAction: rectOf('.browsing-history__mobileAction'),
        historyFirstItem: rectOf('.browsing-history__item'),
        historyPopconfirm: rectOf('.ant-popover'),
        paymentPage: rectOf('.payment-instructions-page'),
        paymentHero: rectOf('.payment-instructions-page__hero'),
        paymentGrid: rectOf('.payment-instructions-page__grid'),
        paymentStatus: rectOf('.payment-instructions-page__status'),
        paymentActions: rectOf('.payment-instructions-page__actions'),
      },
      overlaps: {
        stockMobileActionVsBottomNav: overlap(rectOf('.stock-alerts__mobileAction'), bottomNav),
        historyMobileActionVsBottomNav: overlap(rectOf('.browsing-history__mobileAction'), bottomNav),
        paymentActionsVsBottomNav: overlap(rectOf('.payment-instructions-page__actions'), bottomNav),
        notificationsLoadMoreVsBottomNav: overlap(rectOf('.notifications-page__loadMore'), bottomNav),
        notificationsDeletePopoverVsBottomNav: overlap(rectOf('.notifications-delete-popconfirm'), bottomNav),
        stockPopconfirmVsBottomNav: overlap(rectOf('.stock-alerts-popconfirm'), bottomNav),
        historyPopconfirmVsBottomNav: overlap(rectOf('.ant-popover'), bottomNav),
      },
      actionBars,
      hits: [
        hitAt('.notifications-delete-popconfirm .ant-popconfirm-buttons button:last-child', 'notifications-delete-confirm'),
        hitAt('.stock-alerts-popconfirm .ant-popconfirm-buttons button:last-child', 'stock-remove-confirm'),
        hitAt('.ant-popover .ant-popconfirm-buttons button:last-child', 'history-remove-confirm'),
        hitAt('.stock-alerts__mobileAction .ant-btn', 'stock-mobile-action'),
        hitAt('.browsing-history__mobileAction .ant-btn', 'history-mobile-action'),
        hitAt('.payment-instructions-page__actions .ant-btn:last-child', 'payment-support-action'),
      ].filter(Boolean),
      stacks: [
        stackAt('.notifications-delete-popconfirm .ant-popconfirm-buttons button:last-child', 'notifications-delete-confirm'),
        stackAt('.stock-alerts-popconfirm .ant-popconfirm-buttons button:last-child', 'stock-remove-confirm'),
        stackAt('.ant-popover .ant-popconfirm-buttons button:last-child', 'history-remove-confirm'),
        stackAt('.stock-alerts__mobileAction .ant-btn', 'stock-mobile-action'),
        stackAt('.browsing-history__mobileAction .ant-btn', 'history-mobile-action'),
        stackAt('.payment-instructions-page__actions .ant-btn:last-child', 'payment-support-action'),
      ].filter(Boolean),
      counts: {
        notifications: document.querySelectorAll('.notifications-page__item').length,
        stockItems: document.querySelectorAll('.stock-alerts__item').length,
        historyItems: document.querySelectorAll('.browsing-history__item').length,
        visiblePopovers: Array.from(document.querySelectorAll('.ant-popover')).filter(visible).length,
      },
      smallTargets,
      tinyVisibleText,
      overflowElements,
      bottomObscured,
      visibleMessage: textOf(document.querySelector('.ant-message, .ant-notification')),
    };
  }, { viewportName: viewport.name, stateName });
}

async function capture(page, viewport, stateName, snapshots) {
  const file = await screenshot(page, viewport, stateName);
  const snapshot = await collectSnapshot(page, viewport, stateName);
  snapshot.screenshot = file;
  snapshots.push(snapshot);
}

async function gotoState(page, routePath, rootSelector) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForVisible(page, rootSelector, 30000);
  await page.waitForTimeout(1100);
}

async function scrollToBottom(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
}

async function openFirstPopconfirm(page, selector) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForSelector('.ant-popover', { state: 'visible', timeout: 7000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function runNotifications(page, viewport, snapshots) {
  await gotoState(page, '/notifications', '.notifications-page');
  await capture(page, viewport, 'notifications-top', snapshots);
  await openFirstPopconfirm(page, '.notifications-page__deleteButton');
  await capture(page, viewport, 'notifications-delete-popconfirm', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await scrollToBottom(page);
  await capture(page, viewport, 'notifications-bottom', snapshots);
}

async function runStockAlerts(page, viewport, snapshots) {
  await gotoState(page, '/stock-alerts', '.stock-alerts');
  await capture(page, viewport, 'stock-alerts-top', snapshots);
  await openFirstPopconfirm(page, '.stock-alerts__item button[aria-label^="Remove"], .stock-alerts__item button:has-text("Remove")');
  await capture(page, viewport, 'stock-alerts-remove-popconfirm', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await scrollToBottom(page);
  await capture(page, viewport, 'stock-alerts-bottom', snapshots);
}

async function runHistory(page, viewport, snapshots) {
  await gotoState(page, '/history', '.browsing-history');
  await capture(page, viewport, 'history-top', snapshots);
  await openFirstPopconfirm(page, '.browsing-history__footer .ant-btn-dangerous, .browsing-history__footer button[aria-label^="Delete"]');
  await capture(page, viewport, 'history-remove-popconfirm', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await scrollToBottom(page);
  await capture(page, viewport, 'history-bottom', snapshots);
}

async function runPaymentInstructions(page, viewport, snapshots) {
  await gotoState(page, `/payment/${paymentOrder.orderNo}?guestEmail=guest.account.audit%40example.com`, '.payment-instructions-page');
  await capture(page, viewport, 'payment-instructions-top', snapshots);
  await scrollToBottom(page);
  await capture(page, viewport, 'payment-instructions-bottom', snapshots);
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
    await runNotifications(page, viewport, snapshots);
    await runStockAlerts(page, viewport, snapshots);
    await runHistory(page, viewport, snapshots);
    await runPaymentInstructions(page, viewport, snapshots);
  } catch (runError) {
    error = {
      message: runError?.message || String(runError),
      stack: runError?.stack ? String(runError.stack).slice(0, 1200) : '',
      url: page.url(),
    };
    await screenshot(page, viewport, 'failed').catch(() => undefined);
  }

  await context.close();
  return { viewport, snapshots, consoleMessages, networkFailures, apiRequests, error };
}

function isOnlyNavigationSmallTarget(item) {
  const selector = String(item.selector || '');
  return selector.includes('shop-nav__bottomItem')
    || selector.includes('shop-nav__secondary-action')
    || selector.includes('shop-nav__more-trigger')
    || selector.includes('shop-nav__cart-action')
    || selector.includes('ant-badge');
}

function isDecorativeOrHiddenTinyText(item) {
  const selector = String(item.selector || '');
  return selector.includes('ant-badge-count')
    || selector.includes('ant-scroll-number')
    || selector.includes('anticon')
    || selector.includes('shop-nav__bottomLabel');
}

function isAccountUtilityTinyText(item) {
  const text = String(item.text || '');
  const selector = String(item.selector || '');
  const ignoredTexts = new Set(['Home', 'Products', 'Coupons', 'Cart', 'Account']);
  if (ignoredTexts.has(text)) return false;
  if (isDecorativeOrHiddenTinyText(item)) return false;
  if (item.height < 8) return false;
  return selector.includes('stock-alerts')
    || selector.includes('browsing-history')
    || [
      'Ready now',
      'Low-stock ready',
      'Still watching',
      'Add ready alerts now',
      'Recently viewed',
      'All viewed',
      'Viewed today',
      'Deals watched',
      'Low stock',
      'Next browsing action',
    ].includes(text);
}

function hitMissesTarget(hit, expectedFragments) {
  if (!hit) return false;
  if (hit.hitInsideTarget) return false;
  const hitSelector = String(hit.hitSelector || '');
  return !expectedFragments.some((fragment) => hitSelector.includes(fragment));
}

function analyze(results) {
  const issues = [];
  const pageStatePrefixes = ['notifications', 'stock-alerts', 'history', 'payment-instructions'];

  for (const result of results) {
    for (const snapshot of result.snapshots) {
      const { viewportName, stateName } = snapshot;

      const tinyText = snapshot.tinyVisibleText
        .filter(isAccountUtilityTinyText)
        .filter((item) => item.top >= 0 && item.bottom <= snapshot.innerHeight);
      if (tinyText.length) {
        issues.push({
          type: 'account-utilities-insight-labels-too-small',
          severity: 'medium',
          viewportName,
          stateName,
          evidence: {
            text: tinyText.slice(0, 12),
            screenshot: snapshot.screenshot,
          },
        });
      }

      if (snapshot.horizontalOverflow) {
        const meaningfulOverflow = snapshot.overflowElements.filter((item) => {
          const selector = String(item.selector || '');
          return !selector.includes('ant-tooltip')
            && !selector.includes('ant-popover-hidden')
            && !selector.includes('shop-nav__bottomBar');
        });
        if (meaningfulOverflow.length) {
          issues.push({
            type: 'account-utilities-horizontal-overflow',
            severity: 'medium',
            viewportName,
            stateName,
            evidence: {
              docWidth: snapshot.docWidth,
              bodyWidth: snapshot.bodyWidth,
              innerWidth: snapshot.innerWidth,
              overflowElements: meaningfulOverflow.slice(0, 12),
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (pageStatePrefixes.some((prefix) => stateName.startsWith(prefix))) {
        const stockOverlap = snapshot.overlaps.stockMobileActionVsBottomNav;
        const stockHit = snapshot.hits.find((hit) => hit.label === 'stock-mobile-action');
        if (stockOverlap?.overlaps && hitMissesTarget(stockHit, ['stock-alerts__mobileAction', 'ant-btn'])) {
          issues.push({
            type: 'stock-alerts-mobile-action-overlaps-bottom-nav',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              bottomNav: snapshot.rects.bottomNav,
              mobileAction: snapshot.rects.stockMobileAction,
              overlap: stockOverlap,
              hit: stockHit,
              screenshot: snapshot.screenshot,
            },
          });
        }
      }
    }
  }

  const unique = new Map();
  issues.forEach((issue) => {
    const key = `${issue.type}:${issue.viewportName}:${issue.stateName}`;
    if (!unique.has(key)) unique.set(key, issue);
  });
  return Array.from(unique.values());
}

function summarizeIssueGroups(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const group = groups.get(issue.type) || { type: issue.type, severity: issue.severity, count: 0, viewports: new Set(), states: new Set() };
    group.count += 1;
    group.viewports.add(issue.viewportName);
    group.states.add(issue.stateName);
    groups.set(issue.type, group);
  }
  return Array.from(groups.values()).map((group) => ({
    type: group.type,
    severity: group.severity,
    count: group.count,
    viewports: Array.from(group.viewports),
    states: Array.from(group.states),
  }));
}

function writeReport(results, issues) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    mockScope: [
      'authenticated notification list/actions',
      'local stock alerts with product detail lookup',
      'local browsing history with product detail lookup',
      'guest payment instructions verification',
      'nav count endpoints and Android App WebView runtime shim',
    ],
    results,
    issues,
    issueGroups: summarizeIssueGroups(issues),
    consoleMessageCount: results.reduce((sum, result) => sum + result.consoleMessages.length, 0),
    networkFailureCount: results.reduce((sum, result) => sum + result.networkFailures.length, 0),
    runErrors: results.filter((result) => result.error),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Mobile App Account Utilities UI Audit');
  lines.push('');
  lines.push(`Date: ${report.generatedAt}`);
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push('Mode: Playwright, mocked APIs/local storage, Android App WebView simulation.');
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('- Viewports: 320x568 and 390x844.');
  lines.push('- Pages: `/notifications`, `/stock-alerts`, `/history`, `/payment/:orderNo`.');
  lines.push('- States: page top, destructive Popconfirm where present, page bottom, payment verified pending state.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Snapshots: ${results.reduce((sum, result) => sum + result.snapshots.length, 0)}`);
  lines.push(`- Issues: ${issues.length}`);
  lines.push(`- Console warnings/errors: ${report.consoleMessageCount}`);
  lines.push(`- Network failures: ${report.networkFailureCount}`);
  lines.push(`- Run errors: ${report.runErrors.length}`);
  lines.push('');
  lines.push('## Issue Groups');
  lines.push('');
  if (report.issueGroups.length === 0) {
    lines.push('- None.');
  } else {
    report.issueGroups.forEach((group) => {
      lines.push(`- ${group.type} (${group.severity}) x${group.count}: viewports ${group.viewports.join(', ')}; states ${group.states.join(', ')}`);
    });
  }
  lines.push('');
  lines.push('## Screenshots');
  lines.push('');
  results.forEach((result) => {
    lines.push(`### ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
    result.snapshots.forEach((snapshot) => {
      lines.push(`- ${snapshot.stateName}: \`${snapshot.screenshot}\``);
    });
    if (result.error) lines.push(`- Run error: ${result.error.message}`);
    lines.push('');
  });

  fs.writeFileSync(path.join(outDir, 'REPORT.md'), `${lines.join('\n')}\n`);
  return report;
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of viewports) {
      results.push(await runViewport(browser, viewport));
    }
  } finally {
    await browser.close();
  }
  const issues = analyze(results);
  const report = writeReport(results, issues);
  console.log(JSON.stringify({
    outDir,
    snapshots: results.reduce((sum, result) => sum + result.snapshots.length, 0),
    issues: report.issueGroups,
    consoleMessageCount: report.consoleMessageCount,
    networkFailureCount: report.networkFailureCount,
    runErrors: report.runErrors.map((item) => item.error || item),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
