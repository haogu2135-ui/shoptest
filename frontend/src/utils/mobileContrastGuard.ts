const STYLE_ID = 'shop-mobile-contrast-guard';

const CONTRAST_GUARD_CSS = `
body.shop-mobile-app {
  --app-contrast-panel: #ffffff;
  --app-contrast-panel-soft: #fbfdfb;
  --app-contrast-control: #ffffff;
  --app-contrast-ink: #102f22;
  --app-contrast-muted: #3f5147;
  --app-contrast-primary: #124734;
  --app-contrast-on-dark: #ffffff;
  --app-contrast-warn: #7a3a18;
  --app-contrast-danger: #8f2d17;
  --app-contrast-line: rgba(18, 71, 52, 0.22);
  --app-contrast-shadow: 0 12px 24px rgba(18, 71, 52, 0.08);
}

body.shop-mobile-app .shop-app-shell :is(
  .ant-card,
  .ant-card-body,
  .ant-card-head,
  .ant-list,
  .ant-list-item,
  .ant-alert,
  .ant-collapse,
  .ant-collapse-content,
  .ant-descriptions,
  .ant-empty,
  .ant-result,
  .ant-statistic,
  .ant-table,
  .ant-table-wrapper,
  .ant-tabs,
  .ant-tabs-content-holder,
  .shopee-product,
  .shopee-mobile-priority,
  .shopee-mobile-quick-panel,
  .shopee-home-actions,
  .shopee-conversion-band,
  .shopee-conversion-band__card,
  .shopee-conversion-strip,
  .shopee-conversion-strip__item,
  .shopee-coupon-entry,
  .shopee-categories button,
  .product-list__card,
  .product-list__toolbar,
  .product-list__mobileContextChip,
  .product-list__mobileDiscoveryButton,
  .product-list__mobileNextStep,
  .product-list__mobileConversionBar,
  .cart-page__mobileItem,
  .cart-page__summary,
  .cart-page__summaryStripCard,
  .cart-page__bulkActions,
  .cart-page__readiness,
  .cart-page__confidencePanel,
  .cart-page__confidenceItem,
  .cart-page__nextAction,
  .cart-page__recentRecovery,
  .cart-page__recentItem,
  .cart-page__savedCard,
  .cart-page__savedItem,
  .checkout-page__sectionCard,
  .checkout-page__summaryStripCard,
  .checkout-page__expressCard,
  .checkout-page__paymentMethod,
  .checkout-page__benefitStrip,
  .checkout-page__benefitItem,
  .checkout-page__savingsCoach,
  .checkout-page__couponOpportunity,
  .checkout-page__readiness,
  .checkout-page__item,
  .checkout-page__addressOption,
  .checkout-page__addressChoice,
  .checkout-page__mobilePayBar,
  .coupon-center-page__quickNav,
  .coupon-center-page__mobileActionBar,
  .coupon-center-page__statCard,
  .coupon-center-page__heroBadge,
  .coupon-center-page__heroPlan,
  .coupon-section-header,
  .coupon-priority-card,
  .coupon-guidance-grid,
  .coupon-savings-path,
  .coupon-next-action,
  .coupon-claim-section,
  .coupon-claim-section__controls,
  .coupon-claim-section__toolbar,
  .coupon-claim-section__toolbar > div,
  .coupon-claim-section__notice,
  .coupon-claim-section__claimResult,
  .coupon-claim-section__activeContext,
  .coupon-claim-section__resultSummary,
  .coupon-claim-section__resultMetric,
  .coupon-claim-section__empty,
  .coupon-claim-section__filterButton,
  .coupon-center-page__couponCard,
  .coupon-center-page__coupon,
  .coupon-center-page__couponFit,
  .coupon-center-page__couponDetails,
  .coupon-center-page__couponMicroFacts,
  .coupon-wallet,
  .coupon-wallet__coupon,
  .coupon-wallet__summary,
  .coupon-wallet__guide,
  .coupon-wallet__filters,
  .coupon-wallet__fit,
  .coupon-wallet__quickFact,
  .coupon-wallet__expiryPill,
  .coupon-wallet__closedAction,
  .profile-action-center,
  .profile-action-center__intro,
  .profile-action-center__card,
  .profile-tabs > .ant-tabs-nav,
  .profile-mobile-entry__item,
  .profile-section-card,
  .profile-address-card,
  .profile-order-card,
  .profile-orders__toolbar,
  .profile-orders__tab,
  .profile-order-card__top,
  .profile-order-card__amount,
  .profile-order-card__paid,
  .profile-order-card__next,
  .profile-order-item,
  .profile-order-item__imageButton,
  .profile-pet-next-step,
  .profile-pet-shop-path,
  .profile-address-readiness,
  .profile-address-readiness__stats span,
  .profile-after-sale-panel,
  .profile-after-sale-panel__metrics button,
  .profile-order-card__summary,
  .profile-order-card__item,
  .profile-order-flow,
  .profile-flow-focus,
  .profile-flow-focus__value,
  .profile-order-flow__step,
  .profile-flow-actions__card,
  .profile-payment-recommend,
  .profile-payment-recommend__chip,
  .profile-email-code-warning,
  .profile-payment-card,
  .profile-return-card,
  .wishlist-page__insightBar,
  .wishlist-page__recovery,
  .wishlist-page__readiness,
  .wishlist-page__nextAction,
  .wishlist-page__bestPick,
  .wishlist-page__card,
  .stock-alerts__assistant,
  .stock-alerts__signal,
  .stock-alerts__recovery,
  .stock-alerts__nextAction,
  .stock-alerts__mobileAction,
  .notifications-page__actionPlan,
  .notifications-page__card,
  .customer-support-widget__panel
),
body.shop-mobile-app :is(
  .cart-drawer,
  .cart-drawer .ant-drawer-content,
  .cart-drawer .ant-drawer-header,
  .cart-drawer .ant-drawer-body,
  .cart-drawer .ant-drawer-footer,
  .profile-mobile-safe-modal .ant-modal-content,
  .profile-mobile-safe-modal .ant-modal-header,
  .profile-mobile-safe-modal .ant-modal-body,
  .profile-mobile-safe-modal .ant-modal-footer,
  .profile-payment-modal .ant-modal-content,
  .profile-payment-modal .ant-modal-header,
  .profile-payment-modal .ant-modal-body,
  .profile-payment-modal .ant-modal-footer,
  .profile-order-detail-modal .ant-modal-content,
  .profile-order-detail-modal .ant-modal-header,
  .profile-order-detail-modal .ant-modal-body,
  .profile-order-detail-modal .ant-modal-footer,
  .profile-address-modal .ant-modal-content,
  .profile-address-modal .ant-modal-header,
  .profile-address-modal .ant-modal-body,
  .profile-address-modal .ant-modal-footer,
  .ant-modal-content,
  .ant-modal-header,
  .ant-modal-footer,
  .ant-drawer-content,
  .ant-drawer-header,
  .ant-drawer-body,
  .ant-drawer-footer,
  .ant-popover-inner,
  .ant-dropdown-menu,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown .ant-picker-panel-container,
  .ant-message-notice-content,
  .ant-notification-notice
) {
  border-color: var(--app-contrast-line) !important;
  background: var(--app-contrast-panel-soft) !important;
  color: var(--app-contrast-ink) !important;
  box-shadow: var(--app-contrast-shadow) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .ant-card,
  .ant-card-body,
  .ant-card-head,
  .ant-list,
  .ant-list-item,
  .ant-alert,
  .ant-collapse,
  .ant-collapse-content,
  .ant-descriptions,
  .ant-empty,
  .ant-result,
  .ant-statistic,
  .ant-table,
  .ant-table-wrapper,
  .ant-tabs,
  .ant-tabs-content-holder,
  .cart-page,
  .checkout-page,
  .coupon-center-page,
  .profile-page,
  .wishlist-page,
  .stock-alerts,
  .stock-alerts-page,
  .notifications-page,
  .customer-support-widget__panel
) :where(
  .ant-typography,
  .ant-card-meta-title,
  .ant-card-head-title,
  .ant-list-item-meta-title,
  .ant-descriptions-title,
  .ant-descriptions-item-label,
  .ant-descriptions-item-content,
  .ant-empty-description,
  .ant-form-item-label > label,
  .ant-form-item-extra,
  .ant-form-item-explain,
  .ant-progress-text,
  .ant-result-title,
  .ant-result-subtitle,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-statistic-content-prefix,
  .ant-statistic-content-suffix,
  .ant-statistic-content-value,
  .ant-steps-item-title,
  .ant-steps-item-description,
  .ant-table-cell,
  .ant-timeline-item-content,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  small,
  strong,
  em,
  b,
  a,
  span:not(.anticon):not(.ant-badge-count):not(.ant-scroll-number):not(.ant-progress-text)
),
body.shop-mobile-app :is(
  .cart-drawer,
  .profile-mobile-safe-modal,
  .profile-payment-modal,
  .profile-order-detail-modal,
  .profile-address-modal,
  .ant-modal-content,
  .ant-drawer-content,
  .ant-popover-inner,
  .ant-dropdown-menu,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown .ant-picker-panel-container,
  .ant-message-notice-content,
  .ant-notification-notice
) :where(
  .ant-drawer-title,
  .ant-modal-title,
  .ant-typography,
  .ant-card-meta-title,
  .ant-list-item-meta-title,
  .ant-descriptions-title,
  .ant-descriptions-item-label,
  .ant-descriptions-item-content,
  .ant-form-item-label > label,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-statistic-content-value,
  .ant-select-item-option-content,
  .ant-cascader-menu-item,
  h1,
  h2,
  h3,
  h4,
  p,
  label,
  small,
  strong,
  em,
  b,
  a,
  span:not(.anticon):not(.ant-badge-count):not(.ant-scroll-number)
) {
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app .shop-app-shell :where(
  .ant-typography-secondary,
  .ant-card-meta-description,
  .ant-list-item-meta-description,
  .ant-form-item-extra,
  .ant-form-item-explain,
  .ant-table-column-sorter,
  .ant-table-filter-trigger,
  .cart-drawer__shippingStatus,
  .cart-drawer__shippingGift,
  .cart-drawer__footerHint,
  .profile-payment-history__time
),
body.shop-mobile-app :is(
  .cart-drawer,
  .profile-mobile-safe-modal,
  .profile-payment-modal,
  .profile-order-detail-modal,
  .profile-address-modal,
  .ant-modal-content,
  .ant-drawer-content
) :where(
  .ant-typography-secondary,
  .ant-card-meta-description,
  .ant-list-item-meta-description
) {
  color: var(--app-contrast-muted) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shopee-hero__main,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .order-tracking-page__journey,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .pet-gallery-conversion
) {
  background: linear-gradient(135deg, rgba(18, 71, 52, 0.99), rgba(18, 71, 52, 0.92) 56%, rgba(238, 77, 45, 0.78)) !important;
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shopee-hero__main,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .order-tracking-page__journey,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .pet-gallery-conversion
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-card-meta-title,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  small,
  strong,
  em,
  b,
  a,
  .anticon,
  span:not(.ant-badge-count):not(.ant-scroll-number)
) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shop-nav__bottomItem--active,
  .profile-action-center__card--pay,
  .profile-action-center__card--return,
  .profile-mobile-entry__item--active,
  .profile-orders__tab--active,
  .profile-payment-recommend__chip.is-active,
  .profile-flow-focus.is-ready,
  .profile-order-flow__step--done,
  .profile-order-card__next--done,
  .profile-order-card__next--success,
  .profile-address-readiness__stats span:first-child,
  .profile-after-sale-panel__metrics button,
  .profile-after-sale-panel__metrics button,
  .coupon-claim-section__filterButton--active,
  .coupon-wallet__filter--active,
  .coupon-center-page__couponReady,
  .coupon-center-page__couponFit--ready,
  .coupon-wallet__fit--ready,
  .cart-page__nextAction--ready,
  .cart-page__confidenceItem--ready,
  .cart-page__checkoutPathStep--ready > span:first-child,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="is-active"],
  [class*="is-ready"]
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary:hover,
  .ant-btn-primary:focus,
  .ant-btn-primary:active,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .cart-drawer__shippingIcon--ready,
  .cart-drawer__nextAction--ready .cart-drawer__nextActionIcon
) {
  border-color: rgba(255, 247, 240, 0.28) !important;
  background: var(--app-contrast-primary) !important;
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shop-nav__bottomItem--active,
  .profile-action-center__card--pay,
  .profile-action-center__card--return,
  .profile-mobile-entry__item--active,
  .profile-orders__tab--active,
  .profile-payment-recommend__chip.is-active,
  .profile-flow-focus.is-ready,
  .profile-order-flow__step--done,
  .profile-order-card__next--done,
  .profile-order-card__next--success,
  .profile-address-readiness__stats span:first-child,
  .profile-after-sale-panel__metrics button,
  .coupon-claim-section__filterButton--active,
  .coupon-wallet__filter--active,
  .coupon-center-page__couponReady,
  .coupon-center-page__couponFit--ready,
  .coupon-wallet__fit--ready,
  .cart-page__nextAction--ready,
  .cart-page__confidenceItem--ready,
  .cart-page__checkoutPathStep--ready,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="is-active"],
  [class*="is-ready"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-progress-text,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  .anticon
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary *,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-switch-checked *,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .cart-drawer__shippingIcon--ready,
  .cart-drawer__nextAction--ready .cart-drawer__nextActionIcon
) :where(span, strong, small, .anticon) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app :where(
  .ant-input,
  .ant-input-affix-wrapper,
  .ant-input-number,
  .ant-input-number-input,
  .ant-input-group-addon,
  .ant-picker,
  .ant-picker-input > input,
  .ant-select-selector,
  .ant-select-selection-item,
  .ant-select-selection-placeholder,
  .ant-select-item,
  .ant-cascader-menu,
  .ant-cascader-menu-item,
  .ant-segmented,
  .ant-segmented-item,
  .ant-radio-button-wrapper,
  .ant-checkbox-wrapper,
  textarea.ant-input
) {
  background: var(--app-contrast-control) !important;
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where(
  .ant-tag,
  .ant-tag-default,
  .ant-tag-green,
  .ant-tag-success,
  .ant-tag-blue,
  .ant-tag-cyan,
  .ant-tag-purple,
  .ant-tag-geekblue,
  .ant-tag-gold,
  .ant-tag-warning,
  .ant-tag-orange,
  .ant-tag-volcano,
  .ant-tag-magenta,
  .ant-tag-red,
  .ant-tag-error
) {
  border-color: rgba(18, 71, 52, 0.22) !important;
  background: #fff4e8 !important;
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where(.ant-tag-gold, .ant-tag-warning, .ant-tag-orange) {
  background: #fff1df !important;
  color: var(--app-contrast-warn) !important;
}

body.shop-mobile-app :where(.ant-tag-red, .ant-tag-error, .ant-tag-volcano) {
  background: #ffe5da !important;
  color: var(--app-contrast-danger) !important;
}

body.shop-mobile-app :where(
  .ant-tag,
  .ant-tag-default,
  .ant-tag-green,
  .ant-tag-success,
  .ant-tag-blue,
  .ant-tag-cyan,
  .ant-tag-purple,
  .ant-tag-geekblue,
  .ant-tag-gold,
  .ant-tag-warning,
  .ant-tag-orange,
  .ant-tag-volcano,
  .ant-tag-magenta,
  .ant-tag-red,
  .ant-tag-error
) :where(span, strong, small, .anticon) {
  color: inherit !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shop-nav__bottomItem--active,
  .profile-action-center__card--pay,
  .profile-action-center__card--return,
  .profile-mobile-entry__item--active,
  .profile-orders__tab--active,
  .profile-payment-recommend__chip.is-active,
  .profile-flow-focus.is-ready,
  .profile-order-card__next--done,
  .profile-order-card__next--success,
  .profile-address-readiness__stats span:first-child,
  .profile-after-sale-panel__metrics button,
  .coupon-claim-section__filterButton--active,
  .coupon-wallet__filter--active,
  .coupon-center-page__couponReady,
  .coupon-center-page__couponFit--ready,
  .coupon-wallet__fit--ready,
  .cart-page__nextAction--ready,
  .cart-page__confidenceItem--ready,
  .cart-page__checkoutPathStep--ready > span:first-child,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="is-active"],
  [class*="is-ready"]
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary:hover,
  .ant-btn-primary:focus,
  .ant-btn-primary:active,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-dropdown-menu-item-active,
  .ant-dropdown-menu-item-selected,
  .ant-select-item-option-active,
  .ant-select-item-option-selected,
  .ant-cascader-menu-item-active,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner
) {
  border-color: rgba(255, 247, 240, 0.28) !important;
  background: var(--app-contrast-primary) !important;
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shop-nav__bottomItem--active,
  .profile-action-center__card--pay,
  .profile-action-center__card--return,
  .profile-mobile-entry__item--active,
  .profile-orders__tab--active,
  .profile-payment-recommend__chip.is-active,
  .profile-flow-focus.is-ready,
  .profile-order-card__next--done,
  .profile-order-card__next--success,
  .profile-address-readiness__stats span:first-child,
  .profile-after-sale-panel__metrics button,
  .coupon-claim-section__filterButton--active,
  .coupon-wallet__filter--active,
  .coupon-center-page__couponReady,
  .coupon-center-page__couponFit--ready,
  .coupon-wallet__fit--ready,
  .cart-page__nextAction--ready,
  .cart-page__confidenceItem--ready,
  .cart-page__checkoutPathStep--ready,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="is-active"],
  [class*="is-ready"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-progress-text,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  .anticon
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary *,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-switch-checked *,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-dropdown-menu-item-active,
  .ant-dropdown-menu-item-selected,
  .ant-select-item-option-active,
  .ant-select-item-option-selected,
  .ant-cascader-menu-item-active,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner
) :where(span, strong, small, .anticon) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shopee-hero__featuredCard,
  .shopee-hero__spotlight,
  .pet-trust-strip,
  .pet-trust-strip > div,
  .shopee-story-card,
  .shopee-editorial-band__feature,
  .shopee-editorial-band__miniCard,
  .shopee-personalized-insight,
  .pet-ugc__card,
  .pet-ugc__meta,
  .pet-ugc-preview__figure,
  .product-list__sidebarCard,
  .product-list__heroCard,
  .product-list__mobileContextBar,
  .product-list__mobileDiscovery,
  .product-list__snapshotNotice,
  .product-list__smartBar,
  .product-list__insightPanel,
  .product-list__checkoutPath,
  .product-list__checkoutPathItem,
  .product-list__confidenceStrip,
  .product-list__categoryStack,
  .product-list__filterStack,
  .product-list__emptyDiscoveryCard,
  .product-list__loadFailed,
  .product-list__recovery,
  .product-list__recoveryTips,
  .product-list__emptyContent,
  .product-list__drawerContent,
  .product-list__drawerSummary,
  .product-list__drawerPanels,
  .product-list__drawerFooter,
  .product-list__quickAddContent,
  .product-list__preview,
  .product-list__previewBody,
  .product-list__previewSignals,
  .product-list__previewActions,
  .product-gallery-card,
  .product-summary-card,
  .product-price-panel,
  .product-mobile-promo,
  .product-compact-signals,
  .product-purchase-readiness,
  .product-purchase-readiness__item,
  .product-options-anchor,
  .product-option-header,
  .product-option-radio,
  .product-selected-summary,
  .product-detail-disclosure,
  .product-size-calculator,
  .product-value-callout,
  .product-purchase-mode,
  .product-conversion-nudge,
  .product-purchase-summary,
  .product-complete-set,
  .product-complete-set__item,
  .product-decision-card,
  .product-decision-item,
  .product-delivery-promise,
  .product-trust-card,
  .product-tabs-card,
  .product-tab-content,
  .product-spec-row,
  .product-warranty-row,
  .product-review-card,
  .product-qa-card,
  .product-question-item,
  .product-answer-box,
  .product-recommendations__card,
  .cart-page__emptyHero,
  .cart-page__emptySignals,
  .cart-page__heroStat,
  .cart-page__summaryStrip,
  .cart-page__table,
  .cart-page__mobileList,
  .cart-page__mobileItemInfo,
  .cart-page__mobileItemBottom,
  .cart-page__mobileItemCommerce,
  .cart-page__addOn,
  .cart-page__emptyPanel,
  .cart-page__savedValue,
  .cart-page__savedReminder,
  .cart-page__savedGrid,
  .cart-page__savedInfo,
  .checkout-page__paymentRecovery,
  .checkout-page__emptyHero,
  .checkout-page__emptySignals,
  .checkout-page__heroStat,
  .checkout-page__summaryStrip,
  .checkout-page__confirmationBand,
  .checkout-page__trustBar,
  .checkout-page__trustItem,
  .checkout-page__paymentGrid,
  .checkout-page__savingsCoachItem,
  .checkout-page__readinessItem,
  .checkout-page__addressChoice,
  .checkout-page__couponRules,
  .checkout-page__couponSummary,
  .checkout-page__paymentConfidence,
  .checkout-page__submitReview,
  .checkout-page__submitMetric,
  .browsing-history__assistant,
  .browsing-history__assistant-actions button,
  .browsing-history__recovery,
  .browsing-history__nextAction,
  .browsing-history__item,
  .browsing-history__content,
  .browsing-history__empty,
  .browsing-history__mobileAction,
  .pet-finder-page__insights,
  .pet-finder-page__signal,
  .pet-finder-page__nextStep,
  .pet-finder-page__productCard,
  .pet-gallery-toolbar,
  .pet-gallery-insights,
  .pet-gallery-insights__item,
  .pet-gallery-action-card,
  .pet-gallery-empty,
  .order-tracking-page__lookupCard,
  .order-tracking-page__emptyState,
  .order-tracking-page__confidenceCard,
  .order-tracking-page__nextAction,
  .order-tracking-page__assurance,
  .order-tracking-page__item,
  .order-tracking-page__paymentReturn,
  .wishlist-page__mobileAction,
  .stock-alerts__header,
  .stock-alerts__itemDetails,
  .notifications-page__header,
  .notifications-page__signal,
  .notifications-page__actionSignals,
  .customer-support-widget__brief,
  .customer-support-widget__welcomeCard,
  .customer-support-widget__message,
  .customer-support-widget__orderCard,
  .customer-support-widget__triage,
  .customer-support-widget__workflowChip,
  .customer-support-widget__orderPicker,
  .customer-support-widget__orderDetail,
  .customer-support-widget__closedNotice,
  .payment-modal__content,
  .profile-health-panel,
  .profile-pet-insights__card,
  .profile-pet-card,
  .profile-payment-recovery,
  .profile-payment-method-hint,
  .profile-payment-history__item,
  .profile-return-modal__content,
  .profile-order-detail__descriptions
) {
  border-color: var(--app-contrast-line) !important;
  background: var(--app-contrast-panel-soft) !important;
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shopee-home,
  .product-list,
  .product-detail-page,
  .cart-page,
  .checkout-page,
  .coupon-center-page,
  .profile-page,
  .wishlist-page,
  .stock-alerts,
  .notifications-page,
  .browsing-history,
  .pet-finder-page,
  .pet-gallery-page,
  .order-tracking-page,
  .customer-support-widget__panel
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-card-meta-title,
  .ant-card-meta-description,
  .ant-list-item-meta-title,
  .ant-list-item-meta-description,
  .ant-descriptions-title,
  .ant-descriptions-item-label,
  .ant-descriptions-item-content,
  .ant-empty-description,
  .ant-form-item-label > label,
  .ant-progress-text,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-steps-item-title,
  .ant-steps-item-description,
  .ant-table-cell,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  small,
  strong,
  em,
  b,
  a,
  button:not(.ant-btn-primary),
  span:not(.anticon):not(.ant-badge-count):not(.ant-scroll-number):not(.ant-progress-text)
) {
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where(
  .ant-btn:not(.ant-btn-primary):not(.ant-btn-link):not(.ant-btn-text),
  .ant-btn-default
) {
  border-color: var(--app-contrast-line) !important;
  background: var(--app-contrast-control) !important;
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shopee-hero__main,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .browsing-history__hero,
  .pet-gallery-hero,
  .pet-gallery-conversion,
  .order-tracking-page__journey
) {
  background: linear-gradient(135deg, rgba(18, 71, 52, 0.99), rgba(18, 71, 52, 0.92) 56%, rgba(238, 77, 45, 0.78)) !important;
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shopee-hero__main,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .browsing-history__hero,
  .pet-gallery-hero,
  .pet-gallery-conversion,
  .order-tracking-page__journey
) :where(
  .ant-typography,
  .ant-typography-secondary,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  small,
  strong,
  em,
  b,
  a,
  .anticon,
  span:not(.ant-badge-count):not(.ant-scroll-number)
) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  [class*="--warning"],
  [class*="--urgent"],
  [class*="--risk"],
  [class*="is-warm"],
  [class*="is-risk"]
) {
  border-color: rgba(122, 58, 24, 0.22) !important;
  background: #fff4e8 !important;
  color: var(--app-contrast-warn) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  [class*="--warning"],
  [class*="--urgent"],
  [class*="--risk"],
  [class*="is-warm"],
  [class*="is-risk"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  h1,
  h2,
  h3,
  h4,
  p,
  label,
  span,
  strong,
  small,
  .anticon
) {
  color: var(--app-contrast-warn) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="is-active"],
  [class*="is-ready"],
  .ant-tag-checkable-checked
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary:hover,
  .ant-btn-primary:focus,
  .ant-btn-primary:active,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-dropdown-menu-item-active,
  .ant-dropdown-menu-item-selected,
  .ant-select-item-option-active,
  .ant-select-item-option-selected,
  .ant-cascader-menu-item-active,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner
) {
  border-color: rgba(255, 247, 240, 0.28) !important;
  background: var(--app-contrast-primary) !important;
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="is-active"],
  [class*="is-ready"],
  .ant-tag-checkable-checked
) :where(
  .ant-typography,
  .ant-typography-secondary,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  .anticon
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary *,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-dropdown-menu-item-active,
  .ant-dropdown-menu-item-selected,
  .ant-select-item-option-active,
  .ant-select-item-option-selected,
  .ant-cascader-menu-item-active,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner
) :where(span, strong, small, .anticon) {
  color: var(--app-contrast-on-dark) !important;
}

/* Last-mile App contrast for leaf cards, popups, and linked address menus. */
body.shop-mobile-app .shop-app-shell :is(
  .coupon-center-page__heroPlan,
  .coupon-section-header,
  .coupon-guidance-grid,
  .coupon-claim-section__toolbar > div,
  .coupon-claim-section__resultMetric,
  .coupon-claim-section__empty,
  .coupon-claim-section__filterButton,
  .coupon-center-page__couponDetails,
  .coupon-center-page__couponMicroFacts,
  .coupon-wallet__quickFact,
  .coupon-wallet__expiryPill,
  .coupon-wallet__closedAction,
  .profile-tabs > .ant-tabs-nav,
  .profile-orders__toolbar,
  .profile-orders__tab,
  .profile-order-card__top,
  .profile-order-card__amount,
  .profile-order-card__paid,
  .profile-order-card__next,
  .profile-order-item,
  .profile-order-item__imageButton,
  .profile-address-readiness__stats span,
  .profile-after-sale-panel__metrics button,
  .profile-order-flow,
  .profile-flow-focus,
  .profile-flow-focus__value,
  .profile-order-flow__step,
  .profile-flow-actions__card,
  .profile-payment-recommend,
  .profile-payment-recommend__chip,
  .profile-email-code-warning,
  .profile-order-detail__itemsHeader,
  .profile-order-detail__productButton,
  .profile-order-detail__imageButton
) {
  border-color: var(--app-contrast-line) !important;
  background: var(--app-contrast-panel-soft) !important;
  color: var(--app-contrast-ink) !important;
  box-shadow: var(--app-contrast-shadow) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .coupon-center-page__heroPlan,
  .coupon-section-header,
  .coupon-guidance-grid,
  .coupon-claim-section__toolbar > div,
  .coupon-claim-section__resultMetric,
  .coupon-claim-section__empty,
  .coupon-claim-section__filterButton,
  .coupon-center-page__couponDetails,
  .coupon-center-page__couponMicroFacts,
  .coupon-wallet__quickFact,
  .coupon-wallet__expiryPill,
  .coupon-wallet__closedAction,
  .profile-tabs > .ant-tabs-nav,
  .profile-orders__toolbar,
  .profile-orders__tab,
  .profile-order-card__top,
  .profile-order-card__amount,
  .profile-order-card__paid,
  .profile-order-card__next,
  .profile-order-item,
  .profile-order-item__imageButton,
  .profile-address-readiness__stats span,
  .profile-after-sale-panel__metrics button,
  .profile-order-flow,
  .profile-flow-focus,
  .profile-flow-focus__value,
  .profile-order-flow__step,
  .profile-flow-actions__card,
  .profile-payment-recommend,
  .profile-payment-recommend__chip,
  .profile-email-code-warning,
  .profile-order-detail__itemsHeader,
  .profile-order-detail__productButton,
  .profile-order-detail__imageButton
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-form-item-extra,
  .ant-form-item-explain,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  button:not(.ant-btn-primary),
  .anticon
) {
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where(
  .ant-popover-title,
  .ant-popconfirm-title,
  .ant-popconfirm-description,
  .ant-select-item-empty,
  .ant-cascader-menu-empty,
  .ant-picker-header button,
  .ant-picker-cell-inner,
  .ant-cascader-menu-item-content,
  .ant-cascader-menu-item-expand-icon,
  .ant-checkbox + span,
  .ant-radio + span
) {
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where(
  .ant-input,
  .ant-input-affix-wrapper,
  .ant-input-number,
  .ant-input-number-input,
  .ant-input-group-addon,
  .ant-picker,
  .ant-picker-panel,
  .ant-picker-header,
  .ant-picker-content th,
  .ant-picker-cell,
  .ant-picker-cell-inner,
  .ant-picker-input > input,
  .ant-select-selector,
  .ant-select-selection-item,
  .ant-select-selection-placeholder,
  .ant-select-item,
  .ant-select-item-option-content,
  .ant-cascader-menu,
  .ant-cascader-menu-item,
  .ant-cascader-menu-item-content,
  .ant-cascader-menu-item-expand-icon,
  .ant-segmented,
  .ant-segmented-item,
  .ant-radio-wrapper,
  .ant-radio-button-wrapper,
  .ant-checkbox-wrapper,
  .ant-checkbox + span,
  textarea.ant-input
) {
  border-color: var(--app-contrast-line) !important;
  background: var(--app-contrast-control) !important;
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .profile-order-card__next--pay,
  .profile-order-card__next--return,
  .profile-flow-focus.is-pending,
  .profile-order-flow__step--current,
  [class*="--warning"],
  [class*="--urgent"],
  [class*="--risk"],
  [class*="--current"],
  [class*="is-pending"],
  [class*="is-warm"],
  [class*="is-risk"]
) {
  border-color: rgba(122, 58, 24, 0.22) !important;
  background: #fff4e8 !important;
  color: var(--app-contrast-warn) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .profile-order-card__next--pay,
  .profile-order-card__next--return,
  .profile-flow-focus.is-pending,
  .profile-order-flow__step--current,
  [class*="--warning"],
  [class*="--urgent"],
  [class*="--risk"],
  [class*="--current"],
  [class*="is-pending"],
  [class*="is-warm"],
  [class*="is-risk"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  h1,
  h2,
  h3,
  h4,
  p,
  label,
  span,
  strong,
  small,
  .anticon
) {
  color: var(--app-contrast-warn) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shop-nav__bottomItem--active,
  .profile-action-center__card--pay,
  .profile-action-center__card--return,
  .profile-mobile-entry__item--active,
  .profile-orders__tab--active,
  .profile-payment-recommend__chip.is-active,
  .profile-flow-focus.is-ready,
  .profile-order-flow__step--done,
  .profile-order-card__next--done,
  .profile-order-card__next--success,
  .profile-address-readiness__stats span:first-child,
  .profile-after-sale-panel__metrics button,
  .coupon-claim-section__filterButton--active,
  .coupon-wallet__filter--active,
  .coupon-center-page__couponReady,
  .coupon-center-page__couponFit--ready,
  .coupon-wallet__fit--ready,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="--checked"],
  [class*="is-active"],
  [class*="is-ready"]
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary:hover,
  .ant-btn-primary:focus,
  .ant-btn-primary:active,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-dropdown-menu-item-active,
  .ant-dropdown-menu-item-selected,
  .ant-select-item-option-active,
  .ant-select-item-option-selected,
  .ant-cascader-menu-item-active,
  .ant-cascader-menu-item:hover,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner
) {
  border-color: rgba(255, 247, 240, 0.28) !important;
  background: var(--app-contrast-primary) !important;
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .shop-nav__bottomItem--active,
  .profile-action-center__card--pay,
  .profile-action-center__card--return,
  .profile-mobile-entry__item--active,
  .profile-orders__tab--active,
  .profile-payment-recommend__chip.is-active,
  .profile-flow-focus.is-ready,
  .profile-order-flow__step--done,
  .profile-order-card__next--done,
  .profile-order-card__next--success,
  .profile-address-readiness__stats span:first-child,
  .profile-after-sale-panel__metrics button,
  .coupon-claim-section__filterButton--active,
  .coupon-wallet__filter--active,
  .coupon-center-page__couponReady,
  .coupon-center-page__couponFit--ready,
  .coupon-wallet__fit--ready,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="--checked"],
  [class*="is-active"],
  [class*="is-ready"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  .anticon
),
body.shop-mobile-app :where(
  .ant-btn-primary,
  .ant-btn-primary *,
  .ant-badge-count,
  .ant-switch-checked,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-dropdown-menu-item-active,
  .ant-dropdown-menu-item-selected,
  .ant-select-item-option-active,
  .ant-select-item-option-selected,
  .ant-cascader-menu-item-active,
  .ant-cascader-menu-item:hover,
  .ant-picker-cell-in-view.ant-picker-cell-selected .ant-picker-cell-inner
) :where(span, strong, small, .anticon) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .coupon-center-page__heroBadge--muted,
  .coupon-center-page__statCard--empty,
  .coupon-claim-section__filterButton--empty:not(.coupon-claim-section__filterButton--active),
  .coupon-wallet__filter--empty:not(.coupon-wallet__filter--active),
  .coupon-wallet__expiryPill--muted,
  .coupon-wallet__quickFact--empty,
  .coupon-center-page__coupon--claimed .coupon-center-page__couponValue,
  .coupon-center-page__coupon--empty .coupon-center-page__couponValue,
  .product-mobile-buybar__status--attention,
  .product-detail-tabs .ant-tabs-tab-active .ant-tabs-tab-btn
) {
  border-color: rgba(18, 71, 52, 0.18) !important;
  background: #fff4e8 !important;
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .product-list__filterCount,
  .product-list__previewDiscount,
  .product-list__mobileDiscoveryButton--active .product-list__mobileDiscoveryIcon,
  .product-price-line .ant-tag,
  .product-actions .ant-space-item:nth-child(2) .ant-btn,
  .shopee-product__discount,
  .coupon-wallet__coupon--used .coupon-wallet__couponIcon,
  .coupon-wallet__coupon--expired .coupon-wallet__couponIcon
) {
  border-color: rgba(255, 247, 240, 0.28) !important;
  background: #8f2d17 !important;
  color: var(--app-contrast-on-dark) !important;
  box-shadow: 0 12px 24px rgba(143, 45, 23, 0.18) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .product-list__filterCount,
  .product-list__previewDiscount,
  .product-list__mobileDiscoveryButton--active .product-list__mobileDiscoveryIcon,
  .product-price-line .ant-tag,
  .product-actions .ant-space-item:nth-child(2) .ant-btn,
  .shopee-product__discount,
  .coupon-wallet__coupon--used .coupon-wallet__couponIcon,
  .coupon-wallet__coupon--expired .coupon-wallet__couponIcon
) :where(span, strong, small, .anticon) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .product-list__actionButton.ant-btn-primary,
  .product-actions .ant-btn-primary,
  .product-mobile-buybar__buy
) {
  border-color: transparent !important;
  background: linear-gradient(135deg, #b84222, #7f2d16) !important;
  color: var(--app-contrast-on-dark) !important;
  box-shadow: 0 14px 28px rgba(127, 45, 22, 0.28) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .product-list__actionButton.ant-btn-primary,
  .product-actions .ant-btn-primary,
  .product-mobile-buybar__buy
) :where(span, strong, small, .anticon) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app .shop-app-shell :is(
  .product-list__priceLine,
  .product-price-line
) {
  height: auto !important;
  overflow: visible !important;
}

body.shop-mobile-app {
  --shop-mobile-floating-action-gap: 10px;
  --shop-mobile-overlay-z: 9800;
}

body.shop-mobile-app .shop-app-shell--product-detail .shop-nav__bottomBar,
body.shop-mobile-app .shop-app-shell--checkout-flow .shop-nav__bottomBar {
  display: none !important;
  pointer-events: none !important;
}

body.shop-mobile-app .shop-app-shell--product-detail .ant-layout-content,
body.shop-mobile-app .shop-app-shell--checkout-flow .ant-layout-content {
  padding-bottom: calc(118px + env(safe-area-inset-bottom, 0px)) !important;
}

body.shop-mobile-app .shop-app-shell--product-detail .product-detail-page,
body.shop-mobile-app .shop-app-shell--checkout-flow .checkout-page {
  padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px)) !important;
  scroll-padding-bottom: calc(164px + env(safe-area-inset-bottom, 0px)) !important;
}

body.shop-mobile-app .shop-app-shell--product-detail .product-mobile-buybar,
body.shop-mobile-app .shop-app-shell--checkout-flow .checkout-page__mobilePayBar {
  right: max(8px, env(safe-area-inset-right, 0px)) !important;
  bottom: max(var(--shop-mobile-floating-action-gap), env(safe-area-inset-bottom, 0px)) !important;
  left: max(8px, env(safe-area-inset-left, 0px)) !important;
  z-index: 7600 !important;
  width: auto !important;
  max-width: calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
  border-radius: 14px !important;
}

body.shop-mobile-app .shop-app-shell--checkout-flow .checkout-page__submitReview {
  position: static !important;
  inset: auto !important;
  margin-right: 0 !important;
  margin-left: 0 !important;
}

body.shop-mobile-app :where(
  .ant-modal-root,
  .ant-modal-mask,
  .ant-modal-wrap,
  .ant-drawer,
  .ant-drawer-mask,
  .ant-drawer-content-wrapper,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .ant-popover,
  .ant-message,
  .ant-notification,
  .shop-mobile-popup-layer
) {
  z-index: var(--shop-mobile-overlay-z) !important;
}

body.shop-mobile-app :where(
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .shop-mobile-popup-layer
) {
  max-width: calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
  max-height: min(70dvh, 520px) !important;
  overflow: auto !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

body.shop-mobile-app .ant-modal-root .ant-modal:not(.ant-modal-confirm) {
  top: max(8px, env(safe-area-inset-top, 0px)) !important;
  max-width: calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
  margin: 0 auto !important;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;
}

body.shop-mobile-app .ant-modal-root .ant-modal:not(.ant-modal-confirm) .ant-modal-content {
  max-height: calc(100vh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
  display: flex !important;
  flex-direction: column;
  overflow: hidden !important;
}

@supports (height: 100dvh) {
  body.shop-mobile-app .ant-modal-root .ant-modal:not(.ant-modal-confirm) .ant-modal-content {
    max-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
  }
}

body.shop-mobile-app .ant-modal-root .ant-modal:not(.ant-modal-confirm) :where(.ant-modal-header, .ant-modal-footer) {
  flex: 0 0 auto;
}

body.shop-mobile-app .ant-modal-root .ant-modal:not(.ant-modal-confirm) .ant-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

body.shop-mobile-app .customer-support-widget__button {
  z-index: 8700 !important;
  bottom: calc(var(--shop-mobile-bottom-nav-height, 76px) + 18px + env(safe-area-inset-bottom, 0px)) !important;
}

body.shop-mobile-app .customer-support-widget__backdrop {
  z-index: 9798 !important;
}

body.shop-mobile-app .customer-support-widget__panel {
  right: max(8px, env(safe-area-inset-right, 0px)) !important;
  bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
  left: max(8px, env(safe-area-inset-left, 0px)) !important;
  z-index: 9799 !important;
  max-height: calc(100vh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
}

body.shop-mobile-app .customer-support-widget__button--open {
  z-index: 9800 !important;
}

@supports (height: 100dvh) {
  body.shop-mobile-app .customer-support-widget__panel {
    max-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
  }
}

body.shop-mobile-app :where(.shopee-login-card__intro, .shopee-login-subtitle) {
  display: block !important;
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: normal !important;
  overflow-wrap: break-word;
  -webkit-box-orient: initial !important;
  -webkit-line-clamp: unset !important;
}

body.shop-mobile-app .pet-finder-page__nextStepCopy > span.ant-typography:not(.pet-finder-page__eyebrow),
body.shop-mobile-app .coupon-next-action p,
body.shop-mobile-app .coupon-center-page__mobileActionInsight span,
body.shop-mobile-app .coupon-center-page__mobileActionInsight strong {
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: normal !important;
  overflow-wrap: break-word;
  -webkit-line-clamp: unset !important;
}

body.shop-mobile-app.shop-mobile-app .shop-app-shell :is(
  .shopee-home,
  .product-list,
  .product-detail-page,
  .cart-page,
  .checkout-page,
  .coupon-center-page,
  .profile-page,
  .wishlist-page,
  .stock-alerts,
  .stock-alerts-page,
  .notifications-page,
  .browsing-history,
  .pet-finder-page,
  .pet-gallery-page,
  .order-tracking-page,
  .customer-support-widget__panel,
  .cart-drawer
) :where(
  .ant-typography-secondary,
  .ant-card-meta-description,
  .ant-list-item-meta-description,
  .ant-empty-description,
  .ant-form-item-extra,
  .ant-form-item-explain,
  .ant-statistic-title,
  .ant-steps-item-description,
  .ant-table-column-sorter,
  .ant-table-filter-trigger,
  [class*="__subtitle"],
  [class*="__Subtitle"],
  [class*="__description"],
  [class*="__Description"],
  [class*="__desc"],
  [class*="__Desc"],
  [class*="__caption"],
  [class*="__Caption"],
  [class*="__helper"],
  [class*="__Helper"],
  [class*="__hint"],
  [class*="__Hint"],
  [class*="__meta"],
  [class*="__Meta"],
  [class*="__muted"],
  [class*="__Muted"],
  [class*="__note"],
  [class*="__Note"],
  [class*="__time"],
  [class*="__Time"]
) {
  color: var(--app-contrast-muted) !important;
  opacity: 1 !important;
}

body.shop-mobile-app :where(
  .ant-tabs-tab,
  .ant-tabs-tab-btn,
  .ant-steps-item-title,
  .ant-steps-item-description,
  .ant-collapse-header,
  .ant-pagination-item,
  .ant-pagination-prev,
  .ant-pagination-next,
  .ant-table-thead > tr > th,
  .ant-table-tbody > tr > td,
  .ant-menu-item,
  .ant-dropdown-menu-item,
  .ant-select-item-option-content,
  .ant-cascader-menu-item-content,
  .ant-picker-header button,
  .ant-picker-cell-inner,
  .ant-checkbox-wrapper,
  .ant-radio-wrapper,
  .ant-checkbox + span,
  .ant-radio + span
) {
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where(
  .ant-tabs-tab:not(.ant-tabs-tab-active),
  .ant-steps-item-wait .ant-steps-item-title,
  .ant-steps-item-wait .ant-steps-item-description,
  .ant-steps-item-process .ant-steps-item-description,
  .ant-pagination-disabled,
  .ant-btn[disabled],
  .ant-btn-disabled,
  .ant-input[disabled],
  .ant-input-disabled,
  .ant-input-number-disabled,
  .ant-select-disabled,
  .ant-picker-disabled
) {
  color: var(--app-contrast-muted) !important;
  opacity: 1 !important;
}

body.shop-mobile-app .ant-input::placeholder,
body.shop-mobile-app textarea.ant-input::placeholder,
body.shop-mobile-app .ant-input-number-input::placeholder,
body.shop-mobile-app .ant-picker-input > input::placeholder {
  color: var(--app-contrast-muted) !important;
  opacity: 1 !important;
}

body.shop-mobile-app :where(
  .ant-select-selection-placeholder,
  .ant-cascader-picker-label,
  .ant-picker-suffix,
  .ant-input-prefix,
  .ant-input-suffix
) {
  color: var(--app-contrast-muted) !important;
  opacity: 1 !important;
}

body.shop-mobile-app :where(
  .ant-btn[disabled],
  .ant-btn-disabled,
  .ant-input[disabled],
  .ant-input-disabled,
  .ant-input-number-disabled .ant-input-number-input,
  .ant-select-disabled .ant-select-selector,
  .ant-picker-disabled
) {
  border-color: rgba(18, 71, 52, 0.18) !important;
  background: #eef4ef !important;
}

body.shop-mobile-app.shop-mobile-app .shop-app-shell :is(
  .shopee-hero__main,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .browsing-history__hero,
  .pet-gallery-hero,
  .pet-gallery-conversion,
  .order-tracking-page__journey,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="--checked"],
  [class*="is-active"],
  [class*="is-ready"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-card-meta-description,
  .ant-list-item-meta-description,
  .ant-statistic-title,
  .ant-steps-item-description,
  [class*="__subtitle"],
  [class*="__description"],
  [class*="__desc"],
  [class*="__caption"],
  [class*="__helper"],
  [class*="__hint"],
  [class*="__meta"],
  [class*="__muted"],
  [class*="__note"],
  [class*="__time"],
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  .anticon
) {
  color: var(--app-contrast-on-dark) !important;
  opacity: 1 !important;
}

body.shop-mobile-app :where([data-shop-contrast-text="dark"]) {
  color: var(--app-contrast-ink) !important;
}

body.shop-mobile-app :where([data-shop-contrast-text="light"]) {
  color: var(--app-contrast-on-dark) !important;
}

body.shop-mobile-app :where([data-shop-contrast-text="dark"], [data-shop-contrast-text="light"]) :where(
  .ant-typography,
  .ant-typography-secondary,
  span,
  strong,
  small,
  em,
  b,
  a,
  label,
  .anticon
) {
  color: inherit !important;
}

/* Last-mile native App readability guard. Keep this block at the end. */
body.shop-mobile-app {
  --shop-readable-surface: #fbfdfb;
  --shop-readable-control: #ffffff;
  --shop-readable-ink: var(--mobile-page-ink, var(--app-contrast-ink, #102f22));
  --shop-readable-muted: var(--mobile-page-muted, var(--app-contrast-muted, #3f5147));
  --shop-readable-primary: var(--mobile-page-primary, var(--app-contrast-primary, #124734));
  --shop-readable-on-dark: var(--mobile-page-on-dark, var(--app-contrast-on-dark, #ffffff));
  --shop-readable-line: var(--mobile-page-line, var(--app-contrast-line, rgba(18, 71, 52, 0.22)));
  --shop-readable-warn: #7a3a18;
  --shop-readable-danger: #8f2d17;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout,
  .ant-modal-root,
  .ant-drawer,
  .ant-popover,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .ant-message,
  .ant-notification,
  .shop-mobile-popup-layer
) :where(
  .ant-card,
  .ant-card-body,
  .ant-card-head,
  .ant-list,
  .ant-list-item,
  .ant-alert:not(.ant-alert-error):not(.ant-alert-warning):not(.ant-alert-success):not(.ant-alert-info),
  .ant-collapse,
  .ant-collapse-content,
  .ant-collapse-content-box,
  .ant-descriptions,
  .ant-descriptions-view,
  .ant-empty,
  .ant-result,
  .ant-statistic,
  .ant-table,
  .ant-table-container,
  .ant-table-content,
  .ant-table-wrapper,
  .ant-tabs,
  .ant-tabs-content-holder,
  .ant-modal-content,
  .ant-modal-header,
  .ant-modal-body,
  .ant-modal-footer,
  .ant-drawer-content,
  .ant-drawer-header,
  .ant-drawer-body,
  .ant-drawer-footer,
  [class*="__card"],
  [class*="__Card"],
  [class*="__panel"],
  [class*="__Panel"],
  [class*="__sheet"],
  [class*="__Sheet"],
  [class*="__section"],
  [class*="__Section"],
  [class*="__tile"],
  [class*="__Tile"],
  [class*="__entry"],
  [class*="__Entry"],
  [class*="__notice"],
  [class*="__Notice"],
  [class*="__toolbar"],
  [class*="__Toolbar"],
  [class*="__summary"],
  [class*="__Summary"],
  [class*="__details"],
  [class*="__Details"],
  [class*="__metric"],
  [class*="__Metric"],
  [class*="__stat"],
  [class*="__Stat"]
) {
  border-color: var(--shop-readable-line) !important;
  background: var(--shop-readable-surface) !important;
  color: var(--shop-readable-ink) !important;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout,
  .ant-modal-root,
  .ant-drawer,
  .ant-popover,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .ant-message,
  .ant-notification,
  .shop-mobile-popup-layer
) :where(
  .ant-typography,
  .ant-card-meta-title,
  .ant-card-head-title,
  .ant-list-item-meta-title,
  .ant-descriptions-title,
  .ant-descriptions-item-label,
  .ant-descriptions-item-content,
  .ant-empty-description,
  .ant-form-item-label > label,
  .ant-form-item-extra,
  .ant-form-item-explain,
  .ant-progress-text,
  .ant-result-title,
  .ant-result-subtitle,
  .ant-statistic-title,
  .ant-statistic-content,
  .ant-steps-item-title,
  .ant-steps-item-description,
  .ant-table-cell,
  .ant-tabs-tab-btn,
  .ant-timeline-item-content,
  .ant-menu-title-content,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  small,
  strong,
  em,
  b,
  a:not(.ant-btn-primary),
  button:not(.ant-btn-primary),
  span:not(.anticon):not(.ant-badge-count):not(.ant-scroll-number)
) {
  color: var(--shop-readable-ink) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout,
  .ant-modal-root,
  .ant-drawer,
  .ant-popover,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .ant-message,
  .ant-notification,
  .shop-mobile-popup-layer
) :where(
  .ant-typography-secondary,
  .ant-card-meta-description,
  .ant-list-item-meta-description,
  .ant-empty-description,
  .ant-form-item-extra,
  .ant-form-item-explain,
  .ant-result-subtitle,
  .ant-statistic-title,
  .ant-steps-item-description,
  .ant-table-column-sorter,
  .ant-table-filter-trigger,
  [class*="__subtitle"],
  [class*="__Subtitle"],
  [class*="__description"],
  [class*="__Description"],
  [class*="__desc"],
  [class*="__Desc"],
  [class*="__caption"],
  [class*="__Caption"],
  [class*="__helper"],
  [class*="__Helper"],
  [class*="__hint"],
  [class*="__Hint"],
  [class*="__meta"],
  [class*="__Meta"],
  [class*="__muted"],
  [class*="__Muted"],
  [class*="__note"],
  [class*="__Note"],
  [class*="__time"],
  [class*="__Time"]
) {
  color: var(--shop-readable-muted) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app :where(
  .ant-input,
  .ant-input-affix-wrapper,
  .ant-input-number,
  .ant-input-number-input,
  .ant-input-group-addon,
  .ant-picker,
  .ant-picker-panel,
  .ant-picker-header,
  .ant-picker-cell,
  .ant-picker-input > input,
  .ant-select-selector,
  .ant-select-selection-item,
  .ant-select-item,
  .ant-select-item-option-content,
  .ant-cascader-menu,
  .ant-cascader-menu-item,
  .ant-cascader-menu-item-content,
  .ant-segmented,
  .ant-segmented-item,
  .ant-radio-button-wrapper,
  .ant-radio-wrapper,
  .ant-checkbox-wrapper,
  .ant-checkbox + span,
  textarea.ant-input
) {
  border-color: var(--shop-readable-line) !important;
  background: var(--shop-readable-control) !important;
  color: var(--shop-readable-ink) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app :where(
  .ant-btn-link:not(.ant-btn-dangerous),
  .ant-btn-text:not(.ant-btn-dangerous),
  .ant-pagination-item-link,
  .ant-table-filter-trigger,
  .ant-table-column-sorter
) {
  color: var(--shop-readable-primary) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app .ant-input::placeholder,
body.shop-mobile-app.shop-mobile-app textarea.ant-input::placeholder,
body.shop-mobile-app.shop-mobile-app .ant-input-number-input::placeholder,
body.shop-mobile-app.shop-mobile-app .ant-picker-input > input::placeholder,
body.shop-mobile-app.shop-mobile-app :where(
  .ant-select-selection-placeholder,
  .ant-cascader-picker-label
) {
  color: var(--shop-readable-muted) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app :where(.ant-tag, .ant-tag-default) {
  border-color: rgba(18, 71, 52, 0.22) !important;
  background: #eef4ef !important;
  color: var(--shop-readable-ink) !important;
}

body.shop-mobile-app.shop-mobile-app :where(.ant-tag-green, .ant-tag-success, .ant-tag-cyan) {
  border-color: rgba(18, 71, 52, 0.26) !important;
  background: #e6f3ec !important;
  color: var(--shop-readable-primary) !important;
}

body.shop-mobile-app.shop-mobile-app :where(.ant-tag-blue, .ant-tag-geekblue, .ant-tag-purple, .ant-tag-magenta) {
  border-color: rgba(30, 77, 120, 0.24) !important;
  background: #eaf2ff !important;
  color: #1e4d78 !important;
}

body.shop-mobile-app.shop-mobile-app :where(.ant-tag-gold, .ant-tag-warning, .ant-tag-orange) {
  border-color: rgba(122, 58, 24, 0.24) !important;
  background: #fff1df !important;
  color: var(--shop-readable-warn) !important;
}

body.shop-mobile-app.shop-mobile-app :where(.ant-tag-red, .ant-tag-error, .ant-tag-volcano, .ant-btn-dangerous) {
  border-color: rgba(143, 45, 23, 0.24) !important;
  background: #ffe5da !important;
  color: var(--shop-readable-danger) !important;
}

body.shop-mobile-app.shop-mobile-app :where(.ant-form-item-explain-error, .ant-typography-danger) {
  color: var(--shop-readable-danger) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout,
  .ant-modal-root,
  .ant-drawer,
  .ant-popover,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .ant-message,
  .ant-notification,
  .shop-mobile-popup-layer
) :is(
  .shopee-hero__main,
  .shopee-login-card__header,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .browsing-history__hero,
  .pet-gallery-hero,
  .pet-gallery-conversion,
  .order-tracking-page__journey,
  .admin-layout__sider,
  .admin-layout__brand,
  .ant-btn-primary,
  .ant-menu-dark .ant-menu-item-selected,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-switch-checked,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="--checked"],
  [class*="is-active"],
  [class*="is-ready"]
) {
  border-color: rgba(255, 247, 240, 0.28) !important;
  background: var(--shop-readable-primary) !important;
  color: var(--shop-readable-on-dark) !important;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout,
  .ant-modal-root,
  .ant-drawer,
  .ant-popover,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown,
  .ant-message,
  .ant-notification,
  .shop-mobile-popup-layer
) :is(
  .shopee-hero__main,
  .shopee-login-card__header,
  .product-list__heroBand,
  .cart-page__hero,
  .checkout-page__hero,
  .coupon-center-page__hero,
  .profile-overview,
  .wishlist-page__header,
  .notifications-page__assistant,
  .browsing-history__hero,
  .pet-gallery-hero,
  .pet-gallery-conversion,
  .order-tracking-page__journey,
  .admin-layout__sider,
  .admin-layout__brand,
  .ant-btn-primary,
  .ant-menu-dark .ant-menu-item-selected,
  .ant-segmented-item-selected,
  .ant-radio-button-wrapper-checked,
  .ant-pagination-item-active,
  .ant-switch-checked,
  [class*="--active"],
  [class*="--selected"],
  [class*="--ready"],
  [class*="--success"],
  [class*="--done"],
  [class*="--checked"],
  [class*="is-active"],
  [class*="is-ready"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  .ant-card-meta-description,
  .ant-list-item-meta-description,
  .ant-statistic-title,
  .ant-steps-item-description,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  label,
  span,
  strong,
  small,
  em,
  b,
  a,
  button,
  .anticon
) {
  color: var(--shop-readable-on-dark) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout
) :is(
  [class*="--warning"],
  [class*="--urgent"],
  [class*="--risk"],
  [class*="--current"],
  [class*="is-pending"],
  [class*="is-warm"],
  [class*="is-risk"]
) {
  border-color: rgba(122, 58, 24, 0.24) !important;
  background: #fff1df !important;
  color: var(--shop-readable-warn) !important;
}

body.shop-mobile-app.shop-mobile-app :is(
  .shop-app-shell,
  .admin-layout
) :is(
  [class*="--warning"],
  [class*="--urgent"],
  [class*="--risk"],
  [class*="--current"],
  [class*="is-pending"],
  [class*="is-warm"],
  [class*="is-risk"]
) :where(
  .ant-typography,
  .ant-typography-secondary,
  span,
  strong,
  small,
  em,
  b,
  a,
  .anticon
) {
  color: var(--shop-readable-warn) !important;
  opacity: 1 !important;
}

body.shop-mobile-app.shop-mobile-app.shop-mobile-app [data-shop-contrast-text="dark"][data-shop-contrast-text="dark"],
body.shop-mobile-app.shop-mobile-app.shop-mobile-app [data-shop-contrast-text="dark"][data-shop-contrast-text="dark"] :where(
  .ant-typography,
  .ant-typography-secondary,
  span,
  strong,
  small,
  em,
  b,
  a,
  label,
  button,
  .anticon
) {
  color: var(--shop-readable-ink) !important;
  -webkit-text-fill-color: var(--shop-readable-ink) !important;
  opacity: 1 !important;
  text-shadow: none !important;
}

body.shop-mobile-app.shop-mobile-app.shop-mobile-app [data-shop-contrast-text="light"][data-shop-contrast-text="light"],
body.shop-mobile-app.shop-mobile-app.shop-mobile-app [data-shop-contrast-text="light"][data-shop-contrast-text="light"] :where(
  .ant-typography,
  .ant-typography-secondary,
  span,
  strong,
  small,
  em,
  b,
  a,
  label,
  button,
  .anticon
) {
  color: var(--shop-readable-on-dark) !important;
  -webkit-text-fill-color: var(--shop-readable-on-dark) !important;
  opacity: 1 !important;
}
`;

