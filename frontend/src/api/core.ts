import axios, { AxiosHeaders } from 'axios';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { User, UserProfile, UserAdminSummary, AdminUserPage, Product, AdminProductPage, ProductPublic, ProductPublicPage, Category, CategoryPublic, Brand, BrandPublic, CartItem, Order, OrderCustomer, OrderItem, OrderItemCustomer, OrderTrackResult, Review, PublicReview, ReviewableOrder, DashboardStats, UserAddress, WishlistItem, AppNotification, PaymentCustomer, AdminPayment, PaymentChannel, ProductImportResult, ProductImportHistoryEntry, ProductUrlImportPreview, ProductQuestion, ProductQuestionPublic, ProductQuestionAdminSummary, SupportSession, SupportSessionCustomer, SupportWebSocketTicket, SupportAdminSummary, SupportAdminSessionPage, SupportMessage, SupportMessageCustomer, Coupon, CouponPublic, AdminCouponPage, CouponAdminSummary, UserCoupon, CouponQuote, LogisticsTrackResponse, PetProfile, LogisticsCarrier, PetGalleryPhotoPublic, AdminPetGalleryPhoto, AdminPetGalleryPage, PetGalleryQuota, AppConfig, SecurityAuditLog, SecurityAuditPurgeResponse, SecurityAuditSummary, AdminRole, PetBirthdayCouponConfig, AdminOrderPage, AdminReviewPage, AdminOrderBatchShipResponse, AdminRegistryStatus, AdminSystemStatus, AdminConfigCenterPublishRequest, AdminConfigCenterSnapshot, AdminLogDebugRequest, AdminLogManagementStatus, AdminTrafficControlStatus, SystemAlert, SystemAlertBatchActionResponse, SystemAlertPurgeResponse, SystemAlertSummary, AdminBugReport, AdminBugAttachmentUploadResponse, AdminBugReportPage, AdminBugReportSummary, IpBlacklistEntry, IpBlacklistBatchReleaseResponse, IpBlacklistStatus, SiteAnnouncement, SiteAnnouncementPublic, SiteAnnouncementAdminPage, SiteAnnouncementAdminSummary, ProductMutationPayload } from '../types';
import { buildLoginUrl, getCurrentRelativeUrl } from '../utils/authRedirect';
import { AUTH_SESSION_STORAGE_KEYS, dispatchAuthSessionChanged } from '../utils/authEvents';
import { clearAuthClientState } from '../utils/authClientStateCleanup';
import { resolveApiDispatcherUrl } from '../utils/apiDispatcher';
import { dispatchDomEvent } from '../utils/domEvents';
import { normalizePersistentImageUrl } from '../utils/mediaAssets';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getApiErrorMessage } from '../utils/apiError';
import { ensureLanguagePack } from '../i18n';
import { resolveApiBaseUrl, resolveSupportWebSocketUrl } from '../utils/runtimeConfig';
import { getEffectiveRole } from '../utils/roles';
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { cachedGet, cachedTypedGet, setBoundedMapEntry, setTimedCacheEntry } from './cache';

export const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    timeout: 15000,
});

export const apiBaseUrl = String(api.defaults.baseURL || window.location.origin).replace(/\/$/, '');
const MAX_CART_QUANTITY = 99;
export const MAX_SELECTED_SPECS_LENGTH = 1000;
const MAX_GUEST_CHECKOUT_ITEMS = 80;
export const MAX_PRODUCT_STATUS_LENGTH = 20;
export const MAX_REVIEW_COMMENT_LENGTH = 1000;
export const MAX_PRODUCT_QUESTION_LENGTH = 500;
const MAX_PASSWORD_LENGTH = 128;
const MAX_PRODUCT_IMAGE_URL_LENGTH = 2000;
const MAX_SUPPORT_MESSAGE_LENGTH = 4000;

export const normalizePositiveInt = (value: unknown) => {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeSafeInt = (value: unknown) => {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : null;
};

export const toPathId = (value: unknown) => {
    const normalized = normalizePositiveInt(value);
    if (!normalized) {
        throw new TypeError('Invalid positive integer path id');
    }
    return normalized;
};

export const normalizePositiveIntList = (values: unknown[], limit = 40) =>
    Array.from(new Set(values.map(normalizePositiveInt).filter((id): id is number => id !== null))).slice(0, limit);

export const normalizeQuantityParam = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(1, Math.min(Math.floor(numeric), MAX_CART_QUANTITY)) : 1;
};

export const normalizeNonNegativeIntParam = (value: unknown, fallback = 0, max = 1_000_000) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(Math.floor(numeric), max)) : fallback;
};

export const normalizeNonNegativeNumberParam = (value: unknown, fallback = 0, max = 1_000_000) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, max)) : fallback;
};

export const normalizeBoundedPositiveInt = (value: unknown, fallback: number, max: number) => {
    const normalized = normalizePositiveInt(value);
    return normalized ? Math.min(normalized, max) : fallback;
};

const stripControlChars = (value: string) =>
    Array.from(value, (char) => {
        const code = char.charCodeAt(0);
        return code <= 31 || code === 127 ? ' ' : char;
    }).join('');

export const normalizeTextParam = (value: unknown, maxLength = 120) =>
    stripControlChars(String(value || '')).trim().replace(/\s+/g, ' ').slice(0, maxLength);

const normalizeMultilineTextParam = (value: unknown, maxLength = 120) => {
    const normalized = String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return Array.from(normalized, (char) => {
        const code = char.charCodeAt(0);
        if (code === 10) return '\n';
        return code <= 31 || code === 127 ? ' ' : char;
    })
        .join('')
        .split('\n')
        .map((line) => line.trim().replace(/ {2,}/g, ' '))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, maxLength);
};

export const normalizeSupportMessageContent = (value: unknown) =>
    normalizeMultilineTextParam(value, MAX_SUPPORT_MESSAGE_LENGTH);

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
    } catch (_error) {
        return null;
    }
};

const isJwtExpiring = (token: string, skewMs = 30_000) => {
    const expiresAtMs = getJwtExpiryMs(token);
    return expiresAtMs !== null && expiresAtMs <= Date.now() + skewMs;
};

export const normalizeAuditLogParams = (params?: Record<string, unknown>, options?: { includeLimit?: boolean; includeTopLimit?: boolean }) => ({
    action: normalizeTextParam(params?.action, 50) || undefined,
    result: normalizeTextParam(params?.result, 20) || undefined,
    actorUsername: normalizeTextParam(params?.actorUsername, 100) || undefined,
    resourceType: normalizeTextParam(params?.resourceType, 50) || undefined,
    startAt: normalizeTextParam(params?.startAt, 32) || undefined,
    endAt: normalizeTextParam(params?.endAt, 32) || undefined,
    ...(options?.includeLimit ? { limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000) } : {}),
    ...(options?.includeTopLimit ? { topLimit: normalizeBoundedPositiveInt(params?.topLimit, 10, 50) } : {}),
});

