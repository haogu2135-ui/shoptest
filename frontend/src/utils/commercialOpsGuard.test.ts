import fs from 'fs';
import path from 'path';

const readFrontendRoot = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8');

describe('commercial ops contracts', () => {
  it('keeps a runnable HTTP commercial smoke entry for live storefront+API gates', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const smoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');

    expect(pkg.scripts['test:commercial-smoke']).toContain('commercial-http-smoke.js');
    expect(smoke).toContain('/api/products');
    expect(smoke).toContain('/api/payments/channels');
    expect(smoke).toContain('/api/app/config');
    expect(smoke).toContain('mexico payment rails present');
    expect(smoke).toContain('MERCADO_PAGO');
    expect(smoke).toContain('/checkout');
    expect(smoke).toContain('robots.txt');
    expect(smoke).toContain('/api/orders/checkout/guest');
    expect(smoke).toContain('/api/payments');
    expect(smoke).toContain('/api/orders/track');
    expect(smoke).toContain('guest checkout PENDING_PAYMENT');
    expect(smoke).toContain('guest checkout rate-limit handled');
    expect(smoke).toContain('skipped guest conversion after backoff retry');
    expect(smoke).toContain('payment has paymentUrl');
    expect(smoke).toContain('signPaymentCallback');
    expect(smoke).toContain('payment callback received');
    expect(smoke).toContain('mercado webhook endpoint live');
    expect(smoke).toContain('stripe webhook endpoint live');
    expect(smoke).toContain('mercado webhook alias endpoint live');
    expect(smoke).toContain('signMercadoPagoWebhook');
    expect(smoke).toContain('MERCADO_PAGO_WEBHOOK_SECRET');
    expect(smoke).toContain('mercado webhook invalid signature 400');
    expect(smoke).toContain('mercado webhook valid signature accepted');
    expect(smoke).toContain('mercado webhook signed path skipped');
    expect(smoke).toContain('signStripeWebhook');
    expect(smoke).toContain('STRIPE_WEBHOOK_SECRET');
    expect(smoke).toContain('stripe webhook invalid signature 400');
    expect(smoke).toContain('stripe webhook valid signature accepted');
    expect(smoke).toContain('stripe webhook signed path skipped');
    expect(smoke).toContain('paid payment status PAID');
    expect(smoke).toContain('auth register 200');
    expect(smoke).toContain('auth register rate-limit handled');
    expect(smoke).toContain('auth checkout 200');
    expect(smoke).toContain('auth payment create 200');
    expect(smoke).toContain('auth paid payment status PAID');
    expect(smoke).toContain('SHOPTEST_PAYMENT_CALLBACK_SECRET');
  });


  it('keeps commercial mobile-device viewport and production readiness smoke entries', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const mobile = readFrontendRoot('scripts', 'commercial-mobile-device-smoke.js');
    const production = readFrontendRoot('scripts', 'commercial-production-readiness.js');
    expect(pkg.scripts['test:commercial-mobile-device-smoke']).toContain('commercial-mobile-device-smoke.js');
    expect(pkg.scripts['test:commercial-production-readiness']).toContain('commercial-production-readiness.js');
    expect(mobile).toContain('320x568');
    expect(mobile).toContain('360x740');
    expect(mobile).toContain('390x844');
    expect(mobile).toContain('ShopTestAndroidApp');
    expect(mobile).toContain('primary touch targets >=44px');
    expect(mobile).toContain('sticky rail clear of bottom nav');
    expect(mobile).toContain('real-device APK/WebView install E2E remains required');
    expect(production).toContain('SHOPTEST_REQUIRE_PRODUCTION');
    expect(production).toContain('production host reachable');
    expect(production).toContain('production DNS A records');
    expect(production).toContain('production DNS AAAA records');
    expect(production).toContain('cloudflare origin gap diagnosis');
    expect(production).toContain('probeOriginEdgeDual');
    expect(production).toContain('origin edge CWV measurement');
    expect(production).toContain('SHOPTEST_PRODUCTION_HOST');
    expect(production).toContain('measureProductionCwv');
    expect(production).toContain('productionTlsInsecure');
    expect(production).toContain('local stripe webhook rejects bad signature');
    expect(production).toContain('local mercado webhook rejects bad signature');
    expect(production).toContain('real provider webhook traffic evidence');
    expect(production).toContain('real-device mobile E2E evidence');
    expect(production).toContain('local APK artifact integrity');
    expect(production).toContain('local mobile-version.json present');
    expect(production).toContain('probeLocalMobileReleaseArtifact');
  });

  it('keeps cloudflare origin diagnose classifying wrong-origin and healthy-origin 522', () => {
    const diagnose = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'scripts', 'diagnose-cloudflare-origin.sh'),
      'utf8',
    );
    expect(diagnose).toContain('external multiprobe note');
    expect(diagnose).toContain('200-wrong-origin');
    expect(diagnose).toContain('public_body_not_shopmx');
    expect(diagnose).toContain('Wrong/stale origin IP is the most common 522 cause');
    expect(diagnose).toContain('rapid4cloud');
    expect(diagnose).toContain('SHOPTEST_REQUIRE_PRODUCTION=1');
  });

  it('keeps checkout pure helpers modularized for commercial maintainability', () => {
    const helpers = fs.readFileSync(
      path.join(__dirname, 'checkoutHelpers.ts'),
      'utf8',
    );
    const checkout = fs.readFileSync(
      path.join(__dirname, '..', 'pages', 'Checkout.tsx'),
      'utf8',
    );
    expect(helpers).toContain('export const formatCheckoutDateTime');
    expect(helpers).toContain('export const getCheckoutCouponErrorMessage');
    expect(helpers).toContain('export const isValidCheckoutPostalCode');
    expect(helpers).toContain('export const normalizeCheckoutText');
    expect(helpers).toContain('export const hasCompleteCheckoutRecipientName');
    expect(helpers).toContain('export const estimateCouponDiscount');
    expect(helpers).toContain('export const getRecommendedPaymentMethod');
    expect(helpers).toContain('export const resolveCheckoutPaymentMethod');
    expect(helpers).toContain('export const toSafeMoney');
    expect(helpers).toContain('export const normalizeStatusCode');
    expect(helpers).toContain('export const isCompleteSavedAddress');
    expect(helpers).toContain('export const isPurchasable');
    expect(helpers).toContain('export const isFinalCheckoutOrderError');
    expect(helpers).toContain('export const mergeHydratableCheckoutFields');
    expect(helpers).toContain('export const resolveGuestRestorePrice');
    expect(helpers).toContain('export const parseCheckoutPendingOrderSnapshot');
    expect(helpers).toContain('export const parseCheckoutPaymentPollResult');
    expect(helpers).toContain('export const PAYMENT_STATUS_LABEL_KEYS');
    expect(helpers).toContain('export const buildCheckoutValidationAnnouncement');
    expect(helpers).toContain('export const createCheckoutIdempotencyKey');
    expect(helpers).toContain('export const readCheckoutPendingOrder');
    expect(helpers).toContain('export const persistCheckoutPendingOrder');
    expect(helpers).toContain('export const readCheckoutGuestDraftFields');
    expect(checkout).toContain('getOrCreateCheckoutIdempotencyKey');
    expect(checkout).toContain('readCheckoutPendingOrder');
    expect(checkout).not.toContain('const createCheckoutIdempotencyKey = () => {');
    expect(checkout).not.toContain('const readCheckoutPendingOrder = () => {');
    expect(helpers).toContain('export const buildCheckoutFieldErrorMap');
    expect(helpers).toContain('export const normalizeCheckoutValidationMessage');
    expect(checkout).toContain('buildCheckoutValidationAnnouncement');
    expect(checkout).not.toContain('const buildCheckoutValidationAnnouncement = (');
    expect(checkout).toContain('resolveGuestRestorePrice');
    expect(checkout).toContain('parseCheckoutPendingOrderSnapshot');
    expect(checkout).not.toContain('const resolveGuestRestorePrice = (item: CartItem, product');
    expect(checkout).not.toContain('const parseCheckoutPendingOrderSnapshot = (raw: string | null)');
    expect(checkout).toContain('isCompleteSavedAddress');
    expect(checkout).toContain('isPurchasable');
    expect(checkout).not.toContain('const isCompleteSavedAddress = (address?: UserAddress | null) =>');
    expect(checkout).not.toContain('const isPurchasable = (item: CartItem) =>');
    expect(checkout).toContain("from '../utils/checkoutHelpers'");
    expect(checkout).toContain('formatCheckoutDateTime');
    expect(checkout).toContain('getCheckoutCouponErrorMessage');
    expect(checkout).toContain('normalizeCheckoutText');
    expect(checkout).toContain('estimateCouponDiscount');
    expect(checkout).toContain('resolveCheckoutPaymentMethod');
    expect(checkout).not.toContain('const normalizeCheckoutText = (value: unknown, maxLength: number) =>');
    expect(checkout).not.toContain('const estimateCouponDiscount = (coupon: UserCoupon, cartTotal: number) =>');
    expect(checkout).not.toContain('const getRecommendedPaymentMethod = (channels: PaymentChannel[], currency: string) =>');
  });



  it('keeps checkout submit and guest restore pure guards modularized', () => {
    const helpers = fs.readFileSync(path.join(__dirname, 'checkoutHelpers.ts'), 'utf8');
    const checkout = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Checkout.tsx'), 'utf8');
    const orderActions = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useCheckoutOrderActions.ts'), 'utf8');
    const checkoutSurface = `${checkout}
${orderActions}`;
    expect(helpers).toContain('export const buildGuestCheckoutOrderItems');
    expect(helpers).toContain('export const buildGuestRestoreCartLine');
    expect(helpers).toContain('export const resolveCheckoutCartSubmitGuard');
    expect(helpers).toContain('export const resolveCheckoutContactSubmitGuard');
    expect(orderActions).toContain('resolveCheckoutCartSubmitGuard({');
    expect(orderActions).toContain('resolveCheckoutContactSubmitGuard({');
    expect(orderActions).toContain('buildGuestCheckoutOrderItems(cartItems)');
    expect(checkoutSurface).toMatch(/paymentMethodDetails\.some\(\s*\(method\)\s*=>\s*method\.value === normalizedPaymentMethod\s*\)/);
  });



  it('keeps checkout form sections modularized outside the page shell', () => {
    const checkout = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Checkout.tsx'), 'utf8');
    const formSections = fs.readFileSync(path.join(__dirname, '..', 'components', 'checkout', 'CheckoutFormSections.tsx'), 'utf8');
    expect(checkout).toContain("from '../components/checkout/CheckoutFormSections'");
    expect(checkout).toContain('CheckoutItemsCard');
    expect(checkout).toContain('CheckoutExpressPaymentGrid');
    expect(checkout).toContain('CheckoutSubmitPaymentSection');
    expect(formSections).toContain('export const CheckoutItemsCard');
    expect(formSections).toContain('export const CheckoutExpressPaymentGrid');
    expect(formSections).toContain('export const CheckoutSubmitPaymentSection');
    expect(formSections).toContain('checkout-page__mobilePayBar');
    expect(formSections).toContain('checkout-page__legalNotice');
    expect(formSections).toContain('data-checkout-payment-unavailable-recovery');
  });

  it('keeps checkout shell states modularized outside the page form shell', () => {
    const checkout = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Checkout.tsx'), 'utf8');
    const shells = fs.readFileSync(path.join(__dirname, '..', 'components', 'checkout', 'CheckoutShellStates.tsx'), 'utf8');
    const helpers = fs.readFileSync(path.join(__dirname, 'checkoutHelpers.ts'), 'utf8');
    expect(checkout).toContain("from '../components/checkout/CheckoutShellStates'");
    expect(checkout).toContain('CheckoutLoadingShell');
    expect(checkout).toContain('CheckoutEmptyShell');
    expect(checkout).toContain('CheckoutPaymentActiveShell');
    expect(checkout).toContain('CheckoutPaymentPendingShell');
    expect(checkout).toContain('CheckoutCartLoadErrorShell');
    expect(shells).toContain('export const CheckoutLoadingShell');
    expect(shells).toContain('export const CheckoutEmptyShell');
    expect(shells).toContain('data-checkout-empty-actions');
    expect(shells).toContain('data-checkout-load-recovery');
    expect(helpers).toContain('export const buildCheckoutPaymentRecoveryCopy');
    expect(shells).toContain('buildCheckoutPaymentRecoveryCopy');
  });

  it('keeps checkout payment lifecycle modularized outside the page shell', () => {
    const checkout = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Checkout.tsx'), 'utf8');
    const lifecycle = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useCheckoutPaymentLifecycle.ts'), 'utf8');
    expect(checkout).toContain("from '../hooks/useCheckoutPaymentLifecycle'");
    expect(checkout).toContain('useCheckoutPaymentLifecycle({');
    expect(checkout).not.toContain('const claimCheckoutPaymentPollLock');
    expect(lifecycle).toContain('export const useCheckoutPaymentLifecycle');
    expect(lifecycle).toContain('claimCheckoutPaymentPollLock');
    expect(lifecycle).toContain('startCheckoutPaymentPollWebLockSession');
    expect(lifecycle).toContain('writeCheckoutPaymentPollResult');
    expect(lifecycle).toContain('Checkout.pollPendingPayment');
    expect(lifecycle).toContain('Checkout.refreshSubmittedPayment');
    expect(lifecycle).toContain('CHECKOUT_PAYMENT_POLL_MAX_MS');
  });


  it('keeps product detail pure helpers, shell skeletons, and non-critical fetch modularized', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'ProductDetail.tsx'), 'utf8');
    const helpers = fs.readFileSync(path.join(__dirname, '..', 'pages', 'productDetailHelpers.tsx'), 'utf8');
    const shell = fs.readFileSync(path.join(__dirname, '..', 'pages', 'productDetailShell.tsx'), 'utf8');
    const nonCritical = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProductDetailNonCriticalContent.ts'), 'utf8');
    const gallery = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProductDetailGallery.ts'), 'utf8');
    const purchase = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProductDetailPurchaseActions.ts'), 'utf8');
    const engagement = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProductDetailEngagementActions.ts'), 'utf8');
    const community = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProductDetailCommunityActions.ts'), 'utf8');
    const recommendation = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProductDetailRecommendationActions.ts'), 'utf8');
    const recommendationsPanel = fs.readFileSync(path.join(__dirname, '..', 'pages', 'productDetailRecommendations.tsx'), 'utf8');
    const galleryPanel = fs.readFileSync(path.join(__dirname, '..', 'pages', 'productDetailGallery.tsx'), 'utf8');

    expect(page).toContain("from './productDetailHelpers'");
    expect(page).toContain("from './productDetailShell'");
    expect(page).toContain("from '../hooks/useProductDetailNonCriticalContent'");
    expect(page).toContain("from '../hooks/useProductDetailGallery'");
    expect(page).toContain("from '../hooks/useProductDetailPurchaseActions'");
    expect(page).toContain("from '../hooks/useProductDetailEngagementActions'");
    expect(page).toContain("from '../hooks/useProductDetailCommunityActions'");
    expect(page).toContain("from '../hooks/useProductDetailRecommendationActions'");
    expect(page).toContain("from './productDetailRecommendations'");
    expect(page).toContain('useProductDetailNonCriticalContent({');
    expect(page).toContain('useProductDetailGallery({');
    expect(page).toContain('useProductDetailPurchaseActions({');
    expect(page).toContain('useProductDetailEngagementActions({');
    expect(page).toContain('useProductDetailCommunityActions({');
    expect(page).toContain('useProductDetailRecommendationActions({');
    expect(page).toContain('<ProductDetailRecommendations');
    expect(page).toContain('<ProductDetailCompleteSet');
    expect(page).toContain('buildRelatedRecommendations');
    expect(page).toContain('warmNonCriticalContent');
    expect(page).toContain('handleAddToCart');
    expect(page).toContain('handleBuyNow');
    expect(page).toContain('selectGalleryImage');
    expect(page).toContain('handleFavorite');
    expect(page).toContain('handleAskQuestion');
    expect(helpers).toContain('export const normalizeProductDetailTab');
    expect(helpers).toContain('export const normalizeQuestionText');
    expect(helpers).toContain('export const PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG = 200;');
    expect(helpers).toContain('export const findSelectedProductVariant');
    expect(helpers).toContain('export const buildSelectedSpecsPayload');
    expect(shell).toContain('export const ProductDetailSkeleton');
    expect(shell).toContain('export const ProductDetailLazyFallback');
    expect(nonCritical).toContain('export const useProductDetailNonCriticalContent');
    expect(nonCritical).toContain('const fetchReviews = useCallback(async (requestSeq: number) => {');
    expect(nonCritical).toContain('const warmNonCriticalContent = useCallback((requestSeq: number) => {');
    expect(gallery).toContain('export const useProductDetailGallery');
    expect(gallery).toContain('const selectGalleryImage = (image: string, index: number) => {');
    expect(gallery).toContain('Avoid background carousel timers in tests');
    expect(purchase).toContain('export const useProductDetailPurchaseActions');
    expect(purchase).toContain('const handleAddToCart = async () => {');
    expect(purchase).toContain('const handleBuyNow = async () => {');
    expect(engagement).toContain('export const useProductDetailEngagementActions');
    expect(engagement).toContain('const handleFavorite = async () => {');
    expect(engagement).toContain('const handleStockAlert = () => {');
    expect(engagement).toContain('const handleCompare = () => {');
    expect(community).toContain('export const useProductDetailCommunityActions');
    expect(community).toContain('const handleAddReview = async (orderId: number, rating: number, comment: string, imageUrls: string[] = []) => {');
    expect(community).toContain('const handleAskQuestion = async () => {');
    expect(recommendation).toContain('export const useProductDetailRecommendationActions');
    expect(recommendation).toContain('const handleAddRecommendationToCart = async (');
    expect(helpers).toContain('export const isRecommendationUnavailable');
    expect(helpers).toContain('export const buildRelatedRecommendations');
    expect(helpers).toContain('export const buildCompleteSetItems');
    expect(recommendationsPanel).toContain('export const ProductDetailRecommendations');
    expect(recommendationsPanel).toContain('product-recommendations--strip');
    expect(page).not.toContain('product-recommendations--strip');
    expect(galleryPanel).toContain('export const ProductDetailGallery');
    expect(galleryPanel).toContain('export const ProductDetailImagePreviewModal');
    expect(galleryPanel).toContain('product-detail-main-image');
    expect(galleryPanel).toContain('product-gallery-controls__pause');
    expect(page).toContain("from './productDetailGallery'");
    expect(page).toContain('<ProductDetailGallery');
    expect(page).toContain('<ProductDetailImagePreviewModal');
    expect(page).not.toContain('className="product-detail-main-image"');
    expect(page).not.toContain('product-gallery-controls__pause');
    expect(page).not.toContain('const handleAddRecommendationToCart = async (event: React.MouseEvent<HTMLElement>, item: Product) => {');
    expect(page).not.toContain('const fetchReviews = useCallback(async (requestSeq: number) => {');
    expect(page).not.toContain('const ProductDetailSkeleton: React.FC');
    expect(page).not.toContain('const handleAddToCart = async () => {');
    expect(page).not.toContain('const selectGalleryImage = (image: string, index: number) => {');
    expect(page).not.toContain('const handleFavorite = async () => {');
    expect(page).not.toContain('const handleAskQuestion = async () => {');
  });

  it('keeps profile payment, address, and pet actions modularized outside the page shell', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'Profile.tsx'), 'utf8');
    const helpers = fs.readFileSync(path.join(__dirname, 'profileHelpers.ts'), 'utf8');
    const payment = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProfilePaymentActions.ts'), 'utf8');
    const address = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProfileAddressActions.ts'), 'utf8');
    const pet = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProfilePetActions.ts'), 'utf8');
    const ordersPanel = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profileOrdersPanel.tsx'), 'utf8');
    const addressesPanel = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profileAddressesPanel.tsx'), 'utf8');
    const petsPanel = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profilePetsPanel.tsx'), 'utf8');
    const orderDetailModal = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profileOrderDetailModal.tsx'), 'utf8');
    const returnModals = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profileReturnModals.tsx'), 'utf8');
    const paymentModal = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profilePaymentModal.tsx'), 'utf8');
    const infoPanel = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profileInfoPanel.tsx'), 'utf8');
    const accountModals = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profileAccountModals.tsx'), 'utf8');
    const account = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProfileAccountActions.ts'), 'utf8');
    const order = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useProfileOrderActions.ts'), 'utf8');

    expect(page).toContain("from '../utils/profileHelpers'");
    expect(page).toContain("from '../hooks/useProfilePaymentActions'");
    expect(page).toContain("from '../hooks/useProfileAddressActions'");
    expect(page).toContain("from '../hooks/useProfilePetActions'");
    expect(page).toContain("from './profileOrdersPanel'");
    expect(page).toContain("from '../hooks/useProfileAccountActions'");
    expect(page).toContain("from '../hooks/useProfileOrderActions'");
    expect(page).toContain('useProfilePaymentActions({');
    expect(page).toContain('useProfileAddressActions({');
    expect(page).toContain('useProfilePetActions({');
    expect(page).toContain('<ProfileOrdersPanel');
    expect(page).toContain('useProfileAccountActions({');
    expect(page).toContain('useProfileOrderActions({');
    expect(helpers).toContain('export const normalizeProfileTab');
    expect(helpers).toContain('export const isCompleteProfileAddress');
    expect(payment).toContain('export const useProfilePaymentActions');
    expect(address).toContain('export const useProfileAddressActions');
    expect(address).toContain('const handleSaveAddress = async () => {');
    expect(pet).toContain('export const useProfilePetActions');
    expect(pet).toContain('const handleSavePet = async () => {');
    expect(ordersPanel).toContain('export const ProfileOrdersPanel');
    expect(addressesPanel).toContain('export const ProfileAddressesPanel');
    expect(petsPanel).toContain('export const ProfilePetsPanel');
    expect(page).toContain("from './profileAddressesPanel'");
    expect(page).toContain("from './profilePetsPanel'");
    expect(page).toContain('<ProfileAddressesPanel');
    expect(page).toContain('<ProfilePetsPanel');
    expect(petsPanel).toContain('handleDeletePet(pet.id)');
    expect(orderDetailModal).toContain('export const ProfileOrderDetailModal');
    expect(returnModals).toContain('export const ProfileReturnModals');
    expect(paymentModal).toContain('export const ProfilePaymentModal');
    expect(page).toContain("from './profileOrderDetailModal'");
    expect(page).toContain("from './profileReturnModals'");
    expect(page).toContain("from './profilePaymentModal'");
    expect(page).toContain('<ProfileOrderDetailModal');
    expect(page).toContain('<ProfileReturnModals');
    expect(page).toContain('<ProfilePaymentModal');
    expect(paymentModal).toContain('data-profile-payment-history-empty="true"');
    expect(infoPanel).toContain('export const ProfileInfoPanel');
    expect(accountModals).toContain('export const ProfileAccountModals');
    expect(page).toContain("from './profileInfoPanel'");
    expect(page).toContain("from './profileAccountModals'");
    expect(page).toContain('<ProfileInfoPanel');
    expect(page).toContain('<ProfileAccountModals');
    expect(ordersPanel).toContain('data-profile-orders-load-recovery="true"');
    expect(ordersPanel).toContain('className="profile-order-card"');
    expect(page).not.toContain('data-profile-orders-load-recovery="true"');
    expect(account).toContain('export const useProfileAccountActions');
    expect(account).toContain('const handleEditProfile = async () => {');
    expect(order).toContain('export const useProfileOrderActions');
    expect(order).toContain('const handleViewOrder = async (order: OrderCustomer) => {');
    expect(page).not.toContain('const handleSaveAddress = async () => {');
    expect(page).not.toContain('const openPetModal = (pet?: PetProfile) => {');
    expect(page).not.toContain('const handleEditProfile = async () => {');
    expect(page).not.toContain('const handleViewOrder = async (order: OrderCustomer) => {');
  });


  it('keeps local UI server proxying API to the backend origin', () => {
    const serve = readFrontendRoot('scripts', 'serve-build.js');
    expect(serve).toContain('SHOPTEST_BACKEND_ORIGIN');
    expect(serve).toContain('/api');
    expect(serve).toMatch(/8081|BACKEND_ORIGIN|backendOrigin/);
  });

  it('keeps commercial security and static cache headers on the local UI server', () => {
    const serve = readFrontendRoot('scripts', 'serve-build.js');
    const smoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');
    expect(serve).toContain('commercialSecurityHeaders');
    expect(serve).toContain('X-Content-Type-Options');
    expect(serve).toContain('X-Frame-Options');
    expect(serve).toContain('Referrer-Policy');
    expect(serve).toContain('Content-Security-Policy');
    expect(serve).toContain('max-age=31536000, immutable');
    expect(serve).toContain("rel.startsWith('static/')");
    expect(smoke).toContain('ui security headers');
    expect(smoke).toContain('static js long-cache immutable');
  });

  it('keeps a Playwright commercial browser smoke entry for rendered storefront gates', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const browserSmoke = readFrontendRoot('scripts', 'commercial-browser-smoke.js');
    const httpSmoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');
    expect(pkg.scripts['test:commercial-browser-smoke']).toContain('commercial-browser-smoke.js');
    expect(browserSmoke).toContain("require('playwright')");
    expect(browserSmoke).toContain('/cart');
    expect(browserSmoke).toContain('/checkout');
    expect(browserSmoke).toContain('/track-order');
    expect(browserSmoke).toContain('skip link present');
    expect(browserSmoke).toContain('no page errors');
    expect(browserSmoke).toContain('home main content');
    expect(browserSmoke).toContain('cart empty multi-path CTAs');
    expect(browserSmoke).toContain('products catalog populated');
    expect(browserSmoke).toContain('browser auth login success');
    expect(browserSmoke).toContain('browser auth register rate-limit handled');
    expect(browserSmoke).toContain('/api/auth/register');
    expect(browserSmoke).toContain('readMainText');
    expect(browserSmoke).toContain('home LCP soft budget');
    expect(browserSmoke).toContain('Warm home once so cold post-rebuild asset compile does not flake the LCP soft gate');
    expect(browserSmoke).toContain('built multipath recovery markers present');
    expect(browserSmoke).toContain('home CLS soft budget');
    expect(browserSmoke).toContain('cwv.cls < 0.1');
    expect(browserSmoke).toContain('home mobile bottom bar height locked');
    expect(browserSmoke).toContain('cwv.lcp < 4000');
    expect(browserSmoke).toContain('product-mobile-buybar');
    expect(browserSmoke).toContain('login legal agreement notice');
    expect(browserSmoke).toContain('wishlist guest multi-path auth gate');
    expect(browserSmoke).toContain('notifications guest multi-path auth gate');
    expect(browserSmoke).toContain('profile guest multi-path auth gate');
    expect(browserSmoke).toContain('compare empty multi-path CTAs');
    expect(browserSmoke).toContain('product detail bottom nav hidden for buybar');
    expect(browserSmoke).toContain('__shopmxCwv');
    expect(browserSmoke).toContain('PerformanceObserver');
    expect(httpSmoke).toContain('robots.txt allows privacy');
    expect(httpSmoke).toContain('robots.txt allows products detail');
    expect(httpSmoke).toContain('security.txt');
    expect(httpSmoke).toContain('sitemap.xml includes terms');
    expect(httpSmoke).toContain('sitemap.xml includes product detail');
    expect(browserSmoke).toContain('/forgot-password');
    expect(browserSmoke).toContain('/privacy');
    expect(browserSmoke).toContain('cookie consent banner');
    expect(browserSmoke).toContain('cookie consent sticky rail selectors');
    expect(browserSmoke).toContain('customer-support-widget__button');
    expect(browserSmoke).toContain('shop-nav__bottomBar');
    expect(browserSmoke).toContain('/terms');
    expect(browserSmoke).toContain('/wishlist');
    expect(browserSmoke).toContain('/history');
    // Fixed smoke credentials avoid register thrash; login selectors must not match language Select.
    expect(browserSmoke).toContain('SHOPTEST_SMOKE_AUTH_USER');
    expect(browserSmoke).toContain('SHOPTEST_SMOKE_AUTH_PASSWORD');
    expect(browserSmoke).toContain('form.shopee-login-form input[autocomplete="username"]');
    expect(browserSmoke).toContain("localStorage.getItem('token')");
    expect(browserSmoke).toContain('([1-9]\\d*)\\s+products?');
    expect(httpSmoke).toContain('SHOPTEST_SMOKE_AUTH_USER');
    expect(httpSmoke).toContain('PAYMENT_CALLBACK_SECRET');
  });

  it('keeps Mercado Pago webhook endpoint wired for MX production paid recovery', () => {
    const paymentController = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/controller/PaymentController.java'), 'utf8');
    const paymentService = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/service/PaymentService.java'), 'utf8');
    const security = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/config/SecurityConfig.java'), 'utf8');
    const smoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');
    expect(paymentController).toContain('/mercado-pago/webhook');
    expect(paymentController).toContain('handleMercadoPagoWebhook');
    expect(paymentService).toContain('verifyMercadoPagoSignature');
    expect(paymentService).toContain('fetchMercadoPagoPayment');
    expect(paymentService).toContain('id:');
    expect(paymentService).toContain('request-id:');
    expect(security).toContain('/payments/mercado-pago/webhook');
    expect(smoke).toContain("id:${dataId};request-id:${requestId};ts:${ts};");
  });

  it('keeps admin system status payment webhook readiness surface for ops', () => {
    const adminSystem = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src/main/java/com/example/shop/controller/AdminSystemController.java'), 'utf8');
    const systemMonitor = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SystemMonitor.tsx'), 'utf8');
    expect(adminSystem).toContain('adminOperationalStatusPayload');
    expect(adminSystem).toContain('enrichPaymentProviderWebhookReadiness');
    expect(adminSystem).toContain('webhookReadyChannelCount');
    expect(adminSystem).toContain('payment.mercado-pago.webhook-secret');
    expect(adminSystem).toContain('stripe.webhook-secret');
    expect(systemMonitor).toContain('paymentWebhooks');
    expect(systemMonitor).toContain('channelWebhookReady');
    expect(systemMonitor).toContain('webhookReadyChannelCount');
    expect(systemMonitor).toContain('data-webhook-status');
    expect(systemMonitor).toContain('data-system-monitor-load-recovery');
    expect(systemMonitor).toContain("navigate('/admin')");
    expect(systemMonitor).toContain("navigate('/admin/orders')");
    expect(systemMonitor).toContain('actions={[');
  });

  it('keeps admin dashboard drilldown into payment provider webhook readiness', () => {
    const dashboard = fs.readFileSync(path.join(__dirname, '..', 'pages', 'AdminDashboard.tsx'), 'utf8');
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8'));
    expect(dashboard).toContain("navigate('/admin/system')");
    expect(dashboard).toContain('providerReadinessAction');
    expect(dashboard).toContain('data-admin-payment-provider-readiness');
    expect(en.pages.adminDashboard.paymentReturnOps.providerReadinessAction).toBeTruthy();
  });

  it('keeps admin dashboard load failures on multipath ops recovery exits', () => {
    const dashboard = fs.readFileSync(path.join(__dirname, '..', 'pages', 'AdminDashboard.tsx'), 'utf8');
    expect(dashboard).toContain('data-admin-dashboard-load-recovery');
    expect(dashboard).toContain('actions={[');
    expect(dashboard).toContain("navigate('/admin/orders')");
    expect(dashboard).toContain("navigate('/admin/system')");
    expect(dashboard).toContain("navigate('/admin/products')");
  });

  it('keeps commercial-critical admin load failures on multipath ops recovery exits', () => {
    const orders = fs.readFileSync(path.join(__dirname, '..', 'pages', 'OrderManagement.tsx'), 'utf8');
    const products = fs.readFileSync(path.join(__dirname, '..', 'pages', 'ProductManagement.tsx'), 'utf8');
    const coupons = fs.readFileSync(path.join(__dirname, '..', 'pages', 'CouponManagement.tsx'), 'utf8');
    const support = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SupportManagement.tsx'), 'utf8');
    const system = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SystemMonitor.tsx'), 'utf8');

    expect(orders).toContain('data-admin-orders-load-recovery');
    expect(orders).toContain('data-admin-orders-stale-recovery');
    expect(orders).toContain("navigate('/admin/system')");
    expect(orders).toContain("navigate('/admin/support')");
    expect(orders).toContain('actions={[');

    expect(products).toContain('data-admin-products-load-recovery');
    expect(products).toContain('data-admin-products-stale-recovery');
    expect(products).toContain("navigate('/admin/orders')");
    expect(products).toContain('actions={[');

    expect(coupons).toContain('data-admin-coupons-load-recovery');
    expect(coupons).toContain('data-admin-coupons-stale-recovery');
    expect(coupons).toContain("navigate('/admin/orders')");
    expect(coupons).toContain('actions={[');

    expect(support).toContain('data-admin-support-queue-recovery');
    expect(support).toContain('data-admin-support-messages-recovery');
    expect(support).toContain("navigate('/admin/orders')");
    expect(support).toContain("navigate('/admin/system')");

    expect(system).toContain('data-system-monitor-load-recovery');
    expect(system).toContain('data-system-monitor-stale-recovery');

    const users = fs.readFileSync(path.join(__dirname, '..', 'pages', 'UserManagement.tsx'), 'utf8');
    expect(users).toContain('data-admin-users-load-recovery');
    expect(users).toContain('data-admin-users-stale-recovery');
    expect(users).toContain("navigate('/admin/orders')");
    expect(users).toContain('actions={[');

    for (const [file, loadMarker, staleMarker] of [
      ['CategoryManagement.tsx', 'data-admin-categories-load-recovery', 'data-admin-categories-stale-recovery'],
      ['BrandManagement.tsx', 'data-admin-brands-load-recovery', 'data-admin-brands-stale-recovery'],
      ['LogisticsCarrierManagement.tsx', 'data-admin-carriers-load-recovery', 'data-admin-carriers-stale-recovery'],
      ['ReviewManagement.tsx', 'data-admin-reviews-load-recovery', 'data-admin-reviews-stale-recovery'],
      ['SecurityAuditLogManagement.tsx', 'data-admin-audit-load-recovery', 'data-admin-audit-stale-recovery'],
      ['AlertManagement.tsx', 'data-admin-alerts-load-recovery', 'data-admin-alerts-stale-recovery'],
      ['AnnouncementManagement.tsx', 'data-admin-announcements-load-recovery', 'data-admin-announcements-stale-recovery'],
      ['IpBlacklistManagement.tsx', 'data-admin-ip-blacklist-load-recovery', 'data-admin-ip-blacklist-stale-recovery'],
      ['ConfigCenter.tsx', 'data-admin-config-load-recovery', 'data-admin-config-stale-recovery'],
      ['LogManagement.tsx', 'data-admin-logs-load-recovery', 'data-admin-logs-stale-recovery'],
      ['PermissionManagement.tsx', 'data-admin-permissions-load-recovery', 'data-admin-permissions-stale-recovery'],
      ['PetGalleryManagement.tsx', 'data-admin-pet-gallery-load-recovery', 'data-admin-pet-gallery-stale-recovery'],
      ['ProductQuestionManagement.tsx', 'data-admin-questions-load-recovery', 'data-admin-questions-stale-recovery'],
      ['RegistryManagement.tsx', 'data-admin-registry-load-recovery', 'data-admin-registry-stale-recovery'],
      ['TrafficControl.tsx', 'data-admin-traffic-load-recovery', 'data-admin-traffic-stale-recovery'],
      ['BugManagement.tsx', 'data-admin-bugs-load-recovery', 'data-admin-bugs-stale-recovery'],
    ] as const) {
      const source = fs.readFileSync(path.join(__dirname, '..', 'pages', file), 'utf8');
      expect(source).toContain(loadMarker);
      expect(source).toContain(staleMarker);
      expect(source).toContain('actions={[');
      expect(source).toContain("navigate('/admin')");
    }
    const bugs = fs.readFileSync(path.join(__dirname, '..', 'pages', 'BugManagement.tsx'), 'utf8');
    expect(bugs).toContain('data-admin-bugs-summary-load-recovery');
    expect(bugs).toContain('data-admin-bugs-summary-stale-recovery');
  });

  it('keeps multi-host storefront payment URL rewrite contracts in commercial HTTP smoke', () => {
    const smoke = readFrontendRoot('scripts', 'commercial-http-smoke.js');
    expect(smoke).toContain('payment url storefront payment path');
    expect(smoke).toContain('payment url rewrites onto current UI origin');
    expect(smoke).toContain('payment instructions spa on current UI');
    expect(smoke).toContain('isStorefrontPaymentPath');
  });

  it('keeps an atomic commercial frontend build entry that avoids mid-build UI outages', () => {
    const pkg = JSON.parse(readFrontendRoot('package.json'));
    const safeBuild = readFrontendRoot('scripts', 'safe-commercial-build.sh');
    // Default `npm run build` must be atomic: staging build then swap into live build/.
    expect(pkg.scripts.build).toContain('safe-commercial-build.sh');
    expect(pkg.scripts['build:commercial']).toContain('safe-commercial-build.sh');
    expect(pkg.scripts['build:raw']).toContain('react-scripts build');
    expect(safeBuild).toContain('BUILD_PATH');
    expect(safeBuild).toContain('build.next');
    expect(safeBuild).toContain('inode-preserving');
    expect(safeBuild).toContain('DISABLE_ESLINT_PLUGIN');
    // Direct react-scripts call avoids recursive npm run build loops.
    expect(safeBuild).toContain('react-scripts build');
    expect(safeBuild).not.toMatch(/(^|\n)\s*npm run build\b/);
  });

});