const isBrowser = () => typeof document !== 'undefined' && typeof window !== 'undefined';
const CONTRAST_TEXT_ATTRIBUTE = 'data-shop-contrast-text';
const MAX_CONTRAST_TEXT_NODES = 6000;
const MIN_TEXT_CONTRAST = 4.5;
const MIN_LARGE_TEXT_CONTRAST = 3.2;
const CONTRAST_SCAN_DELAY_MS = 140;
const CONTRAST_SCROLL_QUIET_MS = 220;
const MOBILE_SHELL_ROOT_SELECTOR = [
  '.shop-app-shell',
  '.admin-layout',
  '.ant-app',
  '.ant-modal-root',
  '.ant-drawer',
  '.ant-dropdown',
  '.ant-select-dropdown',
  '.ant-cascader-dropdown',
  '.ant-picker-dropdown',
  '.ant-popover',
  '.ant-tooltip',
  '.ant-tour',
  '.ant-message',
  '.ant-notification',
  '.shop-mobile-popup-layer',
].join(',');

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type MobileContrastGuardState = {
  scanTimer: number;
  scanFrame: number;
  markedElements: Set<HTMLElement>;
  lastInteractionAt: number;
};

const CONTRAST_GUARD_STATE_PROP = '__shopMobileContrastGuardState__';

