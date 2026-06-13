const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T0436-admin-products-editor-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'landscape-740', width: 740, height: 360 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 900 },
];

const permissions = [
  'dashboard',
  'products',
  'products:write',
  'products:delete',
  'products:status',
  'products:import',
  'categories',
  'brands',
  'support',
];

const categories = [
  {
    id: 10,
    name: 'Dog wellness and recovery gear with long taxonomy label',
    nameEn: 'Dog wellness and recovery gear with long taxonomy label',
    level: 1,
    sortOrder: 1,
    status: 'ACTIVE',
    children: [
      {
        id: 101,
        name: 'Orthopedic beds and mobility support accessories',
        nameEn: 'Orthopedic beds and mobility support accessories',
        parentId: 10,
        level: 2,
        sortOrder: 1,
        status: 'ACTIVE',
      },
    ],
  },
  {
    id: 20,
    name: 'Cat feeding automation and hydration systems',
    nameEn: 'Cat feeding automation and hydration systems',
    level: 1,
    sortOrder: 2,
    status: 'ACTIVE',
  },
];

const brands = [
  { id: 1, name: 'Long Trusted Pet Wellness Brand International', status: 'ACTIVE', active: true },
  { id: 2, name: 'North Coast Pet Supply', status: 'ACTIVE', active: true },
  { id: 3, name: 'Dormant Legacy Brand', status: 'INACTIVE', active: false },
];

const products = [
  {
    id: 3001,
    name: 'Premium orthopedic recovery dog bed with washable cover and extra-long merchandising title',
    description: 'A long-form catalog listing used to stress product admin editing surfaces and preview cards on narrow screens.',
    price: 129.99,
    originalPrice: 169.99,
    discount: 24,
    stock: 8,
    categoryId: 101,
    categoryName: 'Orthopedic beds and mobility support accessories',
    brand: 'Long Trusted Pet Wellness Brand International',
    tag: 'hot',
    status: 'ACTIVE',
    imageUrl: 'https://example.com/images/dog-bed-primary.jpg',
    images: ['https://example.com/images/dog-bed-side.jpg', 'https://example.com/images/dog-bed-detail.jpg'],
    isFeatured: true,
    freeShipping: true,
    freeShippingThreshold: 49,
    shipping: 'Fragile oversized carrier service',
    warranty: 'Two year cover warranty',
    specifications: { Material: 'Memory foam', Size: 'Large', 'options.Size': 'Small, Medium, Large', 'options.Color': 'Charcoal, Sage' },
    optionGroups: [
      { name: 'Size', values: ['Small', 'Medium', 'Large'] },
      { name: 'Color', values: ['Charcoal', 'Sage'] },
    ],
    variants: [
      { sku: 'SKU-LARGE-CHARCOAL', optionText: 'Size=Large, Color=Charcoal', price: 129.99, stock: 4, imageUrl: 'https://example.com/images/large-charcoal.jpg' },
      { sku: 'SKU-LARGE-SAGE', optionText: 'Size=Large, Color=Sage', price: 129.99, stock: 4, imageUrl: 'https://example.com/images/large-sage.jpg' },
    ],
    detailContent: [
      { type: 'text', content: 'Built for senior dogs who need support and easy cleanup.' },
      { type: 'image', url: 'https://example.com/images/detail.jpg', caption: 'Layered support foam' },
    ],
    updatedAt: '2026-06-08T02:30:00Z',
  },
  {
    id: 3002,
    name: 'Automation feeder refill sensor kit',
    description: 'Needs richer content and better images before publishing.',
    price: 39.99,
    stock: 0,
    categoryId: 20,
    brand: 'North Coast Pet Supply',
    tag: 'new',
    status: 'PENDING_REVIEW',
    imageUrl: '',
    images: [],
    isFeatured: false,
    updatedAt: '2026-06-07T21:15:00Z',
  },
];

const importHistory = [
  {
    importId: 'import-20260608-products-editor-ui',
    filename: 'catalog-update-long-name.csv',
    sizeBytes: 18432,
    fileSha256: '0123456789abcdef0123456789abcdef',
    status: 'PREVIEW_READY',
    totalRows: 24,
    created: 4,
    updated: 20,
    failed: 0,
    applied: true,
    createdAt: '2026-06-08T01:00:00Z',
    updateFields: ['price', 'stock'],
  },
];

