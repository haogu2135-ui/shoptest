import type { AxiosResponse } from 'axios';
import { cachedGet } from './cache';
import { dispatchDomEvent } from '../utils/domEvents';
import type {
  User,
  UserAdminSummary,
  AdminUserPage,
  Product,
  AdminProductPage,
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
} from './core';
import type {
  AdminSupportSessionQuery,
  AdminUserUpdatePayload,
  ApiRequestOptions,
  SupportMessageQuery,
} from './core';

export const adminApi = {
    getDashboard: () => {
        if (adminRuntime.dashboardCache && adminRuntime.dashboardCache.expiresAt > Date.now()) {
            return Promise.resolve(adminRuntime.dashboardCache.response);
        }
        if (adminRuntime.dashboardRequest) return adminRuntime.dashboardRequest;
        adminRuntime.dashboardRequest = api.get<DashboardStats>('/admin/dashboard')
            .then((response) => {
                adminRuntime.dashboardCache = { response, expiresAt: Date.now() + ADMIN_DASHBOARD_CACHE_MS };
                return response;
            })
            .finally(() => {
                adminRuntime.dashboardRequest = null;
            });
        return adminRuntime.dashboardRequest;
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
    getBug: (id: number) => api.get<AdminBugReport>(`/admin/bugs/${toPathId(id)}`),
    getBugSummary: () => api.get<AdminBugReportSummary>('/admin/bugs/summary'),
    uploadBugAttachment: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<AdminBugAttachmentUploadResponse>('/admin/bugs/attachments', formData);
    },
    downloadBugAttachment: (attachmentUrl: string) => api.get<Blob>(normalizeBugAttachmentApiPath(attachmentUrl), {
        responseType: 'blob',
    }),
    createBug: (bug: Partial<AdminBugReport>) => api.post<AdminBugReport>('/admin/bugs', normalizeBugReportPayload(bug)),
    updateBug: (id: number, bug: Partial<AdminBugReport>) =>
        api.put<AdminBugReport>(`/admin/bugs/${toPathId(id)}`, normalizeBugReportPayload(bug)),
    updateBugStatus: (id: number, payload: Partial<AdminBugReport> & { note?: string }) =>
        api.post<AdminBugReport>(`/admin/bugs/${toPathId(id)}/status`, normalizeBugStatusPayload(payload)),
    markBugScanned: (id: number, payload?: Partial<AdminBugReport> & { note?: string }) =>
        api.post<AdminBugReport>(`/admin/bugs/${toPathId(id)}/scan`, normalizeBugStatusPayload({ status: 'FIXING', ...(payload || {}) })),
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
    updateUser: (id: number, user: AdminUserUpdatePayload) => api.put(`/admin/users/${toPathId(id)}`, normalizeAdminUserUpdatePayload(user))
        .then((response) => {
            clearAdminUserCache();
            if (user.status) {
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
    getMyPermissions: (options?: ApiRequestOptions) => {
        if (options?.bypassCache) {
            clearAdminPermissionsCache();
        }
        if (options?.signal) {
            return api.get<{ role: string; roleCode?: string; permissions: string[] }>(
                '/admin/me/permissions',
                withRequestOptions({}, options),
            ).then((response) => {
                adminRuntime.permissionsCache = { response, expiresAt: Date.now() + 30_000 };
                return response;
            });
        }
        if (!options?.bypassCache && adminRuntime.permissionsCache && adminRuntime.permissionsCache.expiresAt > Date.now()) {
            return Promise.resolve(adminRuntime.permissionsCache.response);
        }
        if (!options?.bypassCache && adminRuntime.permissionsRequest) return adminRuntime.permissionsRequest;
        adminRuntime.permissionsRequest = api.get<{ role: string; roleCode?: string; permissions: string[] }>('/admin/me/permissions')
            .then((response) => {
                adminRuntime.permissionsCache = { response, expiresAt: Date.now() + 30_000 };
                return response;
            })
            .finally(() => {
                adminRuntime.permissionsRequest = null;
            });
        return adminRuntime.permissionsRequest;
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
    getProducts: (params?: { keyword?: string; categoryId?: number; status?: string; featured?: boolean; discount?: boolean; minPrice?: number; maxPrice?: number; page?: number; size?: number; sort?: string }) =>
        api.get<AdminProductPage | Product[]>('/admin/products', {
            params: params ? {
                keyword: normalizeTextParam(params.keyword, 120) || undefined,
                categoryId: normalizePositiveInt(params.categoryId) || undefined,
                status: normalizeTextParam(params.status, MAX_PRODUCT_STATUS_LENGTH).toUpperCase() || undefined,
                featured: params.featured,
                discount: params.discount,
                minPrice: params.minPrice == null ? undefined : normalizeNonNegativeNumberParam(params.minPrice),
                maxPrice: params.maxPrice == null ? undefined : normalizeNonNegativeNumberParam(params.maxPrice),
                page: params.page == null ? undefined : normalizeNonNegativeIntParam(params.page, 0, 1_000_000),
                size: params.size == null ? undefined : normalizeBoundedPositiveInt(params.size, 50, 500),
                sort: normalizeTextParam(params.sort, 80) || undefined,
            } : undefined,
        }).then(normalizeProductAdminPageResponse),
    createProduct: (product: ProductMutationPayload) =>
        api.post<Product>('/admin/products', normalizeProductPayload(product)).finally(() => clearProductCache()),
    updateProduct: (id: number, product: ProductMutationPayload) =>
        api.put<Product>(`/admin/products/${toPathId(id)}`, normalizeProductPayload(product)).finally(() => clearProductCache(toPathId(id))),
    deleteProduct: (id: number) =>
        api.delete(`/admin/products/${toPathId(id)}`).finally(() => clearProductCache(toPathId(id))),
    getProductCategories: () => api.get<Category[]>('/admin/products/categories/options', { params: { limit: 500 } })
        .then(withArrayData)
        .catch((error) => {
            if (!isMissingAdminOptionEndpointError(error)) throw error;
            return api.get<Category[]>('/admin/categories', { params: { limit: 500 } }).then(withArrayData);
        }),
    getProductBrands: (params?: { activeOnly?: boolean }) =>
        api.get<Brand[]>('/admin/products/brands/options', { params: { activeOnly: params?.activeOnly ? true : undefined, limit: 500 } })
            .then(withArrayData)
            .catch((error) => {
                if (!isMissingAdminOptionEndpointError(error)) throw error;
                return api.get<Brand[]>('/admin/brands', { params: { activeOnly: params?.activeOnly ? true : undefined, limit: 500 } }).then(withArrayData);
            }),
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
        api.put(`/admin/products/${toPathId(id)}/status`, { status: normalizeTextParam(status, MAX_PRODUCT_STATUS_LENGTH) }).finally(() => clearProductCache(toPathId(id))),
    batchUpdateProductStatus: (productIds: number[], status: string) =>
        api.post('/admin/products/batch-status', { productIds: normalizePositiveIntList(productIds, 100), status: normalizeTextParam(status, MAX_PRODUCT_STATUS_LENGTH) }).finally(() => clearProductCache()),
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
            size: normalizeBoundedPositiveInt(params?.size, 20, 100),
        };
        return api.get<AdminCouponPage | Coupon[]>('/admin/coupons', { params: normalizedParams })
            .then(normalizeAdminCouponPageResponse);
    },
    createCoupon: (coupon: Partial<Coupon>) => api.post<Coupon>('/admin/coupons', normalizeCouponPayload(coupon)).finally(clearCouponCache),
    updateCoupon: (id: number, coupon: Partial<Coupon>) => api.put<Coupon>(`/admin/coupons/${toPathId(id)}`, normalizeCouponPayload(coupon)).finally(clearCouponCache),
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
    createAnnouncement: (announcement: Partial<SiteAnnouncement>) =>
        api.post<SiteAnnouncement>('/admin/announcements', normalizeAnnouncementPayload(announcement)).finally(clearAnnouncementCache),
    updateAnnouncement: (id: number, announcement: Partial<SiteAnnouncement>) =>
        api.put<SiteAnnouncement>(`/admin/announcements/${toPathId(id)}`, normalizeAnnouncementPayload(announcement)).finally(clearAnnouncementCache),
    deleteAnnouncement: (id: number) => api.delete(`/admin/announcements/${toPathId(id)}`).finally(clearAnnouncementCache),
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
        api.post<{ message: SupportMessage; session: SupportSession }>(`/admin/support/sessions/${toPathId(sessionId)}/messages`, {
            content: normalizeSupportMessageContent(content),
        }),
    markRead: (sessionId: number) => api.put(`/admin/support/sessions/${toPathId(sessionId)}/read`),
    closeSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/close`),
    assignSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/assign`),
    reopenSession: (sessionId: number) => api.put<SupportSession>(`/admin/support/sessions/${toPathId(sessionId)}/reopen`),
    reissueBirthdayCoupons: (sessionId: number) =>
        api.post<{ granted: number }>(`/admin/support/sessions/${toPathId(sessionId)}/birthday-coupons/reissue`),
    getUnreadCount: () => api.get<{ count: number }>('/admin/support/unread-count'),
};
