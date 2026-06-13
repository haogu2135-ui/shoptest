const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0535-pet-gallery-preview-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'landscape-740', width: 740, height: 360 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
];

const photos = [
  {
    id: 101,
    imageUrl: '/assets/placeholders/product.svg',
    username: 'maria.with.a.very.long.pet.gallery.username.for.preview.audit',
    likeCount: 128,
    likedByMe: false,
    canDelete: true,
    createdAt: '2026-06-08T04:10:00Z',
  },
  {
    id: 102,
    imageUrl: '/assets/placeholders/product.svg',
    username: 'cozy_paws',
    likeCount: 76,
    likedByMe: true,
    canDelete: false,
    createdAt: '2026-06-07T18:20:00Z',
  },
  {
    id: 103,
    imageUrl: '/assets/placeholders/product.svg',
    username: 'tailwag_home',
    likeCount: 64,
    likedByMe: false,
    canDelete: false,
    createdAt: '2026-06-07T09:45:00Z',
  },
  {
    id: 104,
    imageUrl: '/assets/placeholders/product.svg',
    username: 'softnap_cat',
    likeCount: 58,
    likedByMe: false,
    canDelete: false,
    createdAt: '2026-06-06T16:00:00Z',
  },
];

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installMocks(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'ui-audit-token');
    localStorage.setItem('refreshToken', 'ui-audit-refresh-token');
    localStorage.setItem('role', 'USER');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === '/api/auth/refresh') {
      return fulfillJson(route, { token: 'ui-audit-token', refreshToken: 'ui-audit-refresh-token' });
    }
    if (pathname === '/api/users/profile') {
      return fulfillJson(route, {
        id: 501,
        username: 'pet.gallery.audit.user',
        role: 'USER',
        roleCode: 'USER',
        status: 'ACTIVE',
      });
    }
    if (pathname === '/api/support/unread-count') {
      return fulfillJson(route, { count: 0 });
    }
    if (pathname === '/api/pet-gallery' && method === 'GET') {
      return fulfillJson(route, photos);
    }
    if (pathname === '/api/pet-gallery/quota') {
      return fulfillJson(route, { usedToday: 1, dailyLimit: 3, remaining: 2, canUpload: true });
    }
    const likeMatch = pathname.match(/^\/api\/pet-gallery\/(\d+)\/like$/);
    if (likeMatch) {
      const id = Number(likeMatch[1]);
      const photo = photos.find((item) => item.id === id) || photos[0];
      return fulfillJson(route, { ...photo, likedByMe: true, likeCount: Number(photo.likeCount || 0) + 1 });
    }
    const deleteMatch = pathname.match(/^\/api\/pet-gallery\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/categories' || pathname === '/api/brands') {
      return fulfillJson(route, []);
    }
    if (pathname.includes('/cart')) return fulfillJson(route, []);
    if (pathname.includes('/coupons')) return fulfillJson(route, []);
    if (pathname.includes('/products')) {
      return fulfillJson(route, { items: [], total: 0, page: 1, size: 12, totalPages: 0 });
    }
    return fulfillJson(route, {});
  });
}

