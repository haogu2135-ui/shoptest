#!/usr/bin/env node
/**
 * Commercial browser smoke (Playwright) for ShopMX storefront.
 * Requires local UI at SHOPTEST_UI_BASE (default http://127.0.0.1:4187).
 */
const { chromium } = require('playwright');

const base = (process.env.SHOPTEST_UI_BASE || 'http://127.0.0.1:4187').replace(/\/$/, '');
const results = [];

const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '').slice(0, 240) });
  // eslint-disable-next-line no-console
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } catch (error) {
    check('browser launch', false, error && error.message ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)));

  try {
    const home = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    check('home status 200', Boolean(home && home.status() === 200), home && home.status());
    await page.waitForSelector('#root', { timeout: 20000 });
    await page.waitForSelector(`#${'main-content'}, main, [id="main-content"]`, { timeout: 20000 }).catch(() => null);
    // Give lazy navbar/home time to paint commercial content.
    await page.waitForTimeout(3000);
    const homeText = await page.locator('body').innerText();
    check('home commercial content', /product|pet|shop|coupon|category|browse|device/i.test(homeText), homeText.replace(/\s+/g, ' ').slice(0, 120));
    check('skip link present', /skip to main content/i.test(homeText));

    const routes = [
      { path: '/cart', expect: /cart|empty|checkout|coupon|browse/i },
      { path: '/checkout', expect: /checkout|cart|empty|payment|shipping|guest|login|address/i },
      { path: '/track-order', expect: /track|order|email|search|lookup/i },
      { path: '/login', expect: /login|password|email|sign in|register|forgot/i },
      { path: '/products', expect: /product|filter|category|price|sort|coupon|search/i },
      { path: '/coupons', expect: /coupon|wallet|claim|discount|code/i },
    ];

    for (const route of routes) {
      const response = await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      check(`route ${route.path} status`, Boolean(response && response.status() === 200), response && response.status());
      await page.waitForSelector('#root', { timeout: 20000 });
      // Wait until body has more than navbar chrome.
      let text = '';
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await page.waitForTimeout(700);
        text = await page.locator('body').innerText();
        if (route.expect.test(text) && text.length > 180) break;
      }
      check(`route ${route.path} content`, route.expect.test(text), text.replace(/\s+/g, ' ').slice(0, 140));
    }

    // Mobile viewport conversion: checkout empty multi-CTA or cart empty multi-CTA.
    await page.goto(`${base}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    const cartButtons = await page.locator('button, a.ant-btn, .ant-btn').count();
    check('cart interactive controls present', cartButtons >= 2, `buttons=${cartButtons}`);

    check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  } catch (error) {
    check('browser smoke execution', false, error && error.message ? error.message : String(error));
  } finally {
    await browser.close().catch(() => undefined);
  }

  const passed = results.filter((item) => item.pass).length;
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY ${passed}/${results.length} passed @ ${base}`);
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
  console.error('BROWSER_SMOKE_CRASH', error);
  process.exit(2);
});
