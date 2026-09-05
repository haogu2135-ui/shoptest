import type { AxiosResponse } from 'axios';
import { cachedGet, withAbortSignal } from './cache';
import { dispatchDomEvent } from '../utils/domEvents';
import type {
  User,
  UserAdminSummary,
  AdminUserPage,
  Product,
  AdminProductPage,
  AdminInventorySummary,
  Category,
  Brand,
  Order,
  OrderItem,
  Review,
  DashboardStats,
  AdminPayment,
  ProductImportResult,
  ProductImportHistoryEntry,
  ProductUrlImportPreview,
  ProductQuestion,
  ProductQuestionAdminSummary,
  SupportSession,
  SupportAdminSummary,
  SupportAdminSessionPage,
  SupportMessage,
  Coupon,
  AdminCouponPage,
  CouponAdminSummary,
  AdminPetGalleryPhoto,
  AdminPetGalleryPage,
  SecurityAuditLog,
  SecurityAuditPurgeResponse,
  SecurityAuditSummary,
  AdminRole,
  PetBirthdayCouponConfig,
  AdminOrderPage,
  AdminReviewPage,
  AdminOrderBatchShipResponse,
  AdminRegistryStatus,
  AdminSystemStatus,
  AdminConfigCenterPublishRequest,
  AdminConfigCenterSnapshot,
  AdminLogDebugRequest,
  AdminLogManagementStatus,
  AdminTrafficControlStatus,
  SystemAlert,
  SystemAlertBatchActionResponse,
  SystemAlertPurgeResponse,
  SystemAlertSummary,
  AdminBugReport,
  AdminBugAttachmentUploadResponse,
  AdminBugReportPage,
  AdminBugReportSummary,
  IpBlacklistEntry,
  IpBlacklistBatchReleaseResponse,
  IpBlacklistStatus,
  SiteAnnouncement,
  SiteAnnouncementAdminPage,
  SiteAnnouncementAdminSummary,
  ProductMutationPayload,
  SeckillCampaign,
  SeckillCampaignWritePayload,
} from '../types';
import {
  ADMIN_DASHBOARD_CACHE_MS,
  ADMIN_ORDER_CACHE_MS,
  ADMIN_REVIEW_CACHE_MS,
  ADMIN_ROLE_CACHE_MS,
  ADMIN_USER_CACHE_MS,
  MAX_PRODUCT_STATUS_LENGTH,
  adminOrderCache,
  adminOrderRequests,
  adminQuestionCache,
  adminQuestionRequests,
  adminReviewCache,
  adminReviewRequests,
  adminRoleCache,
  adminRoleRequests,
  adminRuntime,
  adminUserCache,
  adminUserRequests,
  api,
  clearAdminOrderCache,
  clearAdminPermissionsCache,
  clearAdminQuestionCache,
  clearAdminReviewCache,
  clearAdminRoleCache,
  clearAdminUserCache,
  clearAnnouncementCache,
  clearBrandCache,
  clearCategoryCache,
  clearCouponCache,
  clearPetGalleryCache,
  clearProductCache,
  clearQuestionCache,
  clearReviewCache,
  isMissingAdminOptionEndpointError,
  normalizeAdminCouponPageResponse,
  normalizeAdminPetGalleryPageResponse,
  normalizeAdminReviewPageResponse,
  normalizeAdminRolePayload,
  normalizeAdminSupportSessionPageResponse,
  normalizeAdminSupportSessionParams,
  normalizeAdminUserPageResponse,
  normalizeAdminUserUpdatePayload,
  normalizeAnnouncementPayload,
  normalizeAuditLogParams,
  normalizeBoundedPositiveInt,
  normalizeBrandPayload,
  normalizeBugAttachmentApiPath,
  normalizeBugReportPayload,
  normalizeBugStatusPayload,
  normalizeCategoryPayload,
  normalizeCouponPayload,
  normalizeNonNegativeIntParam,
  normalizeNonNegativeNumberParam,
  normalizePriceRange,
  normalizePositiveInt,
  normalizePositiveIntList,
  normalizeProductAdminPageResponse,
  normalizeProductPayload,
  normalizeSiteAnnouncementPageResponse,
  normalizeSupportMessageContent,
  normalizeSupportMessageParams,
  normalizeTextParam,
  toPathId,
  withArrayData,
  withRequestOptions,
  cacheLoaderOptions,
} from './core';
import type {
  AdminSupportSessionQuery,
  AdminUserUpdatePayload,
  ApiRequestOptions,
  SupportMessageQuery,
} from './core';

const postWithOptions = <T>(url: string, data: unknown, options?: ApiRequestOptions) => options
    ? api.post<T>(url, data, withRequestOptions({}, options))
    : api.post<T>(url, data);

const putWithOptions = <T>(url: string, data: unknown, options?: ApiRequestOptions) => options
    ? api.put<T>(url, data, withRequestOptions({}, options))
    : api.put<T>(url, data);

const deleteWithOptions = (url: string, options?: ApiRequestOptions) => options
    ? api.delete(url, withRequestOptions({}, options))
    : api.delete(url);

interface AdminProductBatchStatusResponse {
    success: number;
    failed: number;
    requested: number;
    max: number;
}