async function fulfillJson(route, body) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installMocks(page) {
  await page.route('**/api/auth/refresh', (route) => fulfillJson(route, {
    token: 'ui-audit-token',
    refreshToken: 'ui-audit-refresh-token',
  }));

  await page.route('**/api/users/profile**', (route) => fulfillJson(route, {
    id: 910,
    username: 'product.audit.admin',
    role: 'SUPER_ADMIN',
    roleCode: 'SUPER_ADMIN',
    status: 'ACTIVE',
  }));

  await page.route('**/api/admin/me/permissions**', (route) => fulfillJson(route, {
    role: 'SUPER_ADMIN',
    roleCode: 'SUPER_ADMIN',
    permissions,
  }));

  await page.route('**/api/admin/support/unread-count', (route) => fulfillJson(route, { count: 4 }));
  await page.route('**/api/admin/products/import/history**', (route) => fulfillJson(route, importHistory));
  await page.route('**/api/admin/products/categories/options**', (route) => fulfillJson(route, categories));
  await page.route('**/api/admin/categories**', (route) => fulfillJson(route, categories));
  await page.route('**/api/admin/products/brands/options**', (route) => fulfillJson(route, brands));
  await page.route('**/api/admin/brands**', (route) => fulfillJson(route, brands));
  await page.route('**/api/admin/products/import-url', (route) => fulfillJson(route, {
    name: 'Imported product preview with very long marketplace title',
    description: 'Preview description returned from a product URL import.',
    price: 54.95,
    originalPrice: 69.95,
    brand: 'Imported Brand',
    images: ['https://example.com/images/imported-1.jpg', 'https://example.com/images/imported-2.jpg'],
    confidenceScore: 87,
    blockedImages: ['javascript:alert(1)'],
    warnings: ['MISSING_CATEGORY'],
  }));
  await page.route('**/api/admin/products**', (route) => fulfillJson(route, {
    items: products,
    total: products.length,
    page: 1,
    size: 50,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  }));
}

async function waitForPage(page) {
  await page.waitForSelector('.product-management-page', { timeout: 30000 });
  await page.waitForSelector('.product-management-page .ant-table-row', { timeout: 30000 });
  await page.waitForTimeout(600);
}

async function collectMetrics(page, state) {
  return page.evaluate((stateName) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const rectOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector,
        text: textOf(el).slice(0, 280),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        zIndex: style.zIndex,
      };
    };
    const visibleRatioOf = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return rect.width && rect.height ? (width * height) / (rect.width * rect.height) : 0;
    };
    const centerHit = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        selector,
        point: { x, y },
        hitTag: hit?.tagName || null,
        hitClass: hit?.className ? String(hit.className) : '',
        hitText: textOf(hit).slice(0, 220),
      };
    };
    const overflowEls = Array.from(document.querySelectorAll('body *'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return null;
        const overflowRight = rect.right - window.innerWidth;
        const overflowLeft = -rect.left;
        if (overflowRight <= 1 && overflowLeft <= 1) return null;
        return {
          selector: el.className ? `${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g, '.')}` : el.tagName.toLowerCase(),
          text: textOf(el).slice(0, 180),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
          overflowRight,
          overflowLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      })
      .filter(Boolean)
      .sort((left, right) => Math.max(right.overflowRight, right.overflowLeft) - Math.max(left.overflowRight, left.overflowLeft))
      .slice(0, 50);
    const optionRows = Array.from(document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item, .ant-select-tree-list-holder .ant-select-tree-treenode, .ant-picker-dropdown .ant-picker-cell')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: textOf(el).slice(0, 120),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        visibleRatio: rect.width && rect.height
          ? (Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))) / (rect.width * rect.height)
          : 0,
      };
    }).slice(0, 80);
    const editorCards = Array.from(document.querySelectorAll('.shopify-product-modal .shopify-card')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: textOf(el).slice(0, 160),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        visibleRatio: rect.width && rect.height
          ? (Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))) / (rect.width * rect.height)
          : 0,
      };
    });
    return {
      state: stateName,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollY: window.scrollY,
      },
      rects: {
        page: rectOf('.product-management-page'),
        toolbar: rectOf('.product-management-page__toolbar'),
        quality: rectOf('.product-listing-quality'),
        qualityMetrics: rectOf('.product-listing-quality__metrics'),
        table: rectOf('.product-management-page .ant-table-wrapper'),
        modal: rectOf('.shopify-product-modal .ant-modal-content'),
        modalBody: rectOf('.shopify-product-modal .ant-modal-body'),
        modalFooter: rectOf('.shopify-product-modal .ant-modal-footer'),
        editor: rectOf('.shopify-product-editor'),
        editorMain: rectOf('.shopify-product-editor__main'),
        editorSide: rectOf('.shopify-product-editor__side'),
        category: rectOf('.shopify-product-modal .ant-tree-select'),
        statusSelect: rectOf('.shopify-product-editor__side .ant-select:nth-of-type(1)'),
        brandSelect: rectOf('.shopify-product-editor__side .ant-select'),
        rangePicker: rectOf('.shopify-range-picker'),
        richEditor: rectOf('.product-rich-detail-editor'),
        richTypeSelect: rectOf('.product-rich-detail-editor__typeSelect'),
        variantList: rectOf('.shopify-variant-list'),
        dropdown: rectOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown'),
        treeDropdown: rectOf('.ant-select-tree-dropdown:not(.ant-select-dropdown-hidden)'),
        pickerDropdown: rectOf('.ant-picker-dropdown'),
      },
      visibleRatios: {
        modal: visibleRatioOf('.shopify-product-modal .ant-modal-content'),
        modalBody: visibleRatioOf('.shopify-product-modal .ant-modal-body'),
        modalFooter: visibleRatioOf('.shopify-product-modal .ant-modal-footer'),
        editorSide: visibleRatioOf('.shopify-product-editor__side'),
        category: visibleRatioOf('.shopify-product-modal .ant-tree-select'),
        richTypeSelect: visibleRatioOf('.product-rich-detail-editor__typeSelect'),
        rangePicker: visibleRatioOf('.shopify-range-picker'),
        dropdown: visibleRatioOf('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown'),
        pickerDropdown: visibleRatioOf('.ant-picker-dropdown'),
      },
      editorCards,
      optionRows,
      overflowEls,
      hits: [
        centerHit('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'),
        centerHit('.ant-select-tree-list-holder .ant-select-tree-treenode'),
        centerHit('.ant-picker-dropdown .ant-picker-cell-in-view'),
        centerHit('.shopify-product-modal .ant-modal-footer .ant-btn-primary'),
        centerHit('.product-rich-detail-editor__typeSelect'),
        centerHit('.shopify-range-picker'),
      ],
    };
  }, state);
}

