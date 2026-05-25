import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { User, UserAdminSummary, Product, Category, Brand, CartItem, Order, OrderItem, Review, DashboardStats, UserAddress, WishlistItem, AppNotification, Payment, PaymentChannel, ProductImportResult, ProductQuestion, ProductQuestionAdminSummary, SupportSession, SupportAdminSummary, SupportMessage, Coupon, CouponAdminSummary, UserCoupon, CouponQuote, LogisticsTrackResponse, PetProfile, LogisticsCarrier, PetGalleryPhoto, PetGalleryQuota, AppConfig, SecurityAuditLog, SecurityAuditPurgeResponse, SecurityAuditSummary, AdminRole, PetBirthdayCouponConfig, AdminOrderPage, AdminRegistryStatus, AdminSystemStatus, AdminConfigCenterPublishRequest, AdminConfigCenterSnapshot, AdminLogDebugRequest, AdminLogManagementStatus, AdminTrafficControlStatus, SystemAlert, SystemAlertBatchActionResponse, SystemAlertPurgeResponse, SystemAlertSummary, IpBlacklistEntry, IpBlacklistBatchReleaseResponse, IpBlacklistStatus, SiteAnnouncement, SiteAnnouncementAdminSummary } from '../types';
import { buildLoginUrl, getCurrentRelativeUrl } from '../utils/authRedirect';
import { resolveApiDispatcherUrl } from '../utils/apiDispatcher';
import { dispatchDomEvent } from '../utils/domEvents';
import { resolveApiBaseUrl, resolveSupportWebSocketUrl } from '../utils/runtimeConfig';
import { getLocalStorageItem, removeLocalStorageItem } from '../utils/safeStorage';

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

const normalizeAuditLogParams = (params?: Record<string, unknown>, options?: { includeLimit?: boolean; includeTopLimit?: boolean }) => ({
    action: normalizeTextParam(params?.action, 50) || undefined,
    result: normalizeTextParam(params?.result, 20) || undefined,
    actorUsername: normalizeTextParam(params?.actorUsername, 100) || undefined,
    resourceType: normalizeTextParam(params?.resourceType, 50) || undefined,
    startAt: normalizeTextParam(params?.startAt, 32) || undefined,
    endAt: normalizeTextParam(params?.endAt, 32) || undefined,
    ...(options?.includeLimit ? { limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000) } : {}),
    ...(options?.includeTopLimit ? { topLimit: normalizeBoundedPositiveInt(params?.topLimit, 10, 50) } : {}),
});

const normalizeEmailParam = (value: unknown) => {
    const email = normalizeTextParam(value, 180).toLowerCase();
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
};

const normalizeEmailCodeParam = (value: unknown) =>
    normalizeTextParam(value, 16).replace(/\D+/g, '').slice(0, 6);

const normalizeOrderTrackingNumber = (value: unknown) =>
    normalizeTextParam(value, 80).replace(/[^a-z0-9_-]/gi, '');

const normalizeGuestCheckoutItems = (items: Array<{ productId: number; quantity: number; selectedSpecs?: string }> = []) =>
    items
        .map((item) => ({
            productId: normalizePositiveInt(item?.productId) || 0,
            quantity: normalizeQuantityParam(item?.quantity),
            selectedSpecs: item?.selectedSpecs ? normalizeTextParam(item.selectedSpecs, 600) : undefined,
        }))
        .filter((item) => item.productId > 0)
        .slice(0, 100);

type ProductReviewSummary = {
    reviews: Review[];
    averageRating: number;
};

const getStoredItem = (key: string) => {
    return getLocalStorageItem(key);
};

const removeStoredItems = (keys: string[]) => {
    keys.forEach(removeLocalStorageItem);
};