type MobileContrastGuardStyleElement = HTMLStyleElement & {
  [CONTRAST_GUARD_STATE_PROP]?: MobileContrastGuardState;
};

const DARK_TEXT: Rgba = { r: 16, g: 47, b: 34, a: 1 };
const LIGHT_TEXT: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const FALLBACK_BACKGROUND: Rgba = { r: 251, g: 253, b: 251, a: 1 };

const nowMs = () => {
  if (!isBrowser()) return Date.now();
  return window.performance?.now?.() ?? Date.now();
};

const getMobileContrastGuardState = (style: HTMLStyleElement): MobileContrastGuardState => {
  const statefulStyle = style as MobileContrastGuardStyleElement;
  if (!statefulStyle[CONTRAST_GUARD_STATE_PROP]) {
    statefulStyle[CONTRAST_GUARD_STATE_PROP] = {
      scanTimer: 0,
      scanFrame: 0,
      markedElements: new Set<HTMLElement>(),
      lastInteractionAt: 0,
    };
  }
  return statefulStyle[CONTRAST_GUARD_STATE_PROP];
};

const readMobileContrastGuardState = () => {
  if (!isBrowser()) return null;
  const style = document.getElementById(STYLE_ID);
  return style instanceof HTMLStyleElement ? getMobileContrastGuardState(style) : null;
};

