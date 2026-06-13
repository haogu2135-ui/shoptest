const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T-pet-compare-app-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320-app', width: 320, height: 568 },
  { name: 'phone-390-app', width: 390, height: 844 },
];

const now = Date.parse('2026-06-08T09:25:00Z');

const products = [
  {
    id: 7301,
    name: 'Ultra long name smart feeder camera bowl with meal history and quiet midnight dispensing for anxious cats',
    description: 'A smart feeder candidate used to stress finder and compare cards on narrow Android App screens.',
    price: 1899,
    effectivePrice: 1499,
    originalPrice: 2199,
    discount: 32,
    effectiveDiscountPercent: 32,
    stock: 4,
    categoryId: 31,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'PawSense Connected Home',
    averageRating: 4.8,
    positiveRate: 96.2,
    reviewCount: 184,
    tag: 'smart feeder cat food',
    freeShipping: true,
    specifications: {
      Capacity: '5L sealed hopper with freshness lock',
      Material: 'BPA-free ABS and stainless bowl',
      Color: 'Warm white with walnut trim',
      'Pet Size': 'Cat and small dog',
      'Power Backup': 'Battery backup for 18 hours',
      'Life Stage': 'Adult',
    },
    isFeatured: true,
  },
  {
    id: 7302,
    name: 'Reflective waterproof adventure harness with extended chest support and extra long safety label',
    description: 'Harness for walking and travel matching pet finder walk needs.',
    price: 799,
    effectivePrice: 699,
    originalPrice: 899,
    discount: 22,
    effectiveDiscountPercent: 22,
    stock: 2,
    categoryId: 32,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'TrailPaw Expedition',
    averageRating: 4.6,
    positiveRate: 93.4,
    reviewCount: 91,
    tag: 'dog puppy leash harness walk travel',
    freeShipping: false,
    shipping: 'Standard parcel',
    specifications: {
      Size: 'S / M / L fit guide',
      Material: 'Ripstop nylon with padded mesh',
      Color: 'Moss green reflective orange',
      Closure: 'Dual buckle with safety lock',
      'Pet Size': 'Small to large dogs',
      Care: 'Hand wash cold',
    },
  },
  {
    id: 7303,
    name: 'Orthopedic recovery sofa bed with washable cooling cover and reinforced non slip base',
    description: 'Sleep support product matching bed and recovery needs.',
    price: 1599,
    effectivePrice: 1299,
    originalPrice: 1799,
    discount: 28,
    effectiveDiscountPercent: 28,
    stock: 12,
    categoryId: 33,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'SleepWell Pets',
    averageRating: 4.9,
    positiveRate: 97.8,
    reviewCount: 223,
    tag: 'dog cat bed sleep cushion recovery',
    freeShipping: true,
    specifications: {
      Size: 'Medium 82 x 62 cm',
      Material: 'Memory foam and cooling textile',
      Color: 'Sage and charcoal',
      Weight: '3.8 kg',
      Care: 'Machine washable cover',
      'Life Stage': 'Senior and adult',
    },
  },
  {
    id: 7304,
    name: 'Sensitive digestion salmon kibble starter bundle with personalized portion scoop and trial sachets',
    description: 'Food bundle requiring option selection before direct add to cart.',
    price: 999,
    effectivePrice: 899,
    originalPrice: 1099,
    discount: 18,
    effectiveDiscountPercent: 18,
    stock: 9,
    categoryId: 34,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'NutriPet Gentle',
    averageRating: 4.4,
    positiveRate: 90.1,
    reviewCount: 67,
    tag: 'cat dog food treat feeder water',
    freeShipping: false,
    shipping: 'Cold-chain not required',
    optionGroups: [{ name: 'Bag size', values: ['2 kg', '7 kg'] }],
    specifications: {
      Formula: 'Salmon and pumpkin sensitive digestion',
      Flavor: 'Salmon',
      Pack: 'Starter bundle with scoop',
      'Life Stage': 'Adult',
      'Coat Type': 'All coat types',
      'options.Bag size': '2 kg, 7 kg',
    },
  },
  {
    id: 7305,
    name: 'Interactive chew puzzle treat ball for bored puppies and energetic indoor cats',
    description: 'Play product for finder matching.',
    price: 349,
    effectivePrice: 299,
    originalPrice: 399,
    discount: 25,
    effectiveDiscountPercent: 25,
    stock: 18,
    categoryId: 35,
    imageUrl: '/assets/placeholders/product.svg',
    brand: 'PlayLoop',
    averageRating: 4.5,
    positiveRate: 92.0,
    reviewCount: 51,
    tag: 'toy play ball chew interactive cat dog',
    specifications: {
      Material: 'Food-grade rubber',
      Color: 'Tangerine and mint',
      'Pet Size': 'Small and medium pets',
    },
  },
];

