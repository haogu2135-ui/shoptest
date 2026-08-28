#!/usr/bin/env node

const logLine = (...parts) => {
  process.stdout.write(`${parts.map((part) => String(part)).join(' ')}\n`);
};
const logError = (...parts) => {
  process.stderr.write(`${parts.map((part) => String(part)).join(' ')}\n`);
};
/**
 * Commercial mobile-device viewport smoke (Playwright).
 * Advances storefront mobile commercial readiness without a physical handset:
 * - Android WebView-like UA + Capacitor shell markers
 * - Conversion routes at 320 / 360 / 390 widths plus short landscape phones
 * - Primary CTA 44px touch targets
 * - Product/checkout sticky rails not covered by bottom nav
 *
 * Usage:
 *   SHOPTEST_UI_BASE=http://127.0.0.1:4187 npm run test:commercial-mobile-device-smoke
 *
 * Real-device E2E remains required for the commercial ship bar (APK/WebView install).
 */
const { chromium, devices } = require('playwright');

const base = (process.env.SHOPTEST_UI_BASE || 'http://127.0.0.1:4187').replace(/\/$/, '');
const results = [];

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x740', width: 360, height: 740 },
  { name: '390x844', width: 390, height: 844 },
  { name: 'landscape-568x320', width: 568, height: 320 },
  { name: 'landscape-667x375', width: 667, height: 375 },
];
const requestedViewportNames = String(process.env.SHOPTEST_MOBILE_VIEWPORTS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const VIEWPORTS_TO_RUN = requestedViewportNames.length > 0
  ? VIEWPORTS.filter((viewport) => requestedViewportNames.includes(viewport.name))
  : VIEWPORTS;

const ROUTES = [
  { path: '/', expect: /product|shop|coupon|pet|browse|category/i, shell: '.shopee-home, main, #shop-main-content' },
  {
    path: '/products',
    expect: /([1-9]\d*)\s+products?|add to cart|\$\d+(?:\.\d{1,2})?|no products|no results|empty/i,
    softExpect: /product|filter|catalog|browse|coupon|empty/i,
    shell: '.product-list, main',
    settleAttempts: 30,
    requireCatalogSettled: true,
  },
  { path: '/cart', expect: /cart|browse|coupon|pet|history|empty/i, shell: '.cart-page, main' },
  { path: '/checkout', expect: /checkout|cart|browse|payment|empty|selected/i, shell: '.checkout-page, main' },
  { path: '/track-order', expect: /track|order|email|coupon|support|shop/i, shell: '.order-tracking-page, main' },
  { path: '/coupons', expect: /coupon|claim|browse|cart|empty/i, shell: '.coupon-center-page, main' },
  { path: '/seckill', expect: /flash sale|seckill|limited|empty|campaign/i, shell: '.seckill-page, main' },
  { path: '/products/2', expect: /add|buy|cart|price|sold|stock|product/i, shell: '.product-detail-page, main' },
];

const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '').slice(0, 240) });
  logLine(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function readMainText(page) {
  return page.evaluate(() => {
    const main = document.getElementById('shop-main-content')
      || document.getElementById('main-content')
      || document.querySelector('main')
      || document.querySelector('.ant-layout-content');
    if (!main) return { hasMain: false, text: '' };
    return {
      hasMain: true,
      text: (main.innerText || '').replace(/\s+/g, ' ').trim(),
    };
  });
}

async function waitForMainContent(page, predicate, attempts = 14) {
  let last = { hasMain: false, text: '' };
  for (let i = 0; i < attempts; i += 1) {
    last = await readMainText(page);
    if (last.hasMain && predicate(last)) return last;
    await page.waitForTimeout(400);
  }
  return last;
}

async function dismissCookie(page) {
  const cookie = page.locator('.cookie-consent-banner');
  if (await cookie.count()) {
    await page.getByRole('button', { name: /accept all|aceptar todo/i }).first().click({ timeout: 2500 }).catch(() => undefined);
    await cookie.first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
  }
}

async function measureCookieConsentLayout(page) {
  return page.evaluate(() => {
    const rectFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const banner = document.querySelector('.cookie-consent-banner');
    const links = Array.from(document.querySelectorAll('.cookie-consent-banner__link'));
    const buttons = Array.from(document.querySelectorAll('.cookie-consent-banner__button'));
    const heroActions = Array.from(document.querySelectorAll('.shopee-hero__actions .home-btn'));
    const bottomBar = document.querySelector('.shop-nav__bottomBar');
    const bannerRect = rectFor(banner);
    const bottomBarRect = rectFor(bottomBar);
    const linkRects = links.map(rectFor);
    const buttonRects = buttons.map(rectFor);
    const heroActionRects = heroActions.map(rectFor).filter(Boolean);
    const overlap = (first, second) => Boolean(
      first && second
      && first.bottom > second.top + 1
      && first.top < second.bottom - 1,
    );
    return {
      banner: bannerRect,
      bottomBar: bottomBarRect,
      links: linkRects,
      buttons: buttonRects,
      heroActions: heroActionRects,
      legalLinksSameRow: linkRects.length === 2 && Math.abs(linkRects[0].top - linkRects[1].top) <= 1,
      bannerOverlapsBottomBar: overlap(bannerRect, bottomBarRect),
      heroActionOverlapsBanner: heroActionRects.some((rect) => overlap(rect, bannerRect)),
      minLinkHeight: linkRects.length ? Math.min(...linkRects.map((rect) => rect.height)) : 0,
      minButtonHeight: buttonRects.length ? Math.min(...buttonRects.map((rect) => rect.height)) : 0,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function measureCookieConsentCriticalContent(page, routePath) {
  return page.evaluate((path) => {
    const selectorsByRoute = {
      '/login': [
        '.shopee-login-form input',
        '.shopee-login-form button[type="submit"]',
      ],
      '/products/2': [
        '.product-mobile-buybar__cart',
        '.product-mobile-buybar__buy',
      ],
      '/cart': [
        '.cart-page__emptyActions .ant-btn:nth-of-type(-n+2)',
        '.cart-page__summary .ant-btn-primary',
      ],
      '/checkout': [
        '.checkout-page__emptyActions .ant-btn:nth-of-type(-n+2)',
        '.checkout-page__mobilePayBar .ant-btn',
        '.checkout-page__submitReview .ant-btn-primary',
      ],
    };
    const rectFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };
    const banner = document.querySelector('.cookie-consent-banner');
    const bannerRect = rectFor(banner);
    const selectors = selectorsByRoute[path] || [];
    const nodes = Array.from(new Set(selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))));
    const targets = nodes.map((element) => {
      const rect = rectFor(element);
      const style = window.getComputedStyle(element);
      return {
        selector: element.className || element.tagName,
        rect,
        visible: Boolean(rect && rect.width > 0 && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden'),
      };
    }).filter((item) => item.visible);
    const overlaps = (first, second) => Boolean(
      first && second
      && first.bottom > second.top + 1
      && first.top < second.bottom - 1
      && first.right > second.left + 1
      && first.left < second.right - 1,
    );
    return {
      route: path,
      banner: bannerRect,
      targetCount: targets.length,
      targets,
      overlapCount: targets.filter((target) => overlaps(target.rect, bannerRect)).length,
    };
  }, routePath);
}

async function measurePrimaryTouchTargets(page) {
  return page.evaluate(() => {
    const selectors = [
      '[data-commercial-primary-cta]',
      '.cart-page__emptyActions .ant-btn',
      '.cart-page__emptyPanelActions .ant-btn',
      '.checkout-page__emptyActions .ant-btn',
      '.checkout-page__mobilePayBar .ant-btn',
      '.product-mobile-buybar .ant-btn',
      '.product-mobile-buybar__cart',
      '.product-mobile-buybar__buy',
      '.product-actions .ant-btn-primary',
      '.order-tracking-page__notShippedActions .ant-btn',
      '.page-feedback__actions .ant-btn',
      '.shopee-hero__actions .home-btn',
      '.shopee-hero__authActions .home-btn',
      '.shopee-hero__featuredActions .home-btn',
      '.shopee-conversion-band__card',
      '.cart-page__emptyActions .ant-btn',
      '.checkout-page__mobilePayBar .ant-btn',
      'main .ant-btn-primary',
    ];
    const nodes = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => nodes.push(node));
    });
    const unique = Array.from(new Set(nodes)).slice(0, 32);
    const samples = unique.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const height = Math.max(rect.height, parseFloat(style.minHeight) || 0);
      return {
        height,
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      };
    }).filter((item) => item.visible);
    if (!samples.length) return { count: 0, minHeight: 0, under44: 0 };
    const heights = samples.map((item) => item.height);
    return {
      count: samples.length,
      minHeight: Math.min(...heights),
      under44: heights.filter((height) => height < 44).length,
    };
  });
}

