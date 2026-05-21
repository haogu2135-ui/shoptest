import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { User, Product, Category, Brand, CartItem, Order, OrderItem, Review, DashboardStats, UserAddress, WishlistItem, AppNotification, Payment, PaymentChannel, ProductImportResult, ProductQuestion, SupportSession, SupportMessage, Coupon, UserCoupon, CouponQuote, LogisticsTrackResponse, PetProfile, LogisticsCarrier, PetGalleryPhoto, PetGalleryQuota, AppConfig, SecurityAuditLog, AdminRole, PetBirthdayCouponConfig, AdminOrderPage } from '../types';
import { dispatchDomEvent } from '../utils/domEvents';

const resolveApiBaseUrl = () => {
    const configured = process.env.REACT_APP_API_BASE_URL;
    if (configured) {
        return configured.replace(/\/$/, '');
    }

    if (process.env.NODE_ENV === 'production') {
        return '/api';
    }

    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8081`;
};

const api = axios.create({
    baseURL: resolveApiBaseUrl()
});

export const apiBaseUrl = String(api.defaults.baseURL || window.location.origin).replace(/\/$/, '');

const normalizePositiveInt = (value: unknown) => {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const toPathId = (value: unknown) => normalizePositiveInt(value) || 0;

const normalizePositiveIntList = (values: unknown[], limit = 40) =>
    Array.from(new Set(values.map(normalizePositiveInt).filter((id): id is number => id !== null))).slice(0, limit);

const normalizeQuantityParam = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : 1;
};

const normalizeBoundedPositiveInt = (value: unknown, fallback: number, max: number) => {
    const normalized = normalizePositiveInt(value);
    return normalized ? Math.min(normalized, max) : fallback;
};

const stripControlChars = (value: string) =>
    Array.from(value, (char) => {
        const code = char.charCodeAt(0);
        return code <= 31 || code === 127 ? ' ' : char;
    }).join('');

const normalizeTextParam = (value: unknown, maxLength = 120) =>
    stripControlChars(String(value || '')).trim().replace(/\s+/g, ' ').slice(0, maxLength);

const normalizeEmailParam = (value: unknown) => {
    const email = normalizeTextParam(value, 180).toLowerCase();
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
};

const getStoredItem = (key: string) => {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

const removeStoredItems = (keys: string[]) => {
    keys.forEach((key) => {
        try {
            window.localStorage.removeItem(key);
        } catch {
            // Auth cleanup should not mask the original API error.
        }
    });
};

export const supportWebSocketUrl = (token: string) => {
    const normalizedToken = normalizeTextParam(token, 2048);
    if (!normalizedToken) {
        throw new Error('Support websocket token is required');
    }
    const base = new URL(apiBaseUrl, window.location.origin);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = '/ws/support';
    base.searchParams.set('token', normalizedToken);
    return base.toString();
};

const PRODUCT_LIST_CACHE_MS = 30_000;
const PRODUCT_DETAIL_CACHE_MS = 30_000;
const ORDER_TRACK_CACHE_MS = 15_000;
const PET_GALLERY_CACHE_MS = 20_000;
const PET_PROFILE_CACHE_MS = 45_000;
const NOTIFICATION_CACHE_MS = 15_000;
const PERSONALIZED_RECOMMENDATION_CACHE_MS = 45_000;
const PRODUCT_ADD_ON_CACHE_MS = 30_000;
const APP_CONFIG_CACHE_MS = 60_000;
const productListCache = new Map<string, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const productListRequests = new Map<string, Promise<AxiosResponse<Product[]>>>();
const productDetailCache = new Map<number, { expiresAt: number; response: AxiosResponse<Product> }>();
const productDetailRequests = new Map<number, Promise<AxiosResponse<Product>>>();
const orderTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<{ order: Order; items: OrderItem[] }> }>();
const orderTrackRequests = new Map<string, Promise<AxiosResponse<{ order: Order; items: OrderItem[] }>>>();
const petGalleryCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetGalleryPhoto[]> | AxiosResponse<PetGalleryQuota> }>();
const petGalleryRequests = new Map<string, Promise<AxiosResponse<PetGalleryPhoto[]> | AxiosResponse<PetGalleryQuota>>>();
const petProfileCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetProfile[]> }>();
const petProfileRequests = new Map<string, Promise<AxiosResponse<PetProfile[]>>>();
const notificationCache = new Map<string, { expiresAt: number; response: AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }> }>();
const notificationRequests = new Map<string, Promise<AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }>>>();
const personalizedRecommendationCache = new Map<string, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const personalizedRecommendationRequests = new Map<string, Promise<AxiosResponse<Product[]>>>();
const productAddOnCache = new Map<string, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const productAddOnRequests = new Map<string, Promise<AxiosResponse<Product[]>>>();
const productRecommendationsCache = new Map<number, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const productRecommendationsRequests = new Map<number, Promise<AxiosResponse<Product[]>>>();
let appConfigCache: { expiresAt: number; response: AxiosResponse<AppConfig> } | null = null;
let appConfigRequest: Promise<AxiosResponse<AppConfig>> | null = null;
let adminPermissionsCache: { expiresAt: number; response: AxiosResponse<{ role: string; roleCode?: string; permissions: string[] }> } | null = null;
let adminPermissionsRequest: Promise<AxiosResponse<{ role: string; roleCode?: string; permissions: string[] }>> | null = null;

export const appConfigApi = {
    get: () => {
        if (appConfigCache && appConfigCache.expiresAt > Date.now()) {
            return Promise.resolve(appConfigCache.response);
        }
        if (appConfigRequest) return appConfigRequest;
        appConfigRequest = api.get<AppConfig>('/app/config')
            .then((response) => {
                appConfigCache = { response, expiresAt: Date.now() + APP_CONFIG_CACHE_MS };
                return response;
            })
            .finally(() => {
                appConfigRequest = null;
            });
        return appConfigRequest;
    },
};

const clearProductListCache = () => {
    productListCache.clear();
    productListRequests.clear();
};

const clearProductCache = (id?: number) => {
    clearProductListCache();
    personalizedRecommendationCache.clear();
    personalizedRecommendationRequests.clear();
    productAddOnCache.clear();
    productAddOnRequests.clear();
    productRecommendationsCache.clear();
    productRecommendationsRequests.clear();
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

const clearPetProfileCache = () => {
    petProfileCache.clear();
    petProfileRequests.clear();
};

const clearPersonalizedRecommendationCache = () => {
    personalizedRecommendationCache.clear();
    personalizedRecommendationRequests.clear();
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

export const clearAdminPermissionsCache = () => {
    adminPermissionsCache = null;
    adminPermissionsRequest = null;
};

// 请求拦截器
api.interceptors.request.use(
    (config) => {
        const token = getStoredItem('token');
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
            removeStoredItems(['token', 'userId', 'username', 'role', 'adminDefaultPath']);
            clearAdminPermissionsCache();
            clearPetProfileCache();
            clearPersonalizedRecommendationCache();
            clearNotificationCache();
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
    updatePassword: (oldPassword: string, newPassword: string) =>
        api.put('/users/password', { oldPassword, newPassword })
};

// 商品相关 API
export const productApi = {
    getAll: (keyword?: string, categoryId?: number, discount?: boolean) => {
        const params = new URLSearchParams();
        if (keyword) params.append('keyword', keyword);
        if (categoryId) params.append('categoryId', categoryId.toString());
        if (discount) params.append('discount', 'true');
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
                ...(discount ? { discount: true } : {}),
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
        const productId = normalizePositiveInt(id);
        if (!productId) return Promise.reject(new Error('Invalid product id'));
        const cached = productDetailCache.get(productId);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productDetailRequests.get(productId);
        if (pending) return pending;
        const request = api.get<Product>(`/products/${productId}`)
            .then((response) => {
                productDetailCache.set(productId, {
                    response,
                    expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                });
                return response;
            })
            .finally(() => productDetailRequests.delete(productId));
        productDetailRequests.set(productId, request);
        return request;
    },
    getByIds: (ids: number[]) => {
        const uniqueIds = normalizePositiveIntList(ids, 40);
        if (uniqueIds.length === 0) {
            return Promise.resolve({ data: [] } as unknown as AxiosResponse<Product[]>);
        }
        const params = new URLSearchParams();
        uniqueIds.forEach((id) => params.append('ids', String(id)));
        return api.get<Product[]>('/products/by-ids', { params })
            .then((response) => {
                response.data.forEach((product) => {
                    if (product.id) {
                        productDetailCache.set(product.id, {
                            response: { ...response, data: product },
                            expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                        });
                    }
                });
                return response;
            });
    },
    getFeatured: () => {
        const cacheKey = '__featured__';
        const cached = productListCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productListRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<Product[]>('/products/featured')
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
    getPersonalizedRecommendations: () => {
        const token = getStoredItem('token') || '';
        const cacheKey = `personalized:${token.slice(-16) || 'guest'}`;
        const cached = personalizedRecommendationCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = personalizedRecommendationRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<Product[]>('/products/personalized-recommendations')
            .then((response) => {
                personalizedRecommendationCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + PERSONALIZED_RECOMMENDATION_CACHE_MS,
                });
                return response;
            })
            .finally(() => personalizedRecommendationRequests.delete(cacheKey));
        personalizedRecommendationRequests.set(cacheKey, request);
        return request;
    },
    getAddOnCandidates: (targetAmount: number, excludedIds: number[] = [], limit = 3) => {
        const params = new URLSearchParams();
        const normalizedTargetAmount = Number(targetAmount);
        const normalizedLimit = Number(limit);
        params.append('targetAmount', String(Number.isFinite(normalizedTargetAmount) ? Math.max(0, normalizedTargetAmount) : 0));
        params.append('limit', String(Number.isFinite(normalizedLimit) ? Math.max(1, Math.min(Math.floor(normalizedLimit), 8)) : 3));
        normalizePositiveIntList(excludedIds, 40).forEach((id) => {
            params.append('excludedIds', String(id));
        });
        const cacheKey = params.toString();
        const cached = productAddOnCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productAddOnRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<Product[]>('/products/add-on-candidates', { params })
            .then((response) => {
                productAddOnCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + PRODUCT_ADD_ON_CACHE_MS,
                });
                return response;
            })
            .finally(() => productAddOnRequests.delete(cacheKey));
        productAddOnRequests.set(cacheKey, request);
        return request;
    },
    create: (product: Partial<Product>) => api.post<Product>('/products', product).finally(() => clearProductCache()),
    update: (id: number, product: Partial<Product>) => api.put<Product>(`/products/${toPathId(id)}`, product).finally(() => clearProductCache(toPathId(id))),
    delete: (id: number) => api.delete(`/products/${toPathId(id)}`).finally(() => clearProductCache(toPathId(id))),
    getRecommendations: (id: number) => {
        const productId = normalizePositiveInt(id);
        if (!productId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<Product[]>);
        const cached = productRecommendationsCache.get(productId);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productRecommendationsRequests.get(productId);
        if (pending) return pending;
        const request = api.get<Product[]>(`/products/${productId}/recommendations`)
            .then((response) => {
                productRecommendationsCache.set(productId, {
                    response,
                    expiresAt: Date.now() + PRODUCT_LIST_CACHE_MS,
                });
                return response;
            })
            .finally(() => productRecommendationsRequests.delete(productId));
        productRecommendationsRequests.set(productId, request);
        return request;
    }
};

// 购物车相关 API
export const cartApi = {
    getItems: (_userId: number) => api.get<CartItem[]>('/cart/me'),
    addItem: (_userId: number, productId: number, quantity: number, selectedSpecs?: string) =>
        api.post('/cart/me/add', null, {
            params: {
                productId: normalizePositiveInt(productId) || 0,
                quantity: normalizeQuantityParam(quantity),
                selectedSpecs: selectedSpecs ? normalizeTextParam(selectedSpecs, 600) : undefined,
            },
        }),
    updateQuantity: (cartItemId: number, quantity: number) =>
        api.put('/cart/update', null, { params: { cartItemId: normalizePositiveInt(cartItemId) || 0, quantity: normalizeQuantityParam(quantity) } }),
    removeItem: (cartItemId: number) => api.delete(`/cart/remove/${toPathId(cartItemId)}`),
    removeItems: (cartItemIds: number[]) => {
        const params = new URLSearchParams();
        normalizePositiveIntList(cartItemIds, 100).forEach((id) => params.append('cartItemIds', String(id)));
        return api.delete('/cart/remove', { params });
    },
    clear: (_userId: number) => api.delete('/cart/me/clear')
};

// 订单相关 API
export const orderApi = {
    getAll: () => api.get<Order[]>('/orders'),
    getById: (id: number) => api.get<Order>(`/orders/${toPathId(id)}`),
    getByUser: (_userId: number) => api.get<Order[]>('/orders/me'),
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
    checkout: (payload: { cartItemIds: number[]; shippingAddress: string; paymentMethod: string; userCouponId?: number | null }) =>
        api.post<Order>('/orders/checkout/me', {
            ...payload,
            cartItemIds: normalizePositiveIntList(payload.cartItemIds, 100),
            userCouponId: normalizePositiveInt(payload.userCouponId) || null,
        }),
    guestCheckout: (payload: {
        guestEmail: string;
        guestName: string;
        guestPhone: string;
        shippingAddress: string;
        paymentMethod: string;
        items: Array<{ productId: number; quantity: number; selectedSpecs?: string }>;
    }) => api.post<Order>('/orders/checkout/guest', payload),
    update: (id: number, order: Partial<Order>) => api.put<Order>(`/orders/${toPathId(id)}`, order),
    delete: (id: number) => api.delete(`/orders/${toPathId(id)}`),
    cancel: (id: number, guestEmail?: string) => api.put(`/orders/${toPathId(id)}/cancel`, normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined),
    confirm: (id: number) => api.put(`/orders/${toPathId(id)}/confirm`),
    returnOrder: (id: number, reason?: string) => api.put(`/orders/${toPathId(id)}/return`, { reason: normalizeTextParam(reason, 1000) }),
    submitReturnShipment: (id: number, returnTrackingNumber: string) =>
        api.put(`/orders/${toPathId(id)}/return-shipment`, { returnTrackingNumber: normalizeTextParam(returnTrackingNumber, 120) }),
    pay: (id: number) => api.put(`/orders/${toPathId(id)}/pay`),
    ship: (id: number) => api.put(`/orders/${toPathId(id)}/ship`),
    getItems: (orderId: number) => api.get<OrderItem[]>(`/orders/${toPathId(orderId)}/items`),
    addItem: (orderId: number, item: Partial<OrderItem>) => api.post(`/orders/${toPathId(orderId)}/items`, item),
};

export const couponApi = {
    getPublic: () => api.get<Coupon[]>('/coupons/public'),
    claim: (couponId: number, _userId: number) => api.post<UserCoupon>(`/coupons/me/${normalizePositiveInt(couponId) || 0}/claim`),
    getByUser: (_userId: number) => api.get<UserCoupon[]>('/coupons/me'),
    getAvailableByUser: (_userId: number) => api.get<UserCoupon[]>('/coupons/me/available'),
    quote: (payload: { cartItemIds: number[]; userCouponId?: number | null }) =>
        api.post<CouponQuote>('/coupons/me/quote', {
            cartItemIds: normalizePositiveIntList(payload.cartItemIds, 100),
            userCouponId: normalizePositiveInt(payload.userCouponId) || null,
        }),
};

export const paymentApi = {
    getChannels: () => api.get<PaymentChannel[]>('/payments/channels'),
    create: (orderId: number, channel: string, guestEmail?: string) => api.post<Payment>('/payments', {
        orderId: normalizePositiveInt(orderId) || 0,
        channel: normalizeTextParam(channel, 40).toUpperCase(),
        guestEmail: normalizeEmailParam(guestEmail),
    }),
    simulatePaid: (paymentId: number, guestEmail?: string) => api.post<Payment>(`/payments/${normalizePositiveInt(paymentId) || 0}/simulate-paid`, normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined),
    simulateCallback: (paymentId: number, guestEmail?: string) => api.post<Payment>(`/payments/${normalizePositiveInt(paymentId) || 0}/simulate-callback`, normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined),
    sync: (paymentId: number, guestEmail?: string) => api.post<Payment>(`/payments/${normalizePositiveInt(paymentId) || 0}/sync`, normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined),
    callback: (payload: {
        orderNo: string;
        channel: string;
        transactionId: string;
        status: string;
        amount: number;
        callbackTimestamp: number;
        signature: string;
    }) => api.post<Payment>('/payments/callback', payload),
    getByOrder: (orderId: number, guestEmail?: string) =>
        api.get<Payment[]>(`/payments/order/${normalizePositiveInt(orderId) || 0}`, { params: normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined }),
    getLatestByOrder: (orderId: number, guestEmail?: string) =>
        api.get<Payment>(`/payments/order/${normalizePositiveInt(orderId) || 0}/latest`, { params: normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined }),
};

// 评价相关 API
export const reviewApi = {
    getAll: (productId: number) => api.get(`/reviews/product/${toPathId(productId)}`),
    getReviewableOrders: (productId: number) => api.get<Order[]>(`/reviews/product/${toPathId(productId)}/reviewable-orders`),
    create: (productId: number, orderId: number, rating: number, comment: string) =>
        api.post(`/reviews/product/${toPathId(productId)}`, {
            orderId: toPathId(orderId),
            rating: Math.max(1, Math.min(5, Math.floor(Number(rating) || 0))),
            comment: normalizeTextParam(comment, 2000),
        }),
};

export const questionApi = {
    getByProduct: (productId: number) => api.get<ProductQuestion[]>(`/product-questions/product/${toPathId(productId)}`),
    ask: (productId: number, question: string) => api.post<ProductQuestion>(`/product-questions/product/${toPathId(productId)}`, { question: normalizeTextParam(question, 1000) }),
    answer: (questionId: number, answer: string) => api.post<ProductQuestion>(`/product-questions/${toPathId(questionId)}/answer`, { answer: normalizeTextParam(answer, 2000) }),
};

export const categoryApi = {
    getAll: (params?: { parentId?: number; level?: number }) => api.get<Category[]>('/categories', {
        params: params ? {
            parentId: normalizePositiveInt(params.parentId) || undefined,
            level: normalizePositiveInt(params.level) || undefined,
        } : undefined,
    }),
    getTopLevel: () => api.get<Category[]>('/categories', { params: { level: 1 } }),
    getChildren: (parentId: number) => api.get<Category[]>('/categories', { params: { parentId: toPathId(parentId) } }),
    getById: (id: number) => api.get<Category>(`/categories/${toPathId(id)}`),
    create: (category: Partial<Category>) => api.post<Category>('/categories', category),
    update: (id: number, category: Partial<Category>) => api.put<Category>(`/categories/${toPathId(id)}`, category),
    delete: (id: number) => api.delete(`/categories/${toPathId(id)}`)
};

export const brandApi = {
    getAll: (params?: { activeOnly?: boolean }) => api.get<Brand[]>('/brands', { params }),
    create: (brand: Partial<Brand>) => api.post<Brand>('/brands', brand),
    update: (id: number, brand: Partial<Brand>) => api.put<Brand>(`/brands/${toPathId(id)}`, brand),
    delete: (id: number) => api.delete(`/brands/${toPathId(id)}`),
};

export const adminApi = {
    getDashboard: () => api.get<DashboardStats>('/admin/dashboard'),
    getUsers: (params?: { keyword?: string; role?: string; status?: string }) => api.get<User[]>('/admin/users', { params }),
    exportUsers: (params?: { keyword?: string; role?: string; status?: string }) => api.get('/admin/users/export', { params, responseType: 'blob' }),
    updateUser: (id: number, user: Partial<User>) => api.put(`/admin/users/${toPathId(id)}`, user)
        .then((response) => {
            if (user.role || user.roleCode || user.status) {
                clearAdminPermissionsCache();
                dispatchDomEvent('shop:admin-permissions-updated');
            }
            return response;
        }),
    assignUserRole: (id: number, roleCode: string) => api.put<User>(`/admin/users/${toPathId(id)}/role-code`, { roleCode: normalizeTextParam(roleCode, 80) })
        .then((response) => {
            clearAdminPermissionsCache();
            dispatchDomEvent('shop:admin-permissions-updated');
            return response;
        }),
    deleteUser: (id: number) => api.delete(`/admin/users/${toPathId(id)}`),
    getRoles: () => api.get<AdminRole[]>('/admin/roles'),
    saveRole: (role: Partial<AdminRole>) => api.post<AdminRole>('/admin/roles', role)
        .then((response) => {
            clearAdminPermissionsCache();
            dispatchDomEvent('shop:admin-permissions-updated');
            return response;
        }),
    getMyPermissions: () => {
        if (adminPermissionsCache && adminPermissionsCache.expiresAt > Date.now()) {
            return Promise.resolve(adminPermissionsCache.response);
        }
        if (adminPermissionsRequest) return adminPermissionsRequest;
        adminPermissionsRequest = api.get<{ role: string; roleCode?: string; permissions: string[] }>('/admin/me/permissions')
            .then((response) => {
                adminPermissionsCache = { response, expiresAt: Date.now() + 30_000 };
                return response;
            })
            .finally(() => {
                adminPermissionsRequest = null;
            });
        return adminPermissionsRequest;
    },
    getOrders: (status?: string) => api.get<Order[]>('/admin/orders', {
        params: status ? { status } : undefined,
    }),
    getOrdersPage: (params?: { status?: string; search?: string; quick?: string; page?: number; size?: number }) =>
        api.get<AdminOrderPage>('/admin/orders/page', {
            params: {
                status: normalizeTextParam(params?.status, 40) || undefined,
                search: normalizeTextParam(params?.search, 120) || undefined,
                quick: normalizeTextParam(params?.quick, 40) || undefined,
                page: normalizeBoundedPositiveInt(params?.page, 1, 100000),
                size: normalizeBoundedPositiveInt(params?.size, 20, 100),
            },
        }),
    exportOrders: (status?: string, search?: string, quick?: string) => api.get('/admin/orders/export', {
        params: {
            status: normalizeTextParam(status, 40) || undefined,
            search: normalizeTextParam(search, 120) || undefined,
            quick: normalizeTextParam(quick, 40) || undefined,
        },
        responseType: 'blob',
    }),
    getAuditLogs: (params?: Record<string, unknown>) => api.get<SecurityAuditLog[]>('/admin/audit-logs', { params }),
    exportAuditLogs: (params?: Record<string, unknown>) => api.get('/admin/audit-logs/export', {
        params,
        responseType: 'blob',
    }),
    updateOrderStatus: (id: number, status: string, trackingNumber?: string, trackingCarrierCode?: string) =>
        api.put(`/admin/orders/${toPathId(id)}/status`, {
            status: normalizeTextParam(status, 40),
            trackingNumber: normalizeTextParam(trackingNumber, 120) || undefined,
            trackingCarrierCode: normalizeTextParam(trackingCarrierCode, 40) || undefined,
        }),
    getProducts: () => api.get<Product[]>('/admin/products'),
    refundOrder: (id: number, payload: { reason?: string; restock?: boolean; manualRefundReference?: string }) =>
        api.post<{ message: string; payment: Payment }>(`/admin/orders/${toPathId(id)}/refund`, {
            reason: normalizeTextParam(payload.reason, 1000) || undefined,
            restock: Boolean(payload.restock),
            manualRefundReference: normalizeTextParam(payload.manualRefundReference, 128) || undefined,
        }),
    batchShipOrders: (orderIds: number[], trackingPrefix: string, trackingCarrierCode?: string) =>
        api.post('/admin/orders/batch-ship', {
            orderIds: normalizePositiveIntList(orderIds, 100),
            trackingPrefix: normalizeTextParam(trackingPrefix, 80),
            trackingCarrierCode: normalizeTextParam(trackingCarrierCode, 40) || undefined,
        }),
    updateProductStatus: (id: number, status: string) =>
        api.put(`/admin/products/${toPathId(id)}/status`, { status: normalizeTextParam(status, 40) }).finally(() => clearProductCache(toPathId(id))),
    batchUpdateProductStatus: (productIds: number[], status: string) =>
        api.post('/admin/products/batch-status', { productIds: normalizePositiveIntList(productIds, 100), status: normalizeTextParam(status, 40) }).finally(() => clearProductCache()),
    importProducts: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<ProductImportResult>('/admin/products/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).finally(() => clearProductCache());
    },
    getReviews: () => api.get<Review[]>('/admin/reviews'),
    deleteReview: (id: number) => api.delete(`/admin/reviews/${toPathId(id)}`),
    replyReview: (id: number, reply: string) => api.put<Review>(`/admin/reviews/${toPathId(id)}/reply`, { reply: normalizeTextParam(reply, 2000) }),
    updateReviewStatus: (id: number, status: string) => api.put<Review>(`/admin/reviews/${toPathId(id)}/status`, { status: normalizeTextParam(status, 40) }),
    getCoupons: () => api.get<Coupon[]>('/admin/coupons'),
    createCoupon: (coupon: Partial<Coupon>) => api.post<Coupon>('/admin/coupons', coupon),
    updateCoupon: (id: number, coupon: Partial<Coupon>) => api.put<Coupon>(`/admin/coupons/${toPathId(id)}`, coupon),
    deleteCoupon: (id: number) => api.delete(`/admin/coupons/${toPathId(id)}`),
    grantCoupon: (id: number, userIds: number[]) => api.post<{ granted: number }>(`/admin/coupons/${toPathId(id)}/grant`, { userIds: normalizePositiveIntList(userIds, 100) }),
    runPetBirthdayCoupons: () => api.post<{ granted: number }>('/admin/pet-birthday-coupons/run'),
    getPetBirthdayCouponConfig: () => api.get<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config'),
    updatePetBirthdayCouponConfig: (config: Partial<PetBirthdayCouponConfig>) =>
        api.put<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config', config),
    broadcastNotification: (payload: { type: string; title: string; message: string; contentFormat: 'TEXT' | 'HTML' }) =>
        api.post<{ sent: number }>('/admin/notifications/broadcast', payload),
};

export const logisticsCarrierApi = {
    getAll: (activeOnly?: boolean) => api.get<LogisticsCarrier[]>('/admin/logistics-carriers', { params: activeOnly ? { activeOnly } : undefined }),
    create: (carrier: Partial<LogisticsCarrier>) => api.post<LogisticsCarrier>('/admin/logistics-carriers', carrier),
    update: (id: number, carrier: Partial<LogisticsCarrier>) => api.put<LogisticsCarrier>(`/admin/logistics-carriers/${toPathId(id)}`, carrier),
    delete: (id: number) => api.delete(`/admin/logistics-carriers/${toPathId(id)}`),
};

export const addressApi = {
    getByUser: (_userId: number) => api.get<UserAddress[]>('/addresses/me'),
    getById: (id: number) => api.get<UserAddress>(`/addresses/${toPathId(id)}`),
    getDefault: (_userId: number) => api.get<UserAddress>('/addresses/me/default'),
    create: (address: Partial<UserAddress>) => api.post<UserAddress>('/addresses', address),
    update: (id: number, address: Partial<UserAddress>) => api.put<UserAddress>(`/addresses/${toPathId(id)}`, address),
    delete: (id: number) => api.delete(`/addresses/${toPathId(id)}`),
    setDefault: (id: number) => api.put(`/addresses/${toPathId(id)}/default`),
};

export const wishlistApi = {
    getByUser: (_userId: number) => api.get<WishlistItem[]>('/wishlist/me'),
    check: (_userId: number, productId: number) =>
        api.get<{ wishlisted: boolean }>('/wishlist/me/check', { params: { productId: toPathId(productId) } }),
    getCount: (_userId: number) => api.get<{ count: number }>('/wishlist/me/count'),
    toggle: (_userId: number, productId: number) =>
        api.post<{ wishlisted: boolean }>('/wishlist/me/toggle', null, { params: { productId: toPathId(productId) } }),
    remove: (_userId: number, productId: number) => api.delete('/wishlist/me', { params: { productId: toPathId(productId) } }),
};

export const notificationApi = {
    getByUser: (_userId = 0, force = false) => {
        const token = getStoredItem('token') || '';
        const cacheKey = `list:${token.slice(-16) || 'guest'}`;
        if (!force) {
            const cached = notificationCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<AppNotification[]> } | undefined;
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
            const pending = notificationRequests.get(cacheKey) as Promise<AxiosResponse<AppNotification[]>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<AppNotification[]>('/notifications/me')
            .then((response) => {
                notificationCache.set(cacheKey, { response, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return response;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        notificationRequests.set(cacheKey, request);
        return request;
    },
    getUnreadCount: (_userId = 0, force = false) => {
        const token = getStoredItem('token') || '';
        const cacheKey = `unread:${token.slice(-16) || 'guest'}`;
        if (!force) {
            const cached = notificationCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<{ count: number }> } | undefined;
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
            const pending = notificationRequests.get(cacheKey) as Promise<AxiosResponse<{ count: number }>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<{ count: number }>('/notifications/me/unread-count')
            .then((response) => {
                notificationCache.set(cacheKey, { response, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return response;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        notificationRequests.set(cacheKey, request);
        return request;
    },
    markAsRead: (id: number, userId?: number) => api.put(`/notifications/${toPathId(id)}/read`).finally(() => clearNotificationCache(userId)),
    markAllAsRead: () => api.put('/notifications/me/read-all').finally(() => clearNotificationCache()),
    delete: (id: number, userId?: number) => api.delete(`/notifications/${toPathId(id)}`).finally(() => clearNotificationCache(userId)),
};

export const petProfileApi = {
    getMine: () => {
        const token = getStoredItem('token') || '';
        const cacheKey = token.slice(-16) || 'guest';
        const cached = petProfileCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = petProfileRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<PetProfile[]>('/pet-profiles')
            .then((response) => {
                petProfileCache.set(cacheKey, {
                    response,
                    expiresAt: Date.now() + PET_PROFILE_CACHE_MS,
                });
                return response;
            })
            .finally(() => {
                petProfileRequests.delete(cacheKey);
            });
        petProfileRequests.set(cacheKey, request);
        return request;
    },
    create: (payload: Partial<PetProfile>) => api.post<PetProfile>('/pet-profiles', payload).finally(() => {
        clearPetProfileCache();
        clearPersonalizedRecommendationCache();
    }),
    update: (id: number, payload: Partial<PetProfile>) => api.put<PetProfile>(`/pet-profiles/${toPathId(id)}`, payload).finally(() => {
        clearPetProfileCache();
        clearPersonalizedRecommendationCache();
    }),
    delete: (id: number) => api.delete(`/pet-profiles/${toPathId(id)}`).finally(() => {
        clearPetProfileCache();
        clearPersonalizedRecommendationCache();
    }),
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
    like: (id: number) => api.post<PetGalleryPhoto>(`/pet-gallery/${toPathId(id)}/like`).finally(clearPetGalleryCache),
    delete: (id: number) => api.delete(`/pet-gallery/${toPathId(id)}`).finally(clearPetGalleryCache),
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
        api.get<LogisticsTrackResponse>('/logistics/track', {
            params: {
                trackingNumber: normalizeTextParam(trackingNumber, 120),
                carrier: normalizeTextParam(carrier, 40) || undefined,
                orderId: normalizePositiveInt(orderId) || undefined,
            },
        }),
};

export const supportApi = {
    getSession: () => api.get<SupportSession>('/support/session'),
    getSessions: () => api.get<SupportSession[]>('/support/sessions'),
    getMessages: (sessionId: number) => api.get<SupportMessage[]>(`/support/sessions/${toPathId(sessionId)}/messages`),
    sendMessage: (content: string, sessionId?: number) =>
        api.post<{ message: SupportMessage; session: SupportSession }>('/support/messages', { content, sessionId: normalizePositiveInt(sessionId) || undefined }),
    markRead: (sessionId: number) => api.put(`/support/sessions/${toPathId(sessionId)}/read`),
    closeSession: (sessionId: number) => api.put<SupportSession>(`/support/sessions/${toPathId(sessionId)}/close`),
    getUnreadCount: () => api.get<{ count: number }>('/support/unread-count'),
};

export const adminSupportApi = {
    getSessions: (status?: string) => api.get<SupportSession[]>('/admin/support/sessions', { params: status ? { status } : undefined }),
    getMessages: (sessionId: number) => api.get<SupportMessage[]>(`/admin/support/sessions/${toPathId(sessionId)}/messages`),
    sendMessage: (sessionId: number, content: string) =>
        api.post<{ message: SupportMessage; session: SupportSession }>(`/admin/support/sessions/${toPathId(sessionId)}/messages`, { content }),
    markRead: (sessionId: number) => api.put(`/admin/support/sessions/${toPathId(sessionId)}/read`),
    closeSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/close`),
    assignSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/assign`),
    reopenSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/reopen`),
    reissueBirthdayCoupons: (sessionId: number) =>
        api.post<{ granted: number }>(`/admin/support/sessions/${toPathId(sessionId)}/birthday-coupons/reissue`),
    getUnreadCount: () => api.get<{ count: number }>('/admin/support/unread-count'),
};
