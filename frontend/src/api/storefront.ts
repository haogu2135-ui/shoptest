import { cachedGet, cachedTypedGet, setBoundedMapEntry, setTimedCacheEntry } from './cache';
import type { AxiosResponse } from 'axios';
import type {
  AdminPayment,
  AppNotification,
  Brand,
  BrandPublic,
  CartItem,
  Category,
  CategoryPublic,
  CouponPublic,
  CouponQuote,
  LogisticsCarrier,
  LogisticsTrackResponse,
  Order,
  OrderCustomer,
  OrderItemCustomer,
  OrderTrackResult,
  PaymentChannel,
  PaymentCustomer,
  PetGalleryPhotoPublic,
  PetGalleryQuota,
  PetProfile,
  Product,
  ProductPublic,
  ProductPublicPage,
  ProductQuestionPublic,
  PublicReview,
  ReviewableOrder,
  SupportMessageCustomer,
  SupportSessionCustomer,
  SupportWebSocketTicket,
  UserAddress,
  UserCoupon,
  WishlistItem,
} from '../types';
import {
  ADDRESS_CACHE_MS,
  BRAND_CACHE_MS,
  CATEGORY_CACHE_MS,
  COUPON_CACHE_MS,
  LOGISTICS_CARRIER_CACHE_MS,
  LOGISTICS_TRACK_CACHE_MS,
  MAX_PRODUCT_QUESTION_LENGTH,
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_SELECTED_SPECS_LENGTH,
  NOTIFICATION_CACHE_MS,
  ORDER_ITEMS_CACHE_MS,
  ORDER_TRACK_CACHE_MS,
  PAYMENT_CHANNEL_CACHE_MS,
  PERSONALIZED_RECOMMENDATION_CACHE_MS,
  PET_GALLERY_CACHE_MS,
  PET_PROFILE_CACHE_MS,
  PRODUCT_ADD_ON_CACHE_MS,
  PRODUCT_DETAIL_CACHE_MS,
  PRODUCT_LIST_CACHE_MS,
  QUESTION_CACHE_MS,
  REVIEW_CACHE_MS,
  addressCache,
  addressRequests,
  anonymousGetConfig,
  anonymousRequestConfig,
  api,
  brandCache,
  brandRequests,
  cacheLoaderOptions,
  cacheProductDetailFromList,
  cacheProductListResponse,
  cacheProductPageResponse,
  categoryCache,
  categoryRequests,
  checkoutIdempotencyConfig,
  clearAddressCache,
  clearBrandCache,
  clearCategoryCache,
  clearCouponCache,
  clearLogisticsCarrierCache,
  clearNotificationCache,
  clearOrderTrackCache,
  clearPersonalizedRecommendationCache,
  clearPetGalleryCache,
  clearPetProfileCache,
  clearProductCache,
  clearQuestionCache,
  clearReviewCache,
  currentUserCacheKey,
  getStoredItem,
  guestOrderPath,
  guestParams,
  guestRequestConfig,
  hasGuestCredentials,
  logisticsCarrierCache,
  logisticsCarrierRequests,
  logisticsTrackCache,
  logisticsTrackRequests,
  normalizeAddressPayload,
  normalizeBoundedPositiveInt,
  normalizeBrandPayload,
  normalizeCategoryPayload,
  normalizeEmailParam,
  normalizeGuestCheckoutItems,
  normalizeImageListParam,
  normalizeLogisticsCarrierPayload,
  normalizeNonNegativeIntParam,
  normalizeNonNegativeNumberParam,
  normalizeOrderTrackingNumber,
  normalizePetProfilePayload,
  normalizePositiveInt,
  normalizePositiveIntList,
  normalizeProductPayload,
  normalizeProductPublicPageResponse,
  normalizeQuantityParam,
  normalizeStringListParam,
  normalizeSupportMessageContent,
  normalizeSupportMessageParams,
  normalizeSupportSessionParams,
  normalizeTextParam,
  notificationCache,
  notificationRequests,
  optionalAnonymousGetConfig,
  orderItemsCache,
  orderItemsRequests,
  orderTrackCache,
  orderTrackRequests,
  paymentChannelRuntime,
  personalizedRecommendationCache,
  personalizedRecommendationRequests,
  petGalleryCache,
  petGalleryRequests,
  petProfileCache,
  petProfileRequests,
  productAddOnCache,
  productAddOnRequests,
  productByIdsCache,
  productByIdsRequests,
  productDetailCache,
  productDetailRequests,
  productListCache,
  productListRequests,
  productPageCache,
  productPageRequests,
  productRecommendationsCache,
  productRecommendationsRequests,
  publicCouponCache,
  publicCouponRequests,
  questionCache,
  questionRequests,
  reviewCache,
  reviewRequests,
  toPathId,
  userCouponCache,
  userCouponRequests,
  withArrayData,
  withProductArrayData,
  withRequestOptions,
} from './core';
import type {
  ApiRequestOptions,
  AuthRetryConfig,
  CheckoutRequestOptions,
  LogisticsCarrierWritePayload,
  ProductListFilters,
  ProductReviewSummary,
  SupportMessageQuery,
  SupportSessionQuery,
} from './core';

