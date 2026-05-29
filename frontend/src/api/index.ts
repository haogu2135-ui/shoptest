import axios, { AxiosHeaders } from 'axios';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { User, UserAdminSummary, Product, Category, Brand, CartItem, Order, OrderItem, Review, DashboardStats, UserAddress, WishlistItem, AppNotification, Payment, AdminPayment, PaymentChannel, ProductImportResult, ProductImportHistoryEntry, ProductUrlImportPreview, ProductQuestion, ProductQuestionAdminSummary, SupportSession, SupportAdminSummary, SupportMessage, Coupon, CouponAdminSummary, UserCoupon, CouponQuote, LogisticsTrackResponse, PetProfile, LogisticsCarrier, PetGalleryPhoto, PetGalleryQuota, AppConfig, SecurityAuditLog, SecurityAuditPurgeResponse, SecurityAuditSummary, AdminRole, PetBirthdayCouponConfig, AdminOrderPage, AdminReviewPage, AdminOrderBatchShipResponse, AdminRegistryStatus, AdminSystemStatus, AdminConfigCenterPublishRequest, AdminConfigCenterSnapshot, AdminLogDebugRequest, AdminLogManagementStatus, AdminTrafficControlStatus, SystemAlert, SystemAlertBatchActionResponse, SystemAlertPurgeResponse, SystemAlertSummary, IpBlacklistEntry, IpBlacklistBatchReleaseResponse, IpBlacklistStatus, SiteAnnouncement, SiteAnnouncementAdminSummary, MembershipPlan, MembershipStatus } from '../types';
import { buildLoginUrl, getCurrentRelativeUrl } from '../utils/authRedirect';
import { AUTH_SESSION_STORAGE_KEYS, dispatchAuthSessionChanged } from '../utils/authEvents';
import { resolveApiDispatcherUrl } from '../utils/apiDispatcher';
import { dispatchDomEvent } from '../utils/domEvents';
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
    userId: address.userId === undefined ? undefined : normalizePositiveInt(address.userId) || undefined,
    recipientName: normalizeTextParam(address.recipientName, 80),
    phone: normalizeTextParam(address.phone, 30),
    address: normalizeTextParam(address.address, 500),
    isDefault: address.isDefault === undefined ? undefined : Boolean(address.isDefault),
});

const normalizeCategoryPayload = (category: Partial<Category>) => ({
    name: normalizeTextParam(category.name, 255),
    parentId: category.parentId === undefined || category.parentId === null ? null : normalizePositiveInt(category.parentId) || null,
    imageUrl: category.imageUrl === undefined || category.imageUrl === null ? null : normalizeTextParam(category.imageUrl, 2048),
    description: category.description === undefined || category.description === null ? null : normalizeTextParam(category.description, 1000),
    localizedContent: category.localizedContent ?? null,
});

const normalizeBrandPayload = (brand: Partial<Brand>) => ({
    name: normalizeTextParam(brand.name, 100),
    description: brand.description === undefined || brand.description === null ? null : normalizeTextParam(brand.description, 1000),
    logoUrl: brand.logoUrl === undefined || brand.logoUrl === null ? null : normalizeTextParam(brand.logoUrl, 1000),
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
        return {
            type: allowedTypes.has(type) ? type : 'text',
            content: normalizeTextParam(rawBlock.content, 5000) || undefined,
            url: normalizeTextParam(rawBlock.url, 2048) || undefined,
            caption: normalizeTextParam(rawBlock.caption, 300) || undefined,
        };
    });
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
            imageUrl: normalizeTextParam(rawVariant.imageUrl, 2048) || undefined,
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
    if (hasOwn(product, 'imageUrl')) payload.imageUrl = normalizeNullableProductValue(product.imageUrl, (value) => normalizeTextParam(value, 2048)) as Product['imageUrl'];
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
    if (hasOwn(product, 'images')) payload.images = normalizeNullableProductValue(product.images, (value) => normalizeStringListParam(value, 40, 2048)) as Product['images'];
    if (hasOwn(product, 'specifications')) payload.specifications = normalizeNullableProductValue(product.specifications, normalizeProductSpecifications) as Product['specifications'];
    if (hasOwn(product, 'detailContent')) payload.detailContent = normalizeNullableProductValue(product.detailContent, normalizeProductDetailContent) as Product['detailContent'];
    if (hasOwn(product, 'variants')) payload.variants = normalizeNullableProductValue(product.variants, normalizeProductVariants) as Product['variants'];
    return payload;
};