export const supportWebSocketUrl = (token: string) => {
    const normalizedToken = normalizeTextParam(token, 2048);
    if (!normalizedToken) {
        throw new Error('Support websocket token is required');
    }
    const base = new URL(resolveSupportWebSocketUrl(), window.location.origin);
    if (base.protocol === 'https:') base.protocol = 'wss:';
    if (base.protocol === 'http:') base.protocol = 'ws:';
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
const APP_CONFIG_CACHE_MS = 5_000;
const COUPON_CACHE_MS = 20_000;
const PAYMENT_CHANNEL_CACHE_MS = 60_000;
const ADDRESS_CACHE_MS = 20_000;
const ORDER_ITEMS_CACHE_MS = 20_000;
const LOGISTICS_TRACK_CACHE_MS = 30_000;
const REVIEW_CACHE_MS = 20_000;
const QUESTION_CACHE_MS = 20_000;
const LOGISTICS_CARRIER_CACHE_MS = 60_000;
const CATEGORY_CACHE_MS = 60_000;
const BRAND_CACHE_MS = 60_000;
const ADMIN_ROLE_CACHE_MS = 60_000;
const ADMIN_USER_CACHE_MS = 15_000;
const ADMIN_DASHBOARD_CACHE_MS = 20_000;
const ADMIN_ORDER_CACHE_MS = 15_000;
const ADMIN_REVIEW_CACHE_MS = 20_000;
const productListCache = new Map<string, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const productListRequests = new Map<string, Promise<AxiosResponse<Product[]>>>();
const productDetailCache = new Map<number, { expiresAt: number; response: AxiosResponse<Product> }>();
const productDetailRequests = new Map<number, Promise<AxiosResponse<Product>>>();
const productByIdsCache = new Map<string, { expiresAt: number; response: AxiosResponse<Product[]> }>();
const productByIdsRequests = new Map<string, Promise<AxiosResponse<Product[]>>>();
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
const publicCouponCache = new Map<string, { expiresAt: number; response: AxiosResponse<Coupon[]> }>();
const publicCouponRequests = new Map<string, Promise<AxiosResponse<Coupon[]>>>();
const userCouponCache = new Map<string, { expiresAt: number; response: AxiosResponse<UserCoupon[]> }>();
const userCouponRequests = new Map<string, Promise<AxiosResponse<UserCoupon[]>>>();
const addressCache = new Map<string, { expiresAt: number; response: AxiosResponse<UserAddress> | AxiosResponse<UserAddress[]> }>();
const addressRequests = new Map<string, Promise<AxiosResponse<UserAddress> | AxiosResponse<UserAddress[]>>>();
const orderItemsCache = new Map<number, { expiresAt: number; response: AxiosResponse<OrderItem[]> }>();
const orderItemsRequests = new Map<number, Promise<AxiosResponse<OrderItem[]>>>();
const logisticsTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<LogisticsTrackResponse> }>();
const logisticsTrackRequests = new Map<string, Promise<AxiosResponse<LogisticsTrackResponse>>>();
const reviewCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductReviewSummary> }>();
const reviewRequests = new Map<number, Promise<AxiosResponse<ProductReviewSummary>>>();
const questionCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductQuestion[]> }>();
const questionRequests = new Map<number, Promise<AxiosResponse<ProductQuestion[]>>>();
const logisticsCarrierCache = new Map<string, { expiresAt: number; response: AxiosResponse<LogisticsCarrier[]> }>();
const logisticsCarrierRequests = new Map<string, Promise<AxiosResponse<LogisticsCarrier[]>>>();
const categoryCache = new Map<string, { expiresAt: number; response: AxiosResponse<Category[]> }>();
const categoryRequests = new Map<string, Promise<AxiosResponse<Category[]>>>();
const brandCache = new Map<string, { expiresAt: number; response: AxiosResponse<Brand[]> }>();
const brandRequests = new Map<string, Promise<AxiosResponse<Brand[]>>>();
const adminRoleCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminRole[]> }>();
const adminRoleRequests = new Map<string, Promise<AxiosResponse<AdminRole[]>>>();
const adminUserCache = new Map<string, { expiresAt: number; response: AxiosResponse<User[]> }>();
const adminUserRequests = new Map<string, Promise<AxiosResponse<User[]>>>();
const adminOrderCache = new Map<string, { expiresAt: number; response: AxiosResponse<Order[]> | AxiosResponse<AdminOrderPage> }>();
const adminOrderRequests = new Map<string, Promise<AxiosResponse<Order[]> | AxiosResponse<AdminOrderPage>>>();
const adminReviewCache = new Map<string, { expiresAt: number; response: AxiosResponse<Review[]> }>();
const adminReviewRequests = new Map<string, Promise<AxiosResponse<Review[]>>>();
const adminQuestionCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductQuestion[]> }>();
const adminQuestionRequests = new Map<string, Promise<AxiosResponse<ProductQuestion[]>>>();
let paymentChannelCache: { expiresAt: number; response: AxiosResponse<PaymentChannel[]> } | null = null;
let paymentChannelRequest: Promise<AxiosResponse<PaymentChannel[]>> | null = null;
let appConfigCache: { expiresAt: number; response: AxiosResponse<AppConfig> } | null = null;
let appConfigRequest: Promise<AxiosResponse<AppConfig>> | null = null;
let adminPermissionsCache: { expiresAt: number; response: AxiosResponse<{ role: string; roleCode?: string; permissions: string[] }> } | null = null;
let adminPermissionsRequest: Promise<AxiosResponse<{ role: string; roleCode?: string; permissions: string[] }>> | null = null;
let adminDashboardCache: { expiresAt: number; response: AxiosResponse<DashboardStats> } | null = null;
let adminDashboardRequest: Promise<AxiosResponse<DashboardStats>> | null = null;

const cachedGet = <T,>(
    cache: Map<string, { expiresAt: number; response: AxiosResponse<T> }>,
    requests: Map<string, Promise<AxiosResponse<T>>>,
    cacheKey: string,
    ttlMs: number,
    loader: () => Promise<AxiosResponse<T>>,
) => {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
    const pending = requests.get(cacheKey);
    if (pending) return pending;
    const request = loader()
        .then((response) => {
            cache.set(cacheKey, { response, expiresAt: Date.now() + ttlMs });
            return response;
        })
        .finally(() => requests.delete(cacheKey));
    requests.set(cacheKey, request);
    return request;
};

const withArrayData = <T,>(response: AxiosResponse<T[]>): AxiosResponse<T[]> => ({
    ...response,
    data: Array.isArray(response.data) ? response.data : [],
});

const cacheProductDetailFromList = (response: AxiosResponse<Product[]>) => {
    const expiresAt = Date.now() + PRODUCT_DETAIL_CACHE_MS;
    response.data.forEach((product) => {
        if (!product.id) return;
        productDetailCache.set(product.id, {
            response: { ...response, data: product } as unknown as AxiosResponse<Product>,
            expiresAt,
        });
    });
};

const cacheProductListResponse = (cacheKey: string, response: AxiosResponse<Product[]>, ttlMs = PRODUCT_LIST_CACHE_MS) => {
    productListCache.set(cacheKey, {
        response,
        expiresAt: Date.now() + ttlMs,
    });
    cacheProductDetailFromList(response);
};

const getFreshProductListCache = (cacheKey: string) => {
    const cached = productListCache.get(cacheKey);
    return cached && cached.expiresAt > Date.now() ? cached : null;
};

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

export const announcementApi = {
    getActive: (limit = 5) => api.get<SiteAnnouncement[]>('/announcements/active', { params: { limit: normalizeBoundedPositiveInt(limit, 5, 10) } }).then(withArrayData),
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
        productByIdsCache.clear();
        productByIdsRequests.clear();
        return;
    }
    productDetailCache.delete(id);
    productDetailRequests.delete(id);
    productByIdsCache.forEach((cached, cacheKey) => {
        if (cacheKey.split(',').includes(String(id))) productByIdsCache.delete(cacheKey);
    });
    productByIdsRequests.forEach((_request, cacheKey) => {
        if (cacheKey.split(',').includes(String(id))) productByIdsRequests.delete(cacheKey);
    });
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