export const normalizeEmailParam = (value: unknown) => {
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

const normalizePasswordParam = (value: unknown, fieldName = 'Password') => {
    const password = String(value || '');
    if (password.length > MAX_PASSWORD_LENGTH) {
        throw new Error(`${fieldName} is too long`);
    }
    return password;
};

export const normalizeOrderTrackingNumber = (value: unknown) =>
    normalizeTextParam(value, 80).replace(/[^a-z0-9_-]/gi, '').toUpperCase();

const normalizeIdempotencyKeyParam = (value: unknown) =>
    normalizeTextParam(value, 120).replace(/[^a-z0-9._:-]/gi, '').slice(0, 120);

export const normalizeGuestCheckoutItems = (items: Array<{ productId: number; quantity: number; selectedSpecs?: string }> = []) =>
    items
        .map((item) => ({
            productId: normalizePositiveInt(item?.productId) || 0,
            quantity: normalizeQuantityParam(item?.quantity),
            selectedSpecs: item?.selectedSpecs ? normalizeTextParam(item.selectedSpecs, MAX_SELECTED_SPECS_LENGTH) : undefined,
        }))
        .filter((item) => item.productId > 0)
        .slice(0, MAX_GUEST_CHECKOUT_ITEMS);

export const normalizeAddressPayload = (address: Partial<UserAddress>) => ({
    recipientName: normalizeTextParam(address.recipientName, 80),
    phone: normalizeTextParam(address.phone, 30),
    region: Array.isArray(address.region)
        ? address.region.map((item) => normalizeTextParam(item, 120)).filter(Boolean).slice(0, 8)
        : undefined,
    postalCode: address.postalCode === undefined ? undefined : normalizeTextParam(address.postalCode, 20).toUpperCase(),
    detailAddress: address.detailAddress === undefined ? undefined : normalizeTextParam(address.detailAddress, 260),
    address: normalizeTextParam(address.address, 500),
    isDefault: address.isDefault === undefined ? undefined : Boolean(address.isDefault),
});

export const normalizeCategoryPayload = (category: Partial<Category>) => ({
    name: normalizeTextParam(category.name, 255),
    parentId: category.parentId === undefined || category.parentId === null ? null : normalizePositiveInt(category.parentId) || null,
    imageUrl: category.imageUrl === undefined || category.imageUrl === null ? null : normalizeImageUrlParam(category.imageUrl, 2048) || null,
    description: category.description === undefined || category.description === null ? null : normalizeTextParam(category.description, 1000),
    localizedContent: category.localizedContent ?? null,
});

export const normalizeBrandPayload = (brand: Partial<Brand>) => ({
    name: normalizeTextParam(brand.name, 100),
    description: brand.description === undefined || brand.description === null ? null : normalizeTextParam(brand.description, 1000),
    logoUrl: brand.logoUrl === undefined || brand.logoUrl === null ? null : normalizeImageUrlParam(brand.logoUrl, 1000) || null,
    websiteUrl: brand.websiteUrl === undefined || brand.websiteUrl === null ? null : normalizeTextParam(brand.websiteUrl, 1000),
    status: normalizeTextParam(brand.status, 20).toUpperCase() || 'ACTIVE',
    sortOrder: normalizeSafeInt(brand.sortOrder) ?? 0,
});

export const normalizeAnnouncementPayload = (announcement: Partial<SiteAnnouncement>) => ({
    title: normalizeTextParam(announcement.title, 120),
    content: normalizeTextParam(announcement.content, 2000),
    linkUrl: announcement.linkUrl === undefined || announcement.linkUrl === null ? null : normalizeTextParam(announcement.linkUrl, 500),
    status: normalizeTextParam(announcement.status, 20).toUpperCase() || 'ACTIVE',
    sortOrder: normalizeSafeInt(announcement.sortOrder) ?? 0,
    startsAt: announcement.startsAt || undefined,
    endsAt: announcement.endsAt || undefined,
});

export const normalizeBugReportPayload = (bug: Partial<AdminBugReport>) => ({
    title: normalizeTextParam(bug.title, 160),
    description: normalizeMultilineTextParam(bug.description, 4000),
    module: normalizeTextParam(bug.module, 40).toUpperCase() || 'GENERAL',
    severity: normalizeTextParam(bug.severity, 20).toUpperCase() || 'MEDIUM',
    priority: normalizeTextParam(bug.priority, 20).toUpperCase() || 'P2',
    pageUrl: bug.pageUrl === undefined || bug.pageUrl === null ? null : normalizeTextParam(bug.pageUrl, 500),
    environment: bug.environment === undefined || bug.environment === null ? null : normalizeTextParam(bug.environment, 120),
    reproductionSteps: bug.reproductionSteps === undefined || bug.reproductionSteps === null ? null : normalizeMultilineTextParam(bug.reproductionSteps, 4000),
    expectedResult: bug.expectedResult === undefined || bug.expectedResult === null ? null : normalizeMultilineTextParam(bug.expectedResult, 4000),
    actualResult: bug.actualResult === undefined || bug.actualResult === null ? null : normalizeMultilineTextParam(bug.actualResult, 4000),
    attachmentUrls: bug.attachmentUrls === undefined || bug.attachmentUrls === null ? null : normalizeMultilineTextParam(bug.attachmentUrls, 2000),
    assignedTo: bug.assignedTo === undefined || bug.assignedTo === null ? null : normalizeTextParam(bug.assignedTo, 120),
});

export const normalizeBugStatusPayload = (payload: Partial<AdminBugReport> & { note?: string }) => ({
    status: normalizeTextParam(payload.status, 40).toUpperCase(),
    note: normalizeMultilineTextParam(payload.note, 2000) || undefined,
    assignedTo: payload.assignedTo === undefined || payload.assignedTo === null ? undefined : normalizeTextParam(payload.assignedTo, 120),
    scanNote: payload.scanNote === undefined || payload.scanNote === null ? undefined : normalizeMultilineTextParam(payload.scanNote, 2000),
    fixSummary: payload.fixSummary === undefined || payload.fixSummary === null ? undefined : normalizeMultilineTextParam(payload.fixSummary, 2000),
    regressionNote: payload.regressionNote === undefined || payload.regressionNote === null ? undefined : normalizeMultilineTextParam(payload.regressionNote, 2000),
});

export const normalizeBugAttachmentApiPath = (value: unknown) => {
    const raw = normalizeTextParam(value, 500);
    if (!raw || raw.includes('\\') || raw.includes('..')) {
        throw new TypeError('Invalid bug attachment URL');
    }
    const pathFromUrl = (() => {
        if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
        try {
            const parsed = new URL(raw);
            const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin;
            return parsed.origin === browserOrigin ? parsed.pathname : '';
        } catch (_error) {
            return '';
        }
    })();
    const normalizedPath = pathFromUrl.startsWith('/api/admin/bugs/attachments/')
        ? pathFromUrl.slice('/api'.length)
        : pathFromUrl;
    if (!/^\/admin\/bugs\/attachments\/[0-9a-f-]{36}\.(?:jpg|png)$/i.test(normalizedPath)) {
        throw new TypeError('Invalid bug attachment URL');
    }
    return normalizedPath;
};

export const normalizeAdminRolePayload = (role: Partial<AdminRole>) => ({
    code: normalizeTextParam(role.code, 50).toUpperCase(),
    name: normalizeTextParam(role.name, 100),
    description: role.description === undefined || role.description === null ? null : normalizeTextParam(role.description, 255),
    status: normalizeTextParam(role.status, 20).toUpperCase() || 'ACTIVE',
    permissions: normalizeStringListParam(role.permissions, 100, 80),
});

export interface AdminUserUpdatePayload {
    status?: string;
    address?: string;
}

export type LogisticsCarrierWritePayload = Partial<LogisticsCarrier> & { code?: unknown };

export const normalizeLogisticsCarrierPayload = (carrier: LogisticsCarrierWritePayload) => ({
    name: normalizeTextParam(carrier.name, 100),
    trackingCode: normalizeTextParam(carrier.trackingCode ?? carrier.code, 80),
    status: normalizeTextParam(carrier.status, 20).toUpperCase() || 'ACTIVE',
    sortOrder: normalizeSafeInt(carrier.sortOrder) ?? 0,
});

export const normalizeAdminUserUpdatePayload = (user: AdminUserUpdatePayload) => ({
    address: user.address === undefined ? undefined : normalizeTextParam(user.address, 260),
    status: user.status === undefined ? undefined : normalizeTextParam(user.status, 40).toUpperCase(),
});

export const normalizePetProfilePayload = (pet: Partial<PetProfile>) => {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeNullableProductValue = <T,>(value: unknown, normalize: (raw: unknown) => T) =>
    value === null ? null : normalize(value);

export const normalizeStringListParam = (values: unknown, limit = 30, maxLength = 500) =>
    Array.isArray(values)
        ? Array.from(new Set(values.map((value) => normalizeTextParam(value, maxLength)).filter(Boolean))).slice(0, limit)
        : [];

export const normalizeImageListParam = (values: unknown, limit = 30, maxLength = 2048) =>
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

const PRODUCT_NAME_MAX_LENGTH = 200;
const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;

export const normalizeProductPayload = (product: ProductMutationPayload) => {
    const payload: Partial<Product> = {};
    if (hasOwn(product, 'name')) payload.name = normalizeNullableProductValue(product.name, (value) => normalizeTextParam(value, PRODUCT_NAME_MAX_LENGTH)) as Product['name'];
    if (hasOwn(product, 'description')) payload.description = normalizeNullableProductValue(product.description, (value) => normalizeTextParam(value, PRODUCT_DESCRIPTION_MAX_LENGTH)) as Product['description'];
    if (hasOwn(product, 'price')) payload.price = normalizeNullableProductValue(product.price, normalizeNonNegativeNumberParam) as Product['price'];
    if (hasOwn(product, 'stock')) payload.stock = normalizeNullableProductValue(product.stock, normalizeNonNegativeIntParam) as Product['stock'];
    if (hasOwn(product, 'categoryId')) payload.categoryId = normalizeNullableProductValue(product.categoryId, (value) => normalizePositiveInt(value) || 0) as Product['categoryId'];
    if (hasOwn(product, 'isFeatured')) payload.isFeatured = Boolean(product.isFeatured);
    if (hasOwn(product, 'imageUrl')) payload.imageUrl = normalizeNullableProductValue(product.imageUrl, (value) => normalizeImageUrlParam(value, MAX_PRODUCT_IMAGE_URL_LENGTH)) as Product['imageUrl'];
    if (hasOwn(product, 'status')) payload.status = normalizeNullableProductValue(product.status, (value) => normalizeTextParam(value, MAX_PRODUCT_STATUS_LENGTH).toUpperCase()) as Product['status'];
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
    if (hasOwn(product, 'updatedAt')) payload.updatedAt = normalizeNullableProductValue(product.updatedAt, (value) => normalizeTextParam(value, 80)) as Product['updatedAt'];
    return payload;
};

const normalizeCouponMutationValue = <T,>(value: unknown, normalize: (raw: unknown) => T) =>
    value === null || value === undefined ? null : normalize(value);

const normalizeRequiredCouponText = (value: unknown, fieldName: string, maxLength: number) => {
    const normalized = normalizeTextParam(value, maxLength);
    if (!normalized) {
        throw new Error(`${fieldName} is required`);
    }
    return normalized;
};

export const normalizeCouponPayload = (coupon: Partial<Coupon>) => {
    const source = (coupon || {}) as Record<string, unknown>;
    const payload: Record<string, unknown> = {};
    payload.name = normalizeRequiredCouponText(source.name, 'Coupon name', 120);
    payload.couponType = normalizeRequiredCouponText(source.couponType, 'Coupon type', 40).toUpperCase();
    if (hasOwn(source, 'scope')) payload.scope = normalizeCouponMutationValue(source.scope, (value) => normalizeTextParam(value, 20).toUpperCase());
    if (hasOwn(source, 'status')) payload.status = normalizeCouponMutationValue(source.status, (value) => normalizeTextParam(value, 20).toUpperCase());
    if (hasOwn(source, 'thresholdAmount')) payload.thresholdAmount = normalizeCouponMutationValue(source.thresholdAmount, normalizeNonNegativeNumberParam);
    if (hasOwn(source, 'reductionAmount')) payload.reductionAmount = normalizeCouponMutationValue(source.reductionAmount, normalizeNonNegativeNumberParam);
    if (hasOwn(source, 'discountPercent')) payload.discountPercent = normalizeCouponMutationValue(source.discountPercent, (value) => normalizeNonNegativeIntParam(value, 0, 99));
    if (hasOwn(source, 'maxDiscountAmount')) payload.maxDiscountAmount = normalizeCouponMutationValue(source.maxDiscountAmount, normalizeNonNegativeNumberParam);
    if (hasOwn(source, 'totalQuantity')) payload.totalQuantity = normalizeCouponMutationValue(source.totalQuantity, (value) => normalizeNonNegativeIntParam(value, 0, 100000));
    if (hasOwn(source, 'startAt')) payload.startAt = normalizeCouponMutationValue(source.startAt, (value) => normalizeTextParam(value, 40));
    if (hasOwn(source, 'endAt')) payload.endAt = normalizeCouponMutationValue(source.endAt, (value) => normalizeTextParam(value, 40));
    if (hasOwn(source, 'description')) payload.description = normalizeCouponMutationValue(source.description, (value) => normalizeTextParam(value, 1000));
    return payload;
};

export type ProductReviewSummary = {
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

export type AuthRetryConfig = AxiosRequestConfig & {
    _authRetry?: boolean;
    _anonymousRetry?: boolean;
    _transientRetryCount?: number;
    skipAuthRefresh?: boolean;
    skipAuthHeader?: boolean;
    skipAuthRedirect?: boolean;
    skipTransientRetry?: boolean;
    _terminalApiErrorNotified?: boolean;
    allowAnonymousRetry?: boolean;
};

export type ApiRequestOptions = {
    signal?: AbortSignal;
    bypassCache?: boolean;
    skipAuthRedirect?: boolean;
};

export type CheckoutRequestOptions = {
    idempotencyKey?: string;
};

export const cacheLoaderOptions = (options?: ApiRequestOptions): ApiRequestOptions | undefined => {
    if (!options?.signal) return options;
    const nextOptions: ApiRequestOptions = {};
    if (options.bypassCache) nextOptions.bypassCache = true;
    if (options.skipAuthRedirect) nextOptions.skipAuthRedirect = true;
    return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
};

export const createApiAbortController = () => new AbortController();

export const withRequestOptions = <T extends AxiosRequestConfig>(config: T, options?: ApiRequestOptions): T => (
    {
        ...config,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(options?.skipAuthRedirect ? { skipAuthRedirect: true } : {}),
    } as T
);

export const anonymousGetConfig = (config: AxiosRequestConfig = {}, options?: ApiRequestOptions): AxiosRequestConfig => withRequestOptions({
    ...config,
    allowAnonymousRetry: true,
    skipAuthHeader: true,
    skipAuthRedirect: true,
} as AuthRetryConfig, options);

export const optionalAnonymousGetConfig = (config: AxiosRequestConfig = {}, options?: ApiRequestOptions): AxiosRequestConfig => withRequestOptions({
    ...config,
    allowAnonymousRetry: true,
} as AuthRetryConfig, options);

export const anonymousRequestConfig = (config: AxiosRequestConfig = {}, options?: ApiRequestOptions): AxiosRequestConfig => withRequestOptions({
    ...config,
    skipAuthRefresh: true,
    skipAuthHeader: true,
    skipAuthRedirect: true,
} as AuthRetryConfig, options);

export const checkoutIdempotencyConfig = (options?: CheckoutRequestOptions): AxiosRequestConfig | undefined => {
    const idempotencyKey = normalizeIdempotencyKeyParam(options?.idempotencyKey);
    return idempotencyKey
        ? { headers: { 'Idempotency-Key': idempotencyKey } }
        : undefined;
};

export const hasGuestCredentials = (email?: string, orderNo?: string) => Boolean(normalizeEmailParam(email) && normalizeOrderTrackingNumber(orderNo || ''));

export const guestParams = (email?: string, orderNo?: string) => hasGuestCredentials(email, orderNo)
    ? { guestEmail: normalizeEmailParam(email), orderNo: normalizeOrderTrackingNumber(orderNo || '') }
    : undefined;

export const guestRequestConfig = (email?: string, orderNo?: string, config: AxiosRequestConfig = {}) => hasGuestCredentials(email, orderNo)
    ? anonymousRequestConfig(config)
    : config;

export const guestOrderPath = (id: number, email?: string, orderNo?: string) => {
    const normalizedId = toPathId(id);
    return hasGuestCredentials(email, orderNo) ? `/orders/guest/${normalizedId}` : `/orders/${normalizedId}`;
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
const AUTH_REFRESH_RETRY_DELAYS_MS = [250, 750];

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

const apiErrorPath = (config?: AxiosRequestConfig) => {
    const rawUrl = String(config?.url || '');
    return rawUrl.split(/[?#]/)[0] || 'unknown';
};

const apiErrorStatus = (error: AxiosError) => {
    const status = Number(error.response?.status || 0);
    return Number.isFinite(status) && status > 0 ? status : undefined;
};

const resolveApiErrorLanguage = (): 'en' | 'es' | 'zh' => {
    const stored = String(getLocalStorageItem('shop-language') || '').trim().toLowerCase();
    if (stored === 'es' || stored === 'zh' || stored === 'en') {
        return stored;
    }
    return 'en';
};

const apiErrorUserMessage = (error: AxiosError) => {
    const language = resolveApiErrorLanguage();
    // Keep non-English packs warm so later terminal errors resolve from locale catalogs.
    if (language !== 'en') {
        void ensureLanguagePack(language).catch((packError) => {
            reportNonBlockingError('api.ensureLanguagePack', packError);
        });
    }
    const status = apiErrorStatus(error);
    const fallback = status === 429
        ? 'Too many requests. Please wait and retry.'
        : status && status >= 500
            ? 'Server error. Please try again later.'
            : !error.response
                ? 'Network error. Please check your connection and try again.'
                : 'Request failed. Please check the form and retry.';
    // Prefer localized catalog messages (rate limit / network / service) for commercial UX.
    return getApiErrorMessage(error, fallback, language);
};

const reportTerminalApiError = (error: AxiosError, config?: AuthRetryConfig) => {
    if (config?._terminalApiErrorNotified) return;
    if (config) config._terminalApiErrorNotified = true;

    const status = apiErrorStatus(error);
    const method = String(config?.method || error.config?.method || 'get').toUpperCase();
    const path = apiErrorPath(config || error.config);
    const retryCount = config?._transientRetryCount || 0;
    reportNonBlockingError('api.response', { error, status, method, path, retryCount });
    dispatchDomEvent('shop:api-error', {
        status,
        method,
        path,
        retryCount,
        transient: isTransientApiError(error),
        message: apiErrorUserMessage(error),
    });
};

const isTransientAuthRefreshError = (error: unknown) => isTransientApiError(error as AxiosError);

export const getStoredItem = (key: string) => {
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

export const currentUserCacheKey = () => userCacheKeyFrom(getStoredItem('userId'), getStoredItem('token'));

export const supportWebSocketUrl = () => {
    const base = new URL(resolveSupportWebSocketUrl(), window.location.origin);
    if (base.protocol === 'https:') base.protocol = 'wss:';
    if (base.protocol === 'http:') base.protocol = 'ws:';
    return base.toString();
};

export const supportWebSocketProtocols = (ticket: string) => {
    const normalizedTicket = normalizeTextParam(ticket, 256);
    if (!normalizedTicket) {
        throw new Error('Support websocket ticket is required');
    }
    return ['support.v1', `ticket.${normalizedTicket}`];
};

export const PRODUCT_LIST_CACHE_MS = 30_000;
export const PRODUCT_DETAIL_CACHE_MS = 30_000;
export const ORDER_TRACK_CACHE_MS = 15_000;
export const PET_GALLERY_CACHE_MS = 20_000;
export const PET_PROFILE_CACHE_MS = 45_000;
export const NOTIFICATION_CACHE_MS = 15_000;
export const PERSONALIZED_RECOMMENDATION_CACHE_MS = 45_000;
export const PRODUCT_ADD_ON_CACHE_MS = 30_000;
const APP_CONFIG_CACHE_MS = 5_000;
const ANNOUNCEMENT_CACHE_MS = 15_000;
export const COUPON_CACHE_MS = 20_000;
export const PAYMENT_CHANNEL_CACHE_MS = 60_000;
export const ADDRESS_CACHE_MS = 20_000;
export const ORDER_ITEMS_CACHE_MS = 20_000;
export const LOGISTICS_TRACK_CACHE_MS = 30_000;
export const REVIEW_CACHE_MS = 20_000;
export const QUESTION_CACHE_MS = 20_000;
export const LOGISTICS_CARRIER_CACHE_MS = 60_000;
export const CATEGORY_CACHE_MS = 60_000;
export const BRAND_CACHE_MS = 60_000;
export const ADMIN_ROLE_CACHE_MS = 60_000;
export const ADMIN_USER_CACHE_MS = 15_000;
export const ADMIN_DASHBOARD_CACHE_MS = 20_000;
export const ADMIN_ORDER_CACHE_MS = 15_000;
export const ADMIN_REVIEW_CACHE_MS = 20_000;
export const productListCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
export const productListRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
export const productPageCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublicPage> }>();
export const productPageRequests = new Map<string, Promise<AxiosResponse<ProductPublicPage>>>();
export const productDetailCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductPublic> }>();
export const productDetailRequests = new Map<number, Promise<AxiosResponse<ProductPublic>>>();
export const productByIdsCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
export const productByIdsRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
export const orderTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<OrderTrackResult> }>();
export const orderTrackRequests = new Map<string, Promise<AxiosResponse<OrderTrackResult>>>();
export const petGalleryCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetGalleryPhotoPublic[]> | AxiosResponse<PetGalleryQuota> }>();
export const petGalleryRequests = new Map<string, Promise<AxiosResponse<PetGalleryPhotoPublic[]> | AxiosResponse<PetGalleryQuota>>>();
export const petProfileCache = new Map<string, { expiresAt: number; response: AxiosResponse<PetProfile[]> }>();
export const petProfileRequests = new Map<string, Promise<AxiosResponse<PetProfile[]>>>();
export const notificationCache = new Map<string, { expiresAt: number; response: AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }> }>();
export const notificationRequests = new Map<string, Promise<AxiosResponse<AppNotification[]> | AxiosResponse<{ count: number }>>>();
export const personalizedRecommendationCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
export const personalizedRecommendationRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
export const productAddOnCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
export const productAddOnRequests = new Map<string, Promise<AxiosResponse<ProductPublic[]>>>();
export const productRecommendationsCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductPublic[]> }>();
export const productRecommendationsRequests = new Map<number, Promise<AxiosResponse<ProductPublic[]>>>();
export const publicCouponCache = new Map<string, { expiresAt: number; response: AxiosResponse<CouponPublic[]> }>();
export const publicCouponRequests = new Map<string, Promise<AxiosResponse<CouponPublic[]>>>();
export const userCouponCache = new Map<string, { expiresAt: number; response: AxiosResponse<UserCoupon[]> }>();
export const userCouponRequests = new Map<string, Promise<AxiosResponse<UserCoupon[]>>>();
export const addressCache = new Map<string, { expiresAt: number; response: AxiosResponse<UserAddress> | AxiosResponse<UserAddress[]> }>();
export const addressRequests = new Map<string, Promise<AxiosResponse<UserAddress> | AxiosResponse<UserAddress[]>>>();
export const orderItemsCache = new Map<string, { expiresAt: number; response: AxiosResponse<OrderItemCustomer[]> }>();
export const orderItemsRequests = new Map<string, Promise<AxiosResponse<OrderItemCustomer[]>>>();
export const logisticsTrackCache = new Map<string, { expiresAt: number; response: AxiosResponse<LogisticsTrackResponse> }>();
export const logisticsTrackRequests = new Map<string, Promise<AxiosResponse<LogisticsTrackResponse>>>();
export const reviewCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductReviewSummary> }>();
export const reviewRequests = new Map<number, Promise<AxiosResponse<ProductReviewSummary>>>();
export const questionCache = new Map<number, { expiresAt: number; response: AxiosResponse<ProductQuestionPublic[]> }>();
export const questionRequests = new Map<number, Promise<AxiosResponse<ProductQuestionPublic[]>>>();
export const logisticsCarrierCache = new Map<string, { expiresAt: number; response: AxiosResponse<LogisticsCarrier[]> }>();
export const logisticsCarrierRequests = new Map<string, Promise<AxiosResponse<LogisticsCarrier[]>>>();
export const categoryCache = new Map<string, { expiresAt: number; response: AxiosResponse<CategoryPublic[]> }>();
export const categoryRequests = new Map<string, Promise<AxiosResponse<CategoryPublic[]>>>();
export const brandCache = new Map<string, { expiresAt: number; response: AxiosResponse<BrandPublic[]> }>();
export const brandRequests = new Map<string, Promise<AxiosResponse<BrandPublic[]>>>();
export const adminRoleCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminRole[]> }>();
export const adminRoleRequests = new Map<string, Promise<AxiosResponse<AdminRole[]>>>();
export const adminUserCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminUserPage> }>();
export const adminUserRequests = new Map<string, Promise<AxiosResponse<AdminUserPage>>>();
export const adminOrderCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminOrderPage> }>();
export const adminOrderRequests = new Map<string, Promise<AxiosResponse<AdminOrderPage>>>();
export const adminReviewCache = new Map<string, { expiresAt: number; response: AxiosResponse<AdminReviewPage> }>();
export const adminReviewRequests = new Map<string, Promise<AxiosResponse<AdminReviewPage>>>();
export const adminQuestionCache = new Map<string, { expiresAt: number; response: AxiosResponse<ProductQuestion[]> }>();
export const adminQuestionRequests = new Map<string, Promise<AxiosResponse<ProductQuestion[]>>>();
const announcementCache = new Map<string, { expiresAt: number; response: AxiosResponse<SiteAnnouncementPublic[]> }>();
const announcementRequests = new Map<string, Promise<AxiosResponse<SiteAnnouncementPublic[]>>>();
export const paymentChannelRuntime = {
    cache: null as { expiresAt: number; response: AxiosResponse<PaymentChannel[]> } | null,
    request: null as Promise<AxiosResponse<PaymentChannel[]>> | null,
};
let appConfigCache: { expiresAt: number; response: AxiosResponse<AppConfig> } | null = null;
let appConfigRequest: Promise<AxiosResponse<AppConfig>> | null = null;
export const adminRuntime = {
    permissionsCache: null as { expiresAt: number; response: AxiosResponse<{ role: string; roleCode?: string; permissions: string[] }> } | null,
    permissionsRequest: null as Promise<AxiosResponse<{ role: string; roleCode?: string; permissions: string[] }>> | null,
    dashboardCache: null as { expiresAt: number; response: AxiosResponse<DashboardStats> } | null,
    dashboardRequest: null as Promise<AxiosResponse<DashboardStats>> | null,
};

