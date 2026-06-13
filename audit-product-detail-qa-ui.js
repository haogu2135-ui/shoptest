const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0525-product-detail-qa-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'landscape-740', width: 740, height: 360 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
];

const product = {
  id: 1,
  name: 'Premium orthopedic recovery dog bed with washable cover and extra-long detail title',
  description: 'Supportive memory foam bed for senior dogs, used to audit detail-page review and Q&A surfaces.',
  price: 129.99,
  originalPrice: 169.99,
  discount: 24,
  stock: 8,
  rating: 4.8,
  reviewCount: 18,
  soldCount: 126,
  categoryId: 101,
  categoryName: 'Orthopedic beds',
  brand: 'Long Trusted Pet Wellness Brand International',
  tag: 'hot',
  status: 'ACTIVE',
  imageUrl: '/assets/placeholders/product.svg',
  images: ['/assets/placeholders/product.svg', '/assets/placeholders/product.svg'],
  isFeatured: true,
  freeShipping: true,
  freeShippingThreshold: 49,
  shipping: 'Free standard delivery with oversized carrier handling',
  warranty: 'Two year cover warranty',
  specifications: {
    Material: 'Layered memory foam',
    Size: 'Large',
    Care: 'Machine washable cover',
  },
  detailContent: [
    { type: 'text', content: 'Built for senior dogs who need firm support and easy cleanup.' },
  ],
};

const reviewableOrders = [
  {
    id: 8801,
    orderId: 8801,
    orderNo: 'SO-REVIEW-20260608-00008801-LONG',
    createdAt: '2026-06-08T02:20:00Z',
  },
  {
    id: 8802,
    orderId: 8802,
    orderNo: 'SO-REVIEW-20260607-00008802-SECOND',
    createdAt: '2026-06-07T16:10:00Z',
  },
];

let reviews = [
  {
    id: 401,
    username: 'maria.customer.with.a.very.long.name',
    rating: 5,
    comment: 'The cover is easy to remove, but the delivery box was large. I am leaving a deliberately long review sentence so the review list has to wrap inside the product detail card without creating hidden horizontal overflow on narrow phones.',
    adminReply: 'Thanks for the detailed note. The care instructions were updated after this order and support can help with replacement covers.',
    imageUrls: ['/assets/placeholders/product.svg', '/assets/placeholders/product.svg'],
    createdAt: '2026-06-08T03:15:00Z',
  },
  {
    id: 402,
    username: 'repeat.buyer',
    rating: 4,
    comment: 'Good support for a senior dog and the material stayed cool overnight.',
    createdAt: '2026-06-07T11:25:00Z',
  },
];

const answeredQuestions = [
  {
    id: 701,
    productId: 1,
    question: 'Will the washable cover fit after several hot-water cycles, and can the foam be removed without tearing the zipper seam during weekly cleaning?',
    answer: 'Yes. The cover is pre-shrunk and designed for cold or warm wash cycles. Remove the foam insert before washing, close the zipper, and air dry to keep the fit stable.',
    answeredAt: '2026-06-07T22:30:00Z',
    createdAt: '2026-06-07T10:05:00Z',
  },
  {
    id: 702,
    productId: 1,
    question: 'Is the large size stable on tile floors for heavier dogs?',
    answer: 'The base uses a non-slip fabric. For very active dogs on glossy tile, place the bed against a wall or mat for extra stability.',
    answeredAt: '2026-06-06T19:20:00Z',
    createdAt: '2026-06-06T09:30:00Z',
  },
];

