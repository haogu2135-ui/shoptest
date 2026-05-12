export interface User {
    id: number;
    username: string;
    email: string;
    phone?: string;
    address?: string;
    role: string;
    password?: string;
    status?: string;
    createdAt?: string;
}

export interface DashboardStats {
    totalProducts: number;
    totalOrders: number;
    totalUsers: number;
    totalRevenue: number;
    grossOrderAmount?: number;
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
    userId: number;
    username: string;
    question: string;
    answer?: string;
    answeredBy?: number;
    answeredAt?: string;
    createdAt: string;
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
    expiresAt?: string;
    paidAt?: string;
    createdAt: string;
}

export interface AppConfig {
    runtimeMode: 'production' | 'debug' | 'dev' | 'test' | string;
    paymentSimulationEnabled: boolean;
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

export interface SupportSession {
    id: number;
    userId: number;
    assignedAdminId?: number;
    status: string;
    lastMessage?: string;
    lastMessageAt?: string;
    createdAt?: string;
    updatedAt?: string;
    username?: string;
    unreadByUser?: number;
    unreadByAdmin?: number;
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