async function capture(page, viewportName, stateName, fullPage = false) {
  const metrics = await collectMetrics(page, stateName);
  await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}.png`), fullPage: false });
  if (fullPage) {
    await page.screenshot({ path: path.join(outDir, `${viewportName}-${stateName}-full.png`), fullPage: true });
  }
  return metrics;
}

async function closePopup(page) {
  const popup = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown').first();
  if (await popup.count()) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(250);
  }
}

async function scrollModalTo(page, selector) {
  await page.evaluate((targetSelector) => {
    const body = document.querySelector('.shopify-product-modal .ant-modal-body');
    const target = document.querySelector(targetSelector);
    if (!body || !target) return;
    const bodyRect = body.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    body.scrollTop += targetRect.top - bodyRect.top - 18;
  }, selector);
  await page.waitForTimeout(350);
}

async function openProductModal(page) {
  await page.locator('button').filter({ hasText: /Add product|添加商品/i }).first().click();
  await page.waitForSelector('.shopify-product-modal .ant-modal-content', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function resetToProductModal(page) {
  await page.goto(`${baseUrl}/admin/products`, { waitUntil: 'networkidle' });
  await waitForPage(page);
  await openProductModal(page);
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await installMocks(page);
    await page.addInitScript(() => {
      localStorage.setItem('token', 'ui-audit-token');
      localStorage.setItem('refreshToken', 'ui-audit-refresh-token');
      localStorage.setItem('role', 'SUPER_ADMIN');
    });
    const consoleMessages = [];
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    const states = [];
    await page.goto(`${baseUrl}/admin/products`, { waitUntil: 'networkidle' });
    await waitForPage(page);
    states.push(await capture(page, viewport.name, 'top', true));

    await openProductModal(page);
    states.push(await capture(page, viewport.name, 'editor-top', true));

    await resetToProductModal(page);
    await scrollModalTo(page, '.shopify-product-modal .ant-tree-select');
    await page.locator('.shopify-product-modal .ant-tree-select').click();
    await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-select-tree-dropdown', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(250);
    states.push(await capture(page, viewport.name, 'category-tree-dropdown', true));

    await resetToProductModal(page);
    await scrollModalTo(page, '.shopify-product-editor__side');
    states.push(await capture(page, viewport.name, 'editor-side', true));
    const sideSelects = page.locator('.shopify-product-editor__side .ant-select');
    if (await sideSelects.count()) {
      await sideSelects.first().click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      states.push(await capture(page, viewport.name, 'status-dropdown', true));
    }

    await resetToProductModal(page);
    await scrollModalTo(page, '.shopify-product-editor__side');
    const freshSideSelects = page.locator('.shopify-product-editor__side .ant-select');
    const freshSideCount = await freshSideSelects.count();
    if (freshSideCount > 1) {
      await freshSideSelects.nth(1).click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      states.push(await capture(page, viewport.name, 'brand-dropdown', true));
    }

    await resetToProductModal(page);
    await scrollModalTo(page, '.shopify-range-picker');
    states.push(await capture(page, viewport.name, 'limited-time-section', true));
    if (await page.locator('.shopify-range-picker').count()) {
      await page.locator('.shopify-range-picker').click();
      await page.waitForSelector('.ant-picker-dropdown', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(350);
      states.push(await capture(page, viewport.name, 'range-picker-dropdown', true));
    }

    await resetToProductModal(page);
    await scrollModalTo(page, '.product-rich-detail-editor');
    states.push(await capture(page, viewport.name, 'rich-editor-section', true));
    if (await page.locator('.product-rich-detail-editor__typeSelect').count()) {
      await page.locator('.product-rich-detail-editor__typeSelect').first().click();
      await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(250);
      states.push(await capture(page, viewport.name, 'rich-type-dropdown', true));
    }

    await resetToProductModal(page);
    await scrollModalTo(page, '.shopify-variant-row');
    states.push(await capture(page, viewport.name, 'variant-section', true));

    report.push({ viewport, url: page.url(), consoleMessages, states });
    await fs.promises.writeFile(path.join(outDir, `${viewport.name}.json`), JSON.stringify(report[report.length - 1], null, 2));
    await page.close();
  }
  await browser.close();
  await fs.promises.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Wrote ${outDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
