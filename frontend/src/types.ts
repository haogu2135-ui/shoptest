export interface User {
    id: number;
    username: string;
    email: string;
    phone?: string;
    address?: string;
    role: string;
    roleCode?: string;
    password?: string;
    status?: string;
    createdAt?: string;
}

export interface UserProfile {
    id: number;
    username: string;
    email: string;
    phone?: string;
    role: string;
    roleCode?: string;
}

export interface UserAdminSummary {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    adminUsers: number;
    customerUsers: number;
    missingEmailUsers: number;
    missingPhoneUsers: number;
    readyUsers: number;
    adminRatioPercent: number;
    healthScore: number;
    checkedAt?: string;
}

export interface AdminUserPage {
    items: User[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
}

export interface AdminRole {
    id?: number;
    code: string;
    name: string;
    description?: string;
    status?: string;
    permissions: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface DashboardStats {
    totalProducts: number;
    totalOrders: number;
    totalUsers: number;
    totalRevenue: number;
    grossOrderAmount?: number;
    grossPaidRevenue?: number;
    refundedOrders?: number;
    refundedAmount?: number;
    refundingPayments?: number;
    netRevenue?: number;
    refundRate?: number;
    operationsSlaRiskTotal?: number;
    operationsSlaRisks?: {
        stalePendingPayment?: number;
        delayedShipment?: number;
        returnAwaitingShipment?: number;
        refundDue?: number;
    };
    paidOrders?: number;
    cancelledOrders?: number;
    pendingPaymentOrders?: number;
    pendingShipmentOrders?: number;
    shippedOrders?: number;
    ordersWithTracking?: number;
    ordersWithoutTracking?: number;
    completedOrders?: number;
    activeProducts?: number;
    pendingProducts?: number;
    lowStockProducts?: number;
    averageOrderValue?: number;
    conversionRate?: number;
    recentOrders: Order[];
    orderStatusBreakdown: Record<string, number>;
    paymentMethodBreakdown?: Record<string, number>;
    salesTrend?: Array<{ date: string; orders: number; revenue: number }>;
    topProducts?: Array<{ productId: number; productName: string; imageUrl?: string; quantity: number; revenue: number }>;
    lowStockList?: Product[];
}

export interface AdminRegistryInstance {
    serviceId: string;
    host: string;
    port: number;
    secure: boolean;
    uri: string;
    metadata?: Record<string, string>;
}

export interface AdminRegistryServiceSummary {
    serviceId: string;
    instanceCount: number;
    instances: AdminRegistryInstance[];
}

export interface AdminRegistryStatus {
    applicationName: string;
    discoveryEnabled: boolean;
    registerEnabled: boolean;
    nacosServerAddr: string;
    namespace?: string;
    group?: string;
    serverPort?: string;
    configuredIp?: string;
    configuredPort?: string;
    ephemeral?: boolean;
    weight?: string;
    discoveryClientDescription?: string;
    profiles?: string[];
    healthy?: boolean;
    instanceCount?: number;
    knownServices: string[];
    serviceSummaries?: AdminRegistryServiceSummary[];
    instances: AdminRegistryInstance[];
}

export interface AdminSystemStatus {
    status?: string;
    healthy?: boolean;
    ready?: boolean;
    checkedAt?: string;
    application?: {
        name: string;
        runtimeMode: string;
        serverPort: string;
        profiles: string[];
        time: string;
    };
    runtime?: {
        javaVersion: string;
        javaVendor: string;
        osName: string;
        osVersion: string;
        processors: number;
        uptimeMs: number;
        startTimeMs: number;
    };
    memory?: {
        maxBytes: number;
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usedPercent: number;
    };
    disk?: {
        path: string;
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usedPercent: number;
    };
    database: {
        url?: string;
        driver?: string;
        status?: string;
        healthy?: boolean;
        ready?: boolean;
        required?: boolean;
        checkedAt?: string;
        latencyMs?: number;
        error?: string;
    };
    redis?: {
        host?: string;
        port?: string;
        database?: string;
        status?: string;
        healthy?: boolean;
        ready?: boolean;
        required?: boolean;
        checkedAt?: string;
        latencyMs?: number;
        ping?: string;
        error?: string;
    };
    nacos: {
        serverAddr?: string;
        status?: string;
        healthy?: boolean;
        ready?: boolean;
        configEnabled?: boolean;
        discoveryEnabled: boolean;
        registerEnabled: boolean;
        namespace?: string;
        group?: string;
        checkedAt?: string;
        latencyMs?: number;
        serverStatus?: string;
        dataId?: string;
        warnings?: string[];
        errors?: string[];
        error?: string;
    };
    productionConfig?: {
        runtimeMode?: string;
        status?: string;
        healthy?: boolean;
        ready?: boolean;
        required?: boolean;
        checkedAt?: string;
        issues?: string[];
        warnings?: string[];
        checks?: Record<string, {
            status?: string;
            configured?: boolean;
            minLength?: number;
            configuredAccountCount?: number;
            corsOriginCount?: number;
            websocketOriginCount?: number;
            enabledChannelCount?: number;
            availableCheckoutChannelCount?: number;
        }>;
    };
}

export interface AdminConfigCenterSnapshot {
    dataId: string;
    group: string;
    namespace?: string;
    nacosServerAddr: string;
    content: string;
    properties: Record<string, string>;
    effectiveProperties: Record<string, string>;
    appliedKeys: string[];
    sensitiveKeys: string[];
    warnings: string[];
    errors: string[];
    runtimeApplied: boolean;
    nacosPublished: boolean;
    propertyCount: number;
    lastSyncedAt: string;
}

export interface AdminConfigCenterPublishRequest {
    dataId: string;
    group: string;
    namespace?: string;
    content: string;
    applyRuntime: boolean;
}

export interface AdminLogManagementStatus {
    loggerName: string;
    configuredLevel: string;
    effectiveLevel: string;
    debugEnabled: boolean;
    logDirectory?: string | null;
    logFileName: string;
    availableFiles: string[];
    totalLogBytes: number;
}

export interface AdminLogDebugRequest {
    loggerName?: string;
    enabled: boolean;
}

export interface AdminTrafficControlStatus {
    rateLimit: {
        enabled: boolean;
        publicPerMinute: number;
        authenticatedPerMinute: number;
        adminPerMinute: number;
        windowSeconds: number;
        activeBuckets: number;
        acceptedRequests: number;
        rejectedRequests: number;
    };
    circuitBreakerConfig: {
        enabled: boolean;
        failureThreshold: number;
        openSeconds: number;
        halfOpenSuccessThreshold: number;
    };
    circuits: Array<{
        name: string;
        state: string;
        failureCount: number;
        halfOpenSuccessCount: number;
        openedUntil?: string;
        lastFailureMessage?: string;
    }>;
}

export interface SystemAlert {
    id: number;
    severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' | string;
    status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | string;
    source: string;
    category: string;
    title: string;
    message?: string;
    fingerprint: string;
    metadata?: string;
    occurrenceCount: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    resolvedAt?: string;
    resolvedBy?: string;
}

export interface SystemAlertSummary {
    openCount: number;
    acknowledgedCount: number;
    resolvedCount: number;
    openBySeverity: Record<string, number>;
    checkedAt: string;
}

export interface SystemAlertBatchActionResponse {
    action: string;
    requestedCount: number;
    updatedCount: number;
    ignoredCount: number;
    maxBatchSize: number;
    ids: number[];
}

export interface SystemAlertPurgeResponse {
    retentionDays: number;
    deletedCount: number;
    purgedBefore: string;
}

export type AdminBugReportSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AdminBugReportPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type AdminBugReportStatus = 'OPEN' | 'FIXING' | 'FIXED_PENDING_REGRESSION' | 'REGRESSION_PASSED' | 'REGRESSION_FAILED' | 'CLOSED' | 'NON_ISSUE';

export interface AdminBugReport {
    id: number;
    title: string;
    description: string;
    module: string;
    severity: AdminBugReportSeverity;
    priority: AdminBugReportPriority;
    status: AdminBugReportStatus;
    pageUrl?: string;
    environment?: string;
    reproductionSteps?: string;
    expectedResult?: string;
    actualResult?: string;
    attachmentUrls?: string;
    reporterName?: string;
    assignedTo?: string;
    scanNote?: string;
    fixSummary?: string;
    regressionNote?: string;
    lastScannedAt?: string;
    fixedAt?: string;
    regressionAt?: string;
    closedAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AdminBugAttachmentUploadResponse {
    attachmentUrl: string;
}

export interface AdminBugReportPage {
    items: AdminBugReport[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface AdminBugReportSummary {
    totalBugs: number;
    openCount: number;
    fixingCount: number;
    fixedPendingRegressionCount: number;
    regressionPassedCount: number;
    regressionFailedCount: number;
    closedCount: number;
    dueForScanCount: number;
    scanIntervalMinutes: number;
    nextScanAt?: string;
    checkedAt?: string;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
}

export interface IpBlacklistEntry {
    id: number;
    ipAddress: string;
    status: 'MONITORING' | 'BLOCKED' | 'RELEASED' | string;
    source: 'LOGIN' | 'PAYMENT' | 'MANUAL' | string;
    reason?: string;
    failureCount: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
    blockedAt?: string;
    blockedUntil?: string;
    releasedAt?: string;
    releasedBy?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    legacyOnly?: boolean;
}

export interface IpBlacklistBatchReleaseResponse {
    requestedCount: number;
    releasedCount: number;
    ignoredCount: number;
    maxBatchSize: number;
    ids: number[];
}

export interface IpBlacklistStatus {
    enabled: boolean;
    loginFailureThreshold: number;
    paymentFailureThreshold: number;
    windowMinutes: number;
    blockMinutes: number;
    blockedCount: number;
    monitoringCount: number;
    releasedCount?: number;
    totalCount?: number;
    legacyLoginFailureCount?: number;
}

export interface SiteAnnouncement {
    id?: number;
    title: string;
    content: string;
    linkUrl?: string;
    status: 'ACTIVE' | 'INACTIVE' | string;
    sortOrder?: number;
    startsAt?: string;
    endsAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface SiteAnnouncementPublic {
    id?: number;
    title: string;
    content: string;
    linkUrl?: string;
}

export interface SiteAnnouncementAdminPage {
    items: SiteAnnouncement[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface SiteAnnouncementAdminSummary {
    totalAnnouncements: number;
    activeAnnouncements: number;
    scheduledAnnouncements: number;
    expiredAnnouncements: number;
    inactiveAnnouncements: number;
    linkedAnnouncements: number;
    maxActiveRows: number;
    titleMaxChars: number;
    contentMaxChars: number;
    linkUrlMaxChars: number;
    checkedAt?: string;
}

export interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    stock: number;
    categoryId: number;
    imageUrl: string;
    status?: string;
    categoryName?: string;
    isFeatured?: boolean;
    images?: string[];
    brand?: string;
    originalPrice?: number;
    discount?: number;
    limitedTimePrice?: number;
    limitedTimeStartAt?: string;
    limitedTimeEndAt?: string;
    activeLimitedTimeDiscount?: boolean;
    effectivePrice?: number;
    effectiveDiscountPercent?: number;
    freeShipping?: boolean;
    freeShippingThreshold?: number;
    tag?: string;
    rating?: number;
    averageRating?: number;
    positiveRate?: number;
    reviewCount?: number;
    sizes?: string[];
    colors?: string[];
    specifications?: { [key: string]: string };
    detailContent?: ProductDetailBlock[];
    variants?: ProductVariant[];
    optionGroups?: ProductOptionGroup[];
    bundle?: ProductBundleConfig | null;
    localizedContent?: Record<string, unknown> | null;
    warranty?: string;
    shipping?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AdminProductPage {
    items: Product[];
    total: number;
    totalElements?: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious?: boolean;
}

export interface ProductPublic {
    id: number;
    name: string;
    description: string;
    price: number;
    stock: number;
    categoryId: number;
    imageUrl: string;
    isFeatured?: boolean;
    images?: string[];
    brand?: string;
    originalPrice?: number;
    discount?: number;
    limitedTimePrice?: number;
    limitedTimeStartAt?: string;
    limitedTimeEndAt?: string;
    activeLimitedTimeDiscount?: boolean;
    effectivePrice?: number;
    effectiveDiscountPercent?: number;
    freeShipping?: boolean;
    freeShippingThreshold?: number;
    tag?: string;
    status?: string;
    averageRating?: number;
    positiveRate?: number;
    reviewCount?: number;
    specifications?: { [key: string]: string };
    specificationItems?: { [key: string]: string };
    i18n?: Record<string, Record<string, string>>;
    detailContent?: ProductDetailBlock[];
    variants?: ProductVariant[];
    optionGroups?: ProductOptionGroup[];
    bundle?: ProductBundleConfig | null;
    localizedContent?: Record<string, unknown> | null;
    warranty?: string;
    shipping?: string;
}

export interface ProductPublicPage {
    items: ProductPublic[];
    total: number;
    totalElements?: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious?: boolean;
}

export interface ProductBundleConfig {
    enabled?: boolean;
    title?: string;
    price?: number;
    items?: ProductBundleItem[];
}

export interface ProductOptionGroup {
    name: string;
    values?: string[];
    options: string[];
}

export interface ProductBundleItem {
    name: string;
    quantity?: number;
    productId?: number;
}

export interface ProductVariant {
    sku?: string;
    options: Record<string, string>;
    price: number;
    stock?: number;
    imageUrl?: string;
}

export interface ProductDetailBlock {
    type: 'text' | 'image' | 'video';
    content?: string;
    url?: string;
    caption?: string;
}

export type ProductMutationPayload = Omit<
    Partial<Product>,
    'images' | 'specifications' | 'detailContent' | 'variants' | 'limitedTimeStartAt' | 'limitedTimeEndAt'
> & {
    images?: Product['images'] | null;
    specifications?: Product['specifications'] | null;
    detailContent?: Product['detailContent'] | null;
    variants?: Product['variants'] | null;
    limitedTimeStartAt?: Product['limitedTimeStartAt'] | null;
    limitedTimeEndAt?: Product['limitedTimeEndAt'] | null;
};

export interface ProductImportRowError {
    rowNumber: number;
    field?: string;
    message: string;
}

export interface ProductImportResult {
    importId?: string;
    fileSha256?: string;
    status?: 'PREVIEW_READY' | 'PREVIEW_BLOCKED' | 'APPLIED' | 'REJECTED' | string;
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    updateFields?: string[];
    maxRows?: number;
    maxFileSizeBytes?: number;
    preview?: boolean;
    readyToImport?: boolean;
    applied?: boolean;
    truncatedErrors?: boolean;
    errors: string[];
    rowErrors?: ProductImportRowError[];
}

export interface ProductImportHistoryEntry {
    auditLogId: number;
    action: string;
    result: string;
    filename?: string;
    importId?: string;
    fileSha256?: string;
    status?: 'PREVIEW_READY' | 'PREVIEW_BLOCKED' | 'APPLIED' | 'REJECTED' | string;
    sizeBytes: number;
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    updateFields?: string[];
    preview: boolean;
    readyToImport: boolean;
    applied?: boolean;
    message?: string;
    createdAt: string;
}

export interface ProductUrlImportPreview {
    sourceUrl: string;
    sourceHost?: string;
    name?: string;
    description?: string;
    price?: number;
    originalPrice?: number;
    currency?: string;
    imageUrl?: string;
    images?: string[];
    brand?: string;
    confidenceScore?: number;
    warnings?: string[];
    blockedImages?: string[];
}

export interface Category {
    id: number;
    name: string;
    description?: string;
    localizedContent?: Record<string, { name?: string; description?: string }> | null;
    parentId?: number | null;
    level?: number;
    imageUrl?: string;
    productCount?: number;
    children?: Category[];
}

export interface CategoryPublic {
    id: number;
    name: string;
    description?: string;
    parentId?: number | null;
    level?: number;
    imageUrl?: string;
    productCount?: number;
    localizedContent?: Record<string, { name?: string; description?: string }> | null;
}

export interface Brand {
    id: number;
    name: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
    status?: string;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface BrandPublic {
    id: number;
    name: string;
    description?: string;
    logoUrl?: string;
    websiteUrl?: string;
}

export interface CartItem {
    id: number;
    productId: number;
    quantity: number;
    productName: string;
    imageUrl: string;
    price: number;
    stock?: number;
    productStatus?: string;
    freeShipping?: boolean;
    freeShippingThreshold?: number;
    selectedSpecs?: string;
}

export interface Order {
    id: number;
    orderNo?: string;
    userId?: number;
    customerUsername?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerDisplayName?: string;
    customerType?: 'REGISTERED' | 'GUEST' | string;
    totalAmount: number;
    originalAmount?: number;
    discountAmount?: number;
    shippingFee?: number;
    userCouponId?: number;
    couponId?: number;
    couponName?: string;
    status: string;
    shippingAddress?: string;
    recipientName?: string;
    recipientPhone?: string;
    contactEmail?: string;
    paymentMethod?: string;
    currency?: string;
    trackingNumber?: string;
    trackingCarrierCode?: string;
    trackingCarrierName?: string;
    returnTrackingNumber?: string;
    returnReason?: string;
    returnRequestedAt?: string;
    returnApprovedAt?: string;
    returnRejectedAt?: string;
    returnShippedAt?: string;
    returnedAt?: string;
    returnable?: boolean;
    returnDeadline?: string;
    guestOrder?: boolean;
    refundedAt?: string;
    shippedAt?: string;
    completedAt?: string;
    username?: string;
    orderItems?: OrderItem[];
    createdAt?: string;
    updatedAt?: string;
}

export interface OrderCustomer {
    id: number;
    orderNo?: string;
    totalAmount: number;
    originalAmount?: number;
    discountAmount?: number;
    shippingFee?: number;
    couponName?: string;
    status: string;
    shippingAddress?: string;
    recipientName?: string;
    recipientPhone?: string;
    contactEmail?: string;
    paymentMethod?: string;
    currency?: string;
    trackingNumber?: string;
    trackingCarrierCode?: string;
    trackingCarrierName?: string;
    returnTrackingNumber?: string;
    returnReason?: string;
    returnRequestedAt?: string;
    returnApprovedAt?: string;
    returnRejectedAt?: string;
    returnShippedAt?: string;
    returnedAt?: string;
    returnable?: boolean;
    returnDeadline?: string;
    guestOrder?: boolean;
    refundedAt?: string;
    shippedAt?: string;
    completedAt?: string;
    createdAt?: string;
}

export interface OrderTrackResult {
    order: OrderCustomer;
    items: OrderItemCustomer[];
    detailsRestricted?: boolean;
    restrictionReason?: string;
}

export interface AdminOrderPage {
    items: Order[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    summary?: Record<string, number>;
}

export interface AdminReviewPage {
    items: Review[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    summary?: Record<string, number>;
}

export interface AdminOrderBatchShipFailure {
    orderId?: number;
    input?: string;
    reason: string;
}

export interface AdminOrderBatchShipResponse {
    requestedCount: number;
    success: number;
    failed: number;
    maxBatchSize: number;
    trackingPrefix?: string;
    trackingCarrierCode?: string;
    failures: AdminOrderBatchShipFailure[];
}

export interface LogisticsTrackEvent {
    time?: string;
    location?: string;
    description: string;
}

export interface LogisticsTrackResponse {
    trackingNumber: string;
    carrier?: string;
    status: string;
    summary?: string;
    events: LogisticsTrackEvent[];
}

export interface LogisticsCarrier {
    id: number;
    name: string;
    trackingCode: string;
    status: string;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface CouponPublic {
    id: number;
    name: string;
    couponType: 'FULL_REDUCTION' | 'DISCOUNT';
    thresholdAmount?: number;
    reductionAmount?: number;
    /** For DISCOUNT coupons this stores the payable percent: 90 means pay 90%, i.e. 10% off. */
    discountPercent?: number;
    maxDiscountAmount?: number;
    remainingQuantity?: number | null;
    startAt?: string;
    endAt?: string;
    description?: string;
}

export interface Coupon extends CouponPublic {
    scope?: 'PUBLIC' | 'ASSIGNED';
    status?: string;
    totalQuantity?: number;
    claimedQuantity?: number;
}

export interface AdminCouponPage {
    items: Coupon[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    summary?: CouponAdminSummary;
}

export interface CouponAdminSummary {
    totalCoupons: number;
    activeCoupons: number;
    inactiveCoupons: number;
    publicActiveCoupons: number;
    expiringSoonCoupons: number;
    lowRemainingCoupons: number;
    maxSearchRows: number;
    maxGrantUsers: number;
    maxPublicRows: number;
    walletMaxRows: number;
    availableMaxRows: number;
    nameMaxChars: number;
    descriptionMaxChars: number;
    totalQuantityMax: number;
    expiringSoonDays: number;
    lowRemainingThreshold: number;
    checkedAt?: string;
}

export interface PetBirthdayCouponConfig {
    id: number;
    enabled: boolean;
    namePrefix: string;
    couponType: 'FULL_REDUCTION' | 'DISCOUNT';
    thresholdAmount?: number;
    reductionAmount?: number;
    /** For DISCOUNT coupons this stores the payable percent: 90 means pay 90%, i.e. 10% off. */
    discountPercent?: number;
    maxDiscountAmount?: number;
    validDays: number;
    maxBenefitsPerUser: number;
    totalQuantityPerCoupon?: number;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface UserCoupon {
    id: number;
    couponId: number;
    status: string;
    claimedAt?: string;
    usedAt?: string;
    couponName: string;
    couponType: 'FULL_REDUCTION' | 'DISCOUNT';
    thresholdAmount?: number;
    reductionAmount?: number;
    /** For DISCOUNT coupons this stores the payable percent: 90 means pay 90%, i.e. 10% off. */
    discountPercent?: number;
    maxDiscountAmount?: number;
    startAt?: string;
    endAt?: string;
    description?: string;
}

export interface CouponQuote {
    subtotal: number;
    discountAmount: number;
    shippingFee?: number;
    payableAmount: number;
    selectedUserCouponId?: number;
    availableCoupons: UserCoupon[];
}

export interface OrderItem {
    id: number;
    orderId?: number;
    productId: number;
    quantity: number;
    price: number;
    productName: string;
    imageUrl: string;
    selectedSpecs?: string;
    createdAt?: string;
}

export interface OrderItemCustomer {
    id: number;
    productId: number;
    quantity: number;
    price: number;
    productName: string;
    imageUrl: string;
    selectedSpecs?: string;
    createdAt?: string;
}

export interface UserAddress {
    id: number;
    recipientName: string;
    phone: string;
    region?: string[];
    postalCode?: string;
    detailAddress?: string;
    address: string;
    isDefault: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface WishlistItem {
    id: number;
    productId: number;
    productName: string;
    imageUrl: string;
    productPrice: number;
    stock?: number;
    productStatus?: string;
    requiresSelection?: boolean;
    createdAt?: string;
}

export interface AppNotification {
    id: number;
    type: string;
    title: string;
    message: string;
    contentFormat?: 'TEXT' | 'HTML';
    isRead: boolean;
    createdAt?: string;
}

export interface PetProfile {
    id: number;
    name: string;
    petType: 'DOG' | 'CAT' | 'SMALL_PET';
    breed?: string;
    birthday?: string;
    weight?: number;
    size?: 'SMALL' | 'MEDIUM' | 'LARGE';
}

export interface PetGalleryPhotoPublic {
    id: number;
    username: string;
    imageUrl: string;
    likeCount?: number;
    likedByMe?: boolean;
    canDelete?: boolean;
    createdAt?: string;
}

export interface AdminPetGalleryPhoto extends PetGalleryPhotoPublic {
    userId?: number;
    originalFilename?: string;
    contentType?: string;
    fileSize?: number;
    ipAddress?: string;
    status?: string;
    source?: string;
}

export interface AdminPetGalleryPage {
    items: AdminPetGalleryPhoto[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    summary?: Record<string, number>;
}

export interface PetGalleryQuota {
    limit: number;
    remaining: number;
    canUpload: boolean;
}

export interface Review {
    id: number;
    userId: number;
    productId: number;
    productName?: string;
    productImageUrl?: string;
    rating: number;
    comment: string;
    imageUrls?: string[];
    status?: string;
    username: string;
    createdAt: string;
    orderId?: number;
    adminReply?: string;
    repliedAt?: string;
    user?: User;
    product?: Product;
}

export interface PublicReview {
    id: number;
    productId: number;
    rating: number;
    comment: string;
    imageUrls?: string[];
    username: string;
    createdAt: string;
    adminReply?: string;
    repliedAt?: string;
    editableByCurrentUser?: boolean;
}

export interface ReviewableOrder {
    id: number;
    orderNo?: string;
    createdAt?: string;
    completedAt?: string;
}

export interface ProductQuestion {
    id: number;
    productId: number;
    productName?: string;
    userId?: number;
    username?: string;
    question: string;
    answer?: string;
    answeredBy?: number;
    answeredAt?: string;
    createdAt: string;
    product?: Product;
}

export interface ProductQuestionPublic {
    id: number;
    productId: number;
    question: string;
    answer?: string;
    answeredAt?: string;
    createdAt: string;
}

export interface ProductQuestionAdminSummary {
    totalQuestions: number;
    unansweredQuestions: number;
    answeredQuestions: number;
    staleUnansweredQuestions: number;
    staleHours: number;
    maxAdminRows: number;
    responseScore: number;
    checkedAt?: string;
}

export interface PaymentCustomer {
    id: number;
    orderId: number;
    orderNo: string;
    amount: number;
    channel: string;
    currency?: string;
    status: string;
    paymentUrl?: string;
    transactionId?: string;
    expiresAt?: string;
    paidAt?: string;
    refundedAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface AdminPayment extends PaymentCustomer {
    providerReference?: string;
    refundReference?: string;
    callbackAt?: string;
}

export interface PaymentChannel {
    code: string;
    displayName: string;
    labelKey?: string;
    descriptionKey?: string;
    market?: 'CN' | 'MX' | 'GLOBAL' | string;
    currency?: string;
    badgeKey?: string;
    sortOrder?: number;
    recommended?: boolean;
    recommendedCountry?: string;
}

export interface AppConfig {
    emailCodeEnabled?: boolean;
    defaultShippingFee?: number;
    freeShippingThreshold?: number;
}

export interface SecurityAuditLog {
    id: number;
    action: string;
    result: string;
    actorUserId?: number;
    actorUsername?: string;
    actorRole?: string;
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    message?: string;
    metadata?: string;
    createdAt: string;
}

export interface SecurityAuditSummaryGroupCount {
    name: string;
    count: number;
}

export interface SecurityAuditSummary {
    startAt: string;
    endAt: string;
    totalCount: number;
    successCount: number;
    failureCount: number;
    defaultRangeHours: number;
    maxRangeHours: number;
    maxSearchRows: number;
    maxExportRows: number;
    byResult: SecurityAuditSummaryGroupCount[];
    topActions: SecurityAuditSummaryGroupCount[];
    topActors: SecurityAuditSummaryGroupCount[];
    topIpAddresses: SecurityAuditSummaryGroupCount[];
    checkedAt?: string;
}

export interface SecurityAuditPurgeResponse {
    retentionDays: number;
    deletedCount: number;
    purgedBefore: string;
}

export interface SupportSessionCustomer {
    id: number;
    assignedAdminName?: string;
    status: string;
    lastMessage?: string;
    lastMessageAt?: string;
    createdAt?: string;
    updatedAt?: string;
    unreadByUser?: number;
}

export interface SupportWebSocketTicket {
    ticket: string;
    expiresInMillis: number;
}

export interface SupportSession extends SupportSessionCustomer {
    userId?: number;
    assignedAdminId?: number;
    username?: string;
    unreadByAdmin?: number;
}

export interface SupportAdminSessionPage {
    items: SupportSession[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
}

export interface SupportAdminSummary {
    totalSessions: number;
    openSessions: number;
    closedSessions: number;
    unreadSessions: number;
    unreadMessages: number;
    unassignedOpenSessions: number;
    myOpenSessions: number;
    staleOpenSessions: number;
    staleMinutes: number;
    responseScore: number;
    checkedAt?: string;
}

export interface SupportMessageCustomer {
    id: number;
    sessionId: number;
    senderRole: string;
    content: string;
    isReadByUser?: boolean;
    createdAt?: string;
}

export interface SupportMessage extends SupportMessageCustomer {
    isReadByAdmin?: boolean;
    senderName?: string;
}
