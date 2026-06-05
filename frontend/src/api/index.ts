import axios, { AxiosHeaders } from 'axios';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { User, UserProfile, UserAdminSummary, AdminUserPage, Product, AdminProductPage, ProductPublic, ProductPublicPage, Category, CategoryPublic, Brand, BrandPublic, CartItem, Order, OrderCustomer, OrderItem, OrderItemCustomer, OrderTrackResult, Review, PublicReview, ReviewableOrder, DashboardStats, UserAddress, WishlistItem, AppNotification, PaymentCustomer, AdminPayment, PaymentChannel, ProductImportResult, ProductImportHistoryEntry, ProductUrlImportPreview, ProductQuestion, ProductQuestionPublic, ProductQuestionAdminSummary, SupportSession, SupportSessionCustomer, SupportAdminSummary, SupportAdminSessionPage, SupportMessage, SupportMessageCustomer, Coupon, CouponPublic, AdminCouponPage, CouponAdminSummary, UserCoupon, CouponQuote, LogisticsTrackResponse, PetProfile, LogisticsCarrier, PetGalleryPhotoPublic, AdminPetGalleryPhoto, AdminPetGalleryPage, PetGalleryQuota, AppConfig, SecurityAuditLog, SecurityAuditPurgeResponse, SecurityAuditSummary, AdminRole, PetBirthdayCouponConfig, AdminOrderPage, AdminReviewPage, AdminOrderBatchShipResponse, AdminRegistryStatus, AdminSystemStatus, AdminConfigCenterPublishRequest, AdminConfigCenterSnapshot, AdminLogDebugRequest, AdminLogManagementStatus, AdminTrafficControlStatus, SystemAlert, SystemAlertBatchActionResponse, SystemAlertPurgeResponse, SystemAlertSummary, IpBlacklistEntry, IpBlacklistBatchReleaseResponse, IpBlacklistStatus, SiteAnnouncement, SiteAnnouncementPublic, SiteAnnouncementAdminPage, SiteAnnouncementAdminSummary } from '../types';
import { buildLoginUrl, getCurrentRelativeUrl } from '../utils/authRedirect';
import { AUTH_SESSION_STORAGE_KEYS, dispatchAuthSessionChanged } from '../utils/authEvents';
import { resolveApiDispatcherUrl } from '../utils/apiDispatcher';
import { dispatchDomEvent } from '../utils/domEvents';
import { normalizePersistentImageUrl } from '../utils/mediaAssets';
import { resolveApiBaseUrl, resolveSupportWebSocketUrl } from '../utils/runtimeConfig';
import { getEffectiveRole } from '../utils/roles';
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';

const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    timeout: 15000,
});

export const apiBaseUrl = String(api.defaults.baseURL || window.location.origin).replace(/\/$/, '');
const MAX_CART_QUANTITY = 99;
const MAX_SELECTED_SPECS_LENGTH = 2000;
const MAX_PRODUCT_QUESTION_LENGTH = 500;

const normalizePositiveInt = (value: unknown) => {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeSafeInt = (value: unknown) => {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : null;
};

const toPathId = (value: unknown) => {
    const normalized = normalizePositiveInt(value);
    if (!normalized) {
        throw new TypeError('Invalid positive integer path id');
    }
    return normalized;
};

const normalizePositiveIntList = (values: unknown[], limit = 40) =>
    Array.from(new Set(values.map(normalizePositiveInt).filter((id): id is number => id !== null))).slice(0, limit);

const normalizeQuantityParam = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(1, Math.min(Math.floor(numeric), MAX_CART_QUANTITY)) : 1;
};

const normalizeNonNegativeIntParam = (value: unknown, fallback = 0, max = 1_000_000) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(Math.floor(numeric), max)) : fallback;
};

const normalizeNonNegativeNumberParam = (value: unknown, fallback = 0, max = 1_000_000) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, max)) : fallback;
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

const normalizeImageUrlParam = (value: unknown, maxLength = 2048) => {
    const url = normalizeTextParam(value, maxLength);
    return normalizePersistentImageUrl(url);
};

const getJwtExpiryMs = (token: string) => {
    try {
        const payload = token.split('.')[1];
        if (!payload || typeof atob !== 'function') return null;
        const paddedPayload = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
        const parsed = JSON.parse(atob(paddedPayload));
        const expiresAtSeconds = Number(parsed?.exp);
        return Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0 ? expiresAtSeconds * 1000 : null;
    } catch {
        return null;
    }
};

const isJwtExpiring = (token: string, skewMs = 30_000) => {
    const expiresAtMs = getJwtExpiryMs(token);
    return expiresAtMs !== null && expiresAtMs <= Date.now() + skewMs;
};

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

const normalizeLoginParam = (value: unknown, maxLength = 120) => {
    const login = normalizeTextParam(value, maxLength);
    if (login.includes('@')) return login.toLowerCase();
    const compactLogin = login.replace(/\s+/g, '');
    const digitCount = (compactLogin.match(/\d/g) || []).length;
    if (digitCount >= 8 && /^[+\d().\-\s]+$/.test(login)) {
        return compactLogin.startsWith('+')
            ? `+${compactLogin.slice(1).replace(/\D+/g, '')}`
            : compactLogin.replace(/\D+/g, '');
    }
    return compactLogin.toUpperCase();
};

const normalizePhoneParam = (value: unknown, maxLength = 20) => {
    const raw = normalizeTextParam(value, Math.max(maxLength * 2, maxLength));
    const normalized = raw.startsWith('+') ? `+${raw.slice(1).replace(/\D+/g, '')}` : raw.replace(/\D+/g, '');
    return normalized.slice(0, maxLength);
};

const normalizeEmailCodeParam = (value: unknown) =>
    normalizeTextParam(value, 16).replace(/\D+/g, '').slice(0, 6);

const normalizeOrderTrackingNumber = (value: unknown) =>
    normalizeTextParam(value, 80).replace(/[^a-z0-9_-]/gi, '').toUpperCase();

const normalizeGuestCheckoutItems = (items: Array<{ productId: number; quantity: number; selectedSpecs?: string }> = []) =>
    items
        .map((item) => ({
            productId: normalizePositiveInt(item?.productId) || 0,
            quantity: normalizeQuantityParam(item?.quantity),
            selectedSpecs: item?.selectedSpecs ? normalizeTextParam(item.selectedSpecs, MAX_SELECTED_SPECS_LENGTH) : undefined,
        }))
        .filter((item) => item.productId > 0)
        .slice(0, 100);

const normalizeAddressPayload = (address: Partial<UserAddress>) => ({
    recipientName: normalizeTextParam(address.recipientName, 80),
    phone: normalizeTextParam(address.phone, 30),
    address: normalizeTextParam(address.address, 500),
    isDefault: address.isDefault === undefined ? undefined : Boolean(address.isDefault),
});

const normalizeCategoryPayload = (category: Partial<Category>) => ({
    name: normalizeTextParam(category.name, 255),
    parentId: category.parentId === undefined || category.parentId === null ? null : normalizePositiveInt(category.parentId) || null,
    imageUrl: category.imageUrl === undefined || category.imageUrl === null ? null : normalizeImageUrlParam(category.imageUrl, 2048) || null,
    description: category.description === undefined || category.description === null ? null : normalizeTextParam(category.description, 1000),
    localizedContent: category.localizedContent ?? null,
});

const normalizeBrandPayload = (brand: Partial<Brand>) => ({
    name: normalizeTextParam(brand.name, 100),
    description: brand.description === undefined || brand.description === null ? null : normalizeTextParam(brand.description, 1000),
    logoUrl: brand.logoUrl === undefined || brand.logoUrl === null ? null : normalizeImageUrlParam(brand.logoUrl, 1000) || null,
    websiteUrl: brand.websiteUrl === undefined || brand.websiteUrl === null ? null : normalizeTextParam(brand.websiteUrl, 1000),
    status: normalizeTextParam(brand.status, 20).toUpperCase() || 'ACTIVE',
    sortOrder: normalizeSafeInt(brand.sortOrder) ?? 0,
});

const normalizeAnnouncementPayload = (announcement: Partial<SiteAnnouncement>) => ({
    title: normalizeTextParam(announcement.title, 120),
    content: normalizeTextParam(announcement.content, 2000),
    linkUrl: announcement.linkUrl === undefined || announcement.linkUrl === null ? null : normalizeTextParam(announcement.linkUrl, 500),
    status: normalizeTextParam(announcement.status, 20).toUpperCase() || 'ACTIVE',
    sortOrder: normalizeSafeInt(announcement.sortOrder) ?? 0,
    startsAt: announcement.startsAt || undefined,
    endsAt: announcement.endsAt || undefined,
});

const normalizeAdminRolePayload = (role: Partial<AdminRole>) => ({
    code: normalizeTextParam(role.code, 50).toUpperCase(),
    name: normalizeTextParam(role.name, 100),
    description: role.description === undefined || role.description === null ? null : normalizeTextParam(role.description, 255),
    status: normalizeTextParam(role.status, 20).toUpperCase() || 'ACTIVE',
    permissions: normalizeStringListParam(role.permissions, 100, 80),
});

type LogisticsCarrierWritePayload = Partial<LogisticsCarrier> & { code?: unknown };

const normalizeLogisticsCarrierPayload = (carrier: LogisticsCarrierWritePayload) => ({
    name: normalizeTextParam(carrier.name, 100),
    trackingCode: normalizeTextParam(carrier.trackingCode ?? carrier.code, 80),
    status: normalizeTextParam(carrier.status, 20).toUpperCase() || 'ACTIVE',
    sortOrder: normalizeSafeInt(carrier.sortOrder) ?? 0,
});

const normalizeAdminUserUpdatePayload = (user: Partial<User>) => ({
    email: user.email === undefined ? undefined : normalizeEmailParam(user.email) || '',
    phone: user.phone === undefined ? undefined : normalizeTextParam(user.phone, 40),
    address: user.address === undefined ? undefined : normalizeTextParam(user.address, 260),
    role: user.role === undefined ? undefined : normalizeTextParam(user.role, 40).toUpperCase(),
    status: user.status === undefined ? undefined : normalizeTextParam(user.status, 40).toUpperCase(),
});

const normalizePetProfilePayload = (pet: Partial<PetProfile>) => {
    const petType = normalizeTextParam(pet.petType, 20).toUpperCase();
    const size = normalizeTextParam(pet.size, 20).toUpperCase();
    const weight = Number(pet.weight);
    return {
        name: normalizeTextParam(pet.name, 120),
        petType: ['DOG', 'CAT', 'SMALL_PET'].includes(petType) ? petType : undefined,
        breed: pet.breed === undefined ? undefined : normalizeTextParam(pet.breed, 160),
        birthday: pet.birthday ? normalizeTextParam(pet.birthday, 32) : undefined,
        weight: Number.isFinite(weight) && weight > 0 ? Math.min(weight, 1000) : undefined,
        size: ['SMALL', 'MEDIUM', 'LARGE'].includes(size) ? size : undefined,
    };
};

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeNullableProductValue = <T,>(value: unknown, normalize: (raw: unknown) => T) =>
    value === null ? null : normalize(value);

const normalizeStringListParam = (values: unknown, limit = 30, maxLength = 500) =>
    Array.isArray(values)
        ? Array.from(new Set(values.map((value) => normalizeTextParam(value, maxLength)).filter(Boolean))).slice(0, limit)
        : [];

const normalizeImageListParam = (values: unknown, limit = 30, maxLength = 2048) =>
    Array.isArray(values)
        ? Array.from(new Set(values.map((value) => normalizeImageUrlParam(value, maxLength)).filter(Boolean))).slice(0, limit)
        : [];

const normalizeProductSpecifications = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.entries(value as Record<string, unknown>).slice(0, 80).reduce<Record<string, string>>((acc, [key, rawValue]) => {
        const normalizedKey = normalizeTextParam(key, 80);
        const normalizedValue = normalizeTextParam(rawValue, 500);
        if (normalizedKey && normalizedValue) {
            acc[normalizedKey] = normalizedValue;
        }
        return acc;
    }, {});
};

const normalizeProductDetailContent = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    const allowedTypes = new Set(['text', 'image', 'video']);
    return value.slice(0, 80).map((block) => {
        const rawBlock = block && typeof block === 'object' ? block as Record<string, unknown> : {};
        const type = normalizeTextParam(rawBlock.type, 20).toLowerCase();
        const normalizedType = allowedTypes.has(type) ? type : 'text';
        const mediaUrl = normalizedType === 'image' || normalizedType === 'video'
            ? normalizeImageUrlParam(rawBlock.url, 2048)
            : undefined;
        return {
            type: normalizedType,
            content: normalizeTextParam(rawBlock.content, 5000) || undefined,
            url: mediaUrl || undefined,
            caption: normalizeTextParam(rawBlock.caption, 300) || undefined,
        };
    }).filter((block) => block.type === 'text' || block.url);
};

