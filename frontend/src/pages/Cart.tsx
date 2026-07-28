import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CartItem, ProductPublic as Product } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useMarket } from '../hooks/useMarket';
import { useCartQuantitySync } from '../hooks/useCartQuantitySync';
import { useCartCheckoutSubmit } from '../hooks/useCartCheckoutSubmit';
import { useCartItemMutations } from '../hooks/useCartItemMutations';
import { useCartQuantityActions } from '../hooks/useCartQuantityActions';
import { useCartRecoveryAdds } from '../hooks/useCartRecoveryAdds';
import { useCartSessionData } from '../hooks/useCartSessionData';
import { type SavedForLaterItem } from '../utils/saveForLater';
import { conversionConfig } from '../utils/conversionConfig';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import {
  canCartItemCheckout as canCheckout,
  deriveCartShippingSummary,
  roundCartMoney,
} from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import AddOnAssistant from '../components/AddOnAssistant';
import {
  buildCartActionLabels,
  buildCartHeroHighlightDescriptors,
  buildCartShippingPresentation,
  buildCartSummaryCardDescriptors,
  clearRecentProductsCache,
  deriveCartCheckoutMetrics,
  getLineTotal,
  getSavedAgeDays,
  getSavedForLaterItemsSnapshot,
  normalizePositiveProductId,
  resolveCartNextActionDescriptor,
} from './cartHelpers';
import { CartFullEmptyState, CartLoadErrorState, CartLoadingState } from './cartShellStates';
import { CartInlineEmptyPanel, CartOrderSummary, CartPaymentReturnBanner } from './cartConversionPanels';
import { CartLineItems } from './cartLineItems';
import { CartSavedPanel } from './cartSavedPanel';
import { CartBulkReadinessPanel, CartHeroOverview, CartRecentRecoveryPanel } from './cartOverviewPanels';
import './Cart.css';

export { deriveCartCheckoutMetrics } from './cartHelpers';