type MutationKeyValue =
    | string
    | number
    | boolean
    | null
    | MutationKeyValue[]
    | { [key: string]: MutationKeyValue };

const MUTATION_KEY_UNSERIALIZABLE = Symbol('mutation-key-unserializable');
const mutationRequests = new Map<string, Promise<AxiosResponse<unknown>>>();

const isMutationBinaryPayload = (value: unknown) => {
    if (typeof FormData !== 'undefined' && value instanceof FormData) return true;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true;
    if (typeof File !== 'undefined' && value instanceof File) return true;
    return false;
};

const normalizeMutationHeadersForKey = (headers: AxiosRequestConfig['headers']) => {
    if (!headers) return null;
    const source = headers as unknown as {
        toJSON?: () => unknown;
        forEach?: (callback: (value: unknown, key: string) => void) => void;
    };
    if (typeof source.toJSON === 'function') {
        return source.toJSON();
    }
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        const entries: Array<[string, unknown]> = [];
        headers.forEach((value, key) => entries.push([key.toLowerCase(), value]));
        return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
    }
    return headers;
};

const normalizeMutationValueForKey = (
    value: unknown,
    seen: WeakSet<object> = new WeakSet(),
): MutationKeyValue | typeof MUTATION_KEY_UNSERIALIZABLE => {
    if (value === null) return null;
    if (value === undefined) return { __type: 'undefined' };
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : { __type: 'number', value: String(value) };
    if (typeof value === 'bigint') return { __type: 'bigint', value: value.toString() };
    if (typeof value === 'symbol' || typeof value === 'function') return MUTATION_KEY_UNSERIALIZABLE;
    if (isMutationBinaryPayload(value)) return MUTATION_KEY_UNSERIALIZABLE;
    if (value instanceof Date) return { __type: 'date', value: value.toISOString() };
    if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
        return {
            __type: 'URLSearchParams',
            entries: Array.from(value.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
                `${leftKey}\u0000${leftValue}`.localeCompare(`${rightKey}\u0000${rightValue}`)),
        };
    }
    if (Array.isArray(value)) {
        const items = value.map((item) => normalizeMutationValueForKey(item, seen));
        return items.some((item) => item === MUTATION_KEY_UNSERIALIZABLE)
            ? MUTATION_KEY_UNSERIALIZABLE
            : items as MutationKeyValue[];
    }
    if (typeof value === 'object') {
        if (seen.has(value)) return MUTATION_KEY_UNSERIALIZABLE;
        seen.add(value);
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entryValue]) => [key, normalizeMutationValueForKey(entryValue, seen)] as const)
            .filter(([, entryValue]) => entryValue !== MUTATION_KEY_UNSERIALIZABLE);
        if (entries.length !== Object.keys(value as Record<string, unknown>).length) return MUTATION_KEY_UNSERIALIZABLE;
        return Object.fromEntries(entries) as { [key: string]: MutationKeyValue };
    }
    return MUTATION_KEY_UNSERIALIZABLE;
};