const noteMobileInteraction = () => {
  const state = readMobileContrastGuardState();
  if (state) {
    state.lastInteractionAt = nowMs();
  }
};

const shouldDelayContrastScan = (state: MobileContrastGuardState) => (
  isBrowser() && nowMs() - state.lastInteractionAt < CONTRAST_SCROLL_QUIET_MS
);

const clampChannel = (value: number) => Math.max(0, Math.min(255, value));

const parseHexColor = (value: string): Rgba | null => {
  const hex = value.replace('#', '').trim();
  if (![3, 4, 6, 8].includes(hex.length)) return null;

  const expanded = hex.length <= 4
    ? hex.split('').map((part) => `${part}${part}`).join('')
    : hex;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  const a = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;

  return [r, g, b, a].every(Number.isFinite) ? { r, g, b, a } : null;
};

const parseCssColor = (value: string | null | undefined): Rgba | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (trimmed.startsWith('#')) return parseHexColor(trimmed);
  if (!trimmed.startsWith('rgb')) return null;

  const parts = trimmed.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) {
    return null;
  }

  return {
    r: clampChannel(parts[0]),
    g: clampChannel(parts[1]),
    b: clampChannel(parts[2]),
    a: Number.isFinite(parts[3]) ? Math.max(0, Math.min(1, parts[3])) : 1,
  };
};

