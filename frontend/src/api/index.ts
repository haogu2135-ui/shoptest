import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { User, Product, Category, Brand, CartItem, Order, OrderItem, Review, DashboardStats, UserAddress, WishlistItem, AppNotification, Payment, PaymentChannel, ProductImportResult, ProductQuestion, SupportSession, SupportMessage, Coupon, UserCoupon, CouponQuote, LogisticsTrackResponse, PetProfile, LogisticsCarrier, PetGalleryPhoto, PetGalleryQuota, AppConfig, SecurityAuditLog } from '../types';

const resolveApiBaseUrl = () => {
    const configured = process.env.REACT_APP_API_BASE_URL;
    if (configured) {
        return configured.replace(/\/$/, '');
    }

    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8081`;
};

const api = axios.create({
    baseURL: resolveApiBaseUrl()
});

export const apiBaseUrl = String(api.defaults.baseURL || window.location.origin).replace(/\/$/, '');

export const supportWebSocketUrl = (token: string) => {
    const base = new URL(apiBaseUrl, window.location.origin);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = '/ws/support';
    base.search = `token=${encodeURIComponent(token)}`;
    return base.toString();
};

export const appConfigApi = {
    get: () => api.get<AppConfig>('/app/config'),
};

const PRODUCT_LIST_CACHE_MS = 30_000;
const PRODUCT_DETAIL_CACHE_MS = 30_000;
const ORDER_TRACK_CACHE_MS = 15_000;
const PET_GALLERY_CACHE_MS = 20_000;
const NOTIFICATION_CACHE_MS = 15_000;
const productListCache = new Map<string, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const productListRequests = new Map<string, Promise<AxiosResponse<Product[]>>>();
const productDetailCache = new Map<number, { expiresAt: number; response: AxiosResponse<Product> }>();
const productDetailRequests = new Map<number, Promise<AxiosResponse<Product>>>();
const orderTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<{ order: Order; items: OrderItem[] }> }>();
const orderTrackRequests = new Map<string, Promise<AxiosResponse<{ order: Order; items: OrderItem[] }>>>();
const petGalleryCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetGalleryPhoto[]> | AxiosResponse<PetGalleryQuota> }>();
const petGalleryRequests = new Map<string, Promise<AxiosResponse<PetGalleryPhoto[]> | AxiosResponse<PetGalleryQuota>>>();
const notificationCache = new Map<string, { expiresAt: number; response: AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }> }>();
const notificationRequests = new Map<string, Promise<AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }>>>();

const clearProductListCache = () => {
    productListCache.clear();
    productListRequests.clear();
};

const clearProductCache = (id?: number) => {
    clearProductListCache();
    if (id === undefined) {
        productDetailCache.clear();
        productDetailRequests.clear();
        return;
    }
    productDetailCache.delete(id);
    productDetailRequests.delete(id);
};

const clearPetGalleryCache = () => {
    petGalleryCache.clear();
    petGalleryRequests.clear();
};

const clearNotificationCache = (userId?: number) => {
    if (userId === undefined) {
        notificationCache.clear();
        notificationRequests.clear();
        return;
    }
    [`list:${userId}`, `unread:${userId}`].forEach((key) => {
        notificationCache.delete(key);
        notificationRequests.delete(key);
    });
};

// 请求拦截器
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('role');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// 用户相关 API
export const userApi = {
    register: (user: Partial<User>) => api.post('/auth/register', user),
    login: (username: string, password: string) =>
        api.post('/auth/login', { username, password }),
    logout: () => api.post('/auth/logout'),
    forgotPassword: (payload: { login: string; email: string; newPassword: string }) =>
        api.post('/auth/forgot-password', payload),
    getProfile: () => api.get<User>('/users/profile'),
    updateProfile: (user: Partial<User>) => api.put('/users/profile', user),
    updatePassword: (userId: number, oldPassword: string, newPassword: string) =>
        api.put('/users/password', null, { params: { userId, oldPassword, newPassword } })
};

// 商品相关 API
export const productApi = {
    getAll: (keyword?: string, categoryId?: number) => {
        const params = new URLSearchParams();
        if (keyword) params.append('keyword', keyword);
        if (categoryId) params.append('categoryId', categoryId.toString());
        const query = params.toString();
        const cacheKey = query || '__all__';
        const cached = productListCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productListRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<Product[]>('/products', {
            params: {
                ...(keyword ? { keyword } : {}),
                ...(categoryId ? { categoryId } : {}),
            },
        })
            .then((response) => {
                productListCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + PRODUCT_LIST_CACHE_MS,
                });
                return response;
            })
            .finally(() => productListRequests.delete(cacheKey));
        productListRequests.set(cacheKey, request);
        return request;
    },
    getById: (id: number) => {
        const cached = productDetailCache.get(id);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productDetailRequests.get(id);
        if (pending) return pending;
        const request = api.get<Product>(`/products/${id}`)
            .then((response) => {
                productDetailCache.set(id, {
                    response,
                    expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                });
                return response;
            })
            .finally(() => productDetailRequests.delete(id));
        productDetailRequests.set(id, request);
        return request;
    },
    getFeatured: () => api.get<Product[]>('/products/featured'),
    getPersonalizedRecommendations: () => api.get<Product[]>('/products/personalized-recommendations'),
    create: (product: Partial<Product>) => api.post<Product>('/products', product).finally(() => clearProductCache()),
    update: (id: number, product: Partial<Product>) => api.put<Product>(`/products/${id}`, product).finally(() => clearProductCache(id)),
    delete: (id: number) => api.delete(`/products/${id}`).finally(() => clearProductCache(id)),
    getRecommendations: (id: number) => api.get<Product[]>(`/products/${id}/recommendations`)
};

// 购物车相关 API
export const cartApi = {
    getItems: (userId: number) => api.get<CartItem[]>('/cart', { params: { userId } }),
    addItem: (userId: number, productId: number, quantity: number, selectedSpecs?: string) =>
        api.post('/cart/add', null, { params: { userId, productId, quantity, selectedSpecs } }),
    updateQuantity: (cartItemId: number, quantity: number) =>
        api.put('/cart/update', null, { params: { cartItemId, quantity } }),
    removeItem: (cartItemId: number) => api.delete(`/cart/remove/${cartItemId}`),
    clear: (userId: number) => api.delete('/cart/clear', { params: { userId } })
};

// 订单相关 API
export const orderApi = {
    getAll: () => api.get<Order[]>('/orders'),
    getById: (id: number) => api.get<Order>(`/orders/${id}`),
    getByUser: (userId: number) => api.get<Order[]>(`/orders/user/${userId}`),
    getMine: () => api.get<Order[]>('/orders/me'),
    track: (orderNo: string, email: string) => {
        const normalizedOrderNo = orderNo.trim();
        const normalizedEmail = email.trim().toLowerCase();
        const cacheKey = `${normalizedOrderNo}:${normalizedEmail}`;
        const cached = orderTrackCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = orderTrackRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<{ order: Order; items: OrderItem[] }>('/orders/track', {
            params: { orderNo: normalizedOrderNo, email: normalizedEmail },
        })
            .then((response) => {
                orderTrackCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + ORDER_TRACK_CACHE_MS,
                });
                return response;
            })
            .finally(() => orderTrackRequests.delete(cacheKey));
        orderTrackRequests.set(cacheKey, request);
        return request;
    },
    create: (order: Partial<Order>) => api.post<Order>('/orders', order),
    checkout: (payload: { userId: number; cartItemIds: number[]; shippingAddress: string; paymentMethod: string; userCouponId?: number | null }) =>
        api.post<Order>('/orders/checkout', payload),
    guestCheckout: (payload: {
        guestEmail: string;
        guestName: string;
        guestPhone: string;
        shippingAddress: string;
        paymentMethod: string;
        items: Array<{ productId: number; quantity: number; selectedSpecs?: string }>;
    }) => api.post<Order>('/orders/checkout/guest', payload),
    update: (id: number, order: Partial<Order>) => api.put<Order>(`/orders/${id}`, order),
    delete: (id: number) => api.delete(`/orders/${id}`),
    cancel: (id: number) => api.put(`/orders/${id}/cancel`),
    confirm: (id: number) => api.put(`/orders/${id}/confirm`),
    returnOrder: (id: number, reason?: string) => api.put(`/orders/${id}/return`, { reason }),
    submitReturnShipment: (id: number, returnTrackingNumber: string) =>
        api.put(`/orders/${id}/return-shipment`, { returnTrackingNumber }),
    pay: (id: number) => api.put(`/orders/${id}/pay`),
    ship: (id: number) => api.put(`/orders/${id}/ship`),
    getItems: (orderId: number) => api.get<OrderItem[]>(`/orders/${orderId}/items`),
    addItem: (orderId: number, item: Partial<OrderItem>) => api.post(`/orders/${orderId}/items`, item),
};

export const couponApi = {
    getPublic: () => api.get<Coupon[]>('/coupons/public'),
    claim: (couponId: number, userId: number) => api.post<UserCoupon>(`/coupons/${couponId}/claim`, null, { params: { userId } }),
    getByUser: (userId: number) => api.get<UserCoupon[]>(`/coupons/user/${userId}`),
    getAvailableByUser: (userId: number) => api.get<UserCoupon[]>(`/coupons/user/${userId}/available`),
    quote: (payload: { userId: number; cartItemIds: number[]; userCouponId?: number | null }) =>
        api.post<CouponQuote>('/coupons/quote', payload),
};

export const paymentApi = {
    getChannels: () => api.get<PaymentChannel[]>('/payments/channels'),
    create: (orderId: number, channel: string, guestEmail?: string) => api.post<Payment>('/payments', { orderId, channel, guestEmail }),
    simulatePaid: (paymentId: number, guestEmail?: string) => api.post<Payment>(`/payments/${paymentId}/simulate-paid`, guestEmail ? { guestEmail } : undefined),
    simulateCallback: (paymentId: number, guestEmail?: string) => api.post<Payment>(`/payments/${paymentId}/simulate-callback`, guestEmail ? { guestEmail } : undefined),
    callback: (payload: {
        orderNo: string;
        channel: string;
        transactionId: string;
        status: string;
        amount: number;
        signature: string;
    }) => api.post<Payment>('/payments/callback', payload),
    getByOrder: (orderId: number) => api.get<Payment[]>(`/payments/order/${orderId}`),
    getLatestByOrder: (orderId: number) => api.get<Payment>(`/payments/order/${orderId}/latest`),
};

// 评价相关 API
export const reviewApi = {
    getAll: (productId: number) => api.get(`/reviews/product/${productId}`),
    getReviewableOrders: (productId: number) => api.get<Order[]>(`/reviews/product/${productId}/reviewable-orders`),
    create: (productId: number, orderId: number, rating: number, comment: string) =>
        api.post(`/reviews/product/${productId}`, { orderId, rating, comment }),
};

export const questionApi = {
    getByProduct: (productId: number) => api.get<ProductQuestion[]>(`/product-questions/product/${productId}`),
    ask: (productId: number, question: string) => api.post<ProductQuestion>(`/product-questions/product/${productId}`, { question }),
    answer: (questionId: number, answer: string) => api.post<ProductQuestion>(`/product-questions/${questionId}/answer`, { answer }),
};

export const categoryApi = {
    getAll: (params?: { parentId?: number; level?: number }) => api.get<Category[]>('/categories', { params }),
    getTopLevel: () => api.get<Category[]>('/categories', { params: { level: 1 } }),
    getChildren: (parentId: number) => api.get<Category[]>('/categories', { params: { parentId } }),
    getById: (id: number) => api.get<Category>(`/categories/${id}`),
    create: (category: Partial<Category>) => api.post<Category>('/categories', category),
    update: (id: number, category: Partial<Category>) => api.put<Category>(`/categories/${id}`, category),
    delete: (id: number) => api.delete(`/categories/${id}`)
};

export const brandApi = {
    getAll: (params?: { activeOnly?: boolean }) => api.get<Brand[]>('/brands', { params }),
    create: (brand: Partial<Brand>) => api.post<Brand>('/brands', brand),
    update: (id: number, brand: Partial<Brand>) => api.put<Brand>(`/brands/${id}`, brand),
    delete: (id: number) => api.delete(`/brands/${id}`),
};

export const adminApi = {
    getDashboard: () => api.get<DashboardStats>('/admin/dashboard'),
    getUsers: () => api.get<User[]>('/admin/users'),
    updateUser: (id: number, user: Partial<User>) => api.put(`/admin/users/${id}`, user),
    deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
    getOrders: (status?: string) => api.get<Order[]>('/admin/orders', {
        params: status ? { status } : undefined,
    }),
    exportOrders: (status?: string) => api.get('/admin/orders/export', {
        params: status ? { status } : undefined,
        responseType: 'blob',
    }),
    getAuditLogs: (params?: Record<string, unknown>) => api.get<SecurityAuditLog[]>('/admin/audit-logs', { params }),
    exportAuditLogs: (params?: Record<string, unknown>) => api.get('/admin/audit-logs/export', {
        params,
        responseType: 'blob',
    }),
    updateOrderStatus: (id: number, status: string, trackingNumber?: string, trackingCarrierCode?: string) =>
        api.put(`/admin/orders/${id}/status`, { status, trackingNumber, trackingCarrierCode }),
    batchShipOrders: (orderIds: number[], trackingPrefix: string, trackingCarrierCode?: string) =>
        api.post('/admin/orders/batch-ship', { orderIds, trackingPrefix, trackingCarrierCode }),
    updateProductStatus: (id: number, status: string) =>
        api.put(`/admin/products/${id}/status`, { status }),
    batchUpdateProductStatus: (productIds: number[], status: string) =>
        api.post('/admin/products/batch-status', { productIds, status }),
    importProducts: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<ProductImportResult>('/admin/products/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    getReviews: () => api.get<Review[]>('/admin/reviews'),
    deleteReview: (id: number) => api.delete(`/admin/reviews/${id}`),
    replyReview: (id: number, reply: string) => api.put<Review>(`/admin/reviews/${id}/reply`, { reply }),
    updateReviewStatus: (id: number, status: string) => api.put<Review>(`/admin/reviews/${id}/status`, { status }),
    getCoupons: () => api.get<Coupon[]>('/admin/coupons'),
    createCoupon: (coupon: Partial<Coupon>) => api.post<Coupon>('/admin/coupons', coupon),
    updateCoupon: (id: number, coupon: Partial<Coupon>) => api.put<Coupon>(`/admin/coupons/${id}`, coupon),
    deleteCoupon: (id: number) => api.delete(`/admin/coupons/${id}`),
    grantCoupon: (id: number, userIds: number[]) => api.post<{ granted: number }>(`/admin/coupons/${id}/grant`, { userIds }),
    runPetBirthdayCoupons: () => api.post<{ granted: number }>('/admin/pet-birthday-coupons/run'),
    broadcastNotification: (payload: { type: string; title: string; message: string; contentFormat: 'TEXT' | 'HTML' }) =>
        api.post<{ sent: number }>('/admin/notifications/broadcast', payload),
};

export const logisticsCarrierApi = {
    getAll: (activeOnly?: boolean) => api.get<LogisticsCarrier[]>('/admin/logistics-carriers', { params: activeOnly ? { activeOnly } : undefined }),
    create: (carrier: Partial<LogisticsCarrier>) => api.post<LogisticsCarrier>('/admin/logistics-carriers', carrier),
    update: (id: number, carrier: Partial<LogisticsCarrier>) => api.put<LogisticsCarrier>(`/admin/logistics-carriers/${id}`, carrier),
    delete: (id: number) => api.delete(`/admin/logistics-carriers/${id}`),
};

export const addressApi = {
    getByUser: (userId: number) => api.get<UserAddress[]>('/addresses', { params: { userId } }),
    getById: (id: number) => api.get<UserAddress>(`/addresses/${id}`),
    getDefault: (userId: number) => api.get<UserAddress>('/addresses/default', { params: { userId } }),
    create: (address: Partial<UserAddress>) => api.post<UserAddress>('/addresses', address),
    update: (id: number, address: Partial<UserAddress>) => api.put<UserAddress>(`/addresses/${id}`, address),
    delete: (id: number) => api.delete(`/addresses/${id}`),
    setDefault: (id: number, userId: number) => api.put(`/addresses/${id}/default`, null, { params: { userId } }),
};

export const wishlistApi = {
    getByUser: (userId: number) => api.get<WishlistItem[]>('/wishlist', { params: { userId } }),
    check: (userId: number, productId: number) =>
        api.get<{ wishlisted: boolean }>('/wishlist/check', { params: { userId, productId } }),
    getCount: (userId: number) => api.get<{ count: number }>('/wishlist/count', { params: { userId } }),
    toggle: (userId: number, productId: number) =>
        api.post<{ wishlisted: boolean }>('/wishlist/toggle', null, { params: { userId, productId } }),
    remove: (userId: number, productId: number) => api.delete('/wishlist', { params: { userId, productId } }),
};

export const notificationApi = {
    getByUser: (userId: number, force = false) => {
        const cacheKey = `list:${userId}`;
        if (!force) {
            const cached = notificationCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<AppNotification[]> } | undefined;
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
            const pending = notificationRequests.get(cacheKey) as Promise<AxiosResponse<AppNotification[]>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<AppNotification[]>('/notifications', { params: { userId } })
            .then((response) => {
                notificationCache.set(cacheKey, { response, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return response;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        notificationRequests.set(cacheKey, request);
        return request;
    },
    getUnreadCount: (userId: number, force = false) => {
        const cacheKey = `unread:${userId}`;
        if (!force) {
            const cached = notificationCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<{ count: number }> } | undefined;
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
            const pending = notificationRequests.get(cacheKey) as Promise<AxiosResponse<{ count: number }>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<{ count: number }>('/notifications/unread-count', { params: { userId } })
            .then((response) => {
                notificationCache.set(cacheKey, { response, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return response;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        notificationRequests.set(cacheKey, request);
        return request;
    },
    markAsRead: (id: number, userId?: number) => api.put(`/notifications/${id}/read`).finally(() => clearNotificationCache(userId)),
    markAllAsRead: (userId: number) => api.put('/notifications/read-all', null, { params: { userId } }).finally(() => clearNotificationCache(userId)),
    delete: (id: number, userId?: number) => api.delete(`/notifications/${id}`).finally(() => clearNotificationCache(userId)),
};

export const petProfileApi = {
    getMine: () => api.get<PetProfile[]>('/pet-profiles'),
    create: (payload: Partial<PetProfile>) => api.post<PetProfile>('/pet-profiles', payload),
    update: (id: number, payload: Partial<PetProfile>) => api.put<PetProfile>(`/pet-profiles/${id}`, payload),
    delete: (id: number) => api.delete(`/pet-profiles/${id}`),
};

export const petGalleryApi = {
    getAll: (force = false) => {
        const cacheKey = 'photos';
        if (!force) {
            const cached = petGalleryCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<PetGalleryPhoto[]> } | undefined;
            if (cached && cached.expiresAt > Date.now()) {
                return Promise.resolve(cached.response);
            }
            const pending = petGalleryRequests.get(cacheKey) as Promise<AxiosResponse<PetGalleryPhoto[]>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<PetGalleryPhoto[]>('/pet-gallery')
            .then((response) => {
                petGalleryCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + PET_GALLERY_CACHE_MS,
                });
                return response;
            })
            .finally(() => petGalleryRequests.delete(cacheKey));
        petGalleryRequests.set(cacheKey, request);
        return request;
    },
    getQuota: (force = false) => {
        const cacheKey = 'quota';
        if (!force) {
            const cached = petGalleryCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<PetGalleryQuota> } | undefined;
            if (cached && cached.expiresAt > Date.now()) {
                return Promise.resolve(cached.response);
            }
            const pending = petGalleryRequests.get(cacheKey) as Promise<AxiosResponse<PetGalleryQuota>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<PetGalleryQuota>('/pet-gallery/quota')
            .then((response) => {
                petGalleryCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + PET_GALLERY_CACHE_MS,
                });
                return response;
            })
            .finally(() => petGalleryRequests.delete(cacheKey));
        petGalleryRequests.set(cacheKey, request);
        return request;
    },
    like: (id: number) => api.post<PetGalleryPhoto>(`/pet-gallery/${id}/like`).finally(clearPetGalleryCache),
    delete: (id: number) => api.delete(`/pet-gallery/${id}`).finally(clearPetGalleryCache),
    upload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<PetGalleryPhoto>('/pet-gallery', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).finally(clearPetGalleryCache);
    },
};

export const logisticsApi = {
    track: (trackingNumber: string, carrier?: string, orderId?: number) =>
        api.get<LogisticsTrackResponse>('/logistics/track', { params: { trackingNumber, carrier, orderId } }),
};

export const supportApi = {
    getSession: () => api.get<SupportSession>('/support/session'),
    getSessions: () => api.get<SupportSession[]>('/support/sessions'),
    getMessages: (sessionId: number) => api.get<SupportMessage[]>(`/support/sessions/${sessionId}/messages`),
    sendMessage: (content: string, sessionId?: number) =>
        api.post<{ message: SupportMessage; session: SupportSession }>('/support/messages', { content, sessionId }),
    markRead: (sessionId: number) => api.put(`/support/sessions/${sessionId}/read`),
    closeSession: (sessionId: number) => api.put<SupportSession>(`/support/sessions/${sessionId}/close`),
    getUnreadCount: () => api.get<{ count: number }>('/support/unread-count'),
};

export const adminSupportApi = {
    getSessions: (status?: string) => api.get<SupportSession[]>('/admin/support/sessions', { params: status ? { status } : undefined }),
    getMessages: (sessionId: number) => api.get<SupportMessage[]>(`/admin/support/sessions/${sessionId}/messages`),
    sendMessage: (sessionId: number, content: string) =>
        api.post<{ message: SupportMessage; session: SupportSession }>(`/admin/support/sessions/${sessionId}/messages`, { content }),
    markRead: (sessionId: number) => api.put(`/admin/support/sessions/${sessionId}/read`),
    closeSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${sessionId}/close`),
    getUnreadCount: () => api.get<{ count: number }>('/admin/support/unread-count'),
};
