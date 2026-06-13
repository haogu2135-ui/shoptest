const STYLE_ID = 'shop-android-ui-final-guard';

const ANDROID_UI_FINAL_GUARD_CSS = `
@media (max-width: 860px) {
  :root {
    --shop-android-touch-target: 44px;
  }

  html,
  body,
  #root {
    max-width: 100vw;
    overflow-x: hidden;
    overflow-x: clip;
  }

  .shop-app-shell,
  .admin-layout,
  .ant-modal-root,
  .ant-drawer,
  .ant-popover,
  .ant-dropdown,
  .ant-select-dropdown,
  .ant-cascader-dropdown,
  .ant-picker-dropdown {
    box-sizing: border-box !important;
    max-width: 100vw !important;
  }

  .shop-app-shell,
  .admin-layout {
    overflow-x: hidden !important;
    overflow-x: clip !important;
  }

  :where(
    .shop-app-shell,
    .admin-layout,
    .ant-modal-root,
    .ant-drawer,
    .ant-popover,
    .ant-dropdown,
    .ant-select-dropdown,
    .ant-cascader-dropdown,
    .ant-picker-dropdown
  ) :where(
    button,
    [role="button"],
    a.ant-btn,
    .ant-btn,
    .ant-input,
    textarea.ant-input,
    .ant-input-affix-wrapper,
    .ant-input-search,
    .ant-input-number,
    .ant-input-number-input,
    .ant-select-selector,
    .ant-cascader-picker,
    .ant-picker,
    .ant-radio-button-wrapper,
    .ant-checkbox-wrapper,
    .ant-segmented-item,
    .ant-tabs-tab,
    .ant-pagination-item,
    .ant-pagination-prev,
    .ant-pagination-next,
    .ant-dropdown-menu-item,
    .ant-select-item-option,
    .ant-cascader-menu-item
  ) {
    box-sizing: border-box !important;
    min-height: var(--shop-android-touch-target) !important;
    touch-action: manipulation;
  }

  :where(
    .shop-app-shell,
    .admin-layout,
    .ant-modal-root,
    .ant-drawer,
    .ant-popover,
    .ant-dropdown
  ) :where(
    .ant-btn-icon-only,
    .ant-modal-close,
    .ant-drawer-close,
    .ant-pagination-prev,
    .ant-pagination-next,
    button[aria-label],
    [role="button"][aria-label]
  ) {
    min-width: var(--shop-android-touch-target) !important;
  }

  :where(
    .shop-app-shell,
    .admin-layout,
    .ant-modal-root,
    .ant-drawer
  ) :where(
    input,
    textarea,
    .ant-input,
    .ant-input-number-input,
    .ant-select-selection-search-input,
    .ant-picker-input > input
  ) {
    font-size: 16px !important;
  }

  .ant-modal-root .ant-modal {
    width: min(800px, calc(100vw - 16px)) !important;
    max-width: calc(100vw - 16px) !important;
    margin: 8px auto !important;
  }

  .ant-modal-root .ant-modal-content,
  .ant-drawer .ant-drawer-content {
    max-height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
    overflow: hidden !important;
  }

  .ant-modal-root .ant-modal-body,
  .ant-drawer .ant-drawer-body {
    min-height: 0 !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .ant-modal-root .ant-modal-footer,
  .ant-drawer .ant-drawer-footer {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
  }

  .ant-modal-root .ant-modal-footer .ant-btn,
  .ant-drawer .ant-drawer-footer .ant-btn {
    flex: 1 1 128px;
    margin-inline-start: 0 !important;
    white-space: normal !important;
  }

  .cart-page__quantityStepper,
  .cart-page__quantityStepper .ant-btn,
  .cart-page__quantityInput,
  .cart-page__quantityInput .ant-input-number-input {
    min-height: 48px !important;
    height: 48px !important;
  }

  .cart-page__quantityStepper .ant-btn {
    min-width: 48px !important;
    width: 48px !important;
  }

  .product-detail-page .product-mobile-thumbs {
    scroll-snap-type: x proximity !important;
  }

  .product-detail-page .product-mobile-thumbs__button {
    flex: 0 0 64px !important;
    width: 64px !important;
    min-width: 64px !important;
    height: 64px !important;
    min-height: 64px !important;
  }

  .admin-dashboard__readiness,
  .notifications-page__assistant,
  .product-compare__decision,
  .order-tracking-page__journey,
  .shopify-variant-row {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}

@supports not (overflow: clip) {
  @media (max-width: 860px) {
    html,
    body,
    #root,
    .shop-app-shell,
    .admin-layout {
      overflow-x: hidden !important;
    }
  }
}
`;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export const refreshAndroidUiFinalGuard = () => {
  if (!isBrowser()) return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('data-shop-android-ui-final-guard', 'true');
  }
  if (style.textContent !== ANDROID_UI_FINAL_GUARD_CSS) {
    style.textContent = ANDROID_UI_FINAL_GUARD_CSS;
  }
  if (style.parentElement !== document.head || document.head.lastElementChild !== style) {
    document.head.appendChild(style);
  }
};

export const installAndroidUiFinalGuard = () => {
  if (!isBrowser()) return () => undefined;

  let frameId = 0;
  const scheduleRefresh = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      refreshAndroidUiFinalGuard();
    });
  };

  refreshAndroidUiFinalGuard();
  const headObserver = new MutationObserver(scheduleRefresh);
  headObserver.observe(document.head, { childList: true });

  return () => {
    headObserver.disconnect();
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
  };
};