const normalizeProductVariants = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 120).map((variant) => {
        const rawVariant = variant && typeof variant === 'object' ? variant as Record<string, unknown> : {};
        return {
            sku: normalizeTextParam(rawVariant.sku, 120) || undefined,
            options: normalizeProductSpecifications(rawVariant.options),
            price: normalizeNonNegativeNumberParam(rawVariant.price),
            stock: rawVariant.stock === undefined ? undefined : normalizeNonNegativeIntParam(rawVariant.stock),
            imageUrl: normalizeImageUrlParam(rawVariant.imageUrl, 2048) || undefined,
        };
    });
};

const normalizeProductPayload = (product: Partial<Product>) => {
    const payload: Partial<Product> = {};
    if (hasOwn(product, 'name')) payload.name = normalizeNullableProductValue(product.name, (value) => normalizeTextParam(value, 180)) as Product['name'];
    if (hasOwn(product, 'description')) payload.description = normalizeNullableProductValue(product.description, (value) => normalizeTextParam(value, 5000)) as Product['description'];
    if (hasOwn(product, 'price')) payload.price = normalizeNullableProductValue(product.price, normalizeNonNegativeNumberParam) as Product['price'];
    if (hasOwn(product, 'stock')) payload.stock = normalizeNullableProductValue(product.stock, normalizeNonNegativeIntParam) as Product['stock'];
    if (hasOwn(product, 'categoryId')) payload.categoryId = normalizeNullableProductValue(product.categoryId, (value) => normalizePositiveInt(value) || 0) as Product['categoryId'];
    if (hasOwn(product, 'isFeatured')) payload.isFeatured = Boolean(product.isFeatured);
    if (hasOwn(product, 'imageUrl')) payload.imageUrl = normalizeNullableProductValue(product.imageUrl, (value) => normalizeImageUrlParam(value, 2048)) as Product['imageUrl'];
    if (hasOwn(product, 'status')) payload.status = normalizeNullableProductValue(product.status, (value) => normalizeTextParam(value, 40).toUpperCase()) as Product['status'];
    if (hasOwn(product, 'brand')) payload.brand = normalizeNullableProductValue(product.brand, (value) => normalizeTextParam(value, 120)) as Product['brand'];
    if (hasOwn(product, 'tag')) payload.tag = normalizeNullableProductValue(product.tag, (value) => normalizeTextParam(value, 80)) as Product['tag'];
    if (hasOwn(product, 'warranty')) payload.warranty = normalizeNullableProductValue(product.warranty, (value) => normalizeTextParam(value, 500)) as Product['warranty'];
    if (hasOwn(product, 'shipping')) payload.shipping = normalizeNullableProductValue(product.shipping, (value) => normalizeTextParam(value, 500)) as Product['shipping'];
    if (hasOwn(product, 'originalPrice')) payload.originalPrice = normalizeNullableProductValue(product.originalPrice, normalizeNonNegativeNumberParam) as Product['originalPrice'];
    if (hasOwn(product, 'discount')) payload.discount = normalizeNullableProductValue(product.discount, (value) => normalizeNonNegativeNumberParam(value, 0, 100)) as Product['discount'];
    if (hasOwn(product, 'limitedTimePrice')) payload.limitedTimePrice = normalizeNullableProductValue(product.limitedTimePrice, normalizeNonNegativeNumberParam) as Product['limitedTimePrice'];
    if (hasOwn(product, 'limitedTimeStartAt')) payload.limitedTimeStartAt = normalizeNullableProductValue(product.limitedTimeStartAt, (value) => normalizeTextParam(value, 40)) as Product['limitedTimeStartAt'];
    if (hasOwn(product, 'limitedTimeEndAt')) payload.limitedTimeEndAt = normalizeNullableProductValue(product.limitedTimeEndAt, (value) => normalizeTextParam(value, 40)) as Product['limitedTimeEndAt'];
    if (hasOwn(product, 'freeShipping')) payload.freeShipping = Boolean(product.freeShipping);
    if (hasOwn(product, 'freeShippingThreshold')) payload.freeShippingThreshold = normalizeNullableProductValue(product.freeShippingThreshold, normalizeNonNegativeNumberParam) as Product['freeShippingThreshold'];
    if (hasOwn(product, 'images')) payload.images = normalizeNullableProductValue(product.images, (value) => normalizeImageListParam(value, 40, 2048)) as Product['images'];
    if (hasOwn(product, 'specifications')) payload.specifications = normalizeNullableProductValue(product.specifications, normalizeProductSpecifications) as Product['specifications'];
    if (hasOwn(product, 'detailContent')) payload.detailContent = normalizeNullableProductValue(product.detailContent, normalizeProductDetailContent) as Product['detailContent'];
    if (hasOwn(product, 'variants')) payload.variants = normalizeNullableProductValue(product.variants, normalizeProductVariants) as Product['variants'];
    return payload;
};

type ProductReviewSummary = {
    reviews: PublicReview[];
    averageRating: number;
};

type AuthSessionResponse = {
    token?: string;
    refreshToken?: string;
    id?: number | string;
    username?: string;
    role?: string | null;
    roleCode?: string | null;
};

type AuthRetryConfig = AxiosRequestConfig & {
    _authRetry?: boolean;
    _anonymousRetry?: boolean;
    _transientRetryCount?: number;
    skipAuthRefresh?: boolean;
    skipAuthHeader?: boolean;
    skipAuthRedirect?: boolean;
    skipTransientRetry?: boolean;
    allowAnonymousRetry?: boolean;
};

export type ApiRequestOptions = {
    signal?: AbortSignal;
    bypassCache?: boolean;
};

export const createApiAbortController = () => new AbortController();

const withRequestOptions = <T extends AxiosRequestConfig>(config: T, options?: ApiRequestOptions): T => (
    options?.signal ? { ...config, signal: options.signal } as T : config
);

const anonymousGetConfig = (config: AxiosRequestConfig = {}, options?: ApiRequestOptions): AxiosRequestConfig => withRequestOptions({
    ...config,
    allowAnonymousRetry: true,
    skipAuthHeader: true,
    skipAuthRedirect: true,
} as AuthRetryConfig, options);

const optionalAnonymousGetConfig = (config: AxiosRequestConfig = {}, options?: ApiRequestOptions): AxiosRequestConfig => withRequestOptions({
    ...config,
    allowAnonymousRetry: true,
} as AuthRetryConfig, options);

const anonymousRequestConfig = (config: AxiosRequestConfig = {}, options?: ApiRequestOptions): AxiosRequestConfig => withRequestOptions({
    ...config,
    skipAuthRefresh: true,
    skipAuthHeader: true,
    skipAuthRedirect: true,
} as AuthRetryConfig, options);

const hasGuestCredentials = (email?: string, orderNo?: string) => Boolean(normalizeEmailParam(email) && normalizeOrderTrackingNumber(orderNo || ''));

const guestParams = (email?: string, orderNo?: string) => hasGuestCredentials(email, orderNo)
    ? { guestEmail: normalizeEmailParam(email), orderNo: normalizeOrderTrackingNumber(orderNo || '') }
    : undefined;

const guestRequestConfig = (email?: string, orderNo?: string, config: AxiosRequestConfig = {}) => hasGuestCredentials(email, orderNo)
    ? anonymousRequestConfig(config)
    : config;

const guestOrderPath = (id: number, email?: string, orderNo?: string) => {
    const normalizedId = toPathId(id);
    return hasGuestCredentials(email, orderNo) ? `/orders/guest/${normalizedId}` : `/orders/${normalizedId}`;
};

const paymentOrderPath = (id: number, email?: string, orderNo?: string) => {
    const normalizedId = toPathId(id);
    return hasGuestCredentials(email, orderNo) ? `/payments/guest/order/${normalizedId}` : `/payments/order/${normalizedId}`;
};

const PUBLIC_GET_PREFIXES = [
    '/products',
    '/categories',
    '/brands',
    '/reviews',
    '/product-questions',
    '/support/guest',
];

const PUBLIC_GET_PATHS = new Set([
    '/announcements/active',
    '/app/config',
    '/payments/channels',
    '/coupons/public',
    '/pet-gallery',
]);

const isPublicGetRequest = (config?: AxiosRequestConfig) => {
    if (!config) return false;
    const method = String(config.method || 'get').toLowerCase();
    if (method !== 'get') return false;
    const rawUrl = String(config.url || '');
    const gatewayNormalizedUrl = rawUrl.startsWith('/gateway/')
        ? rawUrl.replace(/^\/gateway\/[^/]+/, '')
        : rawUrl;
    const normalizedUrl = gatewayNormalizedUrl.startsWith('/api/')
        ? gatewayNormalizedUrl.slice(4)
        : gatewayNormalizedUrl;
    const path = normalizedUrl.split(/[?#]/)[0] || '';
    if (PUBLIC_GET_PATHS.has(path)) return true;
    return PUBLIC_GET_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const TRANSIENT_RETRY_DELAYS_MS = [320, 900];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isRetryableMethod = (config?: AxiosRequestConfig) => {
    const method = String(config?.method || 'get').toLowerCase();
    return method === 'get' || method === 'head' || method === 'options';
};

const isTransientApiError = (error: AxiosError) => {
    const status = Number(error.response?.status || 0);
    if ([429, 500, 502, 503, 504].includes(status)) return true;
    return !error.response && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error');
};

const shouldRetryTransientError = (error: AxiosError, config?: AuthRetryConfig) => {
    if (!config || config.skipTransientRetry || config.signal?.aborted) return false;
    if (!isRetryableMethod(config) || !isTransientApiError(error)) return false;
    const retryCount = config._transientRetryCount || 0;
    return retryCount < TRANSIENT_RETRY_DELAYS_MS.length;
};

const getStoredItem = (key: string) => {
    return getLocalStorageItem(key);
};

const removeStoredItems = (keys: string[]) => {
    keys.forEach(removeLocalStorageItem);
};

const setStoredItem = (key: string, value: string) => {
    setLocalStorageItem(key, value);
};

const userCacheKeyFrom = (userIdValue?: unknown, tokenValue?: unknown) => {
    const userId = normalizePositiveInt(userIdValue);
    if (userId) return `user:${userId}`;
    const token = normalizeTextParam(tokenValue, 2048);
    if (token) return `token:${token.slice(-24)}`;
    return 'anonymous';
};

const currentUserCacheKey = () => userCacheKeyFrom(getStoredItem('userId'), getStoredItem('token'));

export const supportWebSocketUrl = (token: string) => {
    const normalizedToken = normalizeTextParam(token, 2048);
    if (!normalizedToken) {
        throw new Error('Support websocket token is required');
    }
    const base = new URL(resolveSupportWebSocketUrl(), window.location.origin);
    if (base.protocol === 'https:') base.protocol = 'wss:';
    if (base.protocol === 'http:') base.protocol = 'ws:';
    return base.toString();
};

export const supportWebSocketProtocols = (token: string) => {
    const normalizedToken = normalizeTextParam(token, 2048);
    if (!normalizedToken) {
        throw new Error('Support websocket token is required');
    }
    const encodedToken = btoa(normalizedToken)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return ['support.v1', `auth.${encodedToken}`];
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
const MAX_API_CACHE_ENTRIES = 80;
const MAX_API_REQUEST_ENTRIES = 80;
const productListCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
const productListRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
const productPageCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublicPage> }>();
const productPageRequests = new Map<string, Promise<AxiosResponse<ProductPublicPage>>>();
const productDetailCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductPublic> }>();
const productDetailRequests = new Map<number, Promise<AxiosResponse<ProductPublic>>>();
const productByIdsCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
const productByIdsRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
const orderTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<OrderTrackResult> }>();
const orderTrackRequests = new Map<string, Promise<AxiosResponse<OrderTrackResult>>>();
const petGalleryCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetGalleryPhotoPublic[]> | AxiosResponse<PetGalleryQuota> }>();
const petGalleryRequests = new Map<string, Promise<AxiosResponse<PetGalleryPhotoPublic[]> | AxiosResponse<PetGalleryQuota>>>();
const petProfileCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetProfile[]> }>();
const petProfileRequests = new Map<string, Promise<AxiosResponse<PetProfile[]>>>();
const notificationCache = new Map<string, { expiresAt: number; response: AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }> }>();
const notificationRequests = new Map<string, Promise<AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }>>>();
const personalizedRecommendationCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
const personalizedRecommendationRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
const productAddOnCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
const productAddOnRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
const productRecommendationsCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
const productRecommendationsRequests = new Map<number, Promise<AxiosResponse<ProductPublic[]>>>();
const publicCouponCache = new Map<string, { expiresAt: number; response: AxiosResponse<CouponPublic[]> }>();
const publicCouponRequests = new Map<string, Promise<AxiosResponse<CouponPublic[]>>>();
const userCouponCache = new Map<string, { expiresAt: number; response: AxiosResponse<UserCoupon[]> }>();
const userCouponRequests = new Map<string, Promise<AxiosResponse<UserCoupon[]>>>();
const addressCache = new Map<string, { expiresAt: number; response: AxiosResponse<UserAddress> | AxiosResponse<UserAddress[]> }>();
const addressRequests = new Map<string, Promise<AxiosResponse<UserAddress> | AxiosResponse<UserAddress[]>>>();
const orderItemsCache = new Map<string, { expiresAt: number; response: AxiosResponse<OrderItemCustomer[]> }>();
const orderItemsRequests = new Map<string, Promise<AxiosResponse<OrderItemCustomer[]>>>();
const logisticsTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<LogisticsTrackResponse> }>();
const logisticsTrackRequests = new Map<string, Promise<AxiosResponse<LogisticsTrackResponse>>>();
const reviewCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductReviewSummary> }>();
const reviewRequests = new Map<number, Promise<AxiosResponse<ProductReviewSummary>>>();
const questionCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductQuestionPublic[]> }>();
const questionRequests = new Map<number, Promise<AxiosResponse<ProductQuestionPublic[]>>>();
const logisticsCarrierCache = new Map<string, { expiresAt: number; response: AxiosResponse<LogisticsCarrier[]> }>();
const logisticsCarrierRequests = new Map<string, Promise<AxiosResponse<LogisticsCarrier[]>>>();
const categoryCache = new Map<string, { expiresAt: number; response: AxiosResponse<CategoryPublic[]> }>();
const categoryRequests = new Map<string, Promise<AxiosResponse<CategoryPublic[]>>>();
const brandCache = new Map<string, { expiresAt: number; response: AxiosResponse<BrandPublic[]> }>();
const brandRequests = new Map<string, Promise<AxiosResponse<BrandPublic[]>>>();
const adminRoleCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminRole[]> }>();
const adminRoleRequests = new Map<string, Promise<AxiosResponse<AdminRole[]>>>();
const adminUserCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminUserPage> }>();
const adminUserRequests = new Map<string, Promise<AxiosResponse<AdminUserPage>>>();
const adminOrderCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminOrderPage> }>();
const adminOrderRequests = new Map<string, Promise<AxiosResponse<AdminOrderPage>>>();
const adminReviewCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminReviewPage> }>();
const adminReviewRequests = new Map<string, Promise<AxiosResponse<AdminReviewPage>>>();
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