const clearCouponCache = () => {
    publicCouponCache.clear();
    publicCouponRequests.clear();
    userCouponCache.clear();
    userCouponRequests.clear();
};

const clearAddressCache = () => {
    addressCache.clear();
    addressRequests.clear();
};

const clearOrderItemsCache = (orderId?: number) => {
    if (orderId === undefined) {
        orderItemsCache.clear();
        orderItemsRequests.clear();
        return;
    }
    orderItemsCache.delete(orderId);
    orderItemsRequests.delete(orderId);
};

const clearReviewCache = (productId?: number) => {
    if (productId === undefined) {
        reviewCache.clear();
        reviewRequests.clear();
        return;
    }
    reviewCache.delete(productId);
    reviewRequests.delete(productId);
};

const clearQuestionCache = (productId?: number) => {
    if (productId === undefined) {
        questionCache.clear();
        questionRequests.clear();
        return;
    }
    questionCache.delete(productId);
    questionRequests.delete(productId);
};

const clearLogisticsCarrierCache = () => {
    logisticsCarrierCache.clear();
    logisticsCarrierRequests.clear();
};

const clearCategoryCache = () => {
    categoryCache.clear();
    categoryRequests.clear();
};

const clearBrandCache = () => {
    brandCache.clear();
    brandRequests.clear();
};

const clearAdminRoleCache = () => {
    adminRoleCache.clear();
    adminRoleRequests.clear();
};

const clearAdminUserCache = () => {
    adminUserCache.clear();
    adminUserRequests.clear();
};

const clearAdminDashboardCache = () => {
    adminDashboardCache = null;
    adminDashboardRequest = null;
};

const clearAdminOrderCache = () => {
    adminOrderCache.clear();
    adminOrderRequests.clear();
    clearAdminDashboardCache();
};

const clearAdminReviewCache = () => {
    adminReviewCache.clear();
    adminReviewRequests.clear();
    clearAdminDashboardCache();
};

const clearAdminQuestionCache = () => {
    adminQuestionCache.clear();
    adminQuestionRequests.clear();
    clearAdminDashboardCache();
};

export const clearAdminPermissionsCache = () => {
    adminPermissionsCache = null;
    adminPermissionsRequest = null;
};

