const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T-checkout-flow-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320-app', width: 320, height: 568 },
  { name: 'phone-390-app', width: 390, height: 844 },
];

const product = {
  id: 101,
  name: 'Ultra-comfort orthopedic dog sofa bed with removable washable cover and reinforced bolsters',
  description: 'Stress fixture for mobile checkout rows, totals, and long labels.',
  price: 129.99,
  effectivePrice: 129.99,
  originalPrice: 179.99,
  discount: 28,
  stock: 8,
  categoryId: 1,
  categoryName: 'Beds & furniture',
  imageUrl: '/assets/placeholders/product.svg',
  images: ['/assets/placeholders/product.svg'],
  brand: 'PawNest Wellness International',
  tag: 'hot',
  status: 'ACTIVE',
  freeShipping: true,
  specifications: { Size: 'Large', Color: 'Charcoal' },
  variants: [],
  optionGroups: [],
};

const guestCartItem = {
  id: 9001,
  productId: product.id,
  quantity: 1,
  productName: product.name,
  imageUrl: product.imageUrl,
  price: product.price,
  stock: product.stock,
  productStatus: 'ACTIVE',
  selectedSpecs: 'Size: Large; Color: Sage green with extra-long option naming',
};

const order = {
  id: 8804,
  orderNo: 'SO-MOBILE-20260608-GUEST-CHECKOUT-LONG',
  status: 'PENDING_PAYMENT',
  totalAmount: 129.99,
  originalAmount: 129.99,
  discountAmount: 0,
  shippingFee: 0,
  paymentMethod: 'STRIPE',
  recipientName: 'Smoke Tester',
  recipientPhone: '+52 55 1234 5678',
  contactEmail: 'smoke@example.com',
  shippingAddress: 'Av Reforma 100, Piso 2, Colonia Centro, Ciudad de Mexico, MX 01000',
  createdAt: '2026-06-08T06:20:00Z',
};

const payment = {
  id: 7701,
  orderId: order.id,
  orderNo: order.orderNo,
  channel: 'STRIPE',
  status: 'PENDING',
  amount: order.totalAmount,
  paymentUrl: 'https://payments.example.test/session/mobile-checkout',
  createdAt: '2026-06-08T06:20:00Z',
};

const paymentChannels = [
  {
    code: 'STRIPE',
    displayName: 'Stripe',
    labelKey: 'pages.checkout.paymentStripe',
    descriptionKey: 'pages.checkout.paymentStripeDesc',
    badgeKey: 'pages.checkout.paymentInstant',
    market: 'GLOBAL',
    currency: 'USD',
    recommended: true,
    sortOrder: 1,
  },
  {
    code: 'PAYPAL',
    displayName: 'PayPal',
    labelKey: 'pages.checkout.paymentPaypal',
    descriptionKey: 'pages.checkout.paymentPaypalDesc',
    badgeKey: 'pages.checkout.paymentWallet',
    market: 'GLOBAL',
    currency: 'USD',
    sortOrder: 2,
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
  await page.addInitScript((item) => {
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
    localStorage.setItem('shop-guest-cart', JSON.stringify([item]));
    sessionStorage.clear();
    sessionStorage.setItem('checkoutCartItemIds', JSON.stringify([item.id]));
    sessionStorage.setItem('checkoutPaymentMethod', 'STRIPE');
  }, guestCartItem);

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
    if (pathname === '/api/categories') return fulfillJson(route, [{ id: 1, name: 'Beds & furniture', level: 1 }]);
    if (pathname === '/api/products') return fulfillJson(route, { items: [product], total: 1, page: 0, size: 12, totalPages: 1 });
    if (pathname === '/api/products/featured') return fulfillJson(route, [product]);
    if (pathname === '/api/products/add-on-candidates') return fulfillJson(route, []);
    if (pathname === '/api/products/by-ids') return fulfillJson(route, [product]);
    if (pathname === `/api/products/${product.id}`) return fulfillJson(route, product);
    if (pathname === '/api/cart/me') return fulfillJson(route, []);
    if (pathname === '/api/payments/channels') return fulfillJson(route, paymentChannels);
    if (pathname === '/api/orders/checkout/guest' && method === 'POST') return fulfillJson(route, order);
    if (pathname === '/api/payments' && method === 'POST') return fulfillJson(route, payment);
    if (/^\/api\/payments\/guest\/order\/\d+\/latest$/.test(pathname)) return fulfillJson(route, payment);
    if (/^\/api\/payments\/guest\/order\/\d+$/.test(pathname)) return fulfillJson(route, [payment]);
    if (pathname === '/api/support/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/notifications/me/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/wishlist/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/stock-alerts/me/count') return fulfillJson(route, { count: 0 });
    if (/^\/api\/reviews\/product\/\d+$/.test(pathname)) return fulfillJson(route, { averageRating: 0, reviews: [] });
    if (/^\/api\/product-questions\/product\/\d+$/.test(pathname)) return fulfillJson(route, []);
    if (/^\/api\/reviews\/product\/\d+\/reviewable-orders$/.test(pathname)) return fulfillJson(route, []);

    return fulfillJson(route, {});
  });
  return apiRequests;
}

