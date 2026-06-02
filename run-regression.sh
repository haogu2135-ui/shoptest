#!/bin/bash
set -e

ROUND=$(ls -d /root/shoptest/ui-screenshots-v* 2>/dev/null | wc -l)
ROUND=$((ROUND + 1))
DIR="/root/shoptest/ui-screenshots-v${ROUND}"
REPORT="/root/shoptest/UI_REGRESSION_REPORT_V${ROUND}.md"
LOG="/tmp/frontend2.log"

# Check frontend is up
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$CODE" != "200" ]; then
  echo "Frontend not ready (HTTP $CODE), skipping round $ROUND"
  exit 1
fi

# Check compile status
COMPILE=$(grep -E "No issues found|^ERROR in" "$LOG" 2>/dev/null | tail -1)
echo "Compile status: $COMPILE"

mkdir -p "$DIR"

node -e "
const { chromium } = require('/root/shoptest/frontend/node_modules/playwright');
const fs = require('fs'), path = require('path');
const BASE = 'http://localhost:3000';
const DIR = '$DIR';
const PAGES = [
  { path: '/',                name: '01-home' },
  { path: '/products',        name: '02-products' },
  { path: '/login',           name: '03-login' },
  { path: '/register',        name: '04-register' },
  { path: '/cart',            name: '05-cart' },
  { path: '/pet-finder',      name: '06-pet-finder' },
  { path: '/pet-gallery',     name: '07-pet-gallery' },
  { path: '/coupons',         name: '08-coupons' },
  { path: '/track-order',     name: '09-track-order' },
  { path: '/forgot-password', name: '10-forgot-password' },
];
const VPS = [
  { width: 1920, height: 1080, suffix: 'desktop' },
  { width: 375,  height: 812,  suffix: 'mobile'  },
  { width: 768,  height: 1024, suffix: 'tablet'  },
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const pg of PAGES) {
      const file = path.join(DIR, pg.name + '-' + vp.suffix + '.png');
      try {
        await page.goto(BASE + pg.path, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: file, fullPage: true });
        console.log('OK  ' + pg.name + '-' + vp.suffix);
      } catch(e) { console.log('ERR ' + pg.name + '-' + vp.suffix + ': ' + e.message.slice(0,60)); }
    }
    await ctx.close();
  }
  await browser.close();
  console.log('Screenshots done: ' + DIR);
})();
" 2>&1

echo "Round $ROUND screenshots complete: $DIR"
echo "Report path: $REPORT"