const trimMapToSize = <K, V>(map: Map<K, V>, maxEntries: number) => {
    while (map.size > maxEntries) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
    }
};

const setBoundedMapEntry = <K, V>(map: Map<K, V>, key: K, value: V, maxEntries = MAX_API_REQUEST_ENTRIES) => {
    map.set(key, value);
    trimMapToSize(map, maxEntries);
};

const setTimedCacheEntry = <K, V extends { expiresAt: number }>(map: Map<K, V>, key: K, value: V) => {
    const now = Date.now();
    map.forEach((entry, entryKey) => {
        if (entry.expiresAt <= now) {
            map.delete(entryKey);
        }
    });
    map.set(key, value);
    trimMapToSize(map, MAX_API_CACHE_ENTRIES);
};

const cachedGet = <T,>(
    cache: Map<string, { expiresAt: number; response: AxiosResponse<T> }>,
    requests: Map<string, Promise<AxiosResponse<T>>>,
    cacheKey: string,
    ttlMs: number,
    loader: () => Promise<AxiosResponse<T>>,
    options?: ApiRequestOptions,
) => {
    const cached = cache.get(cacheKey);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
    if (options?.signal) {
        return loader();
    }
    const pending = options?.bypassCache ? undefined : requests.get(cacheKey);
    if (pending) return pending;
    const request = loader()
        .then((response) => {
            setTimedCacheEntry(cache, cacheKey, { response, expiresAt: Date.now() + ttlMs });
            return response;
        })
        .finally(() => requests.delete(cacheKey));
    setBoundedMapEntry(requests, cacheKey, request);
    return request;
};

const cachedTypedGet = <K, T>(
    cache: Map<K, { expiresAt: number; response: AxiosResponse<T> }>,
    requests: Map<K, Promise<AxiosResponse<T>>>,
    cacheKey: K,
    loader: () => Promise<AxiosResponse<T>>,
    options?: ApiRequestOptions,
) => {
    const cached = cache.get(cacheKey);
    if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
    if (options?.signal) return loader();
    const pending = options?.bypassCache ? undefined : requests.get(cacheKey);
    if (pending) return pending;
    const request = loader().finally(() => requests.delete(cacheKey));
    setBoundedMapEntry(requests, cacheKey, request);
    return request;
};

const withArrayData = <T,>(response: AxiosResponse<T[]>): AxiosResponse<T[]> => ({
    ...response,
    data: Array.isArray(response.data) ? response.data : [],
});

const parseMaybeJson = (value: unknown) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    const firstChar = text[0];
    if (!text || (firstChar !== '{' && firstChar !== '[')) return value;
    try {
        return JSON.parse(text);
    } catch {
        return value;
    }
};

const normalizeProductImages = (product: Partial<ProductPublic>) => {
    const rawImages = parseMaybeJson((product as any).images);
    const images = Array.isArray(rawImages)
        ? rawImages.map(String).map((image) => image.trim()).filter(Boolean)
        : [];
    const imageUrl = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
    return images.length > 0 ? images : (imageUrl ? [imageUrl] : []);
};