const mutationRequestKey = (method: string, url: string, data?: unknown, config?: AxiosRequestConfig) => {
    if (config?.signal) return null;
    const normalizedData = normalizeMutationValueForKey(data);
    const normalizedParams = normalizeMutationValueForKey(config?.params);
    const normalizedHeaders = normalizeMutationValueForKey(normalizeMutationHeadersForKey(config?.headers));
    if (
        normalizedData === MUTATION_KEY_UNSERIALIZABLE ||
        normalizedParams === MUTATION_KEY_UNSERIALIZABLE ||
        normalizedHeaders === MUTATION_KEY_UNSERIALIZABLE
    ) {
        return null;
    }
    const authConfig = config as AuthRetryConfig | undefined;
    return JSON.stringify({
        method,
        url,
        user: currentUserCacheKey(),
        data: normalizedData,
        params: normalizedParams,
        headers: normalizedHeaders,
        skipAuthHeader: Boolean(authConfig?.skipAuthHeader),
        skipAuthRefresh: Boolean(authConfig?.skipAuthRefresh),
        skipAuthRedirect: Boolean(authConfig?.skipAuthRedirect),
        allowAnonymousRetry: Boolean(authConfig?.allowAnonymousRetry),
    });
};

const runMutationOnce = <T,>(key: string | null, loader: () => Promise<AxiosResponse<T>>) => {
    if (!key) return loader();
    const pending = mutationRequests.get(key) as Promise<AxiosResponse<T>> | undefined;
    if (pending) return pending;
    const request = loader().finally(() => mutationRequests.delete(key));
    setBoundedMapEntry(mutationRequests, key, request as Promise<AxiosResponse<unknown>>);
    return request;
};