async function measureStickyRailClearance(page) {
  return page.evaluate(() => {
    const bottomBar = document.querySelector('.shop-nav__bottomBar');
    const sticky = document.querySelector('.product-mobile-buybar, .checkout-page__mobilePayBar');
    if (!sticky) return { sticky: false, bottomVisible: false, overlap: false, stickyBottom: null };
    const stickyRect = sticky.getBoundingClientRect();
    const bottomVisible = Boolean(
      bottomBar
      && window.getComputedStyle(bottomBar).display !== 'none'
      && bottomBar.getBoundingClientRect().height > 0,
    );
    let overlap = false;
    if (bottomVisible) {
      const bottomRect = bottomBar.getBoundingClientRect();
      overlap = stickyRect.bottom > bottomRect.top + 2 && stickyRect.top < bottomRect.bottom - 2;
    }
    return {
      sticky: true,
      bottomVisible,
      overlap,
      stickyBottom: Math.round(stickyRect.bottom),
      viewportHeight: window.innerHeight,
    };
  });
}

async function runSeckillPurchaseFixture(page, viewport) {
  const campaign = {
    id: 901,
    title: 'Mobile fixture flash sale',
    subtitle: 'Deterministic mobile purchase fixture',
    status: 'PUBLISHED',
    state: 'ONGOING',
    startAt: new Date(Date.now() - 60_000).toISOString(),
    endAt: new Date(Date.now() + 3_600_000).toISOString(),
    items: [{
      id: 902,
      productId: 2,
      productName: 'Fixture product',
      imageUrl: '',
      originalPrice: 19.9,
      seckillPrice: 9.9,
      quota: 10,
      sold: 0,
      remaining: 10,
      limitPerUser: 2,
      optionGroups: [],
    }],
  };
  const profile = {
    id: 7,
    username: 'mobile-fixture',
    email: 'mobile-fixture@example.com',
    role: 'USER',
    roleCode: 'USER',
  };
  const paymentChannels = [{ code: 'MERCADO_PAGO', displayName: 'Mercado Pago' }];
  const jsonResponse = (body) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  const routeHandlers = [
    ['**/api/seckill/campaigns', (route) => route.fulfill(jsonResponse([campaign]))],
    ['**/api/users/profile', (route) => route.fulfill(jsonResponse(profile))],
    ['**/api/payments/channels', (route) => route.fulfill(jsonResponse(paymentChannels))],
    // The native navbar hydrates these badges as soon as a session exists.
    // Keep the fixture authenticated without letting unrelated 401s clear it.
    ['**/api/cart/me', (route) => route.fulfill(jsonResponse([]))],
    ['**/api/notifications/me/unread-count', (route) => route.fulfill(jsonResponse({ count: 0 }))],
    ['**/api/wishlist/me/count', (route) => route.fulfill(jsonResponse({ count: 0 }))],
    ['**/api/coupons/me/available', (route) => route.fulfill(jsonResponse([]))],
    ['**/api/support/unread-count', (route) => route.fulfill(jsonResponse({ count: 0 }))],
  ];

  for (const [pattern, handler] of routeHandlers) {
    await page.route(pattern, handler);
  }

  try {
    await page.evaluate(() => {
      localStorage.setItem('token', 'mobile-fixture-token');
      localStorage.removeItem('shopmx.cookie-consent.v1');
    });
    const response = await page.goto(`${base}/seckill`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    check(`${viewport.name} seckill fixture status`, Boolean(response && response.status() === 200), response && response.status());
    const consent = page.locator('.cookie-consent-banner');
    await consent.waitFor({ state: 'visible', timeout: 10000 });
    check(`${viewport.name} seckill fixture shows first-visit consent`, await consent.isVisible());
    const seckillCta = page.locator('.seckill-item button').first();
    await seckillCta.waitFor({ state: 'visible', timeout: 20000 });
    await seckillCta.scrollIntoViewIfNeeded();
    const consentCtaLayout = await page.evaluate(() => {
      const banner = document.querySelector('.cookie-consent-banner');
      const button = document.querySelector('.seckill-item button');
      if (!banner || !button) return { present: false, overlap: true };
      const bannerRect = banner.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        present: true,
        overlap: buttonRect.bottom > bannerRect.top + 1
          && buttonRect.top < bannerRect.bottom - 1
          && buttonRect.right > bannerRect.left + 1
          && buttonRect.left < bannerRect.right - 1,
        buttonBottom: Math.round(buttonRect.bottom),
        bannerTop: Math.round(bannerRect.top),
      };
    });
    check(
      `${viewport.name} seckill CTA remains scroll-reachable with consent open`,
      consentCtaLayout.present && !consentCtaLayout.overlap,
      JSON.stringify(consentCtaLayout),
    );
    await consent.getByRole('button', { name: /accept all|aceptar todo/i }).click({ timeout: 5000 });
    await consent.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
    // The live countdown re-renders the campaign once per second. Invoke the
    // browser click on the current node without waiting for that repaint to
    // settle; this still exercises the component's real React handler.
    await page.locator('.seckill-item button').first().evaluate((element) => {
      element.click();
    });
    const dialog = page.locator('.seckill-purchase[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    const openState = await page.evaluate(() => {
      const cookie = document.querySelector('.cookie-consent-banner');
      const purchase = document.querySelector('.seckill-purchase');
      return {
        bodyClass: document.body.classList.contains('shop-seckill-purchase-open'),
        overflow: document.body.style.overflow,
        cookieDisplay: cookie ? window.getComputedStyle(cookie).display : 'missing',
        dialogZIndex: purchase ? Number.parseInt(window.getComputedStyle(purchase.parentElement).zIndex || '0', 10) : 0,
      };
    });
    check(`${viewport.name} seckill fixture has no stale consent overlay`, openState.bodyClass && openState.cookieDisplay === 'missing', JSON.stringify(openState));
    check(`${viewport.name} seckill fixture locks background`, openState.overflow === 'hidden', openState.overflow);
    check(`${viewport.name} seckill fixture owns overlay stack`, openState.dialogZIndex >= 10010, openState.dialogZIndex);

    const emptyPurchaseValidity = await page.evaluate(() => {
      const form = document.querySelector('.seckill-purchase__form');
      if (!(form instanceof HTMLFormElement)) return { present: false, valid: true };
      return { present: true, valid: form.checkValidity() };
    });
    check(
      viewport.name + ' seckill fixture blocks incomplete purchase locally',
      emptyPurchaseValidity.present && emptyPurchaseValidity.valid === false,
      JSON.stringify(emptyPurchaseValidity),
    );

    await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const submitRect = await page.locator('.seckill-purchase button[type="submit"]').boundingBox();
    check(
      `${viewport.name} seckill fixture submit reachable`,
      Boolean(submitRect && submitRect.height >= 44 && submitRect.y >= 0 && submitRect.y + submitRect.height <= viewport.height),
      submitRect ? JSON.stringify({ top: Math.round(submitRect.y), bottom: Math.round(submitRect.y + submitRect.height), height: Math.round(submitRect.height) }) : 'missing',
    );

    await page.locator('.seckill-purchase__close').click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    const closedState = await page.evaluate(() => ({
      bodyClass: document.body.classList.contains('shop-seckill-purchase-open'),
      cookieDisplay: document.querySelector('.cookie-consent-banner')
        ? window.getComputedStyle(document.querySelector('.cookie-consent-banner')).display
        : 'missing',
    }));
    check(`${viewport.name} seckill fixture keeps consent dismissed`, !closedState.bodyClass && closedState.cookieDisplay !== 'none', JSON.stringify(closedState));
  } finally {
    for (const [pattern] of routeHandlers) {
      await page.unroute(pattern).catch(() => undefined);
    }
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('shopmx.cookie-consent.v1');
    }).catch(() => undefined);
  }
}