const petPhotos = [
  {
    id: 8101,
    imageUrl: '/assets/placeholders/media.svg',
    username: 'very_long_pet_parent_name_ready_to_delete',
    likeCount: 128,
    likedByMe: false,
    canDelete: true,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    originalFilename: 'living-room-senior-dog-recovery-bed.png',
  },
  {
    id: 8102,
    imageUrl: '/assets/placeholders/media.svg',
    username: 'cat_window_club_daily_digest',
    likeCount: 87,
    likedByMe: true,
    canDelete: false,
    createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    originalFilename: 'cat-window-feeder.jpg',
  },
  {
    id: 8103,
    imageUrl: '/assets/placeholders/media.svg',
    username: 'weekend_walks_reflective_harness_story',
    likeCount: 64,
    likedByMe: false,
    canDelete: false,
    createdAt: new Date(now - 27 * 60 * 60 * 1000).toISOString(),
    originalFilename: 'harness-walk.jpg',
  },
];

function ensureDirs() {
  fs.mkdirSync(outDir, { recursive: true });
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function viewportConfig(viewport) {
  return {
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel Pet Compare Audit) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 ShopTestAndroidApp/${viewport.name}`,
  };
}

async function installRuntime(page) {
  await page.addInitScript(({ compareIds }) => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      supportWebSocketUrl: '/ws/support',
      apiGatewayEnabled: false,
      apiGatewayPrefix: '/gateway',
      mobileVersionManifestUrl: '/downloads/mobile-version.json',
      mobileCurrentVersionCode: 10078,
      mobileCurrentVersionName: '1.0.78',
    };
    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
      Plugins: {
        App: {
          addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
          minimizeApp: () => Promise.resolve(),
        },
        Browser: { open: () => Promise.resolve() },
      },
    };
    localStorage.setItem('token', 'pet-compare-app-audit-token');
    localStorage.setItem('refreshToken', 'pet-compare-app-audit-refresh-token');
    localStorage.setItem('userId', '778');
    localStorage.setItem('username', 'pet.compare.audit');
    localStorage.setItem('role', 'USER');
    localStorage.setItem('shop-language', 'en');
    localStorage.setItem('currency', 'USD');
    localStorage.setItem('shop-product-compare', JSON.stringify(compareIds));
    localStorage.setItem('shop-pet-finder-preferences', JSON.stringify({
      petType: 'all',
      need: 'all',
      priority: 'best',
      budget: [0, 2500],
    }));
    sessionStorage.clear();
  }, { compareIds: products.slice(0, 4).map((product) => product.id) });
}

async function installMocks(page) {
  const apiRequests = [];
  await page.route('**/downloads/mobile-version.json', (route) => fulfillJson(route, {
    platform: 'android',
    appId: 'com.shoptest.mobile',
    versionName: '1.0.78',
    versionCode: 10078,
    minSupportedVersionCode: 10035,
    mandatory: false,
    releaseSigned: true,
    fileName: 'shoptest-1.0.78.apk',
    apkUrl: '/downloads/shoptest-1.0.78.apk',
  }));

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    apiRequests.push({ method, pathname, search: url.search });

    if (pathname === '/api/app/config') {
      return fulfillJson(route, {
        runtimeMode: 'test',
        paymentSimulationEnabled: true,
        emailCodeEnabled: true,
        defaultShippingFee: 0,
      });
    }
    if (pathname === '/api/auth/refresh') {
      return fulfillJson(route, {
        token: 'pet-compare-app-audit-token',
        refreshToken: 'pet-compare-app-audit-refresh-token',
      });
    }
    if (pathname === '/api/announcements/active') return fulfillJson(route, []);
    if (pathname === '/api/support/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/notifications/me/unread-count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/wishlist/me/count') return fulfillJson(route, { count: 1 });
    if (pathname === '/api/stock-alerts/me/count') return fulfillJson(route, { count: 0 });
    if (pathname === '/api/users/profile') {
      return fulfillJson(route, {
        id: 778,
        username: 'pet.compare.audit',
        email: 'pet.compare.audit@example.com',
        role: 'USER',
        roleCode: 'USER',
        status: 'ACTIVE',
      });
    }
    if (pathname === '/api/cart/me') return fulfillJson(route, []);
    if (pathname === '/api/cart/me/add' && method === 'POST') {
      return fulfillJson(route, { id: 9901, productId: Number(url.searchParams.get('productId') || 0), quantity: 1 });
    }
    if (pathname === '/api/products/finder-candidates') {
      return fulfillJson(route, products);
    }
    if (pathname === '/api/products/by-ids') {
      const ids = url.searchParams.getAll('ids').map(Number);
      return fulfillJson(route, products.filter((product) => ids.includes(product.id)));
    }
    if (pathname === '/api/products') {
      return fulfillJson(route, { content: products, totalElements: products.length, totalPages: 1, number: 0, size: products.length });
    }
    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch) {
      const product = products.find((item) => item.id === Number(productMatch[1]));
      return fulfillJson(route, product || products[0], product ? 200 : 404);
    }
    if (pathname === '/api/pet-gallery') {
      if (method === 'GET') return fulfillJson(route, petPhotos);
      if (method === 'POST') return fulfillJson(route, { ...petPhotos[0], id: 8199, likeCount: 0, likedByMe: false, canDelete: true });
    }
    if (pathname === '/api/pet-gallery/quota') {
      return fulfillJson(route, { dailyLimit: 3, usedToday: 1, remaining: 2, canUpload: true });
    }
    const likeMatch = pathname.match(/^\/api\/pet-gallery\/(\d+)\/like$/);
    if (likeMatch && method === 'POST') {
      const photo = petPhotos.find((item) => item.id === Number(likeMatch[1])) || petPhotos[0];
      return fulfillJson(route, { ...photo, likeCount: photo.likeCount + 1, likedByMe: true });
    }
    const deleteMatch = pathname.match(/^\/api\/pet-gallery\/(\d+)$/);
    if (deleteMatch && method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname.startsWith('/api/support')) {
      return fulfillJson(route, { count: 0 });
    }

    return fulfillJson(route, {});
  });
  return apiRequests;
}

async function waitForVisible(page, selector, timeout = 20000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

async function screenshot(page, viewport, stateName) {
  const file = `${viewport.name}-${stateName}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  return file;
}

async function collectSnapshot(page, viewport, stateName) {
  return page.evaluate(({ viewportName, stateName: currentStateName }) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const selectorFor = (el) => {
      if (!el) return '';
      const className = String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 180);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${className ? `.${className}` : ''}`;
    };
    const rectForElement = (el) => {
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const centerX = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const centerY = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(centerX, centerY);
      return {
        selector: selectorFor(el),
        text: textOf(el).slice(0, 260) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        position: style.position,
        zIndex: style.zIndex,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        centerHit: hit ? {
          selector: selectorFor(hit),
          text: textOf(hit).slice(0, 160),
          inside: el.contains(hit),
        } : null,
      };
    };
    const rectOf = (selector) => rectForElement(document.querySelector(selector));
    const overlap = (a, b) => {
      if (!a || !b) return null;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { overlaps: x > 1 && y > 1, x, y, area: x * y };
    };
    const hitAt = (selector, label, xFactor = 0.5, yFactor = 0.5) => {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return null;
      }
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width * xFactor));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height * yFactor));
      const hit = document.elementFromPoint(x, y);
      return {
        label,
        selector,
        point: { x, y },
        targetSelector: selectorFor(el),
        targetText: textOf(el).slice(0, 180) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
        hitSelector: selectorFor(hit),
        hitText: textOf(hit).slice(0, 180),
        hitInsideTarget: Boolean(hit && el.contains(hit)),
      };
    };
    const stackAt = (selector, label) => {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return null;
      }
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      return {
        label,
        selector,
        point: { x, y },
        stack: document.elementsFromPoint(x, y).slice(0, 8).map((item) => ({
          selector: selectorFor(item),
          text: textOf(item).slice(0, 120),
        })),
      };
    };

    const bottomNav = rectOf('.shop-nav__bottomBar');
    const interactiveSelector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '.ant-select-selector',
      '.ant-switch',
      '.ant-slider-handle',
      '.ant-popover-buttons button',
    ].join(',');

    const smallTargets = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160) || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '',
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
        };
      })
      .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44))
      .slice(0, 90);

    const tinyVisibleText = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el) && textOf(el) && !Array.from(el.children).some((child) => visible(child) && textOf(child)))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize || '0');
        if (!Number.isFinite(fontSize) || fontSize >= 12) return null;
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 180),
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
          color: style.color,
        };
      })
      .filter(Boolean)
      .slice(0, 90);

    const overflowElements = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const overflowRight = rect.right - window.innerWidth;
        const overflowLeft = -rect.left;
        const scrollOverflow = el.scrollWidth - el.clientWidth;
        if (overflowRight <= 1 && overflowLeft <= 1 && scrollOverflow <= 1) return null;
        const style = window.getComputedStyle(el);
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160),
          top: rect.top,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          overflowRight,
          overflowLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
        };
      })
      .filter(Boolean)
      .slice(0, 100);

    const clippedTexts = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el) && textOf(el) && !Array.from(el.children).some((child) => visible(child) && textOf(child)))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const clipped = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        const clipsByStyle = ['hidden', 'clip'].includes(style.overflowX)
          || ['hidden', 'clip'].includes(style.overflowY)
          || style.textOverflow === 'ellipsis';
        if (!clipped || !clipsByStyle) return null;
        const context = el.closest([
          '.product-compare__headerActions',
          '.product-compare__recommendationMain',
          '.product-compare__checkoutPath',
          '.pet-finder-page',
          '.pet-gallery-page',
        ].join(','));
        return {
          selector: selectorFor(el),
          contextSelector: selectorFor(context),
          text: textOf(el).slice(0, 180),
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          textOverflow: style.textOverflow,
          fontSize: style.fontSize,
        };
      })
      .filter(Boolean)
      .slice(0, 90);

    const bottomNavTop = bottomNav ? bottomNav.top : window.innerHeight;
    const bottomObscured = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= bottomNavTop || rect.top >= window.innerHeight) return null;
        const overlapPx = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, bottomNavTop);
        if (overlapPx <= 1) return null;
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 160) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          overlapPx,
        };
      })
      .filter(Boolean)
      .slice(0, 80);

    const tableWrapper = rectOf('.product-compare-page .ant-table-wrapper');
    const tableContent = rectOf('.product-compare-page .ant-table-content');
    const galleryPreview = rectOf('.pet-gallery-preview .ant-modal-content');
    const galleryPreviewCaption = rectOf('.pet-gallery-preview__figure figcaption');
    const galleryDeletePopover = rectOf('.pet-gallery-delete-popconfirm');
    const compareClearPopover = rectOf('.product-compare-clear-popconfirm');
    const finderSelectDropdown = rectOf('.shop-mobile-popup-layer.ant-select-dropdown');

    return {
      viewportName,
      stateName: currentStateName,
      url: window.location.href,
      bodyClasses: document.body.className,
      htmlClasses: document.documentElement.className,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
      rects: {
        bottomNav,
        petFinderPage: rectOf('.pet-finder-page'),
        finderFirstCard: rectOf('.pet-finder-page__productCard'),
        finderFirstViewButton: rectOf('.pet-finder-page__productCard .ant-card-actions .ant-btn'),
        finderSignals: rectOf('.pet-finder-page__signalGrid'),
        finderNextStep: rectOf('.pet-finder-page__nextStep'),
        finderNextStepActions: rectOf('.pet-finder-page__nextStepActions'),
        finderSelectDropdown,
        petGalleryPage: rectOf('.pet-gallery-page'),
        galleryHero: rectOf('.pet-gallery-hero'),
        galleryToolbar: rectOf('.pet-gallery-toolbar'),
        galleryInsights: rectOf('.pet-gallery-insights'),
        galleryConversion: rectOf('.pet-gallery-conversion'),
        galleryFirstCard: rectOf('.pet-gallery-card'),
        galleryFirstLike: rectOf('.pet-gallery-card__like'),
        galleryFirstDelete: rectOf('.pet-gallery-card__delete'),
        galleryDeletePopover,
        galleryPreview,
        galleryPreviewCaption,
        productComparePage: rectOf('.product-compare-page'),
        compareHeaderActions: rectOf('.product-compare__headerActions'),
        compareToolbar: rectOf('.product-compare__toolbar'),
        compareDecision: rectOf('.product-compare__decision'),
        compareDecisionGrid: rectOf('.product-compare__decisionGrid'),
        compareRecommendation: rectOf('.product-compare__recommendation'),
        compareCheckoutPath: rectOf('.product-compare__checkoutPath'),
        compareCheckoutSteps: rectOf('.product-compare__checkoutSteps'),
        compareClearPopover,
        compareTableWrapper: tableWrapper,
        compareTableContent: tableContent,
      },
      overlaps: {
        galleryPreviewCaptionVsBottomNav: overlap(galleryPreviewCaption, bottomNav),
        galleryPreviewVsBottomNav: overlap(galleryPreview, bottomNav),
        galleryDeletePopoverVsBottomNav: overlap(galleryDeletePopover, bottomNav),
        compareClearPopoverVsBottomNav: overlap(compareClearPopover, bottomNav),
        compareToolbarVsBottomNav: overlap(rectOf('.product-compare__toolbar'), bottomNav),
      },
      hits: [
        hitAt('.pet-finder-page__productCard .ant-card-actions .ant-btn', 'finder-first-view'),
        hitAt('.shop-mobile-popup-layer.ant-select-dropdown .ant-select-item-option:first-child', 'finder-select-first-option'),
        hitAt('.pet-gallery-card__like', 'gallery-first-like'),
        hitAt('.pet-gallery-card__delete', 'gallery-first-delete'),
        hitAt('.pet-gallery-delete-popconfirm .ant-popconfirm-buttons button:last-child', 'gallery-delete-confirm'),
        hitAt('.pet-gallery-preview .ant-modal-close', 'gallery-preview-close'),
        hitAt('.pet-gallery-preview__figure figcaption .ant-btn:last-child', 'gallery-preview-like'),
        hitAt('.product-compare-clear-popconfirm .ant-popconfirm-buttons button:last-child', 'compare-clear-confirm'),
        hitAt('.product-compare__difference-toggle .ant-switch', 'compare-difference-switch'),
        hitAt('.product-compare-page .ant-table-cell .ant-btn', 'compare-table-first-action'),
      ].filter(Boolean),
      stacks: [
        stackAt('.pet-gallery-delete-popconfirm .ant-popconfirm-buttons button:last-child', 'gallery-delete-confirm'),
        stackAt('.pet-gallery-preview .ant-modal-close', 'gallery-preview-close'),
        stackAt('.pet-gallery-preview__figure figcaption .ant-btn:last-child', 'gallery-preview-like'),
        stackAt('.product-compare-clear-popconfirm .ant-popconfirm-buttons button:last-child', 'compare-clear-confirm'),
        stackAt('.product-compare__difference-toggle .ant-switch', 'compare-difference-switch'),
      ].filter(Boolean),
      counts: {
        finderProductCards: document.querySelectorAll('.pet-finder-page__productCard').length,
        finderSignals: document.querySelectorAll('.pet-finder-page__signal').length,
        galleryCards: document.querySelectorAll('.pet-gallery-card').length,
        galleryDeleteButtons: document.querySelectorAll('.pet-gallery-card__delete').length,
        compareProducts: document.querySelectorAll('.product-compare-page .ant-table-thead th').length - 1,
        compareRows: document.querySelectorAll('.product-compare-page .ant-table-tbody tr').length,
        comparePaymentLikeActions: document.querySelectorAll('.product-compare-page .ant-table-cell .ant-btn').length,
        visiblePopovers: Array.from(document.querySelectorAll('.ant-popover')).filter(visible).length,
        visibleModals: Array.from(document.querySelectorAll('.ant-modal')).filter(visible).length,
      },
      tableMetrics: tableContent ? {
        wrapper: tableWrapper,
        content: tableContent,
        needsHorizontalScroll: tableContent.scrollWidth > tableContent.clientWidth + 1,
        atLeft: document.querySelector('.product-compare-page .ant-table-content')?.scrollLeft || 0,
      } : null,
      smallTargets,
      tinyVisibleText,
      clippedTexts,
      overflowElements,
      bottomObscured,
      visibleMessage: textOf(document.querySelector('.ant-message, .ant-notification')),
    };
  }, { viewportName: viewport.name, stateName });
}

async function capture(page, viewport, stateName, snapshots) {
  const file = await screenshot(page, viewport, stateName);
  const snapshot = await collectSnapshot(page, viewport, stateName);
  snapshot.screenshot = file;
  snapshots.push(snapshot);
}

async function gotoState(page, routePath, rootSelector) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForVisible(page, rootSelector, 30000);
  await page.waitForTimeout(1200);
}

async function scrollToBottom(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
}

async function openFirstPopconfirm(page, selector) {
  const locator = page.locator(selector).first();
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForSelector('.ant-popover', { state: 'visible', timeout: 7000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function runPetFinder(page, viewport, snapshots) {
  await gotoState(page, '/pet-finder', '.pet-finder-page');
  await page.waitForSelector('.pet-finder-page__productCard', { state: 'visible', timeout: 20000 });
  await capture(page, viewport, 'pet-finder-top', snapshots);
  await page.locator('.pet-finder-page__fieldControl .ant-select-selector').first().click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForSelector('.shop-mobile-popup-layer.ant-select-dropdown', { state: 'visible', timeout: 7000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  await capture(page, viewport, 'pet-finder-select-open', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await scrollToBottom(page);
  await capture(page, viewport, 'pet-finder-bottom', snapshots);
}

async function runPetGallery(page, viewport, snapshots) {
  await gotoState(page, '/pet-gallery', '.pet-gallery-page');
  await page.waitForSelector('.pet-gallery-card', { state: 'visible', timeout: 20000 });
  await capture(page, viewport, 'pet-gallery-top', snapshots);
  await openFirstPopconfirm(page, '.pet-gallery-card__delete');
  await capture(page, viewport, 'pet-gallery-delete-popconfirm', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await page.locator('.pet-gallery-card__imageButton').first().click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForSelector('.pet-gallery-preview .ant-modal-content', { state: 'visible', timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'pet-gallery-preview-open', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(300);
  await scrollToBottom(page);
  await capture(page, viewport, 'pet-gallery-bottom', snapshots);
}

async function runProductCompare(page, viewport, snapshots) {
  await gotoState(page, '/compare', '.product-compare-page');
  await page.waitForSelector('.product-compare-page .ant-table-wrapper', { state: 'visible', timeout: 20000 });
  await capture(page, viewport, 'compare-top', snapshots);
  await openFirstPopconfirm(page, '.product-compare__headerActions button:has-text("Clear")');
  await capture(page, viewport, 'compare-clear-popconfirm', snapshots);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(250);
  await page.locator('.product-compare__difference-toggle .ant-switch').click({ timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await capture(page, viewport, 'compare-differences-only', snapshots);
  await page.evaluate(() => {
    const table = document.querySelector('.product-compare-page .ant-table-content');
    if (table) table.scrollLeft = table.scrollWidth;
  });
  await page.waitForTimeout(500);
  await capture(page, viewport, 'compare-table-scrolled', snapshots);
  await scrollToBottom(page);
  await capture(page, viewport, 'compare-bottom', snapshots);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext(viewportConfig(viewport));
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await installRuntime(page);
  const apiRequests = await installMocks(page);

  const consoleMessages = [];
  const networkFailures = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500), url: page.url() });
    }
  });
  page.on('requestfailed', (request) => {
    networkFailures.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText || '' });
  });

  const snapshots = [];
  let error = null;
  try {
    await runPetFinder(page, viewport, snapshots);
    await runPetGallery(page, viewport, snapshots);
    await runProductCompare(page, viewport, snapshots);
  } catch (runError) {
    error = {
      message: runError?.message || String(runError),
      stack: runError?.stack ? String(runError.stack).slice(0, 1200) : '',
      url: page.url(),
    };
    await screenshot(page, viewport, 'failed').catch(() => undefined);
  }

  await context.close();
  return { viewport, snapshots, consoleMessages, networkFailures, apiRequests, error };
}

function isOnlyNavigationSmallTarget(item) {
  const selector = String(item.selector || '');
  return selector.includes('shop-nav__bottomItem')
    || selector.includes('shop-nav__secondary-action')
    || selector.includes('shop-nav__more-trigger')
    || selector.includes('shop-nav__cart-action')
    || selector.includes('ant-badge');
}

function isDecorativeOrHiddenTinyText(item) {
  const selector = String(item.selector || '');
  return selector.includes('ant-badge-count')
    || selector.includes('ant-scroll-number')
    || selector.includes('anticon')
    || selector.includes('shop-nav__bottomLabel');
}

function isPetCompareTinyText(item) {
  const selector = String(item.selector || '');
  const text = String(item.text || '').trim();
  const ignoredTexts = new Set(['Home', 'Products', 'Coupons', 'Cart', 'Account']);
  if (ignoredTexts.has(text)) return false;
  if (isDecorativeOrHiddenTinyText(item)) return false;
  if (item.height < 8) return false;
  return selector.includes('pet-finder-page__eyebrow')
    || selector.includes('pet-finder-page__signal')
    || selector.includes('pet-finder-page__nextStepMeta')
    || selector.includes('pet-gallery-hero__eyebrow')
    || selector.includes('pet-gallery-insights__eyebrow')
    || selector.includes('pet-gallery-insights__item')
    || selector.includes('pet-gallery-conversion__signals')
    || selector.includes('pet-gallery-card__owner')
    || selector.includes('product-compare__eyebrow')
    || selector.includes('product-compare__decisionItem')
    || selector.includes('product-compare__riskGrid')
    || selector.includes('product-compare__checkoutSteps')
    || selector.includes('product-compare__attribute')
    || selector.includes('product-compare__spec-value')
    || selector.includes('ant-table-cell')
    || selector.includes('ant-tag');
}

function isPetCompareSmallTarget(item) {
  if (isOnlyNavigationSmallTarget(item)) return false;
  const selector = String(item.selector || '');
  if (selector.includes('ant-slider-handle')) return false;
  if (selector.includes('ant-image')) return false;
  return selector.includes('pet-finder-page')
    || selector.includes('pet-gallery')
    || selector.includes('product-compare');
}

function hitMissesTarget(hit, expectedFragments) {
  if (!hit) return false;
  if (hit.hitInsideTarget) return false;
  const hitSelector = String(hit.hitSelector || '');
  return !expectedFragments.some((fragment) => hitSelector.includes(fragment));
}

function analyze(results) {
  const issues = [];

  for (const result of results) {
    for (const snapshot of result.snapshots) {
      const { viewportName, stateName } = snapshot;

      const tinyText = snapshot.tinyVisibleText
        .filter(isPetCompareTinyText)
        .filter((item) => item.top >= 0 && item.bottom <= snapshot.innerHeight);
      if (tinyText.length) {
        issues.push({
          type: 'pet-compare-labels-too-small',
          severity: 'medium',
          viewportName,
          stateName,
          evidence: {
            text: tinyText.slice(0, 16),
            screenshot: snapshot.screenshot,
          },
        });
      }

      const smallTargets = snapshot.smallTargets
        .filter(isPetCompareSmallTarget)
        .filter((item) => item.top < snapshot.innerHeight && item.bottom > 0);
      if (smallTargets.length) {
        issues.push({
          type: 'pet-compare-touch-targets-too-small',
          severity: 'medium',
          viewportName,
          stateName,
          evidence: {
            targets: smallTargets.slice(0, 16),
            screenshot: snapshot.screenshot,
          },
        });
      }

      if (snapshot.horizontalOverflow) {
        const meaningfulOverflow = snapshot.overflowElements.filter((item) => {
          const selector = String(item.selector || '');
          return !selector.includes('ant-tooltip')
            && !selector.includes('ant-popover-hidden')
            && !selector.includes('shop-nav__bottomBar')
            && !selector.includes('ant-table-content')
            && !selector.includes('ant-table-wrapper');
        });
        if (meaningfulOverflow.length) {
          issues.push({
            type: 'pet-compare-horizontal-overflow',
            severity: 'medium',
            viewportName,
            stateName,
            evidence: {
              docWidth: snapshot.docWidth,
              bodyWidth: snapshot.bodyWidth,
              innerWidth: snapshot.innerWidth,
              overflowElements: meaningfulOverflow.slice(0, 12),
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName.startsWith('compare')) {
        const clippedHeaderActions = (snapshot.clippedTexts || [])
          .filter((item) => String(item.contextSelector || '').includes('product-compare__headerActions'))
          .filter((item) => item.top >= 0 && item.bottom <= snapshot.innerHeight)
          .filter((item) => item.scrollWidth > item.clientWidth + 2);
        if (clippedHeaderActions.length) {
          issues.push({
            type: 'product-compare-header-actions-text-clipped',
            severity: 'medium',
            viewportName,
            stateName,
            evidence: {
              clippedTexts: clippedHeaderActions.slice(0, 8),
              headerActions: snapshot.rects.compareHeaderActions,
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName.startsWith('pet-gallery-preview')) {
        const captionOverlap = snapshot.overlaps.galleryPreviewCaptionVsBottomNav;
        const closeHit = snapshot.hits.find((hit) => hit.label === 'gallery-preview-close');
        const likeHit = snapshot.hits.find((hit) => hit.label === 'gallery-preview-like');
        if (captionOverlap?.overlaps || hitMissesTarget(closeHit, ['ant-modal-close']) || hitMissesTarget(likeHit, ['pet-gallery-preview', 'ant-btn'])) {
          issues.push({
            type: 'pet-gallery-preview-controls-conflict-with-app-chrome',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              bottomNav: snapshot.rects.bottomNav,
              preview: snapshot.rects.galleryPreview,
              caption: snapshot.rects.galleryPreviewCaption,
              overlap: captionOverlap,
              closeHit,
              likeHit,
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName.startsWith('pet-gallery-delete')) {
        const confirmHit = snapshot.hits.find((hit) => hit.label === 'gallery-delete-confirm');
        if (hitMissesTarget(confirmHit, ['pet-gallery-delete-popconfirm', 'ant-popover', 'ant-btn'])) {
          issues.push({
            type: 'pet-gallery-delete-popconfirm-hit-test-fails',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              popover: snapshot.rects.galleryDeletePopover,
              hit: confirmHit,
              stack: snapshot.stacks.find((stack) => stack.label === 'gallery-delete-confirm'),
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName.startsWith('compare-clear')) {
        const confirmHit = snapshot.hits.find((hit) => hit.label === 'compare-clear-confirm');
        if (hitMissesTarget(confirmHit, ['product-compare-clear-popconfirm', 'ant-popover', 'ant-btn'])) {
          issues.push({
            type: 'product-compare-clear-popconfirm-hit-test-fails',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              popover: snapshot.rects.compareClearPopover,
              hit: confirmHit,
              stack: snapshot.stacks.find((stack) => stack.label === 'compare-clear-confirm'),
              screenshot: snapshot.screenshot,
            },
          });
        }
      }

      if (stateName.startsWith('pet-finder-select')) {
        const optionHit = snapshot.hits.find((hit) => hit.label === 'finder-select-first-option');
        if (hitMissesTarget(optionHit, ['ant-select-item-option', 'shop-mobile-popup-layer'])) {
          issues.push({
            type: 'pet-finder-select-dropdown-hit-test-fails',
            severity: 'high',
            viewportName,
            stateName,
            evidence: {
              dropdown: snapshot.rects.finderSelectDropdown,
              hit: optionHit,
              screenshot: snapshot.screenshot,
            },
          });
        }
      }
    }
  }

  const unique = new Map();
  issues.forEach((issue) => {
    const key = `${issue.type}:${issue.viewportName}:${issue.stateName}`;
    if (!unique.has(key)) unique.set(key, issue);
  });
  return Array.from(unique.values());
}

function summarizeIssueGroups(issues) {
  const groups = new Map();
  for (const issue of issues) {
    const group = groups.get(issue.type) || { type: issue.type, severity: issue.severity, count: 0, viewports: new Set(), states: new Set() };
    group.count += 1;
    group.viewports.add(issue.viewportName);
    group.states.add(issue.stateName);
    groups.set(issue.type, group);
  }
  return Array.from(groups.values()).map((group) => ({
    type: group.type,
    severity: group.severity,
    count: group.count,
    viewports: Array.from(group.viewports),
    states: Array.from(group.states),
  }));
}

function writeReport(results, issues) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    mockScope: [
      'authenticated pet finder candidate catalog',
      'authenticated pet gallery photos/quota/like/delete',
      'four-product compare list with direct-add and option-required products',
      'nav count endpoints and Android App WebView runtime shim',
    ],
    results,
    issues,
    issueGroups: summarizeIssueGroups(issues),
    consoleMessageCount: results.reduce((sum, result) => sum + result.consoleMessages.length, 0),
    networkFailureCount: results.reduce((sum, result) => sum + result.networkFailures.length, 0),
    runErrors: results.filter((result) => result.error),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Mobile App Pet Tools and Compare UI Audit');
  lines.push('');
  lines.push(`Date: ${report.generatedAt}`);
  lines.push(`Base URL: \`${baseUrl}\``);
  lines.push('Mode: Playwright, mocked APIs/local storage, Android App WebView simulation.');
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('- Viewports: 320x568 and 390x844.');
  lines.push('- Pages: `/pet-finder`, `/pet-gallery`, `/compare`.');
  lines.push('- States: page top, picker/dropdown or Popconfirm where present, gallery preview Modal, compare table scrolled, page bottom.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Snapshots: ${results.reduce((sum, result) => sum + result.snapshots.length, 0)}`);
  lines.push(`- Issues: ${issues.length}`);
  lines.push(`- Console warnings/errors: ${report.consoleMessageCount}`);
  lines.push(`- Network failures: ${report.networkFailureCount}`);
  lines.push(`- Run errors: ${report.runErrors.length}`);
  lines.push('');
  lines.push('## Issue Groups');
  lines.push('');
  if (report.issueGroups.length === 0) {
    lines.push('- None.');
  } else {
    report.issueGroups.forEach((group) => {
      lines.push(`- ${group.type} (${group.severity}) x${group.count}: viewports ${group.viewports.join(', ')}; states ${group.states.join(', ')}`);
    });
  }
  lines.push('');
  lines.push('## Screenshots');
  lines.push('');
  results.forEach((result) => {
    lines.push(`### ${result.viewport.name} (${result.viewport.width}x${result.viewport.height})`);
    result.snapshots.forEach((snapshot) => {
      lines.push(`- ${snapshot.stateName}: \`${snapshot.screenshot}\``);
    });
    if (result.error) lines.push(`- Run error: ${result.error.message}`);
    lines.push('');
  });

  fs.writeFileSync(path.join(outDir, 'REPORT.md'), `${lines.join('\n')}\n`);
  return report;
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of viewports) {
      results.push(await runViewport(browser, viewport));
    }
  } finally {
    await browser.close();
  }
  const issues = analyze(results);
  const report = writeReport(results, issues);
  console.log(JSON.stringify({
    outDir,
    snapshots: results.reduce((sum, result) => sum + result.snapshots.length, 0),
    issues: report.issueGroups,
    consoleMessageCount: report.consoleMessageCount,
    networkFailureCount: report.networkFailureCount,
    runErrors: report.runErrors.map((item) => item.error || item),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