export const adminApi = {
    getDashboard: (options?: ApiRequestOptions) => {
        if (options?.bypassCache) {
            adminRuntime.dashboardCache = null;
        }
        if (options?.signal) {
            return api.get<DashboardStats>('/admin/dashboard', withRequestOptions({}, options))
                .then((response) => {
                    if (!options.bypassCache) {
                        adminRuntime.dashboardCache = { response, expiresAt: Date.now() + ADMIN_DASHBOARD_CACHE_MS };
                    }
                    return response;
                });
        }
        if (!options?.bypassCache && adminRuntime.dashboardCache && adminRuntime.dashboardCache.expiresAt > Date.now()) {
            return Promise.resolve(adminRuntime.dashboardCache.response);
        }
        if (!options?.bypassCache && adminRuntime.dashboardRequest) return adminRuntime.dashboardRequest;
        let request: Promise<AxiosResponse<DashboardStats>>;
        request = api.get<DashboardStats>('/admin/dashboard', withRequestOptions({}, options))
            .then((response) => {
                if (!options?.bypassCache) {
                    adminRuntime.dashboardCache = { response, expiresAt: Date.now() + ADMIN_DASHBOARD_CACHE_MS };
                }
                return response;
            })
            .finally(() => {
                if (adminRuntime.dashboardRequest === request) {
                    adminRuntime.dashboardRequest = null;
                }
            });
        if (!options?.bypassCache) {
            adminRuntime.dashboardRequest = request;
        }
        return withAbortSignal(request, options?.signal);
    },
    getRegistryStatus: (options?: ApiRequestOptions) =>
        api.get<AdminRegistryStatus>('/admin/registry', withRequestOptions({}, options)),
    getSystemStatus: (options?: ApiRequestOptions) =>
        api.get<AdminSystemStatus>('/admin/system/status', withRequestOptions({}, options)),
    getConfigCenter: (params?: { dataId?: string; group?: string; namespace?: string }, options?: ApiRequestOptions) =>
        api.get<AdminConfigCenterSnapshot>('/admin/config-center', withRequestOptions({ params }, options)),
    publishConfigCenter: (payload: AdminConfigCenterPublishRequest, options?: ApiRequestOptions) =>
        postWithOptions<AdminConfigCenterSnapshot>('/admin/config-center/publish', payload, options),
    applyConfigCenter: (payload: AdminConfigCenterPublishRequest, options?: ApiRequestOptions) =>
        postWithOptions<AdminConfigCenterSnapshot>('/admin/config-center/apply', payload, options),
    getLogManagementStatus: (params?: { loggerName?: string }, options?: ApiRequestOptions) =>
        api.get<AdminLogManagementStatus>('/admin/logs', withRequestOptions({ params }, options)),
    setDebugLogging: (payload: AdminLogDebugRequest, options?: ApiRequestOptions) =>
        putWithOptions<AdminLogManagementStatus>('/admin/logs/debug', payload, options),
    downloadLogs: (params: { start: string; end: string; keyword?: string; level?: string }, options?: ApiRequestOptions) => api.get('/admin/logs/download', withRequestOptions({
        params,
        responseType: 'blob',
    }, options)),
    getTrafficControlStatus: (options?: ApiRequestOptions) => api.get<AdminTrafficControlStatus>('/admin/traffic-control', withRequestOptions({}, options)),
    clearRateLimitCounters: (options?: ApiRequestOptions) => postWithOptions<AdminTrafficControlStatus>('/admin/traffic-control/rate-limit/clear', null, options),
    resetCircuitBreaker: (name?: string, options?: ApiRequestOptions) => postWithOptions<AdminTrafficControlStatus>('/admin/traffic-control/circuit-breakers/reset', { name }, options),
    getAlerts: (params?: { status?: string; severity?: string; category?: string; limit?: number }, options?: ApiRequestOptions) =>
        api.get<SystemAlert[]>('/admin/alerts', withRequestOptions({
            params: {
                status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
                severity: normalizeTextParam(params?.severity, 40).toUpperCase() || undefined,
                category: normalizeTextParam(params?.category, 60).toUpperCase() || undefined,
                limit: normalizeBoundedPositiveInt(params?.limit, 100, 500),
            },
        }, options)).then(withArrayData),
    getAlertSummary: (options?: ApiRequestOptions) => api.get<SystemAlertSummary>('/admin/alerts/summary', withRequestOptions({}, options)),
    runAlertSelfCheck: (options?: ApiRequestOptions) => postWithOptions<void>('/admin/alerts/self-check', null, options),
    acknowledgeAlert: (id: number, note?: string, options?: ApiRequestOptions) => postWithOptions<SystemAlert>(`/admin/alerts/${toPathId(id)}/acknowledge`, { note: normalizeTextParam(note, 200) }, options),
    resolveAlert: (id: number, note?: string, options?: ApiRequestOptions) => postWithOptions<SystemAlert>(`/admin/alerts/${toPathId(id)}/resolve`, { note: normalizeTextParam(note, 200) }, options),
    acknowledgeAlerts: (ids: number[], note?: string, maxIds = 200, options?: ApiRequestOptions) =>
        postWithOptions<SystemAlertBatchActionResponse>('/admin/alerts/batch/acknowledge', {
            ids: normalizePositiveIntList(ids, maxIds),
            note: normalizeTextParam(note, 200),
        }, options),
    resolveAlerts: (ids: number[], note?: string, maxIds = 200, options?: ApiRequestOptions) =>
        postWithOptions<SystemAlertBatchActionResponse>('/admin/alerts/batch/resolve', {
            ids: normalizePositiveIntList(ids, maxIds),
            note: normalizeTextParam(note, 200),
        }, options),
    purgeResolvedAlerts: (retentionDays = 30, options?: ApiRequestOptions) =>
        (options
            ? api.post<SystemAlertPurgeResponse>('/admin/alerts/purge-resolved', null, withRequestOptions({
                params: { retentionDays: normalizeBoundedPositiveInt(retentionDays, 30, 3650) },
            }, options))
            : api.post<SystemAlertPurgeResponse>('/admin/alerts/purge-resolved', null, {
                params: { retentionDays: normalizeBoundedPositiveInt(retentionDays, 30, 3650) },
            })),
    getBugs: (params?: { page?: number; size?: number; status?: string; severity?: string; module?: string; keyword?: string; scanQueueOnly?: boolean }, signal?: AbortSignal) =>
        api.get<AdminBugReportPage>('/admin/bugs', {
            ...(signal ? { signal } : {}),
            params: {
                page: normalizeNonNegativeIntParam(params?.page, 0, 1_000_000),
                size: normalizeBoundedPositiveInt(params?.size, 20, 100),
                status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
                severity: normalizeTextParam(params?.severity, 20).toUpperCase() || undefined,
                module: normalizeTextParam(params?.module, 40).toUpperCase() || undefined,
                keyword: normalizeTextParam(params?.keyword, 120) || undefined,
                scanQueueOnly: Boolean(params?.scanQueueOnly),
            },
        }),
    getBug: (id: number, options?: ApiRequestOptions) => api.get<AdminBugReport>(`/admin/bugs/${toPathId(id)}`, withRequestOptions({}, options)),
    getBugSummary: (options?: ApiRequestOptions) => api.get<AdminBugReportSummary>('/admin/bugs/summary', withRequestOptions({}, options)),
    uploadBugAttachment: (file: File, options?: ApiRequestOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        return postWithOptions<AdminBugAttachmentUploadResponse>('/admin/bugs/attachments', formData, options);
    },
    downloadBugAttachment: (attachmentUrl: string, options?: ApiRequestOptions) => api.get<Blob>(normalizeBugAttachmentApiPath(attachmentUrl), withRequestOptions({
        responseType: 'blob',
    }, options)),
    createBug: (bug: Partial<AdminBugReport>, options?: ApiRequestOptions) => postWithOptions<AdminBugReport>('/admin/bugs', normalizeBugReportPayload(bug), options),
    updateBug: (id: number, bug: Partial<AdminBugReport>, options?: ApiRequestOptions) =>
        putWithOptions<AdminBugReport>(`/admin/bugs/${toPathId(id)}`, normalizeBugReportPayload(bug), options),
    updateBugStatus: (id: number, payload: Partial<AdminBugReport> & { note?: string }, options?: ApiRequestOptions) =>
        postWithOptions<AdminBugReport>(`/admin/bugs/${toPathId(id)}/status`, normalizeBugStatusPayload(payload), options),
    markBugScanned: (id: number, payload?: Partial<AdminBugReport> & { note?: string }, options?: ApiRequestOptions) =>
        postWithOptions<AdminBugReport>(`/admin/bugs/${toPathId(id)}/scan`, normalizeBugStatusPayload({ status: 'FIXING', ...(payload || {}) }), options),
    getIpBlacklist: (params?: { status?: string; source?: string; ipAddress?: string; limit?: number }, options?: ApiRequestOptions) =>
        api.get<IpBlacklistEntry[]>('/admin/ip-blacklist', {
            ...withRequestOptions({}, options),
            params: {
                status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
                source: normalizeTextParam(params?.source, 40).toUpperCase() || undefined,
                ipAddress: normalizeTextParam(params?.ipAddress, 45) || undefined,
                limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000),
            },
        }).then(withArrayData),
    getIpBlacklistStatus: (options?: ApiRequestOptions) => api.get<IpBlacklistStatus>('/admin/ip-blacklist/status', withRequestOptions({}, options)),
    blockIpAddress: (payload: { ipAddress: string; reason?: string; blockMinutes?: number }, options?: ApiRequestOptions) => {
        const body = {
            ipAddress: normalizeTextParam(payload.ipAddress, 45),
            reason: normalizeTextParam(payload.reason, 500),
            blockMinutes: payload.blockMinutes,
        };
        return options
            ? api.post<IpBlacklistEntry>('/admin/ip-blacklist', body, withRequestOptions({}, options))
            : api.post<IpBlacklistEntry>('/admin/ip-blacklist', body);
    },
    releaseIpBlacklistEntry: (id: number, options?: ApiRequestOptions) => options
        ? api.post<IpBlacklistEntry>(`/admin/ip-blacklist/${toPathId(id)}/release`, null, withRequestOptions({}, options))
        : api.post<IpBlacklistEntry>(`/admin/ip-blacklist/${toPathId(id)}/release`),
    releaseIpBlacklistEntries: (ids: number[], note?: string, maxIds = 100, options?: ApiRequestOptions) => {
        const body = {
            ids: normalizePositiveIntList(ids, maxIds),
            note: normalizeTextParam(note, 200),
        };
        return options
            ? api.post<IpBlacklistBatchReleaseResponse>('/admin/ip-blacklist/batch/release', body, withRequestOptions({}, options))
            : api.post<IpBlacklistBatchReleaseResponse>('/admin/ip-blacklist/batch/release', body);
    },
    getPetGalleryPhotos: (params?: { page?: number; size?: number; status?: string; source?: string; keyword?: string }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 12, 100),
            status: normalizeTextParam(params?.status, 40) || undefined,
            source: normalizeTextParam(params?.source, 40) || undefined,
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
        };
        return api.get<AdminPetGalleryPage | AdminPetGalleryPhoto[]>('/admin/pet-gallery', withRequestOptions({ params: normalizedParams }, options))
            .then(normalizeAdminPetGalleryPageResponse);
    },
    deletePetGalleryPhoto: (id: number, options?: ApiRequestOptions) => deleteWithOptions(`/admin/pet-gallery/${toPathId(id)}`, options).finally(clearPetGalleryCache),
    getUsersPage: (params?: { keyword?: string; role?: string; status?: string; page?: number; size?: number }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        const cacheKey = `${normalizedParams.keyword || ''}:${normalizedParams.role || ''}:${normalizedParams.status || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(adminUserCache, adminUserRequests, cacheKey, ADMIN_USER_CACHE_MS, () =>
            api.get<AdminUserPage | User[]>('/admin/users', withRequestOptions({ params: normalizedParams }, cacheLoaderOptions(options))).then(normalizeAdminUserPageResponse), options);
    },
    getUsers: (params?: { keyword?: string; role?: string; status?: string }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
            page: 1,
            size: 100,
        };
        const cacheKey = `${normalizedParams.keyword || ''}:${normalizedParams.role || ''}:${normalizedParams.status || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(adminUserCache, adminUserRequests, cacheKey, ADMIN_USER_CACHE_MS, () =>
            api.get<AdminUserPage | User[]>('/admin/users', withRequestOptions({ params: normalizedParams }, cacheLoaderOptions(options))).then(normalizeAdminUserPageResponse), options)
            .then((response) => ({ ...response, data: response.data.items }) as AxiosResponse<User[]>);
    },
    getUserSummary: (params?: { keyword?: string; role?: string; status?: string }, options?: ApiRequestOptions) => api.get<UserAdminSummary>('/admin/users/summary', withRequestOptions({
        params: {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
        },
    }, options)),
    exportUsers: (params?: { keyword?: string; role?: string; status?: string }, options?: ApiRequestOptions) => api.get('/admin/users/export', withRequestOptions({
        params: {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            role: normalizeTextParam(params?.role, 40) || undefined,
            status: normalizeTextParam(params?.status, 40) || undefined,
        },
        responseType: 'blob',
    }, options)),
    updateUser: (id: number, user: AdminUserUpdatePayload, options?: ApiRequestOptions) => putWithOptions(`/admin/users/${toPathId(id)}`, normalizeAdminUserUpdatePayload(user), options)
        .then((response) => {
            clearAdminUserCache();
            if (user.status) {
                clearAdminPermissionsCache();
                clearAdminRoleCache();
                dispatchDomEvent('shop:admin-permissions-updated');
            }
            return response;
        }),
    assignUserRole: (id: number, roleCode: string, options?: ApiRequestOptions) => (options
        ? api.put<User>(`/admin/users/${toPathId(id)}/role-code`, { roleCode: normalizeTextParam(roleCode, 80) }, withRequestOptions({}, options))
        : api.put<User>(`/admin/users/${toPathId(id)}/role-code`, { roleCode: normalizeTextParam(roleCode, 80) }))
        .then((response) => {
            clearAdminUserCache();
            clearAdminPermissionsCache();
            clearAdminRoleCache();
            dispatchDomEvent('shop:admin-permissions-updated');
            return response;
        }),
    deleteUser: (id: number, options?: ApiRequestOptions) => deleteWithOptions(`/admin/users/${toPathId(id)}`, options).finally(clearAdminUserCache),
    getRoles: (options?: ApiRequestOptions) => cachedGet(
        adminRoleCache,
        adminRoleRequests,
        'roles',
        ADMIN_ROLE_CACHE_MS,
        // The pending request is shared across callers, so the per-caller signal must
        // not reach it; cachedGet applies the signal to this caller's promise instead.
        () => api.get<AdminRole[]>('/admin/roles', withRequestOptions({}, cacheLoaderOptions(options))),
        options,
    ),
    saveRole: (role: Partial<AdminRole>, options?: ApiRequestOptions) => postWithOptions<AdminRole>('/admin/roles', normalizeAdminRolePayload(role), options)
        .then((response) => {
            clearAdminRoleCache();
            clearAdminUserCache();
            clearAdminPermissionsCache();
            dispatchDomEvent('shop:admin-permissions-updated');
            return response;
        }),
    getMyPermissions: (options?: ApiRequestOptions) => {
        if (options?.bypassCache) {
            clearAdminPermissionsCache();
        }
        if (options?.signal) {
            return api.get<{ role: string; roleCode?: string; permissions: string[] }>(
                '/admin/me/permissions',
                withRequestOptions({}, options),
            ).then((response) => {
                if (!options.bypassCache) {
                    adminRuntime.permissionsCache = { response, expiresAt: Date.now() + 30_000 };
                }
                return response;
            });
        }
        if (!options?.bypassCache && adminRuntime.permissionsCache && adminRuntime.permissionsCache.expiresAt > Date.now()) {
            return Promise.resolve(adminRuntime.permissionsCache.response);
        }
        if (!options?.bypassCache && adminRuntime.permissionsRequest) return adminRuntime.permissionsRequest;
        adminRuntime.permissionsRequest = api.get<{ role: string; roleCode?: string; permissions: string[] }>('/admin/me/permissions')
            .then((response) => {
                if (!options?.bypassCache) {
                    adminRuntime.permissionsCache = { response, expiresAt: Date.now() + 30_000 };
                }
                return response;
            })
            .finally(() => {
                adminRuntime.permissionsRequest = null;
            });
        return adminRuntime.permissionsRequest;
    },
    getOrders: (status?: string, options?: ApiRequestOptions) => {
        const normalizedStatus = normalizeTextParam(status, 40) || undefined;
        return cachedGet(
            adminOrderCache,
            adminOrderRequests,
            `page-compat:${normalizedStatus || ''}`,
            ADMIN_ORDER_CACHE_MS,
            () => api.get<AdminOrderPage>('/admin/orders/page', {
                params: { status: normalizedStatus, page: 1, size: 20 },
                ...withRequestOptions({}, cacheLoaderOptions(options)),
            }),
            options,
        );
    },
    getOrdersPage: (params?: { status?: string; search?: string; quick?: string; page?: number; size?: number }, options?: ApiRequestOptions) => {
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
            () => api.get<AdminOrderPage>('/admin/orders/page', withRequestOptions({ params: normalizedParams }, cacheLoaderOptions(options))),
            options,
        );
    },
    getOrder: (id: number, options?: ApiRequestOptions) => api.get<Order>(`/admin/orders/${toPathId(id)}`, withRequestOptions({}, options)),
    exportOrders: (status?: string, search?: string, quick?: string, options?: ApiRequestOptions) => api.get('/admin/orders/export', withRequestOptions({
        params: {
            status: normalizeTextParam(status, 40) || undefined,
            search: normalizeTextParam(search, 120) || undefined,
            quick: normalizeTextParam(quick, 40) || undefined,
        },
        responseType: 'blob',
    }, options)),
    getAuditLogs: (params?: Record<string, unknown>, options?: ApiRequestOptions) => api.get<SecurityAuditLog[]>('/admin/audit-logs', withRequestOptions({
        params: normalizeAuditLogParams(params, { includeLimit: true }),
    }, options)).then(withArrayData),
    getAuditLogSummary: (params?: Record<string, unknown>, options?: ApiRequestOptions) => api.get<SecurityAuditSummary>('/admin/audit-logs/summary', withRequestOptions({
        params: normalizeAuditLogParams(params, { includeTopLimit: true }),
    }, options)),
    purgeAuditLogs: (retentionDays = 180, options?: ApiRequestOptions) => (options
        ? api.post<SecurityAuditPurgeResponse>('/admin/audit-logs/purge', null, withRequestOptions({
            params: { retentionDays: normalizeBoundedPositiveInt(retentionDays, 180, 3650) },
        }, options))
        : api.post<SecurityAuditPurgeResponse>('/admin/audit-logs/purge', null, {
            params: { retentionDays: normalizeBoundedPositiveInt(retentionDays, 180, 3650) },
        })),
    exportAuditLogs: (params?: Record<string, unknown>, options?: ApiRequestOptions) => api.get('/admin/audit-logs/export', withRequestOptions({
        params: normalizeAuditLogParams(params),
        responseType: 'blob',
    }, options)),
    updateOrderStatus: (id: number, status: string, trackingNumber?: string, trackingCarrierCode?: string, options?: ApiRequestOptions) =>
        putWithOptions(`/admin/orders/${toPathId(id)}/status`, {
            status: normalizeTextParam(status, 40),
            trackingNumber: normalizeTextParam(trackingNumber, 120) || undefined,
            trackingCarrierCode: normalizeTextParam(trackingCarrierCode, 40) || undefined,
        }, options).finally(clearAdminOrderCache),
    getOrderItems: (orderId: number, options?: ApiRequestOptions) => api.get<OrderItem[]>(`/admin/orders/${toPathId(orderId)}/items`, withRequestOptions({}, options)).then(withArrayData),
    getOrderPayments: (orderId: number, options?: ApiRequestOptions) => api.get<AdminPayment[]>(`/admin/orders/${toPathId(orderId)}/payments`, withRequestOptions({}, options)).then(withArrayData),
    syncOrderPayment: (paymentId: number, options?: ApiRequestOptions) => postWithOptions<AdminPayment>(`/admin/orders/payments/${toPathId(paymentId)}/sync`, null, options),
    getProducts: (params?: { keyword?: string; categoryId?: number; status?: string; featured?: boolean; discount?: boolean; minPrice?: number; maxPrice?: number; page?: number; size?: number; sort?: string }, options?: ApiRequestOptions) =>
        api.get<AdminProductPage | Product[]>('/admin/products', withRequestOptions({
            params: params ? {
                keyword: normalizeTextParam(params.keyword, 120) || undefined,
                categoryId: normalizePositiveInt(params.categoryId) || undefined,
                status: normalizeTextParam(params.status, MAX_PRODUCT_STATUS_LENGTH).toUpperCase() || undefined,
                featured: params.featured,
                discount: params.discount,
                ...normalizePriceRange(params.minPrice, params.maxPrice),
                page: params.page == null ? undefined : normalizeNonNegativeIntParam(params.page, 0, 1_000_000),
                size: params.size == null ? undefined : normalizeBoundedPositiveInt(params.size, 50, 500),
                sort: normalizeTextParam(params.sort, 80) || undefined,
            } : undefined,
        }, options)).then(normalizeProductAdminPageResponse),
    getInventorySummary: (options?: ApiRequestOptions) => api.get<AdminInventorySummary>('/admin/products/inventory-summary', withRequestOptions({}, options)),
    createProduct: (product: ProductMutationPayload, options?: ApiRequestOptions) =>
        postWithOptions<Product>('/admin/products', normalizeProductPayload(product), options).finally(() => clearProductCache()),
    updateProduct: (id: number, product: ProductMutationPayload, options?: ApiRequestOptions) =>
        putWithOptions<Product>(`/admin/products/${toPathId(id)}`, normalizeProductPayload(product), options).finally(() => clearProductCache(toPathId(id))),
    deleteProduct: (id: number, options?: ApiRequestOptions) =>
        deleteWithOptions(`/admin/products/${toPathId(id)}`, options).finally(() => clearProductCache(toPathId(id))),
    getProductCategories: (options?: ApiRequestOptions) => api.get<Category[]>('/admin/products/categories/options', withRequestOptions({ params: { limit: 500 } }, options))
        .then(withArrayData)
        .catch((error) => {
            if (!isMissingAdminOptionEndpointError(error)) throw error;
            return api.get<Category[]>('/admin/categories', withRequestOptions({ params: { limit: 500 } }, options)).then(withArrayData);
        }),
    getProductBrands: (params?: { activeOnly?: boolean }, options?: ApiRequestOptions) =>
        api.get<Brand[]>('/admin/products/brands/options', withRequestOptions({ params: { activeOnly: params?.activeOnly === undefined ? undefined : Boolean(params.activeOnly), limit: 500 } }, options))
            .then(withArrayData)
            .catch((error) => {
                if (!isMissingAdminOptionEndpointError(error)) throw error;
                return api.get<Brand[]>('/admin/brands', withRequestOptions({ params: { activeOnly: params?.activeOnly === undefined ? undefined : Boolean(params.activeOnly), limit: 500 } }, options)).then(withArrayData);
            }),
    getCategories: (options?: ApiRequestOptions) => api.get<Category[]>('/admin/categories', withRequestOptions({ params: { limit: 500 } }, options)).then(withArrayData),
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
    getBrands: (params?: { activeOnly?: boolean }, options?: ApiRequestOptions) =>
        api.get<Brand[]>('/admin/brands', withRequestOptions({
            params: { activeOnly: params?.activeOnly === undefined ? undefined : Boolean(params.activeOnly), limit: 500 },
        }, options)).then(withArrayData),
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
    refundOrder: (id: number, payload: { reason?: string; restock?: boolean; manualRefundReference?: string }, options?: ApiRequestOptions) =>
        postWithOptions<{ message: string; payment: AdminPayment }>(`/admin/orders/${toPathId(id)}/refund`, {
            reason: normalizeTextParam(payload.reason, 1000) || undefined,
            restock: Boolean(payload.restock),
            manualRefundReference: normalizeTextParam(payload.manualRefundReference, 128) || undefined,
        }, options).finally(clearAdminOrderCache),
    batchShipOrders: (orderIds: number[], trackingPrefix: string, trackingCarrierCode?: string, options?: ApiRequestOptions) =>
        postWithOptions<AdminOrderBatchShipResponse>('/admin/orders/batch-ship', {
            orderIds: normalizePositiveIntList(orderIds, 100),
            trackingPrefix: normalizeTextParam(trackingPrefix, 80),
            trackingCarrierCode: normalizeTextParam(trackingCarrierCode, 40) || undefined,
        }, options).finally(clearAdminOrderCache),
    updateProductStatus: (id: number, status: string, options?: ApiRequestOptions) =>
        putWithOptions(`/admin/products/${toPathId(id)}/status`, { status: normalizeTextParam(status, MAX_PRODUCT_STATUS_LENGTH) }, options).finally(() => clearProductCache(toPathId(id))),
    batchUpdateProductStatus: (productIds: number[], status: string, options?: ApiRequestOptions) =>
        postWithOptions<AdminProductBatchStatusResponse>('/admin/products/batch-status', { productIds: normalizePositiveIntList(productIds, 100), status: normalizeTextParam(status, MAX_PRODUCT_STATUS_LENGTH) }, options).finally(() => clearProductCache()),
    importProducts: (file: File, options?: ApiRequestOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        return postWithOptions<ProductImportResult>('/admin/products/import', formData, options).finally(() => clearProductCache());
    },
    previewImportProducts: (file: File, options?: ApiRequestOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        return postWithOptions<ProductImportResult>('/admin/products/import/preview', formData, options);
    },
    getProductImportHistory: (limit = 6, options?: ApiRequestOptions) =>
        api.get<ProductImportHistoryEntry[]>('/admin/products/import/history', withRequestOptions({
            params: { limit: normalizeBoundedPositiveInt(limit, 6, 20) },
        }, options)).then(withArrayData),
    importProductFromUrl: (url: string) =>
        api.post<ProductUrlImportPreview>('/admin/products/import-url', { url: normalizeTextParam(url, 2048) }),
    getReviews: (params?: { status?: string; search?: string; page?: number; size?: number }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        const cacheKey = `reviews:${normalizedParams.status || ''}:${normalizedParams.search || ''}:${normalizedParams.page}:${normalizedParams.size}`;
        return cachedGet(adminReviewCache, adminReviewRequests, cacheKey, ADMIN_REVIEW_CACHE_MS, () =>
            api.get<AdminReviewPage | Review[]>('/admin/reviews', withRequestOptions({ params: normalizedParams }, cacheLoaderOptions(options))).then(normalizeAdminReviewPageResponse), options);
    },
    deleteReview: (id: number, options?: ApiRequestOptions) => deleteWithOptions(`/admin/reviews/${toPathId(id)}`, options).finally(() => {
        clearReviewCache();
        clearAdminReviewCache();
    }),
    replyReview: (id: number, reply: string, options?: ApiRequestOptions) => putWithOptions<Review>(`/admin/reviews/${toPathId(id)}/reply`, { reply: normalizeTextParam(reply, 2000) }, options).finally(() => {
        clearReviewCache();
        clearAdminReviewCache();
    }),
    updateReviewStatus: (id: number, status: string, options?: ApiRequestOptions) => putWithOptions<Review>(`/admin/reviews/${toPathId(id)}/status`, { status: normalizeTextParam(status, 40) }, options).finally(() => {
        clearReviewCache();
        clearAdminReviewCache();
    }),
    getQuestionSummary: (params?: { status?: string; search?: string }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
        };
        return api.get<ProductQuestionAdminSummary>('/admin/questions/summary', withRequestOptions({ params: normalizedParams }, options));
    },
    getQuestions: (params?: { status?: string; search?: string; limit?: number }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            search: normalizeTextParam(params?.search, 120) || undefined,
            limit: normalizeBoundedPositiveInt(params?.limit, 200, 1000),
        };
        const cacheKey = `${normalizedParams.status || ''}:${normalizedParams.search || ''}:${normalizedParams.limit}`;
        return cachedGet(adminQuestionCache, adminQuestionRequests, cacheKey, ADMIN_REVIEW_CACHE_MS, () =>
            api.get<ProductQuestion[]>('/admin/questions', withRequestOptions({ params: normalizedParams }, cacheLoaderOptions(options))).then(withArrayData), options);
    },
    answerQuestion: (id: number, answer: string, options?: ApiRequestOptions) =>
        putWithOptions<ProductQuestion>(`/admin/questions/${toPathId(id)}/answer`, { answer: normalizeTextParam(answer, 1000) }, options)
            .finally(() => {
                clearQuestionCache();
                clearAdminQuestionCache();
            }),
    deleteQuestion: (id: number, options?: ApiRequestOptions) => deleteWithOptions(`/admin/questions/${toPathId(id)}`, options)
        .finally(() => {
            clearQuestionCache();
            clearAdminQuestionCache();
        }),
    getCouponSummary: (params?: { keyword?: string; status?: string; scope?: string }, options?: ApiRequestOptions) => api.get<CouponAdminSummary>('/admin/coupons/summary', withRequestOptions({
        params: {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            scope: normalizeTextParam(params?.scope, 40).toUpperCase() || undefined,
        },
    }, options)),
    getCoupons: (params?: { keyword?: string; status?: string; scope?: string; page?: number; size?: number }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            scope: normalizeTextParam(params?.scope, 40).toUpperCase() || undefined,
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        return api.get<AdminCouponPage | Coupon[]>('/admin/coupons', withRequestOptions({ params: normalizedParams }, options))
            .then(normalizeAdminCouponPageResponse);
    },
    createCoupon: (coupon: Partial<Coupon>, options?: ApiRequestOptions) => {
        const body = normalizeCouponPayload(coupon);
        return (options
            ? api.post<Coupon>('/admin/coupons', body, withRequestOptions({}, options))
            : api.post<Coupon>('/admin/coupons', body)
        ).finally(clearCouponCache);
    },
    updateCoupon: (id: number, coupon: Partial<Coupon>, options?: ApiRequestOptions) => {
        const body = normalizeCouponPayload(coupon);
        return (options
            ? api.put<Coupon>(`/admin/coupons/${toPathId(id)}`, body, withRequestOptions({}, options))
            : api.put<Coupon>(`/admin/coupons/${toPathId(id)}`, body)
        ).finally(clearCouponCache);
    },
    deleteCoupon: (id: number, options?: ApiRequestOptions) => (options
        ? api.delete(`/admin/coupons/${toPathId(id)}`, withRequestOptions({}, options))
        : api.delete(`/admin/coupons/${toPathId(id)}`)
    ).finally(clearCouponCache),
    grantCoupon: (id: number, userIds: number[], maxUsers = 100, options?: ApiRequestOptions) => {
        const body = { userIds: normalizePositiveIntList(userIds, maxUsers) };
        return (options
            ? api.post<{ granted: number }>(`/admin/coupons/${toPathId(id)}/grant`, body, withRequestOptions({}, options))
            : api.post<{ granted: number }>(`/admin/coupons/${toPathId(id)}/grant`, body)
        ).finally(clearCouponCache);
    },
    runPetBirthdayCoupons: (options?: ApiRequestOptions) => (options
        ? api.post<{ granted: number }>('/admin/pet-birthday-coupons/run', null, withRequestOptions({}, options))
        : api.post<{ granted: number }>('/admin/pet-birthday-coupons/run')
    ).finally(clearCouponCache),
    getPetBirthdayCouponConfig: (options?: ApiRequestOptions) => api.get<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config', withRequestOptions({}, options)),
    updatePetBirthdayCouponConfig: (config: Partial<PetBirthdayCouponConfig>, options?: ApiRequestOptions) => options
        ? api.put<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config', config, withRequestOptions({}, options))
        : api.put<PetBirthdayCouponConfig>('/admin/pet-birthday-coupons/config', config),
    broadcastNotification: (payload: { type: string; title: string; message: string; contentFormat: 'TEXT' | 'HTML' }, options?: ApiRequestOptions) =>
        postWithOptions<{ sent: number }>('/admin/notifications/broadcast', payload, options),
    getAnnouncementSummary: (params?: { status?: string; keyword?: string }, options?: ApiRequestOptions) => api.get<SiteAnnouncementAdminSummary>('/admin/announcements/summary', withRequestOptions({
        params: {
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
        },
    }, options)),
    getAnnouncements: (params?: { page?: number; size?: number; status?: string; keyword?: string }, options?: ApiRequestOptions) => {
        const normalizedParams = {
            page: normalizeBoundedPositiveInt(params?.page, 1, 1_000_000),
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
            status: normalizeTextParam(params?.status, 40).toUpperCase() || undefined,
            keyword: normalizeTextParam(params?.keyword, 120) || undefined,
        };
        const config = params ? { params: normalizedParams } : {};
        return api.get<SiteAnnouncementAdminPage | SiteAnnouncement[]>('/admin/announcements', withRequestOptions(config, options))
            .then(normalizeSiteAnnouncementPageResponse);
    },
    createAnnouncement: (announcement: Partial<SiteAnnouncement>, options?: ApiRequestOptions) =>
        postWithOptions<SiteAnnouncement>('/admin/announcements', normalizeAnnouncementPayload(announcement), options).finally(clearAnnouncementCache),
    updateAnnouncement: (id: number, announcement: Partial<SiteAnnouncement>, options?: ApiRequestOptions) =>
        putWithOptions<SiteAnnouncement>(`/admin/announcements/${toPathId(id)}`, normalizeAnnouncementPayload(announcement), options).finally(clearAnnouncementCache),
    deleteAnnouncement: (id: number, options?: ApiRequestOptions) => deleteWithOptions(`/admin/announcements/${toPathId(id)}`, options).finally(clearAnnouncementCache),
    getSeckillCampaigns: (options?: ApiRequestOptions) => api.get<SeckillCampaign[]>('/admin/seckill/campaigns', withRequestOptions({}, options)),
    createSeckillCampaign: (payload: SeckillCampaignWritePayload, options?: ApiRequestOptions) =>
        postWithOptions<SeckillCampaign>('/admin/seckill/campaigns', payload, options),
    updateSeckillCampaign: (id: number, payload: SeckillCampaignWritePayload, options?: ApiRequestOptions) =>
        putWithOptions<SeckillCampaign>(`/admin/seckill/campaigns/${toPathId(id)}`, payload, options),
    updateSeckillStatus: (id: number, status: SeckillCampaignWritePayload['status'], options?: ApiRequestOptions) =>
        (options
            ? api.post<SeckillCampaign>(`/admin/seckill/campaigns/${toPathId(id)}/status`, null, withRequestOptions({ params: { status } }, options))
            : api.post<SeckillCampaign>(`/admin/seckill/campaigns/${toPathId(id)}/status`, null, { params: { status } })),
};

