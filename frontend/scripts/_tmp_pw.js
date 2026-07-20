const { chromium } = require('playwright');
(async () => {
  console.log('start', new Date().toISOString());
  try {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
    console.log('launched');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
    const res = await page.goto('http://127.0.0.1:4187/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('home_status', res && res.status());
    await page.waitForSelector('#root', { timeout: 20000 });
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    console.log('home_has_ui', /product|pet|shop|coupon|cart|browse|category/i.test(body));
    console.log('title', await page.title());
    for (const path of ['/cart', '/checkout', '/track-order', '/login', '/products']) {
      await page.goto('http://127.0.0.1:4187' + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
      const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 100);
      console.log('route', path, t);
    }
    console.log('page_errors', JSON.stringify(pageErrors.slice(0, 8)));
    await browser.close();
    console.log('PLAYWRIGHT_OK');
  } catch (e) {
    console.error('PLAYWRIGHT_FAIL', e && e.stack ? e.stack : e);
    process.exitCode = 1;
  }
})();