const recommendations = [
  {
    id: 3002,
    name: 'Replacement washable cover set',
    price: 39.99,
    stock: 15,
    imageUrl: '/assets/placeholders/product.svg',
    images: ['/assets/placeholders/product.svg'],
  },
];

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function postDataJson(request, fallback = {}) {
  try {
    return request.postDataJSON();
  } catch {
    return fallback;
  }
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
        username: 'maria.customer.with.a.very.long.name',
        role: 'USER',
        roleCode: 'USER',
        status: 'ACTIVE',
      });
    }
    if (pathname === '/api/support/unread-count') {
      return fulfillJson(route, { count: 0 });
    }
    if (pathname === '/api/products/1') {
      return fulfillJson(route, product);
    }
    if (pathname === '/api/products/1/recommendations') {
      return fulfillJson(route, recommendations);
    }
    if (pathname === '/api/products/featured' || pathname === '/api/products/personalized-recommendations') {
      return fulfillJson(route, recommendations);
    }
    if (pathname === '/api/reviews/product/1') {
      return fulfillJson(route, { reviews, averageRating: 4.6 });
    }
    if (pathname === '/api/reviews/product/1/reviewable-orders') {
      return fulfillJson(route, reviewableOrders);
    }
    if (pathname === '/api/reviews/product/1' && method === 'POST') {
      const body = postDataJson(request);
      const created = {
        id: 499,
        username: 'maria.customer.with.a.very.long.name',
        rating: Number(body.rating || 5),
        comment: body.comment || 'Audit review',
        imageUrls: body.imageUrls || [],
        createdAt: '2026-06-08T05:25:00Z',
      };
      reviews = [created, ...reviews];
      return fulfillJson(route, created);
    }
    if (pathname === '/api/product-questions/product/1') {
      if (method === 'POST') {
        const body = postDataJson(request, { question: 'Pending audit question' });
        return fulfillJson(route, {
          id: 799,
          productId: 1,
          question: body.question,
          createdAt: '2026-06-08T05:25:00Z',
        });
      }
      return fulfillJson(route, answeredQuestions);
    }
    if (pathname === '/api/wishlist/me/check') {
      return fulfillJson(route, { wishlisted: false });
    }
    if (pathname === '/api/wishlist/me/count') {
      return fulfillJson(route, { count: 0 });
    }
    if (pathname === '/api/cart/me') {
      return fulfillJson(route, []);
    }
    if (pathname === '/api/categories' || pathname === '/api/brands') {
      return fulfillJson(route, []);
    }
    if (pathname.includes('/coupons') || pathname.includes('/notifications')) {
      return fulfillJson(route, []);
    }
    if (pathname.includes('/products')) {
      return fulfillJson(route, { items: [product], total: 1, page: 1, size: 12, totalPages: 1 });
    }
    return fulfillJson(route, {});
  });
}