export const adminSupportApi = {
    getSummary: (options?: ApiRequestOptions) => api.get<SupportAdminSummary>('/admin/support/summary', withRequestOptions({}, options)),
    getSessions: (params?: string | AdminSupportSessionQuery, options?: ApiRequestOptions) =>
        api.get<SupportAdminSessionPage | SupportSession[]>('/admin/support/sessions', withRequestOptions({
            params: normalizeAdminSupportSessionParams(params),
        }, options)).then(normalizeAdminSupportSessionPageResponse),
    getMessages: (sessionId: number, params?: SupportMessageQuery, options?: ApiRequestOptions) =>
        api.get<SupportMessage[]>(`/admin/support/sessions/${toPathId(sessionId)}/messages`, withRequestOptions({
            params: normalizeSupportMessageParams(params),
        }, options || (params?.signal ? { signal: params.signal } : undefined))),
    sendMessage: (sessionId: number, content: string, options?: ApiRequestOptions) => {
        const body = { content: normalizeSupportMessageContent(content) };
        return options
            ? api.post<{ message: SupportMessage; session: SupportSession }>(`/admin/support/sessions/${toPathId(sessionId)}/messages`, body, withRequestOptions({}, options))
            : api.post<{ message: SupportMessage; session: SupportSession }>(`/admin/support/sessions/${toPathId(sessionId)}/messages`, body);
    },
    markRead: (sessionId: number, options?: ApiRequestOptions) => options
        ? api.put(`/admin/support/sessions/${toPathId(sessionId)}/read`, null, withRequestOptions({}, options))
        : api.put(`/admin/support/sessions/${toPathId(sessionId)}/read`),
    closeSession: (sessionId: number, options?: ApiRequestOptions) => options
        ? api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/close`, null, withRequestOptions({}, options))
        : api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/close`),
    assignSession: (sessionId: number, options?: ApiRequestOptions) => options
        ? api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/assign`, null, withRequestOptions({}, options))
        : api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/assign`),
    reopenSession: (sessionId: number, options?: ApiRequestOptions) => options
        ? api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/reopen`, null, withRequestOptions({}, options))
        : api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/reopen`),
    reissueBirthdayCoupons: (sessionId: number, options?: ApiRequestOptions) => options
        ? api.post<{ granted: number }>(`/admin/support/sessions/${toPathId(sessionId)}/birthday-coupons/reissue`, null, withRequestOptions({}, options))
        : api.post<{ granted: number }>(`/admin/support/sessions/${toPathId(sessionId)}/birthday-coupons/reissue`),
    getUnreadCount: (options?: ApiRequestOptions) => options
        ? api.get<{ count: number }>('/admin/support/unread-count', withRequestOptions({}, options))
        : api.get<{ count: number }>('/admin/support/unread-count'),
};
