const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
const mockRequest = jest.fn();
let mockRequestInterceptorFulfilled: ((config: any) => any) | undefined;
let mockResponseInterceptorRejected: ((error: any) => Promise<any>) | undefined;

export {};

const originalApiBaseUrl = process.env.REACT_APP_API_BASE_URL;
const originalSupportWebSocketUrl = process.env.REACT_APP_SUPPORT_WEBSOCKET_URL;
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

const restoreLocalStorage = () => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
  }
};

const clearLocalStorage = () => {
  try {
    window.localStorage.clear();
  } catch {
    // Some tests intentionally replace storage with throwing mocks.
  }
};

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config?: { baseURL?: string }) => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      request: mockRequest,
      defaults: { baseURL: config?.baseURL || 'https://api.example.com' },
      interceptors: {
        request: {
          use: jest.fn((fulfilled: (config: any) => any) => {
            mockRequestInterceptorFulfilled = fulfilled;
          }),
        },
        response: {
          use: jest.fn((_fulfilled: (response: any) => any, rejected: (error: any) => Promise<any>) => {
            mockResponseInterceptorRejected = rejected;
          }),
        },
      },
    })),
  },
}));

describe('api parameter normalization', () => {
  beforeAll(() => {
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com';
    delete process.env.REACT_APP_SUPPORT_WEBSOCKET_URL;
    delete window.__SHOP_RUNTIME_CONFIG__;
    restoreLocalStorage();
    clearLocalStorage();
    mockRequestInterceptorFulfilled = undefined;
    mockResponseInterceptorRejected = undefined;
    mockGet.mockResolvedValue({ data: [] });
    mockPost.mockResolvedValue({ data: {} });
    mockPut.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    mockRequest.mockResolvedValue({ data: {} });
  });

  afterAll(() => {
    if (originalApiBaseUrl === undefined) {
      delete process.env.REACT_APP_API_BASE_URL;
    } else {
      process.env.REACT_APP_API_BASE_URL = originalApiBaseUrl;
    }
    if (originalSupportWebSocketUrl === undefined) {
      delete process.env.REACT_APP_SUPPORT_WEBSOCKET_URL;
    } else {
      process.env.REACT_APP_SUPPORT_WEBSOCKET_URL = originalSupportWebSocketUrl;
    }
    restoreLocalStorage();
  });

  it('trims websocket tokens and rejects empty tokens', () => {
    const { supportWebSocketProtocols, supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl('  token  ')).toBe('wss://api.example.com/ws/support');
    expect(supportWebSocketProtocols('  token  ')).toEqual(['support.v1', 'auth.dG9rZW4']);
    expect(() => supportWebSocketUrl('   ')).toThrow('Support websocket token is required');
    expect(() => supportWebSocketProtocols('   ')).toThrow('Support websocket token is required');
  });

  it('keeps support websocket on the same-origin ws proxy when API uses the /api proxy', () => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = '/api';
    delete window.__SHOP_RUNTIME_CONFIG__;

    const { supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl('token')).toBe('ws://localhost/ws/support');
  });

  it('uses explicit runtime support websocket endpoint when provided', () => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = '/api';
    window.__SHOP_RUNTIME_CONFIG__ = {
      supportWebSocketUrl: 'wss://support.example.com/ws/support/',
    };

    const { supportWebSocketUrl } = require('./index');

    expect(supportWebSocketUrl(' token ')).toBe('wss://support.example.com/ws/support');
  });

  it('normalizes email login payloads before sending', async () => {
    const { userApi } = require('./index');

    await userApi.login('  USER\u0000  Name  ', ' secret ');
    await userApi.sendEmailLoginCode('  USER@Example.COM  ');
    await userApi.emailLogin('  USER@Example.COM  ', ' 12a34 567 ');
    await userApi.logout('  refresh-token\n ');
    await userApi.forgotPassword({
      login: '  USER\u0000  Name  ',
      email: '  USER@Example.COM  ',
      code: ' 12a34 567 ',
      newPassword: ' new password ',
    });

    expect(mockPost.mock.calls[0]).toEqual([
      '/auth/login',
      { username: 'USERNAME', password: ' secret ' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/auth/email-code',
      { email: 'user@example.com' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[2]).toEqual([
      '/auth/email-login',
      { email: 'user@example.com', code: '123456' },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockPost.mock.calls[3]).toEqual([
      '/auth/logout',
      { refreshToken: 'refresh-token' },
    ]);
    expect(mockPost.mock.calls[4]).toEqual([
      '/auth/forgot-password',
      {
        login: 'USERNAME',
        email: 'user@example.com',
        code: '123456',
        newPassword: ' new password ',
      },
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
  });

  it('refreshes the auth session and retries the original request after a 401', async () => {
    jest.resetModules();
    window.localStorage.setItem('refreshToken', 'refresh-old');
    mockPost.mockResolvedValueOnce({
      data: {
        token: 'access-new',
        refreshToken: 'refresh-new',
        id: 7,
        username: 'mia',
        role: 'ADMIN',
        roleCode: 'SUPER_ADMIN',
      },
    });
    mockRequest.mockResolvedValueOnce({ data: { ok: true } });

    require('./index');

    const originalRequest = { url: '/users/profile', headers: { Accept: 'application/json' } };
    const response = await mockResponseInterceptorRejected!({
      response: { status: 401 },
      config: originalRequest,
    });

    expect(response).toEqual({ data: { ok: true } });
    expect(mockPost).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'refresh-old' },
      expect.objectContaining({ skipAuthRefresh: true }),
    );
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: '/users/profile',
      _authRetry: true,
      headers: expect.objectContaining({
        Accept: 'application/json',
        Authorization: 'Bearer access-new',
      }),
    }));
    expect(window.localStorage.getItem('token')).toBe('access-new');
    expect(window.localStorage.getItem('refreshToken')).toBe('refresh-new');
    expect(window.localStorage.getItem('userId')).toBe('7');
    expect(window.localStorage.getItem('username')).toBe('mia');
    expect(window.localStorage.getItem('role')).toBe('SUPER_ADMIN');
  });

  it('clears auth storage when a 401 cannot be refreshed', async () => {
    jest.resetModules();
    window.history.pushState({}, '', '/login');
    window.localStorage.setItem('token', 'access-old');
    window.localStorage.setItem('refreshToken', 'refresh-old');
    window.localStorage.setItem('userId', '7');
    mockPost.mockRejectedValueOnce(new Error('refresh expired'));

    require('./index');

    const error = {
      response: { status: 401 },
      config: { url: '/users/profile', headers: {} },
    };

    await expect(mockResponseInterceptorRejected!(error)).rejects.toBe(error);

    expect(mockPost).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'refresh-old' },
      expect.objectContaining({ skipAuthRefresh: true }),
    );
    expect(mockRequest).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('refreshToken')).toBeNull();
    expect(window.localStorage.getItem('userId')).toBeNull();
  });

  it('sends only normalized contact fields when updating a profile', async () => {
    const { userApi } = require('./index');

    await userApi.updateProfile({
      email: '  USER@Example.COM  ',
      phone: '  555\t0100  ext-too-long  ',
      emailCode: ' 12a34 567 ',
      role: 'ADMIN',
      status: 'BANNED',
    });

    expect(mockPut.mock.calls[0]).toEqual([
      '/users/profile',
      {
        email: 'user@example.com',
        phone: '5550100',
        emailCode: '123456',
      },
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
      expect(mockGet.mock.calls[1][1]).toEqual({ params: { page: 1, size: 50 } });
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
    const params = mockGet.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('keyword')).toBe('leash kit');
    expect(params.get('discount')).toBe('true');
    expect(params.has('categoryId')).toBe(false);
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
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

    await cartApi.addItem(0, 8, Number.NaN, '  Size=S   Color=Blue  ');
    await cartApi.removeItems([1, '2', 2, 3.4, -1] as unknown as number[]);

    expect(mockPost.mock.calls[0][2].params).toEqual({
      productId: 8,
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
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[2][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
  });

  it('normalizes payment payloads and guest emails', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.create(7, ' stripe ', ' USER@Example.COM ', ' so202605260001 ');
    await paymentApi.getByOrder(7, 'bad-email', ' so202605260001 ');
    await paymentApi.getByOrder(7, ' USER@Example.COM ', ' so202605260001 ');

    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 7, channel: 'STRIPE', guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockGet.mock.calls[0][0]).toBe('/payments/order/7');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: undefined });
    expect(mockGet.mock.calls[1][0]).toBe('/payments/guest/order/7');
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({
      params: { guestEmail: 'user@example.com', orderNo: 'SO202605260001' },
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('uses anonymous configs for public storefront bootstrap endpoints', async () => {
    const { appConfigApi, announcementApi } = require('./index');

    await appConfigApi.get();
    await announcementApi.getActive(999);

    expect(mockGet.mock.calls[0]).toEqual([
      '/app/config',
      expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }),
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/announcements/active',
      expect.objectContaining({
        params: { limit: 10 },
        skipAuthHeader: true,
        skipAuthRedirect: true,
      }),
    ]);
  });

  it('caches payment channels for repeated checkout renders', async () => {
    const { paymentApi } = require('./index');

    await paymentApi.getChannels();
    await paymentApi.getChannels();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/payments/channels');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('normalizes support session path params and optional session payloads', async () => {
    const { supportApi, adminSupportApi } = require('./index');

    await supportApi.getMessages('9' as unknown as number);
    await supportApi.markRead('11' as unknown as number);
    await supportApi.sendMessage('hello', -4);
    await adminSupportApi.reopenSession(12);
    await adminSupportApi.sendMessage(8, 'reply');

    expect(mockGet.mock.calls[0][0]).toBe('/support/sessions/9/messages');
    expect(mockPut.mock.calls[0][0]).toBe('/support/sessions/11/read');
    expect(mockPost.mock.calls[0][0]).toBe('/support/messages');
    expect(mockPost.mock.calls[0][1]).toEqual({ content: 'hello', sessionId: undefined });
    expect(mockPut.mock.calls[1][0]).toBe('/admin/support/sessions/12/reopen');
    expect(mockPost.mock.calls[1][0]).toBe('/admin/support/sessions/8/messages');
  });

  it('requests admin support summary for queue health panels', async () => {
    const { adminSupportApi } = require('./index');

    await adminSupportApi.getSummary();

    expect(mockGet.mock.calls[0][0]).toBe('/admin/support/summary');
  });

  it('normalizes product path params and short-circuits invalid recommendation requests', async () => {
    const { productApi } = require('./index');

    await productApi.update(2, { name: 'valid id' });
    await productApi.delete('4' as unknown as number);
    await productApi.getRecommendations(Number.NaN);

    expect(mockPut.mock.calls[0][0]).toBe('/products/2');
    expect(mockDelete.mock.calls[0][0]).toBe('/products/4');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('normalizes order paths, checkout ids, guest email, and return text fields', async () => {
    const { orderApi } = require('./index');

    await orderApi.checkout({
      cartItemIds: [1, 1, 2.8, -2],
      shippingAddress: 'addr',
      paymentMethod: 'card',
      userCouponId: 7.3,
      recipientName: ' Mia\tCat ',
      recipientPhone: ' 555\t0100 ',
      contactEmail: ' USER@Example.COM ',
    });
    await orderApi.cancel('8' as unknown as number, ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.confirm(9, ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.returnOrder(9, '  Too\t small  ', ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.submitReturnShipment(11, '  TRACK   123  ', ' USER@Example.COM ', ' so202605260001 ');
    await orderApi.getItems(10);

    expect(mockPost.mock.calls[0][0]).toBe('/orders/checkout/me');
    expect(mockPost.mock.calls[0][1]).toEqual({
      cartItemIds: [1],
      shippingAddress: 'addr',
      recipientName: 'Mia Cat',
      recipientPhone: '555 0100',
      contactEmail: 'user@example.com',
      paymentMethod: 'card',
      userCouponId: null,
    });
    expect(mockPut.mock.calls[0][0]).toBe('/orders/guest/8/cancel');
    expect(mockPut.mock.calls[0][1]).toEqual({ guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPut.mock.calls[1][0]).toBe('/orders/guest/9/confirm');
    expect(mockPut.mock.calls[1][1]).toEqual({ guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPut.mock.calls[2][0]).toBe('/orders/guest/9/return');
    expect(mockPut.mock.calls[2][1]).toEqual({ reason: 'Too small', guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
    expect(mockPut.mock.calls[3][0]).toBe('/orders/guest/11/return-shipment');
    expect(mockPut.mock.calls[3][1]).toEqual({ returnTrackingNumber: 'TRACK 123', guestEmail: 'user@example.com', orderNo: 'SO202605260001' });
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
    expect(mockPost.mock.calls[1][0]).toBe('/orders/track');
    expect(mockPost.mock.calls[1][1]).toEqual({ orderNo: 'ORD123', email: 'user@example.com' });
    expect(mockPost.mock.calls[1][2]).toEqual(expect.objectContaining({
      skipAuthHeader: true,
      skipAuthRedirect: true,
    }));
  });

  it('normalizes review and question params and text payloads', async () => {
    const { reviewApi, questionApi, adminApi } = require('./index');

    await reviewApi.create(3, '9' as unknown as number, 9, '  Great   bowl  ');
    await questionApi.ask(4, '  Is   it washable?  ');
    await adminApi.answerQuestion('5' as unknown as number, '  Yes   it is  ');

    expect(mockPost.mock.calls[0][0]).toBe('/reviews/product/3');
    expect(mockPost.mock.calls[0][1]).toEqual({ orderId: 9, rating: 5, comment: 'Great bowl' });
    expect(mockPost.mock.calls[1][0]).toBe('/product-questions/product/4');
    expect(mockPost.mock.calls[1][1]).toEqual({ question: 'Is it washable?' });
    expect(mockPut.mock.calls[0][0]).toBe('/admin/questions/5/answer');
    expect(mockPut.mock.calls[0][1]).toEqual({ answer: 'Yes it is' });
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
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[3][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[2][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
  });

  it('normalizes category, brand, address, and wishlist identifiers', async () => {
    const { categoryApi, brandApi, addressApi, wishlistApi } = require('./index');

    await categoryApi.getAll({ parentId: -2, level: 2.2 });
    await categoryApi.getChildren('6' as unknown as number);
    await brandApi.delete(5);
    await addressApi.setDefault(12);
    await wishlistApi.toggle(0, '14' as unknown as number);

    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ params: { parentId: undefined, level: undefined } }));
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({ params: { parentId: 6 } }));
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockGet.mock.calls[1][1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    expect(mockDelete.mock.calls[0][0]).toBe('/brands/5');
    expect(mockPut.mock.calls[0][0]).toBe('/addresses/12/default');
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
    mockGet.mock.calls.forEach((call) => {
      expect(call[1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    });
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
    mockGet.mock.calls.forEach((call) => {
      expect(call[1]).toEqual(expect.objectContaining({ skipAuthHeader: true, skipAuthRedirect: true }));
    });
  });

  it('normalizes admin mutation and batch payload ids', async () => {
    const { adminApi } = require('./index');

    await adminApi.updateOrderStatus(3, ' SHIPPED ', '  TN\u0000   1 ', '  DHL ');
    await adminApi.getOrdersPage({ status: ' PENDING_SHIPMENT ', search: '  TN\u0000   1 ', quick: ' SLA_OVERDUE ', page: 2, size: 200 });
    await adminApi.exportOrders(' REFUNDED ', '  order   9 ', ' REFUNDED ');
    await adminApi.batchShipOrders([1, '2', 2, -4, 5.5] as unknown as number[], '  PKG   ', '  UPS  ');
    await adminApi.batchUpdateProductStatus([7, 7, Infinity, 8] as unknown as number[], ' INACTIVE ');
    await adminApi.grantCoupon(9, [10, 10, '11', -2] as unknown as number[]);
    await adminApi.getCouponSummary();
    await adminApi.grantCoupon(9, [1, 2, 3, 4], 2);

    expect(mockPut.mock.calls[0][0]).toBe('/admin/orders/3/status');
    expect(mockPut.mock.calls[0][1]).toEqual({ status: 'SHIPPED', trackingNumber: 'TN 1', trackingCarrierCode: 'DHL' });
    expect(mockGet.mock.calls[0][0]).toBe('/admin/orders/page');
    expect(mockGet.mock.calls[0][1]).toEqual({ params: { status: 'PENDING_SHIPMENT', search: 'TN 1', quick: 'SLA_OVERDUE', page: 2, size: 100 } });
    expect(mockGet.mock.calls[1][0]).toBe('/admin/orders/export');
    expect(mockGet.mock.calls[1][1]).toEqual({ params: { status: 'REFUNDED', search: 'order 9', quick: 'REFUNDED' }, responseType: 'blob' });
    expect(mockGet.mock.calls[2][0]).toBe('/admin/coupons/summary');
    expect(mockPost.mock.calls[0][1]).toEqual({ orderIds: [1, 2], trackingPrefix: 'PKG', trackingCarrierCode: 'UPS' });
    expect(mockPost.mock.calls[1][1]).toEqual({ productIds: [7, 8], status: 'INACTIVE' });
    expect(mockPost.mock.calls[2][0]).toBe('/admin/coupons/9/grant');
    expect(mockPost.mock.calls[2][1]).toEqual({ userIds: [10, 11] });
    expect(mockPost.mock.calls[3][0]).toBe('/admin/coupons/9/grant');
    expect(mockPost.mock.calls[3][1]).toEqual({ userIds: [1, 2] });
  });

  it('normalizes system alert batch action and purge payloads', async () => {
    const { adminApi } = require('./index');

    await adminApi.acknowledgeAlerts([4, '5', 5, 0, -2, 7.7] as unknown as number[], '  ack\u0000   note  ', 3);
    await adminApi.resolveAlerts([9, 9, Number.NaN, 10] as unknown as number[], '  resolve   note  ');
    await adminApi.purgeResolvedAlerts(99999);

    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/alerts/batch/acknowledge',
      { ids: [4, 5], note: 'ack note' },
    ]);
    expect(mockPost.mock.calls[1]).toEqual([
      '/admin/alerts/batch/resolve',
      { ids: [9, 10], note: 'resolve note' },
    ]);
    expect(mockPost.mock.calls[2]).toEqual([
      '/admin/alerts/purge-resolved',
      null,
      { params: { retentionDays: 3650 } },
    ]);
  });

  it('normalizes IP blacklist filters and batch release payloads', async () => {
    const { adminApi } = require('./index');

    await adminApi.getIpBlacklist({
      status: ' BLOCKED ',
      source: ' LOGIN ',
      ipAddress: ' 203.0.113.10\u0000 ',
      limit: 99999,
    });
    await adminApi.releaseIpBlacklistEntries([8, '9', 9, 0, -3, 10.5] as unknown as number[], '  release\u0000   note  ', 2);

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/ip-blacklist',
      { params: { status: 'BLOCKED', source: 'LOGIN', ipAddress: '203.0.113.10', limit: 1000 } },
    ]);
    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/ip-blacklist/batch/release',
      { ids: [8, 9], note: 'release note' },
    ]);
  });

  it('normalizes audit log filters, summary params, export params, and purge retention', async () => {
    const { adminApi } = require('./index');

    await adminApi.getAuditLogs({
      action: ' ORDER_EXPORT\u0000 ',
      result: ' SUCCESS ',
      actorUsername: ' admin\u0000 user ',
      resourceType: ' ORDER ',
      startAt: ' 2026-05-24T10:00:00 ',
      endAt: ' 2026-05-24T12:00:00 ',
      limit: 99999,
    });
    await adminApi.getAuditLogSummary({ action: ' LOGIN ', topLimit: 999 });
    await adminApi.exportAuditLogs({ result: ' FAILURE ', actorUsername: ' jane   doe ' });
    await adminApi.purgeAuditLogs(99999);

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/audit-logs',
      {
        params: {
          action: 'ORDER_EXPORT',
          result: 'SUCCESS',
          actorUsername: 'admin user',
          resourceType: 'ORDER',
          startAt: '2026-05-24T10:00:00',
          endAt: '2026-05-24T12:00:00',
          limit: 1000,
        },
      },
    ]);
    expect(mockGet.mock.calls[1]).toEqual([
      '/admin/audit-logs/summary',
      {
        params: {
          action: 'LOGIN',
          result: undefined,
          actorUsername: undefined,
          resourceType: undefined,
          startAt: undefined,
          endAt: undefined,
          topLimit: 50,
        },
      },
    ]);
    expect(mockGet.mock.calls[2]).toEqual([
      '/admin/audit-logs/export',
      {
        params: {
          action: undefined,
          result: 'FAILURE',
          actorUsername: 'jane doe',
          resourceType: undefined,
          startAt: undefined,
          endAt: undefined,
        },
        responseType: 'blob',
      },
    ]);
    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/audit-logs/purge',
      null,
      { params: { retentionDays: 3650 } },
    ]);
  });

  it('requests admin announcement summary for CMS health panels', async () => {
    const { adminApi } = require('./index');

    await adminApi.getAnnouncementSummary();
    await adminApi.getAnnouncements();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/announcements/summary',
      '/admin/announcements',
    ]);
  });

  it('caches admin dashboard and keeps operational health endpoints explicit', async () => {
    const { adminApi } = require('./index');

    await adminApi.getDashboard();
    await adminApi.getDashboard();
    await adminApi.getAlertSummary();
    await adminApi.getIpBlacklistStatus();
    await adminApi.updateOrderStatus(10, 'SHIPPED');
    await adminApi.getDashboard();

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/dashboard',
      '/admin/alerts/summary',
      '/admin/ip-blacklist/status',
      '/admin/dashboard',
    ]);
  });

  it('caches bounded admin order pages while normalizing filters until order mutations', async () => {
    const { adminApi } = require('./index');

    await adminApi.getOrders(' PENDING ');
    await adminApi.getOrders('PENDING');
    await adminApi.getOrdersPage({ status: ' PAID ', search: '  order   7 ', quick: ' OVERDUE ', page: 1, size: 500 });
    await adminApi.getOrdersPage({ status: 'PAID', search: 'order 7', quick: 'OVERDUE', page: 1, size: 100 });
    await adminApi.batchShipOrders([1, 2], ' PKG ');
    await adminApi.getOrders('PENDING');

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/orders/page',
      '/admin/orders/page',
      '/admin/orders/page',
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

  it('requests admin question summary and normalizes queue filters', async () => {
    const { adminApi } = require('./index');

    await adminApi.getQuestionSummary();
    await adminApi.getQuestions({ status: ' unanswered ', limit: 99999 });

    expect(mockGet.mock.calls[0][0]).toBe('/admin/questions/summary');
    expect(mockGet.mock.calls[1]).toEqual([
      '/admin/questions',
      { params: { status: 'UNANSWERED', limit: 1000 } },
    ]);
  });

  it('caches admin question queues until an answer invalidates them', async () => {
    const { adminApi } = require('./index');

    await adminApi.getQuestions({ status: 'UNANSWERED', limit: 200 });
    await adminApi.getQuestions({ status: ' unanswered ', limit: 200 });
    await adminApi.answerQuestion(12, '  It   fits small dogs.  ');
    await adminApi.getQuestions({ status: 'UNANSWERED', limit: 200 });

    expect(mockGet.mock.calls.map((call) => call[0])).toEqual([
      '/admin/questions',
      '/admin/questions',
    ]);
    expect(mockPut.mock.calls[0]).toEqual([
      '/admin/questions/12/answer',
      { answer: 'It fits small dogs.' },
    ]);
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
      params: { keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE', page: 1, size: 100 },
    });
  });

  it('normalizes admin user summary filters for account health panels', async () => {
    const { adminApi } = require('./index');

    await adminApi.getUserSummary({ keyword: '  jane\u0000   doe ', role: ' ADMIN ', status: ' ACTIVE ' });

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/users/summary',
      { params: { keyword: 'jane doe', role: 'ADMIN', status: 'ACTIVE' } },
    ]);
  });

  it('lets the browser set multipart upload boundaries', async () => {
    const { adminApi, petGalleryApi } = require('./index');
    const csvFile = new File(['id,name,description,price,stock,categoryId\n'], 'products.csv', { type: 'text/csv' });
    const imageFile = new File(['image'], 'pet.jpg', { type: 'image/jpeg' });

    await adminApi.importProducts(csvFile);
    await adminApi.previewImportProducts(csvFile);
    await petGalleryApi.upload(imageFile);

    expect(mockPost.mock.calls[0][0]).toBe('/admin/products/import');
    expect(mockPost.mock.calls[0][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[0][2]).toBeUndefined();
    expect(mockPost.mock.calls[1][0]).toBe('/admin/products/import/preview');
    expect(mockPost.mock.calls[1][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[1][2]).toBeUndefined();
    expect(mockPost.mock.calls[2][0]).toBe('/pet-gallery');
    expect(mockPost.mock.calls[2][1]).toBeInstanceOf(FormData);
    expect(mockPost.mock.calls[2][2]).toBeUndefined();
  });

  it('requests typed product import history with a bounded limit', async () => {
    const { adminApi } = require('./index');

    await adminApi.getProductImportHistory(999);

    expect(mockGet.mock.calls[0]).toEqual([
      '/admin/products/import/history',
      { params: { limit: 20 } },
    ]);
  });

  it('normalizes product URL imports before requesting a preview', async () => {
    const { adminApi } = require('./index');

    await adminApi.importProductFromUrl('  https://item.taobao.com/item.htm?id=123  ');

    expect(mockPost.mock.calls[0]).toEqual([
      '/admin/products/import-url',
      { url: 'https://item.taobao.com/item.htm?id=123' },
    ]);
  });

  it('normalizes notification, pet profile, pet gallery, and logistics params', async () => {
    const { notificationApi, petProfileApi, petGalleryApi, logisticsApi } = require('./index');

    await notificationApi.markAsRead(4);
    await petProfileApi.update('6' as unknown as number, { name: 'Milo' });
    await petGalleryApi.like(7);
    await logisticsApi.track('  1Z   999  ', '  UPS  ', 20);

    expect(mockPut.mock.calls[0][0]).toBe('/notifications/4/read');
    expect(mockPut.mock.calls[1][0]).toBe('/pet-profiles/6');
    expect(mockPost.mock.calls[0][0]).toBe('/pet-gallery/7/like');
    expect(mockGet.mock.calls[0][0]).toBe('/logistics/track');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ params: { trackingNumber: '1Z 999', carrier: 'UPS', orderId: 20 }, allowAnonymousRetry: false }));
  });

  it('caches logistics tracking and rejects empty tracking requests', async () => {
    const { logisticsApi } = require('./index');

    await expect(logisticsApi.track('   ')).rejects.toThrow('Tracking number or order id is required');
    await logisticsApi.track('  2Z   999  ', '  UPS  ');
    await logisticsApi.track('  2Z   999  ', '  UPS  ');

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/logistics/track');
    expect(mockGet.mock.calls[0][1]).toEqual(expect.objectContaining({ allowAnonymousRetry: false }));
    expect(mockGet.mock.calls[0][1]).not.toEqual(expect.objectContaining({ skipAuthHeader: true }));
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