export const productApi = {
    getAll: (keyword?: string, categoryId?: number, discount?: boolean, filters?: ProductListFilters, options?: ApiRequestOptions) => {
        const normalizedKeyword = normalizeTextParam(keyword, 120);
        const normalizedCategoryId = normalizePositiveInt(categoryId);
        const normalizedPetSizes = normalizeStringListParam(filters?.petSizes, 12, 40);
        const normalizedMaterials = normalizeStringListParam(filters?.materials, 12, 40);
        const normalizedColors = normalizeStringListParam(filters?.colors, 12, 40);
        const normalizedCollection = normalizeTextParam(filters?.collection, 40);
        const normalizedIncludeChildren = typeof filters?.includeChildren === 'boolean' ? filters.includeChildren : undefined;
        const normalizedMinPrice = filters?.minPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.minPrice);
        const normalizedMaxPrice = filters?.maxPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.maxPrice);
        const normalizedSort = normalizeTextParam(filters?.sort, 80);
        const normalizedPage = filters?.page == null ? undefined : normalizeNonNegativeIntParam(filters.page, 0, 1_000_000);
        const normalizedSize = filters?.size == null ? undefined : normalizeBoundedPositiveInt(filters.size, 50, 500);
        const params = new URLSearchParams();
        if (normalizedKeyword) params.append('keyword', normalizedKeyword);
        if (normalizedCategoryId) params.append('categoryId', normalizedCategoryId.toString());
        if (normalizedIncludeChildren !== undefined) params.append('includeChildren', String(normalizedIncludeChildren));
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
            }, cacheLoaderOptions(options)))
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
        const normalizedIncludeChildren = typeof filters?.includeChildren === 'boolean' ? filters.includeChildren : undefined;
        const normalizedMinPrice = filters?.minPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.minPrice);
        const normalizedMaxPrice = filters?.maxPrice == null ? undefined : normalizeNonNegativeNumberParam(filters.maxPrice);
        const normalizedSort = normalizeTextParam(filters?.sort, 80);
        const normalizedPage = filters?.page == null ? 0 : normalizeNonNegativeIntParam(filters.page, 0, 1_000_000);
        const normalizedSize = filters?.size == null ? 12 : normalizeBoundedPositiveInt(filters.size, 12, 500);
        const params = new URLSearchParams();
        if (normalizedKeyword) params.append('keyword', normalizedKeyword);
        if (normalizedCategoryId) params.append('categoryId', normalizedCategoryId.toString());
        if (normalizedIncludeChildren !== undefined) params.append('includeChildren', String(normalizedIncludeChildren));
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
            }, cacheLoaderOptions(options)))
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
            api.get<ProductPublic[]>('/products/finder-candidates', anonymousGetConfig({ params }, cacheLoaderOptions(options)))
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
            api.get<ProductPublic>(`/products/${productId}`, anonymousGetConfig(undefined, cacheLoaderOptions(options)))
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
            api.get<ProductPublic>(`/products/${productId}`, anonymousGetConfig(undefined, cacheLoaderOptions(options)))
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
            api.get<ProductPublic[]>('/products/by-ids', anonymousGetConfig({ params }, cacheLoaderOptions(options)))
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
            api.get<ProductPublic[]>('/products/featured', anonymousGetConfig({ params: { limit } }, cacheLoaderOptions(options)))
                .then((response) => {
                    const normalized = withProductArrayData(response);
                    cacheProductListResponse(cacheKey, normalized);
                    return normalized;
                }), options);
    },
    getPersonalizedRecommendations: (options?: ApiRequestOptions) => {
        const cacheKey = `personalized:${currentUserCacheKey()}`;
        return cachedTypedGet(personalizedRecommendationCache, personalizedRecommendationRequests, cacheKey, () =>
            api.get<ProductPublic[]>('/products/personalized-recommendations', optionalAnonymousGetConfig(undefined, cacheLoaderOptions(options)))
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
            api.get<ProductPublic[]>('/products/add-on-candidates', anonymousGetConfig({ params }, cacheLoaderOptions(options)))
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
            api.get<ProductPublic[]>(`/products/${productId}/recommendations`, anonymousGetConfig(undefined, cacheLoaderOptions(options)))
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

type OrderPaymentPayload = {
    transactionId?: string | null;
};

type OrderShipmentPayload = {
    trackingNumber: string;
    trackingCarrierCode?: string | null;
};

const normalizeOrderPaymentBody = (payload?: string | OrderPaymentPayload) => ({
    transactionId: normalizeTextParam(typeof payload === 'string' ? payload : payload?.transactionId, 120) || undefined,
});

const normalizeOrderShipmentBody = (payload: string | OrderShipmentPayload, trackingCarrierCode?: string | null) => {
    const trackingNumber = normalizeTextParam(typeof payload === 'string' ? payload : payload?.trackingNumber, 120);
    if (!trackingNumber) {
        throw new Error('Tracking number is required');
    }
    return {
        trackingNumber,
        trackingCarrierCode: normalizeTextParam(typeof payload === 'string' ? trackingCarrierCode : payload?.trackingCarrierCode, 40) || undefined,
    };
};

// 订单相关 API
export const orderApi = {
    getAll: () => api.get<Order[]>('/orders').then(withArrayData),
    getById: (id: number, guestEmail?: string, orderNo?: string) => {
        const normalizedId = toPathId(id);
        const credentials = guestParams(guestEmail, orderNo);
        return credentials
            ? api.post<OrderCustomer>(`/orders/guest/${normalizedId}`, credentials, anonymousRequestConfig())
            : api.get<OrderCustomer>(`/orders/${normalizedId}`);
    },
    getByUser: (_userId: number) => api.get<OrderCustomer[]>('/orders/me').then(withArrayData),
    getMine: () => api.get<OrderCustomer[]>('/orders/me').then(withArrayData),
    track: (orderNo: string, email: string, options?: ApiRequestOptions) => {
        const normalizedOrderNo = normalizeOrderTrackingNumber(orderNo);
        const normalizedEmail = normalizeEmailParam(email) || '';
        if (!normalizedOrderNo || !normalizedEmail) {
            return Promise.reject(new Error('Order number and email are required'));
        }
        const cacheKey = `${normalizedOrderNo}:${normalizedEmail}`;
        if (!options?.bypassCache && !options?.signal) {
            const cached = orderTrackCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return Promise.resolve(cached.response);
            }
            const pending = orderTrackRequests.get(cacheKey);
            if (pending) return pending;
        }
        const request = api.post<OrderTrackResult>('/orders/track', {
            orderNo: normalizedOrderNo,
            email: normalizedEmail,
        }, anonymousRequestConfig(undefined, options))
            .then((response) => {
                setTimedCacheEntry(orderTrackCache, cacheKey, {
                    response,
                    expiresAt: Date.now() + ORDER_TRACK_CACHE_MS,
                });
                return response;
            })
            .finally(() => orderTrackRequests.delete(cacheKey));
        if (!options?.bypassCache && !options?.signal) {
            setBoundedMapEntry(orderTrackRequests, cacheKey, request);
        }
        return request;
    },
    checkout: (payload: { cartItemIds: number[]; shippingAddress: string; paymentMethod: string; userCouponId?: number | null; recipientName?: string; recipientPhone?: string; contactEmail?: string }, options?: CheckoutRequestOptions) =>
        api.post<OrderCustomer>('/orders/checkout/me', {
            cartItemIds: normalizePositiveIntList(payload.cartItemIds, 100),
            shippingAddress: normalizeTextParam(payload.shippingAddress, 1000),
            recipientName: normalizeTextParam(payload.recipientName, 120),
            recipientPhone: normalizeTextParam(payload.recipientPhone, 60),
            contactEmail: normalizeEmailParam(payload.contactEmail),
            paymentMethod: normalizeTextParam(payload.paymentMethod, 40),
            userCouponId: normalizePositiveInt(payload.userCouponId) || null,
        }, checkoutIdempotencyConfig(options)),
    guestCheckout: (payload: {
        guestEmail: string;
        guestName: string;
        guestPhone: string;
        shippingAddress: string;
        paymentMethod: string;
        items: Array<{ productId: number; quantity: number; selectedSpecs?: string }>;
    }, options?: CheckoutRequestOptions) => {
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
        }, checkoutIdempotencyConfig(options));
    },
    cancel: (id: number, guestEmail?: string, orderNo?: string) =>
        api.post(`${guestOrderPath(id, guestEmail, orderNo)}/cancel`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo))
            .finally(clearOrderTrackCache),
    confirm: (id: number, guestEmail?: string, orderNo?: string) =>
        api.post(`${guestOrderPath(id, guestEmail, orderNo)}/confirm`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo))
            .finally(clearOrderTrackCache),
    returnOrder: (id: number, reason?: string, guestEmail?: string, orderNo?: string) => {
        const credentials = guestParams(guestEmail, orderNo);
        return api.post(`${guestOrderPath(id, guestEmail, orderNo)}/return`, {
            reason: normalizeTextParam(reason, 1000),
            ...(credentials || {}),
        }, guestRequestConfig(guestEmail, orderNo)).finally(clearOrderTrackCache);
    },
    submitReturnShipment: (id: number, returnTrackingNumber: string, guestEmail?: string, orderNo?: string) => {
        const credentials = guestParams(guestEmail, orderNo);
        return api.post(`${guestOrderPath(id, guestEmail, orderNo)}/return-shipment`, {
            returnTrackingNumber: normalizeTextParam(returnTrackingNumber, 120),
            ...(credentials || {}),
        }, guestRequestConfig(guestEmail, orderNo)).finally(clearOrderTrackCache);
    },
    pay: (id: number, payload?: string | OrderPaymentPayload) => api.post(`/orders/${toPathId(id)}/pay`, normalizeOrderPaymentBody(payload)),
    ship: (id: number, payload: string | OrderShipmentPayload, trackingCarrierCode?: string) =>
        api.post(`/orders/${toPathId(id)}/ship`, normalizeOrderShipmentBody(payload, trackingCarrierCode)),
    getItems: (orderId: number, guestEmail?: string, orderNo?: string) => {
        const normalizedOrderId = normalizePositiveInt(orderId);
        if (!normalizedOrderId) return Promise.resolve({ data: [] } as unknown as AxiosResponse<OrderItemCustomer[]>);
        const guestKey = hasGuestCredentials(guestEmail, orderNo) ? `guest:${normalizeEmailParam(guestEmail)}:${normalizeOrderTrackingNumber(orderNo || '')}` : `auth:${currentUserCacheKey()}`;
        const cacheKey = `${normalizedOrderId}:${guestKey}`;
        const cached = orderItemsCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
        const pending = orderItemsRequests.get(cacheKey);
        if (pending) return pending;
        const credentials = guestParams(guestEmail, orderNo);
        const rawRequest = credentials
            ? api.post<OrderItemCustomer[]>(`/orders/guest/${normalizedOrderId}/items`, credentials, anonymousRequestConfig())
            : api.get<OrderItemCustomer[]>(`/orders/${normalizedOrderId}/items`);
        const request = rawRequest
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
    getInfo: () => api.get<{ status: string; channels: PaymentChannel[]; endpoints: Record<string, string> }>('/payments', anonymousGetConfig()),
    getChannels: () => {
        if (paymentChannelRuntime.cache && paymentChannelRuntime.cache.expiresAt > Date.now()) {
            return Promise.resolve(paymentChannelRuntime.cache.response);
        }
        if (paymentChannelRuntime.request) return paymentChannelRuntime.request;
        paymentChannelRuntime.request = api.get<PaymentChannel[]>('/payments/channels', anonymousGetConfig())
            .then((response) => {
                const normalized = withArrayData(response);
                paymentChannelRuntime.cache = { response: normalized, expiresAt: Date.now() + PAYMENT_CHANNEL_CACHE_MS };
                return normalized;
            })
            .finally(() => {
                paymentChannelRuntime.request = null;
            });
        return paymentChannelRuntime.request;
    },
    create: (orderId: number, channel: string, guestEmail?: string, orderNo?: string) => api.post<PaymentCustomer>('/payments', {
        orderId: toPathId(orderId),
        channel: normalizeTextParam(channel, 40).toUpperCase(),
        ...(hasGuestCredentials(guestEmail, orderNo) ? guestParams(guestEmail, orderNo) : {}),
    }, guestRequestConfig(guestEmail, orderNo)),
    simulatePaid: (paymentId: number) => api.post<AdminPayment>(`/payments/${toPathId(paymentId)}/simulate-paid`),
    simulateCallback: (paymentId: number) => api.post<AdminPayment>(`/payments/${toPathId(paymentId)}/simulate-callback`),
    sync: (paymentId: number, guestEmail?: string, orderNo?: string) => api.post<PaymentCustomer>(`/payments/${toPathId(paymentId)}/sync`, guestParams(guestEmail, orderNo), guestRequestConfig(guestEmail, orderNo)),
    syncByOrder: (orderId: number) => api.post<PaymentCustomer[]>(`/payments/order/${toPathId(orderId)}/sync`, {}).then(withArrayData),
    callback: (payload: {
        orderNo: string;
        channel: string;
        transactionId: string;
        status: string;
        amount: number;
        callbackTimestamp: number;
        signature: string;
    }) => api.post<{ received: boolean }>('/payments/callback', payload),
    getByOrder: (orderId: number, guestEmail?: string, orderNo?: string) => {
        const normalizedId = toPathId(orderId);
        const credentials = guestParams(guestEmail, orderNo);
        return credentials
            ? api.post<PaymentCustomer[]>(`/payments/guest/order/${normalizedId}`, credentials, anonymousRequestConfig()).then(withArrayData)
            : api.get<PaymentCustomer[]>(`/payments/order/${normalizedId}`, { params: undefined }).then(withArrayData);
    },
    getLatestByOrder: (orderId: number, guestEmail?: string, orderNo?: string, options?: ApiRequestOptions) => {
        const normalizedId = toPathId(orderId);
        const credentials = guestParams(guestEmail, orderNo);
        return credentials
            ? api.post<PaymentCustomer>(`/payments/guest/order/${normalizedId}/latest`, credentials, anonymousRequestConfig({}, options))
            : api.get<PaymentCustomer>(`/payments/order/${normalizedId}/latest`, withRequestOptions({ params: undefined }, options));
    },
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
    uploadImage: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<{ imageUrl: string }>('/reviews/images', formData);
    },
    create: (productId: number, orderId: number, rating: number, comment: string, imageUrls: string[] = []) => {
        const normalizedImageUrls = normalizeImageListParam(imageUrls, 4, 2048);
        return api.post<PublicReview>(`/reviews/product/${toPathId(productId)}`, {
            orderId: toPathId(orderId),
            rating: Math.max(1, Math.min(5, Math.floor(Number(rating) || 0))),
            comment: normalizeTextParam(comment, MAX_REVIEW_COMMENT_LENGTH),
            ...(normalizedImageUrls.length > 0 ? { imageUrls: normalizedImageUrls } : {}),
        }).finally(() => clearReviewCache(toPathId(productId)));
    },
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
    getForUser: (userId: number, page = 1, size = 50) => api.get<AppNotification[]>('/notifications', {
        params: {
            userId: toPathId(userId),
            page: Number.isSafeInteger(page) && page > 0 ? page : 1,
            size: Number.isSafeInteger(size) && size > 0 ? Math.min(size, 100) : 50,
        },
    }).then(withArrayData),
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
    getUnreadCountForUser: (userId: number) => api.get<{ count: number }>('/notifications/unread-count', {
        params: { userId: toPathId(userId) },
    }),
    markAsRead: (id: number, userId?: number) => api.put(`/notifications/${toPathId(id)}/read`).finally(() => clearNotificationCache(userId)),
    markAllAsRead: () => api.put('/notifications/me/read-all').finally(() => clearNotificationCache()),
    markAllAsReadForUser: (userId: number) => api.put('/notifications/read-all', null, {
        params: { userId: toPathId(userId) },
    }).finally(() => clearNotificationCache(userId)),
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
        const requestConfig = { params, allowAnonymousRetry: false } as AuthRetryConfig;
        return cachedGet(logisticsTrackCache, logisticsTrackRequests, cacheKey, LOGISTICS_TRACK_CACHE_MS, () =>
            credentials
                ? api.post<LogisticsTrackResponse>('/logistics/track', params, anonymousRequestConfig())
                : api.get<LogisticsTrackResponse>('/logistics/track', requestConfig));
    },
};