// 请求拦截器
api.interceptors.request.use(
    (config) => {
        config.url = resolveApiDispatcherUrl(config.url);
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
                window.location.href = buildLoginUrl(getCurrentRelativeUrl(window.location));
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
    sendEmailLoginCode: (email: string) => api.post('/auth/email-code', { email: normalizeEmailParam(email) || '' }),
    emailLogin: (email: string, code: string) =>
        api.post('/auth/email-login', { email: normalizeEmailParam(email) || '', code: normalizeEmailCodeParam(code) }),
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
        const normalizedKeyword = normalizeTextParam(keyword, 120);
        const normalizedCategoryId = normalizePositiveInt(categoryId);
        const params = new URLSearchParams();
        if (normalizedKeyword) params.append('keyword', normalizedKeyword);
        if (normalizedCategoryId) params.append('categoryId', normalizedCategoryId.toString());
        if (discount) params.append('discount', 'true');
        const query = params.toString();
        const cacheKey = query || '__all__';
        const cached = getFreshProductListCache(cacheKey);
        if (cached) return Promise.resolve(cached.response);
        const pending = productListRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<Product[]>('/products', {
            params: {
                ...(normalizedKeyword ? { keyword: normalizedKeyword } : {}),
                ...(normalizedCategoryId ? { categoryId: normalizedCategoryId } : {}),
                ...(discount ? { discount: true } : {}),
            },
        })
            .then((response) => {
                const normalized = withArrayData(response);
                cacheProductListResponse(cacheKey, normalized);
                return normalized;
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
    prefetchById: (id: number) => {
        const productId = normalizePositiveInt(id);
        if (!productId) return Promise.resolve();
        const cached = productDetailCache.get(productId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve();
        const pending = productDetailRequests.get(productId);
        if (pending) return pending.then(() => undefined).catch(() => undefined);
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
        return request.then(() => undefined).catch(() => undefined);
    },
    getByIds: (ids: number[]) => {
        const uniqueIds = normalizePositiveIntList(ids, 40);
        if (uniqueIds.length === 0) {
            return Promise.resolve({ data: [] } as unknown as AxiosResponse<Product[]>);
        }
        const cacheKey = uniqueIds.join(',');
        const cached = productByIdsCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = productByIdsRequests.get(cacheKey);
        if (pending) return pending;
        const params = new URLSearchParams();
        uniqueIds.forEach((id) => params.append('ids', String(id)));
        const request = api.get<Product[]>('/products/by-ids', { params })
            .then((response) => {
                const normalized = withArrayData(response);
                productByIdsCache.set(cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                });
                cacheProductDetailFromList(normalized);
                return normalized;
            })
            .finally(() => productByIdsRequests.delete(cacheKey));
        productByIdsRequests.set(cacheKey, request);
        return request;
    },
    getFeatured: () => {
        const cacheKey = '__featured__';
        const cached = getFreshProductListCache(cacheKey);
        if (cached) return Promise.resolve(cached.response);
        const pending = productListRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<Product[]>('/products/featured')
            .then((response) => {
                const normalized = withArrayData(response);
                cacheProductListResponse(cacheKey, normalized);
                return normalized;
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
                const normalized = withArrayData(response);
                personalizedRecommendationCache.set(cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PERSONALIZED_RECOMMENDATION_CACHE_MS,
                });
                cacheProductDetailFromList(normalized);
                return normalized;
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
                const normalized = withArrayData(response);
                productAddOnCache.set(cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PRODUCT_ADD_ON_CACHE_MS,
                });
                cacheProductDetailFromList(normalized);
                return normalized;
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
                const normalized = withArrayData(response);
                productRecommendationsCache.set(productId, {
                    response: normalized,
                    expiresAt: Date.now() + PRODUCT_LIST_CACHE_MS,
                });
                cacheProductDetailFromList(normalized);
                return normalized;
            })
            .finally(() => productRecommendationsRequests.delete(productId));
        productRecommendationsRequests.set(productId, request);
        return request;
    }
};

// 购物车相关 API
export const cartApi = {
    getItems: (_userId: number) => api.get<CartItem[]>('/cart/me').then(withArrayData),
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
    getAll: () => api.get<Order[]>('/orders').then(withArrayData),
    getById: (id: number) => api.get<Order>(`/orders/${toPathId(id)}`),
    getByUser: (_userId: number) => api.get<Order[]>('/orders/me').then(withArrayData),
    getMine: () => api.get<Order[]>('/orders/me').then(withArrayData),
    track: (orderNo: string, email: string) => {
        const normalizedOrderNo = normalizeOrderTrackingNumber(orderNo);
        const normalizedEmail = normalizeEmailParam(email) || '';
        if (!normalizedOrderNo || !normalizedEmail) {
            return Promise.reject(new Error('Order number and email are required'));
        }
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
    }) => api.post<Order>('/orders/checkout/guest', {
        ...payload,
        guestEmail: normalizeEmailParam(payload.guestEmail) || '',
        guestName: normalizeTextParam(payload.guestName, 120),
        guestPhone: normalizeTextParam(payload.guestPhone, 60),
        shippingAddress: normalizeTextParam(payload.shippingAddress, 1000),
        paymentMethod: normalizeTextParam(payload.paymentMethod, 40),
        items: normalizeGuestCheckoutItems(payload.items),
    }),
    update: (id: number, order: Partial<Order>) => api.put<Order>(`/orders/${toPathId(id)}`, order),
    delete: (id: number) => api.delete(`/orders/${toPathId(id)}`),
    cancel: (id: number, guestEmail?: string) => api.put(`/orders/${toPathId(id)}/cancel`, normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined),
    confirm: (id: number) => api.put(`/orders/${toPathId(id)}/confirm`),
    returnOrder: (id: number, reason?: string) => api.put(`/orders/${toPathId(id)}/return`, { reason: normalizeTextParam(reason, 1000) }),
    submitReturnShipment: (id: number, returnTrackingNumber: string) =>
        api.put(`/orders/${toPathId(id)}/return-shipment`, { returnTrackingNumber: normalizeTextParam(returnTrackingNumber, 120) }),
    pay: (id: number) => api.put(`/orders/${toPathId(id)}/pay`),
    ship: (id: number) => api.put(`/orders/${toPathId(id)}/ship`),
    getItems: (orderId: number) => {
        const normalizedOrderId = toPathId(orderId);
        if (!normalizedOrderId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<OrderItem[]>);
        const cached = orderItemsCache.get(normalizedOrderId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = orderItemsRequests.get(normalizedOrderId);
        if (pending) return pending;
        const request = api.get<OrderItem[]>(`/orders/${normalizedOrderId}/items`)
            .then((response) => {
                const normalized = withArrayData(response);
                orderItemsCache.set(normalizedOrderId, {
                    response: normalized,
                    expiresAt: Date.now() + ORDER_ITEMS_CACHE_MS,
                });
                return normalized;
            })
            .finally(() => orderItemsRequests.delete(normalizedOrderId));
        orderItemsRequests.set(normalizedOrderId, request);
        return request;
    },
    addItem: (orderId: number, item: Partial<OrderItem>) => {
        const normalizedOrderId = toPathId(orderId);
        return api.post(`/orders/${normalizedOrderId}/items`, item).finally(() => clearOrderItemsCache(normalizedOrderId));
    },
};

export const couponApi = {
    getPublic: () => cachedGet(publicCouponCache, publicCouponRequests, 'public', COUPON_CACHE_MS, () => api.get<Coupon[]>('/coupons/public').then(withArrayData)),
    claim: (couponId: number, _userId: number) => api.post<UserCoupon>(`/coupons/me/${normalizePositiveInt(couponId) || 0}/claim`).finally(clearCouponCache),
    getByUser: (_userId: number) => cachedGet(userCouponCache, userCouponRequests, 'mine', COUPON_CACHE_MS, () => api.get<UserCoupon[]>('/coupons/me').then(withArrayData)),
    getAvailableByUser: (_userId: number) => cachedGet(userCouponCache, userCouponRequests, 'available', COUPON_CACHE_MS, () => api.get<UserCoupon[]>('/coupons/me/available').then(withArrayData)),
    quote: (payload: { cartItemIds: number[]; userCouponId?: number | null }) =>
        api.post<CouponQuote>('/coupons/me/quote', {
            cartItemIds: normalizePositiveIntList(payload.cartItemIds, 100),
            userCouponId: normalizePositiveInt(payload.userCouponId) || null,
        }),
};

export const paymentApi = {
    getChannels: () => {
        if (paymentChannelCache && paymentChannelCache.expiresAt > Date.now()) {
            return Promise.resolve(paymentChannelCache.response);
        }
        if (paymentChannelRequest) return paymentChannelRequest;
        paymentChannelRequest = api.get<PaymentChannel[]>('/payments/channels')
            .then((response) => {
                const normalized = withArrayData(response);
                paymentChannelCache = { response: normalized, expiresAt: Date.now() + PAYMENT_CHANNEL_CACHE_MS };
                return normalized;
            })
            .finally(() => {
                paymentChannelRequest = null;
            });
        return paymentChannelRequest;
    },
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
        api.get<Payment[]>(`/payments/order/${normalizePositiveInt(orderId) || 0}`, { params: normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined }).then(withArrayData),
    getLatestByOrder: (orderId: number, guestEmail?: string) =>
        api.get<Payment>(`/payments/order/${normalizePositiveInt(orderId) || 0}/latest`, { params: normalizeEmailParam(guestEmail) ? { guestEmail: normalizeEmailParam(guestEmail) } : undefined }),
};

// 评价相关 API
export const reviewApi = {
    getAll: (productId: number) => {
        const normalizedProductId = toPathId(productId);
        if (!normalizedProductId) return Promise.resolve({ data: { reviews: [], averageRating: 0 } } as unknown as AxiosResponse<ProductReviewSummary>);
        const cached = reviewCache.get(normalizedProductId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = reviewRequests.get(normalizedProductId);
        if (pending) return pending;
        const request = api.get<ProductReviewSummary>(`/reviews/product/${normalizedProductId}`)
            .then((response) => {
                reviewCache.set(normalizedProductId, { response, expiresAt: Date.now() + REVIEW_CACHE_MS });
                return response;
            })
            .finally(() => reviewRequests.delete(normalizedProductId));
        reviewRequests.set(normalizedProductId, request);
        return request;
    },
    getReviewableOrders: (productId: number) => api.get<Order[]>(`/reviews/product/${toPathId(productId)}/reviewable-orders`).then(withArrayData),
    create: (productId: number, orderId: number, rating: number, comment: string) =>
        api.post(`/reviews/product/${toPathId(productId)}`, {
            orderId: toPathId(orderId),
            rating: Math.max(1, Math.min(5, Math.floor(Number(rating) || 0))),
            comment: normalizeTextParam(comment, 2000),
        }).finally(() => clearReviewCache(toPathId(productId))),
};

export const questionApi = {
    getByProduct: (productId: number) => {
        const normalizedProductId = toPathId(productId);
        if (!normalizedProductId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<ProductQuestion[]>);
        const cached = questionCache.get(normalizedProductId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = questionRequests.get(normalizedProductId);
        if (pending) return pending;
        const request = api.get<ProductQuestion[]>(`/product-questions/product/${normalizedProductId}`)
            .then((response) => {
                const normalized = withArrayData(response);
                questionCache.set(normalizedProductId, { response: normalized, expiresAt: Date.now() + QUESTION_CACHE_MS });
                return normalized;
            })
            .finally(() => questionRequests.delete(normalizedProductId));
        questionRequests.set(normalizedProductId, request);
        return request;
    },
    ask: (productId: number, question: string) =>
        api.post<ProductQuestion>(`/product-questions/product/${toPathId(productId)}`, { question: normalizeTextParam(question, 1000) })
            .finally(() => clearQuestionCache(toPathId(productId))),
    answer: (questionId: number, answer: string) =>
        api.post<ProductQuestion>(`/product-questions/${toPathId(questionId)}/answer`, { answer: normalizeTextParam(answer, 2000) })
            .finally(() => {
                clearQuestionCache();
                clearAdminQuestionCache();
            }),
};

export const categoryApi = {
    getAll: (params?: { parentId?: number; level?: number }) => {
        const normalizedParams = params ? {
            parentId: normalizePositiveInt(params.parentId) || undefined,
            level: normalizePositiveInt(params.level) || undefined,
        } : undefined;
        const cacheKey = `all:${normalizedParams?.parentId || ''}:${normalizedParams?.level || ''}`;
        return cachedGet(categoryCache, categoryRequests, cacheKey, CATEGORY_CACHE_MS, () => api.get<Category[]>('/categories', { params: normalizedParams }).then(withArrayData));
    },
    getTopLevel: () => cachedGet(categoryCache, categoryRequests, 'top', CATEGORY_CACHE_MS, () => api.get<Category[]>('/categories', { params: { level: 1 } }).then(withArrayData)),
    getChildren: (parentId: number) => {
        const normalizedParentId = toPathId(parentId);
        if (!normalizedParentId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<Category[]>);
        return cachedGet(categoryCache, categoryRequests, `children:${normalizedParentId}`, CATEGORY_CACHE_MS, () =>
            api.get<Category[]>('/categories', { params: { parentId: normalizedParentId } }).then(withArrayData));
    },
    getById: (id: number) => api.get<Category>(`/categories/${toPathId(id)}`),
    create: (category: Partial<Category>) => api.post<Category>('/categories', category).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    update: (id: number, category: Partial<Category>) => api.put<Category>(`/categories/${toPathId(id)}`, category).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    delete: (id: number) => api.delete(`/categories/${toPathId(id)}`).finally(() => {
        clearCategoryCache();
        clearProductCache();
    })
};

export const brandApi = {
    getAll: (params?: { activeOnly?: boolean }) => {
        const activeOnly = Boolean(params?.activeOnly);
        const cacheKey = activeOnly ? 'active' : 'all';
        return cachedGet(brandCache, brandRequests, cacheKey, BRAND_CACHE_MS, () => api.get<Brand[]>('/brands', { params: activeOnly ? { activeOnly: true } : undefined }).then(withArrayData));
    },
    create: (brand: Partial<Brand>) => api.post<Brand>('/brands', brand).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
    update: (id: number, brand: Partial<Brand>) => api.put<Brand>(`/brands/${toPathId(id)}`, brand).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
    delete: (id: number) => api.delete(`/brands/${toPathId(id)}`).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
};

export const adminApi = {
    getDashboard: () => {
        if (adminDashboardCache && adminDashboardCache.expiresAt > Date.now()) {
            return Promise.resolve(adminDashboardCache.response);
        }
        if (adminDashboardRequest) return adminDashboardRequest;
        adminDashboardRequest = api.get<DashboardStats>('/admin/dashboard')
            .then((response) => {
                adminDashboardCache = { response, expiresAt: Date.now() + ADMIN_DASHBOARD_CACHE_MS };
                return response;
            })
            .finally(() => {
                adminDashboardRequest = null;
            });
        return adminDashboardRequest;
    },
    getRegistryStatus: () => api.get<AdminRegistryStatus>('/admin/registry'),
    getSystemStatus: () => api.get<AdminSystemStatus>('/admin/system/status'),
    getConfigCenter: (params?: { dataId?: string; group?: string; namespace?: string }) =>
        api.get<AdminConfigCenterSnapshot>('/admin/config-center', { params }),
    publishConfigCenter: (payload: AdminConfigCenterPublishRequest) =>
        api.post<AdminConfigCenterSnapshot>('/admin/config-center/publish', payload),
    applyConfigCenter: (payload: AdminConfigCenterPublishRequest) =>
        api.post<AdminConfigCenterSnapshot>('/admin/config-center/apply', payload),
    getLogManagementStatus: (params?: { loggerName?: string }) =>
        api.get<AdminLogManagementStatus>('/admin/logs', { params }),
    setDebugLogging: (payload: AdminLogDebugRequest) =>
        api.put<AdminLogManagementStatus>('/admin/logs/debug', payload),
    downloadLogs: (params: { start: string; end: string; keyword?: string; level?: string }) => api.get('/admin/logs/download', {
        params,
        responseType: 'blob',
    }),
    getTrafficControlStatus: () => api.get<AdminTrafficControlStatus>('/admin/traffic-control'),
    clearRateLimitCounters: () => api.post<AdminTrafficControlStatus>('/admin/traffic-control/rate-limit/clear'),
    resetCircuitBreaker: (name?: string) => api.post<AdminTrafficControlStatus>('/admin/traffic-control/circuit-breakers/reset', { name }),
    getAlerts: (params?: { status?: string; severity?: string; category?: string; limit?: number }) =>
        api.get<SystemAlert[]>('/admin/alerts', { params }),
    getAlertSummary: () => api.get<SystemAlertSummary>('/admin/alerts/summary'),
    runAlertSelfCheck: () => api.post<void>('/admin/alerts/self-check'),
    acknowledgeAlert: (id: number, note?: string) => api.post<SystemAlert>(`/admin/alerts/${toPathId(id)}/acknowledge`, { note: normalizeTextParam(note, 200) }),
    resolveAlert: (id: number, note?: string) => api.post<SystemAlert>(`/admin/alerts/${toPathId(id)}/resolve`, { note: normalizeTextParam(note, 200) }),
    acknowledgeAlerts: (ids: number[], note?: string, maxIds = 200) =>
        api.post<SystemAlertBatchActionResponse>('/admin/alerts/batch/acknowledge', {
            ids: normalizePositiveIntList(ids, maxIds),
            note: normalizeTextParam(note, 200),
        }),
    resolveAlerts: (ids: number[], note?: string, maxIds = 200) =>
        api.post<SystemAlertBatchActionResponse>('/admin/alerts/batch/resolve', {
            ids: normalizePositiveIntList(ids, maxIds),
            note: normalizeTextParam(note, 200),
        }),
    purgeResolvedAlerts: (retentionDays = 30) =>
        api.post<SystemAlertPurgeResponse>('/admin/alerts/purge-resolved', null, {
            params: { retentionDays: normalizeBoundedPositiveInt(retentionDays, 30, 3650) },
        }),
    getIpBlacklist: (params?: { status?: string; source?: string; ipAddress?: string; limit?: number }) =>
        api.get<IpBlacklistEntry[]>('/admin/ip-blacklist', {
            params: {
                status: normalizeTextParam(params?.status, 40) || undefined,
                source: normalizeTextParam(params?.source, 40) || undefined,
                ipAddress: normalizeTextParam(params?.ipAddress, 45) || undefined,
                limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000),
            },
        }),
    getIpBlacklistStatus: () => api.get<IpBlacklistStatus>('/admin/ip-blacklist/status'),
    blockIpAddress: (payload: { ipAddress: string; reason?: string; blockMinutes?: number }) =>
        api.post<IpBlacklistEntry>('/admin/ip-blacklist', {
            ipAddress: normalizeTextParam(payload.ipAddress, 45),
            reason: normalizeTextParam(payload.reason, 500),
            blockMinutes: payload.blockMinutes,
        }),
    releaseIpBlacklistEntry: (id: number) => api.post<IpBlacklistEntry>(`/admin/ip-blacklist/${toPathId(id)}/release`),
    releaseIpBlacklistEntries: (ids: number[], note?: string, maxIds = 100) =>
        api.post<IpBlacklistBatchReleaseResponse>('/admin/ip-blacklist/batch/release', {
            ids: normalizePositiveIntList(ids, maxIds),
            note: normalizeTextParam(note, 200),
        }),
    getUsers: (params?: { keyword?: string; role?: string; status?: string }) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
        };
        const cacheKey = `${normalizedParams.keyword || ''}:${normalizedParams.role || ''}:${normalizedParams.status || ''}`;
        return cachedGet(adminUserCache, adminUserRequests, cacheKey, ADMIN_USER_CACHE_MS, () => api.get<User[]>('/admin/users', { params: normalizedParams }));
    },
    getUserSummary: (params?: { keyword?: string; role?: string; status?: string }) => api.get<UserAdminSummary>('/admin/users/summary', {
        params: {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
        },
    }),
    exportUsers: (params?: { keyword?: string; role?: string; status?: string }) => api.get('/admin/users/export', {
        params: {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
        },
        responseType: 'blob',
    }),
    updateUser: (id: number, user: Partial<User>) => api.put(`/admin/users/${toPathId(id)}`, user)
        .then((response) => {
            clearAdminUserCache();
            if (user.role || user.roleCode || user.status) {
                clearAdminPermissionsCache();
                clearAdminRoleCache();
                dispatchDomEvent('shop:admin-permissions-updated');
            }
            return response;
        }),
    assignUserRole: (id: number, roleCode: string) => api.put<User>(`/admin/users/${toPathId(id)}/role-code`, { roleCode: normalizeTextParam(roleCode, 80) })
        .then((response) => {
            clearAdminUserCache();
            clearAdminPermissionsCache();
            clearAdminRoleCache();
            dispatchDomEvent('shop:admin-permissions-updated');
            return response;
        }),
    deleteUser: (id: number) => api.delete(`/admin/users/${toPathId(id)}`).finally(clearAdminUserCache),
    getRoles: () => cachedGet(adminRoleCache, adminRoleRequests, 'roles', ADMIN_ROLE_CACHE_MS, () => api.get<AdminRole[]>('/admin/roles')),
    saveRole: (role: Partial<AdminRole>) => api.post<AdminRole>('/admin/roles', role)
        .then((response) => {
            clearAdminRoleCache();
            clearAdminUserCache();
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
    getOrders: (status?: string) => {
        const normalizedStatus = normalizeTextParam(status, 40) || undefined;
        return cachedGet(
            adminOrderCache as Map<string, { expiresAt: number; response: AxiosResponse<Order[]> }>,
            adminOrderRequests as Map<string, Promise<AxiosResponse<Order[]>>>,
            `list:${normalizedStatus || ''}`,
            ADMIN_ORDER_CACHE_MS,
            () => api.get<Order[]>('/admin/orders', { params: normalizedStatus ? { status: normalizedStatus } : undefined }),
        );
    },
    getOrdersPage: (params?: { status?: string; search?: string; quick?: string; page?: number; size?: number }) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40) || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
            quick: normalizeTextParam(params?.quick, 40) || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 100000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        const cacheKey = `page:${normalizedParams.status || ''}:${normalizedParams.search || ''}:${normalizedParams.quick || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(
            adminOrderCache as Map<string, { expiresAt: number; response: AxiosResponse<AdminOrderPage> }>,
            adminOrderRequests as Map<string, Promise<AxiosResponse<AdminOrderPage>>>,
            cacheKey,
            ADMIN_ORDER_CACHE_MS,
            () => api.get<AdminOrderPage>('/admin/orders/page', { params: normalizedParams }),
        );
    },
    exportOrders: (status?: string, search?: string, quick?: string) => api.get('/admin/orders/export', {
        params: {
            status: normalizeTextParam(status, 40) || undefined,
            search: normalizeTextParam(search, 120) || undefined,
            quick: normalizeTextParam(quick, 40) || undefined,
        },
        responseType: 'blob',
    }),
    getAuditLogs: (params?: Record<string, unknown>) => api.get<SecurityAuditLog[]>('/admin/audit-logs', {
        params: normalizeAuditLogParams(params, { includeLimit: true }),
    }),
    getAuditLogSummary: (params?: Record<string, unknown>) => api.get<SecurityAuditSummary>('/admin/audit-logs/summary', {
        params: normalizeAuditLogParams(params, { includeTopLimit: true }),
    }),
    purgeAuditLogs: (retentionDays = 180) => api.post<SecurityAuditPurgeResponse>('/admin/audit-logs/purge', null, {
        params: { retentionDays: normalizeBoundedPositiveInt(retentionDays, 180, 3650) },
    }),
    exportAuditLogs: (params?: Record<string, unknown>) => api.get('/admin/audit-logs/export', {
        params: normalizeAuditLogParams(params),
        responseType: 'blob',
    }),
    updateOrderStatus: (id: number, status: string, trackingNumber?: string, trackingCarrierCode?: string) =>
        api.put(`/admin/orders/${toPathId(id)}/status`, {
            status: normalizeTextParam(status, 40),
            trackingNumber: normalizeTextParam(trackingNumber, 120) || undefined,
            trackingCarrierCode: normalizeTextParam(trackingCarrierCode, 40) || undefined,
        }).finally(clearAdminOrderCache),
    getProducts: () => api.get<Product[]>('/admin/products'),
    refundOrder: (id: number, payload: { reason?: string; restock?: boolean; manualRefundReference?: string }) =>
        api.post<{ message: string; payment: Payment }>(`/admin/orders/${toPathId(id)}/refund`, {
            reason: normalizeTextParam(payload.reason, 1000) || undefined,
            restock: Boolean(payload.restock),
            manualRefundReference: normalizeTextParam(payload.manualRefundReference, 128) || undefined,
        }).finally(clearAdminOrderCache),
    batchShipOrders: (orderIds: number[], trackingPrefix: string, trackingCarrierCode?: string) =>
        api.post('/admin/orders/batch-ship', {
            orderIds: normalizePositiveIntList(orderIds, 100),
            trackingPrefix: normalizeTextParam(trackingPrefix, 80),
            trackingCarrierCode: normalizeTextParam(trackingCarrierCode, 40) || undefined,
        }).finally(clearAdminOrderCache),
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
    getReviews: () => cachedGet(adminReviewCache, adminReviewRequests, 'reviews', ADMIN_REVIEW_CACHE_MS, () => api.get<Review[]>('/admin/reviews')),
    deleteReview: (id: number) => api.delete(`/admin/reviews/${toPathId(id)}`).finally(() => {
        clearReviewCache();
        clearAdminReviewCache();
    }),
    replyReview: (id: number, reply: string) => api.put<Review>(`/admin/reviews/${toPathId(id)}/reply`, { reply: normalizeTextParam(reply, 2000) }).finally(() => {
        clearReviewCache();
        clearAdminReviewCache();
    }),
    updateReviewStatus: (id: number, status: string) => api.put<Review>(`/admin/reviews/${toPathId(id)}/status`, { status: normalizeTextParam(status, 40) }).finally(() => {
        clearReviewCache();
        clearAdminReviewCache();
    }),
    getQuestionSummary: () => api.get<ProductQuestionAdminSummary>('/admin/questions/summary'),
    getQuestions: (params?: { status?: string; limit?: number }) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000),
        };
        const cacheKey = `${normalizedParams.status || ''}:${normalizedParams.limit}`;
        return cachedGet(adminQuestionCache, adminQuestionRequests, cacheKey, ADMIN_REVIEW_CACHE_MS, () =>
            api.get<ProductQuestion[]>('/admin/questions', { params: normalizedParams }).then(withArrayData));
    },
    answerQuestion: (id: number, answer: string) =>
        api.put<ProductQuestion>(`/admin/questions/${toPathId(id)}/answer`, { answer: normalizeTextParam(answer, 2000) })
            .finally(() => {
                clearQuestionCache();
                clearAdminQuestionCache();
            }),
    getCouponSummary: () => api.get<CouponAdminSummary>('/admin/coupons/summary'),
    getCoupons: () => api.get<Coupon[]>('/admin/coupons'),
    createCoupon: (coupon: Partial<Coupon>) => api.post<Coupon>('/admin/coupons', coupon).finally(clearCouponCache),
    updateCoupon: (id: number, coupon: Partial<Coupon>) => api.put<Coupon>(`/admin/coupons/${toPathId(id)}`, coupon).finally(clearCouponCache),
    deleteCoupon: (id: number) => api.delete(`/admin/coupons/${toPathId(id)}`).finally(clearCouponCache),
    grantCoupon: (id: number, userIds: number[], maxUsers = 100) => api.post<{ granted: number }>(`/admin/coupons/${toPathId(id)}/grant`, { userIds: normalizePositiveIntList(userIds, maxUsers) }).finally(clearCouponCache),
    runPetBirthdayCoupons: () => api.post<{ granted: number }>('/admin/pet-birthday-coupons/run').finally(clearCouponCache),
    getPetBirthdayCouponConfig: () => api.get<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config'),
    updatePetBirthdayCouponConfig: (config: Partial<PetBirthdayCouponConfig>) =>
        api.put<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config', config),
    broadcastNotification: (payload: { type: string; title: string; message: string; contentFormat: 'TEXT' | 'HTML' }) =>
        api.post<{ sent: number }>('/admin/notifications/broadcast', payload),
    getAnnouncementSummary: () => api.get<SiteAnnouncementAdminSummary>('/admin/announcements/summary'),
    getAnnouncements: () => api.get<SiteAnnouncement[]>('/admin/announcements'),
    createAnnouncement: (announcement: Partial<SiteAnnouncement>) => api.post<SiteAnnouncement>('/admin/announcements', announcement),
    updateAnnouncement: (id: number, announcement: Partial<SiteAnnouncement>) => api.put<SiteAnnouncement>(`/admin/announcements/${toPathId(id)}`, announcement),
    deleteAnnouncement: (id: number) => api.delete(`/admin/announcements/${toPathId(id)}`),
};

export const logisticsCarrierApi = {
    getAll: (activeOnly?: boolean) => {
        const cacheKey = activeOnly ? 'active' : 'all';
        return cachedGet(logisticsCarrierCache, logisticsCarrierRequests, cacheKey, LOGISTICS_CARRIER_CACHE_MS, () =>
            api.get<LogisticsCarrier[]>('/admin/logistics-carriers', { params: activeOnly ? { activeOnly: true } : undefined }).then(withArrayData));
    },
    create: (carrier: Partial<LogisticsCarrier>) => api.post<LogisticsCarrier>('/admin/logistics-carriers', carrier).finally(clearLogisticsCarrierCache),
    update: (id: number, carrier: Partial<LogisticsCarrier>) => api.put<LogisticsCarrier>(`/admin/logistics-carriers/${toPathId(id)}`, carrier).finally(clearLogisticsCarrierCache),
    delete: (id: number) => api.delete(`/admin/logistics-carriers/${toPathId(id)}`).finally(clearLogisticsCarrierCache),
};

export const addressApi = {
    getByUser: (_userId: number) =>
        cachedGet(addressCache as Map<string, { expiresAt: number; response: AxiosResponse<UserAddress[]> }>, addressRequests as Map<string, Promise<AxiosResponse<UserAddress[]>>>, 'list', ADDRESS_CACHE_MS, () => api.get<UserAddress[]>('/addresses/me').then(withArrayData)),
    getById: (id: number) => api.get<UserAddress>(`/addresses/${toPathId(id)}`),
    getDefault: (_userId: number) =>
        cachedGet(addressCache as Map<string, { expiresAt: number; response: AxiosResponse<UserAddress> }>, addressRequests as Map<string, Promise<AxiosResponse<UserAddress>>>, 'default', ADDRESS_CACHE_MS, () => api.get<UserAddress>('/addresses/me/default')),
    create: (address: Partial<UserAddress>) => api.post<UserAddress>('/addresses', address).finally(clearAddressCache),
    update: (id: number, address: Partial<UserAddress>) => api.put<UserAddress>(`/addresses/${toPathId(id)}`, address).finally(clearAddressCache),
    delete: (id: number) => api.delete(`/addresses/${toPathId(id)}`).finally(clearAddressCache),
    setDefault: (id: number) => api.put(`/addresses/${toPathId(id)}/default`).finally(clearAddressCache),
};

export const wishlistApi = {
    getByUser: (_userId: number) => api.get<WishlistItem[]>('/wishlist/me').then(withArrayData),
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
                const normalized = withArrayData(response);
                notificationCache.set(cacheKey, { response: normalized, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return normalized;
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
                const normalized = withArrayData(response);
                petProfileCache.set(cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PET_PROFILE_CACHE_MS,
                });
                return normalized;
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
                const normalized = withArrayData(response);
                petGalleryCache.set(cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PET_GALLERY_CACHE_MS,
                });
                return normalized;
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
    track: (trackingNumber: string, carrier?: string, orderId?: number) => {
        const normalizedTrackingNumber = normalizeTextParam(trackingNumber, 120);
        const normalizedCarrier = normalizeTextParam(carrier, 40) || undefined;
        const normalizedOrderId = normalizePositiveInt(orderId) || undefined;
        if (!normalizedTrackingNumber && !normalizedOrderId) {
            return Promise.reject(new Error('Tracking number or order id is required'));
        }
        const params = {
            trackingNumber: normalizedTrackingNumber,
            carrier: normalizedCarrier,
            orderId: normalizedOrderId,
        };
        const cacheKey = `${params.trackingNumber}:${params.carrier || ''}:${params.orderId || ''}`;
        return cachedGet(logisticsTrackCache, logisticsTrackRequests, cacheKey, LOGISTICS_TRACK_CACHE_MS, () => api.get<LogisticsTrackResponse>('/logistics/track', {
            params: {
                trackingNumber: params.trackingNumber,
                carrier: params.carrier,
                orderId: params.orderId,
            },
        }));
    },
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
    getSummary: () => api.get<SupportAdminSummary>('/admin/support/summary'),
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