const rawPost = api.post.bind(api);
const rawPut = api.put.bind(api);
const rawDelete = api.delete.bind(api);

api.post = ((url: string, data?: unknown, config?: AxiosRequestConfig) =>
    runMutationOnce(mutationRequestKey('POST', url, data, config), () =>
        config === undefined ? rawPost(url, data) : rawPost(url, data, config))) as typeof api.post;

api.put = ((url: string, data?: unknown, config?: AxiosRequestConfig) =>
    runMutationOnce(mutationRequestKey('PUT', url, data, config), () =>
        config === undefined ? rawPut(url, data) : rawPut(url, data, config))) as typeof api.put;

api.delete = ((url: string, config?: AxiosRequestConfig) =>
    runMutationOnce(mutationRequestKey('DELETE', url, undefined, config), () =>
        config === undefined ? rawDelete(url) : rawDelete(url, config))) as typeof api.delete;

const normalizeArrayResponseData = <T,>(data: unknown): T[] => {
    if (Array.isArray(data)) return data as T[];
    if (!data || typeof data !== 'object') return [];
    const candidate = data as { data?: unknown; items?: unknown; content?: unknown; records?: unknown; list?: unknown };
    const nested = [candidate.data, candidate.items, candidate.content, candidate.records, candidate.list]
        .find((value) => Array.isArray(value));
    if (Array.isArray(nested)) return nested as T[];
    return normalizeArrayResponseData<T>(candidate.data);
};