export const supportApi = {
    createWebSocketTicket: () => api.post<SupportWebSocketTicket>('/support/websocket-ticket'),
    getSession: () => api.get<SupportSessionCustomer>('/support/session'),
    createSession: () => api.post<SupportSessionCustomer>('/support/session'),
    getSessions: (options?: SupportSessionQuery) =>
        api.get<SupportSessionCustomer[]>('/support/sessions', { params: normalizeSupportSessionParams(options) }),
    getMessages: (sessionId: number, options?: SupportMessageQuery) =>
        api.get<SupportMessageCustomer[]>(`/support/sessions/${toPathId(sessionId)}/messages`, { params: normalizeSupportMessageParams(options) }),
    sendMessage: (content: string, sessionId?: number) =>
        api.post<{ message: SupportMessageCustomer; session: SupportSessionCustomer }>('/support/messages', {
            content: normalizeSupportMessageContent(content),
            sessionId: normalizePositiveInt(sessionId) || undefined,
        }),
    markRead: (sessionId: number) => api.put(`/support/sessions/${toPathId(sessionId)}/read`),
    closeSession: (sessionId: number) => api.put<SupportSessionCustomer>(`/support/sessions/${toPathId(sessionId)}/close`),
    getUnreadCount: () => api.get<{ count: number }>('/support/unread-count'),
    getGuestSession: (orderNo: string, email: string) => api.post<SupportSessionCustomer>('/support/guest/session/lookup', {
        orderNo: normalizeOrderTrackingNumber(orderNo),
        guestEmail: normalizeEmailParam(email) || '',
    }, anonymousRequestConfig()),
    createGuestSession: (orderNo: string, email: string) => api.post<SupportSessionCustomer>('/support/guest/session', {
        orderNo: normalizeOrderTrackingNumber(orderNo),
        guestEmail: normalizeEmailParam(email) || '',
    }, anonymousRequestConfig()),
    getGuestMessages: (sessionId: number, orderNo: string, email: string, options?: SupportMessageQuery) =>
        api.post<SupportMessageCustomer[]>(`/support/guest/sessions/${toPathId(sessionId)}/messages`, {
            orderNo: normalizeOrderTrackingNumber(orderNo),
            guestEmail: normalizeEmailParam(email) || '',
            ...normalizeSupportMessageParams(options),
        }, anonymousRequestConfig()),
    sendGuestMessage: (content: string, orderNo: string, email: string, sessionId?: number) =>
        api.post<{ message: SupportMessageCustomer; session: SupportSessionCustomer }>('/support/guest/messages', {
            content: normalizeSupportMessageContent(content),
            sessionId: normalizePositiveInt(sessionId) || undefined,
            orderNo: normalizeOrderTrackingNumber(orderNo),
            guestEmail: normalizeEmailParam(email) || '',
        }, anonymousRequestConfig()),
    markGuestRead: (sessionId: number, orderNo: string, email: string) => api.put(`/support/guest/sessions/${toPathId(sessionId)}/read`, {
        orderNo: normalizeOrderTrackingNumber(orderNo),
        guestEmail: normalizeEmailParam(email) || '',
    }, anonymousRequestConfig()),
};