async function main() {
  let browser;
  const browserLaunchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };

  const pixel5 = devices['Pixel 5'] || {};
  const androidUa = pixel5.userAgent
    || 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  try {
    for (const viewport of VIEWPORTS_TO_RUN) {
      let viewportAttempt = 0;
      let viewportCompleted = false;
      while (!viewportCompleted && viewportAttempt < 2) {
        const viewportResultStart = results.length;
        viewportAttempt += 1;
        try {
      // Keep each phone width in a fresh Chromium process. Long SPA route
      // matrices can otherwise leave WebView-like pages competing for the
      // same renderer and make a later viewport fail with "Target ... closed".
      browser = await chromium.launch(browserLaunchOptions);
      const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          userAgent: `${androidUa} ShopTestAndroidApp`,
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: pixel5.deviceScaleFactor || 2.75,
        });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)));

      await page.addInitScript(() => {
        try {
          localStorage.removeItem('shopmx.cookie-consent.v1');
          // Deterministic English probes; production ShopMX home language seeds Spanish.
          localStorage.setItem('shop-language', 'en');
          localStorage.setItem('currency', 'MXN');
        } catch (error) {
          // ignore
        }
        try {
          window.Capacitor = window.Capacitor || { isNativePlatform: () => true, getPlatform: () => 'android' };
          document.documentElement.classList.add('shop-mobile-app');
          document.body && document.body.classList.add('shop-mobile-app');
        } catch (error) {
          // ignore
        }
      });

      for (const route of ROUTES) {
        // Re-open consent on every route so fixed-panel coverage is measured
        // for the actual mobile conversion surface, not just the homepage.
        await page.evaluate(() => localStorage.removeItem('shopmx.cookie-consent.v1')).catch(() => undefined);
        const response = await page.goto(`${base}${route.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        }).catch((error) => {
          check(`${viewport.name} ${route.path} navigation`, false, error.message || String(error));
          return null;
        });
        if (!response) continue;
        check(
          `${viewport.name} ${route.path} status`,
          response.status() === 200,
          String(response.status()),
        );
        await page.waitForSelector('#root', { timeout: 20000 }).catch(() => undefined);
        if (route.path === '/') {
          await page.locator('.cookie-consent-banner').waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
          const cookieLayout = await measureCookieConsentLayout(page);
          check(
            `${viewport.name} / cookie consent legal links stay on one row`,
            cookieLayout.legalLinksSameRow,
            `links=${cookieLayout.links.length}`,
          );
          check(
            `${viewport.name} / cookie consent touch targets >=44px`,
            cookieLayout.minLinkHeight >= 44 && cookieLayout.minButtonHeight >= 44,
            `links=${Math.round(cookieLayout.minLinkHeight)} buttons=${Math.round(cookieLayout.minButtonHeight)}`,
          );
          check(
            `${viewport.name} / cookie consent clear of bottom nav`,
            !cookieLayout.bannerOverlapsBottomBar,
            `bannerBottom=${Math.round(cookieLayout.banner?.bottom || 0)} navTop=${Math.round(cookieLayout.bottomBar?.top || 0)}`,
          );
          check(
            `${viewport.name} / cookie consent clear of home hero actions`,
            !cookieLayout.heroActionOverlapsBanner,
            `heroActions=${cookieLayout.heroActions.length} bannerTop=${Math.round(cookieLayout.banner?.top || 0)}`,
          );
          check(
            `${viewport.name} / cookie consent no horizontal overflow`,
            !cookieLayout.horizontalOverflow,
          );
        }

        const attempts = route.settleAttempts || 14;
        const isCatalogSettled = (text) => {
          const populated = /([1-9]\d*)\s+products?/i.test(text)
            || /add to cart/i.test(text)
            || /\$\d+(?:\.\d{1,2})?/i.test(text)
            || /no products|no results|empty catalog|try different/i.test(text);
          const stillLoadingOnly = /loading/i.test(text)
            && !/([1-9]\d*)\s+products?/i.test(text)
            && !/add to cart/i.test(text)
            && !/\$\d+(?:\.\d{1,2})?/i.test(text);
          return populated && !stillLoadingOnly;
        };
        const mainInfo = await waitForMainContent(
          page,
          (info) => {
            if (!info.hasMain || info.text.length <= 24) return false;
            if (route.requireCatalogSettled) return isCatalogSettled(info.text);
            if (route.expect.test(info.text)) return true;
            if (route.softExpect && route.softExpect.test(info.text) && !/loading/i.test(info.text)) return true;
            return false;
          },
          attempts,
        );
        const contentOk = mainInfo.hasMain && (
          (route.requireCatalogSettled && isCatalogSettled(mainInfo.text))
          || route.expect.test(mainInfo.text)
          || (route.softExpect && route.softExpect.test(mainInfo.text) && mainInfo.text.length > 24)
        );
        check(
          `${viewport.name} ${route.path} main content`,
          contentOk,
          mainInfo.text.slice(0, 120),
        );
        if (route.path === '/products') {
          check(
            `${viewport.name} /products catalog settled`,
            isCatalogSettled(mainInfo.text),
            mainInfo.text.slice(0, 120),
          );
        }

        if (['/login', '/products/2', '/cart', '/checkout'].includes(route.path)) {
          const consent = page.locator('.cookie-consent-banner');
          await consent.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
          const criticalLayout = await measureCookieConsentCriticalContent(page, route.path);
          check(
            `${viewport.name} ${route.path} consent exposes critical targets`,
            criticalLayout.targetCount > 0,
            `targets=${criticalLayout.targetCount}`,
          );
          check(
            `${viewport.name} ${route.path} consent does not cover critical targets`,
            criticalLayout.overlapCount === 0,
            `overlaps=${criticalLayout.overlapCount} bannerTop=${Math.round(criticalLayout.banner?.top || 0)} targets=${criticalLayout.targets.map((target) => `${Math.round(target.rect.top)}-${Math.round(target.rect.bottom)}`).join(',')}`,
          );
        }

        await dismissCookie(page);
        // Re-assert native shell class after SPA mount.
        await page.evaluate(() => {
          document.documentElement.classList.add('shop-mobile-app');
          if (document.body) document.body.classList.add('shop-mobile-app');
        }).catch(() => undefined);

        const shellCount = await page.locator(route.shell).count();
        check(
          `${viewport.name} ${route.path} surface shell`,
          shellCount >= 1,
          `shell=${shellCount}`,
        );

        const touch = await measurePrimaryTouchTargets(page);
        if (touch.count > 0) {
          check(
            `${viewport.name} ${route.path} primary touch targets >=44px`,
            touch.under44 === 0 && touch.minHeight >= 44,
            `count=${touch.count} min=${Math.round(touch.minHeight)} under44=${touch.under44}`,
          );
        } else {
          check(
            `${viewport.name} ${route.path} primary touch targets >=44px`,
            true,
            'no-primary-cta-sample-skip',
          );
        }

        if (route.path === '/') {
          const seckillEntry = page.locator('[data-commercial-primary-cta="home-mobile-seckill"]');
          await seckillEntry.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
          const seckillBox = await seckillEntry.boundingBox().catch(() => null);
          check(
            `${viewport.name} home exposes flash-sale entry`,
            Boolean(seckillBox && seckillBox.height >= 44 && seckillBox.width > 0),
            seckillBox ? JSON.stringify({ width: Math.round(seckillBox.width), height: Math.round(seckillBox.height) }) : 'missing',
          );
          let seckillHitTarget = false;
          for (let attempt = 0; attempt < 12 && !seckillHitTarget; attempt += 1) {
            seckillHitTarget = await seckillEntry.evaluate((element) => {
              const entryRect = element.getBoundingClientRect();
              const bottomBar = document.querySelector('.shop-nav__bottomBar');
              if (!bottomBar || window.getComputedStyle(bottomBar).display === 'none') return true;
              const navRect = bottomBar.getBoundingClientRect();
              return entryRect.bottom <= navRect.top + 1 || entryRect.top >= navRect.bottom - 1;
            }).catch(() => false);
            if (!seckillHitTarget) await page.waitForTimeout(250);
          }
          check(
            `${viewport.name} home flash-sale entry is not covered`,
            seckillHitTarget,
          );
          let seckillEntryNavigates = false;
          try {
            // Countdown/catalog repaints can make a physical Playwright click
            // retry while the button is already actionable. The hit-target
            // assertion above keeps coverage of real mobile occlusion while
            // DOM click makes the navigation check deterministic.
            await seckillEntry.evaluate((element) => element.click());
            await page.waitForURL(/\/seckill(?:\/|$)/, { timeout: 10000 });
            seckillEntryNavigates = true;
          } catch (error) {
            seckillEntryNavigates = false;
          }
          check(
            `${viewport.name} home flash-sale entry navigates`,
            seckillEntryNavigates,
            page.url(),
          );
        }

        if (route.path === '/products/2' || route.path === '/checkout') {
          const rail = await measureStickyRailClearance(page);
          if (rail.sticky) {
            check(
              `${viewport.name} ${route.path} sticky rail clear of bottom nav`,
              !rail.overlap,
              `bottomVisible=${rail.bottomVisible} overlap=${rail.overlap} stickyBottom=${rail.stickyBottom}`,
            );
          } else {
            check(
              `${viewport.name} ${route.path} sticky rail clear of bottom nav`,
              true,
              'sticky-rail-not-rendered',
            );
          }
        }
      }

      await runSeckillPurchaseFixture(page, viewport);

      // Cart empty multipath remains reachable on commercial phone widths.
      await page.goto(`${base}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#root', { timeout: 20000 }).catch(() => undefined);
      await dismissCookie(page);
      const cartMain = await waitForMainContent(
        page,
        (info) => info.hasMain && info.text.length > 24 && (/cart|browse|coupon|empty|item|checkout/i.test(info.text)),
        16,
      );
      const cartText = cartMain.text || '';
      const multipathHits = [
        /browse/i.test(cartText),
        /coupon/i.test(cartText),
        /pet finder|finder|pet/i.test(cartText),
        /history|recent/i.test(cartText),
      ].filter(Boolean).length;
      check(
        `${viewport.name} cart empty multipath`,
        multipathHits >= 3 || /item|qty|total|checkout|selected/i.test(cartText),
        `hits=${multipathHits} text=${cartText.slice(0, 100)}`,
      );

      check(
        `${viewport.name} no page errors`,
        pageErrors.length === 0,
        pageErrors.slice(0, 3).join(' | '),
      );
        await context.close();
      } finally {
        await browser.close().catch(() => undefined);
        browser = null;
      }
          viewportCompleted = true;
        } catch (error) {
          // A renderer can disappear under the host memory ceiling during a
          // long route matrix. Retry the whole viewport without keeping partial
          // assertions that would make the final report misleading.
          results.splice(viewportResultStart);
          await browser?.close().catch(() => undefined);
          browser = null;
          if (viewportAttempt >= 2) {
            check(`${viewport.name} smoke execution`, false, error && error.message ? error.message : String(error));
          }
        }
      }
    }
  } catch (error) {
    check('mobile device smoke execution', false, error && error.message ? error.message : String(error));
  } finally {
    await browser?.close().catch(() => undefined);
  }

  const passed = results.filter((item) => item.pass).length;
  logLine(`\nSUMMARY ${passed}/${results.length} passed @ ${base}`);
  logLine('NOTE real-device APK/WebView install E2E remains required for commercial ship bar.');
  if (passed !== results.length) {
    results.filter((item) => !item.pass).forEach((item) => {
      logError(` - ${item.name}: ${item.detail}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  logError('MOBILE_DEVICE_SMOKE_CRASH', error);
  process.exit(2);
});
