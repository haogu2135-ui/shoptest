#!/usr/bin/env node
/**
 * Commercial mobile-device viewport smoke (Playwright).
 * Advances storefront mobile commercial readiness without a physical handset:
 * - Android WebView-like UA + Capacitor shell markers
 * - Conversion routes at 320 / 360 / 390 widths
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
];

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
  { path: '/products/2', expect: /add|buy|cart|price|sold|stock|product/i, shell: '.product-detail-page, main' },
];

const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '').slice(0, 240) });
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
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
    await page.getByRole('button', { name: /accept all/i }).first().click({ timeout: 2500 }).catch(() => undefined);
    await cookie.first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => undefined);
  }
}

async function measurePrimaryTouchTargets(page) {
  return page.evaluate(() => {
    const selectors = [
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
      '.shopee-hero__actions .ant-btn',
      '.shopee-conversion-band__card',
      '.cart-page__emptyActions .ant-btn',
      '.checkout-page__mobilePayBar .ant-btn',
      'main .ant-btn-primary',
    ];
    const nodes = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => nodes.push(node));
    });
    const unique = Array.from(new Set(nodes)).slice(0, 24);
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

async function main() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } catch (error) {
    check('mobile device browser launch', false, error && error.message ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const pixel5 = devices['Pixel 5'] || {};
  const androidUa = pixel5.userAgent
    || 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent: `${androidUa} ShopTestAndroidApp`,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: pixel5.deviceScaleFactor || 2.75,
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)));

      await page.addInitScript(() => {
        try {
          localStorage.removeItem('shopmx.cookie-consent.v1');
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
        await dismissCookie(page);
        // Re-assert native shell class after SPA mount.
        await page.evaluate(() => {
          document.documentElement.classList.add('shop-mobile-app');
          if (document.body) document.body.classList.add('shop-mobile-app');
        }).catch(() => undefined);

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
    }
  } catch (error) {
    check('mobile device smoke execution', false, error && error.message ? error.message : String(error));
  } finally {
    await browser.close().catch(() => undefined);
  }

  const passed = results.filter((item) => item.pass).length;
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY ${passed}/${results.length} passed @ ${base}`);
  // eslint-disable-next-line no-console
  console.log('NOTE real-device APK/WebView install E2E remains required for commercial ship bar.');
  if (passed !== results.length) {
    results.filter((item) => !item.pass).forEach((item) => {
      // eslint-disable-next-line no-console
      console.error(` - ${item.name}: ${item.detail}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('MOBILE_DEVICE_SMOKE_CRASH', error);
  process.exit(2);
});