type ProductReviewSummary = {
    reviews: Review[];
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
    skipAuthRefresh?: boolean;
    skipAuthHeader?: boolean;
    skipAuthRedirect?: boolean;
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
    '/orders/track',
    '/logistics/track',
]);

const hasRequestParam = (config: AxiosRequestConfig, name: string) => {
    const params = config.params;
    if (params instanceof URLSearchParams) {
        const value = params.get(name);
        return value !== null && value !== '';
    }
    if (params && typeof params === 'object') {
        const value = (params as Record<string, unknown>)[name];
        return value !== undefined && value !== null && String(value) !== '';
    }
    const rawUrl = String(config.url || '');
    const query = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
    return query ? new URLSearchParams(query).has(name) : false;
};

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
    if (path === '/logistics/track' && hasRequestParam(config, 'orderId')) {
        return false;
    }
    if (PUBLIC_GET_PATHS.has(path)) return true;
    return PUBLIC_GET_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
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
const orderItemsCache = new Map<string, { expiresAt: number; response: AxiosResponse<OrderItem[]> }>();
const orderItemsRequests = new Map<string, Promise<AxiosResponse<OrderItem[]>>>();
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
    if (!text || !/^[\[{]/.test(text)) return value;
    try {
        return JSON.parse(text);
    } catch {
        return value;
    }
};

const normalizeProductImages = (product: Product) => {
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

const normalizeProductPageData = (data: unknown): Product[] => {
    if (Array.isArray(data)) return data.map(normalizeProduct);
    const content = (data as { content?: unknown; items?: unknown })?.content
        ?? (data as { items?: unknown })?.items;
    return Array.isArray(content) ? content.map(normalizeProduct) : [];
};

const normalizeProduct = (product: Product): Product => ({
    ...product,
    images: normalizeProductImages(product),
    imageUrl: (typeof product.imageUrl === 'string' && product.imageUrl.trim()) || normalizeProductImages(product)[0] || '',
    specifications: normalizeProductMap((product as any).specifications),
    detailContent: normalizeProductListField((product as any).detailContent),
    variants: normalizeProductListField((product as any).variants),
    optionGroups: normalizeProductListField((product as any).optionGroups),
    bundle: product.bundle && typeof product.bundle === 'object' ? product.bundle : null,
    localizedContent: product.localizedContent && typeof product.localizedContent === 'object' ? product.localizedContent : null,
});

const withProductArrayData = (response: AxiosResponse<Product[]>): AxiosResponse<Product[]> => ({
    ...response,
    data: normalizeProductPageData(response.data),
});

const cacheProductDetailFromList = (response: AxiosResponse<Product[]>) => {
    const expiresAt = Date.now() + PRODUCT_DETAIL_CACHE_MS;
    response.data.forEach((product) => {
        if (!product.id) return;
        setTimedCacheEntry(productDetailCache, product.id, {
            response: { ...response, data: product } as unknown as AxiosResponse<Product>,
            expiresAt,
        });
    });
};

const cacheProductListResponse = (cacheKey: string, response: AxiosResponse<Product[]>, ttlMs = PRODUCT_LIST_CACHE_MS) => {
    setTimedCacheEntry(productListCache, cacheKey, {
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
    getActive: (limit = 5, options?: ApiRequestOptions) => api.get<SiteAnnouncement[]>('/announcements/active', anonymousGetConfig({ params: { limit: normalizeBoundedPositiveInt(limit, 5, 10) } }, options)).then(withArrayData),
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

const clearAdminQuestionCache = () => {
    adminQuestionCache.clear();
    adminQuestionRequests.clear();
    clearAdminDashboardCache();
};

export const clearAdminPermissionsCache = () => {
    adminPermissionsCache = null;
    adminPermissionsRequest = null;
};

let refreshTokenRequest: Promise<string | null> | null = null;

const clearAuthSession = () => {
    removeStoredItems(AUTH_SESSION_STORAGE_KEYS);
    clearAdminPermissionsCache();
    clearPetProfileCache();
    clearPersonalizedRecommendationCache();
    clearNotificationCache();
    dispatchAuthSessionChanged();
};

const redirectToLogin = () => {
    if (window.location.pathname !== '/login') {
        window.location.href = buildLoginUrl(getCurrentRelativeUrl(window.location));
    }
};

export const persistAuthSession = (data: AuthSessionResponse) => {
    const token = normalizeTextParam(data?.token, 2048);
    const refreshToken = normalizeTextParam(data?.refreshToken, 512);
    if (!token || !refreshToken) return null;

    removeStoredItems(['adminDefaultPath']);
    setStoredItem('token', token);
    setStoredItem('refreshToken', refreshToken);
    if (data.id !== undefined && data.id !== null) {
        setStoredItem('userId', String(data.id));
    }
    const username = normalizeTextParam(data.username, 120);
    if (username) {
        setStoredItem('username', username);
    }
    const effectiveRole = getEffectiveRole(data.role, data.roleCode);
    if (effectiveRole) {
        setStoredItem('role', effectiveRole);
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
        if (error.response?.status === 401 || error.response?.status === 403) {
            const originalRequest = error.config as AuthRetryConfig | undefined;
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
    register: (user: Partial<User>) => api.post('/auth/register', {
        username: normalizeLoginParam(user.username, 50),
        email: normalizeEmailParam(user.email) || '',
        phone: normalizePhoneParam(user.phone, 20),
        password: String(user.password || ''),
    }, anonymousRequestConfig()),
    login: (username: string, password: string) =>
        api.post('/auth/login', { username: normalizeLoginParam(username, 120), password }, anonymousRequestConfig()),
    sendEmailLoginCode: (email: string) => api.post('/auth/email-code', { email: normalizeEmailParam(email) || '' }, anonymousRequestConfig()),
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
    getProfile: () => api.get<User>('/users/profile'),
    sendProfileEmailCode: (email: string) => api.post('/users/profile/email-code', { email: normalizeEmailParam(email) || '' }),
    updateProfile: (user: Partial<User> & { emailCode?: string }) => api.put('/users/profile', {
        email: normalizeEmailParam(user.email) || '',
        phone: normalizePhoneParam(user.phone, 20),
        emailCode: normalizeEmailCodeParam(user.emailCode),
    }),
    updatePassword: (oldPassword: string, newPassword: string) =>
        api.put('/users/password', { oldPassword, newPassword })
};

// 商品相关 API
export const productApi = {
    getAll: (keyword?: string, categoryId?: number, discount?: boolean, options?: ApiRequestOptions) => {
        const normalizedKeyword = normalizeTextParam(keyword, 120);
        const normalizedCategoryId = normalizePositiveInt(categoryId);
        const params = new URLSearchParams();
        if (normalizedKeyword) params.append('keyword', normalizedKeyword);
        if (normalizedCategoryId) params.append('categoryId', normalizedCategoryId.toString());
        if (discount) params.append('discount', 'true');
        const query = params.toString();
        const cacheKey = query || '__all__';
        return cachedTypedGet(productListCache, productListRequests, cacheKey, () =>
            api.get<Product[]>('/products', anonymousGetConfig({
                params: {
                    ...(normalizedKeyword ? { keyword: normalizedKeyword } : {}),
                    ...(normalizedCategoryId ? { categoryId: normalizedCategoryId } : {}),
                    ...(discount ? { discount: true } : {}),
                },
            }, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    cacheProductListResponse(cacheKey, normalized);
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
            api.get<Product[]>('/products/finder-candidates', anonymousGetConfig({ params }, options))
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
            api.get<Product>(`/products/${productId}`, anonymousGetConfig(undefined, options))
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
            api.get<Product>(`/products/${productId}`, anonymousGetConfig(undefined, options))
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
            return Promise.resolve({ data: [] } as unknown as AxiosResponse<Product[]>);
        }
        const cacheKey = uniqueIds.join(',');
        const params = new URLSearchParams();
        uniqueIds.forEach((id) => params.append('ids', String(id)));
        return cachedTypedGet(productByIdsCache, productByIdsRequests, cacheKey, () =>
            api.get<Product[]>('/products/by-ids', anonymousGetConfig({ params }, options))
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
    getFeatured: (options?: ApiRequestOptions) => {
        const cacheKey = '__featured__';
        return cachedTypedGet(productListCache, productListRequests, cacheKey, () =>
            api.get<Product[]>('/products/featured', anonymousGetConfig(undefined, options))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    cacheProductListResponse(cacheKey, normalized);
                    return normalized;
                }), options);
    },
    getPersonalizedRecommendations: (options?: ApiRequestOptions) => {
        const token = getStoredItem('token') || '';
        const cacheKey = `personalized:${token.slice(-16) || 'guest'}`;
        return cachedTypedGet(personalizedRecommendationCache, personalizedRecommendationRequests, cacheKey, () =>
            api.get<Product[]>('/products/personalized-recommendations', optionalAnonymousGetConfig(undefined, options))
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
            api.get<Product[]>('/products/add-on-candidates', anonymousGetConfig({ params }, options))
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
        if (!productId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<Product[]>);
        return cachedTypedGet(productRecommendationsCache, productRecommendationsRequests, productId, () =>
            api.get<Product[]>(`/products/${productId}/recommendations`, anonymousGetConfig(undefined, options))
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
    quoteGuestItems: (items: Array<{ id: number; productId: number; quantity: number; selectedSpecs?: string }>) =>
        api.post<CartItem[]>('/cart/guest/quote', {
            items: items
                .map((item) => ({
                    id: normalizeSafeInt(item.id),
                    productId: normalizePositiveInt(item.productId),
                    quantity: normalizeQuantityParam(item.quantity),
                    selectedSpecs: item.selectedSpecs ? normalizeTextParam(item.selectedSpecs, MAX_SELECTED_SPECS_LENGTH) : undefined,
                }))
                .filter((item) => item.id !== null && item.productId !== null)
                .map((item) => ({
                    id: item.id as number,
                    productId: item.productId as number,
                    quantity: item.quantity,
                    selectedSpecs: item.selectedSpecs,
                }))
                .slice(0, 100),
        }).then(withArrayData),
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
    getAll: () => api.get<Order[]>('/orders').then(withArrayData),
    getById: (id: number, guestEmail?: string, orderNo?: string) => api.get<Order>(guestOrderPath(id, guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo, {
        params: guestParams(guestEmail, orderNo),
    })),
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
        const request = api.get<{ order: Order; items: OrderItem[] }>('/orders/track', anonymousGetConfig({
            params: { orderNo: normalizedOrderNo, email: normalizedEmail },
        }))
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
    create: (order: Partial<Order>) => api.post<Order>('/orders', order),
    checkout: (payload: { cartItemIds: number[]; shippingAddress: string; paymentMethod: string; userCouponId?: number | null; recipientName?: string; recipientPhone?: string; contactEmail?: string }) =>
        api.post<Order>('/orders/checkout/me', {
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
    }) => api.post<Order>('/orders/checkout/guest', {
        guestEmail: normalizeEmailParam(payload.guestEmail) || '',
        guestName: normalizeTextParam(payload.guestName, 120),
        guestPhone: normalizeTextParam(payload.guestPhone, 60),
        shippingAddress: normalizeTextParam(payload.shippingAddress, 1000),
        paymentMethod: normalizeTextParam(payload.paymentMethod, 40),
        items: normalizeGuestCheckoutItems(payload.items),
    }),
    update: (id: number, order: Partial<Order>) => api.put<Order>(`/orders/${toPathId(id)}`, order),
    delete: (id: number) => api.delete(`/orders/${toPathId(id)}`),
    cancel: (id: number, guestEmail?: string, orderNo?: string) => api.put(`${guestOrderPath(id, guestEmail, orderNo)}/cancel`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo)),
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
        if (!normalizedOrderId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<OrderItem[]>);
        const guestKey = hasGuestCredentials(guestEmail, orderNo) ? `${normalizeEmailParam(guestEmail)}:${normalizeOrderTrackingNumber(orderNo || '')}` : 'auth';
        const cacheKey = `${normalizedOrderId}:${guestKey}`;
        const cached = orderItemsCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = orderItemsRequests.get(cacheKey);
        if (pending) return pending;
        const request = api.get<OrderItem[]>(`${hasGuestCredentials(guestEmail, orderNo) ? `/orders/guest/${normalizedOrderId}` : `/orders/${normalizedOrderId}`}/items`, guestRequestConfig(guestEmail, orderNo, {
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
    getPublic: () => cachedGet(publicCouponCache, publicCouponRequests, 'public', COUPON_CACHE_MS, () => api.get<Coupon[]>('/coupons/public', anonymousGetConfig()).then(withArrayData)),
    claim: (couponId: number, _userId: number) => api.post<UserCoupon>(`/coupons/me/${toPathId(couponId)}/claim`).finally(clearCouponCache),
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
    create: (orderId: number, channel: string, guestEmail?: string, orderNo?: string) => api.post<Payment>('/payments', {
        orderId: toPathId(orderId),
        channel: normalizeTextParam(channel, 40).toUpperCase(),
        ...(hasGuestCredentials(guestEmail, orderNo) ? guestParams(guestEmail, orderNo) : {}),
    }, guestRequestConfig(guestEmail, orderNo)),
    simulatePaid: (paymentId: number) => api.post<Payment>(`/payments/${toPathId(paymentId)}/simulate-paid`),
    simulateCallback: (paymentId: number) => api.post<Payment>(`/payments/${toPathId(paymentId)}/simulate-callback`),
    sync: (paymentId: number, guestEmail?: string, orderNo?: string) => api.post<Payment>(`/payments/${toPathId(paymentId)}/sync`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo)),
    callback: (payload: {
        orderNo: string;
        channel: string;
        transactionId: string;
        status: string;
        amount: number;
        callbackTimestamp: number;
        signature: string;
    }) => api.post<Payment>('/payments/callback', payload),
    getByOrder: (orderId: number, guestEmail?: string, orderNo?: string) =>
        api.get<Payment[]>(paymentOrderPath(orderId, guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo, { params: guestParams(guestEmail, orderNo) })).then(withArrayData),
    getLatestByOrder: (orderId: number, guestEmail?: string, orderNo?: string) =>
        api.get<Payment>(`${paymentOrderPath(orderId, guestEmail, orderNo)}/latest`, guestRequestConfig(guestEmail, orderNo, { params: guestParams(guestEmail, orderNo) })),
};

export const membershipApi = {
    getPlans: () => api.get<MembershipPlan[]>('/membership/plans', anonymousGetConfig()).then(withArrayData),
    getMine: () => api.get<MembershipStatus>('/membership/me'),
    getMineOptional: () => api.get<MembershipStatus>('/membership/me', { skipAuthRedirect: true } as AuthRetryConfig),
    createOrder: (planCode: string, paymentMethod: string) => api.post<Order>('/membership/orders', {
        planCode: normalizeTextParam(planCode, 50).toUpperCase(),
        paymentMethod: normalizeTextParam(paymentMethod, 40).toUpperCase(),
    }),
};

// 评价相关 API
export const reviewApi = {
    getAll: (productId: number) => {
        const normalizedProductId = normalizePositiveInt(productId);
        if (!normalizedProductId) return Promise.resolve({ data: { reviews: [], averageRating: 0 } } as unknown as AxiosResponse<ProductReviewSummary>);
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
        const normalizedProductId = normalizePositiveInt(productId);
        if (!normalizedProductId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<ProductQuestion[]>);
        const cached = questionCache.get(normalizedProductId);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = questionRequests.get(normalizedProductId);
        if (pending) return pending;
        const request = api.get<ProductQuestion[]>(`/product-questions/product/${normalizedProductId}`, anonymousGetConfig())
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
        return cachedGet(categoryCache, categoryRequests, cacheKey, CATEGORY_CACHE_MS, () => api.get<Category[]>('/categories', anonymousGetConfig({ params: normalizedParams })).then(withArrayData));
    },
    getTopLevel: () => cachedGet(categoryCache, categoryRequests, 'top', CATEGORY_CACHE_MS, () => api.get<Category[]>('/categories', anonymousGetConfig({ params: { level: 1 } })).then(withArrayData)),
    getChildren: (parentId: number) => {
        const normalizedParentId = normalizePositiveInt(parentId);
        if (!normalizedParentId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<Category[]>);
        return cachedGet(categoryCache, categoryRequests, `children:${normalizedParentId}`, CATEGORY_CACHE_MS, () =>
            api.get<Category[]>('/categories', anonymousGetConfig({ params: { parentId: normalizedParentId } })).then(withArrayData));
    },
    getById: (id: number) => api.get<Category>(`/categories/${toPathId(id)}`, anonymousGetConfig()),
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
    getAll: (params?: { activeOnly?: boolean }) => {
        const cacheKey = 'public-active';
        return cachedGet(brandCache, brandRequests, cacheKey, BRAND_CACHE_MS, () => api.get<Brand[]>('/brands', anonymousGetConfig()).then(withArrayData));
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
    getBrands: (params?: { activeOnly?: boolean }) =>
        api.get<Brand[]>('/admin/brands', { params: params?.activeOnly ? { activeOnly: true } : undefined }),
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
            api.get<AdminReviewPage>('/admin/reviews', { params: normalizedParams }));
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
        api.put<ProductQuestion>(`/admin/questions/${toPathId(id)}/answer`, { answer: normalizeTextParam(answer, 1000) })
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
        cachedGet(addressCache as Map<string, { expiresAt: number; response: AxiosResponse<UserAddress[]> }>, addressRequests as Map<string, Promise<AxiosResponse<UserAddress[]>>>, 'list', ADDRESS_CACHE_MS, () => api.get<UserAddress[]>('/addresses/me').then(withArrayData)),
    getById: (id: number) => api.get<UserAddress>(`/addresses/${toPathId(id)}`),
    getDefault: (_userId: number) =>
        cachedGet(addressCache as Map<string, { expiresAt: number; response: AxiosResponse<UserAddress> }>, addressRequests as Map<string, Promise<AxiosResponse<UserAddress>>>, 'default', ADDRESS_CACHE_MS, () => api.get<UserAddress>('/addresses/me/default')),
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
                setTimedCacheEntry(notificationCache, cacheKey, { response: normalized, expiresAt: Date.now() + NOTIFICATION_CACHE_MS });
                return normalized;
            })
            .finally(() => notificationRequests.delete(cacheKey));
        setBoundedMapEntry(notificationRequests, cacheKey, request);
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
        const cacheKey = 'photos';
        if (!force) {
            const cached = petGalleryCache.get(cacheKey) as { expiresAt: number; response: AxiosResponse<PetGalleryPhoto[]> } | undefined;
            if (cached && cached.expiresAt > Date.now()) {
                return Promise.resolve(cached.response);
            }
            const pending = petGalleryRequests.get(cacheKey) as Promise<AxiosResponse<PetGalleryPhoto[]>> | undefined;
            if (pending) return pending;
        }
        const request = api.get<PetGalleryPhoto[]>('/pet-gallery', anonymousGetConfig())
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
    like: (id: number) => api.post<PetGalleryPhoto>(`/pet-gallery/${toPathId(id)}/like`).finally(clearPetGalleryCache),
    delete: (id: number) => api.delete(`/pet-gallery/${toPathId(id)}`).finally(clearPetGalleryCache),
    upload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<PetGalleryPhoto>('/pet-gallery', formData).finally(clearPetGalleryCache);
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
                ? `auth:${getLocalStorageItem('userId') || 'current'}`
                : 'public';
        const cacheKey = [
            params.trackingNumber,
            params.carrier || '',
            params.orderId || '',
            accessCacheKey,
        ].join(':');
        const requestConfig = credentials
            ? anonymousGetConfig({ params })
            : normalizedOrderId
                ? { params }
                : anonymousGetConfig({ params });
        return cachedGet(logisticsTrackCache, logisticsTrackRequests, cacheKey, LOGISTICS_TRACK_CACHE_MS, () =>
            api.get<LogisticsTrackResponse>('/logistics/track', requestConfig));
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
    getGuestSession: (orderNo: string, email: string) => api.get<SupportSession>('/support/guest/session', anonymousGetConfig({
        params: { orderNo: normalizeOrderTrackingNumber(orderNo), email: normalizeEmailParam(email) || '' },
    })),
    getGuestMessages: (sessionId: number, orderNo: string, email: string) => api.get<SupportMessage[]>(`/support/guest/sessions/${toPathId(sessionId)}/messages`, anonymousGetConfig({
        params: { orderNo: normalizeOrderTrackingNumber(orderNo), email: normalizeEmailParam(email) || '' },
    })),
    sendGuestMessage: (content: string, orderNo: string, email: string, sessionId?: number) =>
        api.post<{ message: SupportMessage; session: SupportSession }>('/support/guest/messages', {
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
