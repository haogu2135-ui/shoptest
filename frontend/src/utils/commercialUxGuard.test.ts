import fs from 'fs';
import path from 'path';

const readFrontend = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

describe('commercial UX contracts', () => {
  it('keeps auth and checkout forms on realtime validation with required marks', () => {
    const register = readFrontend('pages', 'Register.tsx');
    const login = readFrontend('pages', 'Login.tsx');
    const checkout = readFrontend('pages', 'Checkout.tsx');

    expect(register).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(register).toContain('requiredMark');
    expect(login).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(login).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(checkout).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(checkout).toContain('requiredMark');

    const forgotPassword = readFrontend('pages', 'ForgotPassword.tsx');
    expect(forgotPassword).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(forgotPassword).toContain('requiredMark');
  });

  it('keeps product detail deep links for reviews/Q&A anchors', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain("id=\"product-reviews-card\"");
    expect(productDetail).toContain("id=\"product-qa-card\"");
    expect(productDetail).toContain("id=\"product-service-tabs\"");
    expect(productDetail).toContain("hash === 'reviews'");
    expect(productDetail).toContain("hash === 'qa'");
  });

  it('keeps storefront discovery infinite scroll screen-reader friendly', () => {
    const home = readFrontend('pages', 'Home.tsx');
    expect(home).toContain('home.discoveryShowing');
    expect(home).toContain('home.discoveryLoadMore');
    expect(home).toContain('aria-live="polite"');
    expect(home).toContain('role="list"');
    expect(home).toContain('role="listitem"');
  });

  it('keeps cart free-shipping progress and trust signals commercial-ready', () => {
    const cart = readFrontend('pages', 'Cart.tsx');
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
    const login = readFrontend('pages', 'Login.tsx');
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
    const cart = readFrontend('pages', 'Cart.tsx');
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
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
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
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
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
    const profile = readFrontend('pages', 'Profile.tsx');
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
    const profile = readFrontend('pages', 'Profile.tsx');
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
    const profile = readFrontend('pages', 'Profile.tsx');
    expect(profile).toContain('selectedPaymentFailed');
    expect(profile).toContain('selectedPaymentExpiredOrFailed');
    expect(profile).toContain('pages.checkout.paymentRecoveryFailed');
    expect(profile).toContain('pages.checkout.paymentRecoveryNextFailed');
    expect(profile).toContain('!selectedPaymentExpiredOrFailed');
  });

  it('keeps payment instructions sticky CTA and trust strip for mobile conversion', () => {
    const payment = readFrontend('pages', 'PaymentInstructions.tsx');
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
    const login = readFrontend('pages', 'Login.tsx');
    const forgotPassword = readFrontend('pages', 'ForgotPassword.tsx');
    const focusUtil = readFrontend('utils', 'formValidationFocus.ts');

    expect(focusUtil).toContain('export const focusFirstFormError');
    expect(focusUtil).toContain('ant-form-item-has-error');
    expect(checkout).toContain('focusFirstCheckoutValidationError');
    expect(checkout).toContain("focusFirstFormError({");
    expect(checkout).toContain("id=\"checkout-contact-card\"");
    expect(login).toContain('scrollFirstLoginErrorIntoView');
    expect(login).toContain('onFinishFailed');
    expect(forgotPassword).toContain('scrollFirstForgotPasswordErrorIntoView');
    expect(forgotPassword).toContain('data-forgot-password-unavailable');
    expect(forgotPassword).toContain('pages.auth.resetUnavailableTitle');
    expect(forgotPassword).toContain("navigate('/track-order')");
    expect(forgotPassword).toContain('onFinishFailed');
  });

  it('keeps wishlist empty state on multi-path commercial conversion CTAs', () => {
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
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
    const compare = readFrontend('pages', 'ProductCompare.tsx');
    const tracking = readFrontend('pages', 'OrderTracking.tsx');

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
    const tracking = readFrontend('pages', 'OrderTracking.tsx');
    expect(tracking).toContain('data-order-tracking-items-empty');
    expect(tracking).toContain('data-order-tracking-items-empty-actions');
    expect(tracking).toContain('pages.orderTracking.noOrderItemsHint');
    expect(tracking).toContain("navigate('/products')");
    expect(tracking).toContain("navigate('/coupons')");
    expect(tracking).toContain('shop:open-support');
  });


  it('keeps product detail recommendation load/empty states on multipath commercial recovery exits', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain('data-product-detail-recommendations-loading');
    expect(productDetail).toContain('data-product-detail-recommendations-empty');
    expect(productDetail).toContain('recommendationsLoading');
    expect(productDetail).toContain('recommendationsLoadFailed');
    expect(productDetail).toContain('pages.productDetail.recommendationsLoadFailed');
    expect(productDetail).toContain("navigate('/pet-finder')");
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
    const notifications = readFrontend('pages', 'Notifications.tsx');
    expect(notifications).toContain('data-notifications-filter-empty');
    expect(notifications).toContain('data-notifications-filter-empty-actions');
    expect(notifications).toContain('pages.notifications.noFilterResultsHint');
    expect(notifications).toContain("setQuickFilter('ALL')");
    expect(notifications).toContain("navigate('/coupons')");
    expect(notifications).toContain("navigate('/track-order')");
  });

  it('keeps coupon wallet filter empties on multipath commercial recovery exits', () => {
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    expect(coupons).toContain('data-coupon-wallet-filter-empty');
    expect(coupons).toContain('data-coupon-wallet-filter-empty-actions');
    expect(coupons).toContain('pages.coupons.walletFilteredEmptyHint');
    expect(coupons).toContain("setWalletFilter('all')");
    expect(coupons).toContain("navigate('/cart')");
    expect(coupons).toContain("navigate('/pet-finder')");
  });

  it('keeps profile payment-history empty on multipath commercial recovery exits', () => {
    const profile = readFrontend('pages', 'Profile.tsx');
    expect(profile).toContain('data-profile-payment-history-empty');
    expect(profile).toContain('data-profile-payment-history-empty-actions');
    expect(profile).toContain('pages.profile.noPaymentHistoryHint');
    expect(profile).toContain("navigate('/track-order')");
    expect(profile).toContain("navigate('/coupons')");
    expect(profile).toContain('shop:open-support');
  });

  it('keeps recovery empty states on multi-path commercial CTAs', () => {
    const stock = readFrontend('pages', 'StockAlerts.tsx');
    const notifications = readFrontend('pages', 'Notifications.tsx');
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
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
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
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    const notFound = readFrontend('pages', 'NotFound.tsx');
    const profile = readFrontend('pages', 'Profile.tsx');
    const cart = readFrontend('pages', 'Cart.tsx');

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
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    const register = readFrontend('pages', 'Register.tsx');

    expect(checkout).toContain('checkout-page__mobilePayBar');
    expect(checkout).toContain('role="region"');
    expect(checkout).toContain('pages.checkout.mobilePayBarTrust');
    expect(checkout).toContain('data-checkout-payment-unavailable-recovery');
    expect(checkout).toContain('data-checkout-payment-unavailable');
    expect(checkout).toContain('paymentUnavailableRecoveryActions');
    expect(checkout).toContain('pages.checkout.paymentUnavailable');
    expect(checkout).toContain("navigate('/products')");
    expect(checkout).toContain("navigate('/coupons')");
    expect(checkout).toContain("navigate('/cart')");
    expect(checkout).toContain("navigate('/cart')");
    expect(checkoutCss).toContain('paymentUnavailableActions');
    expect(checkoutCss).toMatch(/paymentUnavailableActions[\s\S]*?min-height:\s*44px/);
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
    expect(cart).toMatch(/\.cart-page__mobileItemBottom \.cart-page__quantityStepper \.ant-btn[\s\S]*?min-height:\s*44px/);
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

  it('keeps register and support surfaces on commercial mobile touch targets with readable secondary text', () => {
    const register = readFrontend('pages', 'Register.css');
    const support = readFrontend('components', 'CustomerSupportWidget.css');
    const antdTheme = readFrontend('styles', 'antd-theme-overrides.css');

    expect(register).toContain('Commercial register mobile touch targets');
    expect(register).toContain('min-height: 44px !important');
    expect(support).toContain('Commercial support mobile touch targets');
    expect(support).toContain('customer-support-widget__headerClose.ant-btn');
    expect(support).toContain('min-height: 44px !important');
    // Secondary AntD text contrast ships with deferred theme overrides (not shell App.css).
    expect(antdTheme).toContain('Commercial secondary text contrast');
    expect(antdTheme).toContain('rgba(16, 47, 34, 0.72)');
  });


  it('keeps auth password fields on accessible visibility toggles', () => {
    const login = readFrontend('pages', 'Login.tsx');
    const register = readFrontend('pages', 'Register.tsx');
    const forgot = readFrontend('pages', 'ForgotPassword.tsx');

    expect(login).toContain('iconRender={(visible) => (');
    expect(login).toContain('aria-pressed={visible}');
    expect(login).toContain("pages.auth.showPassword");
    expect(register).toContain('iconRender={(visible) => (');
    expect(register).toContain('aria-pressed={visible}');
    expect(forgot).toContain('iconRender={(visible) => (');
    expect(forgot).toContain('aria-pressed={visible}');
  });


  it('keeps order tracking lookup on commercial validation and 44px touch targets', () => {
    const tracking = readFrontend('pages', 'OrderTracking.tsx');
    const trackingCss = readFrontend('pages', 'OrderTracking.css');

    expect(tracking).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(tracking).toContain('requiredMark');
    expect(tracking).toContain('focusFirstFormError');
    expect(tracking).toContain("rootSelector: '.order-tracking-page__lookupCard'");
    expect(tracking).toContain('onFinishFailed');
    expect(trackingCss).toContain('Commercial order-tracking mobile touch targets');
    expect(trackingCss).toMatch(/\.order-tracking-page \.ant-btn[\s\S]*?min-height:\s*44px/);
    expect(trackingCss).toContain('paymentReturnActions');
    expect(trackingCss).toMatch(/paymentReturnActions[\s\S]*?min-height:\s*44px/);
    expect(tracking).toContain('data-order-tracking-payment-return-recovery');
  });


  it('keeps profile account forms on commercial validation focus and password a11y', () => {
    const profile = readFrontend('pages', 'Profile.tsx');
    const profileCss = readFrontend('pages', 'Profile.css');

    expect(profile).toContain('focusFirstFormError');
    expect(profile).toContain('focusProfileModalFormError');
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

    expect(checkout).toContain('checkout-page__legalNotice');
    expect(checkout).toContain('pages.checkout.orderAgreementPrefix');
    expect(checkout).toContain("to=\"/terms\"");
    expect(checkout).toContain("to=\"/privacy\"");
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
    const register = readFrontend('pages', 'Register.tsx');
    const login = readFrontend('pages', 'Login.tsx');
    const loginCss = readFrontend('pages', 'Login.css');
    const app = readFrontend('App.tsx');

    expect(consent).toContain('COOKIE_CONSENT_STORAGE_KEY');
    expect(consent).toContain('acceptCookieConsent');
    expect(banner).toContain('cookie-consent-banner');
    expect(banner).toContain('cookieConsent.acceptAll');
    expect(banner).toContain('cookieConsent.acceptEssential');
    expect(banner).toContain("to=\"/privacy\"");
    expect(bannerCss).toContain('Commercial cookie consent mobile touch targets');
    expect(banner).toContain('shop-cookie-consent-visible');
    expect(banner).toContain('--shop-cookie-consent-clearance');
    expect(banner).toContain('data-cookie-consent-visible');
    expect(bannerCss).toContain('shop-cookie-consent-visible');
    expect(bannerCss).toContain('--shop-cookie-consent-clearance');
    expect(bannerCss).toContain('product-mobile-buybar');
    expect(bannerCss).toContain('cart-page__summary');
    expect(bannerCss).toContain('cart-drawer__footer');
    expect(bannerCss).toContain('checkout-page__submitReview');
    expect(bannerCss).toContain('shop-nav__bottomBar');
    expect(bannerCss).toContain('customer-support-widget__button');
    expect(bannerCss).toContain('customer-support-widget__panel');
    expect(bannerCss).toContain('product-list__mobileConversionBar');
    expect(bannerCss).toContain('product-list__backToTop');

    expect(bannerCss).toContain('min-height: 44px');
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
    const app = readFrontend('App.tsx');
    expect(app).toContain("shop-app-shell--product-detail");
    expect(navCss).toMatch(/\.shop-app-shell--product-detail \.shop-nav__bottomBar[\s\S]*?display:\s*none/);
  });


  it('keeps guest wishlist multi-path auth gate conversion rails', () => {
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
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
    const notifications = readFrontend('pages', 'Notifications.tsx');
    const notificationsCss = readFrontend('pages', 'Notifications.css');
    const register = readFrontend('pages', 'Register.tsx');
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
    const profile = readFrontend('pages', 'Profile.tsx');
    const profileCss = readFrontend('pages', 'Profile.css');
    const app = readFrontend('App.tsx');
    expect(app).toContain('<Route path="profile" element={<Profile />} />');
    expect(profile).toContain('profile-page__authGate');
    expect(profile).toContain('pages.profile.authGateTitle');
    expect(profile).toContain("buildLoginUrl('/profile')");
    expect(profileCss).toContain('Commercial guest profile auth gate multi-path conversion');
  });


  it('keeps product detail load failures on multipath commercial recovery exits', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
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
    const register = readFrontend('pages', 'Register.tsx');
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
    const home = readFrontend('pages', 'Home.tsx');
    const history = readFrontend('pages', 'BrowsingHistory.tsx');
    const notifications = readFrontend('pages', 'Notifications.tsx');
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    const compare = readFrontend('pages', 'ProductCompare.tsx');
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
    const cart = readFrontend('pages', 'Cart.tsx');
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    const profile = readFrontend('pages', 'Profile.tsx');
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    const stockAlerts = readFrontend('pages', 'StockAlerts.tsx');
    const petGallery = readFrontend('pages', 'PetGallery.tsx');
    const orderTracking = readFrontend('pages', 'OrderTracking.tsx');
    expect(cart).toContain('data-cart-load-recovery');
    expect(checkout).toContain('data-checkout-load-recovery');
    expect(wishlist).toContain('data-wishlist-load-recovery');
    expect(profile).toContain('data-profile-orders-load-recovery');
    expect(profile).toContain('data-profile-addresses-load-recovery');
    expect(coupons).toContain('data-coupon-load-recovery');
    expect(stockAlerts).toContain('data-stock-alerts-load-recovery');
    expect(petGallery).toContain('data-pet-gallery-load-recovery');
    expect(orderTracking).toContain('data-order-tracking-lookup-recovery');
    for (const source of [cart, checkout, wishlist, profile, coupons, stockAlerts, petGallery, orderTracking]) {
      expect(source).toContain('actions={[');
      expect(source).toContain("shop:open-support");
    }
  });


  it('keeps checkout empty and payment guest-email gates on multipath commercial recovery exits', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const payment = readFrontend('pages', 'PaymentInstructions.tsx');
    expect(checkout).toContain('data-checkout-empty-actions');
    expect(checkout).toContain("navigate('/pet-finder')");
    expect(checkout).toContain("navigate('/coupons')");
    expect(checkout).toContain("navigate('/history')");
    expect(checkout).toContain('data-checkout-load-recovery');
    expect(payment).toContain('data-payment-guest-email-gate');
    expect(payment).toContain('data-payment-guest-email-recovery');
    expect(payment).toContain("navigate('/products')");
    expect(payment).toContain("navigate('/coupons')");
    expect(payment).toContain('openSupport');
    expect(payment).toContain('openTrackOrder');
  });

    it('keeps order tracking not-shipped logistics on multipath commercial recovery exits', () => {
    const orderTracking = readFrontend('pages', 'OrderTracking.tsx');
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
    const forgot = readFrontend('pages', 'ForgotPassword.tsx');
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
    const home = readFrontend('pages', 'Home.tsx');
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
    const home = readFrontend('pages', 'Home.tsx');
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
    const home = readFrontend('pages', 'Home.tsx');
    expect(home).toContain('home-empty-categories');
    expect(home).toContain('home-empty-products');
    expect(home).toContain('data-home-empty-categories');
    expect(home).toContain('data-home-empty-products');
    expect(home).toContain("navigate('/pet-finder')");
    expect(home).toContain("navigate('/track-order')");
    expect(home).toContain("navigate('/coupons')");
  });

    it('keeps product list zero-results empty on multipath commercial recovery exits', () => {
    const productList = readFrontend('pages', 'ProductList.tsx');
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
    const productList = readFrontend('pages', 'ProductList.tsx');
    expect(productList).toContain('data-product-list-load-recovery');
    expect(productList).toContain('pages.productList.loadRecoveryCoupons');
    expect(productList).toContain('pages.productList.loadRecoverySupport');
    expect(productList).toContain('actions={[');
    expect(productList).toContain('openSupport');
  });

  it('keeps storefront payment links on current shopping origin for multi-host conversion', () => {
    const recovery = readFrontend('utils', 'paymentRecovery.ts');
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const paymentInstructions = readFrontend('pages', 'PaymentInstructions.tsx');
    const orderTracking = readFrontend('pages', 'OrderTracking.tsx');
    const profile = readFrontend('pages', 'Profile.tsx');
    expect(recovery).toContain('resolveCommercialPaymentNavigationUrl');
    expect(recovery).toContain('navigateToCommercialPaymentUrl');
    expect(recovery).toContain('isStorefrontPaymentPath');
    expect(recovery).toContain('pet.686888666.xyz');
    expect(recovery).toContain('.trycloudflare.com');
    expect(checkout).toContain('navigateToCommercialPaymentUrl');
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
    const cart = readFrontend('pages', 'Cart.tsx');
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    const tracking = readFrontend('pages', 'OrderTracking.tsx');
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    const homeCss = readFrontend('pages', 'Home.css');
    const listCss = readFrontend('pages', 'ProductList.css');
    // Native h1 densification (no ant Typography Title runtime).
    expect(cart).toContain("<h1 className=\"cart-page__title\">{t('pages.cart.title')}</h1>");
    expect(cart).toContain("<h1 className=\"cart-page__title\">{t('pages.cart.empty')}</h1>");
    expect(cart).toMatch(/role="status"[\s\S]*?<h1 className="cart-page__title">\{t\('pages\.cart\.title'\)\}<\/h1>/);
    expect(cart).toMatch(/<h1 className="cart-page__title">\{t\('pages\.cart\.title'\)\}<\/h1>[\s\S]*?data-cart-load-recovery="true"/);
    expect(checkout).toContain("<h1 className=\"checkout-page__title\">{t('pages.checkout.title')}</h1>");
    expect(checkout).toMatch(/checkout-page--loading[\s\S]*?<h1 className="checkout-page__title">\{t\('pages\.checkout\.title'\)\}<\/h1>/);
    expect(checkout).toMatch(/<h1 className="checkout-page__title">\{t\('pages\.checkout\.title'\)\}<\/h1>[\s\S]*?data-checkout-load-recovery="true"/);
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
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain('sold-out SKUs must never claim "ready to add"');
    expect(productDetail).toMatch(/ready:\s*!isOutOfStock\s*&&\s*!purchaseSelectionBlocked/);
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
    const login = readFrontend('pages', 'Login.tsx');
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
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain('never mark options "ready to add" when the SKU is sold out');
    expect(productDetail).toMatch(/ready:\s*!isOutOfStock\s*&&/);
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
    const pdp = readFrontend('pages', 'ProductDetail.tsx');
    const pdpCss = readFrontend('pages', 'ProductDetail.css');
    expect(pdp).toContain('product-detail__soldOutTag');
    expect(pdp).toContain('product-detail__wishlistIcon--active');
    expect(pdp).toContain('product-detail-page__title--qa');
    expect(pdp).not.toMatch(/product-detail__soldOutTag[\s\S]{0,40}style=\{\{/);
    expect(pdpCss).toContain('Commercial PDP: sold-out chip');
  });

  it('keeps wishlist header icon on CSS without inline color/size', () => {
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    const wishlistCss = readFrontend('pages', 'Wishlist.css');
    expect(wishlist).toContain('wishlist-page__headerIcon');
    expect(wishlist).not.toMatch(/wishlist-page__headerIcon[\s\S]{0,40}style=\{\{/);
    expect(wishlistCss).toContain('wishlist-page__headerIcon');
  });

  it('keeps home category skeleton title off inline geometry', () => {
    const home = readFrontend('pages', 'Home.tsx');
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
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    const profile = readFrontend('pages', 'Profile.tsx');
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
    const notifications = readFrontend('pages', 'Notifications.tsx');
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    const compare = readFrontend('pages', 'ProductCompare.tsx');
    const stock = readFrontend('pages', 'StockAlerts.tsx');
    const notFound = readFrontend('pages', 'NotFound.tsx');
    const forgot = readFrontend('pages', 'ForgotPassword.tsx');
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
    const payment = readFrontend('components', 'Payment.tsx');
    const mobileApp = readFrontend('mobile-app.css');
    const searchBar = readFrontend('components', 'SearchBar.css');
    const pdp = readFrontend('pages', 'ProductDetail.css');
    expect(paymentMethods).toContain('filterPaymentChannelsForMarket');
    expect(paymentMethods).toContain("currency === 'MXN'");
    expect(paymentMethods).toMatch(/hideForeign && market === 'CN'/);
    expect(checkout).toMatch(/createPaymentMethodDetails\(paymentChannels,\s*\{\s*currency\s*\}\)/);
    // Recommendation + bootstrap resolve must use market-filtered rails (not raw API list).
    expect(checkout).toContain('filterPaymentChannelsForMarket');
    expect(checkout).toMatch(/filterPaymentChannelsForMarket\(channels,\s*\{\s*currency\s*\}\)/);
    expect(checkout).toMatch(/paymentMethodDetails\.some\(\s*\(method\)\s*=>\s*method\.value === normalizedPaymentMethod\s*\)/);
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
    expect(market).toContain("const home: CurrencyCode = 'MXN'");
    expect(market).toContain('writeStoredCurrency(home)');
    // residual 9-11px primary floors should be closed on conversion CSS
    for (const css of [checkoutCss, cartCss, supportCss, paymentCss]) {
      expect(css).not.toMatch(/font-size:\s*(?:9|10|11)px/);
    }
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
    const list = readFrontend('pages', 'ProductList.css');
    const cart = readFrontend('pages', 'Cart.css');
    const profile = readFrontend('pages', 'Profile.css');
    expect(home).toMatch(/\.shopee-hero__categoryRail button[\s\S]{0,80}?min-height:\s*44px/);
    expect(home).toMatch(/\.shopee-product__quickActions button[\s\S]{0,80}?height:\s*44px/);
    expect(home).toMatch(/\.shopee-section__header button[\s\S]{0,80}?min-height:\s*44px/);
    expect(list).toMatch(/\.product-list__actionButton\.ant-btn[\s\S]{0,120}?min-height:\s*44px/);
    expect(list).not.toMatch(/\.product-list__actionButton\.ant-btn[\s\S]{0,80}?height:\s*(?:3[0-9]|4[0-3])px/);
    expect(list).toMatch(/\.product-list__mobileDiscoveryButton[\s\S]{0,80}?min-height:\s*44px/);
    expect(list).toMatch(/\.product-list__categoryButton[\s\S]{0,60}?min-height:\s*44px/);
    expect(cart).toMatch(/\.cart-page__quantityStepper \.ant-btn[\s\S]{0,80}?height:\s*44px/);
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
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    const profile = readFrontend('pages', 'Profile.tsx');
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
    const productList = readFrontend('pages', 'ProductList.tsx');
    const css = readFrontend('pages', 'ProductList.css');
    const en = readFrontend('locales', 'en.json');
    const es = readFrontend('locales', 'es.json');
    const zh = readFrontend('locales', 'zh.json');

    expect(productList).toContain('data-product-list-filter-hint');
    expect(productList).toContain('openMobileFilterDrawer');
    expect(productList).toContain('pages.productList.mobileFilterHint');
    expect(css).toContain('product-list__filterHint');
    expect(css).toMatch(/product-list__filterHintDismiss[\s\S]*?min-height:\s*32px/);
    for (const locale of [en, es, zh]) {
      expect(locale).toContain('"mobileFilterHint"');
      expect(locale).toContain('"mobileFilterHintDismiss"');
    }
  });

});