function selectorFor(el) {
  if (!el) return '';
  const className = String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 140);
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${className ? `.${className}` : ''}`;
}

async function collectSnapshot(page, viewport, stateName) {
  return page.evaluate(({ viewportName, stateName: currentStateName }) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const localSelectorFor = (el) => {
      if (!el) return '';
      const className = String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 140);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${className ? `.${className}` : ''}`;
    };
    const rectOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(centerX, centerY);
      return {
        selector,
        text: textOf(el).slice(0, 240),
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
    const mobilePayBar = rectOf('.checkout-page__mobilePayBar');
    const submitButton = rectOf('.checkout-page__mobilePayBar .ant-btn, .checkout-page__submitButton');
    const support = rectOf('.app-support-launcher');
    const cascaderDropdown = rectOf('.ant-cascader-dropdown');
    const cascaderMenus = rectOf('.ant-cascader-dropdown .ant-cascader-menus');

    const interactiveSelector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      '[role="button"]',
      '.ant-select-selector',
      '.ant-cascader-picker',
      '.ant-cascader-menu-item',
      '.ant-radio-wrapper',
    ].join(',');

    const smallTargets = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 140) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
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
      .slice(0, 30);

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
      .slice(0, 30);

    const overflowElements = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const overflowRight = rect.right - window.innerWidth;
        const scrollOverflow = el.scrollWidth - el.clientWidth;
        if (overflowRight <= 1 && -rect.left <= 1 && scrollOverflow <= 1) return null;
        const style = window.getComputedStyle(el);
        return {
          selector: localSelectorFor(el),
          text: textOf(el).slice(0, 140),
          top: rect.top,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          overflowRight,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
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
          text: textOf(el).slice(0, 180),
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
          color: style.color,
        };
      });

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
        checkoutPage: rectOf('.checkout-page'),
        addressCard: rectOf('#checkout-address-card'),
        paymentCard: rectOf('#checkout-payment-card'),
        paymentMethod: rectOf('.checkout-page__paymentMethod'),
        submitReview: rectOf('.checkout-page__submitReview'),
        mobilePayBar,
        submitButton,
        bottomNav,
        support,
        cascaderDropdown,
        cascaderMenus,
      },
      paymentMethodCount: document.querySelectorAll('.checkout-page__paymentMethod').length,
      paymentUnavailableVisible: Array.from(document.querySelectorAll('body *')).some((el) => (
        visible(el) && /Payment methods are temporarily unavailable|支付方式暂时不可用|Los métodos de pago no están disponibles temporalmente/.test(textOf(el))
      )),
      overlaps: {
        mobilePayBarVsBottomNav: overlap(mobilePayBar, bottomNav),
        submitButtonVsBottomNav: overlap(submitButton, bottomNav),
        mobilePayBarVsSupport: overlap(mobilePayBar, support),
        submitButtonVsSupport: overlap(submitButton, support),
        cascaderVsBottomNav: overlap(cascaderDropdown, bottomNav),
      },
      smallTargets,
      bottomObscured,
      overflowElements,
      formErrors,
      visibleMessage: textOf(document.querySelector('.ant-message, .ant-notification')),
    };
  }, { viewportName: viewport.name, stateName });
}

async function screenshot(page, viewport, stateName) {
  const file = `${viewport.name}-${stateName}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  return file;
}

async function capture(page, viewport, stateName, snapshots) {
  const file = await screenshot(page, viewport, stateName);
  const snapshot = await collectSnapshot(page, viewport, stateName);
  snapshot.screenshot = file;
  snapshots.push(snapshot);
}

async function fillCheckoutForm(page) {
  await page.locator('input[placeholder="name@example.com"]').first().fill('smoke@example.com').catch(() => undefined);
  await page.locator('input[placeholder="Enter recipient name"]').first().fill('Smoke Tester With A Long Name').catch(() => undefined);
  await page.locator('input[placeholder="Enter phone number"]').first().fill('+525555123456').catch(() => undefined);
  await page.locator('textarea[placeholder="Enter street, number and references"]').first().fill('Av Reforma 100, Piso 2, Colonia Centro, Ciudad de Mexico, MX 01000').catch(() => undefined);
  await page.locator('input[placeholder="e.g. 10001"]').first().fill('01000').catch(() => undefined);
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
    await page.goto(`${baseUrl}/checkout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.checkout-page', { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1500);
    await capture(page, viewport, 'checkout-loaded', snapshots);

    await page.locator('#checkout-address-card').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);
    await capture(page, viewport, 'address-card', snapshots);

    const cascader = page.locator('#checkout-address-card .ant-cascader, #checkout-address-card .ant-cascader-picker').first();
    if (await cascader.isVisible().catch(() => false)) {
      await cascader.click();
      await page.waitForTimeout(500);
      await capture(page, viewport, 'address-cascader-open', snapshots);
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.waitForTimeout(250);
    }

    await fillCheckoutForm(page);
    await page.locator('#checkout-payment-card').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(600);
    await capture(page, viewport, 'payment-section-filled', snapshots);

    const submit = page.locator('.checkout-page__mobilePayBar .ant-btn, .checkout-page__submitButton').first();
    await submit.click({ trial: true }).catch(() => undefined);
    await page.waitForTimeout(400);
    await capture(page, viewport, 'submit-ready-trial', snapshots);

    await page.locator('input[placeholder="name@example.com"]').first().fill('bad-email').catch(() => undefined);
    await submit.click().catch(() => undefined);
    await page.waitForTimeout(800);
    await capture(page, viewport, 'validation-errors', snapshots);
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

