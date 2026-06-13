const fs = require('fs');
const path = require('path');
const { chromium } = require('./frontend/node_modules/playwright');

const outDir = path.join(__dirname, 'app-ui-audit-20260608T-mobile-storefront-codex');
const baseUrl = 'http://127.0.0.1:4200';

const viewports = [
  { name: 'small-320-app', width: 320, height: 568 },
  { name: 'phone-360-app', width: 360, height: 740 },
  { name: 'phone-390-app', width: 390, height: 844 },
];

const now = Date.parse('2026-06-08T06:20:00Z');

const products = [
  {
    id: 101,
    name: 'Ultra-comfort orthopedic dog sofa bed with removable washable cover and reinforced bolsters',
    description: 'A long-name hero product used to stress mobile card wrapping, buy bars, cart rows, and checkout summaries.',
    price: 129.99,
    originalPrice: 179.99,
    discount: 28,
    stock: 8,
    rating: 4.8,
    reviewCount: 243,
    soldCount: 1204,
    categoryId: 1,
    categoryName: 'Beds & furniture',
    brand: 'PawNest Wellness International',
    tag: 'hot',
    status: 'ACTIVE',
    imageUrl: '/assets/placeholders/product.svg',
    images: ['/assets/placeholders/product.svg', '/assets/placeholders/product.svg'],
    isFeatured: true,
    freeShipping: true,
    freeShippingThreshold: 49,
    shipping: 'Free standard delivery with oversized carrier handling',
    warranty: 'Two year comfort warranty',
    specifications: { Material: 'Layered memory foam', Size: 'Large', Color: 'Charcoal' },
    optionGroups: [
      {
        name: 'Size',
        options: [
          { value: 'Small', priceDelta: -20 },
          { value: 'Medium', priceDelta: 0 },
          { value: 'Large', priceDelta: 25 },
        ],
      },
      {
        name: 'Color',
        options: [
          { value: 'Charcoal', priceDelta: 0 },
          { value: 'Sage green with extra-long option naming', priceDelta: 4 },
        ],
      },
    ],
    detailContent: [{ type: 'text', content: 'Built for senior dogs who need stable support and easy cleanup.' }],
  },
  {
    id: 102,
    name: 'Automatic smart pet feeder with camera and low-food alerts',
    description: 'Wi-Fi feeder with scheduled meals and app alerts.',
    price: 89.5,
    originalPrice: 109.5,
    discount: 18,
    stock: 3,
    rating: 4.6,
    reviewCount: 91,
    soldCount: 612,
    categoryId: 2,
    categoryName: 'Smart devices',
    brand: 'Feedly Pro',
    tag: 'new',
    status: 'ACTIVE',
    imageUrl: '/assets/placeholders/product.svg',
    images: ['/assets/placeholders/product.svg'],
    isFeatured: true,
    freeShipping: true,
  },
  {
    id: 103,
    name: 'Sensitive skin salmon kibble subscription refill pack',
    description: 'Grain-free recipe for sensitive skin.',
    price: 59.95,
    originalPrice: 74.95,
    discount: 20,
    stock: 18,
    rating: 4.9,
    reviewCount: 418,
    soldCount: 2310,
    categoryId: 3,
    categoryName: 'Food',
    brand: 'Daily Bowl',
    tag: 'deal',
    status: 'ACTIVE',
    imageUrl: '/assets/placeholders/product.svg',
    images: ['/assets/placeholders/product.svg'],
    isFeatured: false,
    freeShipping: true,
  },
  {
    id: 104,
    name: 'Fold-flat travel carrier for cats and small dogs',
    description: 'Ventilated soft carrier with washable pad.',
    price: 45,
    originalPrice: 59,
    discount: 24,
    stock: 12,
    rating: 4.4,
    reviewCount: 77,
    soldCount: 344,
    categoryId: 4,
    categoryName: 'Travel',
    brand: 'TrailPet',
    tag: 'deal',
    status: 'ACTIVE',
    imageUrl: '/assets/placeholders/product.svg',
    images: ['/assets/placeholders/product.svg'],
  },
];

const categories = [
  { id: 1, name: 'Beds & furniture', level: 1, imageUrl: '/assets/placeholders/product.svg' },
  { id: 2, name: 'Smart devices', level: 1, imageUrl: '/assets/placeholders/product.svg' },
  { id: 3, name: 'Food & treats', level: 1, imageUrl: '/assets/placeholders/product.svg' },
  { id: 4, name: 'Travel & outdoor', level: 1, imageUrl: '/assets/placeholders/product.svg' },
];