async function waitForDetail(page) {
  await page.goto(`${baseUrl}/products/1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.product-detail-page', { timeout: 30000 });
  await page.waitForSelector('#product-reviews-card', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#product-reviews-card')?.textContent?.trim().length > 20, null, { timeout: 30000 });
  await page.waitForSelector('#product-qa-card', { timeout: 30000 });
  await page.waitForTimeout(900);
}

async function scrollToSelector(page, selector, block = 'center') {
  await page.locator(selector).first().evaluate((el, blockValue) => {
    el.scrollIntoView({ block: blockValue, inline: 'nearest', behavior: 'instant' });
  }, block);
  await page.waitForTimeout(450);
}

async function centerSelector(page, selector, viewportRatio = 0.45) {
  await page.locator(selector).first().waitFor({ state: 'attached', timeout: 10000 });
  await page.locator(selector).first().evaluate((el, ratio) => {
    const rect = el.getBoundingClientRect();
    const targetY = Math.max(0, window.scrollY + rect.top - window.innerHeight * ratio + rect.height / 2);
    window.scrollTo({ top: targetY, behavior: 'instant' });
  }, viewportRatio);
  await page.waitForTimeout(450);
}

async function clickVisibleCenter(page, selector) {
  await centerSelector(page, selector);
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.click();
  await page.waitForTimeout(450);
}

async function collectMetrics(page, viewport, state) {
  return page.evaluate(({ viewportName, stateName }) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
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
        text: textOf(el).slice(0, 260),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        fullyVisible: rect.top >= 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        visibility: style.visibility,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        whiteSpace: style.whiteSpace,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
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
      '.product-detail-page',
      '.product-review-card',
      '.product-review__composer',
      '.product-review__orderSelect',
      '.product-review__rate',
      '.product-review__textarea',
      '.product-review__imageComposer',
      '.product-review__submit',
      '.product-review__list',
      '.product-review__item',
      '.product-review__adminReply',
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      '.product-qa-card',
      '.product-qa-space',
      '.product-qa-space textarea',
      '.product-qa-space .ant-btn',
      '.product-qa-pending',
      '.product-qa-pending-list',
      '.product-question-item',
      '.product-answer-box',
      '.product-recommendations',
      '.product-mobile-buybar',
      '.shop-nav__bottomBar',
      '.ant-message',
    ];
    const overflowElements = Array.from(document.querySelectorAll('body *')).map((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const overflowRight = rect.right - window.innerWidth;
      const overflowLeft = -rect.left;
      if (overflowRight <= 1 && overflowLeft <= 1 && el.scrollWidth <= el.clientWidth + 1) return null;
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        className: String(el.className || '').slice(0, 180),
        text: textOf(el).slice(0, 160),
        x: rect.x,
        width: rect.width,
        right: rect.right,
        overflowRight,
        overflowLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        position: style.position,
        display: style.display,
      };
    }).filter(Boolean).slice(0, 30);
    const qButton = document.querySelector('.product-qa-space .ant-btn');
    const qButtonRect = qButton?.getBoundingClientRect();
    const bottomProbe = qButtonRect ? document.elementFromPoint(
      Math.min(window.innerWidth - 1, Math.max(0, qButtonRect.left + qButtonRect.width / 2)),
      Math.min(window.innerHeight - 1, Math.max(0, qButtonRect.bottom - 3)),
    ) : null;
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
      qButtonBottomHit: bottomProbe ? {
        tag: bottomProbe.tagName,
        className: String(bottomProbe.className || '').slice(0, 180),
        text: textOf(bottomProbe).slice(0, 120),
      } : null,
    };
  }, { viewportName: viewport.name, stateName: state });
}

async function capture(page, viewport, state, metrics) {
  await page.screenshot({
    path: path.join(outDir, `${viewport.name}-${state}.png`),
    fullPage: false,
  });
  metrics.push(await collectMetrics(page, viewport, state));
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
  const consoleMessages = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: message.text().slice(0, 400) });
    }
  });

  await installMocks(page);
  await waitForDetail(page);

  await centerSelector(page, '.product-review__orderSelect');
  await capture(page, viewport, 'review-composer', metrics);

  await clickVisibleCenter(page, '.product-review__orderSelect');
  await capture(page, viewport, 'review-order-select-open', metrics);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  await centerSelector(page, '#product-qa-card');
  await capture(page, viewport, 'qa-answered', metrics);

  const question = 'Will this bed still support a forty kilogram senior dog after months of use, and can I buy another cover later if the first one wears out?';
  await page.locator('.product-qa-space textarea').first().fill(question);
  await capture(page, viewport, 'qa-form-filled', metrics);
  await clickVisibleCenter(page, '.product-qa-space .ant-btn');
  await page.waitForSelector('.product-qa-pending', { timeout: 10000 });
  await scrollToSelector(page, '.product-qa-pending', 'center');
  await capture(page, viewport, 'qa-pending-after-submit', metrics);

  await context.close();
  return { viewport, metrics, consoleMessages };
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
    const dropdown = metric.rectangles['.ant-select-dropdown:not(.ant-select-dropdown-hidden)'];
    const qCard = metric.rectangles['.product-qa-card'];
    const qButton = metric.rectangles['.product-qa-space .ant-btn'];
    const pending = metric.rectangles['.product-qa-pending'];
    const buybar = metric.rectangles['.product-mobile-buybar'];
    return {
      viewport: metric.viewport,
      state: metric.state,
      horizontalOverflow: metric.horizontalOverflow,
      docWidth: metric.docWidth,
      innerWidth: metric.innerWidth,
      qCard: qCard && {
        y: qCard.y,
        height: qCard.height,
        bottom: qCard.bottom,
        scrollWidth: qCard.scrollWidth,
        clientWidth: qCard.clientWidth,
      },
      qButton: qButton && {
        y: qButton.y,
        bottom: qButton.bottom,
        width: qButton.width,
        fullyVisible: qButton.fullyVisible,
        centerHitClass: qButton.centerHitClass,
        centerHitText: qButton.centerHitText,
      },
      pending: pending && {
        y: pending.y,
        bottom: pending.bottom,
        height: pending.height,
        scrollWidth: pending.scrollWidth,
        clientWidth: pending.clientWidth,
      },
      dropdown: dropdown && {
        x: dropdown.x,
        y: dropdown.y,
        width: dropdown.width,
        height: dropdown.height,
        fullyVisible: dropdown.fullyVisible,
        zIndex: dropdown.zIndex,
        centerHitClass: dropdown.centerHitClass,
      },
      buybar: buybar && {
        y: buybar.y,
        bottom: buybar.bottom,
        height: buybar.height,
        position: buybar.position,
        fullyVisible: buybar.fullyVisible,
      },
      overflowCount: metric.overflowElements.length,
    };
  });
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    outDir,
    states: flatMetrics.length,
    screenshots: viewports.length * 5,
    horizontalOverflowStates: summary.filter((item) => item.horizontalOverflow).length,
    visibleDropdownProblems: summary.filter((item) => item.state === 'review-order-select-open' && item.dropdown && !item.dropdown.fullyVisible).length,
    qButtonProblems: summary.filter((item) => item.qButton && !item.qButton.fullyVisible && item.state.includes('qa')).length,
  }, null, 2));
})();