const blendOver = (foreground: Rgba, background: Rgba): Rgba => {
  const alpha = Math.max(0, Math.min(1, foreground.a));
  if (alpha >= 0.995) return { r: foreground.r, g: foreground.g, b: foreground.b, a: 1 };
  if (alpha <= 0.005) return background;

  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
};

const averageColors = (colors: Rgba[]): Rgba | null => {
  const opaqueColors = colors.filter((color) => color.a > 0.05);
  if (!opaqueColors.length) return null;
  const total = opaqueColors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b,
      a: sum.a + color.a,
    }),
    { r: 0, g: 0, b: 0, a: 0 },
  );

  return {
    r: total.r / opaqueColors.length,
    g: total.g / opaqueColors.length,
    b: total.b / opaqueColors.length,
    a: Math.max(0, Math.min(1, total.a / opaqueColors.length)),
  };
};

const extractImageTone = (backgroundImage: string): Rgba | null => {
  if (!backgroundImage || backgroundImage === 'none') return null;
  const functionColors = backgroundImage
    .match(/rgba?\([^)]*\)/gi)
    ?.map(parseCssColor)
    .filter((color): color is Rgba => Boolean(color)) || [];
  const hexColors = backgroundImage
    .match(/#[0-9a-f]{3,8}\b/gi)
    ?.map(parseCssColor)
    .filter((color): color is Rgba => Boolean(color)) || [];

  return averageColors([...functionColors, ...hexColors]);
};