const publicCoupons = [
  {
    id: 501,
    code: 'WELCOME-PET-FAMILY-LONG-CODE',
    name: 'Welcome bundle coupon for new pet parents',
    description: 'Save on first replenishment order.',
    type: 'PERCENT',
    discountType: 'PERCENT',
    discountValue: 15,
    minOrderAmount: 80,
    maxDiscountAmount: 30,
    status: 'ACTIVE',
    scope: 'PUBLIC',
    startTime: '2026-06-01T00:00:00Z',
    endTime: '2026-06-30T23:59:59Z',
  },
  {
    id: 502,
    code: 'FREE-SHIP-REFILL',
    name: 'Free shipping refill pass',
    description: 'Shipping covered for pantry refill orders.',
    type: 'FIXED',
    discountType: 'FIXED',
    discountValue: 9.99,
    minOrderAmount: 49,
    status: 'ACTIVE',
    scope: 'PUBLIC',
    startTime: '2026-06-01T00:00:00Z',
    endTime: '2026-06-30T23:59:59Z',
  },
];

const userCoupons = [
  {
    id: 701,
    couponId: 501,
    code: 'WELCOME-PET-FAMILY-LONG-CODE',
    name: 'Welcome bundle coupon for new pet parents',
    discountType: 'PERCENT',
    discountValue: 15,
    minOrderAmount: 80,
    maxDiscountAmount: 30,
    status: 'UNUSED',
    validUntil: '2026-06-30T23:59:59Z',
  },
];

const cartItems = [
  {
    id: 9001,
    productId: 101,
    productName: products[0].name,
    productImageUrl: products[0].imageUrl,
    imageUrl: products[0].imageUrl,
    price: products[0].price,
    quantity: 1,
    stock: products[0].stock,
    selectedSpecs: 'Size: Large; Color: Sage green with extra-long option naming',
    product: products[0],
  },
  {
    id: 9002,
    productId: 103,
    productName: products[2].name,
    productImageUrl: products[2].imageUrl,
    imageUrl: products[2].imageUrl,
    price: products[2].price,
    quantity: 2,
    stock: products[2].stock,
    selectedSpecs: 'Delivery: monthly subscription refill',
    product: products[2],
  },
];

const addresses = [
  {
    id: 801,
    recipientName: 'Maria Long Customer',
    phone: '+52 55 1234 5678',
    address: '123 Long Return Address, Interior 42, Colonia Centro, Ciudad de Mexico, MX 01000',
    isDefault: true,
  },
];

const orders = [
  {
    id: 8801,
    orderNo: 'SO-MOBILE-20260608-00008801-LONG',
    status: 'SHIPPED',
    totalAmount: 2386.75,
    originalAmount: 2486.75,
    discountAmount: 100,
    shippingFee: 0,
    paymentMethod: 'STRIPE',
    trackingNumber: 'MX-TRACK-VERY-LONG-00008801',
    trackingCarrierCode: 'DHL',
    createdAt: '2026-06-08T02:20:00Z',
    recipientName: 'Maria Long Customer',
    recipientPhone: '+52 55 1234 5678',
    shippingAddress: addresses[0].address,
  },
  {
    id: 8802,
    orderNo: 'SO-MOBILE-20260607-00008802-RETURN',
    status: 'RETURN_REQUESTED',
    totalAmount: 129.99,
    originalAmount: 129.99,
    discountAmount: 0,
    shippingFee: 0,
    paymentMethod: 'MERCADO_PAGO',
    createdAt: '2026-06-07T16:10:00Z',
  },
];

const orderItems = [
  {
    id: 81001,
    orderId: 8801,
    productId: 101,
    productName: products[0].name,
    imageUrl: products[0].imageUrl,
    price: 129.99,
    quantity: 1,
    selectedSpecs: 'Size: Large; Color: Sage green with extra-long option naming',
  },
  {
    id: 81002,
    orderId: 8801,
    productId: 103,
    productName: products[2].name,
    imageUrl: products[2].imageUrl,
    price: 59.95,
    quantity: 2,
    selectedSpecs: 'Delivery: monthly subscription refill',
  },
];

const notifications = [
  {
    id: 3001,
    type: 'ORDER',
    title: 'Order #SO-MOBILE-20260608-00008801-LONG updated',
    message: 'Your order was split into two shipments. The refrigerated item will ship after warehouse verification.',
    contentFormat: 'TEXT',
    isRead: false,
    createdAt: new Date(now - 120_000).toISOString(),
  },
  {
    id: 3002,
    type: 'PROMOTION',
    title: 'Limited weekend refill coupon for pets with a very long merchandising headline',
    message: 'Use your refill coupon before the next shipping batch closes.',
    contentFormat: 'TEXT',
    isRead: false,
    createdAt: new Date(now - 240_000).toISOString(),
  },
];

const wishlistItems = [
  {
    id: 6101,
    productId: 102,
    productName: products[1].name,
    product: products[1],
    price: products[1].price,
    imageUrl: products[1].imageUrl,
    createdAt: '2026-06-07T09:00:00Z',
  },
];

