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

  it('keeps product detail empty recommendations on multipath commercial conversion exits', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain('data-product-detail-recommendations-empty');
    expect(productDetail).toContain('data-product-detail-recommendations-empty-actions');
    expect(productDetail).toContain('pages.productDetail.recommendationsEmpty');
    expect(productDetail).toContain("navigate('/coupons')");
    expect(productDetail).toContain("navigate('/pet-finder')");
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
    const app = readFrontend('App.css');

    expect(register).toContain('Commercial register mobile touch targets');
    expect(register).toContain('min-height: 44px !important');
    expect(support).toContain('Commercial support mobile touch targets');
    expect(support).toContain('customer-support-widget__headerClose.ant-btn');
    expect(support).toContain('min-height: 44px !important');
    expect(app).toContain('Commercial secondary text contrast');
    expect(app).toContain('rgba(16, 47, 34, 0.72)');
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

});