async function waitForGallery(page) {
  await page.goto(`${baseUrl}/pet-gallery`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pet-gallery-page', { timeout: 30000 });
  await page.waitForSelector('.pet-gallery-card', { timeout: 30000 });
  await page.waitForTimeout(900);
}

async function centerSelector(page, selector, ratio = 0.45) {
  await page.locator(selector).first().waitFor({ state: 'attached', timeout: 10000 });
  await page.locator(selector).first().evaluate((el, viewportRatio) => {
    const rect = el.getBoundingClientRect();
    const nextTop = Math.max(0, window.scrollY + rect.top - window.innerHeight * viewportRatio + rect.height / 2);
    window.scrollTo({ top: nextTop, behavior: 'instant' });
  }, ratio);
  await page.waitForTimeout(400);
}

async function capture(page, viewport, state, metrics) {
  await page.screenshot({
    path: path.join(outDir, `${viewport.name}-${state}.png`),
    fullPage: false,
  });
  metrics.push(await collectMetrics(page, viewport, state));
}

async function collectMetrics(page, viewport, state) {
  return page.evaluate(({ viewportName, stateName }) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const rectOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        selector,
        text: textOf(el).slice(0, 240),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        fullyVisible: rect.top >= 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        visibleRatio: rect.width && rect.height
          ? Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
            * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
            / (rect.width * rect.height)
          : 0,
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        whiteSpace: style.whiteSpace,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        centerHitTag: hit?.tagName || null,
        centerHitClass: hit?.className || null,
        centerHitText: textOf(hit).slice(0, 120),
      };
    };
    const selectors = [
      '.pet-gallery-page',
      '.pet-gallery-hero',
      '.pet-gallery-toolbar',
      '.pet-gallery-insights',
      '.pet-gallery-insights__grid',
      '.pet-gallery-conversion',
      '.pet-gallery-conversion__signals',
      '.pet-gallery-grid',
      '.pet-gallery-card',
      '.pet-gallery-card__imageButton',
      '.pet-gallery-card__like',
      '.pet-gallery-card__delete',
      '.pet-gallery-delete-popconfirm',
      '.pet-gallery-delete-popconfirm .ant-popover-inner',
      '.pet-gallery-delete-popconfirm .ant-popconfirm-buttons',
      '.pet-gallery-preview',
      '.pet-gallery-preview .ant-modal-content',
      '.pet-gallery-preview__figure img',
      '.pet-gallery-preview__figure figcaption',
      '.pet-gallery-preview__figure figcaption .ant-space',
      '.pet-gallery-preview__figure figcaption .ant-btn',
      '.ant-modal-mask',
      '.ant-modal-wrap',
      '.shop-nav__bottomBar',
    ];
    const overflowElements = Array.from(document.querySelectorAll('body *')).map((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const overflowRight = rect.right - window.innerWidth;
      const overflowLeft = -rect.left;
      if (overflowRight <= 1 && overflowLeft <= 1 && el.scrollWidth <= el.clientWidth + 1) return null;
      return {
        tag: el.tagName,
        className: String(el.className || '').slice(0, 180),
        text: textOf(el).slice(0, 140),
        x: rect.x,
        width: rect.width,
        right: rect.right,
        overflowRight,
        overflowLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    }).filter(Boolean).slice(0, 35);
    return {
      viewport: viewportName,
      state: stateName,
      url: window.location.href,
      scrollY: window.scrollY,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
      rectangles: Object.fromEntries(selectors.map((selector) => [selector, rectOf(selector)])),
      overflowElements,
    };
  }, { viewportName: viewport.name, stateName: state });
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.width < 800,
    hasTouch: viewport.width < 800,
  });
  const page = await context.newPage();
  const metrics = [];
  await installMocks(page);
  await waitForGallery(page);

  await capture(page, viewport, 'top', metrics);

  await centerSelector(page, '.pet-gallery-card');
  await capture(page, viewport, 'grid-focused', metrics);

  try {
    await page.locator('.pet-gallery-card__imageButton').first().click({ timeout: 6000 });
  } catch (error) {
    await capture(page, viewport, 'preview-click-blocked', metrics);
    await page.locator('.pet-gallery-card__imageButton').first().evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await page.waitForSelector('.pet-gallery-preview .ant-modal-content', { timeout: 10000 });
  await page.waitForTimeout(450);
  await capture(page, viewport, 'preview-modal', metrics);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await centerSelector(page, '.pet-gallery-card__delete');
  try {
    await page.locator('.pet-gallery-card__delete').first().click({ timeout: 6000 });
  } catch (error) {
    await capture(page, viewport, 'delete-click-blocked', metrics);
    await page.locator('.pet-gallery-card__delete').first().evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }
  await page.waitForSelector('.pet-gallery-delete-popconfirm', { timeout: 10000 });
  await page.waitForTimeout(450);
  await capture(page, viewport, 'delete-popconfirm', metrics);

  await context.close();
  return { viewport, metrics };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of viewports) {
      results.push(await runViewport(browser, viewport));
    }
  } finally {
    await browser.close();
  }
  const flatMetrics = results.flatMap((result) => result.metrics);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ results, metrics: flatMetrics }, null, 2));
  const summary = flatMetrics.map((metric) => {
    const preview = metric.rectangles['.pet-gallery-preview .ant-modal-content'];
    const previewCaption = metric.rectangles['.pet-gallery-preview__figure figcaption'];
    const popconfirm = metric.rectangles['.pet-gallery-delete-popconfirm'];
    const popButtons = metric.rectangles['.pet-gallery-delete-popconfirm .ant-popconfirm-buttons'];
    const bottomNav = metric.rectangles['.shop-nav__bottomBar'];
    return {
      viewport: metric.viewport,
      state: metric.state,
      horizontalOverflow: metric.horizontalOverflow,
      overflowCount: metric.overflowElements.length,
      preview: preview && {
        y: preview.y,
        bottom: preview.bottom,
        height: preview.height,
        visibleRatio: preview.visibleRatio,
        overflowY: preview.overflowY,
        scrollHeight: preview.scrollHeight,
        clientHeight: preview.clientHeight,
        centerHitClass: preview.centerHitClass,
      },
      previewCaption: previewCaption && {
        y: previewCaption.y,
        bottom: previewCaption.bottom,
        height: previewCaption.height,
        visibleRatio: previewCaption.visibleRatio,
        centerHitText: previewCaption.centerHitText,
      },
      popconfirm: popconfirm && {
        x: popconfirm.x,
        y: popconfirm.y,
        width: popconfirm.width,
        height: popconfirm.height,
        right: popconfirm.right,
        bottom: popconfirm.bottom,
        visibleRatio: popconfirm.visibleRatio,
        centerHitClass: popconfirm.centerHitClass,
        centerHitText: popconfirm.centerHitText,
      },
      popButtons: popButtons && {
        x: popButtons.x,
        y: popButtons.y,
        width: popButtons.width,
        right: popButtons.right,
        bottom: popButtons.bottom,
        visibleRatio: popButtons.visibleRatio,
        centerHitClass: popButtons.centerHitClass,
        centerHitText: popButtons.centerHitText,
      },
      bottomNav: bottomNav && {
        display: bottomNav.display,
        y: bottomNav.y,
        bottom: bottomNav.bottom,
        height: bottomNav.height,
        zIndex: bottomNav.zIndex,
      },
    };
  });
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    outDir,
    states: flatMetrics.length,
    screenshots: flatMetrics.length,
    horizontalOverflowStates: summary.filter((item) => item.horizontalOverflow).length,
    previewClippedStates: summary.filter((item) => item.preview && item.preview.visibleRatio < 0.98).length,
    popconfirmClippedStates: summary.filter((item) => item.popconfirm && item.popconfirm.visibleRatio < 0.98).length,
    popconfirmHitProblems: summary.filter((item) => item.popconfirm && !String(item.popconfirm.centerHitClass || '').includes('ant-popover')).length,
  }, null, 2));
})();