const supportSessions = [
  {
    id: 7001,
    status: 'OPEN',
    assignedAdminName: 'support.audit.agent',
    unreadByUser: 0,
    lastMessage: 'We can help with the delivery split.',
    lastMessageAt: '2026-06-08T05:15:00Z',
    createdAt: '2026-06-08T05:00:00Z',
  },
];

const supportMessages = [
  {
    id: 91001,
    sessionId: 7001,
    senderRole: 'USER',
    content: 'Can you confirm the delivery split for this very long order number?',
    isReadByUser: true,
    createdAt: '2026-06-08T05:05:00Z',
  },
  {
    id: 91002,
    sessionId: 7001,
    senderRole: 'ADMIN',
    content: 'Yes. One box is shipping today and the refrigerated item ships after warehouse verification.',
    isReadByUser: false,
    createdAt: '2026-06-08T05:15:00Z',
  },
];

const paymentChannels = [
  { code: 'STRIPE', name: 'Credit card', enabled: true, description: 'Card payment' },
  { code: 'MERCADO_PAGO', name: 'Mercado Pago', enabled: true, description: 'Wallet and installments' },
];

const userProfile = {
  id: 501,
  username: 'maria.customer.with.a.very.long.name',
  email: 'maria.long.customer@example.test',
  phone: '+52 55 1234 5678',
  role: 'USER',
  roleCode: 'USER',
  status: 'ACTIVE',
};

