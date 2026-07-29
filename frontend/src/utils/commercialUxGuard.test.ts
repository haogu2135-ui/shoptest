import fs from 'fs';
import path from 'path';

const readFrontend = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

const readProductListSurface = () => (
  [
    readFrontend('pages', 'ProductList.tsx'),
    readFrontend('pages', 'productListHelpers.ts'),
    readFrontend('pages', 'productListCard.tsx'),
    readFrontend('pages', 'productListPanels.tsx'),
    readFrontend('pages', 'productListModals.tsx'),
    readFrontend('pages', 'productListShellPanels.tsx'),
    readFrontend('hooks', 'useProductListCatalog.ts'),
    readFrontend('hooks', 'useProductListProductActions.ts'),
    readFrontend('hooks', 'useProductListSessionData.ts'),
    readFrontend('hooks', 'useProductListNavigation.ts'),
    readFrontend('hooks', 'useProductListDerivedCatalog.ts'),
  ].join('\n')
);

const readHomeSurface = () => (
  [
    readFrontend('pages', 'Home.tsx'),
    readFrontend('pages', 'homeHelpers.tsx'),
    readFrontend('pages', 'homeShellStates.tsx'),
    readFrontend('pages', 'homeFirstFoldPanels.tsx'),
    readFrontend('pages', 'homeProductPanels.tsx'),
    readFrontend('hooks', 'useHomeCatalog.ts'),
    readFrontend('hooks', 'useHomeProductActions.ts'),
  ].join('\n')
);

const readCouponCenterSurface = () => (
  [
    readFrontend('pages', 'CouponCenter.tsx'),
    readFrontend('pages', 'couponCenterPageHelpers.ts'),
    readFrontend('pages', 'couponCenterShellStates.tsx'),
    readFrontend('pages', 'couponCenterPanels.tsx'),
  ].join('\n')
);

const readOrderTrackingSurface = () => (
  [
    readFrontend('pages', 'OrderTracking.tsx'),
    readFrontend('pages', 'orderTrackingHelpers.ts'),
    readFrontend('pages', 'orderTrackingPanels.tsx'),
  ].join('\n')
);

const readWishlistSurface = () => (
  [
    readFrontend('pages', 'Wishlist.tsx'),
    readFrontend('pages', 'wishlistHelpers.ts'),
    readFrontend('pages', 'wishlistPanels.tsx'),
  ].join('\n')
);

const readLoginSurface = () => (
  [
    readFrontend('pages', 'Login.tsx'),
    readFrontend('pages', 'loginHelpers.ts'),
    readFrontend('pages', 'loginPanels.tsx'),
  ].join('\n')
);

const readRegisterSurface = () => (
  [
    readFrontend('pages', 'Register.tsx'),
    readFrontend('pages', 'registerHelpers.ts'),
    readFrontend('pages', 'registerPanels.tsx'),
  ].join('\n')
);

const readForgotPasswordSurface = () => (
  [
    readFrontend('pages', 'ForgotPassword.tsx'),
    readFrontend('pages', 'forgotPasswordHelpers.ts'),
    readFrontend('pages', 'forgotPasswordPanels.tsx'),
  ].join('\n')
);

const readNotificationsSurface = () => (
  [
    readFrontend('pages', 'Notifications.tsx'),
    readFrontend('pages', 'notificationsHelpers.ts'),
    readFrontend('pages', 'notificationsPanels.tsx'),
  ].join('\n')
);

const readBrowsingHistorySurface = () => (
  [
    readFrontend('pages', 'BrowsingHistory.tsx'),
    readFrontend('pages', 'browsingHistoryHelpers.ts'),
    readFrontend('pages', 'browsingHistoryPanels.tsx'),
  ].join('\n')
);

const readStockAlertsSurface = () => (
  [
    readFrontend('pages', 'StockAlerts.tsx'),
    readFrontend('pages', 'stockAlertsHelpers.ts'),
    readFrontend('pages', 'stockAlertsPanels.tsx'),
  ].join('\n')
);

const readProductCompareSurface = () => (
  [
    readFrontend('pages', 'ProductCompare.tsx'),
    readFrontend('pages', 'productCompareHelpers.ts'),
    readFrontend('pages', 'productComparePanels.tsx'),
  ].join('\n')
);

const readCartSurface = () => (
  [
    readFrontend('pages', 'Cart.tsx'),
    readFrontend('pages', 'cartHelpers.ts'),
    readFrontend('pages', 'cartShellStates.tsx'),
    readFrontend('pages', 'cartConversionPanels.tsx'),
    readFrontend('pages', 'cartLineItems.tsx'),
    readFrontend('pages', 'cartSavedPanel.tsx'),
    readFrontend('pages', 'cartOverviewPanels.tsx'),
    readFrontend('hooks', 'useCartSessionData.ts'),
    readFrontend('hooks', 'useCartQuantitySync.ts'),
    readFrontend('hooks', 'useCartItemMutations.ts'),
    readFrontend('hooks', 'useCartQuantityActions.ts'),
    readFrontend('hooks', 'useCartRecoveryAdds.ts'),
    readFrontend('hooks', 'useCartCheckoutSubmit.ts'),
  ].join('\n')
);
const readPaymentInstructionsSurface = () => (
  [
    readFrontend('pages', 'PaymentInstructions.tsx'),
    readFrontend('pages', 'paymentInstructionsPanels.tsx'),
    readFrontend('pages', 'paymentInstructionsStickyBars.tsx'),
  ].join('\n')
);
const readCheckoutSurface = () => (
  [
    readFrontend('pages', 'Checkout.tsx'),
    readFrontend('utils', 'checkoutHelpers.ts'),
    readFrontend('hooks', 'useCheckoutDerivedTotals.ts'),
    readFrontend('components', 'checkout', 'CheckoutMainShell.tsx'),
    readFrontend('components', 'checkout', 'CheckoutShellStates.tsx'),
    readFrontend('components', 'checkout', 'CheckoutFormSections.tsx'),
    readFrontend('components', 'checkout', 'CheckoutConversionSections.tsx'),
  ].join('\n')
);
const readProfileSurface = () => (
  [
    readFrontend('pages', 'Profile.tsx'),
    readFrontend('pages', 'profileShellPanels.tsx'),
    readFrontend('pages', 'profileOrdersPanel.tsx'),
    readFrontend('pages', 'profileAddressesPanel.tsx'),
    readFrontend('pages', 'profilePetsPanel.tsx'),
    readFrontend('pages', 'profileOrderDetailModal.tsx'),
    readFrontend('pages', 'profileReturnModals.tsx'),
    readFrontend('pages', 'profilePaymentModal.tsx'),
    readFrontend('pages', 'profileInfoPanel.tsx'),
    readFrontend('pages', 'profileAccountModals.tsx'),
    readFrontend('utils', 'profileHelpers.ts'),
    readFrontend('hooks', 'useProfilePaymentActions.ts'),
    readFrontend('hooks', 'useProfileAddressActions.ts'),
    readFrontend('hooks', 'useProfilePetActions.ts'),
    readFrontend('hooks', 'useProfileAccountActions.ts'),
    readFrontend('hooks', 'useProfileOrderActions.ts'),
    readFrontend('hooks', 'useProfileSessionData.ts'),
    readFrontend('hooks', 'useProfilePaymentReturn.ts'),
  ].join('\n')
);
const readProductDetailSurface = () => (
  [
    readFrontend('pages', 'ProductDetail.tsx'),
    readFrontend('pages', 'productDetailHelpers.tsx'),
    readFrontend('pages', 'productDetailRecommendations.tsx'),
    readFrontend('pages', 'productDetailGallery.tsx'),
    readFrontend('pages', 'productDetailSummary.tsx'),
    readFrontend('pages', 'productDetailBuyBar.tsx'),
    readFrontend('pages', 'productDetailContent.tsx'),
    readFrontend('pages', 'productDetailShell.tsx'),
    readFrontend('hooks', 'useProductDetailNonCriticalContent.ts'),
    readFrontend('hooks', 'useProductDetailRecommendationActions.ts'),
    readFrontend('hooks', 'useProductDetailGallery.ts'),
  ].join('\n')
);

