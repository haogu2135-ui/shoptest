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

  it('normalizes payment payloads and guest emails', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.create(7, ' stripe ', ' USER@Example.COM ');
    await paymentApi.getByOrder(7.2, 'bad-email');

    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 7, channel: 'STRIPE', guestEmail: 'user@example.com' });
    expect(mockGet.mock.calls[0][0]).toBe('/payments/order/0');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: undefined });
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

  it('normalizes product path params for mutations and recommendation requests', async () => {
    const { productApi } = require('./index');

    await productApi.update(2.2, { name: 'bad id' });
    await productApi.delete('4' as unknown as number);
    await productApi.getRecommendations(Number.NaN);

    expect(mockPut.mock.calls[0][0]).toBe('/products/0');
    expect(mockDelete.mock.calls[0][0]).toBe('/products/4');
    expect(mockGet.mock.calls[0][0]).toBe('/products/0/recommendations');
  });

  it('normalizes order paths, checkout ids, guest email, and return text fields', async () => {
    const { orderApi } = require('./index');

    await orderApi.checkout({ cartItemIds: [1, 1, 2.8, -2], shippingAddress: 'addr', paymentMethod: 'card', userCouponId: 7.3 });
    await orderApi.cancel('8' as unknown as number, ' USER@Example.COM ');
    await orderApi.submitReturnShipment(Infinity, '  TRACK   123  ');
    await orderApi.getItems(10.5);

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
    expect(mockGet.mock.calls[0][0]).toBe('/orders/0/items');
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

  it('normalizes admin mutation and batch payload ids', async () => {
    const { adminApi } = require('./index');

    await adminApi.updateOrderStatus(3.1, ' SHIPPED ', '  TN   1 ', '  DHL ');
    await adminApi.batchShipOrders([1, '2', 2, -4, 5.5] as unknown as number[], '  PKG   ', '  UPS  ');
    await adminApi.batchUpdateProductStatus([7, 7, Infinity, 8] as unknown as number[], ' INACTIVE ');
    await adminApi.grantCoupon(9.2, [10, 10, '11', -2] as unknown as number[]);

    expect(mockPut.mock.calls[0][0]).toBe('/admin/orders/0/status');
    expect(mockPut.mock.calls[0][1]).toEqual({ status: 'SHIPPED', trackingNumber: 'TN 1', trackingCarrierCode: 'DHL' });
    expect(mockPost.mock.calls[0][1]).toEqual({ orderIds: [1, 2], trackingPrefix: 'PKG', trackingCarrierCode: 'UPS' });
    expect(mockPost.mock.calls[1][1]).toEqual({ productIds: [7, 8], status: 'INACTIVE' });
    expect(mockPost.mock.calls[2][0]).toBe('/admin/coupons/0/grant');
    expect(mockPost.mock.calls[2][1]).toEqual({ userIds: [10, 11] });
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
});
