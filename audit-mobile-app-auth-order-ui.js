const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T-auth-order-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320-app', width: 320, height: 568 },
  { name: 'phone-390-app', width: 390, height: 844 },
];

const trackedOrder = {
  id: 8804,
  orderNo: 'SO-MOBILE-20260608-AUTH-ORDER-LONG',
  status: 'SHIPPED',
  totalAmount: 188.42,
  paymentMethod: 'STRIPE',
  trackingNumber: '1Z999SHOPTESTMOBILE',
  trackingCarrierCode: 'UPS',
  trackingCarrierName: 'UPS',
  shippingAddress: '123 Long Mobile Test Avenue, Apartment 400, San Francisco, CA 94105, United States',
  createdAt: '2026-06-08T07:45:00Z',
  guestOrder: true,
  returnable: true,
  returnDeadline: '2026-06-22T07:45:00Z',
};

const trackedItems = [
  {
    id: 101,
    orderId: trackedOrder.id,
    productId: 101,
    productName: 'Ultra-comfort orthopedic dog sofa bed with removable washable cover and reinforced bolsters',
    imageUrl: '/assets/placeholders/product.svg',
    price: 129.99,
    quantity: 1,
    selectedSpecs: 'Size: Large; Color: Sage green with extra-long option naming',
  },
  {
    id: 102,
    orderId: trackedOrder.id,
    productId: 102,
    productName: 'Reflective waterproof trail harness for night walks',
    imageUrl: '/assets/placeholders/product.svg',
    price: 58.43,
    quantity: 1,
    selectedSpecs: 'Size: Medium',
  },
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

async function installMocks(page) {
  const apiRequests = [];
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
    localStorage.setItem('shop-language', 'en');
    localStorage.setItem('currency', 'USD');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('guestSupportContext');
    sessionStorage.clear();
  });

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
    if (pathname === '/api/announcements/active') return fulfillJson(route, []);
    if (pathname === '/api/support/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/notifications/me/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/wishlist/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/stock-alerts/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/auth/email-code' && method === 'POST') {
      return fulfillJson(route, { resendIntervalSeconds: 60, codeTtlMinutes: 5 });
    }
    if (pathname === '/api/auth/password-reset-code' && method === 'POST') {
      return fulfillJson(route, { resendIntervalSeconds: 60, codeTtlMinutes: 5 });
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      return fulfillJson(route, { error: 'Invalid username or password' }, 401);
    }
    if (pathname === '/api/auth/email-login' && method === 'POST') {
      return fulfillJson(route, { code: 'INVALID_CODE', error: 'Invalid verification code' }, 400);
    }
    if (pathname === '/api/auth/register' && method === 'POST') {
      return fulfillJson(route, { code: 'EMAIL_CODE_REQUIRED', error: 'Email verification code required', emailCodeRequired: true }, 400);
    }
    if (pathname === '/api/auth/forgot-password' && method === 'POST') {
      return fulfillJson(route, { code: 'INVALID_CODE', error: 'Invalid verification code' }, 400);
    }
    if (pathname === '/api/orders/track' && method === 'POST') {
      return fulfillJson(route, {
        order: trackedOrder,
        items: trackedItems,
        payments: [
          {
            id: 7701,
            orderId: trackedOrder.id,
            orderNo: trackedOrder.orderNo,
            channel: 'STRIPE',
            status: 'PAID',
            amount: trackedOrder.totalAmount,
            createdAt: '2026-06-08T07:45:00Z',
          },
        ],
        detailsRestricted: false,
      });
    }
    if (pathname === '/api/logistics/track' || pathname === '/api/logistics/tracking') {
      return fulfillJson(route, {
        trackingNumber: trackedOrder.trackingNumber,
        carrier: trackedOrder.trackingCarrierCode,
        status: 'IN_TRANSIT',
        summary: 'Package is moving through the carrier network.',
        events: [
          {
            time: '2026-06-08T06:55:00Z',
            location: 'San Francisco, CA',
            description: 'Departed regional facility',
          },
          {
            time: '2026-06-07T17:20:00Z',
            location: 'Oakland, CA',
            description: 'Shipment picked up',
          },
        ],
      });
    }
    if (/^\/api\/logistics/.test(pathname)) {
      return fulfillJson(route, {
        trackingNumber: trackedOrder.trackingNumber,
        carrier: trackedOrder.trackingCarrierCode,
        status: 'IN_TRANSIT',
        summary: 'Package is moving through the carrier network.',
        events: [],
      });
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
    const localSelectorFor = (el) => {
      if (!el) return '';
      const className = String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 140);
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
        selector: localSelectorFor(el),
        text: textOf(el).slice(0, 240) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
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
          selector: localSelectorFor(hit),
          text: textOf(hit).slice(0, 140),
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

    const bottomNavCandidate = rectOf('.shop-nav__bottomBar');
    const bottomNav = bottomNavCandidate && bottomNavCandidate.height > 1 && bottomNavCandidate.width > 1
      ? bottomNavCandidate
      : null;

    const pageSelectors = [
      '.shopee-login-root',
      '.register-page',
      '.order-tracking-page',
    ];

    const interactiveSelector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      '[role="button"]',
      '.ant-tabs-tab',
      '.ant-modal-close',
    ].join(',');

    const smallTargets = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 140) || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '',
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
      .slice(0, 40);

    const tinyVisibleText = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el) && textOf(el) && !Array.from(el.children).some((child) => visible(child) && textOf(child)))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize || '0');
        if (!Number.isFinite(fontSize) || fontSize >= 12) return null;
        return {
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 140),
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
          color: style.color,
        };
      })
      .filter(Boolean)
      .slice(0, 40);

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
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 140),
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
      .slice(0, 50);

    const bottomNavTop = bottomNav ? bottomNav.top : window.innerHeight;
    const bottomObscured = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= bottomNavTop || rect.top >= window.innerHeight) return null;
        const overlapPx = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, bottomNavTop);
        if (overlapPx <= 1) return null;
        return {
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 140) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          overlapPx,
        };
      })
      .filter(Boolean)
      .slice(0, 40);

    const formErrors = Array.from(document.querySelectorAll('.ant-form-item-explain-error'))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 180),
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
          color: style.color,
        };
      });

    const firstVisibleButton = Array.from(document.querySelectorAll('button, a[href]')).find(visible);
    const primaryPage = pageSelectors.map((selector) => rectOf(selector)).find(Boolean);
    const modal = rectOf('.ant-modal-content');
    const modalFooter = rectOf('.ant-modal-footer');
    const modalBody = rectOf('.ant-modal-body');
    const modalButtons = Array.from(document.querySelectorAll('.ant-modal-footer button'))
      .filter((el) => visible(el))
      .map(rectForElement);

    return {
      viewportName,
      stateName: currentStateName,
      url: window.location.href,
      bodyClasses: document.body.className,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
      rects: {
        primaryPage,
        loginRoot: rectOf('.shopee-login-root'),
        loginCard: rectOf('.shopee-login-card'),
        loginPanel: rectOf('.shopee-login-panel'),
        loginTabs: rectOf('.shopee-login-tabs'),
        loginQuickLinks: rectOf('.shopee-login-quickLinks'),
        loginLinks: rectOf('.shopee-login-links'),
        registerPage: rectOf('.register-page'),
        registerPanel: rectOf('.register-page__panel'),
        registerCard: rectOf('.register-page__card'),
        registerActions: rectOf('.register-page__actions'),
        orderTrackingPage: rectOf('.order-tracking-page'),
        orderLookupCard: rectOf('.order-tracking-page__lookupCard'),
        orderResultStack: rectOf('.order-tracking-page__resultStack'),
        orderNextAction: rectOf('.order-tracking-page__nextAction'),
        orderSteps: rectOf('.order-tracking-page__steps'),
        orderItem: rectOf('.order-tracking-page__item'),
        trackWidget: rectOf('.seventeen-track-widget'),
        modal,
        modalBody,
        modalFooter,
        bottomNav,
        support: rectOf('.app-support-launcher'),
        firstVisibleButton: rectForElement(firstVisibleButton),
      },
      counts: {
        paymentResult: document.querySelectorAll('.order-tracking-page__resultStack').length,
        visibleModals: Array.from(document.querySelectorAll('.ant-modal-content')).filter(visible).length,
        formErrors: formErrors.length,
      },
      overlaps: {
        modalFooterVsBottomNav: overlap(modalFooter, bottomNav),
        modalVsBottomNav: overlap(modal, bottomNav),
        loginLinksVsBottomNav: overlap(rectOf('.shopee-login-links'), bottomNav),
        registerCardVsBottomNav: overlap(rectOf('.register-page__card'), bottomNav),
        orderNextActionVsBottomNav: overlap(rectOf('.order-tracking-page__nextAction'), bottomNav),
      },
      modalButtons,
      smallTargets,
      tinyVisibleText,
      overflowElements,
      bottomObscured,
      formErrors,
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

async function gotoState(page, pathName, rootSelector) {
  await page.goto(`${baseUrl}${pathName}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForVisible(page, rootSelector);
  await page.waitForTimeout(1000);
}

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click().catch(() => undefined);
      return true;
    }
  }
  return false;
}

async function fillFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value).catch(() => undefined);
      return true;
    }
  }
  return false;
}

async function runAuthStates(page, viewport, snapshots) {
  await gotoState(page, '/login', '.shopee-login-root');
  await capture(page, viewport, 'login-password-initial', snapshots);

  await clickFirstVisible(page, ['.shopee-login-form button[type="submit"]', 'button:has-text("Login")']);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'login-password-validation', snapshots);

  await fillFirstVisible(page, ['input[autocomplete="username"]'], 'wrong-user@example.com');
  await fillFirstVisible(page, ['input[autocomplete="current-password"]'], 'badpass123');
  await clickFirstVisible(page, ['.shopee-login-form button[type="submit"]', 'button:has-text("Login")']);
  await page.waitForTimeout(800);
  await capture(page, viewport, 'login-password-server-error', snapshots);

  await clickFirstVisible(page, ['.ant-tabs-tab:has-text("Email")', '[role="tab"]:has-text("Email")']);
  await page.waitForTimeout(450);
  await capture(page, viewport, 'login-email-initial', snapshots);

  await clickFirstVisible(page, ['.shopee-login-emailSubmit', '.shopee-login-form--email button[type="submit"]']);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'login-email-validation', snapshots);

  await fillFirstVisible(page, ['.shopee-login-form--email input[autocomplete="email"]'], 'customer@example.com');
  await clickFirstVisible(page, ['.shopee-login-codeButton']);
  await page.waitForTimeout(800);
  await capture(page, viewport, 'login-email-code-sent', snapshots);

  await gotoState(page, '/register', '.register-page');
  await capture(page, viewport, 'register-initial', snapshots);

  await clickFirstVisible(page, ['.register-page__card button[type="submit"]']);
  await page.waitForTimeout(600);
  await capture(page, viewport, 'register-validation', snapshots);

  await fillFirstVisible(page, ['.register-page__card input[autocomplete="username"]'], 'mobilecustomer');
  await fillFirstVisible(page, ['.register-page__card input[autocomplete="new-password"]'], 'Password123');
  const passwords = page.locator('.register-page__card input[autocomplete="new-password"]');
  if (await passwords.count().catch(() => 0) > 1) {
    await passwords.nth(1).fill('Password123').catch(() => undefined);
  }
  await fillFirstVisible(page, ['.register-page__card input[autocomplete="email"]'], 'customer@example.com');
  await fillFirstVisible(page, ['.register-page__card input[autocomplete="tel"]'], '+14155550123');
  await clickFirstVisible(page, ['.register-page__card button[type="submit"]']);
  await page.waitForTimeout(800);
  await capture(page, viewport, 'register-email-code-required', snapshots);

  await gotoState(page, '/forgot-password', '.shopee-login-root--reset');
  await capture(page, viewport, 'forgot-password-initial', snapshots);

  await clickFirstVisible(page, ['.shopee-login-card--reset button[type="submit"]']);
  await page.waitForTimeout(600);
  await capture(page, viewport, 'forgot-password-validation', snapshots);

  await fillFirstVisible(page, ['.shopee-login-card--reset input[autocomplete="username"]'], 'mobilecustomer');
  await fillFirstVisible(page, ['.shopee-login-card--reset input[autocomplete="email"]'], 'customer@example.com');
  await clickFirstVisible(page, ['.shopee-login-card--reset .shopee-login-codeButton']);
  await page.waitForTimeout(800);
  await capture(page, viewport, 'forgot-password-code-sent', snapshots);
}

async function runOrderStates(page, viewport, snapshots) {
  await gotoState(page, '/track-order', '.order-tracking-page');
  await capture(page, viewport, 'order-tracking-initial', snapshots);

  await clickFirstVisible(page, ['.order-tracking-page__lookupButton']);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'order-tracking-validation', snapshots);

  await fillFirstVisible(page, ['.order-tracking-page__lookupForm input[maxlength="80"]', '.order-tracking-page__lookupForm input[autocomplete="off"]'], trackedOrder.orderNo);
  await fillFirstVisible(page, ['.order-tracking-page__lookupForm input[autocomplete="email"]'], 'customer@example.com');
  await clickFirstVisible(page, ['.order-tracking-page__lookupButton']);
  await page.waitForSelector('.order-tracking-page__resultStack', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);
  await capture(page, viewport, 'order-tracking-result-top', snapshots);

  await page.locator('.order-tracking-page__nextAction').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(400);
  await capture(page, viewport, 'order-tracking-next-action', snapshots);

  await clickFirstVisible(page, ['.order-tracking-page__nextAction button:has-text("Return")', 'button[title*="Return"]']);
  await page.waitForTimeout(600);
  if (await page.locator('.ant-modal-content').first().isVisible().catch(() => false)) {
    await capture(page, viewport, 'order-return-modal-open', snapshots);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);
  }

  await page.locator('.seventeen-track-widget').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(600);
  await capture(page, viewport, 'order-logistics-widget', snapshots);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel Audit) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 ShopTestAndroidApp/${viewport.name}`,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);

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

  const apiRequests = await installMocks(page);
  const snapshots = [];
  let error = null;

  try {
    await runAuthStates(page, viewport, snapshots);
    await runOrderStates(page, viewport, snapshots);
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

function isNoisySmallTarget(item) {
  const key = `${item.selector} ${item.text}`.toLowerCase();
  return key.includes('shop-nav__bottom')
    || key.includes('ant-scroll-number')
    || key.includes('ant-tabs-ink-bar')
    || key.includes('ant-input-clear-icon')
    || key.includes('skip');
}

function isNoisyOverflow(item) {
  const key = `${item.selector} ${item.text}`.toLowerCase();
  return key.includes('ant-message')
    || key.includes('ant-notification')
    || key.includes('shop-nav__mobile-authgrid')
    || key.includes('svg')
    || key.includes('ant-empty-img');
}

function isBottomNavText(item) {
  const key = `${item.selector} ${item.text}`.toLowerCase();
  return ['home', 'products', 'coupons', 'cart', 'account'].some((label) => key.includes(label))
    && item.top > 0;
}

function analyze(results) {
  const issues = [];
  for (const result of results) {
    for (const snapshot of result.snapshots) {
      const { viewportName, stateName } = snapshot;
      const modalOpen = snapshot.counts.visibleModals > 0;
      const meaningfulSmallTargets = snapshot.smallTargets.filter((item) => !isNoisySmallTarget(item));
      if (meaningfulSmallTargets.length) {
        issues.push({
          type: 'auth-order-small-touch-target',
          severity: 'medium',
          viewportName,
          stateName,
          evidence: {
            examples: meaningfulSmallTargets.slice(0, 6),
            screenshot: snapshot.screenshot,
          },
        });
      }

      const meaningfulTinyText = snapshot.tinyVisibleText.filter((item) => {
        const key = `${item.selector} ${item.text}`.toLowerCase();
        return !key.includes('ant-scroll-number') && !key.includes('badge');
      });
      if (meaningfulTinyText.length) {
        const orderStepTinyText = meaningfulTinyText.filter((item) => (
          ['Order placed', 'Preparing', 'In transit', 'Delivered'].includes(item.text)
        ));
        const orderStepsVisibleInViewport = snapshot.rects.orderSteps
          && snapshot.rects.orderSteps.bottom > 0
          && snapshot.rects.orderSteps.top < snapshot.innerHeight;
        if (!modalOpen && orderStepTinyText.length && orderStepsVisibleInViewport && snapshot.rects.orderSteps.scrollWidth > snapshot.rects.orderSteps.clientWidth + 1) {
          issues.push({
            type: 'order-tracking-journey-step-labels-too-small-clipped',
            severity: 'medium',
            viewportName,
            stateName,
            evidence: {
              orderSteps: snapshot.rects.orderSteps,
              examples: orderStepTinyText.slice(0, 6),
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      const meaningfulOverflow = snapshot.overflowElements.filter((item) => !isNoisyOverflow(item));
      if (snapshot.horizontalOverflow && meaningfulOverflow.length) {
        issues.push({
          type: 'auth-order-horizontal-overflow',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            docWidth: snapshot.docWidth,
            bodyWidth: snapshot.bodyWidth,
            innerWidth: snapshot.innerWidth,
            examples: meaningfulOverflow.slice(0, 6),
            screenshot: snapshot.screenshot,
          },
        });
      }

      const hiddenByNav = snapshot.bottomObscured.filter((item) => !String(item.selector).includes('shop-nav__bottomItem'));
      if (!modalOpen && hiddenByNav.length) {
        issues.push({
          type: 'order-tracking-actions-bottom-nav-obscured',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            examples: hiddenByNav.slice(0, 6),
            bottomNav: snapshot.rects.bottomNav,
            screenshot: snapshot.screenshot,
          },
        });
      }

      const modalFooterOverlap = snapshot.overlaps.modalFooterVsBottomNav;
      if (modalFooterOverlap?.overlaps) {
        issues.push({
          type: 'order-tracking-return-modal-footer-bottom-nav-overlap',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            overlap: modalFooterOverlap,
            modalFooter: snapshot.rects.modalFooter,
            bottomNav: snapshot.rects.bottomNav,
            modalButtons: snapshot.modalButtons,
            screenshot: snapshot.screenshot,
          },
        });
      }

      if (stateName === 'order-tracking-result-top' && snapshot.counts.paymentResult === 0) {
        issues.push({
          type: 'order-tracking-result-not-rendered',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            screenshot: snapshot.screenshot,
            apiRequests: result.apiRequests.filter((request) => request.pathname === '/api/orders/track'),
          },
        });
      }

      if (stateName === 'order-return-modal-open' && snapshot.counts.visibleModals === 0) {
        issues.push({
          type: 'order-return-modal-not-rendered',
          severity: 'medium',
          viewportName,
          stateName,
          evidence: {
            screenshot: snapshot.screenshot,
          },
        });
      }
    }
  }
  return issues;
}

function summarizeIssueTypes(issues) {
  return [...new Set(issues.map((issue) => issue.type))].sort();
}

function writeReport(results, issues) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    mockScope: [
      '/api/app/config',
      '/api/auth/login',
      '/api/auth/email-code',
      '/api/auth/email-login',
      '/api/auth/register',
      '/api/auth/password-reset-code',
      '/api/auth/forgot-password',
      '/api/orders/track',
      '/api/logistics/*',
      'shared nav count endpoints',
    ],
    results,
    issues,
    consoleMessageCount: results.reduce((sum, result) => sum + result.consoleMessages.length, 0),
    networkFailureCount: results.reduce((sum, result) => sum + result.networkFailures.length, 0),
    runErrors: results.filter((result) => result.error),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Mobile App Auth and Order Tracking UI Audit');
  lines.push('');
  lines.push(`Date: ${report.generatedAt}`);
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push('Mode: Playwright, mocked APIs, Android App WebView simulation.');
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('- Viewports: `320x568`, `390x844`.');
  lines.push('- States: login password initial/validation/server error, login email initial/validation/code sent, register initial/validation/email-code-required, forgot password initial/validation/code sent, order tracking initial/validation/result/next action/return modal/logistics widget.');
  lines.push('- Mock scope: app config, auth endpoints, password reset endpoints, order tracking, logistics tracking, nav count endpoints.');
  lines.push('- Evidence: `report.json` plus viewport screenshots in this directory.');
  lines.push(`- Console warnings/errors: ${report.consoleMessageCount}; network failures: ${report.networkFailureCount}; run errors: ${report.runErrors.length}.`);
  lines.push('');
  lines.push('## Automated Findings');
  lines.push('');
  if (!issues.length) {
    lines.push('- No new auth/order UI findings were promoted by the geometry checks.');
  } else {
    for (const issue of issues) {
      lines.push(`- ${issue.severity.toUpperCase()} ${issue.type} (${issue.viewportName}, ${issue.stateName}) screenshot: \`${issue.evidence.screenshot}\``);
    }
  }
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), `${lines.join('\n')}\n`);
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const viewport of viewports) {
    results.push(await runViewport(browser, viewport));
  }
  await browser.close();
  const issues = analyze(results);
  writeReport(results, issues);
  console.log(JSON.stringify({
    outDir,
    viewportCount: viewports.length,
    issueCount: issues.length,
    issueTypes: summarizeIssueTypes(issues),
    runErrors: results.filter((result) => result.error).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
