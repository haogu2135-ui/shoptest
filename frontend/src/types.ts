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
    application: {
        name: string;
        runtimeMode: string;
        serverPort: string;
        profiles: string[];
        time: string;
    };
    runtime: {
        javaVersion: string;
        javaVendor: string;
        osName: string;
        osVersion: string;
        processors: number;
        uptimeMs: number;
        startTimeMs: number;
    };
    memory: {
        maxBytes: number;
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usedPercent: number;
    };
    disk: {
        path: string;
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usedPercent: number;
    };
    database: {
        url: string;
        driver: string;
        status?: string;
        healthy?: boolean;
        ready?: boolean;
        required?: boolean;
        checkedAt?: string;
        latencyMs?: number;
        error?: string;
    };
    redis?: {
        host: string;
        port: string;
        database: string;
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
        serverAddr: string;
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
    logDirectory: string;
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
    warranty?: string;
    shipping?: string;
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

export interface ProductImportResult {
    totalRows: number;
    created: number;
    updated: number;
    failed: number;
    errors: string[];
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
}

export interface Category {
    id: number;
    name: string;
    description?: string;
    localizedContent?: Record<string, { name?: string; description?: string }> | null;
    parentId?: number | null;
    level?: number;
    imageUrl?: string;
    children?: Category[];
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

export interface CartItem {
    id: number;
    userId: number;
    productId: number;
    quantity: number;
    productName: string;
    imageUrl: string;
    price: number;
    stock?: number;
    productStatus?: string;
    selectedSpecs?: string;
}

export interface Order {
    id: number;
    orderNo?: string;
    userId: number;
    totalAmount: number;
    originalAmount?: number;
    discountAmount?: number;
    shippingFee?: number;
    userCouponId?: number;
    couponId?: number;
    couponName?: string;
    status: string;
    shippingAddress?: string;
    paymentMethod?: string;
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
    refundedAt?: string;
    shippedAt?: string;
    completedAt?: string;
    username?: string;
    orderItems?: OrderItem[];
    createdAt?: string;
}

export interface AdminOrderPage {
    items: Order[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
    summary?: Record<string, number>;
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
    rawResponse?: Record<string, any>;
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

export interface Coupon {
    id: number;
    name: string;
    couponType: 'FULL_REDUCTION' | 'DISCOUNT';
    scope: 'PUBLIC' | 'ASSIGNED';
    status: string;
    thresholdAmount?: number;
    reductionAmount?: number;
    discountPercent?: number;
    maxDiscountAmount?: number;
    totalQuantity?: number;
    claimedQuantity?: number;
    startAt?: string;
    endAt?: string;
    description?: string;
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
    userId: number;
    couponId: number;
    status: string;
    orderId?: number;
    claimedAt?: string;
    usedAt?: string;
    couponName: string;
    couponType: 'FULL_REDUCTION' | 'DISCOUNT';
    couponScope?: string;
    thresholdAmount?: number;
    reductionAmount?: number;
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
    orderId: number;
    productId: number;
    quantity: number;
    price: number;
    productName: string;
    imageUrl: string;
    selectedSpecs?: string;
}

export interface UserAddress {
    id: number;
    userId: number;
    recipientName: string;
    phone: string;
    address: string;
    isDefault: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface WishlistItem {
    id: number;
    userId: number;
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
    userId: number;
    type: string;
    title: string;
    message: string;
    contentFormat?: 'TEXT' | 'HTML';
    isRead: boolean;
    createdAt?: string;
}

export interface PetProfile {
    id: number;
    userId: number;
    name: string;
    petType: 'DOG' | 'CAT' | 'SMALL_PET';
    breed?: string;
    birthday?: string;
    weight?: number;
    size?: 'SMALL' | 'MEDIUM' | 'LARGE';
    createdAt?: string;
    updatedAt?: string;
}

export interface PetGalleryPhoto {
    id: number;
    userId?: number;
    username: string;
    imageUrl: string;
    originalFilename?: string;
    contentType: string;
    fileSize: number;
    source?: 'USER_UPLOAD' | 'SEED';
    likeCount?: number;
    likedByMe?: boolean;
    canDelete?: boolean;
    createdAt?: string;
}

export interface PetGalleryQuota {
    limit: number;
    userUploads: number;
    ipUploads: number;
    remaining: number;
    canUpload: boolean;
}

export interface Review {
    id: number;
    userId: number;
    productId: number;
    rating: number;
    comment: string;
    status?: string;
    username: string;
    createdAt: string;
    orderId?: number;
    adminReply?: string;
    repliedAt?: string;
    user?: User;
    product?: Product;
}

export interface ProductQuestion {
    id: number;
    productId: number;
    productName?: string;
    userId: number;
    username: string;
    question: string;
    answer?: string;
    answeredBy?: number;
    answeredAt?: string;
    createdAt: string;
    product?: Product;
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

export interface Payment {
    id: number;
    orderId: number;
    orderNo: string;
    amount: number;
    channel: string;
    status: string;
    paymentUrl?: string;
    transactionId?: string;
    providerReference?: string;
    refundReference?: string;
    expiresAt?: string;
    paidAt?: string;
    refundedAt?: string;
    callbackAt?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface PaymentChannel {
    code: string;
    displayName: string;
    labelKey?: string;
    descriptionKey?: string;
    market?: 'CN' | 'MX' | 'GLOBAL' | string;
    currency?: string;
    provider?: string;
    refundMode?: string;
    badgeKey?: string;
    sortOrder?: number;
    recommended?: boolean;
    recommendedCountry?: string;
}

export interface AppConfig {
    runtimeMode: 'production' | 'debug' | 'dev' | 'test' | string;
    paymentSimulationEnabled: boolean;
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

export interface SupportSession {
    id: number;
    userId: number;
    assignedAdminId?: number;
    assignedAdminName?: string;
    status: string;
    lastMessage?: string;
    lastMessageAt?: string;
    createdAt?: string;
    updatedAt?: string;
    username?: string;
    unreadByUser?: number;
    unreadByAdmin?: number;
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

export interface SupportMessage {
    id: number;
    sessionId: number;
    senderId: number;
    senderRole: string;
    content: string;
    isReadByUser?: boolean;
    isReadByAdmin?: boolean;
    createdAt?: string;
    senderName?: string;
    messageType?: string;
    payload?: string;
}