const channelToLinear = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (color: Rgba) => (
  0.2126 * channelToLinear(color.r)
  + 0.7152 * channelToLinear(color.g)
  + 0.0722 * channelToLinear(color.b)
);

const contrastRatio = (first: Rgba, second: Rgba) => {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const getCachedStyle = (
  element: Element,
  styleCache: WeakMap<Element, CSSStyleDeclaration>,
) => {
  let style = styleCache.get(element);
  if (!style) {
    style = window.getComputedStyle(element);
    styleCache.set(element, style);
  }
  return style;
};

const getEffectiveBackground = (
  element: Element,
  styleCache: WeakMap<Element, CSSStyleDeclaration>,
  backgroundCache: WeakMap<Element, Rgba>,
  depth = 0,
): Rgba => {
  const cached = backgroundCache.get(element);
  if (cached) return cached;

  const parent = element.parentElement;
  let background = parent && depth < 48
    ? getEffectiveBackground(parent, styleCache, backgroundCache, depth + 1)
    : FALLBACK_BACKGROUND;
  const style = getCachedStyle(element, styleCache);
  const backgroundColor = parseCssColor(style.backgroundColor);
  if (backgroundColor && backgroundColor.a > 0.01) {
    background = blendOver(backgroundColor, background);
  }
  const imageTone = extractImageTone(style.backgroundImage);
  if (imageTone) {
    background = blendOver(imageTone, background);
  }

  backgroundCache.set(element, background);
  return background;
};

const shouldScanTextElement = (
  element: HTMLElement,
  styleCache: WeakMap<Element, CSSStyleDeclaration>,
) => {
  const tagName = element.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'svg', 'path', 'textarea', 'input', 'select', 'option'].includes(tagName)) {
    return false;
  }
  if (element.closest('svg, .anticon, .ant-scroll-number')) {
    return false;
  }

  const style = getCachedStyle(element, styleCache);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  if (Number.isFinite(opacity) && opacity < 0.08) return false;
  return element.getClientRects().length > 0;
};