export const withArrayData = <T,>(response: AxiosResponse<T[]>): AxiosResponse<T[]> => ({
    ...response,
    data: normalizeArrayResponseData<T>(response.data),
});

export const isMissingAdminOptionEndpointError = (error: unknown) => {
    const status = Number((error as AxiosError | undefined)?.response?.status || 0);
    return status === 404 || status === 405;
};

const parseMaybeJson = (value: unknown) => {
    if (typeof value !== 'string') return value;
    const text = value.trim();
    const firstChar = text[0];
    if (!text || (firstChar !== '{' && firstChar !== '[')) return value;
    try {
        return JSON.parse(text);
    } catch (error) {
        reportNonBlockingError('api.parseRichProductField', error);
        return value;
    }
};

const normalizeProductImages = (product: { images?: unknown; imageUrl?: unknown }) => {
    const rawImages = parseMaybeJson(product.images);
    const images = Array.isArray(rawImages)
        ? rawImages.map(String).map((image) => image.trim()).filter(Boolean)
        : [];
    const imageUrl = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : '';
    return images.length > 0 ? images : (imageUrl ? [imageUrl] : []);
};

const normalizeProductMap = (value: unknown) => {
    const parsed = parseMaybeJson(value);
    return isRecord(parsed) ? parsed as Record<string, string> : {};
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
                : normalizeStringListParam(group.options, 40, 120);
            return { name, values, options: values };
        })
        .filter((group) => group.name && group.values.length > 0);

const normalizeProductPageData = <T extends ProductPublic>(data: unknown): T[] => {
    if (Array.isArray(data)) return data.map(normalizeProduct);
    const source: Record<string, unknown> = isRecord(data) ? data : {};
    const content = source.content ?? source.items;
    return Array.isArray(content) ? content.map(normalizeProduct) : [];
};

const normalizeProduct = <T extends ProductPublic>(product: T): T => ({
    ...product,
    images: normalizeProductImages(product),
    imageUrl: (typeof product.imageUrl === 'string' && product.imageUrl.trim()) || normalizeProductImages(product)[0] || '',
    specifications: normalizeProductMap(product.specifications),
    detailContent: normalizeProductListField(product.detailContent),
    variants: normalizeProductListField(product.variants),
    optionGroups: normalizeProductOptionGroups(product.optionGroups),
    bundle: product.bundle && typeof product.bundle === 'object' ? product.bundle : null,
    localizedContent: product.localizedContent && typeof product.localizedContent === 'object' ? product.localizedContent : null,
} as T);

export const withProductArrayData = <T extends ProductPublic>(response: AxiosResponse<T[] | ProductPublicPage>): AxiosResponse<T[]> => ({
    ...response,
    data: normalizeProductPageData<T>(response.data),
});

export const normalizeProductPublicPageResponse = (response: AxiosResponse<ProductPublicPage | ProductPublic[]>): AxiosResponse<ProductPublicPage> => {
    const raw = response.data as ProductPublicPage | ProductPublic[];
    const metadata: Record<string, unknown> = isRecord(raw) ? raw : {};
    const items = normalizeProductPageData<ProductPublic>(raw);
    const rawPage = Number(metadata.page);
    const rawSize = Number(metadata.size);
    const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : Math.max(1, items.length);
    const rawTotal = Array.isArray(raw)
        ? items.length
        : Number(metadata.total ?? metadata.totalElements ?? items.length);
    const total = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : items.length;
    const rawTotalPages = Number(metadata.totalPages);
    const totalPages = Number.isFinite(rawTotalPages) && rawTotalPages >= 0
        ? rawTotalPages
        : (total === 0 ? 0 : Math.ceil(total / size));
    const hasNext = Array.isArray(raw)
        ? page + 1 < totalPages
        : Boolean(metadata.hasNext ?? page + 1 < totalPages);
    const hasPrevious = Array.isArray(raw)
        ? page > 0
        : Boolean(metadata.hasPrevious ?? page > 0);
    return {
        ...response,
        data: {
            items,
            total,
            totalElements: total,
            page,
            size,
            totalPages,
            hasNext,
            hasPrevious,
        },
    } as AxiosResponse<ProductPublicPage>;
};

