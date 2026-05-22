const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

export {};

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      defaults: { baseURL: 'https://api.example.com' },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  },
}));

describe('api parameter normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
    mockPost.mockResolvedValue({ data: {} });
    mockPut.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
  });

  it('trims websocket tokens and rejects empty tokens', () => {
    const { supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl('  token  ')).toBe('wss://api.example.com/ws/support?token=token');
    expect(() => supportWebSocketUrl('   ')).toThrow('Support websocket token is required');
  });

  it('normalizes email login payloads before sending', async () => {
    const { userApi } = require('./index');

    await userApi.sendEmailLoginCode('  USER@Example.COM  ');
    await userApi.emailLogin('  USER@Example.COM  ', ' 12a34 567 ');

    expect(mockPost.mock.calls[0]).toEqual([
      '/auth/email-code',
      { email: 'user@example.com' },
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/auth/email-login',
      { email: 'user@example.com', code: '123456' },
    ]);
  });

  it('keeps cached API helpers usable when browser storage is unavailable', async () => {
    const originalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn(() => {
          throw new Error('storage unavailable');
        }),
        removeItem: jest.fn(() => {
          throw new Error('storage unavailable');
        }),
      },
    });

    try {
      const { productApi, notificationApi, petProfileApi } = require('./index');

      await productApi.getPersonalizedRecommendations();
      await notificationApi.getByUser();
      await notificationApi.getUnreadCount();
      await petProfileApi.getMine();

      expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
        '/products/personalized-recommendations',
        '/notifications/me',
        '/notifications/me/unread-count',
        '/pet-profiles',
      ]);
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalStorage,
      });
    }
  });

  it('filters product id lists to safe positive integers', async () => {
    const { productApi } = require('./index');

    await productApi.getByIds([1, '2', 2.5, -3, Number.MAX_SAFE_INTEGER + 1, 1] as unknown as number[]);

    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(mockGet.mock.calls[0][0]).toBe('/products/by-ids');
    expect(params.getAll('ids')).toEqual(['1', '2']);
  });

  it('normalizes product list query params before caching and requesting', async () => {
    const { productApi } = require('./index');

    await productApi.getAll('  leash\u0000   kit  ', -2, true);

    expect(mockGet.mock.calls[0][0]).toBe('/products');
    expect(mockGet.mock.calls[0][1]).toEqual({
      params: { keyword: 'leash kit', discount: true },
    });
  });

  it('reuses cached product id list responses for repeated normalized requests', async () => {
    const { productApi } = require('./index');

    mockGet.mockResolvedValueOnce({ data: [{ id: 21, name: 'Harness' }] });
    await productApi.getByIds([21, 22, 21]);
    await productApi.getByIds([21, 22, 21]);

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid product detail ids before making a request', async () => {
    const { productApi } = require('./index');

    await expect(productApi.getById(Number.NaN)).rejects.toThrow('Invalid product id');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('normalizes add-on candidate query params', async () => {
    const { productApi } = require('./index');

    await productApi.getAddOnCandidates(Infinity, [1, 1.5, 2, -5], 12.8);

    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('targetAmount')).toBe('0');
    expect(params.get('limit')).toBe('8');
    expect(params.getAll('excludedIds')).toEqual(['1', '2']);
  });

  it('normalizes cart mutation params', async () => {
    const { cartApi } = require('./index');

    await cartApi.addItem(0, 8.2, Number.NaN, '  Size=S   Color=Blue  ');
    await cartApi.removeItems([1, '2', 2, 3.4, -1] as unknown as number[]);

    expect(mockPost.mock.calls[0][2].params).toEqual({
      productId: 0,
      quantity: 1,
      selectedSpecs: 'Size=S Color=Blue',
    });
    expect((mockDelete.mock.calls[0][1].params as URLSearchParams).getAll('cartItemIds')).toEqual(['1', '2']);
  });

  it('normalizes coupon quote payloads', async () => {
    const { couponApi } = require('./index');

    await couponApi.quote({ cartItemIds: [4, 4, 5.5, -2], userCouponId: 9.1 });

    expect(mockPost.mock.calls[0][1]).toEqual({ cartItemIds: [4], userCouponId: null });
  });

  it('caches coupon lists until a claim invalidates them', async () => {
    const { couponApi } = require('./index');

    await couponApi.getPublic();
    await couponApi.getPublic();
    await couponApi.getAvailableByUser(0);
    await couponApi.getAvailableByUser(0);
    await couponApi.claim(5, 0);
    await couponApi.getPublic();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/coupons/public',
      '/coupons/me/available',
      '/coupons/public',
    ]);
  });

  it('normalizes payment payloads and guest emails', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.create(7, ' stripe ', ' USER@Example.COM ');
    await paymentApi.getByOrder(7.2, 'bad-email');

    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 7, channel: 'STRIPE', guestEmail: 'user@example.com' });
    expect(mockGet.mock.calls[0][0]).toBe('/payments/order/0');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: undefined });
  });

  it('caches payment channels for repeated checkout renders', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.getChannels();
    await paymentApi.getChannels();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/payments/channels');
  });

  it('normalizes support session path params and optional session payloads', async () => {
    const { supportApi, adminSupportApi } = require('./index');

    await supportApi.getMessages('9.3' as unknown as number);
    await supportApi.markRead('11' as unknown as number);
    await supportApi.sendMessage('hello', -4);
    await adminSupportApi.reopenSession(Number.POSITIVE_INFINITY);
    await adminSupportApi.sendMessage(8.8, 'reply');

    expect(mockGet.mock.calls[0][0]).toBe('/support/sessions/0/messages');
    expect(mockPut.mock.calls[0][0]).toBe('/support/sessions/11/read');
    expect(mockPost.mock.calls[0][0]).toBe('/support/messages');
    expect(mockPost.mock.calls[0][1]).toEqual({ content: 'hello', sessionId: undefined });
    expect(mockPut.mock.calls[1][0]).toBe('/admin/support/sessions/0/reopen');
    expect(mockPost.mock.calls[1][0]).toBe('/admin/support/sessions/0/messages');
  });

  it('normalizes product path params and short-circuits invalid recommendation requests', async () => {
    const { productApi } = require('./index');

    await productApi.update(2.2, { name: 'bad id' });
    await productApi.delete('4' as unknown as number);
    await productApi.getRecommendations(Number.NaN);

    expect(mockPut.mock.calls[0][0]).toBe('/products/0');
    expect(mockDelete.mock.calls[0][0]).toBe('/products/4');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('normalizes order paths, checkout ids, guest email, and return text fields', async () => {
    const { orderApi } = require('./index');

    await orderApi.checkout({ cartItemIds: [1, 1, 2.8, -2], shippingAddress: 'addr', paymentMethod: 'card', userCouponId: 7.3 });
    await orderApi.cancel('8' as unknown as number, ' USER@Example.COM ');
    await orderApi.submitReturnShipment(Infinity, '  TRACK   123  ');
    await orderApi.getItems(10);

    expect(mockPost.mock.calls[0][0]).toBe('/orders/checkout/me');
    expect(mockPost.mock.calls[0][1]).toEqual({
      cartItemIds: [1],
      shippingAddress: 'addr',
      paymentMethod: 'card',
      userCouponId: null,
    });
    expect(mockPut.mock.calls[0][0]).toBe('/orders/8/cancel');
    expect(mockPut.mock.calls[0][1]).toEqual({ guestEmail: 'user@example.com' });
    expect(mockPut.mock.calls[1][0]).toBe('/orders/0/return-shipment');
    expect(mockPut.mock.calls[1][1]).toEqual({ returnTrackingNumber: 'TRACK 123' });
    expect(mockGet.mock.calls[0][0]).toBe('/orders/10/items');
  });

  it('caches order item lookups and short-circuits invalid order item ids', async () => {
    const { orderApi } = require('./index');

    await orderApi.getItems(22);
    await orderApi.getItems(22);
    const invalidResponse = await orderApi.getItems(22.5);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/orders/22/items');
    expect(invalidResponse.data).toEqual([]);
  });

  it('normalizes guest checkout items and validates tracking inputs', async () => {
    const { orderApi } = require('./index');

    await orderApi.guestCheckout({
      guestEmail: ' USER@Example.COM ',
      guestName: '  Jane   Doe  ',
      guestPhone: '  +52   555  ',
      shippingAddress: '  Calle   1  ',
      paymentMethod: ' stripe ',
      items: [
        { productId: 3.2, quantity: Number.NaN, selectedSpecs: '  Red   Large  ' },
        { productId: 4, quantity: 2.8 },
      ],
    });
    await expect(orderApi.track('   ', 'bad-email')).rejects.toThrow('Order number and email are required');
    await orderApi.track(' ORD  123#! ', ' USER@Example.COM ');

    expect(mockPost.mock.calls[0][0]).toBe('/orders/checkout/guest');
    expect(mockPost.mock.calls[0][1]).toEqual({
      guestEmail: 'user@example.com',
      guestName: 'Jane Doe',
      guestPhone: '+52 555',
      shippingAddress: 'Calle 1',
      paymentMethod: 'stripe',
      items: [{ productId: 4, quantity: 2, selectedSpecs: undefined }],
    });
    expect(mockGet.mock.calls[0][0]).toBe('/orders/track');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: { orderNo: 'ORD123', email: 'user@example.com' } });
  });

  it('normalizes review and question params and text payloads', async () => {
    const { reviewApi, questionApi } = require('./index');

    await reviewApi.create(3.4, '9' as unknown as number, 9, '  Great   bowl  ');
    await questionApi.ask(-1, '  Is   it washable?  ');
    await questionApi.answer('5' as unknown as number, '  Yes   it is  ');

    expect(mockPost.mock.calls[0][0]).toBe('/reviews/product/0');
    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 9, rating: 5, comment: 'Great bowl' });
    expect(mockPost.mock.calls[1][0]).toBe('/product-questions/product/0');
    expect(mockPost.mock.calls[1][1]).toEqual({ question: 'Is it washable?' });
    expect(mockPost.mock.calls[2][0]).toBe('/product-questions/5/answer');
    expect(mockPost.mock.calls[2][1]).toEqual({ answer: 'Yes it is' });
  });

  it('caches product reviews and questions until content changes', async () => {
    const { reviewApi, questionApi } = require('./index');

    await reviewApi.getAll(777);
    await reviewApi.getAll(777);
    await questionApi.getByProduct(778);
    await questionApi.getByProduct(778);
    await reviewApi.create(777, 1, 5, '  Great  ');
    await questionApi.ask(778, '  Washable?  ');
    await reviewApi.getAll(777);
    await questionApi.getByProduct(778);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/reviews/product/777',
      '/product-questions/product/778',
      '/reviews/product/777',
      '/product-questions/product/778',
    ]);
  });

  it('normalizes category, brand, address, and wishlist identifiers', async () => {
    const { categoryApi, brandApi, addressApi, wishlistApi } = require('./index');

    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getChildren('6' as unknown as number);
    await brandApi.delete(Number.NaN);
    await addressApi.setDefault(12.1);
    await wishlistApi.toggle(0, '14' as unknown as number);

    expect(mockGet.mock.calls[0][1]).toEqual({ params: { parentId: undefined, level: undefined } });
    expect(mockGet.mock.calls[1][1]).toEqual({ params: { parentId: 6 } });
    expect(mockDelete.mock.calls[0][0]).toBe('/brands/0');
    expect(mockPut.mock.calls[0][0]).toBe('/addresses/0/default');
    expect(mockPost.mock.calls[0][2]).toEqual({ params: { productId: 14 } });
  });

  it('caches category and brand lists until catalog metadata changes', async () => {
    const { categoryApi, brandApi } = require('./index');

    await categoryApi.create({ name: 'Cache reset' });
    await brandApi.create({ name: 'Cache reset' });
    mockGet.mockClear();
    mockPost.mockClear();

    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getChildren(6);
    await categoryApi.getChildren(6);
    await brandApi.getAll({ activeOnly: true });
    await brandApi.getAll({ activeOnly: true });
    await categoryApi.create({ name: 'Beds' });
    await brandApi.update(3, { name: 'Acme' });
    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await brandApi.getAll({ activeOnly: true });

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/categories',
      '/categories',
      '/brands',
      '/categories',
      '/brands',
    ]);
  });

  it('caches address lookups until an address mutation invalidates them', async () => {
    const { addressApi } = require('./index');

    await addressApi.getByUser(0);
    await addressApi.getByUser(0);
    await addressApi.getDefault(0);
    await addressApi.getDefault(0);
    await addressApi.setDefault(3);
    await addressApi.getByUser(0);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/addresses/me',
      '/addresses/me/default',
      '/addresses/me',
    ]);
  });

  it('clears storefront coupon caches after admin coupon changes', async () => {
    const { adminApi, couponApi } = require('./index');

    await couponApi.claim(99, 0);
    mockGet.mockClear();
    mockPost.mockClear();

    await couponApi.getPublic();
    await couponApi.getPublic();
    await adminApi.createCoupon({ name: 'Spring' });
    await couponApi.getPublic();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/coupons/public',
      '/coupons/public',
    ]);
  });

  it('normalizes admin mutation and batch payload ids', async () => {
    const { adminApi } = require('./index');

    await adminApi.updateOrderStatus(3.1, ' SHIPPED ', '  TN\u0000   1 ', '  DHL ');
    await adminApi.getOrdersPage({ status: ' PENDING_SHIPMENT ', search: '  TN\u0000   1 ', quick: ' SLA_OVERDUE ', page: 2, size: 200 });
    await adminApi.exportOrders(' REFUNDED ', '  order   9 ', ' REFUNDED ');
    await adminApi.batchShipOrders([1, '2', 2, -4, 5.5] as unknown as number[], '  PKG   ', '  UPS  ');
    await adminApi.batchUpdateProductStatus([7, 7, Infinity, 8] as unknown as number[], ' INACTIVE ');
    await adminApi.grantCoupon(9.2, [10, 10, '11', -2] as unknown as number[]);

    expect(mockPut.mock.calls[0][0]).toBe('/admin/orders/0/status');
    expect(mockPut.mock.calls[0][1]).toEqual({ status: 'SHIPPED', trackingNumber: 'TN 1', trackingCarrierCode: 'DHL' });
    expect(mockGet.mock.calls[0][0]).toBe('/admin/orders/page');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: { status: 'PENDING_SHIPMENT', search: 'TN 1', quick: 'SLA_OVERDUE', page: 2, size: 100 } });
    expect(mockGet.mock.calls[1][0]).toBe('/admin/orders/export');
    expect(mockGet.mock.calls[1][1]).toEqual({ params: { status: 'REFUNDED', search: 'order 9', quick: 'REFUNDED' }, responseType: 'blob' });
    expect(mockPost.mock.calls[0][1]).toEqual({ orderIds: [1, 2], trackingPrefix: 'PKG', trackingCarrierCode: 'UPS' });
    expect(mockPost.mock.calls[1][1]).toEqual({ productIds: [7, 8], status: 'INACTIVE' });
    expect(mockPost.mock.calls[2][0]).toBe('/admin/coupons/0/grant');
    expect(mockPost.mock.calls[2][1]).toEqual({ userIds: [10, 11] });
  });

  it('caches admin dashboard and clears it after order mutations', async () => {
    const { adminApi } = require('./index');

    await adminApi.getDashboard();
    await adminApi.getDashboard();
    await adminApi.updateOrderStatus(10, 'SHIPPED');
    await adminApi.getDashboard();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/dashboard',
      '/admin/dashboard',
    ]);
  });

  it('caches admin order lists while normalizing filters until order mutations', async () => {
    const { adminApi } = require('./index');

    await adminApi.getOrders(' PENDING ');
    await adminApi.getOrders('PENDING');
    await adminApi.getOrdersPage({ status: ' PAID ', search: '  order   7 ', quick: ' OVERDUE ', page: 1, size: 500 });
    await adminApi.getOrdersPage({ status: 'PAID', search: 'order 7', quick: 'OVERDUE', page: 1, size: 100 });
    await adminApi.batchShipOrders([1, 2], ' PKG ');
    await adminApi.getOrders('PENDING');

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/orders',
      '/admin/orders/page',
      '/admin/orders',
    ]);
    expect(mockGet.mock.calls[1][1]).toEqual({
      params: { status: 'PAID', search: 'order 7', quick: 'OVERDUE', page: 1, size: 100 },
    });
  });

  it('caches admin reviews until review moderation changes', async () => {
    const { adminApi } = require('./index');

    await adminApi.getReviews();
    await adminApi.getReviews();
    await adminApi.replyReview(5, '  Thanks   for sharing  ');
    await adminApi.getReviews();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/reviews',
      '/admin/reviews',
    ]);
    expect(mockPut.mock.calls[0][1]).toEqual({ reply: 'Thanks for sharing' });
  });

  it('caches admin users and roles while normalizing user filters', async () => {
    const { adminApi } = require('./index');

    await adminApi.getUsers({ keyword: '  jane\u0000   doe ', role: ' ADMIN ', status: ' ACTIVE ' });
    await adminApi.getUsers({ keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' });
    await adminApi.getRoles();
    await adminApi.getRoles();
    await adminApi.updateUser(9, { status: 'BANNED' });
    await adminApi.getUsers({ keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' });
    await adminApi.saveRole({ code: 'OPS' });
    await adminApi.getRoles();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/users',
      '/admin/roles',
      '/admin/users',
      '/admin/roles',
    ]);
    expect(mockGet.mock.calls[0][1]).toEqual({
      params: { keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' },
    });
  });

  it('normalizes notification, pet profile, pet gallery, and logistics params', async () => {
    const { notificationApi, petProfileApi, petGalleryApi, logisticsApi } = require('./index');

    await notificationApi.markAsRead(4.4);
    await petProfileApi.update('6' as unknown as number, { name: 'Milo' });
    await petGalleryApi.like(Number.NEGATIVE_INFINITY);
    await logisticsApi.track('  1Z   999  ', '  UPS  ', 20.1);

    expect(mockPut.mock.calls[0][0]).toBe('/notifications/0/read');
    expect(mockPut.mock.calls[1][0]).toBe('/pet-profiles/6');
    expect(mockPost.mock.calls[0][0]).toBe('/pet-gallery/0/like');
    expect(mockGet.mock.calls[0][0]).toBe('/logistics/track');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: { trackingNumber: '1Z 999', carrier: 'UPS', orderId: undefined } });
  });

  it('caches logistics tracking and rejects empty tracking requests', async () => {
    const { logisticsApi } = require('./index');

    await expect(logisticsApi.track('   ')).rejects.toThrow('Tracking number or order id is required');
    await logisticsApi.track('  2Z   999  ', '  UPS  ');
    await logisticsApi.track('  2Z   999  ', '  UPS  ');

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/logistics/track');
  });

  it('caches logistics carriers until carrier mutations invalidate them', async () => {
    const { logisticsCarrierApi } = require('./index');

    await logisticsCarrierApi.getAll(true);
    await logisticsCarrierApi.getAll(true);
    await logisticsCarrierApi.create({ code: 'DHL' });
    await logisticsCarrierApi.getAll(true);

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/logistics-carriers',
      '/admin/logistics-carriers',
    ]);
    expect(mockPost.mock.calls[0][0]).toBe('/admin/logistics-carriers');
  });
});