describe('commercial UX contracts', () => {
  it('keeps auth and checkout forms on realtime validation with required marks', () => {
    const register = readRegisterSurface();
    const login = readLoginSurface();
    const checkout = readFrontend('pages', 'Checkout.tsx');

    expect(register).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(register).toContain('requiredMark');
    expect(login).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(login).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(checkout).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(checkout).toContain('requiredMark');

    const forgotPassword = readForgotPasswordSurface();
    expect(forgotPassword).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(forgotPassword).toContain('requiredMark');
  });

  it('keeps product detail deep links for reviews/Q&A anchors', () => {
    const productDetail = readProductDetailSurface();
    expect(productDetail).toContain("id=\"product-reviews-card\"");
    expect(productDetail).toContain("id=\"product-qa-card\"");
    expect(productDetail).toContain("id=\"product-service-tabs\"");
    expect(productDetail).toContain("hash === 'reviews'");
    expect(productDetail).toContain("hash === 'qa'");
  });

  it('keeps storefront discovery infinite scroll screen-reader friendly', () => {
    const home = readHomeSurface();
    expect(home).toContain('home.discoveryShowing');
    expect(home).toContain('home.discoveryLoadMore');
    expect(home).toContain('aria-live="polite"');
    expect(home).toContain('role="list"');
    expect(home).toContain('role="listitem"');
  });

  it('keeps homepage pet gallery samples out of live community proof', () => {
    const home = readHomeSurface();
    const homePetGallery = readFrontend('components', 'HomePetGallery.tsx');
    const homeActions = readFrontend('hooks', 'useHomeProductActions.ts');
    const homeCss = readFrontend('pages', 'Home.css');

    expect(home).toContain('isSample: true');
    expect(home).toContain('likeCount: 0');
    expect(home).toContain('likedByMe: false');
    expect(home).toContain('const petGalleryLiveItemsCount = useMemo(');
    expect(home).toContain('petGalleryItems.filter((item) => !item.isSample).length');
    expect(home).toContain('petGalleryLiveItemsCount: number;');
    expect(home).toContain('value: `${params.petGalleryLiveItemsCount}+`');
    expect(home).toContain("summary: params.t('home.petUgcStoriesSummary', { count: params.petGalleryLiveItemsCount })");
    expect(home).toContain("homeSectionActionLabel(t('home.petUgcTitle'), t('nav.petGallery'), petGalleryLiveItemsCount)");
    expect(homePetGallery).toContain('isSample?: boolean');
    expect(homePetGallery).toContain('pet-ugc__card--sample');
    expect(homePetGallery).toContain('pet-ugc__sampleBadge');
    expect(homePetGallery).toContain('pet-ugc__sampleMeta');
    expect(homePetGallery).toContain("t('pages.petGallery.sampleBadge')");
    expect(homePetGallery).toContain("t('pages.petGallery.sampleSource')");
    expect(homePetGallery).toMatch(/item\.isSample \? \(\s*<span className="pet-ugc__sampleMeta"/);
    expect(homeActions).toContain('if (item.isSample) {');
    expect(homeCss).toContain('.pet-ugc__sampleBadge');
    expect(homeCss).toContain('.pet-ugc__sampleMeta');
  });

  it('keeps cart free-shipping progress and trust signals commercial-ready', () => {
    const cart = readCartSurface();
    expect(cart).toContain('pages.cart.freeShippingProgressLabel');
    expect(cart).toContain('cart-page__trustBar');
    expect(cart).toContain('pages.cart.trustSecureTitle');
    expect(cart).toContain('aria-live="polite"');
  });

  it('keeps navbar cart launcher addressable for mini-cart conversion', () => {
    const navbar = readFrontend('components', 'Navbar.tsx');
    const app = readFrontend('App.tsx');
    expect(navbar).toContain('data-nav-cart');
    expect(navbar).toContain("shop:open-cart");
    expect(navbar).toContain('shop-nav__cart-action');
    expect(app).toContain('requestIdleCallback');
    expect(app).toContain('loadCartDrawer');
    expect(app).toContain('LazyCartDrawerHost');
  });

  it('keeps support launcher on idle-preload parity with mini-cart conversion', () => {
    const app = readFrontend('App.tsx');
    expect(app).toContain('LazySupportWidgetHost');
    expect(app).toContain('loadCustomerSupportWidget');
    expect(app).toContain('requestIdleCallback');
    expect(app).toContain("shop:open-support");
    // Idle preload mounts support chunk so first open is not download-blocked.
    expect(app).toMatch(/LazySupportWidgetHost[\s\S]*?requestIdleCallback[\s\S]*?loadCustomerSupportWidget/);
  });

  it('keeps login rate-limit and lock failures on multipath commercial recovery exits', () => {
    const login = readLoginSurface();
    const loginCss = readFrontend('pages', 'Login.css');
    const en = readFrontend('locales', 'en.json');
    const zh = readFrontend('locales', 'zh.json');
    const es = readFrontend('locales', 'es.json');
    expect(login).toContain('data-login-error-recovery');
    expect(login).toContain('data-login-recovery-actions');
    expect(login).toContain("navigate('/forgot-password')");
    expect(login).toContain("navigate('/track-order')");
    expect(login).toContain("shop:open-support");
    expect(login).toContain("recoveryKind: 'rate_limited'");
    expect(login).toContain("recoveryKind: 'locked'");
    expect(login).toContain("recoveryKind: 'unavailable'");
    expect(login).toContain('pages.auth.loginRecoveryNextRateLimited');
    expect(loginCss).toContain('shopee-login-errorRecovery__actions');
    expect(loginCss).toMatch(/shopee-login-errorRecovery__actions[\s\S]*?min-height:\s*44px/);
    for (const locale of [en, zh, es]) {
      expect(locale).toContain('"loginRecoveryNextRateLimited"');
      expect(locale).toContain('"loginRecoveryNextLocked"');
      expect(locale).toContain('"loginRecoveryNextUnavailable"');
    }
  });

  it('keeps empty cart multi-path CTAs when recently viewed recovery is present', () => {
    const cart = readCartSurface();
    const cartDrawer = readFrontend('components', 'CartDrawer.tsx');
    const cartDrawerCss = readFrontend('components', 'CartDrawer.css');
    expect(cart).toContain('cart-page__emptyActions');
    expect(cart).toContain('data-cart-empty-actions');
    expect(cartDrawer).toContain('data-cart-drawer-empty-actions');
    expect(cartDrawer).toContain('cart-drawer__root--open');
    expect(cartDrawer).toContain('data-cart-drawer-empty');
    expect(cartDrawer).toContain("closeAndGo('/coupons')");
    expect(cartDrawer).toContain("closeAndGo('/pet-finder')");
    expect(cartDrawer).toContain("closeAndGo('/history')");
    expect(cartDrawer).toContain('navigate(path)');
    expect(cartDrawer).toContain('pages.cart.emptyHint');
    expect(cartDrawer).toContain('data-cart-drawer-load-recovery');
    expect(cartDrawerCss).toContain('cart-drawer__emptyActions');
    expect(cartDrawerCss).toMatch(/cart-drawer__emptyActions[\s\S]*?min-height:\s*44px/);
    expect(cart).toContain("navigate('/pet-finder')");
    expect(cart).toContain("navigate('/history')");
    expect(cart).toContain('emptyPetFinderActionLabel');
    expect(cart).toContain('emptyHistoryActionLabel');
    // Hero recovery path (empty cart with recent/saved items) must keep the same conversion rails.
    expect(cart).toContain('emptyPetFinderActionLabel');
    expect(cart).toContain("onClick={() => navigate('/pet-finder')}");
    expect(cart).toContain("onClick={() => navigate('/history')}");
    // Empty panel (cart empty but saved/recent present) must keep multipath exits, not Browse-only.
    expect(cart).toContain('cart-page__emptyPanelActions');
    expect(cart).toContain('data-cart-empty-panel-actions');
    expect(cart).toMatch(/cart-page__emptyPanel[\s\S]*?navigate\('\/coupons'\)[\s\S]*?navigate\('\/pet-finder'\)[\s\S]*?navigate\('\/history'\)/);
  });


  it('keeps product gallery autoplay pausable for keyboard users', () => {
    const productDetail = readProductDetailSurface();
    expect(productDetail).toContain('product-gallery-controls__pause');
    expect(productDetail).toContain('pages.productDetail.galleryPause');
    expect(productDetail).toContain('pages.productDetail.galleryPlay');
    expect(productDetail).toContain('aria-pressed={imagePaused}');
  });

  it('keeps offline connectivity and route focus commercial-ready', () => {
    const app = readFrontend('App.tsx');
    const appCss = readFrontend('App.css');
    expect(app).toContain('ConnectivityBanner');
    expect(app).toContain('RouteFocusManager');
    expect(app).toContain('common.offlineTitle');
    expect(app).toContain('common.onlineRestoredTitle');
    expect(app).toContain('data-connectivity-offline-recovery');
    expect(app).toContain('data-connectivity-online-recovery');
    expect(app).toContain('data-connectivity-banner');
    expect(app).toContain("navigate('/cart')");
    expect(app).toContain("navigate('/history')");
    expect(app).toContain("navigate('/products')");
    expect(app).toContain("getElementById(MAIN_CONTENT_ID)");
    expect(app).toContain('preventScroll: true');
    expect(appCss).toContain('shop-connectivity-banner__actions');
    expect(appCss).toMatch(/shop-connectivity-banner__actions[\s\S]*?min-height:\s*44px/);
  });

  it('keeps coupon catalog fallback on multipath commercial recovery exits', () => {
    const coupons = readCouponCenterSurface();
    const couponsCss = readFrontend('pages', 'CouponCenter.css');
    expect(coupons).toContain('data-coupon-fallback-recovery');
    expect(coupons).toContain('data-coupon-fallback-actions');
    expect(coupons).toContain("navigate('/products')");
    expect(coupons).toContain("navigate('/cart')");
    expect(coupons).toContain("navigate('/pet-finder')");
    expect(couponsCss).toContain('coupon-center-page__fallbackActions');
    expect(couponsCss).toMatch(/coupon-center-page__fallbackActions[\s\S]*?min-height:\s*44px/);
  });

  it('keeps profile empty orders on multi-path conversion CTAs', () => {
    const profile = readProfileSurface();
    expect(profile).toContain('pages.profile.noOrdersHint');
    expect(profile).toContain('pages.profile.emptyOrdersCoupons');
    expect(profile).toContain('pages.profile.emptyOrdersPetFinder');
    expect(profile).toContain('data-profile-orders-empty-actions');
    expect(profile).toContain("navigate('/coupons')");
    expect(profile).toContain("navigate('/pet-finder')");
    expect(profile).toContain("navigate('/track-order')");
    // Filtered order list empty must multipath (clear filter · browse · coupons · track), not bare Empty.
    expect(profile).toContain('data-profile-orders-filter-empty');
    expect(profile).toContain('pages.profile.noFilterOrders');
    expect(profile).toContain('pages.profile.noFilterOrdersHint');
    expect(profile).toContain('pages.profile.clearOrderFilter');
    expect(profile).toContain("setOrderStatusFilter('all')");
    expect(profile).toContain("navigate('/track-order')");
  });

  it('keeps profile empty addresses and payment-return banners on multipath commercial recovery exits', () => {
    const profile = readProfileSurface();
    expect(profile).toContain('data-profile-addresses-empty-actions');
    expect(profile).toContain('pages.profile.noAddresses');
    expect(profile).toContain('pages.profile.addressReadinessEmpty');
    expect(profile).toContain('pages.profile.addAddress');
    expect(profile).toContain("navigate('/products')");
    expect(profile).toContain("navigate('/coupons')");
    expect(profile).toContain("navigate('/track-order')");
    expect(profile).toContain('data-profile-payment-return-recovery');
    expect(profile).toContain("data-profile-payment-return={");
    expect(profile).toContain('pages.orderTracking.shopAgain');
    expect(profile).toContain('shop:open-support');
  });

  it('keeps profile payment modal recovery guidance for failed and expired payments', () => {
    const profile = readProfileSurface();
    expect(profile).toContain('selectedPaymentFailed');
    expect(profile).toContain('selectedPaymentExpiredOrFailed');
    expect(profile).toContain('pages.checkout.paymentRecoveryFailed');
    expect(profile).toContain('pages.checkout.paymentRecoveryNextFailed');
    expect(profile).toContain('!selectedPaymentExpiredOrFailed');
  });

  it('keeps payment instructions sticky CTA and trust strip for mobile conversion', () => {
    const payment = readPaymentInstructionsSurface();
    const paymentCss = readFrontend('pages', 'PaymentInstructions.css');
    expect(payment).toContain('payment-instructions-page__stickyBar');
    expect(payment).toContain('payment-instructions-page__trustBar');
    expect(payment).toContain('pages.paymentInstructions.stickyOpenPayment');
    expect(payment).toContain('pages.paymentInstructions.trustSecureTitle');
    expect(payment).toContain('payment-instructions-page__stickyBar--paid');
    expect(payment).toContain('payment-instructions-page__stickyBar--recovery');
    expect(payment).toContain('data-payment-recovery-sticky');
    expect(payment).toContain('data-payment-recovery-actions');
    expect(payment).toContain('data-payment-paid-sticky');
    expect(payment).toContain('data-payment-paid-actions');
    expect(payment).toContain("navigate('/coupons')");
    expect(payment).toContain("navigate('/profile?tab=orders')");
    expect(payment).toContain('pages.paymentInstructions.stickyTrackOrder');
    expect(payment).toContain('pages.paymentInstructions.stickyContinueShopping');
    expect(payment).toContain('pages.paymentInstructions.stickyRecovery');
    expect(payment).toContain('pages.paymentInstructions.failedTitle');
    expect(payment).toContain('pages.paymentInstructions.failedText');
    expect(payment).toContain('isFailed');
    expect(payment).toContain('isExpiredOrFailed');
    expect(payment).toContain("navigate('/products')");
    expect(payment).toContain('pages.paymentInstructions.paidTitle');
    expect(payment).toContain('pages.paymentInstructions.paidText');
    expect(payment).toContain('openContinueShopping');
    expect(paymentCss).toContain('payment-instructions-page__stickyActions');
    expect(paymentCss).toContain('stickyBar--paid');
    expect(paymentCss).toContain('stickyBar--recovery');
    expect(paymentCss).toMatch(/payment-instructions-page__stickyActions[\s\S]*?min-height:\s*44px/);
    expect(payment).toContain('payment-instructions-page__guestEmailGate');
    expect(payment).toContain('applyGuestEmailForVerify');
    expect(payment).toContain('pages.paymentInstructions.guestEmailRequiredTitle');
    expect(paymentCss).toContain('payment-instructions-page__guestEmailGate');
    expect(paymentCss).toMatch(/payment-instructions-page__guestEmailForm[\s\S]*?min-height:\s*44px/);
  });

  it('keeps checkout and auth forms focusing the first validation error after failed submit', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const checkoutDom = readFrontend('utils', 'checkoutDom.ts');
    const login = readLoginSurface();
    const forgotPassword = readForgotPasswordSurface();
    const focusUtil = readFrontend('utils', 'formValidationFocus.ts');

    expect(focusUtil).toContain('export const focusFirstFormError');
    expect(focusUtil).toContain('ant-form-item-has-error');
    expect(checkout).toContain('focusFirstCheckoutValidationError');
    expect(checkoutDom).toContain('export const focusFirstCheckoutValidationError');
    expect(checkoutDom).toContain("focusFirstFormError({");
    expect(readCheckoutSurface()).toContain("id=\"checkout-contact-card\"");
    expect(login).toContain('scrollFirstLoginErrorIntoView');
    expect(login).toContain('onFinishFailed');
    expect(forgotPassword).toContain('scrollFirstForgotPasswordErrorIntoView');
    expect(forgotPassword).toContain('data-forgot-password-unavailable');
    expect(forgotPassword).toContain('pages.auth.resetUnavailableTitle');
    expect(forgotPassword).toContain("navigate('/track-order')");
    expect(forgotPassword).toContain('onFinishFailed');
  });

  it('keeps wishlist empty state on multi-path commercial conversion CTAs', () => {
    const wishlist = readWishlistSurface();
    expect(wishlist).toContain('pages.wishlist.emptyHint');
    expect(wishlist).toContain('pages.wishlist.emptyCoupons');
    expect(wishlist).toContain('pages.wishlist.emptyPetFinder');
    expect(wishlist).toContain("navigate('/coupons')");
    expect(wishlist).toContain("navigate('/pet-finder')");
  });

  it('keeps terminal API failures visible through a localized global banner', () => {
    const app = readFrontend('App.tsx');
    const core = readFrontend('api', 'core.ts');
    expect(app).toContain('ApiErrorBanner');
    expect(app).toContain("shop:api-error");
    expect(app).toContain('common.apiErrorRateLimitedTitle');
    expect(core).toContain('getApiErrorMessage');
    expect(core).toContain('resolveApiErrorLanguage');
    expect(core).toContain("dispatchDomEvent('shop:api-error'");
  });

  it('keeps compare and order-tracking empty states on multi-path commercial CTAs', () => {
    const compare = readProductCompareSurface();
    const tracking = readOrderTrackingSurface();

    expect(compare).toContain('pages.compare.emptyHint');
    expect(compare).toContain('data-compare-empty-actions');
    expect(compare).toContain("navigate('/pet-finder')");
    expect(compare).toContain('data-compare-stale-recovery');
    expect(compare).toContain('data-compare-stale-actions');
    expect(compare).toContain("navigate('/wishlist')");
    expect(compare).toContain("navigate('/coupons')");
    expect(tracking).toContain('pages.orderTracking.emptyHint');
    expect(tracking).toContain('data-order-tracking-payment-return-recovery');
    expect(tracking).toContain('data-order-tracking-payment-return');
    expect(tracking).toContain("paymentReturnStatus === 'failed'");
    expect(tracking).toContain('pages.orderTracking.paymentFailedTitle');

    expect(tracking).toContain("navigate('/coupons')");
    expect(tracking).toContain('paymentReturnEmailRequiredTitle');
    expect(tracking).toContain('data-order-tracking-payment-return-email-gate');
    expect(tracking).toContain("navigate('/profile?tab=orders')");
  });


  it('keeps order tracking empty line-items on multipath commercial recovery exits', () => {
    const tracking = readOrderTrackingSurface();
    expect(tracking).toContain('data-order-tracking-items-empty');
    expect(tracking).toContain('data-order-tracking-items-empty-actions');
    expect(tracking).toContain('pages.orderTracking.noOrderItemsHint');
    expect(tracking).toContain("navigate('/products')");
    expect(tracking).toContain("navigate('/coupons')");
    expect(tracking).toContain('shop:open-support');
  });


  it('keeps product detail recommendation load/empty states on multipath commercial recovery exits', () => {
    const productDetail = readProductDetailSurface();
    expect(productDetail).toContain('data-product-detail-recommendations-loading');
    expect(productDetail).toContain('data-product-detail-recommendations-empty');
    expect(productDetail).toContain('recommendationsLoading');
    expect(productDetail).toContain('recommendationsLoadFailed');
    expect(productDetail).toContain('pages.productDetail.recommendationsLoadFailed');
    expect(productDetail).toContain("navigate('/pet-finder')");
  });

  it('keeps commerce thumbnails on accessible image semantics', () => {
    const productList = readProductListSurface();
    const productDetail = readProductDetailSurface();
    expect(productList).toMatch(/className="product-list__checkoutPathItem"[\s\S]*?aria-label=\{`\$\{t\('pages\.productList\.viewPick'\)\}: \$\{productName\}`\}/);
    expect(productList).toMatch(/className="product-list__checkoutPathThumb"[\s\S]*?alt=""/);
    expect(productList).not.toMatch(/className="product-list__checkoutPathThumb"[\s\S]{0,180}?alt=\{productName\}/);
    expect(productDetail).toMatch(/alt=""[\s\S]*?aria-hidden="true"[\s\S]*?role="presentation"[\s\S]*?className="product-detail-thumbs__img"/);
    expect(productDetail).toMatch(/alt=\{getGalleryImageLabel\(index\)\}[\s\S]*?className="product-mobile-thumbs__img"/);
  });

  it('keeps product detail complete-set and recommendation CTAs on commercial 44px touch floor', () => {
    const css = readFrontend('pages', 'ProductDetail.css');
    expect(css).toMatch(/\.product-complete-set__item \.ant-btn[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.product-recommendations__content \.ant-btn[\s\S]*?min-height:\s*44px/);
    expect(css).not.toContain('grid-template-columns: 46px minmax(0, 1fr) 40px');
    expect(css).not.toContain('min-width: 40px;\n    padding-inline: 0;');
  });

  it('keeps product detail mobile price signals visible without horizontal clipping', () => {
    const css = readFrontend('pages', 'ProductDetail.css');
    expect(css).toContain('Final mobile detail price-signal guard');
    expect(css).toMatch(/\.product-price-panel \.product-compact-signals\s*\{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?overflow-x:\s*visible;[\s\S]*?scroll-snap-type:\s*none;/);
    expect(css).toMatch(/\.product-price-panel \.product-compact-signals > span\s*\{[\s\S]*?flex:\s*1 1 min\(100%, 132px\);[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(css).not.toMatch(/\.product-price-panel \.product-compact-signals\s*\{[\s\S]{0,220}?flex-wrap:\s*nowrap/);
  });

  it('keeps support order-select empty on multipath commercial recovery exits', () => {
    const support = readFrontend('components', 'CustomerSupportWidget.tsx');
    expect(support).toContain('data-support-order-select-empty');
    expect(support).toContain('data-support-order-select-empty-actions');
    expect(support).toContain('data-support-order-items-empty');
    expect(support).toContain('pages.support.noOrderItemsHint');
    expect(support).toContain("navigate('/track-order')");
    expect(support).toContain("navigate('/coupons')");
  });


  it('keeps notification filter empties on multipath commercial recovery exits', () => {
    const notifications = readNotificationsSurface();
    expect(notifications).toContain('data-notifications-filter-empty');
    expect(notifications).toContain('data-notifications-filter-empty-actions');
    expect(notifications).toContain('pages.notifications.noFilterResultsHint');
    expect(notifications).toContain("setQuickFilter('ALL')");
    expect(notifications).toContain("navigate('/coupons')");
    expect(notifications).toContain("navigate('/track-order')");
  });

  it('keeps coupon wallet filter empties on multipath commercial recovery exits', () => {
    const coupons = readCouponCenterSurface();
    expect(coupons).toContain('data-coupon-wallet-filter-empty');
    expect(coupons).toContain('data-coupon-wallet-filter-empty-actions');
    expect(coupons).toContain('pages.coupons.walletFilteredEmptyHint');
    expect(coupons).toContain("setWalletFilter('all')");
    expect(coupons).toContain("navigate('/cart')");
    expect(coupons).toContain("navigate('/pet-finder')");
  });

  it('keeps profile payment-history empty on multipath commercial recovery exits', () => {
    const profile = readProfileSurface();
    expect(profile).toContain('data-profile-payment-history-empty');
    expect(profile).toContain('data-profile-payment-history-empty-actions');
    expect(profile).toContain('pages.profile.noPaymentHistoryHint');
    expect(profile).toContain("navigate('/track-order')");
    expect(profile).toContain("navigate('/coupons')");
    expect(profile).toContain('shop:open-support');
  });

  it('keeps recovery empty states on multi-path commercial CTAs', () => {
    const stock = readStockAlertsSurface();
    const notifications = readNotificationsSurface();
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    const petGallery = readFrontend('pages', 'PetGallery.tsx');

    expect(stock).toContain('pages.stockAlerts.emptyHint');
    expect(stock).toContain("navigate('/wishlist')");
    expect(stock).toContain('data-stock-alerts-empty-actions');
    expect(stock).toContain('pages.stockAlerts.emptyCoupons');
    expect(stock).toContain("navigate('/coupons')");
    expect(notifications).toContain('pages.notifications.emptyTrackOrder');
    expect(notifications).toContain("navigate('/track-order')");
    expect(petFinder).toContain('pages.petFinder.emptyHint');
    expect(petFinder).toContain('data-pet-finder-empty-actions');
    expect(petFinder).toContain("navigate('/pet-gallery')");
    expect(petGallery).toContain('pages.petGallery.emptyHint');
    expect(petGallery).toContain("navigate('/pet-finder')");
  });

  it('keeps support empty welcome rail on multipath commercial conversion exits', () => {
    const support = readFrontend('components', 'CustomerSupportWidget.tsx');
    expect(support).toContain('data-support-empty-actions');
    expect(support).toContain('data-support-empty-multipath');
    expect(support).toContain("navigate('/track-order')");
    expect(support).toContain("navigate('/products')");
    expect(support).toContain("navigate('/coupons')");
  });

  it('keeps logistics tracking and coupon wallet empties on multipath commercial recovery exits', () => {
    const seventeen = readFrontend('components', 'SeventeenTrackWidget.tsx');
    const coupons = readCouponCenterSurface();
    expect(seventeen).toContain('data-seventeen-track-recovery');
    expect(seventeen).toContain("navigate('/products')");
    expect(seventeen).toContain("navigate('/coupons')");
    expect(seventeen).toContain('pages.orderTracking.shopAgain');
    expect(seventeen).toContain('pages.orderTracking.emptyCoupons');
    expect(coupons).toContain('data-coupon-wallet-empty-actions');
    expect(coupons).toContain('pages.coupons.emptyWalletHint');
    expect(coupons).toContain("navigate('/cart')");
    expect(coupons).toContain("navigate('/pet-finder')");
  });

  it('keeps product-not-found, 404, profile pets, and cart saved-empty on multi-path recovery CTAs', () => {
    const productDetail = readProductDetailSurface();
    const notFound = readFrontend('pages', 'NotFound.tsx');
    const profile = readProfileSurface();
    const cart = readCartSurface();

    expect(productDetail).toContain('pages.productDetail.notFoundHint');
    expect(productDetail).toContain("navigate('/wishlist')");
    expect(productDetail).toContain("navigate('/pet-finder')");
    expect(productDetail).toContain('data-product-not-found-actions');
    expect(notFound).toContain('notFound.hint');
    expect(notFound).toContain("navigate('/coupons')");
    expect(notFound).toContain("navigate('/track-order')");
    expect(profile).toContain('pages.profile.noPetsHint');
    expect(profile).toContain("navigate('/pet-finder')");
    expect(cart).toContain('pages.cart.saveForLaterEmptyHint');
    expect(cart).toContain("navigate('/wishlist')");
  });


  it('keeps route ErrorBoundary on multi-path commercial recovery CTAs', () => {
    const errorBoundary = readFrontend('components', 'ErrorBoundary.tsx');
    expect(errorBoundary).toContain('data-error-boundary-recovery');
    expect(errorBoundary).toContain("navigate('/products'");
    expect(errorBoundary).toContain("navigate('/coupons'");
    expect(errorBoundary).toContain("navigate('/track-order'");
    expect(errorBoundary).toContain("shop:open-support");
    expect(errorBoundary).toContain('handleBrowseCoupons');
    expect(errorBoundary).toContain('handleTrackOrder');
  });


  it('keeps checkout mobile pay rail on trust microcopy and coupon wallet multi-path recovery', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const checkoutCss = readFrontend('pages', 'Checkout.css');
    const coupons = readCouponCenterSurface();
    const register = readRegisterSurface();

    const checkoutSurface = readCheckoutSurface();
    expect(checkoutSurface).toContain('checkout-page__mobilePayBar');
    expect(checkoutSurface).toContain('role="region"');
    expect(checkoutSurface).toContain('pages.checkout.mobilePayBarTrust');
    expect(checkoutSurface).toContain('data-checkout-payment-unavailable-recovery');
    expect(checkoutSurface).toContain('data-checkout-payment-unavailable');
    expect(checkout).toContain('paymentUnavailableRecoveryActions');
    expect(checkoutSurface).toContain('pages.checkout.paymentUnavailable');
    expect(checkout).toContain("navigate('/products')");
    expect(checkout).toContain("navigate('/coupons')");
    expect(checkout).toContain("navigate('/cart')");
    expect(checkout).toContain("navigate('/cart')");
    expect(checkoutCss).toContain('paymentUnavailableActions');
    expect(checkoutCss).toMatch(/paymentUnavailableActions[\s\S]*?min-height:\s*44px/);
    expect(checkoutCss).not.toContain('overflow-x: clip');
    expect(checkoutCss).toMatch(/Final checkout mobile closure:[\s\S]*?\.checkout-page\s*\{[\s\S]*?overflow-x:\s*hidden;/);
    expect(coupons).toContain('pages.coupons.emptyWalletHint');
    expect(coupons).toContain('pages.coupons.loginToClaim');
    expect(coupons).toContain("navigate('/cart')");
    expect(coupons).toContain("navigate('/pet-finder')");
    expect(register).toContain('focusFirstFormError');
    expect(register).toContain("rootSelector: '.register-page__card'");
  });


  it('keeps admin table and cart mobile quantity controls on commercial touch targets', () => {
    const adminTable = readFrontend('styles', 'admin-table-selection.css');
    const adminLayout = readFrontend('components', 'AdminLayout.css');
    const cart = readFrontend('pages', 'Cart.css');
    const login = readFrontend('pages', 'Login.css');

    expect(adminTable).toContain('Commercial admin table action touch targets');
    expect(adminTable).toContain('min-height: 44px !important');
    expect(adminLayout).toContain('min-height: 44px');
    expect(cart).toContain('.cart-page__mobileItemBottom .cart-page__quantityStepper .ant-btn');
    expect(cart).toMatch(/\.cart-page__mobileItemBottom \.cart-page__quantityStepper \.ant-btn[\s\S]*?min-height:\s*48px/);
    expect(cart).toMatch(/\.cart-page__mobileItemCommerce \.cart-page__quantityStepper:not\(\.cart-page__quantityStepper--unavailable\)[\s\S]*?grid-template-columns:\s*48px minmax\(48px, 56px\) 48px/);
    expect(login).toContain('Commercial login mobile touch targets');
    expect(login).toContain('min-height: 44px !important');
  });


  it('keeps support widget load failures on multipath commercial recovery exits', () => {
    const support = readFrontend('components', 'CustomerSupportWidget.tsx');
    const supportCss = readFrontend('components', 'CustomerSupportWidget.css');
    expect(support).toContain('data-support-recovery-actions');
    expect(support).toContain('data-support-session-recovery');
    expect(support).toContain('data-support-orders-recovery');
    expect(support).toContain("navigate('/track-order')");
    expect(support).toContain("navigate('/products')");
    expect(support).toContain("navigate('/coupons')");
    expect(supportCss).toContain('customer-support-widget__recoveryActions');
    expect(supportCss).toMatch(/customer-support-widget__recoveryActions[\s\S]*?min-height:\s*44px/);
  });

  it('keeps auth, profile, and support surfaces on commercial mobile touch targets with readable text', () => {
    const login = readFrontend('pages', 'Login.css');
    const register = readFrontend('pages', 'Register.css');
    const profile = readFrontend('pages', 'Profile.css');
    const support = readFrontend('components', 'CustomerSupportWidget.css');
    const antdTheme = readFrontend('styles', 'antd-theme-overrides.css');

    expect(login).toMatch(/\.shopee-login-form :where\(\.ant-input, \.ant-input-affix-wrapper input, \.ant-input-group-addon \.ant-btn\)\s*\{[\s\S]*?font-size:\s*16px\s*!important/);
    expect(register).toContain('Commercial register mobile touch targets');
    expect(register).toContain('min-height: 44px !important');
    expect(register).toMatch(/\.register-page__card :where\(input, textarea, \.ant-input, \.ant-input-affix-wrapper input\)\s*\{[\s\S]*?font-size:\s*16px\s*!important/);
    expect(profile).toMatch(/\.profile-mobile-safe-modal :where\(input, textarea, \.ant-input, \.ant-input-affix-wrapper input, \.ant-input-number-input\)\s*\{[\s\S]*?font-size:\s*16px\s*!important/);
    expect(support).toContain('Commercial support mobile touch targets');
    expect(support).toContain('customer-support-widget__headerClose.ant-btn');
    expect(support).toContain('min-height: 44px !important');
    // Secondary AntD text contrast ships with deferred theme overrides (not shell App.css).
    expect(antdTheme).toContain('Commercial secondary text contrast');
    expect(antdTheme).toContain('rgba(16, 47, 34, 0.72)');
  });


  it('keeps storefront accent text on commercial contrast colors', () => {
    const login = readFrontend('pages', 'Login.css');
    const register = readFrontend('pages', 'Register.css');
    const coupon = readFrontend('pages', 'CouponCenter.css');
    const home = readFrontend('pages', 'Home.css');
    const navbar = readFrontend('components', 'Navbar.css');
    const productDetail = readFrontend('pages', 'ProductDetail.css');

    expect(login).toMatch(/--login-accent:\s*#c73719/);
    expect(login).toMatch(/--login-accent-hot:\s*#cf4220/);
    expect(register).toMatch(/\.register-page__footer a\s*\{[\s\S]*?color:\s*#c73719/);
    expect(register).toMatch(/\.register-page__actions \.ant-btn-primary,\s*\.register-page__card \.ant-btn-primary\s*\{[\s\S]*?background:\s*#c73719\s*!important[\s\S]*?border-color:\s*#c73719\s*!important/);
    expect(coupon).toMatch(/\.coupon-center-page__couponValue\s*\{[\s\S]*?color:\s*#c73719/);
    expect(coupon).toMatch(/\.coupon-center-page__couponValue\s*\{[\s\S]*?background:\s*#fff7f1;[\s\S]*?color:\s*#c73719\s*!important/);
    expect(coupon).not.toMatch(/\.coupon-center-page__couponValue[\s\S]{0,220}?color:\s*#ee4d2d/);
    expect(home).toMatch(/\.shopee-product__stockBadge--ok\s*\{[\s\S]*?color:\s*#237804/);
    expect(navbar).toMatch(/\.shop-nav__megaButton--active\s*\{[\s\S]*?background:\s*#fff2ee;[\s\S]*?color:\s*#c73719\s*!important/);
    expect(productDetail).toContain('.product-price-line :where(.commerce-money, .commerce-money *)');
    expect(productDetail).toMatch(/\.product-price-line,\s*\.product-price-line__current,\s*\.product-price-line :where\(\.commerce-money, \.commerce-money \*\),[\s\S]*?color:\s*#8f2d17\s*!important/);
  });


  it('keeps auth password fields on accessible visibility toggles', () => {
    const login = readLoginSurface();
    const register = readRegisterSurface();
    const forgot = readForgotPasswordSurface();

    expect(login).toContain('iconRender={(visible) => (');
    expect(login).toContain('aria-pressed={visible}');
    expect(login).toContain("pages.auth.showPassword");
    expect(register).toContain('iconRender={(visible) => (');
    expect(register).toContain('aria-pressed={visible}');
    expect(forgot).toContain('iconRender={(visible) => (');
    expect(forgot).toContain('aria-pressed={visible}');
  });


  it('keeps order tracking lookup on commercial validation and 44px touch targets', () => {
    const tracking = readOrderTrackingSurface();
    const trackingCss = readFrontend('pages', 'OrderTracking.css');

    expect(tracking).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(tracking).toContain('requiredMark');
    expect(tracking).toContain('focusFirstFormError');
    expect(tracking).toContain("rootSelector: '.order-tracking-page__lookupCard'");
    expect(tracking).toContain('onFinishFailed');
    expect(tracking).toContain('autoComplete="on"');
    expect(tracking).toContain('enterKeyHint="search"');
    expect(tracking).not.toContain('autoComplete="off" inputMode="text" maxLength={80}');
    expect(trackingCss).toContain('Commercial order-tracking mobile touch targets');
    expect(trackingCss).toMatch(/\.order-tracking-page \.ant-btn[\s\S]*?min-height:\s*44px/);
    expect(trackingCss).toMatch(
      /Commercial order-tracking mobile touch targets[\s\S]*?\.order-tracking-page :where\(input, textarea, \.ant-input, \.ant-input-affix-wrapper input\),[\s\S]*?\.order-tracking-page__returnModal :where\(input, textarea, \.ant-input, \.ant-input-affix-wrapper input\)\s*\{[\s\S]*?font-size:\s*16px\s*!important/
    );
    expect(trackingCss).toContain('paymentReturnActions');
    expect(trackingCss).toMatch(/paymentReturnActions[\s\S]*?min-height:\s*44px/);
    expect(tracking).toContain('data-order-tracking-payment-return-recovery');
  });


  it('keeps profile account forms on commercial validation focus and password a11y', () => {
    const profile = readProfileSurface();
    const profileCss = readFrontend('pages', 'Profile.css');

    expect(profile).toContain('focusProfileModalFormError');
    expect(readFrontend('utils', 'profileHelpers.ts')).toContain('focusFirstFormError');
    expect(profile).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(profile).toContain('requiredMark');
    expect(profile).toContain('aria-pressed={visible}');
    expect(profile).toContain("pages.auth.showPassword");
    expect(profileCss).toContain('Commercial profile order action touch targets');
    expect(profileCss).toContain('Commercial profile modal mobile touch targets');
    expect(profileCss).toMatch(/profile-order-card__actions \.ant-btn[\s\S]*?min-height:\s*44px/);
  });


  it('keeps checkout order agreement notice and public legal pages', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const legal = readFrontend('pages', 'LegalPage.tsx');
    const legalCss = readFrontend('pages', 'LegalPage.css');
    const app = readFrontend('App.tsx');

    expect(readCheckoutSurface()).toContain('checkout-page__legalNotice');
    expect(readCheckoutSurface()).toContain('pages.checkout.orderAgreementPrefix');
    expect(readCheckoutSurface()).toContain("to=\"/terms\"");
    expect(readCheckoutSurface()).toContain("to=\"/privacy\"");
    expect(legal).toContain('legal-page');
    expect(legalCss).toContain('Commercial legal page mobile touch targets');
    expect(app).toContain('path="privacy"');
    expect(app).toContain('path="terms"');
    expect(app).toContain("to=\"/privacy\"");
    expect(app).toContain("to=\"/terms\"");
  });


  it('keeps commercial cookie consent and register legal agreement rails', () => {
    const banner = readFrontend('components', 'CookieConsentBanner.tsx');
    const bannerCss = readFrontend('components', 'CookieConsentBanner.css');
    const consent = readFrontend('utils', 'cookieConsent.ts');
    const register = readRegisterSurface();
    const login = readLoginSurface();
    const loginCss = readFrontend('pages', 'Login.css');
    const app = readFrontend('App.tsx');

    expect(consent).toContain('COOKIE_CONSENT_STORAGE_KEY');
    expect(consent).toContain('acceptCookieConsent');
    expect(banner).toContain('cookie-consent-banner');
    expect(banner).toContain('cookieConsent.acceptAll');
    expect(banner).toContain('cookieConsent.acceptEssential');
    expect(banner).toContain("to=\"/privacy\"");
    expect(banner).toContain('cookie-consent-banner__legal');
    expect(banner).toContain('createPortal(banner, document.body)');
    expect(bannerCss).toContain('Commercial cookie consent mobile touch targets');
    expect(bannerCss).toMatch(/\.cookie-consent-banner__link\s*\{[^}]*min-height:\s*44px/);
    expect(bannerCss).toMatch(/@media \(max-width: 780px\)[\s\S]*?\.cookie-consent-banner__link\s*\{[^}]*min-height:\s*44px/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__link\s*\{[^}]*min-height:\s*44px/);
    expect(bannerCss).not.toMatch(/\.cookie-consent-banner__link\s*\{[^}]*min-height:\s*(?:3[0-9]|40)px/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__eyebrow\s*\{[^}]*font-size:\s*12px/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__text\s*\{[^}]*font-size:\s*12px/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__link\s*\{[^}]*font-size:\s*12px/);
    expect(bannerCss).not.toMatch(/\.cookie-consent-banner__[\w-]+\s*\{[^}]*font-size:\s*(?:10(?:\.5)?|11(?:\.5)?)px/);
    expect(bannerCss).toContain('--shop-z-cookie-consent');
    expect(banner).toContain('shop-cookie-consent-visible');
    expect(banner).toContain('--shop-cookie-consent-clearance');
    expect(banner).toContain('data-cookie-consent-visible');
    expect(bannerCss).toContain('shop-cookie-consent-visible');
    expect(bannerCss).toContain('--shop-cookie-consent-clearance');
    expect(bannerCss).toContain('product-mobile-buybar');
    expect(bannerCss).toContain('cart-page__summary');
    expect(bannerCss).toContain('cart-drawer__footer');
    expect(bannerCss).toContain('checkout-page__submitReview');
    expect(bannerCss).toContain('PDP and history pages add high-specificity sticky rails later');
    expect(bannerCss).toContain('body.shop-cookie-consent-visible:not(.shop-mobile-app) .product-detail-page .product-summary-card .product-mobile-buybar');
    expect(bannerCss).toContain('body.shop-cookie-consent-visible.shop-mobile-app.shop-mobile-app.shop-mobile-app .shop-app-shell--product-detail .product-detail-page .product-summary-card .product-mobile-buybar');
    expect(bannerCss).toContain('body.shop-cookie-consent-visible .browsing-history__mobileAction');
    expect(bannerCss).toMatch(/body\.shop-cookie-consent-visible:not\(\.shop-mobile-app\) \.product-detail-page \.product-summary-card \.product-mobile-buybar,[\s\S]*?body\.shop-cookie-consent-visible \.browsing-history__mobileAction\s*\{[\s\S]*?bottom:\s*var\(--shop-cookie-consent-clearance, 200px\)\s*!important/);
    expect(bannerCss).toMatch(/@media \(max-width: 780px\)[\s\S]*?\.cookie-consent-banner[\s\S]*?bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height, 72px\) \+ 10px/);
    expect(bannerCss).not.toContain('body.shop-cookie-consent-visible .shop-nav__bottomBar');
    expect(bannerCss).toContain('customer-support-widget__button');
    expect(bannerCss).toContain('customer-support-widget__panel');
    expect(bannerCss).toContain('product-list__mobileConversionBar');
    expect(bannerCss).toContain('product-list__backToTop');

    expect(bannerCss).toMatch(/\.cookie-consent-banner__button\.ant-btn\s*\{[\s\S]*?min-height:\s*44px/);
    expect(bannerCss).toMatch(/\.cookie-consent-banner__button\.ant-btn\s*\{[\s\S]*?min-height:\s*44px/);
    expect(bannerCss).toMatch(/@media \(max-width: 780px\)[\s\S]*?\.cookie-consent-banner__link\s*\{[\s\S]*?min-height:\s*44px/);
    expect(bannerCss).toMatch(/@media \(max-width: 780px\)[\s\S]*?\.cookie-consent-banner__legal\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(bannerCss).not.toMatch(/\.cookie-consent-banner__button\.ant-btn,\s*\.cookie-consent-banner__link\s*\{[\s\S]*?min-height:\s*44px/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__legal[\s\S]*?display:\s*flex/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__button\.ant-btn[\s\S]*?min-height:\s*44px/);
    expect(bannerCss).toMatch(/@media \(max-width: 390px\) and \(max-height: 620px\)[\s\S]*?-webkit-line-clamp:\s*1/);
    expect(bannerCss).toContain('wishlist-page__emptyPanel');
    expect(bannerCss).toContain('notifications-page__emptyPanel');
    expect(bannerCss).toContain('product-list--empty');
    expect(readFrontend('components', 'PageFeedback.css')).toMatch(/shop-cookie-consent-visible \.product-list--empty \.page-feedback__actions[\s\S]*?flex-wrap:\s*nowrap/);
    expect(register).toContain('register-page__legalNotice');
    expect(register).toContain('pages.auth.registerAgreementPrefix');
    expect(login).toContain('shopee-login-legalNotice');
    expect(login).toContain('pages.auth.loginAgreementPrefix');
    expect(login).toContain("to=\"/terms\"");
    expect(login).toContain("to=\"/privacy\"");
    expect(loginCss).toContain('Commercial login legal agreement notice');
    expect(loginCss).toMatch(/\.shopee-login-legalNotice a[\s\S]*?min-height:\s*44px/);
    expect(app).toContain('CookieConsentBanner');
  });


  it('keeps product-detail shell free of global bottom nav so sticky buybar owns the rail', () => {
    const navCss = readFrontend('components', 'Navbar.css');
    const nav = readFrontend('components', 'Navbar.tsx');
    const app = readFrontend('App.tsx');
    expect(app).toContain("shop-app-shell--product-detail");
    expect(nav).toContain('mobileTaskBottomBarHidden');
    expect(nav).toContain('shop-nav__bottomBar--mobile-task-hidden');
    expect(navCss).toMatch(/\.shop-app-shell--product-detail \.shop-nav__bottomBar[\s\S]*?display:\s*none/);
    expect(navCss).toMatch(/\.shop-nav__bottomBar--mobile-task-hidden[\s\S]*?display:\s*none/);
    expect(navCss).toMatch(/\.shop-nav__bottomBar\.shop-nav__bottomBar--mobile-task-hidden[\s\S]*?display:\s*none\s*!important/);
    expect(navCss).toMatch(/\.shop-nav__bottomBar\.shop-nav__bottomBar--mobile-task-hidden[\s\S]*?visibility:\s*hidden\s*!important/);
  });


  it('keeps guest wishlist multi-path auth gate conversion rails', () => {
    const wishlist = readWishlistSurface();
    const wishlistCss = readFrontend('pages', 'Wishlist.css');
    const app = readFrontend('App.tsx');
    expect(app).toContain('<Route path="wishlist" element={<Wishlist />} />');
    expect(wishlist).toContain('wishlist-page__authGate');
    expect(wishlist).toContain('pages.wishlist.authGateTitle');
    expect(wishlist).toContain("buildLoginUrl('/wishlist')");
    expect(wishlistCss).toContain('Commercial guest wishlist auth gate multi-path conversion');
    expect(wishlistCss).toMatch(/\.wishlist-page__authGate \.page-feedback__actions \.ant-btn[\s\S]*?min-height:\s*44px/);
  });


  it('keeps guest notifications multi-path auth gate conversion rails', () => {
    const notifications = readNotificationsSurface();
    const notificationsCss = readFrontend('pages', 'Notifications.css');
    const register = readRegisterSurface();
    const app = readFrontend('App.tsx');
    expect(app).toContain('<Route path="notifications" element={<Notifications />} />');
    expect(notifications).toContain('notifications-page__authGate');
    expect(notifications).toContain('pages.notifications.authGateTitle');
    expect(notifications).toContain("buildLoginUrl('/notifications')");
    expect(notificationsCss).toContain('Commercial guest notifications auth gate multi-path conversion');
    expect(register).toContain('getPostLoginRedirectTarget');
    expect(register).toContain('buildLoginUrl(postRegisterRedirect)');
  });


  it('keeps guest profile multi-path auth gate conversion rails', () => {
    const profile = readProfileSurface();
    const profileCss = readFrontend('pages', 'Profile.css');
    const app = readFrontend('App.tsx');
    expect(app).toContain('<Route path="profile" element={<Profile />} />');
    expect(profile).toContain('profile-page__authGate');
    expect(profile).toContain('pages.profile.authGateTitle');
    expect(profile).toContain("buildLoginUrl('/profile')");
    expect(profileCss).toContain('Commercial guest profile auth gate multi-path conversion');
  });


  it('keeps product detail load failures on multipath commercial recovery exits', () => {
    const productDetail = readProductDetailSurface();
    const pageError = readFrontend('components', 'PageError.tsx');
    expect(productDetail).toContain('data-product-detail-load-recovery');
    expect(productDetail).toContain("navigate('/coupons')");
    expect(productDetail).toContain("navigate('/pet-finder')");
    expect(productDetail).toContain("shop:open-support");
    expect(productDetail).toContain('pages.productDetail.notFoundCoupons');
    expect(pageError).toContain('data-page-error-actions');
    expect(pageError).toContain('actions?: PageErrorAction[]');
  });

  it('keeps register rate-limit failures on multipath commercial recovery exits', () => {
    const register = readRegisterSurface();
    const registerCss = readFrontend('pages', 'Register.css');
    const en = readFrontend('locales', 'en.json');
    const zh = readFrontend('locales', 'zh.json');
    const es = readFrontend('locales', 'es.json');
    expect(register).toContain('data-register-error-recovery');
    expect(register).toContain('data-register-recovery-actions');
    expect(register).toContain("navigate('/login')");
    expect(register).toContain("navigate('/track-order')");
    expect(register).toContain("shop:open-support");
    expect(register).toContain("recoveryKind === 'rate_limited'");
    expect(register).toContain('pages.auth.registerRateLimited');
    expect(registerCss).toContain('register-page__errorRecovery__actions');
    expect(registerCss).toMatch(/register-page__errorRecovery__actions[\s\S]*?min-height:\s*44px/);
    for (const locale of [en, zh, es]) {
      expect(locale).toContain('"registerRateLimited"');
      expect(locale).toContain('"registerRecoveryNextRateLimited"');
    }
  });


  it('keeps storefront load failures on multipath commercial recovery exits', () => {
    const home = readHomeSurface();
    const history = readBrowsingHistorySurface();
    const notifications = readNotificationsSurface();
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    const compare = readProductCompareSurface();
    expect(home).toContain('data-home-load-recovery');
    expect(home).toContain("navigate('/products')");
    expect(home).toContain("navigate('/coupons')");
    expect(home).toContain("navigate('/track-order')");
    expect(home).toContain("shop:open-support");
    expect(history).toContain('data-history-load-recovery');
    expect(history).toContain("navigate('/pet-finder')");
    expect(history).toContain('data-history-empty-actions');
    expect(history).toContain('data-history-empty-filter-actions');
    expect(history).toContain('data-history-empty-load-actions');
    expect(history).toContain('data-history-stale-recovery');
    expect(notifications).toContain('data-notifications-load-recovery');
    expect(notifications).toContain("navigate('/track-order')");
    expect(petFinder).toContain('data-pet-finder-load-recovery');
    expect(petFinder).toContain("navigate('/pet-gallery')");
    expect(compare).toContain('data-compare-load-recovery');
    expect(compare).toContain("navigate('/wishlist')");
    for (const source of [home, history, notifications, petFinder, compare]) {
      expect(source).toContain("shop:open-support");
      expect(source).toContain('actions={[');
    }
  });


  it('keeps conversion-critical load failures on multipath commercial recovery exits', () => {
    const cart = readCartSurface();
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const wishlist = readWishlistSurface();
    const profile = readProfileSurface();
    const coupons = readCouponCenterSurface();
    const stockAlerts = readStockAlertsSurface();
    const petGallery = readFrontend('pages', 'PetGallery.tsx');
    const orderTracking = readOrderTrackingSurface();
    expect(cart).toContain('data-cart-load-recovery');
    expect(readCheckoutSurface()).toContain('data-checkout-load-recovery');
    expect(wishlist).toContain('data-wishlist-load-recovery');
    expect(profile).toContain('data-profile-orders-load-recovery');
    expect(profile).toContain('data-profile-addresses-load-recovery');
    expect(coupons).toContain('data-coupon-load-recovery');
    expect(stockAlerts).toContain('data-stock-alerts-load-recovery');
    expect(petGallery).toContain('data-pet-gallery-load-recovery');
    expect(orderTracking).toContain('data-order-tracking-lookup-recovery');
    for (const source of [cart, readCheckoutSurface(), wishlist, profile, coupons, stockAlerts, petGallery, orderTracking]) {
      expect(source).toContain('actions={[');
      expect(source).toContain("shop:open-support");
    }
  });


  it('keeps checkout empty and payment guest-email gates on multipath commercial recovery exits', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const checkoutSurface = readCheckoutSurface();
    const payment = readPaymentInstructionsSurface();
    expect(checkoutSurface).toContain('data-checkout-empty-actions');
    expect(checkoutSurface).toContain("navigate('/pet-finder')");
    expect(checkoutSurface).toContain("navigate('/coupons')");
    expect(checkoutSurface).toContain("navigate('/history')");
    expect(checkoutSurface).toContain('data-checkout-load-recovery');
    expect(payment).toContain('data-payment-guest-email-gate');
    expect(payment).toContain('data-payment-guest-email-recovery');
    expect(payment).toContain("navigate('/products')");
    expect(payment).toContain("navigate('/coupons')");
    expect(payment).toContain('openSupport');
    expect(payment).toContain('openTrackOrder');
  });

    it('keeps order tracking not-shipped logistics on multipath commercial recovery exits', () => {
    const orderTracking = readOrderTrackingSurface();
    expect(orderTracking).toContain('data-order-tracking-not-shipped');
    expect(orderTracking).toContain('pages.orderTracking.notShippedHint');
    expect(orderTracking).toContain('order-tracking-page__notShippedActions');
    expect(orderTracking).toContain("navigate('/profile?tab=orders')");
    expect(orderTracking).toContain("navigate('/products')");
    expect(orderTracking).toContain("navigate('/coupons')");
    expect(orderTracking).toContain('supportOpen');
  });

  it('keeps product review no-order and auth-gate composers on multipath commercial recovery exits', () => {
    const productReview = readFrontend('components', 'ProductReview.tsx');
    expect(productReview).toContain('data-review-no-order-recovery');
    expect(productReview).toContain('data-review-auth-gate');
    expect(productReview).toContain('pages.review.noReviewableOrderHint');
    expect(productReview).toContain("navigate('/profile?tab=orders')");
    expect(productReview).toContain("navigate('/coupons')");
    expect(productReview).toContain("navigate('/track-order')");
    expect(productReview).toContain('getCurrentRelativeUrl');
    expect(productReview).toContain('/register?redirect=');
  });

    it('keeps forgot-password unavailable on multipath commercial recovery exits', () => {
    const forgot = readForgotPasswordSurface();
    expect(forgot).toContain('data-forgot-password-unavailable');
    expect(forgot).toContain('data-forgot-password-unavailable-actions');
    expect(forgot).toContain("navigate('/login')");
    expect(forgot).toContain("navigate('/track-order')");
    expect(forgot).toContain("navigate('/products')");
    expect(forgot).toContain("navigate('/coupons')");
    expect(forgot).toContain("shop:open-support");
  });

    
  
  
  it('keeps mobile bottom nav and cookie consent CLS-stable on first paint', () => {
    const navCss = readFrontend('components', 'Navbar.css');
    const cookie = readFrontend('components', 'CookieConsentBanner.tsx');
    expect(navCss).toContain('Commercial CLS: stable mobile bottom commerce bar');
    expect(navCss).toMatch(/\.shop-nav__bottomBar[\s\S]*?height:\s*72px/);
    expect(navCss).toMatch(/\.shop-nav__bottomBar[\s\S]*?max-height:\s*72px/);
    expect(cookie).toContain('hasCookieConsent()');
    expect(cookie).toContain('// Commercial CLS: decide visibility on first paint');
    expect(cookie).toMatch(/useState\(\(\) =>/);
  });

  it('bootstraps home catalog for stale-while-revalidate CLS-safe first paint', () => {
    const home = readHomeSurface();
    const homeCss = readFrontend('pages', 'Home.css');
    expect(home).toContain('resolveHomeCatalogBootstrap');
    expect(home).toContain('catalogReadyRef');
    expect(home).toContain('loadFallbackProductCatalog');
    expect(home).toContain('data-home-loading-shell');
    expect(home).toContain('if (!catalogReadyRef.current)');
    expect(home).toContain('setLoading(true)');
    expect(homeCss).toContain('Commercial home loading shell AOTF reserves');
    expect(homeCss).toContain('shopee-mobile-quick-panel--skeleton');
  });

  it('keeps home CLS reserves for product tiles, skeletons, and below-fold sections', () => {
    const homeCss = readFrontend('pages', 'Home.css');
    const home = readHomeSurface();
    const card = readFrontend('components', 'HomeProductCard.tsx');
    const skeletonCss = readFrontend('components', 'SkeletonLoader.css');
    expect(homeCss).toMatch(/\.shopee-product__imageWrap[\s\S]*?aspect-ratio:\s*1 \/ 1/);
    expect(homeCss).toContain('content-visibility: auto');
    expect(homeCss).toContain('contain-intrinsic-size');
    expect(homeCss).toContain('Commercial CLS reserves');
    expect(homeCss).not.toContain('aspect-ratio: 1 / 0.88');
    expect(homeCss).not.toContain('aspect-ratio: 1 / 0.92');
    expect(card).toContain('data-home-card-social');
    expect(card).toContain('data-home-card-signal');
    expect(card).toContain('shopee-product__original--empty');
    expect(home).toContain('recentlyViewedPending');
    expect(home).toContain('data-home-recently-viewed-pending');
    expect(home).toContain('recentlyViewedHydrated');
    expect(skeletonCss).toMatch(/\.hero-skeleton[\s\S]*?min-height:\s*360px/);
    expect(skeletonCss).toMatch(/\.product-skeleton__body[\s\S]*?min-height:\s*142px/);
    expect(skeletonCss).toContain('aspect-ratio: 1 / 1');
  });

it('keeps home empty category and product rails on multipath commercial recovery exits', () => {
    const home = readHomeSurface();
    expect(home).toContain('home-empty-categories');
    expect(home).toContain('home-empty-products');
    expect(home).toContain('data-home-empty-categories');
    expect(home).toContain('data-home-empty-products');
    expect(home).toContain("navigate('/pet-finder')");
    expect(home).toContain("navigate('/track-order')");
    expect(home).toContain("navigate('/coupons')");
  });

    it('keeps product list zero-results empty on multipath commercial recovery exits', () => {
    const productList = readProductListSurface();
    expect(productList).toContain('product-list__empty');
    expect(productList).toContain('data-product-list-empty-actions');
    expect(productList).toContain('const [loading, setLoading] = useState(true)');
    expect(productList).toContain('productCountLabel');
    // Loading currency is seq-only so aborted-without-successor still clears the spinner.
    expect(productList).toMatch(/const isCurrentRequest = \(\) => productRequestSeqRef\.current === requestSeq;/);
    expect(productList).toContain('if (abortController.signal.aborted) return;');
    expect(productList).toMatch(/if \(isCurrentRequest\(\)\) \{\s*setLoading\(false\);/);
    expect(productList).toContain('emptyCouponsActionLabel');
    expect(productList).toContain('emptyPetFinderActionLabel');
    expect(productList).toContain("navigate('/coupons')");
    expect(productList).toContain("navigate('/pet-finder')");
    expect(productList).toContain('openSupport');
  });

    it('keeps product list catalog load failures on multipath commercial recovery exits', () => {
    const productList = readProductListSurface();
    expect(productList).toContain('data-product-list-load-recovery');
    expect(productList).toContain('pages.productList.loadRecoveryCoupons');
    expect(productList).toContain('pages.productList.loadRecoverySupport');
    expect(productList).toContain('actions={[');
    expect(productList).toContain('openSupport');
  });

  it('keeps storefront payment links on current shopping origin for multi-host conversion', () => {
    const recovery = readFrontend('utils', 'paymentRecovery.ts');
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const orderActions = readFrontend('hooks', 'useCheckoutOrderActions.ts');
    const paymentInstructions = readPaymentInstructionsSurface();
    const orderTracking = readOrderTrackingSurface();
    const profile = readProfileSurface();
    expect(recovery).toContain('resolveCommercialPaymentNavigationUrl');
    expect(recovery).toContain('navigateToCommercialPaymentUrl');
    expect(recovery).toContain('isStorefrontPaymentPath');
    expect(recovery).toContain('petsanything.com');
    expect(recovery).toContain('.trycloudflare.com');
    expect(orderActions).toContain('navigateToCommercialPaymentUrl');
    expect(checkout).toContain('useCheckoutOrderActions({');
    expect(paymentInstructions).toContain('navigateToCommercialPaymentUrl');
    expect(orderTracking).toContain('navigateToCommercialPaymentUrl');
    expect(profile).toContain('navigateToCommercialPaymentUrl');
  });

  it('keeps conversion route Suspense shells on a commercial h1 primary title', () => {
    const app = readFrontend('App.tsx');
    expect(app).toContain('Keep conversion shells on a commercial h1 while lazy route chunks hydrate');
    // Lightweight shell: semantic h1 (no antd Typography Title) for conversion route hydration titles.
    expect(app).toMatch(/<h1 className="app-route-loading__title">\{routeTitle\}<\/h1>/);
    expect(app).toContain('app-route-loading__spinner');
    expect(app).toMatch(/pages\.cart\.title/);
    expect(app).toMatch(/pages\.checkout\.title/);
    expect(app).toMatch(/pages\.orderTracking\.title/);
  });

  it('keeps conversion pages on a single commercial h1 primary title', () => {
    const cart = readCartSurface();
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const productDetail = readProductDetailSurface();
    const tracking = readOrderTrackingSurface();
    const coupons = readCouponCenterSurface();
    const homeCss = readFrontend('pages', 'Home.css');
    const listCss = readFrontend('pages', 'ProductList.css');
    // Native h1 densification (no ant Typography Title runtime).
    expect(cart).toContain("<h1 className=\"cart-page__title\">{t('pages.cart.title')}</h1>");
    expect(cart).toContain("<h1 className=\"cart-page__title\">{t('pages.cart.empty')}</h1>");
    expect(cart).toMatch(/role="status"[\s\S]*?<h1 className="cart-page__title">\{t\('pages\.cart\.title'\)\}<\/h1>/);
    expect(cart).toMatch(/<h1 className="cart-page__title">\{t\('pages\.cart\.title'\)\}<\/h1>[\s\S]*?data-cart-load-recovery="true"/);
    expect(readCheckoutSurface()).toContain("<h1 className=\"checkout-page__title\">{t('pages.checkout.title')}</h1>");
    expect(readCheckoutSurface()).toMatch(/checkout-page--loading[\s\S]*?<h1 className="checkout-page__title">\{t\('pages\.checkout\.title'\)\}<\/h1>/);
    expect(readCheckoutSurface()).toMatch(/<h1 className="checkout-page__title">\{t\('pages\.checkout\.title'\)\}<\/h1>[\s\S]*?data-checkout-load-recovery="true"/);
    expect(productDetail).toMatch(/product-title-block[\s\S]*?<h1 className="product-detail-page__title">\{productName\}<\/h1>/);
    expect(tracking).toContain('<h1 className="order-tracking-page__title">');
    expect(coupons).toContain("<h1 className=\"coupon-center-page__title\"><ShopIcon path={SI.gift} /> {t('pages.coupons.opportunityTitle')}</h1>");
    expect(homeCss).toContain('Commercial stock badges stay >=12px');
    expect(listCss).toContain('Commercial catalog hero eyebrow stays >=12px');
  });

  it('keeps mobile bottom-nav and home quick-panel labels commercially legible', () => {
    const navCss = readFrontend('components', 'Navbar.css');
    const homeCss = readFrontend('pages', 'Home.css');
    const home = readFrontend('pages', 'Home.tsx');
    expect(navCss).toContain('bottom-nav labels stay >=12px');
    // Do not reintroduce sub-12px bottom-nav floors after the commercial guard.
    expect(navCss).not.toMatch(/bottom-nav labels stay >=12px[\s\S]*@media \(max-width: 380px\)[\s\S]*font-size:\s*11px\s*!important/);
    expect(navCss).toMatch(/\.shop-nav__bottomItem[\s\S]*?font-size:\s*12px\s*!important/);
    expect(homeCss).toContain('quick-panel and hero eyebrow labels stay >=12px');
    expect(homeCss).toMatch(/\.shopee-mobile-quick-panel__label[\s\S]*?font-size:\s*12px\s*!important/);
    // Home document title must not be "Brand | Brand Site".
    expect(home).toMatch(/usePageTitle\(\s*\)/);
    expect(home).not.toMatch(/usePageTitle\(\s*t\('common\.brand'\)/);
  });

  it('keeps support launcher geometry on CSS vars for commercial rail closure', () => {
    const support = readFrontend('components', 'CustomerSupportWidget.tsx');
    const supportCss = readFrontend('components', 'CustomerSupportWidget.css');
    expect(support).toContain('--support-launcher-left');
    expect(support).toContain('--support-launcher-size');
    expect(support).toContain('customer-support-widget__launcherIcon');
    expect(supportCss).toContain('Support launcher CSS var geometry');
    expect(supportCss).toMatch(
      /--support-launcher-size[\s\S]*?width:\s*var\(--support-launcher-size/,
    );
  });

  it('keeps mobile web support launcher visible on browse shells', () => {
    const appCss = readFrontend('App.css');
    expect(appCss).toContain('Keep one-tap Live Support on browse/account surfaces');
    // Must not globally force-hide the FAB on all mobile surfaces.
    expect(appCss).not.toMatch(
      /@media \(max-width:\s*780px\) \{\s*\.app-support-launcher,\s*\.customer-support-widget__button \{\s*display:\s*none\s*!important;/
    );
    // Sticky conversion rails still hide the FAB.
    expect(appCss).toMatch(
      /\.shop-app-shell--product-detail[\s\S]*?\.customer-support-widget__button[\s\S]*?display:\s*none\s*!important/
    );
    expect(appCss).toMatch(
      /\.shop-app-shell--checkout[\s\S]*?\.customer-support-widget__button[\s\S]*?display:\s*none\s*!important/
    );
    // Browse shells reaffirm visibility + commercial hit size.
    expect(appCss).toMatch(
      /\.shop-app-shell--home \.customer-support-widget__button[\s\S]*?min-height:\s*48px\s*!important/
    );
  });

  it('keeps mobile product title links on commercial 44px touch targets', () => {
    const homeCss = readFrontend('pages', 'Home.css');
    const listCss = readFrontend('pages', 'ProductList.css');
    expect(homeCss).toContain('product title links must stay >=44px');
    expect(homeCss).toMatch(/\.shopee-product__name[\s\S]*?min-height:\s*44px\s*!important;/);
    expect(listCss).toContain('catalog product titles must stay >=44px');
    expect(listCss).toMatch(/\.product-list__titleLink[\s\S]*?min-height:\s*44px\s*!important;/);
    // Mobile web path (not only native app) must keep 44px.
    expect(listCss).toMatch(
      /body:not\(\.shop-mobile-app\)[\s\S]*?\.product-list__titleLink[\s\S]*?min-height:\s*44px\s*!important;/
    );
  });

  it('keeps storefront header controls on commercial 44px touch targets', () => {
    const navCss = readFrontend('components', 'Navbar.css');
    const searchCss = readFrontend('components', 'ShopSearchField.css');
    const announcement = navCss.match(/\.shop-nav__announcement\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const announcementToggle = navCss.match(/\.shop-nav__announcementToggle\s*\{[\s\S]*?\}/)?.[0] ?? '';

    expect(announcement).toContain('min-height: 44px;');
    expect(announcement).toContain('padding-inline-end: 60px;');
    expect(announcementToggle).toContain('width: 44px;');
    expect(announcementToggle).toContain('min-width: 44px;');
    expect(announcementToggle).toContain('height: 44px;');
    expect(announcementToggle).toContain('min-height: 44px;');
    expect(navCss).toMatch(/\.shop-nav__brand\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(navCss).toMatch(
      /\.shop-nav__actions \.shop-nav__secondary-action,[\s\S]*?\.shop-nav__actions \.shop-nav__cart-action,[\s\S]*?\.shop-nav__actions \.shop-nav__more-trigger\s*\{[\s\S]*?flex:\s*0 0 44px;[\s\S]*?width:\s*44px;[\s\S]*?min-width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;[\s\S]*?padding:\s*0;/,
    );
    expect(searchCss).toMatch(/\.shop-search-field__input\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(searchCss).toMatch(/\.shop-search-field__submit\s*\{[\s\S]*?min-width:\s*62px;[\s\S]*?min-height:\s*44px;/);
    expect(navCss).toMatch(/Gate124 shop search densify[\s\S]*?\.shop-nav__search \.shop-search-field\s*\{[\s\S]*?height:\s*44px;[\s\S]*?padding:\s*0;/);
    expect(navCss).toMatch(/Gate124 shop search densify[\s\S]*?\.shop-nav__search \.shop-search-field__control\s*\{[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(navCss).toMatch(/Gate124 shop search densify[\s\S]*?\.shop-nav__search \.shop-search-field__input\s*\{[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(navCss).toMatch(/Gate124 shop search densify[\s\S]*?\.shop-nav__search \.shop-search-field__submit\s*\{[\s\S]*?height:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(navCss).not.toMatch(/Gate124 shop search densify[\s\S]*?\.shop-nav__search \.shop-search-field__(?:control|submit)\s*\{[\s\S]*?min-height:\s*38px;/);
  });

  it('keeps storefront shared controls on commercial 44px touch targets', () => {
    const breadcrumbCss = readFrontend('components', 'ShopBreadcrumb.css');
    const buttonCss = readFrontend('components', 'ShopButton.css');
    const inputCss = readFrontend('components', 'ShopInput.css');

    expect(breadcrumbCss).toMatch(/\.shop-breadcrumb__link\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(buttonCss).toMatch(/\.shop-button--small\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?min-width:\s*44px;/);
    expect(buttonCss).toMatch(/\.shop-button--small\.shop-button--iconOnly\s*\{[\s\S]*?width:\s*44px;/);
    expect(buttonCss).toMatch(/\.shop-button--circle\.shop-button--small\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-width:\s*44px;/);
    expect(buttonCss).toMatch(/Commercial disabled state:[\s\S]*?\.shop-button:disabled,[\s\S]*?opacity:\s*1;/);
    expect(buttonCss).toMatch(/\.shop-button\.shop-button--primary:disabled,[\s\S]*?background:\s*#eef5f0;[\s\S]*?color:\s*#53645b;/);
    expect(inputCss).toMatch(/\.shop-input__control\s*\{[\s\S]*?min-height:\s*44px;/);
    expect(inputCss).toMatch(/\.shop-input__clear,[\s\S]*?\.shop-input__visibility\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(inputCss).toMatch(/\.shop-input__visibilityWrap > button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(buttonCss).not.toMatch(/\.shop-button--small\s*\{[\s\S]*?min-height:\s*36px/);
    expect(buttonCss).not.toMatch(/\.shop-button:disabled,[\s\S]{0,120}?opacity:\s*0\.(?:4|5|6)/);
    expect(inputCss).not.toMatch(/\.shop-input__(?:control|clear|visibility|visibilityWrap > button)[\s\S]{0,120}?min-height:\s*(?:28|36|40)px/);
  });

  it('keeps mobile category mega chips on commercial 44px touch targets', () => {
    const css = readFrontend('components', 'Navbar.css');
    expect(css).toContain('category mega chips must stay >=44px');
    expect(css).toMatch(/\.shop-nav__megaButton[\s\S]*?min-height:\s*44px\s*!important;/);
    expect(css).toMatch(/@media \(max-width:\s*780px\)[\s\S]*?\.shop-nav__megaButton[\s\S]*?min-height:\s*44px\s*!important;/);
    // F2710 high-specificity mobile web path must itself be 44px (not 38px).
    expect(css).toMatch(
      /body:not\(\.shop-mobile-app\) \.shop-nav:not\(\.shop-nav--es\) \.shop-nav__megaButton[\s\S]*?min-height:\s*44px\s*!important;/
    );
    expect(css).not.toMatch(
      /body:not\(\.shop-mobile-app\) \.shop-nav:not\(\.shop-nav--es\) \.shop-nav__megaButton[\s\S]{0,240}?min-height:\s*38px\s*!important;/
    );
  });



  it('keeps Spanish category mega labels commercially legible at >=12px on mobile', () => {
    const css = readFrontend('components', 'Navbar.css');
    expect(css).toContain('category mega labels stay >=12px on mobile for all locales');
    expect(css).toMatch(
      /category mega labels stay >=12px on mobile for all locales[\s\S]*?\.shop-nav--es \.shop-nav__megaButton[\s\S]*?font-size:\s*12px\s*!important/,
    );
    // Residual floor must not re-collapse Spanish long labels under 12px.
    expect(css).not.toMatch(
      /@media \(max-width:\s*420px\)[\s\S]*?\.shop-nav--es \.shop-nav__megaButton[\s\S]*?font-size:\s*10\.5px/,
    );
  });

  it('keeps sold-out purchase readiness from claiming direct-add', () => {
    const productDetail = readProductDetailSurface();
    expect(productDetail).toContain('sold-out SKUs must never claim "ready to add"');
    expect(productDetail).toMatch(/ready:\s*!params\.isOutOfStock\s*&&\s*!params\.purchaseSelectionBlocked/);
  });

  it('keeps catalog titles/actions commercially legible at >=12px on mobile', () => {
    const listCss = readFrontend('pages', 'ProductList.css');
    expect(listCss).toContain('Commercial catalog titles/actions stay >=12px');
    expect(listCss).toMatch(
      /Commercial catalog titles\/actions stay >=12px[\s\S]*?\.product-list__titleLink[\s\S]*?font-size:\s*12px/
    );
  });

  it('keeps residual catalog/cart/coupon conversion labels commercially legible at >=12px', () => {
    const listCss = readFrontend('pages', 'ProductList.css');
    const cartCss = readFrontend('pages', 'Cart.css');
    const couponCss = readFrontend('pages', 'CouponCenter.css');
    expect(listCss).toContain('next-step/preview/badge labels stay >=12px');
    expect(listCss).toMatch(
      /next-step\/preview\/badge labels stay >=12px[\s\S]*?\.product-list__mobileNextStepActions \.ant-btn[\s\S]*?font-size:\s*12px/
    );
    expect(cartCss).toContain('cart hero/summary uppercase labels stay >=12px');
    expect(cartCss).toMatch(
      /cart hero\/summary uppercase labels stay >=12px[\s\S]*?\.cart-page__heroStat strong[\s\S]*?font-size:\s*12px/
    );
    expect(couponCss).toContain('coupon hero stats/badges/quick-nav/result labels stay >=12px');
    expect(couponCss).toMatch(
      /coupon hero stats\/badges\/quick-nav\/result labels stay >=12px[\s\S]*?\.coupon-center-page__heroStats span[\s\S]*?font-size:\s*12px/
    );
  });

  it('keeps cart drawer conversion labels commercially legible at >=12px on mobile', () => {
    const drawerCss = readFrontend('components', 'CartDrawer.css');
    expect(drawerCss).toContain('cart drawer hero/subtotal/trust labels stay >=12px');
    expect(drawerCss).toMatch(
      /cart drawer hero\/subtotal\/trust labels stay >=12px[\s\S]*?\.cart-drawer__heroStat strong[\s\S]*?font-size:\s*12px/
    );
  });

  it('keeps storefront /orders multipath on profile orders tab', () => {
    const app = readFrontend('App.tsx');
    expect(app).toContain('path="orders"');
    expect(app).toMatch(/path="orders"\s+element=\{<Navigate to="\/profile\?tab=orders" replace \/>\}/);
  });

  it('keeps password visibility toggles off redundant inline resets', () => {
    const shopInputCss = readFrontend('components', 'ShopInput.css');
    expect(shopInputCss).toContain('Commercial password toggle button reset');
    expect(shopInputCss).toMatch(
      /Commercial password toggle button reset[\s\S]*?\.shop-input__visibilityWrap > button[\s\S]*?border:\s*0/,
    );
    for (const page of ['Login.tsx', 'Register.tsx', 'ForgotPassword.tsx', 'Profile.tsx'] as const) {
      const source = page === 'Login.tsx' ? readLoginSurface() : page === 'Register.tsx' ? readRegisterSurface() : page === 'ForgotPassword.tsx' ? readForgotPasswordSurface() : readFrontend('pages', page);
      expect(source).not.toMatch(/border:\s*0,\s*padding:\s*0,\s*background:\s*'transparent'/);
    }
  });

  it('keeps cart drawer empty glyph and coupon claim list spacing on CSS classes', () => {
    const drawer = readFrontend('components', 'CartDrawer.tsx');
    const drawerCss = readFrontend('components', 'CartDrawer.css');
    const coupons = readCouponCenterSurface();
    const couponCss = readFrontend('pages', 'CouponCenter.css');
    expect(drawer).toContain('cart-drawer__emptyIconGlyph');
    expect(drawer).not.toMatch(/cart-drawer__emptyIconGlyph[\s\S]{0,40}style=\{\{/);
    expect(drawerCss).toContain('cart-drawer__emptyIconGlyph');
    expect(coupons).toContain('coupon-claim-section__title--list');
    expect(coupons).not.toMatch(/coupon-claim-section__title--list[\s\S]{0,40}style=\{\{/);
    expect(couponCss).toContain('coupon-claim-section__title--list');
  });

  it('keeps ShopBadge digits commercially legible at >=12px', () => {
    const badgeCss = readFrontend('components', 'ShopBadge.css');
    expect(badgeCss).toContain('Commercial residual: shop badge digits stay >=12px');
    expect(badgeCss).toMatch(
      /Commercial residual: shop badge digits stay >=12px[\s\S]*?\.shop-badge__count[\s\S]*?font-size:\s*12px\s*!important/,
    );
    expect(badgeCss).not.toMatch(/\.shop-badge--small \.shop-badge__count[\s\S]*?font-size:\s*10px/);
  });

  it('keeps social-proof toast copy commercially legible at >=12px', () => {
    const toastCss = readFrontend('components', 'SocialProofToast.css');
    expect(toastCss).toContain('Commercial residual: social proof toast copy stays >=12px');
    expect(toastCss).toMatch(
      /Commercial residual: social proof toast copy stays >=12px[\s\S]*?\.social-proof-toast strong[\s\S]*?font-size:\s*12px\s*!important/,
    );
    expect(toastCss).not.toMatch(/font-size:\s*10\.5px/);
  });

  it('keeps nav badge digits commercially legible at >=12px on mobile', () => {
    const navCss = readFrontend('components', 'Navbar.css');
    expect(navCss).toContain('nav cart/wishlist/notification badge digits stay >=12px');
    expect(navCss).toMatch(
      /nav cart\/wishlist\/notification badge digits stay >=12px[\s\S]*?\.ant-scroll-number-only-unit[\s\S]*?font-size:\s*12px/
    );
    expect(navCss).toMatch(
      /nav cart\/wishlist\/notification badge digits stay >=12px[\s\S]*?\.shop-badge__count[\s\S]*?font-size:\s*12px\s*!important/,
    );
  });

  it('keeps login shell on a commercial loginTitle h1', () => {
    const login = readLoginSurface();
    expect(login).toContain("<h1 className=\"shopee-login-panel__title\">{t('pages.auth.loginTitle')}</h1>");
    expect(login).not.toContain("<h1 className=\"shopee-login-panel__title\">{t('pages.auth.loginTrustTitle')}</h1>");
  });

  it('keeps support panel conversion microcopy commercially legible at >=12px', () => {
    const supportCss = readFrontend('components', 'CustomerSupportWidget.css');
    expect(supportCss).toContain('support panel quick replies/tags/meta stay >=12px');
    expect(supportCss).toMatch(
      /support panel quick replies\/tags\/meta stay >=12px[\s\S]*?\.customer-support-widget__welcomeQuickReplies button[\s\S]*?font-size:\s*12px/
    );
  });

  it('keeps support panel quick-reply chips commercially tappable at >=44px on mobile', () => {
    const supportCss = readFrontend('components', 'CustomerSupportWidget.css');
    expect(supportCss).toContain('primary support chips/buttons stay >=44px touch targets');
    expect(supportCss).toMatch(
      /primary support chips\/buttons stay >=44px touch targets[\s\S]*?\.customer-support-widget__welcomeQuickReplies button[\s\S]*?min-height:\s*44px\s*!important/
    );
    expect(supportCss).toMatch(
      /primary support chips\/buttons stay >=44px touch targets[\s\S]*?\.customer-support-widget__quickReplies \.ant-btn[\s\S]*?min-height:\s*44px\s*!important/
    );
    // Residual floor must not re-collapse below the Android UI closure 44px floor.
    expect(supportCss).not.toMatch(
      /support panel quick replies\/tags\/meta stay >=12px[\s\S]*?min-height:\s*3[0-9]px\s*!important/
    );
  });

  it('keeps support composer inputs at iOS-safe 16px on mobile and short landscape', () => {
    const supportCss = readFrontend('components', 'CustomerSupportWidget.css');
    expect(supportCss).toMatch(
      /@media \(max-width:\s*780px\), \(max-width:\s*900px\) and \(max-height:\s*430px\)[\s\S]*?\.customer-support-widget__messageInput \.ant-input,[\s\S]*?\.customer-support-widget__composer \.ant-input-textarea textarea\s*\{[\s\S]*?font-size:\s*16px\s*!important/
    );
    expect(supportCss).not.toMatch(
      /\.customer-support-widget__messageInput \.ant-input\s*\{[\s\S]{0,140}?font-size:\s*(?:[0-9]|1[0-5])px/
    );
  });

  it('keeps ShopMX commercial home market on MXN with Mexico-first payment fallback', () => {
    const market = readFrontend('utils', 'market.ts');
    const conversion = readFrontend('utils', 'conversionConfig.ts');
    expect(market).toContain("return 'MXN'");
    expect(market).toMatch(/ShopMX is a Mexico-first storefront[\s\S]*return 'MXN'/);
    expect(conversion).toMatch(/fallback:\s*\[[^\]]*MERCADO_PAGO/);
    expect(conversion).toMatch(/MXN:\s*\[[^\]]*MERCADO_PAGO/);
  });

  it('keeps home product signals and catalog confidence chips commercially legible', () => {
    const homeCss = readFrontend('pages', 'Home.css');
    const listCss = readFrontend('pages', 'ProductList.css');
    expect(homeCss).toContain('Commercial product signal labels stay >=12px');
    expect(listCss).toContain('Commercial catalog confidence/discovery labels stay >=12px');
    expect(listCss).toContain('Commercial confidence pills stay >=12px');
  });

  it('keeps sold-out PDP decision checklist from claiming addable options', () => {
    const productDetail = readProductDetailSurface();
    expect(productDetail).toContain('never mark options "ready to add" when the SKU is sold out');
    expect(productDetail).toMatch(/ready:\s*!params\.isOutOfStock\s*&&/);
  });

  it('keeps pet gallery insight chips commercially legible at >=12px on mobile', () => {
    const petGalleryCss = readFrontend('pages', 'PetGallery.css');
    expect(petGalleryCss).toContain('insight chips stay >=12px');
    expect(petGalleryCss).toMatch(
      /insight chips stay >=12px[\s\S]*?\.pet-gallery-insights__item span[\s\S]*?font-size:\s*12px/
    );
  });

  it('keeps residual pet-finder/history/notification/catalog labels commercially legible at >=12px', () => {
    const listCss = readFrontend('pages', 'ProductList.css');
    const petFinderCss = readFrontend('pages', 'PetFinder.css');
    const historyCss = readFrontend('pages', 'BrowsingHistory.css');
    const notificationsCss = readFrontend('pages', 'Notifications.css');
    expect(listCss).toContain('Commercial Spanish action labels stay >=12px');
    expect(listCss).toMatch(
      /Commercial Spanish action labels stay >=12px[\s\S]*?\.product-list--es \.product-list__actionButton \.product-list__actionLabel[\s\S]*?font-size:\s*12px/,
    );
    expect(petFinderCss).toContain('Commercial mobile: pet finder labels stay >=12px');
    expect(petFinderCss).toMatch(
      /Commercial mobile: pet finder labels stay >=12px[\s\S]*?\.pet-finder-page__signal span[\s\S]*?font-size:\s*12px\s*!important/,
    );
    expect(petFinderCss).toContain('Commercial mobile next-step metadata guard');
    expect(petFinderCss).toMatch(
      /Commercial mobile next-step metadata guard[\s\S]*?\.pet-finder-page__nextStepMeta\s*\{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?overflow:\s*visible;[\s\S]*?mask-image:\s*none/,
    );
    expect(petFinderCss).toMatch(
      /\.pet-finder-page__nextStepMeta \.ant-tag\s*\{[\s\S]*?flex:\s*1 1 min\(100%, 132px\);[\s\S]*?max-width:\s*100%;[\s\S]*?white-space:\s*normal/,
    );
    expect(historyCss).toContain('Commercial mobile: browsing history labels stay >=12px');
    expect(historyCss).toMatch(
      /Commercial mobile: browsing history labels stay >=12px[\s\S]*?\.browsing-history__assistant-actions span[\s\S]*?font-size:\s*12px\s*!important/,
    );
    expect(notificationsCss).toContain('Commercial residual: notification tags stay >=12px');
    expect(notificationsCss).toMatch(
      /Commercial residual: notification tags stay >=12px[\s\S]*?\.notifications-page__item \.ant-list-item-meta-title \.ant-tag[\s\S]*?font-size:\s*12px\s*!important/,
    );
  });

  it('keeps PDP sold-out and wishlist affordances on CSS classes', () => {
    const pdp = readProductDetailSurface();
    const pdpCss = readFrontend('pages', 'ProductDetail.css');
    expect(pdp).toContain('product-detail__soldOutTag');
    expect(pdp).toContain('product-detail__wishlistIcon--active');
    expect(pdp).toContain('product-detail-page__title--qa');
    expect(pdp).not.toMatch(/product-detail__soldOutTag[\s\S]{0,40}style=\{\{/);
    expect(pdpCss).toContain('Commercial PDP: sold-out chip');
  });

  it('keeps wishlist header icon on CSS without inline color/size', () => {
    const wishlist = readWishlistSurface();
    const wishlistCss = readFrontend('pages', 'Wishlist.css');
    expect(wishlist).toContain('wishlist-page__headerIcon');
    expect(wishlist).not.toMatch(/wishlist-page__headerIcon[\s\S]{0,40}style=\{\{/);
    expect(wishlistCss).toContain('wishlist-page__headerIcon');
  });

  it('keeps home category skeleton title off inline geometry', () => {
    const home = readHomeSurface();
    const homeCss = readFrontend('pages', 'Home.css');
    expect(home).toContain('shopee-categories-section__titleSkeleton');
    expect(home).not.toMatch(/shopee-categories-section__titleSkeleton[\s\S]{0,40}style=\{\{/);
    expect(homeCss).toContain('shopee-categories-section__titleSkeleton');
  });

  it('keeps conversion microcopy commercially legible at >=12px on mobile', () => {
    const cartCss = readFrontend('pages', 'Cart.css');
    const listCss = readFrontend('pages', 'ProductList.css');
    const pdpCss = readFrontend('pages', 'ProductDetail.css');
    const appCss = readFrontend('App.css');
    expect(cartCss).toContain('cart empty recovery copy/actions stay legible');
    expect(listCss).toContain('catalog next-step coaching stays >=12px');
    expect(pdpCss).toContain('stock + secondary money/microcopy stay >=12px');
    expect(appCss).toContain('footer link columns stay >=12px');
  });


  it('keeps wishlist and profile shells on a commercial h1 primary title', () => {
    const wishlist = readWishlistSurface();
    const profile = readProfileSurface();
    const app = readFrontend('App.tsx');
    expect(wishlist).toContain("<h1 className=\"wishlist-page__title\">{t('pages.wishlist.authGateTitle')}</h1>");
    expect(wishlist).toContain("<h1 className=\"wishlist-page__title\">{t('pages.wishlist.pageTitle')}</h1>");
    expect(profile).toContain("<h1 className=\"profile-page__title\">{t('pages.profile.authGateTitle')}</h1>");
    expect(profile).toContain('<h1 className="profile-page__title">{user.username}</h1>');
    expect(app).toMatch(/path === '\/wishlist'/);
    expect(app).toMatch(/path === '\/profile'/);
  });


  it('keeps footer CTA and checkout conversion microcopy commercially legible', () => {
    const appCss = readFrontend('App.css');
    const checkoutCss = readFrontend('pages', 'Checkout.css');
    expect(appCss).toContain('footer CTA strip titles/copy stay >=12px');
    expect(checkoutCss).toContain('checkout conversion microcopy stays >=12px');
  });


  it('keeps remaining storefront shells on a commercial h1 primary title', () => {
    const notifications = readNotificationsSurface();
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    const compare = readProductCompareSurface();
    const stock = readStockAlertsSurface();
    const notFound = readFrontend('pages', 'NotFound.tsx');
    const forgot = readForgotPasswordSurface();
    const app = readFrontend('App.tsx');
    expect(notifications).toContain("<h1 className=\"notifications-page__title\">{t('pages.notifications.authGateTitle')}</h1>");
    expect(notifications).toContain("<h1 className=\"notifications-page__title\">{t('pages.notifications.title')}</h1>");
    expect(petFinder).toContain('<h1 className="pet-finder-page__title">');
    expect(compare).toContain("<h1 className=\"product-compare-page__title\">{t('pages.compare.title')}</h1>");
    expect(stock).toContain('<h1 className="stock-alerts-page__title">');
    expect(notFound).toContain('not-found-page__title');
    expect(forgot).toContain('<h1 className="shopee-login-subtitle shopee-login-subtitle--h1">');
    expect(app).toMatch(/path === '\/notifications'/);
    expect(app).toMatch(/path === '\/pet-finder'/);
    expect(app).toMatch(/path === '\/stock-alerts'/);
  });


  it('keeps checkout payment method ordering Mexico-first without CN-over-GLOBAL sortOrder regression', () => {
    const paymentMethods = readFrontend('utils', 'paymentMethods.tsx');
    const en = readFrontend('locales', 'en.json');
    expect(paymentMethods).toContain('preservePaymentChannelOrder');
    expect(paymentMethods).toContain('badgeKeyForPaymentMarket');
    expect(paymentMethods).toMatch(/paymentMethodOrder:\s*PaymentMethod\[\]\s*=\s*\[[^\]]*MERCADO_PAGO/);
    // Must not re-sort solely by raw sortOrder (elevates CN 70-90 over GLOBAL 100+)
    expect(paymentMethods).not.toMatch(/\.sort\(\s*\(a,\s*b\)\s*=>\s*\(a\.sortOrder/);
    expect(en).toContain('"paymentGlobal"');
  });


  it('hides CN payment rails for MXN checkout and keeps conversion-critical mobile floors', () => {
    const paymentMethods = readFrontend('utils', 'paymentMethods.tsx');
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const orderActions = readFrontend('hooks', 'useCheckoutOrderActions.ts');
    const checkoutHelpers = readFrontend('utils', 'checkoutHelpers.ts');
    const payment = readFrontend('components', 'Payment.tsx');
    const mobileApp = readFrontend('mobile-app.css');
    const searchBar = readFrontend('components', 'SearchBar.css');
    const pdp = readFrontend('pages', 'ProductDetail.css');
    const checkoutSurface = `${checkout}
${orderActions}`;
    expect(paymentMethods).toContain('filterPaymentChannelsForMarket');
    expect(paymentMethods).toContain("currency === 'MXN'");
    expect(paymentMethods).toMatch(/hideForeign && market === 'CN'/);
    expect(checkout).toMatch(/createPaymentMethodDetails\(paymentChannels,\s*\{\s*currency\s*\}\)/);
    // Recommendation + bootstrap resolve stay modularized but still market-filter rails.
    expect(checkoutHelpers).toContain('filterPaymentChannelsForMarket');
    expect(checkoutHelpers).toMatch(/filterPaymentChannelsForMarket\(channels,\s*\{\s*currency\s*\}\)/);
    expect(checkoutHelpers).toContain('export const getRecommendedPaymentMethod');
    expect(checkoutHelpers).toContain('export const resolveCheckoutPaymentMethod');
    expect(checkout).toContain('resolveCheckoutPaymentMethod');
    expect(checkout).toContain('getRecommendedPaymentMethod');
    expect(checkoutSurface).toMatch(/paymentMethodDetails\.some\(\s*\(method\)\s*=>\s*method\.value === normalizedPaymentMethod\s*\)/);
    expect(payment).toContain('filterPaymentChannelsForMarket');
    expect(payment).toMatch(/getDefaultPaymentMethod\(channels,\s*currency\)/);
    expect(mobileApp).toMatch(/shop-nav__bottomItem span[\s\S]*?font-size:\s*12px/);
    expect(searchBar).toMatch(/min-height:\s*44px/);
    expect(pdp).toMatch(/product-mobile-buybar__cart[\s\S]*?min-height:\s*44px/);
  });



  it('keeps conversion-path residual fonts >=12px and seeds MXN home currency', () => {
    const market = readFrontend('utils', 'market.ts');
    const checkoutCss = readFrontend('pages', 'Checkout.css');
    const cartCss = readFrontend('pages', 'Cart.css');
    const supportCss = readFrontend('components', 'CustomerSupportWidget.css');
    const paymentCss = readFrontend('components', 'Payment.css');
    const homeCss = readFrontend('pages', 'Home.css');
    const productDetailCss = readFrontend('pages', 'ProductDetail.css');
    const navCss = readFrontend('components', 'Navbar.css');
    expect(market).toContain("const home: CurrencyCode = 'MXN'");
    expect(market).toContain('writeStoredCurrency(home)');
    // residual 9-11px primary floors should be closed on conversion CSS
    for (const css of [checkoutCss, cartCss, supportCss, paymentCss, homeCss, productDetailCss, navCss]) {
      expect(css).not.toMatch(/font-size:\s*(?:9|10|11)(?:\.\d+)?px/);
    }
    expect(homeCss).toContain('Commercial residual quick-panel labels stay >=12px and tappable');
    expect(homeCss).toContain('Commercial Spanish quick-panel labels stay >=12px');
    expect(productDetailCss).toContain('Commercial Spanish buybar tool labels stay >=12px');
    expect(navCss).toContain('Commercial Spanish bottom-nav product labels stay >=12px');
  });


  it('keeps navbar conversion controls commercially tappable at >=44px', () => {
    const nav = readFrontend('components', 'Navbar.css');
    expect(nav).toMatch(/\.shop-nav__guestCta[\s\S]{0,80}?min-height:\s*44px/);
    expect(nav).toMatch(/\.shop-nav__suggestions button[\s\S]{0,60}?min-height:\s*44px/);
    expect(nav).toMatch(/\.shop-nav__actions button[\s\S]{0,80}?min-height:\s*44px/);
    expect(nav).toMatch(/\.shop-nav__menu-action[\s\S]{0,60}?min-height:\s*44px/);
    // search field must not regress below 44 on commercial mobile
    expect(nav).not.toMatch(/\.shop-nav__search \.shop-search-field\s*\{[\s\S]{0,80}?height:\s*(?:3[0-9]|4[0-3])px/);
  });


  it('keeps catalog conversion action targets commercially tappable at >=44px', () => {
    const list = readFrontend('pages', 'ProductList.css');
    const detail = readFrontend('pages', 'ProductDetail.css');
    expect(list).toMatch(/\.product-list__actionButton--compact[\s\S]{0,120}?min-height:\s*44px|height:\s*44px/);
    expect(list).not.toMatch(/\.product-list__actionButton--compact\s*\{[\s\S]{0,80}?height:\s*34px/);
    expect(list).toMatch(/\.product-list__smartPick[\s\S]{0,120}?min-height:\s*44px/);
    expect(list).toMatch(/mobileNextStepActions \.ant-btn[\s\S]{0,80}?min-height:\s*44px/);
    expect(detail).toMatch(/\.product-detail-tabs__tab[\s\S]{0,40}?min-height:\s*44px/);
  });


  
  it('keeps home and catalog residual conversion rails commercially tappable at >=44px', () => {
    const home = readFrontend('pages', 'Home.css');
    const homeFirstFold = readFrontend('pages', 'homeFirstFoldPanels.tsx');
    const list = readFrontend('pages', 'ProductList.css');
    const cart = readFrontend('pages', 'Cart.css');
    const profile = readFrontend('pages', 'Profile.css');
    expect(home).toMatch(/\.shopee-hero__categoryRail button[\s\S]{0,80}?min-height:\s*44px/);
    expect(home).toMatch(/\.home-btn--text\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px/);
    expect(homeFirstFold).toContain('data-commercial-primary-cta="home-hero-products"');
    expect(homeFirstFold).toContain('data-commercial-primary-cta="home-hero-coupons"');
    expect(homeFirstFold).toContain('data-commercial-primary-cta={`home-mobile-${action.key}`}');
    expect(home).toMatch(/\.shopee-product__quickActions button[\s\S]{0,80}?height:\s*44px/);
    expect(home).toMatch(/\.shopee-section__header button[\s\S]{0,80}?min-height:\s*44px/);
    expect(list).toMatch(/\.product-list__actionButton\.ant-btn[\s\S]{0,120}?min-height:\s*44px/);
    expect(list).not.toMatch(/\.product-list__actionButton\.ant-btn[\s\S]{0,80}?height:\s*(?:3[0-9]|4[0-3])px/);
    expect(list).toMatch(/\.product-list__mobileDiscoveryButton[\s\S]{0,80}?min-height:\s*44px/);
    expect(list).toMatch(/\.product-list__categoryButton[\s\S]{0,60}?min-height:\s*44px/);
    expect(cart).toMatch(/\.cart-page__quantityStepper \.ant-btn[\s\S]{0,80}?height:\s*48px/);
    expect(cart).not.toMatch(/\.cart-page__mobileItemBottom \.cart-page__quantityStepper \.ant-btn[\s\S]{0,160}?min-height:\s*44px/);
    expect(profile).toMatch(/\.profile-tabs__tab[\s\S]{0,60}?min-height:\s*44px/);
    expect(profile).toMatch(/\.profile-payment-modal__methodSelect[\s\S]{0,80}?min-height:\s*44px/);
  });

  
  
  
  it('keeps native mobile-app shell conversion rails commercially tappable at >=44px', () => {
    const mobile = readFrontend('mobile-app.css');
    // Native WebView shell must not regress search/nav/catalog conversion under 44.
    expect(mobile).toMatch(/body\.shop-mobile-app \.shop-nav__search \.shop-search-field[\s\S]{0,80}?height:\s*44px/);
    expect(mobile).not.toMatch(/body\.shop-mobile-app \.shop-nav__search \.shop-search-field\s*\{[\s\S]{0,60}?height:\s*(?:3[0-9]|4[0-3])px/);
    expect(mobile).toMatch(/body\.shop-mobile-app \.shop-nav__search \.shop-search-field__submit[\s\S]{0,80}?height:\s*44px/);
    expect(mobile).toMatch(/product-list__mobileConversionActions \.ant-btn[\s\S]{0,100}?min-height:\s*44px/);
    expect(mobile).not.toMatch(/product-list__mobileContextChip[\s\S]{0,80}?min-height:\s*34px/);
    expect(mobile).toMatch(/product-list__actionButton\.ant-btn[\s\S]{0,100}?min-height:\s*44px/);
    // cart launcher / action cluster square targets
    expect(mobile).not.toMatch(/shop-nav__cart-action[\s\S]{0,120}?height:\s*42px/);
  });

  it('keeps login auth conversion rails commercially tappable at >=44px', () => {
    const login = readFrontend('pages', 'Login.css');
    expect(login).toMatch(/\.shopee-login-codeButton[\s\S]{0,120}?height:\s*44px/);
    expect(login).toMatch(/\.shopee-login-quickLinks (?:a|button)[\s\S]{0,80}?min-height:\s*44px|\.shopee-login-quickLinks a,[\s\S]{0,80}?min-height:\s*44px/);
    expect(login).toMatch(/\.shopee-login-links a,[\s\S]{0,80}?min-height:\s*44px|\.shopee-login-links a,\s*\.shopee-login-links button[\s\S]{0,60}?min-height:\s*44px/);
    expect(login).toMatch(/\.shopee-login-tabs__tab[\s\S]{0,80}?min-height:\s*44px/);
    expect(login).toMatch(/\.shopee-login-tabs__tab[\s\S]{0,60}?min-height:\s*44px/);
    expect(login).not.toMatch(/\.shopee-login-codeButton[\s\S]{0,80}?height:\s*(?:3[0-9]|4[0-3])px/);
  });

  it('keeps footer and coupon conversion rails commercially tappable at >=44px', () => {
    const appCss = readFrontend('App.css');
    const antdTheme = readFrontend('styles', 'antd-theme-overrides.css');
    const couponCss = readFrontend('pages', 'CouponCenter.css');
    expect(appCss).toMatch(/\.shop-footer a,\s*\.shop-footer button[\s\S]{0,60}?min-height:\s*44px/);
    expect(appCss).toMatch(/\.shop-footer__columns a,\s*\.shop-footer__columns button[\s\S]{0,80}?min-height:\s*44px/);
    expect(antdTheme).toMatch(/\.support-order-select-popup \.ant-select-item[\s\S]{0,60}?min-height:\s*44px/);
    expect(couponCss).toMatch(/\.coupon-claim-section__search \.ant-input[\s\S]{0,120}?height:\s*44px/);
    expect(couponCss).toMatch(/\.coupon-claim-section__search \.ant-input\s*\{[\s\S]{0,80}?font-size:\s*16px/);
    expect(couponCss).toMatch(/\.coupon-claim-section__search \.ant-input,\s*\.coupon-claim-section__search\.ant-input-affix-wrapper \.ant-input\s*\{[\s\S]{0,120}?font-size:\s*16px\s*!important/);
    expect(couponCss).toMatch(/\.coupon-center-page__quickNav button[\s\S]{0,100}?min-height:\s*44px/);
    expect(couponCss).not.toMatch(/\.coupon-center-page__quickNav button[\s\S]{0,80}?height:\s*(?:3[0-9]|4[0-3])px/);
  });

  it('bundles Spanish home pack to avoid Mexico-first first-paint English flash', () => {
    const i18n = readFrontend('i18n.tsx');
    expect(i18n).toMatch(/import esLocale from '\.\/locales\/es\.json'/);
    expect(i18n).toContain('Spanish is the Mexico-first home pack');
    expect(i18n).toMatch(/es:\s*true/);
    expect(i18n).not.toMatch(/webpackChunkName:\s*["']i18n-es["']/);
  });


  it('keeps ShopMX commercial home language Spanish-first and payment mobile touch >=44px', () => {
    const i18n = readFrontend('i18n.tsx');
    const paymentCss = readFrontend('components', 'Payment.css');
    const checkoutCss = readFrontend('pages', 'Checkout.css');
    const indexHtml = readFrontend('..', 'public', 'index.html');
    // Mexico-first language seed aligned with MXN currency default
    expect(i18n).toMatch(/const home:\s*Language\s*=\s*detected === 'zh' \? 'zh' : 'es'/);
    expect(i18n).toContain("setLocalStorageItem(STORAGE_KEY, home)");
    expect(i18n).not.toMatch(/return timezone\.includes\('Mexico'\) \? 'es' : 'en'/);
    // payment modal must not shrink methods/confirm below 44 on mobile
    expect(paymentCss).not.toMatch(/\.payment-modal__method[\s\S]{0,80}?min-height:\s*40px/);
    expect(paymentCss).not.toMatch(/\.payment-modal__confirm[\s\S]{0,60}?min-height:\s*40px/);
    expect(paymentCss).toMatch(/\.payment-modal__method[\s\S]{0,80}?min-height:\s*44px/);
    expect(checkoutCss).toMatch(/\.checkout-page__sectionCard \.ant-input[\s\S]{0,200}?min-height:\s*44px/);
    expect(indexHtml).toContain('lang="es-MX"');
    expect(indexHtml).toContain('og:locale" content="es_MX"');
  });


  it('keeps high-traffic catalog/PDP/home storefront residual fonts >=12px', () => {
    const files = [
      ['pages', 'ProductDetail.css'],
      ['pages', 'ProductList.css'],
      ['pages', 'Home.css'],
      ['pages', 'Wishlist.css'],
      ['pages', 'CouponCenter.css'],
      ['mobile-app.css'],
    ];
    for (const parts of files) {
      const css = readFrontend(...parts);
      expect(css).not.toMatch(/font-size:\s*(?:9|10|11)px/);
    }
  });


  it('keeps storefront custom tablists keyboard-roving for commercial accessibility', () => {
    const productDetail = readProductDetailSurface();
    const profile = readProfileSurface();
    const shopTabs = readFrontend('components', 'ShopTabs.tsx');
    const util = readFrontend('utils', 'tablistKeyboard.ts');

    expect(util).toContain('resolveRovingTabIndex');
    expect(util).toContain('handleRovingTablistKeyDown');
    expect(util).toContain('ArrowLeft');
    expect(util).toContain('ArrowRight');
    expect(util).toContain('Home');
    expect(util).toContain('End');

    expect(productDetail).toContain('handleRovingTablistKeyDown');
    expect(productDetail).toContain('aria-orientation="horizontal"');
    expect(profile).toContain('handleRovingTablistKeyDown');
    expect(profile).toContain('aria-orientation="horizontal"');
    expect(shopTabs).toContain('handleRovingTablistKeyDown');
  });


  it('keeps ShopModal and ShopDrawer on commercial focus-trap semantics', () => {
    const modal = readFrontend('components', 'ShopModal.tsx');
    const drawer = readFrontend('components', 'ShopDrawer.tsx');
    const trap = readFrontend('utils', 'focusTrap.ts');

    expect(trap).toContain('activateFocusTrap');
    expect(trap).toContain('getFocusableElements');
    expect(trap).toContain("event.key !== 'Tab'");
    expect(trap).toContain('previouslyFocused.focus');

    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('data-shop-modal-initial-focus');
    expect(modal).toContain('activateFocusTrap');

    expect(drawer).toContain('aria-modal="true"');
    expect(drawer).toContain('data-shop-drawer-initial-focus');
    expect(drawer).toContain('activateFocusTrap');
    expect(drawer).toContain("tabIndex={-1}");
  });


  it('keeps product list mobile filter first-use guidance commercial-ready', () => {
    const productList = readProductListSurface();
    const css = readFrontend('pages', 'ProductList.css');
    const en = readFrontend('locales', 'en.json');
    const es = readFrontend('locales', 'es.json');
    const zh = readFrontend('locales', 'zh.json');

    expect(productList).toContain('data-product-list-filter-hint');
    expect(productList).toContain('openMobileFilterDrawer');
    expect(productList).toContain('pages.productList.mobileFilterHint');
    expect(css).toContain('product-list__filterHint');
    expect(css).toMatch(/product-list__filterHintDismiss[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/product-list__filterHintDismiss[\s\S]*?color:\s*#ffffff/);
    expect(css).toMatch(/\.product-list__filterHint[\s\S]*?position:\s*absolute/);
    expect(css).toMatch(/product-list__filterHintText[\s\S]*?-webkit-line-clamp:\s*3/);
    expect(css).toContain('empty catalog first-screen densify');
    expect(css).toMatch(/shop-cookie-consent-visible[\s\S]*?\.product-list--empty \.product-list__mobileDiscovery[\s\S]*?display:\s*none\s*!important/);
    expect(css).toMatch(/\.product-list--empty \.product-list__heroBand[\s\S]*?display:\s*none\s*!important/);
    expect(css).toMatch(/shop-cookie-consent-visible[\s\S]*?\.product-list--empty \.product-list__emptyDiscovery[\s\S]*?display:\s*none\s*!important/);
    expect(css).toMatch(/shop-cookie-consent-visible[\s\S]*?\.product-list--empty \.product-list__mobileConversionBar[\s\S]*?position:\s*fixed\s*!important/);
    expect(css).toMatch(/shop-cookie-consent-visible[\s\S]*?\.product-list--empty \.product-list__mobileConversionStats[\s\S]*?display:\s*none\s*!important/);
    expect(css).toContain('Commercial mobile catalog toolbar');
    expect(css).toMatch(/\.shop-app-shell--product-list \.product-list__toolbar \.product-list__toolbarRow[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(104px, auto\) !important/);
    expect(css).toMatch(/\.shop-app-shell--product-list \.product-list__toolbarSearch[\s\S]*?grid-column:\s*1 \/ -1 !important/);
    expect(css).toMatch(/\.shop-app-shell--product-list \.product-list__search \.shop-search-field__input[\s\S]*?min-width:\s*140px !important/);
    for (const locale of [en, es, zh]) {
      expect(locale).toContain('"mobileFilterHint"');
      expect(locale).toContain('"mobileFilterHintDismiss"');
    }
  });

});