const Cart: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedItems, setSavedItems] = useState<SavedForLaterItem[]>(() => getSavedForLaterItemsSnapshot());
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [restoringSaved, setRestoringSaved] = useState(false);
  const [restoringSavedItemIds, setRestoringSavedItemIds] = useState<number[]>([]);
  const [addingRecentId, setAddingRecentId] = useState<number | null>(null);
  const [updatingItemIds, setUpdatingItemIds] = useState<number[]>([]);
  const [removingItemIds, setRemovingItemIds] = useState<number[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const checkoutSubmittingRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentReturnStatus = String(searchParams.get('payment') || '').trim().toLowerCase();
  const paymentReturnOrderNo = String(searchParams.get('orderNo') || searchParams.get('order') || '').trim();
  const paymentReturnIncomplete = paymentReturnStatus === 'cancelled'
    || paymentReturnStatus === 'canceled'
    || paymentReturnStatus === 'failed';
  const clearPaymentReturnParams = useCallback(() => {
    if (!searchParams.has('payment') && !searchParams.has('orderNo') && !searchParams.has('order') && !searchParams.has('orderId')) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    nextParams.delete('orderNo');
    nextParams.delete('order');
    nextParams.delete('orderId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const { t, language } = useLanguage();
  usePageTitle(t('pages.cart.title'));
  useDocumentMeta({
    title: t('pages.cart.title'),
    description: t('common.siteDescription'),
    path: '/cart',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { currency, market, formatMoney } = useMarket();
  const getCartItemName = useCallback((item: Pick<CartItem, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  ), [t]);
  const getCartProductName = useCallback((product: Pick<Product, 'id' | 'name'>) => (
    (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id })
  ), [t]);
  const {
    fetchCartItems,
    handleQuantitySyncError,
    invalidateCartSnapshotRequests,
    isCartMounted,
    isCurrentCartSnapshotRequest,
    mountedRef,
    resetCheckoutStateAfterCartMutation,
  } = useCartSessionData({
    cartItems,
    language,
    setCartItems,
    setLoadError,
    setLoadErrorMessage,
    setLoading,
    setQuantityDrafts,
    setRecentProducts,
    setSavedItems,
    setSelectedIds,
    t,
  });

  const hasStaleCartData = loadError && cartItems.length > 0;

  const clearQuantityPendingState = useCallback((itemIds: number[]) => {
    if (!mountedRef.current || itemIds.length === 0) return;
    setUpdatingItemIds((ids) => ids.filter((id) => !itemIds.includes(id)));
  }, [mountedRef]);

  const setQuantityPending = useCallback((itemId: number, pending: boolean) => {
    if (!mountedRef.current) return;
    setUpdatingItemIds((ids) => (
      pending
        ? Array.from(new Set([...ids, itemId]))
        : ids.filter((id) => id !== itemId)
    ));
  }, [mountedRef]);

  const {
    cancelQuantitySync: cancelPendingQuantitySync,
    flushPendingQuantityUpdates,
    hasPendingQuantityTimer,
    scheduleQuantitySync,
  } = useCartQuantitySync({
    isMounted: isCartMounted,
    onQuantitySyncError: handleQuantitySyncError,
    setQuantityPending,
    clearQuantityPending: clearQuantityPendingState,
  });

  const { updateQuantity } = useCartQuantityActions({
    hasPendingQuantityTimer,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    scheduleQuantitySync,
    setCartItems,
    setQuantityDrafts,
  });

  const {
    moveSavedItemToCart,
    moveSavedItemsToCart,
    removeItem,
    removeItems,
    removeSavedItem,
    saveForLater,
  } = useCartItemMutations({
    canCheckout,
    cancelPendingQuantitySync,
    clearRecentProductsCache,
    getCartItemName,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    language,
    mountedRef,
    removingItemIds,
    resetCheckoutStateAfterCartMutation,
    restoringSaved,
    restoringSavedItemIds,
    setCartItems,
    setRemovingItemIds,
    setRestoringSaved,
    setRestoringSavedItemIds,
    setSavedItems,
    setSelectedIds,
    t,
  });

  const cartCheckoutMetrics = useMemo(() => deriveCartCheckoutMetrics(cartItems, selectedIds), [cartItems, selectedIds]);
  const {
    checkoutBlocked,
    purchasableItems,
    purchasableUnitCount,
    selectedItems,
    selectedPurchasableCount,
    selectedTotal,
    selectedUnitCount,
    unavailableItems,
  } = cartCheckoutMetrics;
  const savedReminderItems = useMemo(
    () => savedItems.filter((item) => getSavedAgeDays(item.savedAt) >= conversionConfig.saveForLater.reminderAfterDays),
    [savedItems],
  );
  const showRecentlyViewedRecovery = recentProducts.length > 0 && (cartItems.length === 0 || purchasableItems.length === 0);

  const freeShippingThreshold = market.freeShippingThreshold;
  const {
    freeShippingRemaining,
    freeShippingUnlocked,
    benefitTarget,
    giftUnlocked,
    freeShippingPercent,
  } = useMemo(() => {
    const nextShippingSummary = deriveCartShippingSummary(selectedItems, freeShippingThreshold, selectedTotal);
    const freeShippingUnlocked = nextShippingSummary.freeShippingUnlocked;
    return {
      shippingSummary: nextShippingSummary,
      freeShippingRemaining: nextShippingSummary.remainingAmount,
      freeShippingUnlocked,
      benefitTarget: getNearestCartBenefitTarget(
        selectedTotal,
        freeShippingUnlocked ? 0 : freeShippingThreshold,
        currency,
      ),
      giftUnlocked: isGiftUnlocked(selectedTotal, currency),
      freeShippingPercent: nextShippingSummary.progressPercent,
    };
  }, [currency, freeShippingThreshold, selectedItems, selectedTotal]);
  const allSelected = purchasableItems.length > 0 && selectedPurchasableCount === purchasableItems.length;
  const savedItemsTotal = useMemo(
    () => roundCartMoney(savedItems.reduce((sum, item) => sum + getLineTotal(item), 0)),
    [savedItems],
  );
  const toggleAll = (checked: boolean) => {
    if (hasStaleCartData) return;
    setSelectedIds(checked ? purchasableItems.map((item) => item.id) : []);
  };

  const toggleOne = (itemId: number, checked: boolean) => {
    if (hasStaleCartData) return;
    setSelectedIds((ids) => (checked ? Array.from(new Set([...ids, itemId])) : ids.filter((id) => id !== itemId)));
  };

  const { goCheckout } = useCartCheckoutSubmit({
    canCheckout,
    checkoutSubmittingRef,
    flushPendingQuantityUpdates,
    hasStaleCartData,
    mountedRef,
    navigate,
    selectedItems,
    setCheckoutSubmitting,
    t,
  });

  const removeSelectedItems = () => {
    if (hasStaleCartData) return;
    removeItems(selectedIds, t('pages.cart.removedSelected', { count: selectedIds.length }));
  };

  const clearUnavailableItems = () => {
    if (hasStaleCartData) return;
    removeItems(unavailableItems.map((item) => item.id), t('pages.cart.clearedUnavailable', { count: unavailableItems.length }));
  };

  const refreshCartItems = useCallback(() => {
    setLoading(true);
    fetchCartItems();
  }, [fetchCartItems]);

  const renderCartAmountText = (label: string, amount: string) => {
    const parts = label.split(amount);
    if (parts.length <= 1) return label;
    return (
      <span className="cart-page__amountPhrase commerce-atomic">
        {parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const cartShippingPresentation = buildCartShippingPresentation({
    t,
    freeShippingUnlocked,
    freeShippingRemaining,
    freeShippingPercent,
    freeShippingRemainingMoney: formatMoney(freeShippingRemaining),
    savedItemsCount: savedItems.length,
    savedItemsTotalMoney: formatMoney(savedItemsTotal),
  });
  const freeShippingStatusTitle = cartShippingPresentation.freeShippingStatusHighlightAmount
    ? renderCartAmountText(
      cartShippingPresentation.freeShippingStatusTitle,
      cartShippingPresentation.freeShippingStatusHighlightAmount,
    )
    : cartShippingPresentation.freeShippingStatusTitle;
  const freeShippingGapTitle = cartShippingPresentation.freeShippingGapHighlightAmount
    ? renderCartAmountText(
      cartShippingPresentation.freeShippingGapTitle,
      cartShippingPresentation.freeShippingGapHighlightAmount,
    )
    : cartShippingPresentation.freeShippingGapTitle;
  const freeShippingProgressText = cartShippingPresentation.freeShippingProgressText;
  const savedValueText = cartShippingPresentation.savedValueHighlightAmount
    ? renderCartAmountText(
      cartShippingPresentation.savedValueText,
      cartShippingPresentation.savedValueHighlightAmount,
    )
    : cartShippingPresentation.savedValueText;

  const cartNextActionDescriptor = resolveCartNextActionDescriptor({
    t,
    hasStaleCartData,
    unavailableItemsCount: unavailableItems.length,
    selectedItemsCount: selectedItems.length,
    purchasableItemsCount: purchasableItems.length,
    purchasableUnitCount,
    selectedCanCheckout: selectedItems.some(canCheckout),
    selectedTotalText: formatMoney(selectedTotal),
    benefitTargetReason: benefitTarget?.reason,
    benefitTargetRemainingText: benefitTarget ? formatMoney(benefitTarget.remainingAmount) : null,
    savedReminderItemsCount: savedReminderItems.length,
  });
  const cartNextAction = {
    key: cartNextActionDescriptor.key,
    tone: cartNextActionDescriptor.tone,
    title: cartNextActionDescriptor.title,
    text: cartNextActionDescriptor.highlightAmount
      ? renderCartAmountText(cartNextActionDescriptor.text, cartNextActionDescriptor.highlightAmount)
      : cartNextActionDescriptor.text,
    label: cartNextActionDescriptor.label,
    action: () => {
      if (cartNextActionDescriptor.intent === 'refresh') {
        refreshCartItems();
        return;
      }
      if (cartNextActionDescriptor.intent === 'clear-unavailable') {
        clearUnavailableItems();
        return;
      }
      if (cartNextActionDescriptor.intent === 'select-ready') {
        toggleAll(true);
        return;
      }
      if (cartNextActionDescriptor.intent === 'find-addon') {
        document.getElementById('cart-add-on-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (cartNextActionDescriptor.intent === 'restore-saved') {
        moveSavedItemsToCart(savedReminderItems);
        return;
      }
      goCheckout();
    },
  };
  const cartHeroHighlights = buildCartHeroHighlightDescriptors({
    t,
    selectedTotalText: formatMoney(selectedTotal),
    freeShippingStatusTitle: typeof freeShippingStatusTitle === 'string' ? freeShippingStatusTitle : freeShippingProgressText,
    freeShippingProgressText,
    savedValueText: typeof savedValueText === 'string' ? savedValueText : t('pages.cart.saveForLaterTitle'),
  }).map((item) => (
    item.key === 'shipping'
      ? { ...item, title: freeShippingStatusTitle }
      : item.key === 'saved'
        ? { ...item, text: savedValueText }
        : item
  ));
  const cartSummaryCards = buildCartSummaryCardDescriptors({
    t,
    selectedUnitCount,
    selectedTotalText: formatMoney(selectedTotal),
    freeShippingGapTitle: typeof freeShippingGapTitle === 'string' ? freeShippingGapTitle : freeShippingProgressText,
    freeShippingProgressText,
    savedItemsCount: savedItems.length,
  }).map((item) => (
    item.key === 'shipping'
      ? { ...item, title: freeShippingGapTitle }
      : item
  ));
  const {
    retryCartLoadActionLabel,
    emptyBrowseActionLabel,
    emptyCouponsActionLabel,
    emptyPetFinderActionLabel,
    emptyHistoryActionLabel,
    cartNextActionLabel,
    cartTopNextActionLabel,
    browseAllProductsActionLabel,
    recentRecoveryBrowseActionLabel,
    deleteSelectedActionLabel,
    clearUnavailableActionLabel,
    selectReadyActionLabel,
    checkoutActionLabel,
    moveAllSavedActionLabel,
    restoreSavedReminderActionLabel,
    paymentCancelledResumeLabel,
    paymentCancelledTrackLabel,
    paymentCancelledCheckoutLabel,
  } = buildCartActionLabels({
    t,
    cartNextActionTitle: cartNextAction.title,
    cartNextActionPrimaryLabel: cartNextAction.label,
    selectedIdsCount: selectedIds.length,
    unavailableItemsCount: unavailableItems.length,
    purchasableItemsCount: purchasableItems.length,
    selectedUnitCount,
    selectedTotalText: formatMoney(selectedTotal),
    savedItemsCount: savedItems.length,
    savedReminderItemsCount: savedReminderItems.length,
    paymentReturnOrderNo,
  });

  const {
    addRecentProduct,
    addSuggestedProduct,
  } = useCartRecoveryAdds({
    canCheckout,
    clearRecentProductsCache,
    hasStaleCartData,
    invalidateCartSnapshotRequests,
    isCurrentCartSnapshotRequest,
    language,
    mountedRef,
    navigate,
    normalizePositiveProductId,
    setAddingRecentId,
    setCartItems,
    setSelectedIds,
    t,
  });

  const paymentReturnBanner = paymentReturnIncomplete ? (
    <CartPaymentReturnBanner
      cartItemCount={cartItems.length}
      clearPaymentReturnParams={clearPaymentReturnParams}
      navigate={navigate}
      paymentCancelledCheckoutLabel={paymentCancelledCheckoutLabel}
      paymentCancelledResumeLabel={paymentCancelledResumeLabel}
      paymentCancelledTrackLabel={paymentCancelledTrackLabel}
      paymentReturnOrderNo={paymentReturnOrderNo}
      paymentReturnStatus={paymentReturnStatus}
      t={t}
    />
  ) : null;

  if (loading) {
    return <CartLoadingState language={language} t={t} />;
  }

  if (!loading && loadError && cartItems.length === 0) {
    return (
      <CartLoadErrorState
        language={language}
        loadErrorMessage={loadErrorMessage}
        navigate={navigate}
        onRetry={() => { setLoading(true); fetchCartItems(); }}
        paymentReturnBanner={paymentReturnBanner}
        retryCartLoadActionLabel={retryCartLoadActionLabel}
        t={t}
      />
    );
  }

  if (!loading && cartItems.length === 0 && savedItems.length === 0 && recentProducts.length === 0) {
    return (
      <CartFullEmptyState
        emptyBrowseActionLabel={emptyBrowseActionLabel}
        emptyCouponsActionLabel={emptyCouponsActionLabel}
        emptyHistoryActionLabel={emptyHistoryActionLabel}
        emptyPetFinderActionLabel={emptyPetFinderActionLabel}
        formatMoney={formatMoney}
        freeShippingThreshold={freeShippingThreshold}
        language={language}
        navigate={navigate}
        paymentReturnBanner={paymentReturnBanner}
        t={t}
      />
    );
  }

  return (
    <div className={`cart-page cart-page--${language}`}>
      <ShopBreadcrumb
        ariaLabel={t('pages.cart.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'products', label: t('pages.productList.title'), path: '/products' },
          { key: 'cart', label: t('pages.cart.title') },
        ]}
      />
      {paymentReturnBanner}
      <CartHeroOverview
        browseAllProductsActionLabel={browseAllProductsActionLabel}
        cartHeroHighlights={cartHeroHighlights}
        cartItemsCount={cartItems.length}
        cartNextAction={cartNextAction}
        cartNextActionLabel={cartNextActionLabel}
        cartSummaryCards={cartSummaryCards}
        cartTopNextActionLabel={cartTopNextActionLabel}
        emptyBrowseActionLabel={emptyBrowseActionLabel}
        emptyCouponsActionLabel={emptyCouponsActionLabel}
        emptyHistoryActionLabel={emptyHistoryActionLabel}
        emptyPetFinderActionLabel={emptyPetFinderActionLabel}
        hasStaleCartData={hasStaleCartData}
        loadErrorMessage={loadErrorMessage}
        navigate={navigate}
        refreshCartItems={refreshCartItems}
        retryCartLoadActionLabel={retryCartLoadActionLabel}
        t={t}
        unavailableCount={unavailableItems.length}
      />
      <CartRecentRecoveryPanel
        addRecentProduct={addRecentProduct}
        addingRecentId={addingRecentId}
        formatMoney={formatMoney}
        getCartProductName={getCartProductName}
        hasStaleCartData={hasStaleCartData}
        navigate={navigate}
        recentProducts={recentProducts}
        recentRecoveryBrowseActionLabel={recentRecoveryBrowseActionLabel}
        showRecentlyViewedRecovery={showRecentlyViewedRecovery}
        t={t}
      />
      {cartItems.length > 0 ? (
        <>
          <CartBulkReadinessPanel
            allSelected={allSelected}
            cartNextAction={cartNextAction}
            cartNextActionLabel={cartNextActionLabel}
            checkoutBlocked={checkoutBlocked}
            clearUnavailableActionLabel={clearUnavailableActionLabel}
            clearUnavailableItems={clearUnavailableItems}
            deleteSelectedActionLabel={deleteSelectedActionLabel}
            freeShippingGapTitle={freeShippingGapTitle}
            freeShippingRemaining={freeShippingRemaining}
            freeShippingUnlocked={freeShippingUnlocked}
            giftUnlocked={giftUnlocked}
            hasStaleCartData={hasStaleCartData}
            purchasableItemsCount={purchasableItems.length}
            purchasableUnitCount={purchasableUnitCount}
            removeSelectedItems={removeSelectedItems}
            removingItemIds={removingItemIds}
            restoringSaved={restoringSaved}
            selectReadyActionLabel={selectReadyActionLabel}
            selectedIds={selectedIds}
            selectedPurchasableCount={selectedPurchasableCount}
            selectedUnitCount={selectedUnitCount}
            t={t}
            toggleAll={toggleAll}
            unavailableItems={unavailableItems}
          />
          <CartLineItems
            allSelected={allSelected}
            cartItems={cartItems}
            checkoutSubmitting={checkoutSubmitting}
            formatMoney={formatMoney}
            getCartItemName={getCartItemName}
            hasStaleCartData={hasStaleCartData}
            language={language}
            loading={loading}
            quantityDrafts={quantityDrafts}
            removeItem={removeItem}
            removingItemIds={removingItemIds}
            saveForLater={saveForLater}
            selectedIds={selectedIds}
            selectedPurchasableCount={selectedPurchasableCount}
            setQuantityDrafts={setQuantityDrafts}
            t={t}
            toggleAll={toggleAll}
            toggleOne={toggleOne}
            updateQuantity={updateQuantity}
            updatingItemIds={updatingItemIds}
          />
          <CartOrderSummary
            checkoutActionLabel={checkoutActionLabel}
            checkoutBlocked={checkoutBlocked}
            checkoutSubmitting={checkoutSubmitting}
            formatMoney={formatMoney}
            freeShippingPercent={freeShippingPercent}
            freeShippingStatusTitle={freeShippingStatusTitle}
            freeShippingUnlocked={freeShippingUnlocked}
            goCheckout={goCheckout}
            hasStaleCartData={hasStaleCartData}
            selectedTotal={selectedTotal}
            selectedUnitCount={selectedUnitCount}
            t={t}
          />
          {selectedItems.length > 0 && !hasStaleCartData ? (
            <div className="cart-page__addOn" id="cart-add-on-assistant">
              {benefitTarget ? (
                <AddOnAssistant
                  cartProductIds={cartItems.map((item) => item.productId)}
                  remainingAmount={benefitTarget.remainingAmount}
                  reason={benefitTarget.reason}
                  onAdd={addSuggestedProduct}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <CartInlineEmptyPanel
          emptyBrowseActionLabel={emptyBrowseActionLabel}
          emptyCouponsActionLabel={emptyCouponsActionLabel}
          emptyHistoryActionLabel={emptyHistoryActionLabel}
          emptyPetFinderActionLabel={emptyPetFinderActionLabel}
          navigate={navigate}
          t={t}
        />
      )}
      <CartSavedPanel
        formatMoney={formatMoney}
        getCartItemName={getCartItemName}
        getSavedAgeDays={getSavedAgeDays}
        hasStaleCartData={hasStaleCartData}
        language={language}
        moveAllSavedActionLabel={moveAllSavedActionLabel}
        moveSavedItemToCart={moveSavedItemToCart}
        moveSavedItemsToCart={moveSavedItemsToCart}
        navigate={navigate}
        removeSavedItem={removeSavedItem}
        restoreSavedReminderActionLabel={restoreSavedReminderActionLabel}
        restoringSaved={restoringSaved}
        restoringSavedItemIds={restoringSavedItemIds}
        savedItems={savedItems}
        savedReminderItems={savedReminderItems}
        savedValueText={savedValueText}
        t={t}
      />
    </div>
  );
};

export default Cart;