function productPage(items = products) {
  return { items, total: items.length, page: 0, size: 12, totalPages: 1, hasNext: false, hasPrevious: false };
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function filterProducts(url) {
  const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
  const categoryId = Number(url.searchParams.get('categoryId') || '');
  const discount = url.searchParams.get('discount') === 'true';
  const collection = url.searchParams.get('collection') || '';
  let next = [...products];
  if (keyword) {
    next = next.filter((product) => `${product.name} ${product.description} ${product.categoryName}`.toLowerCase().includes(keyword));
  }
  if (categoryId) {
    next = next.filter((product) => product.categoryId === categoryId);
  }
  if (discount) {
    next = next.filter((product) => product.discount > 0);
  }
  if (collection === 'smart-devices') {
    next = next.filter((product) => product.categoryId === 2);
  }
  return next.length ? next : products.slice(0, 2);
}

async function installMocks(page) {
  await page.addInitScript(() => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: '/api',
      supportWebSocketUrl: '/ws/support',
      apiGatewayEnabled: false,
      apiGatewayPrefix: '/gateway',
      mobileVersionManifestUrl: '/downloads/mobile-version.json',
      mobileCurrentVersionCode: 10077,
      mobileCurrentVersionName: '1.0.77',
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
    localStorage.setItem('token', 'ui-audit-token');
    localStorage.setItem('refreshToken', 'ui-audit-refresh-token');
    localStorage.setItem('userId', '501');
    localStorage.setItem('username', 'maria.customer.with.a.very.long.name');
    localStorage.setItem('role', 'USER');
    localStorage.setItem('shop_recent_products', JSON.stringify([
      { productId: 101, viewedAt: Date.now() - 50000 },
      { productId: 102, viewedAt: Date.now() - 120000 },
      { productId: 103, viewedAt: Date.now() - 190000 },
    ]));
  });

  await page.route('**/downloads/mobile-version.json', (route) => fulfillJson(route, {
    platform: 'android',
    appId: 'com.shoptest.mobile',
    versionName: '1.0.77',
    versionCode: 10077,
    minSupportedVersionCode: 10001,
    mandatory: false,
    releaseSigned: true,
    certificateSha256: '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
    fileName: 'shoptest-1.0.77.apk',
    sizeBytes: 64000000,
    sha256: 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    apkUrl: '/downloads/shoptest-1.0.77.apk',
    releaseNotes: ['Audit fixture'],
  }));

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === '/api/auth/refresh') return fulfillJson(route, { token: 'ui-audit-token', refreshToken: 'ui-audit-refresh-token' });
    if (pathname === '/api/users/profile') return fulfillJson(route, userProfile);
    if (pathname === '/api/users/password') return fulfillJson(route, {});

    if (pathname === '/api/announcements/active') return fulfillJson(route, []);
    if (pathname === '/api/categories') return fulfillJson(route, categories);
    if (pathname === '/api/brands') return fulfillJson(route, [{ id: 1, name: 'PawNest Wellness International', status: 'ACTIVE' }]);

    if (pathname === '/api/products') return fulfillJson(route, productPage(filterProducts(url)));
    if (pathname === '/api/products/featured') return fulfillJson(route, products.slice(0, 3));
    if (pathname === '/api/products/personalized-recommendations') return fulfillJson(route, products.slice(1, 4));
    if (pathname === '/api/products/finder-candidates') return fulfillJson(route, products);
    if (pathname === '/api/products/by-ids') {
      const ids = url.searchParams.getAll('ids').map(Number);
      return fulfillJson(route, products.filter((product) => ids.includes(product.id)));
    }
    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch) {
      const product = products.find((item) => item.id === Number(productMatch[1])) || products[0];
      return fulfillJson(route, product);
    }
    const recommendationMatch = pathname.match(/^\/api\/products\/(\d+)\/recommendations$/);
    if (recommendationMatch) return fulfillJson(route, products.filter((product) => product.id !== Number(recommendationMatch[1])).slice(0, 3));
    if (pathname === '/api/products/add-on-candidates') return fulfillJson(route, products.slice(1, 4));

    if (pathname === '/api/cart/me') return fulfillJson(route, cartItems);
    if (pathname === '/api/cart/me/add' && method === 'POST') return fulfillJson(route, { ok: true });
    if (pathname === '/api/cart/update') return fulfillJson(route, { ok: true });
    if (pathname.startsWith('/api/cart/remove')) return method === 'DELETE' ? fulfillJson(route, { ok: true }) : fulfillJson(route, {});
    if (pathname === '/api/cart/me/clear') return fulfillJson(route, { ok: true });

    if (pathname === '/api/coupons/public') return fulfillJson(route, publicCoupons);
    if (pathname === '/api/coupons/me') return fulfillJson(route, userCoupons);
    if (pathname === '/api/coupons/me/available') return fulfillJson(route, userCoupons);
    if (pathname === '/api/coupons/me/quote') {
      return fulfillJson(route, {
        eligible: true,
        discountAmount: 25,
        subtotal: 249.89,
        payableAmount: 224.89,
        shippingFee: 0,
        userCouponId: 701,
      });
    }
    if (/^\/api\/coupons\/me\/\d+\/claim$/.test(pathname)) return fulfillJson(route, userCoupons[0]);

    if (pathname === '/api/wishlist/me') return fulfillJson(route, wishlistItems);
    if (pathname === '/api/wishlist/me/count') return fulfillJson(route, { count: wishlistItems.length });
    if (pathname === '/api/wishlist/me/check') return fulfillJson(route, { wishlisted: false });
    if (pathname === '/api/wishlist/me/toggle') return fulfillJson(route, { wishlisted: true });

    if (pathname === '/api/notifications/me/unread-count') return fulfillJson(route, { count: 2 });
    if (pathname === '/api/notifications/me') return fulfillJson(route, notifications);
    if (pathname === '/api/notifications/me/read-all') return fulfillJson(route, { ok: true });
    if (/^\/api\/notifications\/\d+\/read$/.test(pathname)) return fulfillJson(route, { ok: true });
    if (/^\/api\/notifications\/\d+$/.test(pathname) && method === 'DELETE') return route.fulfill({ status: 204, body: '' });

    if (pathname === '/api/addresses/me') return fulfillJson(route, addresses);
    if (pathname === '/api/addresses/me/default') return fulfillJson(route, addresses[0]);
    if (pathname.startsWith('/api/addresses')) return fulfillJson(route, addresses[0]);

    if (pathname === '/api/pet-profiles') {
      return fulfillJson(route, [
        { id: 991, name: 'Milo With A Very Long Pet Name', petType: 'DOG', breed: 'Senior mixed breed', size: 'LARGE', weight: 32, birthday: '2018-05-20' },
      ]);
    }

    if (pathname === '/api/orders/me') return fulfillJson(route, orders);
    if (pathname === '/api/orders/track') return fulfillJson(route, { order: orders[0], items: orderItems, payments: [] });
    const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
    if (orderMatch) return fulfillJson(route, orders.find((order) => order.id === Number(orderMatch[1])) || orders[0]);
    const orderItemsMatch = pathname.match(/^\/api\/orders\/(\d+)\/items$/);
    if (orderItemsMatch) return fulfillJson(route, orderItems.map((item) => ({ ...item, orderId: Number(orderItemsMatch[1]) })));
    if (pathname === '/api/orders/checkout/me') {
      return fulfillJson(route, {
        ...orders[0],
        id: 8803,
        orderNo: 'SO-MOBILE-20260608-CHECKOUT-NEW',
        status: 'PENDING_PAYMENT',
      });
    }
    if (pathname === '/api/orders/checkout/guest') {
      return fulfillJson(route, {
        ...orders[0],
        id: 8804,
        orderNo: 'SO-MOBILE-20260608-GUEST-NEW',
        status: 'PENDING_PAYMENT',
      });
    }
    if (/^\/api\/orders\/\d+\/(cancel|confirm|return|return-shipment)$/.test(pathname)) return fulfillJson(route, { ok: true });

    if (pathname === '/api/payments/channels') return fulfillJson(route, paymentChannels);
    if (pathname === '/api/payments') {
      return fulfillJson(route, {
        id: 7701,
        orderId: 8803,
        orderNo: 'SO-MOBILE-20260608-CHECKOUT-NEW',
        channel: 'STRIPE',
        status: 'PENDING',
        amount: 224.89,
        paymentUrl: 'https://payments.example.test/session/mobile-checkout',
        createdAt: '2026-06-08T06:20:00Z',
      });
    }
    if (/^\/api\/payments\/order\/\d+\/latest$/.test(pathname)) return fulfillJson(route, { id: 7701, orderId: 8801, status: 'PENDING', amount: 2386.75, channel: 'STRIPE' });
    if (/^\/api\/payments\/order\/\d+$/.test(pathname)) return fulfillJson(route, [{ id: 7701, orderId: 8801, status: 'PENDING', amount: 2386.75, channel: 'STRIPE' }]);

    if (/^\/api\/reviews\/product\/\d+$/.test(pathname)) {
      return fulfillJson(route, {
        averageRating: 4.7,
        reviews: [
          { id: 401, username: 'maria.customer.with.a.very.long.name', rating: 5, comment: 'Comfortable and easy to clean after a muddy weekend.', createdAt: '2026-06-07T12:00:00Z' },
        ],
      });
    }
    if (/^\/api\/reviews\/product\/\d+\/reviewable-orders$/.test(pathname)) return fulfillJson(route, orders);
    if (/^\/api\/product-questions\/product\/\d+$/.test(pathname)) {
      return fulfillJson(route, [
        { id: 701, question: 'Will the washable cover fit after several hot-water cycles?', answer: 'Yes, use warm water and air dry.', createdAt: '2026-06-07T10:05:00Z', answeredAt: '2026-06-07T22:30:00Z' },
      ]);
    }

    if (pathname === '/api/pet-gallery') return fulfillJson(route, []);
    if (pathname === '/api/pet-gallery/quota') return fulfillJson(route, { used: 0, limit: 5, remaining: 5 });
    if (pathname === '/api/logistics/track') return fulfillJson(route, { status: 'IN_TRANSIT', events: [] });

    if (pathname === '/api/support/unread-count') return fulfillJson(route, { count: 1 });
    if (pathname === '/api/support/session') return fulfillJson(route, supportSessions[0]);
    if (pathname === '/api/support/sessions') return fulfillJson(route, supportSessions);
    if (/^\/api\/support\/sessions\/\d+\/messages$/.test(pathname)) return fulfillJson(route, supportMessages);
    if (/^\/api\/support\/sessions\/\d+\/read$/.test(pathname)) return route.fulfill({ status: 204, body: '' });
    if (pathname === '/api/support/messages') return fulfillJson(route, { message: supportMessages[0], session: supportSessions[0] });

    return fulfillJson(route, {});
  });
}