const contrastThresholdFor = (style: CSSStyleDeclaration) => {
  const fontSize = Number.parseFloat(style.fontSize || '14');
  const numericWeight = Number.parseInt(style.fontWeight || '400', 10);
  const fontWeight = Number.isFinite(numericWeight)
    ? numericWeight
    : style.fontWeight === 'bold' || style.fontWeight === 'bolder'
      ? 700
      : 400;
  return fontSize >= 24 || (fontSize >= 18 && fontWeight >= 600)
    ? MIN_LARGE_TEXT_CONTRAST
    : MIN_TEXT_CONTRAST;
};

const applyContrastFixToElement = (
  element: HTMLElement,
  styleCache: WeakMap<Element, CSSStyleDeclaration>,
  backgroundCache: WeakMap<Element, Rgba>,
  nextMarkedElements: Set<HTMLElement>,
) => {
  const style = getCachedStyle(element, styleCache);
  const foreground = parseCssColor(style.color);
  if (!foreground) {
    element.removeAttribute(CONTRAST_TEXT_ATTRIBUTE);
    return;
  }

  const background = getEffectiveBackground(element, styleCache, backgroundCache);
  const visibleForeground = foreground.a < 0.995 ? blendOver(foreground, background) : foreground;
  const ratio = contrastRatio(visibleForeground, background);
  if (ratio >= contrastThresholdFor(style)) {
    element.removeAttribute(CONTRAST_TEXT_ATTRIBUTE);
    return;
  }

  const darkRatio = contrastRatio(DARK_TEXT, background);
  const lightRatio = contrastRatio(LIGHT_TEXT, background);
  element.setAttribute(CONTRAST_TEXT_ATTRIBUTE, darkRatio >= lightRatio ? 'dark' : 'light');
  nextMarkedElements.add(element);
};