function analyze(results) {
  const issues = [];
  for (const result of results) {
    for (const snapshot of result.snapshots) {
      const { viewportName, stateName } = snapshot;
      const mobileOverlap = snapshot.overlaps.mobilePayBarVsBottomNav;
      if (mobileOverlap?.overlaps) {
        issues.push({
          type: 'checkout-mobile-paybar-bottom-nav-overlap',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            overlap: mobileOverlap,
            mobilePayBar: snapshot.rects.mobilePayBar,
            bottomNav: snapshot.rects.bottomNav,
            screenshot: snapshot.screenshot,
          },
        });
      }
      const submitOverlap = snapshot.overlaps.submitButtonVsBottomNav;
      if (submitOverlap?.overlaps) {
        issues.push({
          type: 'checkout-submit-bottom-nav-overlap',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            overlap: submitOverlap,
            submitButton: snapshot.rects.submitButton,
            bottomNav: snapshot.rects.bottomNav,
            screenshot: snapshot.screenshot,
          },
        });
      }
      const cascader = snapshot.rects.cascaderDropdown;
      if (stateName === 'address-cascader-open' && cascader) {
        if (cascader.left < 0 || cascader.right > snapshot.innerWidth + 1 || cascader.bottom > snapshot.innerHeight + 1) {
          issues.push({
            type: 'checkout-address-cascader-overflows-viewport',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              cascader,
              viewport: { width: snapshot.innerWidth, height: snapshot.innerHeight },
              screenshot: snapshot.screenshot,
            },
          });
        }
      }
      const meaningfulSmallTargets = snapshot.smallTargets.filter((item) => {
        const key = `${item.selector} ${item.text}`.toLowerCase();
        return !key.includes('shop-nav__bottom')
          && !key.includes('skip')
          && !key.includes('ant-scroll-number')
          && !key.includes('ant-select-selection-search-input');
      });
      if (meaningfulSmallTargets.length) {
        issues.push({
          type: 'checkout-small-touch-target',
          severity: 'medium',
          viewportName,
          stateName,
          evidence: {
            examples: meaningfulSmallTargets.slice(0, 5),
            screenshot: snapshot.screenshot,
          },
        });
      }
      const hiddenByNav = snapshot.bottomObscured.filter((item) => !String(item.selector).includes('shop-nav__bottomItem'));
      if (hiddenByNav.length) {
        issues.push({
          type: 'checkout-control-bottom-nav-obscured',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            examples: hiddenByNav.slice(0, 5),
            screenshot: snapshot.screenshot,
          },
        });
      }
      const staleCascader = snapshot.rects.cascaderDropdown
        && ['payment-section-filled', 'submit-ready-trial', 'validation-errors'].includes(stateName);
      if (staleCascader) {
        issues.push({
          type: 'checkout-address-cascader-stays-open-after-scroll',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            cascader: snapshot.rects.cascaderDropdown,
            paymentCard: snapshot.rects.paymentCard,
            screenshot: snapshot.screenshot,
          },
        });
      }
      if (snapshot.paymentUnavailableVisible || snapshot.paymentMethodCount === 0) {
        issues.push({
          type: 'checkout-payment-methods-not-rendered',
          severity: 'high',
          viewportName,
          stateName,
          evidence: {
            paymentMethodCount: snapshot.paymentMethodCount,
            paymentUnavailableVisible: snapshot.paymentUnavailableVisible,
            paymentCard: snapshot.rects.paymentCard,
            screenshot: snapshot.screenshot,
          },
        });
      }
    }
  }
  return issues;
}

function writeReport(results, issues) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    results,
    issues,
    consoleMessageCount: results.reduce((sum, result) => sum + result.consoleMessages.length, 0),
    networkFailureCount: results.reduce((sum, result) => sum + result.networkFailures.length, 0),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Mobile App Checkout Flow UI Audit');
  lines.push('');
  lines.push(`Date: ${report.generatedAt}`);
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push('Mode: Playwright, mocked APIs, Android App WebView simulation.');
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('- Viewports: `320x568`, `390x844`.');
  lines.push('- States: guest checkout loaded, address card, address cascader open, filled payment section, submit-ready trial, validation errors.');
  lines.push('- Evidence: `report.json` plus viewport screenshots in this directory.');
  lines.push(`- Console warnings/errors: ${report.consoleMessageCount}; network failures: ${report.networkFailureCount}.`);
  lines.push('');
  lines.push('## Automated Findings');
  lines.push('');
  if (!issues.length) {
    lines.push('- No new checkout flow UI findings were promoted by the geometry checks.');
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
    issueTypes: [...new Set(issues.map((issue) => issue.type))],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
