const { chromium } = require('playwright');
(async () => {
  const base = process.env.SHOPTEST_UI_BASE || 'http://127.0.0.1:4187';
  const routes = ['/cart', '/checkout', '/products/2', '/track-order', '/coupons'];
  const browser = await chromium.launch({ headless: true });
  // fresh context each route to force lazy chunk + Suspense
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let early = null;
    page.on('framenavigated', async () => {
      try {
        const count = await page.locator('h1').count();
        if (early === null) early = count;
      } catch {}
    });
    const nav = page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // poll early h1 during first 1.5s
    const start = Date.now();
    let maxEarly = 0;
    while (Date.now() - start < 1500) {
      try {
        const c = await page.locator('h1').count();
        if (c > maxEarly) maxEarly = c;
      } catch {}
      await page.waitForTimeout(50);
    }
    await nav;
    await page.waitForSelector('h1', { timeout: 10000 }).catch(()=>{});
    await page.waitForLoadState('networkidle').catch(()=>{});
    const settled = await page.evaluate(() => ({
      h1Count: document.querySelectorAll('h1').length,
      h1s: [...document.querySelectorAll('h1')].map(el => (el.textContent||'').trim().slice(0,60)),
    }));
    console.log(JSON.stringify({ route, maxEarly, settled }));
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  const home = await page.evaluate(() => ({
    stockMin: Math.min(...[...document.querySelectorAll('.shopee-product__stockBadge')].map(el => parseFloat(getComputedStyle(el).fontSize))),
    bottomMin: Math.min(...[...document.querySelectorAll('.shop-nav__bottomItem span:not(.anticon):not(.ant-badge):not(.ant-scroll-number)')].map(el => parseFloat(getComputedStyle(el).fontSize))),
  }));
  console.log('HOME', JSON.stringify(home));
  await browser.close();
  console.log('PASS audit complete');
})().catch(e => { console.error(e); process.exit(1); });
