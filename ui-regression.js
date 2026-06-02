const { chromium } = require('/root/shoptest/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const DIR = '/root/shoptest/ui-screenshots-v2';

const PAGES = [
  { path: '/',               name: '01-home' },
  { path: '/products',       name: '02-products' },
  { path: '/login',          name: '03-login' },
  { path: '/register',       name: '04-register' },
  { path: '/cart',           name: '05-cart' },
  { path: '/pet-finder',     name: '06-pet-finder' },
  { path: '/pet-gallery',    name: '07-pet-gallery' },
  { path: '/coupons',        name: '08-coupons' },
  { path: '/track-order',    name: '09-track-order' },
  { path: '/forgot-password',name: '10-forgot-password' },
];

const VIEWPORTS = [
  { width: 1920, height: 1080, suffix: 'desktop' },
  { width: 375,  height: 812,  suffix: 'mobile'  },
  { width: 768,  height: 1024, suffix: 'tablet'  },
];

(async () => {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    for (const pg of PAGES) {
      const file = path.join(DIR, `${pg.name}-${vp.suffix}.png`);
      try {
        await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(2500);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`OK  ${pg.name}-${vp.suffix}`);
      } catch (e) {
        console.log(`ERR ${pg.name}-${vp.suffix}: ${e.message.slice(0,80)}`);
      }
    }
    await ctx.close();
  }

  await browser.close();
  console.log('\nDone.');
})();