function interestingSelectorsForPage(pathname) {
  if (pathname === '/') {
    return [
      '.shopee-home',
      '.shop-nav',
      '.shop-nav__mobileHeader',
      '.shop-nav__bottomBar',
      '.shopee-hero',
      '.shopee-hero__actions',
      '.shopee-coupon-entry',
      '.shopee-product-card',
      '.shopee-section',
      '.app-support-launcher',
    ];
  }
  if (pathname.startsWith('/products/')) {
    return [
      '.product-detail-page',
      '.product-detail-hero',
      '.product-detail-title',
      '.product-detail-actions',
      '.product-mobile-buybar',
      '.product-review-card',
      '.product-qa-card',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/products') {
    return [
      '.product-list',
      '.product-list-hero',
      '.product-list-toolbar',
      '.product-list__heroBand',
      '.product-list__toolbar',
      '.product-list__mobileDiscovery',
      '.product-list__grid',
      '.product-list__card',
      '.ant-pagination',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/cart') {
    return [
      '.cart-page',
      '.cart-page__hero',
      '.cart-page__mobileList',
      '.cart-page__mobileItem',
      '.cart-page__quantityStepper',
      '.cart-page__summary',
      '.cart-page__summaryFooter',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/checkout') {
    return [
      '.checkout-page',
      '.checkout-page__hero',
      '.checkout-page__sectionCard',
      '.checkout-page__summary',
      '.checkout-page__submitButton',
      '.checkout-page__mobilePayBar',
      '.checkout-page__paymentMethods',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/profile') {
    return [
      '.profile-page',
      '.profile-overview',
      '.profile-action-center',
      '.profile-mobile-entry',
      '.profile-tabs',
      '.profile-orders',
      '.profile-order-card',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/coupons') {
    return [
      '.coupon-center-page',
      '.coupon-center-page__hero',
      '.coupon-next-action',
      '.coupon-wallet',
      '.coupon-claim-section',
      '.coupon-center-page__coupon',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/notifications') {
    return [
      '.notifications-page',
      '.notifications-page__assistant',
      '.notifications-page__actionPlan',
      '.notifications-page__list',
      '.notifications-page__item',
      '.notifications-page__deleteButton',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/wishlist') {
    return [
      '.wishlist-page',
      '.wishlist-page__hero',
      '.wishlist-page__grid',
      '.wishlist-page__item',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/track-order') {
    return [
      '.order-tracking-page',
      '.order-tracking-page__lookupCard',
      '.order-tracking-page__lookupForm',
      '.order-tracking-page__resultStack',
      '.order-tracking-page__journey',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  if (pathname === '/pet-finder') {
    return [
      '.pet-finder-page',
      '.pet-finder-page__hero',
      '.pet-finder-page__form',
      '.pet-finder-page__results',
      '.shop-nav__bottomBar',
      '.app-support-launcher',
    ];
  }
  return ['.shop-nav__bottomBar', '.app-support-launcher'];
}

async function collectMetrics(page, routeName, stateName, selectors) {
  return page.evaluate(({ routeName: currentRouteName, stateName: currentStateName, selectors: selectorsToRead }) => {
    const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ');
    const ownTextOf = (el) => Array.from(el?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .trim()
      .replace(/\s+/g, ' ');
    const visible = (el) => {
      if (!el) return false;
      if (el.closest('[hidden], [aria-hidden="true"]')) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const inViewport = (rect) => rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    const selectorFor = (el) => {
      if (!el) return '';
      const className = String(el.className || '').trim().replace(/\s+/g, '.').slice(0, 120);
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${className ? `.${className}` : ''}`;
    };
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
        text: textOf(el).slice(0, 240),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
        top: rect.top,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        visibility: style.visibility,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        whiteSpace: style.whiteSpace,
        fullyVisible: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        centerHit: hit ? {
          selector: selectorFor(hit),
          text: textOf(hit).slice(0, 120),
          inside: el.contains(hit),
        } : null,
      };
    };

    const bottomBar = document.querySelector('.shop-nav__bottomBar');
    const bottomRect = bottomBar?.getBoundingClientRect();
    const bottomCoverTop = bottomRect && visible(bottomBar) ? Math.max(0, bottomRect.top) : window.innerHeight;
    const supportLauncher = document.querySelector('.app-support-launcher');
    const launcherRect = supportLauncher?.getBoundingClientRect();

    const interactiveSelector = [
      'button',
      'a[href]',
      'input',
      'textarea',
      '[role="button"]',
      '.ant-select-selector',
      '.ant-checkbox-wrapper',
      '.ant-radio-wrapper',
      '.ant-pagination-item',
    ].join(',');

    const smallTargets = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 120) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          fontSize: style.fontSize,
        };
      })
      .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44))
      .slice(0, 40);

    const smallText = Array.from(document.querySelectorAll('body *'))
      .filter((el) => visible(el))
      .map((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const fontSize = parseFloat(style.fontSize || '0');
        const ownText = ownTextOf(el);
        if (!inViewport(rect) || (rect.width <= 1 && rect.height <= 1) || !Number.isFinite(fontSize) || fontSize >= 12 || !ownText) return null;
        return {
          selector: selectorFor(el),
          text: ownText.slice(0, 120),
          fontSize,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
        };
      })
      .filter(Boolean)
      .slice(0, 30);

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
          text: textOf(el).slice(0, 140),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          overflowRight,
          overflowLeft,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
          position: style.position,
          display: style.display,
        };
      })
      .filter(Boolean)
      .sort((left, right) => Math.max(right.overflowRight || 0, right.overflowLeft || 0, (right.scrollWidth || 0) - (right.clientWidth || 0)) - Math.max(left.overflowRight || 0, left.overflowLeft || 0, (left.scrollWidth || 0) - (left.clientWidth || 0)))
      .slice(0, 40);

    const bottomObscured = Array.from(document.querySelectorAll(interactiveSelector))
      .filter((el) => visible(el))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= bottomCoverTop || rect.top >= window.innerHeight) return null;
        const overlapPx = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, bottomCoverTop);
        if (overlapPx <= 0.5) return null;
        return {
          selector: selectorFor(el),
          text: textOf(el).slice(0, 120) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
          y: rect.y,
          height: rect.height,
          bottom: rect.bottom,
          overlapPx,
        };
      })
      .filter(Boolean)
      .slice(0, 30);

    const supportOverlap = launcherRect && visible(supportLauncher)
      ? Array.from(document.querySelectorAll(interactiveSelector))
        .filter((el) => visible(el) && el !== supportLauncher && !supportLauncher.contains(el))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const xOverlap = Math.max(0, Math.min(rect.right, launcherRect.right) - Math.max(rect.left, launcherRect.left));
          const yOverlap = Math.max(0, Math.min(rect.bottom, launcherRect.bottom) - Math.max(rect.top, launcherRect.top));
          if (xOverlap <= 2 || yOverlap <= 2) return null;
          return {
            selector: selectorFor(el),
            text: textOf(el).slice(0, 120) || el.getAttribute('aria-label') || el.getAttribute('title') || '',
            overlapArea: xOverlap * yOverlap,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        })
        .filter(Boolean)
        .slice(0, 20)
      : [];

    return {
      routeName: currentRouteName,
      stateName: currentStateName,
      url: window.location.href,
      bodyClasses: document.body.className,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1,
      bottomCoverTop,
      rectangles: Object.fromEntries(selectorsToRead.map((selector) => [selector, rectOf(selector)])),
      smallTargets,
      smallText,
      overflowElements,
      bottomObscured,
      supportOverlap,
      visibleToastText: textOf(document.querySelector('.ant-message, .ant-notification')),
    };
  }, { routeName, stateName, selectors });
}

async function waitForSettled(page, selector) {
  await page.waitForSelector(selector, { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(900);
}

async function screenshotAndMetric(page, viewport, routeName, stateName, selectors, metrics) {
  const safeName = `${viewport.name}-${routeName}-${stateName}`.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-');
  await page.screenshot({ path: path.join(outDir, `${safeName}.png`), fullPage: false });
  metrics.push(await collectMetrics(page, routeName, stateName, selectors));
}

async function scrollIfPresent(page, selector, options = {}) {
  const timeout = options.timeout || 1500;
  const locator = page.locator(selector).first();
  const count = await page.locator(selector).count().catch(() => 0);
  if (!count) return false;
  await locator.scrollIntoViewIfNeeded({ timeout }).catch(() => undefined);
  return true;
}

async function runRoute(page, viewport, route) {
  const metrics = [];
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

  let routeError = null;
  try {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForSettled(page, route.waitFor);
    const url = new URL(page.url());
    const selectors = interestingSelectorsForPage(url.pathname);
    await screenshotAndMetric(page, viewport, route.name, 'top', selectors, metrics);

    if (route.action === 'detail-mid') {
      await scrollIfPresent(page, '#product-reviews-card, .product-review-card');
      await page.waitForTimeout(450);
      await screenshotAndMetric(page, viewport, route.name, 'reviews', selectors, metrics);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(450);
      await screenshotAndMetric(page, viewport, route.name, 'bottom', selectors, metrics);
    } else if (route.action === 'cart-bottom') {
      await scrollIfPresent(page, '.cart-page__summary, .cart-page__mobileList');
      await page.waitForTimeout(450);
      await screenshotAndMetric(page, viewport, route.name, 'summary', selectors, metrics);
    } else if (route.action === 'checkout-form') {
      await scrollIfPresent(page, '.checkout-page__submitButton, .checkout-page__mobilePayBar, .checkout-page__couponSummary');
      await page.waitForTimeout(450);
      await screenshotAndMetric(page, viewport, route.name, 'summary', selectors, metrics);
    } else if (route.action === 'profile-orders') {
      const ordersTab = page.locator('.profile-mobile-entry__item', { hasText: /order|订单|pedido/i }).first();
      await ordersTab.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      await scrollIfPresent(page, '.profile-order-card');
      await screenshotAndMetric(page, viewport, route.name, 'orders', selectors, metrics);
    } else if (route.action === 'track-result') {
      await page.locator('input[name="orderNo"], #orderNo, input[placeholder*="order"]').first().fill('SO-MOBILE-20260608-00008801-LONG', { timeout: 1500 }).catch(() => undefined);
      await page.locator('input[name="email"], #email, input[type="email"]').first().fill('maria.long.customer@example.test', { timeout: 1500 }).catch(() => undefined);
      await page.locator('.order-tracking-page__lookupButton, button[type="submit"]').first().click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1200);
      const hasResult = await scrollIfPresent(page, '.order-tracking-page__resultStack');
      await screenshotAndMetric(page, viewport, route.name, hasResult ? 'result' : 'after-submit', selectors, metrics);
    } else {
      await page.evaluate(() => window.scrollTo({ top: Math.min(document.documentElement.scrollHeight * 0.55, 1200), behavior: 'instant' }));
      await page.waitForTimeout(350);
      await screenshotAndMetric(page, viewport, route.name, 'mid', selectors, metrics);
    }
  } catch (error) {
    routeError = {
      message: error?.message || String(error),
      stack: error?.stack ? String(error.stack).slice(0, 1200) : '',
      url: page.url(),
    };
    await page.screenshot({
      path: path.join(outDir, `${viewport.name}-${route.name}-failed.png`.replace(/[^a-z0-9._-]+/gi, '-')),
      fullPage: false,
    }).catch(() => undefined);
  }

  return { route, metrics, consoleMessages, networkFailures, routeError };
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel Audit) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 ShopTestAndroidApp/${viewport.name}`,
  });
  const page = await context.newPage();
  await installMocks(page);

  const routes = [
    { name: 'home', path: '/', waitFor: '.shop-nav__bottomBar' },
    { name: 'products', path: '/products?keyword=bed&discount=true', waitFor: '.product-list' },
    { name: 'detail', path: '/products/101', waitFor: '.product-detail-page', action: 'detail-mid' },
    { name: 'cart', path: '/cart', waitFor: '.cart-page', action: 'cart-bottom' },
    { name: 'checkout', path: '/checkout', waitFor: '.checkout-page', action: 'checkout-form' },
    { name: 'coupons', path: '/coupons', waitFor: '.coupon-center-page' },
    { name: 'wishlist', path: '/wishlist', waitFor: '.wishlist-page' },
    { name: 'notifications', path: '/notifications', waitFor: '.notifications-page' },
    { name: 'profile', path: '/profile?tab=orders', waitFor: '.profile-page', action: 'profile-orders' },
    { name: 'track-order', path: '/track-order', waitFor: '.order-tracking-page', action: 'track-result' },
    { name: 'pet-finder', path: '/pet-finder', waitFor: '.pet-finder-page' },
  ];

  const routeResults = [];
  for (const route of routes) {
    routeResults.push(await runRoute(page, viewport, route));
  }

  await context.close();
  return { viewport, routeResults };
}

function summarizeIssue(metric) {
  const issues = [];
  const ignorableTarget = (item) => {
    const text = `${item.selector} ${item.text}`.toLowerCase();
    return text.includes('skip') || text.includes('slick') || text.includes('swiper');
  };
  const smallTargets = metric.smallTargets.filter((item) => !ignorableTarget(item));
  const smallText = metric.smallText;
  const overflow = metric.overflowElements.filter((item) => !String(item.selector).includes('ant-tooltip'));
  const bottomObscured = metric.bottomObscured.filter((item) => !String(item.selector).includes('shop-nav__bottomItem'));
  if (metric.horizontalOverflow) {
    issues.push({ type: 'horizontal-overflow', severity: 'high', count: overflow.length, examples: overflow.slice(0, 5) });
  }
  if (smallTargets.length) {
    issues.push({ type: 'small-touch-target', severity: 'medium', count: smallTargets.length, examples: smallTargets.slice(0, 5) });
  }
  if (smallText.length) {
    issues.push({ type: 'small-font', severity: 'medium', count: smallText.length, examples: smallText.slice(0, 5) });
  }
  if (bottomObscured.length) {
    issues.push({ type: 'bottom-nav-obscures-control', severity: 'high', count: bottomObscured.length, examples: bottomObscured.slice(0, 5) });
  }
  if (metric.supportOverlap.length) {
    issues.push({ type: 'support-launcher-overlap', severity: 'medium', count: metric.supportOverlap.length, examples: metric.supportOverlap.slice(0, 5) });
  }
  return issues;
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

  const flatMetrics = results.flatMap((result) => result.routeResults.flatMap((routeResult) => routeResult.metrics));
  const issueStates = flatMetrics.map((metric) => ({ metric, issues: summarizeIssue(metric) })).filter((item) => item.issues.length);
  const consoleMessages = results.flatMap((result) => result.routeResults.flatMap((routeResult) => routeResult.consoleMessages.map((message) => ({
    viewport: result.viewport.name,
    route: routeResult.route.name,
    ...message,
  }))));
  const networkFailures = results.flatMap((result) => result.routeResults.flatMap((routeResult) => routeResult.networkFailures.map((failure) => ({
    viewport: result.viewport.name,
    route: routeResult.route.name,
    ...failure,
  }))));
  const routeErrors = results.flatMap((result) => result.routeResults
    .filter((routeResult) => routeResult.routeError)
    .map((routeResult) => ({
      viewport: result.viewport.name,
      route: routeResult.route.name,
      ...routeResult.routeError,
    })));

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    results,
    metrics: flatMetrics,
    issueStates,
    consoleMessages,
    networkFailures,
    routeErrors,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const summary = {
    generatedAt: report.generatedAt,
    baseUrl,
    viewportCount: viewports.length,
    routeStateCount: flatMetrics.length,
    issueStateCount: issueStates.length,
    issueCounts: issueStates.reduce((acc, state) => {
      state.issues.forEach((issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
      });
      return acc;
    }, {}),
    consoleMessageCount: consoleMessages.length,
    networkFailureCount: networkFailures.length,
    routeErrorCount: routeErrors.length,
    routeErrors,
    topIssues: issueStates.slice(0, 40).map(({ metric, issues }) => ({
      viewport: `${metric.innerWidth}x${metric.innerHeight}`,
      routeName: metric.routeName,
      stateName: metric.stateName,
      url: metric.url,
      issues,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