export const normalizeProductAdminPageResponse = (response: AxiosResponse<AdminProductPage | Product[]>): AxiosResponse<AdminProductPage> => {
    const raw = response.data as AdminProductPage | Product[];
    const metadata: Record<string, unknown> = isRecord(raw) ? raw : {};
    const items = normalizeProductPageData<Product>(raw);
    const rawPage = Number(metadata.page);
    const rawSize = Number(metadata.size);
    const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : Math.max(1, items.length);
    const rawTotal = Array.isArray(raw)
        ? items.length
        : Number(metadata.total ?? metadata.totalElements ?? items.length);
    const total = Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : items.length;
    const rawTotalPages = Number(metadata.totalPages);
    const totalPages = Number.isFinite(rawTotalPages) && rawTotalPages >= 0
        ? rawTotalPages
        : (total === 0 ? 0 : Math.ceil(total / size));
    const hasNext = Array.isArray(raw)
        ? page + 1 < totalPages
        : Boolean(metadata.hasNext ?? page + 1 < totalPages);
    const hasPrevious = Array.isArray(raw)
        ? page > 0
        : Boolean(metadata.hasPrevious ?? page > 0);
    return {
        ...response,
        data: {
            items,
            total,
            totalElements: total,
            page,
            size,
            totalPages,
            hasNext,
            hasPrevious,
        },
    } as AxiosResponse<AdminProductPage>;
};

const productDetailResponseFromList = (
    response: AxiosResponse<ProductPublic[]>,
    product: ProductPublic,
): AxiosResponse<ProductPublic> => ({
    ...response,
    data: product,
});

export const cacheProductDetailFromList = (response: AxiosResponse<ProductPublic[]>) => {
    const expiresAt = Date.now() + PRODUCT_DETAIL_CACHE_MS;
    response.data.forEach((product) => {
        if (!product.id) return;
        setTimedCacheEntry(productDetailCache, product.id, {
            response: productDetailResponseFromList(response, product),
            expiresAt,
        });
    });
};

export const cacheProductListResponse = (cacheKey: string, response: AxiosResponse<ProductPublic[]>, ttlMs = PRODUCT_LIST_CACHE_MS) => {
    setTimedCacheEntry(productListCache, cacheKey, {
        response,
        expiresAt: Date.now() + ttlMs,
    });
};

export const cacheProductPageResponse = (cacheKey: string, response: AxiosResponse<ProductPublicPage>, ttlMs = PRODUCT_LIST_CACHE_MS) => {
    setTimedCacheEntry(productPageCache, cacheKey, {
        response,
        expiresAt: Date.now() + ttlMs,
    });
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
    getActive: (limit = 5, options?: ApiRequestOptions) => {
        const normalizedLimit = normalizeBoundedPositiveInt(limit, 5, 10);
        const cacheKey = `active:${normalizedLimit}`;
        return cachedGet(announcementCache, announcementRequests, cacheKey, ANNOUNCEMENT_CACHE_MS, () =>
            api.get<SiteAnnouncementPublic[]>('/announcements/active', anonymousGetConfig({ params: { limit: normalizedLimit } }, cacheLoaderOptions(options))).then(withArrayData), options);
    },
};

const clearProductListCache = () => {
    productListCache.clear();
    productListRequests.clear();
};