const normalizeProductMap = (value: unknown) => {
    const parsed = parseMaybeJson(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
};

const normalizeProductListField = <T,>(value: unknown): T[] => {
    const parsed = parseMaybeJson(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
};

const normalizeProductOptionGroups = (value: unknown) =>
    normalizeProductListField<Record<string, unknown>>(value)
        .map((group) => {
            const name = normalizeTextParam(group?.name, 80);
            const values = Array.isArray(group?.values)
                ? normalizeStringListParam(group.values, 40, 120)
                : normalizeStringListParam((group as any)?.options, 40, 120);
            return { name, values, options: values };
        })
        .filter((group) => group.name && group.values.length > 0);

const normalizeProductPageData = <T extends ProductPublic>(data: unknown): T[] => {
    if (Array.isArray(data)) return data.map(normalizeProduct);
    const content = (data as { content?: unknown; items?: unknown })?.content
        ?? (data as { items?: unknown })?.items;
    return Array.isArray(content) ? content.map(normalizeProduct) : [];
};

const normalizeProduct = <T extends ProductPublic>(product: T): T => ({
    ...product,
    images: normalizeProductImages(product),
    imageUrl: (typeof product.imageUrl === 'string' && product.imageUrl.trim()) || normalizeProductImages(product)[0] || '',
    specifications: normalizeProductMap((product as any).specifications),
    detailContent: normalizeProductListField((product as any).detailContent),
    variants: normalizeProductListField((product as any).variants),
    optionGroups: normalizeProductOptionGroups((product as any).optionGroups),
    bundle: product.bundle && typeof product.bundle === 'object' ? product.bundle : null,
    localizedContent: product.localizedContent && typeof product.localizedContent === 'object' ? product.localizedContent : null,
} as T);

const withProductArrayData = <T extends ProductPublic>(response: AxiosResponse<T[] | ProductPublicPage>): AxiosResponse<T[]> => ({
    ...response,
    data: normalizeProductPageData<T>(response.data),
});

const normalizeProductPublicPageResponse = (response: AxiosResponse<ProductPublicPage | ProductPublic[]>): AxiosResponse<ProductPublicPage> => {
    const raw = response.data as ProductPublicPage | ProductPublic[] | Record<string, unknown>;
    const items = normalizeProductPageData<ProductPublic>(raw);
    const rawPage = Array.isArray(raw) ? undefined : Number((raw as ProductPublicPage).page);
    const rawSize = Array.isArray(raw) ? undefined : Number((raw as ProductPublicPage).size);
    const page = typeof rawPage === 'number' && Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0 ? rawSize : Math.max(1, items.length);
    const rawTotal = Array.isArray(raw)
        ? items.length
        : Number((raw as ProductPublicPage).total ?? (raw as any).totalElements ?? items.length);
    const total = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : items.length;
    const rawTotalPages = Array.isArray(raw) ? undefined : Number((raw as ProductPublicPage).totalPages);
    const totalPages = typeof rawTotalPages === 'number' && Number.isFinite(rawTotalPages) && rawTotalPages >= 0
        ? rawTotalPages
        : (total === 0 ? 0 : Math.ceil(total / size));
    const hasNext = Array.isArray(raw)
        ? page + 1 < totalPages
        : Boolean((raw as ProductPublicPage).hasNext ?? page + 1 < totalPages);
    const hasPrevious = Array.isArray(raw)
        ? page > 0
        : Boolean((raw as ProductPublicPage).hasPrevious ?? page > 0);
    return {
        ...response,
        data: {
            items,
            total,
            page,
            size,
            totalPages,
            hasNext,
            hasPrevious,
        },
    } as AxiosResponse<ProductPublicPage>;
};

const normalizeProductAdminPageResponse = (response: AxiosResponse<AdminProductPage | Product[]>): AxiosResponse<AdminProductPage> => {
    const raw = response.data as AdminProductPage | Product[] | Record<string, unknown>;
    const items = normalizeProductPageData<Product>(raw);
    const rawPage = Array.isArray(raw) ? undefined : Number((raw as AdminProductPage).page);
    const rawSize = Array.isArray(raw) ? undefined : Number((raw as AdminProductPage).size);
    const page = typeof rawPage === 'number' && Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0 ? rawSize : Math.max(1, items.length);
    const rawTotal = Array.isArray(raw)
        ? items.length
        : Number((raw as AdminProductPage).total ?? (raw as any).totalElements ?? items.length);
    const total = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : items.length;
    const rawTotalPages = Array.isArray(raw) ? undefined : Number((raw as AdminProductPage).totalPages);
    const totalPages = typeof rawTotalPages === 'number' && Number.isFinite(rawTotalPages) && rawTotalPages >= 0
        ? rawTotalPages
        : (total === 0 ? 0 : Math.ceil(total / size));
    const hasNext = Array.isArray(raw)
        ? page + 1 < totalPages
        : Boolean((raw as AdminProductPage).hasNext ?? page + 1 < totalPages);
    const hasPrevious = Array.isArray(raw)
        ? page > 0
        : Boolean((raw as AdminProductPage).hasPrevious ?? page > 0);
    return {
        ...response,
        data: {
            items,
            total,
            page,
            size,
            totalPages,
            hasNext,
            hasPrevious,
        },
    } as AxiosResponse<AdminProductPage>;
};

const cacheProductDetailFromList = (response: AxiosResponse<ProductPublic[]>) => {
    const expiresAt = Date.now() + PRODUCT_DETAIL_CACHE_MS;
    response.data.forEach((product) => {
        if (!product.id) return;
        setTimedCacheEntry(productDetailCache, product.id, {
            response: { ...response, data: product } as unknown as AxiosResponse<ProductPublic>,
            expiresAt,
        });
    });
};

const cacheProductListResponse = (cacheKey: string, response: AxiosResponse<ProductPublic[]>, ttlMs = PRODUCT_LIST_CACHE_MS) => {
    setTimedCacheEntry(productListCache, cacheKey, {
        response,
        expiresAt: Date.now() + ttlMs,
    });
    cacheProductDetailFromList(response);
};

const cacheProductPageResponse = (cacheKey: string, response: AxiosResponse<ProductPublicPage>, ttlMs = PRODUCT_LIST_CACHE_MS) => {
    setTimedCacheEntry(productPageCache, cacheKey, {
        response,
        expiresAt: Date.now() + ttlMs,
    });
    cacheProductDetailFromList({ ...response, data: response.data.items } as AxiosResponse<ProductPublic[]>);
};

export const appConfigApi = {
    get: (options?: ApiRequestOptions) => {
        if (appConfigCache && appConfigCache.expiresAt > Date.now()) {
            return Promise.resolve(appConfigCache.response);
        }
        if (options?.signal) {
            return api.get<AppConfig>('/app/config', anonymousGetConfig(undefined, options));
        }
        if (appConfigRequest) return appConfigRequest;
        appConfigRequest = api.get<AppConfig>('/app/config', anonymousGetConfig())
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
    getActive: (limit = 5, options?: ApiRequestOptions) => api.get<SiteAnnouncementPublic[]>('/announcements/active', anonymousGetConfig({ params: { limit: normalizeBoundedPositiveInt(limit, 5, 10) } }, options)).then(withArrayData),
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
    [`list:user:${userId}`, `unread:user:${userId}`, `list:${userId}`, `unread:${userId}`].forEach((key) => {
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
    const prefix = `${orderId}:`;
    Array.from(orderItemsCache.keys()).forEach((key) => {
        if (key.startsWith(prefix)) orderItemsCache.delete(key);
    });
    Array.from(orderItemsRequests.keys()).forEach((key) => {
        if (key.startsWith(prefix)) orderItemsRequests.delete(key);
    });
};

const clearOrderTrackCache = () => {
    orderTrackCache.clear();
    orderTrackRequests.clear();
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

const normalizeAdminReviewPageResponse = (response: AxiosResponse<AdminReviewPage | Review[]>): AxiosResponse<AdminReviewPage> => {
    if (Array.isArray(response.data)) {
        return {
            ...response,
            data: {
                items: response.data,
                total: response.data.length,
                page: 1,
                size: response.data.length,
                totalPages: response.data.length ? 1 : 0,
            },
        };
    }
    return {
        ...response,
        data: {
            ...response.data,
            items: Array.isArray(response.data?.items) ? response.data.items : [],
            total: Number(response.data?.total || 0),
            page: Number(response.data?.page || 1),
            size: Number(response.data?.size || 20),
            totalPages: Number(response.data?.totalPages || 0),
            summary: response.data?.summary || {},
        },
    };
};

const normalizeAdminCouponPageResponse = (response: AxiosResponse<AdminCouponPage | Coupon[]>): AxiosResponse<AdminCouponPage> => {
    if (Array.isArray(response.data)) {
        const items = response.data;
        response.data = {
            items,
            total: items.length,
            page: 1,
            size: Math.max(1, items.length || 20),
            totalPages: items.length ? 1 : 0,
        };
        return response as AxiosResponse<AdminCouponPage>;
    }
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    const total = Number(response.data?.total ?? items.length);
    const page = Number(response.data?.page || 1);
    const size = Number(response.data?.size || Math.max(1, items.length || 20));
    const totalPages = Number(response.data?.totalPages ?? (total > 0 ? Math.ceil(total / size) : 0));
    response.data = {
        ...response.data,
        items,
        total: Number.isFinite(total) && total >= 0 ? total : items.length,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        size: Number.isFinite(size) && size > 0 ? size : 20,
        totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0,
    };
    return response as AxiosResponse<AdminCouponPage>;
};

const normalizeAdminPetGalleryPageResponse = (response: AxiosResponse<AdminPetGalleryPage | AdminPetGalleryPhoto[]>): AxiosResponse<AdminPetGalleryPage> => {
    if (Array.isArray(response.data)) {
        return {
            ...response,
            data: {
                items: response.data,
                total: response.data.length,
                page: 1,
                size: response.data.length,
                totalPages: response.data.length ? 1 : 0,
                summary: {
                    visiblePhotos: response.data.length,
                    userUploads: response.data.filter((photo) => (photo.source || 'USER_UPLOAD') === 'USER_UPLOAD').length,
                    seedPhotos: response.data.filter((photo) => photo.source === 'SEED').length,
                },
            },
        };
    }
    return {
        ...response,
        data: {
            ...response.data,
            items: Array.isArray(response.data?.items) ? response.data.items : [],
            total: Number(response.data?.total || 0),
            page: Number(response.data?.page || 1),
            size: Number(response.data?.size || 12),
            totalPages: Number(response.data?.totalPages || 0),
            summary: response.data?.summary || {},
        },
    };
};

const normalizeAdminUserPageResponse = (response: AxiosResponse<AdminUserPage | User[]>): AxiosResponse<AdminUserPage> => {
    if (Array.isArray(response.data)) {
        const items = response.data;
        response.data = {
            items,
            total: items.length,
            page: 1,
            size: Math.max(1, items.length || 20),
            totalPages: items.length ? 1 : 0,
        };
        return response as AxiosResponse<AdminUserPage>;
    }
    response.data = {
        items: Array.isArray(response.data?.items) ? response.data.items : [],
        total: Number(response.data?.total || 0),
        page: Number(response.data?.page || 1),
        size: Number(response.data?.size || 20),
        totalPages: Number(response.data?.totalPages || 0),
    };
    return response as AxiosResponse<AdminUserPage>;
};

const normalizeSiteAnnouncementPageResponse = (
    response: AxiosResponse<SiteAnnouncementAdminPage | SiteAnnouncement[]>
): AxiosResponse<SiteAnnouncementAdminPage> => {
    if (Array.isArray(response.data)) {
        const items = response.data;
        response.data = {
            items,
            total: items.length,
            page: 1,
            size: Math.max(1, items.length || 20),
            totalPages: items.length ? 1 : 0,
            hasNext: false,
            hasPrevious: false,
        };
        return response as AxiosResponse<SiteAnnouncementAdminPage>;
    }
    const items = Array.isArray(response.data?.items) ? response.data.items : [];
    const total = Number(response.data?.total ?? items.length);
    const page = Number(response.data?.page || 1);
    const size = Number(response.data?.size || Math.max(1, items.length || 20));
    const totalPages = Number(response.data?.totalPages ?? (total > 0 ? Math.ceil(total / size) : 0));
    response.data = {
        ...response.data,
        items,
        total: Number.isFinite(total) && total >= 0 ? total : items.length,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        size: Number.isFinite(size) && size > 0 ? size : 20,
        totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0,
        hasNext: Boolean(response.data?.hasNext ?? page < totalPages),
        hasPrevious: Boolean(response.data?.hasPrevious ?? page > 1),
    };
    return response as AxiosResponse<SiteAnnouncementAdminPage>;
};

const normalizeAdminSupportSessionPageResponse = (
    response: AxiosResponse<SupportAdminSessionPage | SupportSession[]>
): AxiosResponse<SupportAdminSessionPage> => {
    if (Array.isArray(response.data)) {
        const items = response.data.map(normalizeAdminSupportSession);
        response.data = {
            items,
            total: items.length,
            page: 1,
            size: Math.max(1, items.length || 20),
            totalPages: items.length ? 1 : 0,
            hasNext: false,
            hasPrevious: false,
        };
        return response as AxiosResponse<SupportAdminSessionPage>;
    }
    const items = Array.isArray(response.data?.items)
        ? response.data.items.map(normalizeAdminSupportSession)
        : [];
    const total = Number(response.data?.total ?? items.length);
    const page = Number(response.data?.page || 1);
    const size = Number(response.data?.size || Math.max(1, items.length || 20));
    const totalPages = Number(response.data?.totalPages ?? (total > 0 ? Math.ceil(total / size) : 0));
    response.data = {
        ...response.data,
        items,
        total: Number.isFinite(total) && total >= 0 ? total : items.length,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        size: Number.isFinite(size) && size > 0 ? size : 20,
        totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : 0,
        hasNext: Boolean(response.data?.hasNext ?? page < totalPages),
        hasPrevious: Boolean(response.data?.hasPrevious ?? page > 1),
    };
    return response as AxiosResponse<SupportAdminSessionPage>;
};

const normalizeAdminSupportSession = (
    session: SupportSession & { contextKey?: unknown }
): SupportSession => {
    const { contextKey: _contextKey, ...safeSession } = session || {};
    return safeSession as SupportSession;
};

const clearAdminQuestionCache = () => {
    adminQuestionCache.clear();
    adminQuestionRequests.clear();
    clearAdminDashboardCache();
};

const clearUserScopedCaches = () => {
    clearAdminPermissionsCache();
    clearAdminDashboardCache();
    clearAdminRoleCache();
    clearAdminUserCache();
    clearAdminOrderCache();
    clearAdminReviewCache();
    clearAdminQuestionCache();
    clearPetProfileCache();
    clearPersonalizedRecommendationCache();
    clearNotificationCache();
    clearCouponCache();
    clearAddressCache();
    clearOrderItemsCache();
    clearPetGalleryCache();
    clearReviewCache();
    clearOrderTrackCache();
    logisticsTrackCache.clear();
    logisticsTrackRequests.clear();
};

export const clearAdminPermissionsCache = () => {
    adminPermissionsCache = null;
    adminPermissionsRequest = null;
};

let refreshTokenRequest: Promise<string | null> | null = null;

const clearAuthSession = () => {
    removeStoredItems(AUTH_SESSION_STORAGE_KEYS);
    clearUserScopedCaches();
    dispatchAuthSessionChanged();
};

export const clearStoredAuthSession = clearAuthSession;

const redirectToLogin = () => {
    if (window.location.pathname !== '/login') {
        window.location.href = buildLoginUrl(getCurrentRelativeUrl(window.location));
    }
};

export const persistAuthSession = (data: AuthSessionResponse) => {
    const token = normalizeTextParam(data?.token, 2048);
    const refreshToken = normalizeTextParam(data?.refreshToken, 512);
    if (!token || !refreshToken) return null;

    const currentScope = currentUserCacheKey();
    const nextScope = userCacheKeyFrom(data.id, token);
    const currentRole = normalizeTextParam(getStoredItem('role'), 80);
    const nextRole = getEffectiveRole(data.role, data.roleCode);
    const shouldClearUserCaches = currentScope !== nextScope || (nextRole && currentRole !== nextRole);
    if (shouldClearUserCaches) {
        clearUserScopedCaches();
        removeStoredItems(AUTH_SESSION_STORAGE_KEYS);
    } else {
        clearAdminPermissionsCache();
        removeStoredItems(AUTH_SESSION_STORAGE_KEYS.filter((key) => key !== 'adminDefaultPath'));
    }
    setStoredItem('token', token);
    setStoredItem('refreshToken', refreshToken);
    if (data.id !== undefined && data.id !== null) {
        setStoredItem('userId', String(data.id));
    }
    const username = normalizeTextParam(data.username, 120);
    if (username) {
        setStoredItem('username', username);
    }
    if (nextRole) {
        setStoredItem('role', nextRole);
    }
    dispatchAuthSessionChanged();
    return token;
};

const refreshAuthToken = () => {
    const refreshToken = normalizeTextParam(getStoredItem('refreshToken'), 512);
    if (!refreshToken) return Promise.resolve(null);
    if (!refreshTokenRequest) {
        refreshTokenRequest = api.post<AuthSessionResponse>('/auth/refresh', { refreshToken }, { skipAuthRefresh: true, skipAuthHeader: true } as AuthRetryConfig)
            .then((response) => persistAuthSession(response.data))
            .catch(() => null)
            .finally(() => {
                refreshTokenRequest = null;
            });
    }
    return refreshTokenRequest;
};

const applyAuthorizationHeader = (config: AuthRetryConfig, token: string) => {
    const mutableConfig = config as AuthRetryConfig & { headers?: any };
    const headers = (mutableConfig.headers || {}) as Record<string, unknown> & { set?: (name: string, value: string) => void };
    if (typeof headers.set === 'function') {
        headers.set('Authorization', `Bearer ${token}`);
        mutableConfig.headers = headers;
        return;
    }
    mutableConfig.headers = { ...headers, Authorization: `Bearer ${token}` };
};

const removeAuthorizationHeader = (config: AuthRetryConfig) => {
    const headers = config.headers;
    if (headers instanceof AxiosHeaders) {
        headers.delete('Authorization');
        headers.delete('authorization');
        return;
    }
    const mutableHeaders = { ...(headers || {}) } as Record<string, unknown>;
    delete mutableHeaders.Authorization;
    delete mutableHeaders.authorization;
    config.headers = mutableHeaders as AuthRetryConfig['headers'];
};

// 请求拦截器
api.interceptors.request.use(
    async (config) => {
        config.url = resolveApiDispatcherUrl(config.url);
        const authConfig = config as AuthRetryConfig;
        let token = getStoredItem('token');
        if (token && !authConfig.skipAuthHeader && !authConfig.skipAuthRefresh && isJwtExpiring(token)) {
            token = await refreshAuthToken();
        }
        if (token && !authConfig.skipAuthHeader) {
            applyAuthorizationHeader(config as AuthRetryConfig, token);
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
    async (error: AxiosError) => {
        const originalRequest = error.config as AuthRetryConfig | undefined;
        if (originalRequest && shouldRetryTransientError(error, originalRequest)) {
            originalRequest._transientRetryCount = (originalRequest._transientRetryCount || 0) + 1;
            await sleep(TRANSIENT_RETRY_DELAYS_MS[originalRequest._transientRetryCount - 1]);
            return api.request(originalRequest);
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
            if (originalRequest && (originalRequest.allowAnonymousRetry || isPublicGetRequest(originalRequest)) && !originalRequest._anonymousRetry) {
                originalRequest._anonymousRetry = true;
                removeAuthorizationHeader(originalRequest);
                originalRequest.skipAuthRefresh = true;
                originalRequest.skipAuthHeader = true;
                originalRequest.skipAuthRedirect = true;
                return api.request(originalRequest);
            }
            if (error.response.status === 403) {
                return Promise.reject(error);
            }
            if (originalRequest?.skipAuthRedirect) {
                return Promise.reject(error);
            }
            if (originalRequest && !originalRequest.skipAuthRefresh && !originalRequest._authRetry) {
                originalRequest._authRetry = true;
                const token = await refreshAuthToken();
                if (token) {
                    applyAuthorizationHeader(originalRequest, token);
                    return api.request(originalRequest);
                }
            }
            clearAuthSession();
            redirectToLogin();
        }
        return Promise.reject(error);
    }
);

// 用户相关 API
export const userApi = {
    register: (user: Partial<User> & { emailCode?: string }) => api.post('/auth/register', {
        username: normalizeLoginParam(user.username, 50),
        email: normalizeEmailParam(user.email) || '',
        phone: normalizePhoneParam(user.phone, 20),
        password: String(user.password || ''),
        emailCode: normalizeEmailCodeParam(user.emailCode),
    }, anonymousRequestConfig()),
    login: (username: string, password: string) =>
        api.post('/auth/login', { username: normalizeLoginParam(username, 120), password }, anonymousRequestConfig()),
    sendEmailLoginCode: (email: string) => api.post('/auth/email-code', { email: normalizeEmailParam(email) || '' }, anonymousRequestConfig()),
    sendPasswordResetCode: (email: string) => api.post('/auth/password-reset-code', { email: normalizeEmailParam(email) || '' }, anonymousRequestConfig()),
    emailLogin: (email: string, code: string) =>
        api.post('/auth/email-login', { email: normalizeEmailParam(email) || '', code: normalizeEmailCodeParam(code) }, anonymousRequestConfig()),
    logout: (refreshToken?: string | null) => api.post('/auth/logout', {
        refreshToken: normalizeTextParam(refreshToken, 512),
    }),
    forgotPassword: (payload: { login: string; email: string; code: string; newPassword: string }) =>
        api.post('/auth/forgot-password', {
            login: normalizeLoginParam(payload.login, 120),
            email: normalizeEmailParam(payload.email) || '',
            code: normalizeEmailCodeParam(payload.code),
            newPassword: String(payload.newPassword || ''),
        }, anonymousRequestConfig()),
    getProfile: () => api.get<UserProfile>('/users/profile'),
    sendProfileEmailCode: (email: string) => api.post('/users/profile/email-code', { email: normalizeEmailParam(email) || '' }),
    updateProfile: (user: Partial<User> & { emailCode?: string }) => api.put('/users/profile', {
        email: normalizeEmailParam(user.email) || '',
        phone: normalizePhoneParam(user.phone, 20),
        emailCode: normalizeEmailCodeParam(user.emailCode),
    }),
    updatePassword: (oldPassword: string, newPassword: string) =>
        api.put('/users/password', { oldPassword, newPassword })
};

type ProductListFilters = {
    minPrice?: number;
    maxPrice?: number;
    petSizes?: string[];
    materials?: string[];
    colors?: string[];
    collection?: string;
    sort?: string;
    page?: number;
    size?: number;
};

// 商品相关 API
export const productApi = {
    getAll: (keyword?: string, categoryId?: number, discount?: boolean, filters?: ProductListFilters, options?: ApiRequestOptions) => {
        const normalizedKeyword = normalizeTextParam(keyword, 120);
        const normalizedCategoryId = normalizePositiveInt(categoryId);
        const normalizedPetSizes = normalizeStringListParam(filters?.petSizes, 12, 40);
        const normalizedMaterials = normalizeStringListParam(filters?.materials, 12, 40);
        const normalizedColors = normalizeStringListParam(filters?.colors, 12, 40);
        const normalizedCollection = normalizeTextParam(filters?.collection, 40);
        const normalizedMinPrice = filters?.minPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.minPrice);
        const normalizedMaxPrice = filters?.maxPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.maxPrice);
        const normalizedSort = normalizeTextParam(filters?.sort, 80);
        const normalizedPage = filters?.page == null ? undefined : normalizeNonNegativeIntParam(filters.page, 0, 1_000_000);
        const normalizedSize = filters?.size == null ? undefined : normalizeBoundedPositiveInt(filters.size, 50, 500);
        const params = new URLSearchParams();
        if (normalizedKeyword) params.append('keyword', normalizedKeyword);
        if (normalizedCategoryId) params.append('categoryId', normalizedCategoryId.toString());
        if (discount) params.append('discount', 'true');
        if (normalizedMinPrice !== undefined) params.append('minPrice', String(normalizedMinPrice));
        if (normalizedMaxPrice !== undefined) params.append('maxPrice', String(normalizedMaxPrice));
        normalizedPetSizes.forEach((value) => params.append('petSize', value));
        normalizedMaterials.forEach((value) => params.append('material', value));
        normalizedColors.forEach((value) => params.append('color', value));
        if (normalizedCollection) params.append('collection', normalizedCollection);
        if (normalizedSort) params.append('sort', normalizedSort);
        if (normalizedPage !== undefined) params.append('page', String(normalizedPage));
        if (normalizedSize !== undefined) params.append('size', String(normalizedSize));
        const query = params.toString();
        const cacheKey = query || '__all__';
        return cachedTypedGet(productListCache, productListRequests, cacheKey, () =>
            api.get<ProductPublicPage | ProductPublic[]>('/products', anonymousGetConfig({
                params,
            }, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    cacheProductListResponse(cacheKey, normalized);
                    return normalized;
                }), options);
    },
    getPage: (keyword?: string, categoryId?: number, discount?: boolean, filters?: ProductListFilters, options?: ApiRequestOptions) => {
        const normalizedKeyword = normalizeTextParam(keyword, 120);
        const normalizedCategoryId = normalizePositiveInt(categoryId);
        const normalizedPetSizes = normalizeStringListParam(filters?.petSizes, 12, 40);
        const normalizedMaterials = normalizeStringListParam(filters?.materials, 12, 40);
        const normalizedColors = normalizeStringListParam(filters?.colors, 12, 40);
        const normalizedCollection = normalizeTextParam(filters?.collection, 40);
        const normalizedMinPrice = filters?.minPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.minPrice);
        const normalizedMaxPrice = filters?.maxPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.maxPrice);
        const normalizedSort = normalizeTextParam(filters?.sort, 80);
        const normalizedPage = filters?.page == null ? 0 : normalizeNonNegativeIntParam(filters.page, 0, 1_000_000);
        const normalizedSize = filters?.size == null ? 12 : normalizeBoundedPositiveInt(filters.size, 12, 500);
        const params = new URLSearchParams();
        if (normalizedKeyword) params.append('keyword', normalizedKeyword);
        if (normalizedCategoryId) params.append('categoryId', normalizedCategoryId.toString());
        if (discount) params.append('discount', 'true');
        if (normalizedMinPrice !== undefined) params.append('minPrice', String(normalizedMinPrice));
        if (normalizedMaxPrice !== undefined) params.append('maxPrice', String(normalizedMaxPrice));
        normalizedPetSizes.forEach((value) => params.append('petSize', value));
        normalizedMaterials.forEach((value) => params.append('material', value));
        normalizedColors.forEach((value) => params.append('color', value));
        if (normalizedCollection) params.append('collection', normalizedCollection);
        if (normalizedSort) params.append('sort', normalizedSort);
        params.append('page', String(normalizedPage));
        params.append('size', String(normalizedSize));
        const cacheKey = params.toString();
        return cachedTypedGet(productPageCache, productPageRequests, cacheKey, () =>
            api.get<ProductPublicPage | ProductPublic[]>('/products', anonymousGetConfig({
                params,
            }, options))
                .then((response) => {
                    const normalized = normalizeProductPublicPageResponse(response);
                    cacheProductPageResponse(cacheKey, normalized);
                    return normalized;
                }), options);
    },
    getFinderCandidates: (keywords: string[] = [], limit = 36, options?: ApiRequestOptions) => {
        const normalizedKeywords = normalizeStringListParam(keywords, 12, 80);
        const normalizedLimit = normalizeBoundedPositiveInt(limit, 36, 60);
        const cacheKey = `finder:${normalizedKeywords.join(',')}:${normalizedLimit}`;
        const params = new URLSearchParams();
        normalizedKeywords.forEach((keyword) => params.append('keywords', keyword));
        params.append('limit', String(normalizedLimit));
        return cachedTypedGet(productListCache, productListRequests, cacheKey, () =>
            api.get<ProductPublic[]>('/products/finder-candidates', anonymousGetConfig({ params }, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    cacheProductListResponse(cacheKey, normalized);
                    return normalized;
                }), options);
    },
    getById: (id: number, options?: ApiRequestOptions) => {
        const productId = normalizePositiveInt(id);
        if (!productId) return Promise.reject(new Error('Invalid product id'));
        return cachedTypedGet(productDetailCache, productDetailRequests, productId, () =>
            api.get<ProductPublic>(`/products/${productId}`, anonymousGetConfig(undefined, options))
                .then((response) => {
                    setTimedCacheEntry(productDetailCache, productId, {
                        response,
                        expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                    });
                    return response;
                }), options);
    },
    prefetchById: (id: number, options?: ApiRequestOptions) => {
        const productId = normalizePositiveInt(id);
        if (!productId) return Promise.resolve();
        const cached = productDetailCache.get(productId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve();
        return cachedTypedGet(productDetailCache, productDetailRequests, productId, () =>
            api.get<ProductPublic>(`/products/${productId}`, anonymousGetConfig(undefined, options))
                .then((response) => {
                    setTimedCacheEntry(productDetailCache, productId, {
                        response,
                        expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                    });
                    return response;
                }), options).then(() => undefined).catch(() => undefined);
    },
    getByIds: (ids: number[], options?: ApiRequestOptions) => {
        const uniqueIds = normalizePositiveIntList(ids, 40);
        if (uniqueIds.length === 0) {
            return Promise.resolve({ data: [] } as unknown as AxiosResponse<ProductPublic[]>);
        }
        const cacheKey = uniqueIds.join(',');
        const params = new URLSearchParams();
        uniqueIds.forEach((id) => params.append('ids', String(id)));
        return cachedTypedGet(productByIdsCache, productByIdsRequests, cacheKey, () =>
            api.get<ProductPublic[]>('/products/by-ids', anonymousGetConfig({ params }, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    setTimedCacheEntry(productByIdsCache, cacheKey, {
                        response: normalized,
                        expiresAt: Date.now() + PRODUCT_DETAIL_CACHE_MS,
                    });
                    cacheProductDetailFromList(normalized);
                    return normalized;
                }), options);
    },
    getFeatured: (limitOrOptions?: number | ApiRequestOptions, maybeOptions?: ApiRequestOptions) => {
        const limit = typeof limitOrOptions === 'number'
            ? normalizeBoundedPositiveInt(limitOrOptions, 12, 36)
            : 12;
        const options = typeof limitOrOptions === 'number' ? maybeOptions : limitOrOptions;
        const cacheKey = `__featured__:${limit}`;
        return cachedTypedGet(productListCache, productListRequests, cacheKey, () =>
            api.get<ProductPublic[]>('/products/featured', anonymousGetConfig({ params: { limit } }, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    cacheProductListResponse(cacheKey, normalized);
                    return normalized;
                }), options);
    },
    getPersonalizedRecommendations: (options?: ApiRequestOptions) => {
        const cacheKey = `personalized:${currentUserCacheKey()}`;
        return cachedTypedGet(personalizedRecommendationCache, personalizedRecommendationRequests, cacheKey, () =>
            api.get<ProductPublic[]>('/products/personalized-recommendations', optionalAnonymousGetConfig(undefined, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    setTimedCacheEntry(personalizedRecommendationCache, cacheKey, {
                        response: normalized,
                        expiresAt: Date.now() + PERSONALIZED_RECOMMENDATION_CACHE_MS,
                    });
                    cacheProductDetailFromList(normalized);
                    return normalized;
                }), options);
    },
    getAddOnCandidates: (targetAmount: number, excludedIds: number[] = [], limit = 3, options?: ApiRequestOptions) => {
        const params = new URLSearchParams();
        const normalizedTargetAmount = Number(targetAmount);
        const normalizedLimit = Number(limit);
        params.append('targetAmount', String(Number.isFinite(normalizedTargetAmount) ? Math.max(0, normalizedTargetAmount) : 0));
        params.append('limit', String(Number.isFinite(normalizedLimit) ? Math.max(1, Math.min(Math.floor(normalizedLimit), 8)) : 3));
        normalizePositiveIntList(excludedIds, 40).forEach((id) => {
            params.append('excludedIds', String(id));
        });
        const cacheKey = params.toString();
        return cachedTypedGet(productAddOnCache, productAddOnRequests, cacheKey, () =>
            api.get<ProductPublic[]>('/products/add-on-candidates', anonymousGetConfig({ params }, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    setTimedCacheEntry(productAddOnCache, cacheKey, {
                        response: normalized,
                        expiresAt: Date.now() + PRODUCT_ADD_ON_CACHE_MS,
                    });
                    cacheProductDetailFromList(normalized);
                    return normalized;
                }), options);
    },
    create: (product: Partial<Product>) => api.post<Product>('/products', normalizeProductPayload(product)).finally(() => clearProductCache()),
    update: (id: number, product: Partial<Product>) => api.put<Product>(`/products/${toPathId(id)}`, normalizeProductPayload(product)).finally(() => clearProductCache(toPathId(id))),
    delete: (id: number) => api.delete(`/products/${toPathId(id)}`).finally(() => clearProductCache(toPathId(id))),
    getRecommendations: (id: number, options?: ApiRequestOptions) => {
        const productId = normalizePositiveInt(id);
        if (!productId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<ProductPublic[]>);
        return cachedTypedGet(productRecommendationsCache, productRecommendationsRequests, productId, () =>
            api.get<ProductPublic[]>(`/products/${productId}/recommendations`, anonymousGetConfig(undefined, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    setTimedCacheEntry(productRecommendationsCache, productId, {
                        response: normalized,
                        expiresAt: Date.now() + PRODUCT_LIST_CACHE_MS,
                    });
                    cacheProductDetailFromList(normalized);
                    return normalized;
                }), options);
    }
};

// 购物车相关 API
export const cartApi = {
    getItems: (_userId: number) => api.get<CartItem[]>('/cart/me').then(withArrayData),
    addItem: (_userId: number, productId: number, quantity: number, selectedSpecs?: string) =>
        api.post('/cart/me/add', null, {
            params: {
                productId: toPathId(productId),
                quantity: normalizeQuantityParam(quantity),
                selectedSpecs: selectedSpecs ? normalizeTextParam(selectedSpecs, MAX_SELECTED_SPECS_LENGTH) : undefined,
            },
        }),
    updateQuantity: (cartItemId: number, quantity: number) =>
        api.put('/cart/update', null, { params: { cartItemId: toPathId(cartItemId), quantity: normalizeQuantityParam(quantity) } }),
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
    getAll: () => api.get<OrderCustomer[]>('/orders').then(withArrayData),
    getById: (id: number, guestEmail?: string, orderNo?: string) => api.get<OrderCustomer>(guestOrderPath(id, guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo, {
        params: guestParams(guestEmail, orderNo),
    })),
    getByUser: (_userId: number) => api.get<OrderCustomer[]>('/orders/me').then(withArrayData),
    getMine: () => api.get<OrderCustomer[]>('/orders/me').then(withArrayData),
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
        const request = api.post<OrderTrackResult>('/orders/track', {
            orderNo: normalizedOrderNo,
            email: normalizedEmail,
        }, anonymousRequestConfig())
            .then((response) => {
                setTimedCacheEntry(orderTrackCache, cacheKey, {
                    response,
                    expiresAt: Date.now() + ORDER_TRACK_CACHE_MS,
                });
                return response;
            })
            .finally(() => orderTrackRequests.delete(cacheKey));
        setBoundedMapEntry(orderTrackRequests, cacheKey, request);
        return request;
    },
    create: (order: Partial<Order>) => api.post<OrderCustomer>('/orders', order),
    checkout: (payload: { cartItemIds: number[]; shippingAddress: string; paymentMethod: string; userCouponId?: number | null; recipientName?: string; recipientPhone?: string; contactEmail?: string }) =>
        api.post<OrderCustomer>('/orders/checkout/me', {
            cartItemIds: normalizePositiveIntList(payload.cartItemIds, 100),
            shippingAddress: normalizeTextParam(payload.shippingAddress, 1000),
            recipientName: normalizeTextParam(payload.recipientName, 120),
            recipientPhone: normalizeTextParam(payload.recipientPhone, 60),
            contactEmail: normalizeEmailParam(payload.contactEmail),
            paymentMethod: normalizeTextParam(payload.paymentMethod, 40),
            userCouponId: normalizePositiveInt(payload.userCouponId) || null,
        }),
    guestCheckout: (payload: {
        guestEmail: string;
        guestName: string;
        guestPhone: string;
        shippingAddress: string;
        paymentMethod: string;
        items: Array<{ productId: number; quantity: number; selectedSpecs?: string }>;
    }) => {
        const guestEmail = normalizeEmailParam(payload.guestEmail);
        if (!guestEmail) {
            return Promise.reject(new Error('Guest email is required'));
        }
        return api.post<OrderCustomer>('/orders/checkout/guest', {
            guestEmail,
            guestName: normalizeTextParam(payload.guestName, 120),
            guestPhone: normalizeTextParam(payload.guestPhone, 60),
            shippingAddress: normalizeTextParam(payload.shippingAddress, 1000),
            paymentMethod: normalizeTextParam(payload.paymentMethod, 40),
            items: normalizeGuestCheckoutItems(payload.items),
        });
    },
    update: (id: number, order: Partial<Order>) => api.put<Order>(`/orders/${toPathId(id)}`, order),
    delete: (id: number) => api.delete(`/orders/${toPathId(id)}`),
    cancel: (id: number, guestEmail?: string, orderNo?: string) =>
        api.put(`${guestOrderPath(id, guestEmail, orderNo)}/cancel`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo))
            .finally(clearOrderTrackCache),
    confirm: (id: number, guestEmail?: string, orderNo?: string) =>
        api.put(`${guestOrderPath(id, guestEmail, orderNo)}/confirm`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo))
            .finally(clearOrderTrackCache),
    returnOrder: (id: number, reason?: string, guestEmail?: string, orderNo?: string) => {
        const credentials = guestParams(guestEmail, orderNo);
        return api.put(`${guestOrderPath(id, guestEmail, orderNo)}/return`, {
            reason: normalizeTextParam(reason, 1000),
            ...(credentials || {}),
        }, guestRequestConfig(guestEmail, orderNo)).finally(clearOrderTrackCache);
    },
    submitReturnShipment: (id: number, returnTrackingNumber: string, guestEmail?: string, orderNo?: string) => {
        const credentials = guestParams(guestEmail, orderNo);
        return api.put(`${guestOrderPath(id, guestEmail, orderNo)}/return-shipment`, {
            returnTrackingNumber: normalizeTextParam(returnTrackingNumber, 120),
            ...(credentials || {}),
        }, guestRequestConfig(guestEmail, orderNo)).finally(clearOrderTrackCache);
    },
    pay: (id: number) => api.put(`/orders/${toPathId(id)}/pay`),
    ship: (id: number) => api.put(`/orders/${toPathId(id)}/ship`),
    getItems: (orderId: number, guestEmail?: string, orderNo?: string) => {
        const normalizedOrderId = normalizePositiveInt(orderId);
        if (!normalizedOrderId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<OrderItemCustomer[]>);
        const guestKey = hasGuestCredentials(guestEmail, orderNo) ? `guest:${normalizeEmailParam(guestEmail)}:${normalizeOrderTrackingNumber(orderNo || '')}` : `auth:${currentUserCacheKey()}`;
        const cacheKey = `${normalizedOrderId}:${guestKey}`;
        const cached = orderItemsCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = orderItemsRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<OrderItemCustomer[]>(`${hasGuestCredentials(guestEmail, orderNo) ? `/orders/guest/${normalizedOrderId}` : `/orders/${normalizedOrderId}`}/items`, guestRequestConfig(guestEmail, orderNo, {
            params: guestParams(guestEmail, orderNo),
        }))
            .then((response) => {
                const normalized = withArrayData(response);
                setTimedCacheEntry(orderItemsCache, cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + ORDER_ITEMS_CACHE_MS,
                });
                return normalized;
            })
            .finally(() => orderItemsRequests.delete(cacheKey));
        setBoundedMapEntry(orderItemsRequests, cacheKey, request);
        return request;
    },
    addItem: (orderId: number, item: Partial<OrderItem>) => {
        const normalizedOrderId = toPathId(orderId);
        return api.post(`/orders/${normalizedOrderId}/items`, item).finally(() => clearOrderItemsCache(normalizedOrderId));
    },
};

export const couponApi = {
    getPublic: () => cachedGet(publicCouponCache, publicCouponRequests, 'public', COUPON_CACHE_MS, () => api.get<CouponPublic[]>('/coupons/public', anonymousGetConfig()).then(withArrayData)),
    claim: (couponId: number, _userId: number) => api.post<UserCoupon>(`/coupons/me/${toPathId(couponId)}/claim`).finally(clearCouponCache),
    getByUser: (_userId: number) => cachedGet(userCouponCache, userCouponRequests, `mine:${currentUserCacheKey()}`, COUPON_CACHE_MS, () => api.get<UserCoupon[]>('/coupons/me').then(withArrayData)),
    getAvailableByUser: (_userId: number) => cachedGet(userCouponCache, userCouponRequests, `available:${currentUserCacheKey()}`, COUPON_CACHE_MS, () => api.get<UserCoupon[]>('/coupons/me/available').then(withArrayData)),
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
        paymentChannelRequest = api.get<PaymentChannel[]>('/payments/channels', anonymousGetConfig())
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
    create: (orderId: number, channel: string, guestEmail?: string, orderNo?: string) => api.post<PaymentCustomer>('/payments', {
        orderId: toPathId(orderId),
        channel: normalizeTextParam(channel, 40).toUpperCase(),
        ...(hasGuestCredentials(guestEmail, orderNo) ? guestParams(guestEmail, orderNo) : {}),
    }, guestRequestConfig(guestEmail, orderNo)),
    simulatePaid: (paymentId: number) => api.post<AdminPayment>(`/payments/${toPathId(paymentId)}/simulate-paid`),
    simulateCallback: (paymentId: number) => api.post<AdminPayment>(`/payments/${toPathId(paymentId)}/simulate-callback`),
    sync: (paymentId: number, guestEmail?: string, orderNo?: string) => api.post<PaymentCustomer>(`/payments/${toPathId(paymentId)}/sync`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo)),
    callback: (payload: {
        orderNo: string;
        channel: string;
        transactionId: string;
        status: string;
        amount: number;
        callbackTimestamp: number;
        signature: string;
    }) => api.post<{ received: boolean }>('/payments/callback', payload),
    getByOrder: (orderId: number, guestEmail?: string, orderNo?: string) =>
        api.get<PaymentCustomer[]>(paymentOrderPath(orderId, guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo, { params: guestParams(guestEmail, orderNo) })).then(withArrayData),
    getLatestByOrder: (orderId: number, guestEmail?: string, orderNo?: string) =>
        api.get<PaymentCustomer>(`${paymentOrderPath(orderId, guestEmail, orderNo)}/latest`, guestRequestConfig(guestEmail, orderNo, { params: guestParams(guestEmail, orderNo) })),
};