const scanRootForContrast = (
  root: Element,
  styleCache: WeakMap<Element, CSSStyleDeclaration>,
  backgroundCache: WeakMap<Element, Rgba>,
  nextMarkedElements: Set<HTMLElement>,
  scanned: Set<HTMLElement>,
  remaining: { count: number },
) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || scanned.has(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let textNode = walker.nextNode();
  while (textNode && remaining.count > 0) {
    const element = textNode.parentElement;
    if (element && !scanned.has(element)) {
      scanned.add(element);
      remaining.count -= 1;
      if (shouldScanTextElement(element, styleCache)) {
        applyContrastFixToElement(element, styleCache, backgroundCache, nextMarkedElements);
      }
    }
    textNode = walker.nextNode();
  }
};

const applyMobileContrastFixes = (state: MobileContrastGuardState) => {
  if (!isBrowser() || !document.body?.classList.contains('shop-mobile-app')) return;
  const roots = Array.from(document.querySelectorAll(MOBILE_SHELL_ROOT_SELECTOR));
  if (!roots.length) return;

  const styleCache = new WeakMap<Element, CSSStyleDeclaration>();
  const backgroundCache = new WeakMap<Element, Rgba>();
  const nextMarkedElements = new Set<HTMLElement>();
  const scanned = new Set<HTMLElement>();
  const remaining = { count: MAX_CONTRAST_TEXT_NODES };

  roots.forEach((root) => {
    if (remaining.count > 0) {
      scanRootForContrast(root, styleCache, backgroundCache, nextMarkedElements, scanned, remaining);
    }
  });

  state.markedElements.forEach((element) => {
    if (!nextMarkedElements.has(element)) {
      element.removeAttribute(CONTRAST_TEXT_ATTRIBUTE);
    }
  });
  state.markedElements = nextMarkedElements;
};

const cancelMobileContrastScan = () => {
  if (!isBrowser()) return;
  const state = readMobileContrastGuardState();
  if (!state) return;
  if (state.scanTimer) {
    window.clearTimeout(state.scanTimer);
    state.scanTimer = 0;
  }
  if (state.scanFrame) {
    window.cancelAnimationFrame(state.scanFrame);
    state.scanFrame = 0;
  }
};

const scheduleMobileContrastScan = (delayMs = CONTRAST_SCAN_DELAY_MS) => {
  const state = readMobileContrastGuardState();
  if (!isBrowser() || !state || state.scanTimer || state.scanFrame) return;
  state.scanTimer = window.setTimeout(() => {
    state.scanTimer = 0;
    if (readMobileContrastGuardState() !== state) return;
    if (shouldDelayContrastScan(state)) {
      scheduleMobileContrastScan(CONTRAST_SCROLL_QUIET_MS);
      return;
    }
    state.scanFrame = window.requestAnimationFrame(() => {
      state.scanFrame = 0;
      if (readMobileContrastGuardState() !== state) return;
      applyMobileContrastFixes(state);
    });
  }, delayMs);
};

export const refreshMobileContrastGuard = () => {
  if (!isBrowser()) return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('data-shop-mobile-contrast', 'true');
  }
  getMobileContrastGuardState(style);
  if (style.textContent !== CONTRAST_GUARD_CSS) {
    style.textContent = CONTRAST_GUARD_CSS;
  }
  if (style.parentElement !== document.head || document.head.lastElementChild !== style) {
    document.head.appendChild(style);
  }
  scheduleMobileContrastScan();
};

export const installMobileContrastGuard = () => {
  if (!isBrowser()) return () => undefined;

  let frameId = 0;
  const scheduleRefresh = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      refreshMobileContrastGuard();
    });
  };

  refreshMobileContrastGuard();
  const headObserver = new MutationObserver(scheduleRefresh);
  const bodyObserver = new MutationObserver(() => scheduleMobileContrastScan());
  const interactionListenerOptions: AddEventListenerOptions = { passive: true, capture: true };
  headObserver.observe(document.head, { childList: true });
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'open', 'aria-hidden'],
  });
  window.addEventListener('scroll', noteMobileInteraction, interactionListenerOptions);
  window.addEventListener('touchstart', noteMobileInteraction, interactionListenerOptions);
  window.addEventListener('touchmove', noteMobileInteraction, interactionListenerOptions);
  window.addEventListener('wheel', noteMobileInteraction, interactionListenerOptions);

  return () => {
    headObserver.disconnect();
    bodyObserver.disconnect();
    window.removeEventListener('scroll', noteMobileInteraction, interactionListenerOptions);
    window.removeEventListener('touchstart', noteMobileInteraction, interactionListenerOptions);
    window.removeEventListener('touchmove', noteMobileInteraction, interactionListenerOptions);
    window.removeEventListener('wheel', noteMobileInteraction, interactionListenerOptions);
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
    cancelMobileContrastScan();
  };
};