export const clearProductCache = (id?: number) => {
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

export const clearPetGalleryCache = () => {
    petGalleryCache.clear();
    petGalleryRequests.clear();
};

export const clearPetProfileCache = () => {
    petProfileCache.clear();
    petProfileRequests.clear();
};

export const clearPersonalizedRecommendationCache = () => {
    personalizedRecommendationCache.clear();
    personalizedRecommendationRequests.clear();
};

export const clearNotificationCache = (userId?: number) => {
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

export const clearCouponCache = () => {
    publicCouponCache.clear();
    publicCouponRequests.clear();
    userCouponCache.clear();
    userCouponRequests.clear();
};

export const clearAddressCache = () => {
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

export const clearOrderTrackCache = () => {
    orderTrackCache.clear();
    orderTrackRequests.clear();
};

export const clearReviewCache = (productId?: number) => {
    if (productId === undefined) {
        reviewCache.clear();
        reviewRequests.clear();
        return;
    }
    reviewCache.delete(productId);
    reviewRequests.delete(productId);
};

export const clearQuestionCache = (productId?: number) => {
    if (productId === undefined) {
        questionCache.clear();
        questionRequests.clear();
        return;
    }
    questionCache.delete(productId);
    questionRequests.delete(productId);
};

export const clearLogisticsCarrierCache = () => {
    logisticsCarrierCache.clear();
    logisticsCarrierRequests.clear();
};

export const clearCategoryCache = () => {
    categoryCache.clear();
    categoryRequests.clear();
};

export const clearBrandCache = () => {
    brandCache.clear();
    brandRequests.clear();
};

export const clearAnnouncementCache = () => {
    announcementCache.clear();
    announcementRequests.clear();
};

export const clearAdminRoleCache = () => {
    adminRoleCache.clear();
    adminRoleRequests.clear();
};

export const clearAdminUserCache = () => {
    adminUserCache.clear();
    adminUserRequests.clear();
};

const clearAdminDashboardCache = () => {
    adminRuntime.dashboardCache = null;
    adminRuntime.dashboardRequest = null;
};

export const clearAdminOrderCache = () => {
    adminOrderCache.clear();
    adminOrderRequests.clear();
    clearAdminDashboardCache();
};

export const clearAdminReviewCache = () => {
    adminReviewCache.clear();
    adminReviewRequests.clear();
    clearAdminDashboardCache();
};

export const normalizeAdminReviewPageResponse = (response: AxiosResponse<AdminReviewPage | Review[]>): AxiosResponse<AdminReviewPage> => {
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

export const normalizeAdminCouponPageResponse = (response: AxiosResponse<AdminCouponPage | Coupon[]>): AxiosResponse<AdminCouponPage> => {
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

export const normalizeAdminPetGalleryPageResponse = (response: AxiosResponse<AdminPetGalleryPage | AdminPetGalleryPhoto[]>): AxiosResponse<AdminPetGalleryPage> => {
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

export const normalizeAdminUserPageResponse = (response: AxiosResponse<AdminUserPage | User[]>): AxiosResponse<AdminUserPage> => {
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

export const normalizeSiteAnnouncementPageResponse = (
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

export const normalizeAdminSupportSessionPageResponse = (
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

export const clearAdminQuestionCache = () => {
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
    adminRuntime.permissionsCache = null;
    adminRuntime.permissionsRequest = null;
};

let refreshTokenRequest: Promise<string | null> | null = null;
let profileRequest: Promise<AxiosResponse<UserProfile>> | null = null;

export const clearStoredAuthCredentials = () => {
    removeStoredItems(AUTH_SESSION_STORAGE_KEYS);
    clearUserScopedCaches();
    dispatchAuthSessionChanged();
};

const clearAuthSession = () => {
    clearAuthClientState();
    clearStoredAuthCredentials();
};

export const clearStoredAuthSession = clearAuthSession;

const getProfile = (options?: ApiRequestOptions) => {
    if (options?.bypassCache || options?.signal) {
        return api.get<UserProfile>('/users/profile', withRequestOptions({}, options));
    }
    if (!profileRequest) {
        profileRequest = api.get<UserProfile>('/users/profile', withRequestOptions({}, options))
            .finally(() => {
                profileRequest = null;
            });
    }
    return profileRequest;
};

const redirectToLogin = () => {
    if (window.location.pathname !== '/login') {
        const loginUrl = buildLoginUrl(getCurrentRelativeUrl(window.location));
        window.history.replaceState(window.history.state, '', loginUrl);
        if (typeof window.PopStateEvent === 'function') {
            window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
        } else {
            window.dispatchEvent(new Event('popstate'));
        }
        dispatchDomEvent('shop:auth-redirect', { to: loginUrl });
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
        const requestRefresh = async (): Promise<string | null> => {
            for (let attempt = 0; attempt <= AUTH_REFRESH_RETRY_DELAYS_MS.length; attempt += 1) {
                try {
                    const response = await api.post<AuthSessionResponse>('/auth/refresh', { refreshToken }, { skipAuthRefresh: true, skipAuthHeader: true } as AuthRetryConfig);
                    return persistAuthSession(response.data);
                } catch (error) {
                    const shouldRetry = attempt < AUTH_REFRESH_RETRY_DELAYS_MS.length && isTransientAuthRefreshError(error);
                    if (!shouldRetry) {
                        throw error;
                    }
                    await sleep(AUTH_REFRESH_RETRY_DELAYS_MS[attempt]);
                }
            }
            return null;
        };
        refreshTokenRequest = requestRefresh()
            .catch(() => null)
            .finally(() => {
                refreshTokenRequest = null;
            });
    }
    return refreshTokenRequest;
};

type HeaderSetter = {
    set: (name: string, value: string) => void;
};

const hasHeaderSetter = (headers: unknown): headers is HeaderSetter => (
    Boolean(headers)
    && typeof headers === 'object'
    && typeof (headers as HeaderSetter).set === 'function'
);

const applyAuthorizationHeader = (config: AuthRetryConfig, token: string) => {
    const headers = config.headers;
    if (hasHeaderSetter(headers)) {
        headers.set('Authorization', `Bearer ${token}`);
        config.headers = headers;
        return;
    }
    const mutableHeaders = isRecord(headers) ? headers : {};
    config.headers = { ...mutableHeaders, Authorization: `Bearer ${token}` } as AuthRetryConfig['headers'];
};

const removeAuthorizationHeader = (config: AuthRetryConfig) => {
    const headers = config.headers;
    if (headers instanceof AxiosHeaders) {
        headers.delete('Authorization');
        headers.delete('authorization');
        return;
    }
    const mutableHeaders = { ...(isRecord(headers) ? headers : {}) };
    delete mutableHeaders.Authorization;
    delete mutableHeaders.authorization;
    config.headers = mutableHeaders as AuthRetryConfig['headers'];
};

const SHOP_LANGUAGE_STORAGE_KEY = 'shop-language';

const resolveAcceptLanguageHeader = (language?: string | null) => {
    const normalized = String(language || '').trim().toLowerCase();
    if (normalized === 'zh' || normalized.startsWith('zh-')) {
        return 'zh-CN';
    }
    if (normalized === 'es' || normalized.startsWith('es-')) {
        return 'es-MX';
    }
    return 'en-US';
};

const applyAcceptLanguageHeader = (config: AuthRetryConfig) => {
    const acceptLanguage = resolveAcceptLanguageHeader(getStoredItem(SHOP_LANGUAGE_STORAGE_KEY));
    const headers = config.headers;
    const headerSetter = headers as { set?: unknown } | undefined;
    if (typeof headerSetter?.set === 'function') {
        const setHeader = headerSetter.set as (name: string, value: string) => void;
        setHeader.call(headers, 'Accept-Language', acceptLanguage);
        config.headers = headers;
        return;
    }
    config.headers = {
        ...(isRecord(headers) ? headers : {}),
        'Accept-Language': acceptLanguage,
    } as AuthRetryConfig['headers'];
};

// 请求拦截器
api.interceptors.request.use(
    async (config) => {
        config.url = resolveApiDispatcherUrl(config.url);
        const authConfig = config as AuthRetryConfig;
        applyAcceptLanguageHeader(authConfig);
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
        reportNonBlockingError('api.request', error);
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
                reportTerminalApiError(error, originalRequest);
                return Promise.reject(error);
            }
            if (originalRequest?.skipAuthRedirect) {
                reportTerminalApiError(error, originalRequest);
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
        reportTerminalApiError(error, originalRequest);
        return Promise.reject(error);
    }
);

// 用户相关 API
export const userApi = {
    register: (user: Partial<User> & { emailCode?: string }) => api.post('/auth/register', {
        username: normalizeLoginParam(user.username, 50),
        email: normalizeEmailParam(user.email) || '',
        phone: normalizePhoneParam(user.phone, 20),
        password: normalizePasswordParam(user.password),
        emailCode: normalizeEmailCodeParam(user.emailCode),
    }, anonymousRequestConfig()),
    login: (username: string, password: string) =>
        api.post('/auth/login', { username: normalizeLoginParam(username, 120), password: normalizePasswordParam(password) }, anonymousRequestConfig()),
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
            newPassword: normalizePasswordParam(payload.newPassword, 'New password'),
        }, anonymousRequestConfig()),
    getProfile,
    sendProfileEmailCode: (email: string) => api.post('/users/profile/email-code', { email: normalizeEmailParam(email) || '' }),
    updateProfile: (user: Partial<User> & { emailCode?: string }) => api.put('/users/profile', {
        email: normalizeEmailParam(user.email) || '',
        phone: normalizePhoneParam(user.phone, 20),
        emailCode: normalizeEmailCodeParam(user.emailCode),
    }),
    updatePassword: (oldPassword: string, newPassword: string) =>
        api.put('/users/password', {
            oldPassword: normalizePasswordParam(oldPassword, 'Current password'),
            newPassword: normalizePasswordParam(newPassword, 'New password'),
        })
};

export type ProductListFilters = {
    minPrice?: number;
    maxPrice?: number;
    petSizes?: string[];
    materials?: string[];
    colors?: string[];
    collection?: string;
    includeChildren?: boolean;
    sort?: string;
    page?: number;
    size?: number;
};

// 商品相关 API
export type SupportMessageQuery = { limit?: number; afterId?: number };
export type SupportSessionQuery = { limit?: number };
export type AdminSupportSessionQuery = {
    status?: string;
    needsReply?: boolean;
    assignedAdminId?: number;
    search?: string;
    page?: number;
    size?: number;
};
export const normalizeSupportMessageParams = (options?: SupportMessageQuery) => {
    const limit = Math.min(normalizePositiveInt(options?.limit) || 80, 120);
    const afterId = normalizePositiveInt(options?.afterId) || undefined;
    return { limit, afterId };
};

export const normalizeSupportSessionParams = (options?: SupportSessionQuery) => {
    const limit = Math.min(normalizePositiveInt(options?.limit) || 12, 30);
    return { limit };
};

export const normalizeAdminSupportSessionParams = (input?: string | AdminSupportSessionQuery) => {
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