// 评价相关 API
export const reviewApi = {
    getAll: (productId: number) => {
        const normalizedProductId = normalizePositiveInt(productId);
        if (!normalizedProductId) return Promise.resolve({ data: { reviews: [], averageRating: 0 } } as unknown as AxiosResponse<ProductReviewSummary>);
        const hasToken = Boolean(getStoredItem('token'));
        if (hasToken) {
            return api.get<ProductReviewSummary>(`/reviews/product/${normalizedProductId}`, optionalAnonymousGetConfig());
        }
        const cached = reviewCache.get(normalizedProductId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = reviewRequests.get(normalizedProductId);
        if (pending) return pending;
        const request = api.get<ProductReviewSummary>(`/reviews/product/${normalizedProductId}`, anonymousGetConfig())
            .then((response) => {
                setTimedCacheEntry(reviewCache, normalizedProductId, { response, expiresAt: Date.now() + REVIEW_CACHE_MS });
                return response;
            })
            .finally(() => reviewRequests.delete(normalizedProductId));
        setBoundedMapEntry(reviewRequests, normalizedProductId, request);
        return request;
    },
    getReviewableOrders: (productId: number) => api.get<ReviewableOrder[]>(`/reviews/product/${toPathId(productId)}/reviewable-orders`).then(withArrayData),
    create: (productId: number, orderId: number, rating: number, comment: string) =>
        api.post<PublicReview>(`/reviews/product/${toPathId(productId)}`, {
            orderId: toPathId(orderId),
            rating: Math.max(1, Math.min(5, Math.floor(Number(rating) || 0))),
            comment: normalizeTextParam(comment, 2000),
        }).finally(() => clearReviewCache(toPathId(productId))),
};

export const questionApi = {
    getByProduct: (productId: number) => {
        const normalizedProductId = normalizePositiveInt(productId);
        if (!normalizedProductId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<ProductQuestionPublic[]>);
        const cached = questionCache.get(normalizedProductId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = questionRequests.get(normalizedProductId);
        if (pending) return pending;
        const request = api.get<ProductQuestionPublic[]>(`/product-questions/product/${normalizedProductId}`, anonymousGetConfig())
            .then((response) => {
                const normalized = withArrayData(response);
                setTimedCacheEntry(questionCache, normalizedProductId, { response: normalized, expiresAt: Date.now() + QUESTION_CACHE_MS });
                return normalized;
            })
            .finally(() => questionRequests.delete(normalizedProductId));
        setBoundedMapEntry(questionRequests, normalizedProductId, request);
        return request;
    },
    ask: (productId: number, question: string) =>
        api.post<ProductQuestionPublic>(`/product-questions/product/${toPathId(productId)}`, { question: normalizeTextParam(question, MAX_PRODUCT_QUESTION_LENGTH) })
            .finally(() => clearQuestionCache(toPathId(productId))),
};

export const categoryApi = {
    getAll: (params?: { parentId?: number; level?: number }) => {
        const normalizedParams = params ? {
            parentId: normalizePositiveInt(params.parentId) || undefined,
            level: normalizePositiveInt(params.level) || undefined,
        } : undefined;
        const cacheKey = `all:${normalizedParams?.parentId || ''}:${normalizedParams?.level || ''}`;
        return cachedGet(categoryCache, categoryRequests, cacheKey, CATEGORY_CACHE_MS, () => api.get<CategoryPublic[]>('/categories', anonymousGetConfig({ params: normalizedParams })).then(withArrayData));
    },
    getTopLevel: () => cachedGet(categoryCache, categoryRequests, 'top', CATEGORY_CACHE_MS, () => api.get<CategoryPublic[]>('/categories', anonymousGetConfig({ params: { level: 1 } })).then(withArrayData)),
    getChildren: (parentId: number) => {
        const normalizedParentId = normalizePositiveInt(parentId);
        if (!normalizedParentId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<CategoryPublic[]>);
        return cachedGet(categoryCache, categoryRequests, `children:${normalizedParentId}`, CATEGORY_CACHE_MS, () =>
            api.get<CategoryPublic[]>('/categories', anonymousGetConfig({ params: { parentId: normalizedParentId } })).then(withArrayData));
    },
    getById: (id: number) => api.get<CategoryPublic>(`/categories/${toPathId(id)}`, anonymousGetConfig()),
    create: (category: Partial<Category>) => api.post<Category>('/categories', normalizeCategoryPayload(category)).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    update: (id: number, category: Partial<Category>) => api.put<Category>(`/categories/${toPathId(id)}`, normalizeCategoryPayload(category)).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    delete: (id: number) => api.delete(`/categories/${toPathId(id)}`).finally(() => {
        clearCategoryCache();
        clearProductCache();
    })
};

export const brandApi = {
    getAll: (_params?: { activeOnly?: boolean }) => {
        const cacheKey = 'public-active';
        return cachedGet(brandCache, brandRequests, cacheKey, BRAND_CACHE_MS, () =>
            api.get<BrandPublic[]>('/brands', anonymousGetConfig()).then(withArrayData));
    },
    create: (brand: Partial<Brand>) => api.post<Brand>('/brands', normalizeBrandPayload(brand)).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
    update: (id: number, brand: Partial<Brand>) => api.put<Brand>(`/brands/${toPathId(id)}`, normalizeBrandPayload(brand)).finally(() => {
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
    getPetGalleryPhotos: (params?: { page?: number; size?: number; status?: string; source?: string; keyword?: string }) => {
        const normalizedParams = {
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 12, 100),
            status: normalizeTextParam(params?.status, 40) || undefined,
            source: normalizeTextParam(params?.source, 40) || undefined,
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
        };
        return api.get<AdminPetGalleryPage | AdminPetGalleryPhoto[]>('/admin/pet-gallery', { params: normalizedParams })
            .then(normalizeAdminPetGalleryPageResponse);
    },
    deletePetGalleryPhoto: (id: number) => api.delete(`/admin/pet-gallery/${toPathId(id)}`).finally(clearPetGalleryCache),
    getUsersPage: (params?: { keyword?: string; role?: string; status?: string; page?: number; size?: number }) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        const cacheKey = `${normalizedParams.keyword || ''}:${normalizedParams.role || ''}:${normalizedParams.status || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(adminUserCache, adminUserRequests, cacheKey, ADMIN_USER_CACHE_MS, () =>
            api.get<AdminUserPage | User[]>('/admin/users', { params: normalizedParams }).then(normalizeAdminUserPageResponse));
    },
    getUsers: (params?: { keyword?: string; role?: string; status?: string }) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
            page: 1,
            size: 100,
        };
        const cacheKey = `${normalizedParams.keyword || ''}:${normalizedParams.role || ''}:${normalizedParams.status || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(adminUserCache, adminUserRequests, cacheKey, ADMIN_USER_CACHE_MS, () =>
            api.get<AdminUserPage | User[]>('/admin/users', { params: normalizedParams }).then(normalizeAdminUserPageResponse))
            .then((response) => ({ ...response, data: response.data.items }) as AxiosResponse<User[]>);
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
    updateUser: (id: number, user: Partial<User>) => api.put(`/admin/users/${toPathId(id)}`, normalizeAdminUserUpdatePayload(user))
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
    saveRole: (role: Partial<AdminRole>) => api.post<AdminRole>('/admin/roles', normalizeAdminRolePayload(role))
        .then((response) => {
            clearAdminRoleCache();
            clearAdminUserCache();
            clearAdminPermissionsCache();
            dispatchDomEvent('shop:admin-permissions-updated');
            return response;
        }),
    getMyPermissions: (options?: { bypassCache?: boolean }) => {
        if (options?.bypassCache) {
            clearAdminPermissionsCache();
        }
        if (!options?.bypassCache && adminPermissionsCache && adminPermissionsCache.expiresAt > Date.now()) {
            return Promise.resolve(adminPermissionsCache.response);
        }
        if (!options?.bypassCache && adminPermissionsRequest) return adminPermissionsRequest;
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
            adminOrderCache,
            adminOrderRequests,
            `page-compat:${normalizedStatus || ''}`,
            ADMIN_ORDER_CACHE_MS,
            () => api.get<AdminOrderPage>('/admin/orders/page', {
                params: { status: normalizedStatus, page: 1, size: 20 },
            }),
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
            adminOrderCache,
            adminOrderRequests,
            cacheKey,
            ADMIN_ORDER_CACHE_MS,
            () => api.get<AdminOrderPage>('/admin/orders/page', { params: normalizedParams }),
        );
    },
    getOrder: (id: number) => api.get<Order>(`/admin/orders/${toPathId(id)}`),
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
    getOrderItems: (orderId: number) => api.get<OrderItem[]>(`/admin/orders/${toPathId(orderId)}/items`).then(withArrayData),
    getOrderPayments: (orderId: number) => api.get<AdminPayment[]>(`/admin/orders/${toPathId(orderId)}/payments`).then(withArrayData),
    syncOrderPayment: (paymentId: number) => api.post<AdminPayment>(`/admin/orders/payments/${toPathId(paymentId)}/sync`),
    getProducts: (params?: { keyword?: string; q?: string; categoryId?: number; status?: string; featured?: boolean; discount?: boolean; minPrice?: number; maxPrice?: number; page?: number; size?: number; sort?: string }) =>
        api.get<AdminProductPage | Product[]>('/admin/products', {
            params: params ? {
                keyword: normalizeTextParam(params.keyword, 120) || undefined,
                q: normalizeTextParam(params.q, 120) || undefined,
                categoryId: normalizePositiveInt(params.categoryId) || undefined,
                status: normalizeTextParam(params.status, 40).toUpperCase() || undefined,
                featured: params.featured,
                discount: params.discount,
                minPrice: params.minPrice == null ? undefined : normalizeNonNegativeNumberParam(params.minPrice),
                maxPrice: params.maxPrice == null ? undefined : normalizeNonNegativeNumberParam(params.maxPrice),
                page: params.page == null ? undefined : normalizeNonNegativeIntParam(params.page, 0, 1_000_000),
                size: params.size == null ? undefined : normalizeBoundedPositiveInt(params.size, 50, 500),
                sort: normalizeTextParam(params.sort, 80) || undefined,
            } : undefined,
        }).then(normalizeProductAdminPageResponse),
    createProduct: (product: Partial<Product>) =>
        api.post<Product>('/admin/products', normalizeProductPayload(product)).finally(() => clearProductCache()),
    updateProduct: (id: number, product: Partial<Product>) =>
        api.put<Product>(`/admin/products/${toPathId(id)}`, normalizeProductPayload(product)).finally(() => clearProductCache(toPathId(id))),
    deleteProduct: (id: number) =>
        api.delete(`/admin/products/${toPathId(id)}`).finally(() => clearProductCache(toPathId(id))),
    getCategories: () => api.get<Category[]>('/admin/categories').then(withArrayData),
    createCategory: (category: Partial<Category>) => api.post<Category>('/admin/categories', normalizeCategoryPayload(category)).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    updateCategory: (id: number, category: Partial<Category>) => api.put<Category>(`/admin/categories/${toPathId(id)}`, normalizeCategoryPayload(category)).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    deleteCategory: (id: number) => api.delete(`/admin/categories/${toPathId(id)}`).finally(() => {
        clearCategoryCache();
        clearProductCache();
    }),
    getBrands: (params?: { activeOnly?: boolean }) =>
        api.get<Brand[]>('/admin/brands', { params: params?.activeOnly ? { activeOnly: true } : undefined }),
    createBrand: (brand: Partial<Brand>) => api.post<Brand>('/admin/brands', normalizeBrandPayload(brand)).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
    updateBrand: (id: number, brand: Partial<Brand>) => api.put<Brand>(`/admin/brands/${toPathId(id)}`, normalizeBrandPayload(brand)).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
    deleteBrand: (id: number) => api.delete(`/admin/brands/${toPathId(id)}`).finally(() => {
        clearBrandCache();
        clearProductCache();
    }),
    refundOrder: (id: number, payload: { reason?: string; restock?: boolean; manualRefundReference?: string }) =>
        api.post<{ message: string; payment: AdminPayment }>(`/admin/orders/${toPathId(id)}/refund`, {
            reason: normalizeTextParam(payload.reason, 1000) || undefined,
            restock: Boolean(payload.restock),
            manualRefundReference: normalizeTextParam(payload.manualRefundReference, 128) || undefined,
        }).finally(clearAdminOrderCache),
    batchShipOrders: (orderIds: number[], trackingPrefix: string, trackingCarrierCode?: string) =>
        api.post<AdminOrderBatchShipResponse>('/admin/orders/batch-ship', {
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
        return api.post<ProductImportResult>('/admin/products/import', formData).finally(() => clearProductCache());
    },
    previewImportProducts: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<ProductImportResult>('/admin/products/import/preview', formData);
    },
    getProductImportHistory: (limit = 6) =>
        api.get<ProductImportHistoryEntry[]>('/admin/products/import/history', {
            params: { limit: normalizeBoundedPositiveInt(limit, 6, 20) },
        }).then(withArrayData),
    importProductFromUrl: (url: string) =>
        api.post<ProductUrlImportPreview>('/admin/products/import-url', { url: normalizeTextParam(url, 2048) }),
    getReviews: (params?: { status?: string; search?: string; page?: number; size?: number }) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        const cacheKey = `reviews:${normalizedParams.status || ''}:${normalizedParams.search || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(adminReviewCache, adminReviewRequests, cacheKey, ADMIN_REVIEW_CACHE_MS, () =>
            api.get<AdminReviewPage | Review[]>('/admin/reviews', { params: normalizedParams }).then(normalizeAdminReviewPageResponse));
    },
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
    getQuestionSummary: (params?: { status?: string; search?: string }) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
        };
        return api.get<ProductQuestionAdminSummary>('/admin/questions/summary', { params: normalizedParams });
    },
    getQuestions: (params?: { status?: string; search?: string; limit?: number }) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
            limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000),
        };
        const cacheKey = `${normalizedParams.status || ''}:${normalizedParams.search || ''}:${normalizedParams.limit}`;
        return cachedGet(adminQuestionCache, adminQuestionRequests, cacheKey, ADMIN_REVIEW_CACHE_MS, () =>
            api.get<ProductQuestion[]>('/admin/questions', { params: normalizedParams }).then(withArrayData));
    },
    answerQuestion: (id: number, answer: string) =>
        api.put<ProductQuestion>(`/admin/questions/${toPathId(id)}/answer`, { answer: normalizeTextParam(answer, 1000) })
            .finally(() => {
                clearQuestionCache();
                clearAdminQuestionCache();
            }),
    deleteQuestion: (id: number) => api.delete(`/admin/questions/${toPathId(id)}`)
        .finally(() => {
            clearQuestionCache();
            clearAdminQuestionCache();
        }),
    getCouponSummary: (params?: { keyword?: string; status?: string; scope?: string }) => api.get<CouponAdminSummary>('/admin/coupons/summary', {
        params: {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            scope: normalizeTextParam(params?.scope, 40).toUpperCase() || undefined,
        },
    }),
    getCoupons: (params?: { keyword?: string; status?: string; scope?: string; page?: number; size?: number }) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            scope: normalizeTextParam(params?.scope, 40).toUpperCase() || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 500),
        };
        return api.get<AdminCouponPage | Coupon[]>('/admin/coupons', { params: normalizedParams })
            .then(normalizeAdminCouponPageResponse);
    },
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
    getAnnouncementSummary: (params?: { status?: string; keyword?: string }) => api.get<SiteAnnouncementAdminSummary>('/admin/announcements/summary', {
        params: {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
        },
    }),
    getAnnouncements: (params?: { page?: number; size?: number; status?: string; keyword?: string }) => {
        const normalizedParams = {
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
        };
        const config = params ? { params: normalizedParams } : undefined;
        return api.get<SiteAnnouncementAdminPage | SiteAnnouncement[]>('/admin/announcements', config)
            .then(normalizeSiteAnnouncementPageResponse);
    },
    createAnnouncement: (announcement: Partial<SiteAnnouncement>) => api.post<SiteAnnouncement>('/admin/announcements', normalizeAnnouncementPayload(announcement)),
    updateAnnouncement: (id: number, announcement: Partial<SiteAnnouncement>) => api.put<SiteAnnouncement>(`/admin/announcements/${toPathId(id)}`, normalizeAnnouncementPayload(announcement)),
    deleteAnnouncement: (id: number) => api.delete(`/admin/announcements/${toPathId(id)}`),
};

export const logisticsCarrierApi = {
    getAll: (activeOnly?: boolean) => {
        const cacheKey = activeOnly ? 'active' : 'all';
        return cachedGet(logisticsCarrierCache, logisticsCarrierRequests, cacheKey, LOGISTICS_CARRIER_CACHE_MS, () =>
            api.get<LogisticsCarrier[]>('/admin/logistics-carriers', { params: activeOnly ? { activeOnly: true } : undefined }).then(withArrayData));
    },
    create: (carrier: LogisticsCarrierWritePayload) => api.post<LogisticsCarrier>('/admin/logistics-carriers', normalizeLogisticsCarrierPayload(carrier)).finally(clearLogisticsCarrierCache),
    update: (id: number, carrier: LogisticsCarrierWritePayload) => api.put<LogisticsCarrier>(`/admin/logistics-carriers/${toPathId(id)}`, normalizeLogisticsCarrierPayload(carrier)).finally(clearLogisticsCarrierCache),
    delete: (id: number) => api.delete(`/admin/logistics-carriers/${toPathId(id)}`).finally(clearLogisticsCarrierCache),
};

export const addressApi = {
    getByUser: (_userId: number) =>
        cachedGet(addressCache as Map<string, { expiresAt: number; response: AxiosResponse<UserAddress[]> }>, addressRequests as Map<string, Promise<AxiosResponse<UserAddress[]>>>, `list:${currentUserCacheKey()}`, ADDRESS_CACHE_MS, () => api.get<UserAddress[]>('/addresses/me').then(withArrayData)),
    getById: (id: number) => api.get<UserAddress>(`/addresses/${toPathId(id)}`),
    getDefault: (_userId: number) =>
        cachedGet(addressCache as Map<string, { expiresAt: number; response: AxiosResponse<UserAddress> }>, addressRequests as Map<string, Promise<AxiosResponse<UserAddress>>>, `default:${currentUserCacheKey()}`, ADDRESS_CACHE_MS, () => api.get<UserAddress>('/addresses/me/default')),
    create: (address: Partial<UserAddress>) => api.post<UserAddress>('/addresses', normalizeAddressPayload(address)).finally(clearAddressCache),
    update: (id: number, address: Partial<UserAddress>) => api.put<UserAddress>(`/addresses/${toPathId(id)}`, normalizeAddressPayload(address)).finally(clearAddressCache),
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
    getByUser: (_userId = 0, force = false, page = 1, size = 50) => {
        const normalizedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
        const normalizedSize = Number.isSafeInteger(size) && size > 0 ? Math.min(size, 100) : 50;
        const cacheKey = `list:${currentUserCacheKey()}:${normalizedPage}:${normalizedSize}`;
        if (!force) {
            const cached = notificationCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<AppNotification[]> } | undefined;
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
            const pending = notificationRequests.get(cacheKey) as Promise<AxiosResponse<AppNotification[]>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<AppNotification[]>('/notifications/me', { params: { page: normalizedPage, size: normalizedSize } })
            .then((response) => {
                const normalized = withArrayData(response);
                setTimedCacheEntry(notificationCache, cacheKey, { response: normalized, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return normalized;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        setBoundedMapEntry(notificationRequests, cacheKey, request);
        return request;
    },
    getUnreadCount: (_userId = 0, force = false) => {
        const cacheKey = `unread:${currentUserCacheKey()}`;
        if (!force) {
            const cached = notificationCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<{ count: number }> } | undefined;
            if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
            const pending = notificationRequests.get(cacheKey) as Promise<AxiosResponse<{ count: number }>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<{ count: number }>('/notifications/me/unread-count')
            .then((response) => {
                setTimedCacheEntry(notificationCache, cacheKey, { response, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return response;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        setBoundedMapEntry(notificationRequests, cacheKey, request);
        return request;
    },
    markAsRead: (id: number, userId?: number) => api.put(`/notifications/${toPathId(id)}/read`).finally(() => clearNotificationCache(userId)),
    markAllAsRead: () => api.put('/notifications/me/read-all').finally(() => clearNotificationCache()),
    delete: (id: number, userId?: number) => api.delete(`/notifications/${toPathId(id)}`).finally(() => clearNotificationCache(userId)),
};

export const petProfileApi = {
    getMine: () => {
        const cacheKey = currentUserCacheKey();
        const cached = petProfileCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.response);
        }
        const pending = petProfileRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<PetProfile[]>('/pet-profiles')
            .then((response) => {
                const normalized = withArrayData(response);
                setTimedCacheEntry(petProfileCache, cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PET_PROFILE_CACHE_MS,
                });
                return normalized;
            })
            .finally(() => {
                petProfileRequests.delete(cacheKey);
            });
        setBoundedMapEntry(petProfileRequests, cacheKey, request);
        return request;
    },
    create: (payload: Partial<PetProfile>) => api.post<PetProfile>('/pet-profiles', normalizePetProfilePayload(payload)).finally(() => {
        clearPetProfileCache();
        clearPersonalizedRecommendationCache();
    }),
    update: (id: number, payload: Partial<PetProfile>) => api.put<PetProfile>(`/pet-profiles/${toPathId(id)}`, normalizePetProfilePayload(payload)).finally(() => {
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
        const hasToken = Boolean(getStoredItem('token'));
        const cacheKey = hasToken ? `photos:auth:${currentUserCacheKey()}` : 'photos:anon';
        if (!force) {
            const cached = petGalleryCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<PetGalleryPhotoPublic[]> } | undefined;
            if (cached && cached.expiresAt > Date.now()) {
                return Promise.resolve(cached.response);
            }
            const pending = petGalleryRequests.get(cacheKey) as Promise<AxiosResponse<PetGalleryPhotoPublic[]>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<PetGalleryPhotoPublic[]>('/pet-gallery', hasToken ? optionalAnonymousGetConfig() : anonymousGetConfig())
            .then((response) => {
                const normalized = withArrayData(response);
                setTimedCacheEntry(petGalleryCache, cacheKey, {
                    response: normalized,
                    expiresAt: Date.now() + PET_GALLERY_CACHE_MS,
                });
                return normalized;
            })
            .finally(() => petGalleryRequests.delete(cacheKey));
        setBoundedMapEntry(petGalleryRequests, cacheKey, request);
        return request;
    },
    getQuota: (force = false) => {
        const cacheKey = `quota:${currentUserCacheKey()}`;
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
                setTimedCacheEntry(petGalleryCache, cacheKey, {
                    response,
                    expiresAt: Date.now() + PET_GALLERY_CACHE_MS,
                });
                return response;
            })
            .finally(() => petGalleryRequests.delete(cacheKey));
        setBoundedMapEntry(petGalleryRequests, cacheKey, request);
        return request;
    },
    like: (id: number) => api.post<PetGalleryPhotoPublic>(`/pet-gallery/${toPathId(id)}/like`).finally(clearPetGalleryCache),
    delete: (id: number) => api.delete(`/pet-gallery/${toPathId(id)}`).finally(clearPetGalleryCache),
    upload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<PetGalleryPhotoPublic>('/pet-gallery', formData).finally(clearPetGalleryCache);
    },
};

export const logisticsApi = {
    track: (trackingNumber: string, carrier?: string, orderId?: number, guestEmail?: string, orderNo?: string) => {
        const normalizedTrackingNumber = normalizeTextParam(trackingNumber, 120);
        const normalizedCarrier = normalizeTextParam(carrier, 40) || undefined;
        const normalizedOrderId = normalizePositiveInt(orderId) || undefined;
        if (!normalizedTrackingNumber && !normalizedOrderId) {
            return Promise.reject(new Error('Tracking number or order id is required'));
        }
        const credentials = guestParams(guestEmail, orderNo);
        const params = {
            trackingNumber: normalizedTrackingNumber,
            carrier: normalizedCarrier,
            orderId: normalizedOrderId,
            ...credentials,
        };
        const accessCacheKey = credentials
            ? `guest:${credentials.guestEmail}:${credentials.orderNo}`
            : normalizedOrderId
                ? `auth:${currentUserCacheKey()}`
                : `auth:${currentUserCacheKey()}`;
        const cacheKey = [
            params.trackingNumber,
            params.carrier || '',
            params.orderId || '',
            accessCacheKey,
        ].join(':');
        const requestConfig = credentials
            ? anonymousGetConfig({ params })
            : normalizedOrderId
                ? { params, allowAnonymousRetry: false } as AuthRetryConfig
                : { params, allowAnonymousRetry: false } as AuthRetryConfig;
        return cachedGet(logisticsTrackCache, logisticsTrackRequests, cacheKey, LOGISTICS_TRACK_CACHE_MS, () =>
            api.get<LogisticsTrackResponse>('/logistics/track', requestConfig));
    },
};

type SupportMessageQuery = { limit?: number; afterId?: number };
type SupportSessionQuery = { limit?: number };
type AdminSupportSessionQuery = {
    status?: string;
    needsReply?: boolean;
    assignedAdminId?: number;
    search?: string;
    page?: number;
    size?: number;
};

const normalizeSupportMessageParams = (options?: SupportMessageQuery) => {
    const limit = Math.min(normalizePositiveInt(options?.limit) || 80, 120);
    const afterId = normalizePositiveInt(options?.afterId) || undefined;
    return { limit, afterId };
};

const normalizeSupportSessionParams = (options?: SupportSessionQuery) => {
    const limit = Math.min(normalizePositiveInt(options?.limit) || 12, 30);
    return { limit };
};

const normalizeAdminSupportSessionParams = (input?: string | AdminSupportSessionQuery) => {
    const options: AdminSupportSessionQuery = typeof input === 'string' ? { status: input } : (input || {});
    const status = normalizeTextParam(options.status, 40).toUpperCase() || undefined;
    return {
        status: status && status !== 'ALL' ? status : undefined,
        needsReply: options.needsReply ? true : undefined,
        assignedAdminId: normalizePositiveInt(options.assignedAdminId) || undefined,
        search: normalizeTextParam(options.search, 120) || undefined,
        page: normalizeBoundedPositiveInt(options.page, 1, 100000),
        size: normalizeBoundedPositiveInt(options.size, 20, 50),
    };
};

export const supportApi = {
    getSession: () => api.get<SupportSessionCustomer>('/support/session'),
    createSession: () => api.post<SupportSessionCustomer>('/support/session'),
    getSessions: (options?: SupportSessionQuery) =>
        api.get<SupportSessionCustomer[]>('/support/sessions', { params: normalizeSupportSessionParams(options) }),
    getMessages: (sessionId: number, options?: SupportMessageQuery) =>
        api.get<SupportMessageCustomer[]>(`/support/sessions/${toPathId(sessionId)}/messages`, { params: normalizeSupportMessageParams(options) }),
    sendMessage: (content: string, sessionId?: number) =>
        api.post<{ message: SupportMessageCustomer; session: SupportSessionCustomer }>('/support/messages', { content, sessionId: normalizePositiveInt(sessionId) || undefined }),
    markRead: (sessionId: number) => api.put(`/support/sessions/${toPathId(sessionId)}/read`),
    closeSession: (sessionId: number) => api.put<SupportSessionCustomer>(`/support/sessions/${toPathId(sessionId)}/close`),
    getUnreadCount: () => api.get<{ count: number }>('/support/unread-count'),
    getGuestSession: (orderNo: string, email: string) => api.get<SupportSessionCustomer>('/support/guest/session', anonymousGetConfig({
        params: { orderNo: normalizeOrderTrackingNumber(orderNo), email: normalizeEmailParam(email) || '' },
    })),
    createGuestSession: (orderNo: string, email: string) => api.post<SupportSessionCustomer>('/support/guest/session', {
        orderNo: normalizeOrderTrackingNumber(orderNo),
        email: normalizeEmailParam(email) || '',
    }, anonymousRequestConfig()),
    getGuestMessages: (sessionId: number, orderNo: string, email: string, options?: SupportMessageQuery) => api.get<SupportMessageCustomer[]>(`/support/guest/sessions/${toPathId(sessionId)}/messages`, anonymousGetConfig({
        params: {
            orderNo: normalizeOrderTrackingNumber(orderNo),
            email: normalizeEmailParam(email) || '',
            ...normalizeSupportMessageParams(options),
        },
    })),
    sendGuestMessage: (content: string, orderNo: string, email: string, sessionId?: number) =>
        api.post<{ message: SupportMessageCustomer; session: SupportSessionCustomer }>('/support/guest/messages', {
            content: String(content || '').slice(0, 4000),
            sessionId: normalizePositiveInt(sessionId) || undefined,
            orderNo: normalizeOrderTrackingNumber(orderNo),
            email: normalizeEmailParam(email) || '',
        }, anonymousRequestConfig()),
    markGuestRead: (sessionId: number, orderNo: string, email: string) => api.put(`/support/guest/sessions/${toPathId(sessionId)}/read`, {
        orderNo: normalizeOrderTrackingNumber(orderNo),
        email: normalizeEmailParam(email) || '',
    }, anonymousRequestConfig()),
};

export const adminSupportApi = {
    getSummary: () => api.get<SupportAdminSummary>('/admin/support/summary'),
    getSessions: (params?: string | AdminSupportSessionQuery) =>
        api.get<SupportAdminSessionPage | SupportSession[]>('/admin/support/sessions', {
            params: normalizeAdminSupportSessionParams(params),
        }).then(normalizeAdminSupportSessionPageResponse),
    getMessages: (sessionId: number, options?: SupportMessageQuery) =>
        api.get<SupportMessage[]>(`/admin/support/sessions/${toPathId(sessionId)}/messages`, { params: normalizeSupportMessageParams(options) }),
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
