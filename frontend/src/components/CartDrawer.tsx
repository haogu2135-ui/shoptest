import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Drawer, Empty, InputNumber, List, message, Popconfirm, Progress, Space, Tag, Typography } from 'antd';
import { AppleOutlined, CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined, DeleteOutlined, GoogleOutlined, ShoppingOutlined, WalletOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { cartApi } from '../api';
import type { CartItem, ProductPublic as Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { useCartQuantitySync } from '../hooks/useCartQuantitySync';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, removeGuestCartItems, updateGuestCartQuantity } from '../utils/guestCart';
import { getSavedForLaterItems, replaceSavedForLaterItems, saveCartItemForLater } from '../utils/saveForLater';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { hasAuthenticatedCartSession, syncCheckoutCartItemIds } from '../utils/cartSession';
import {
  canCartItemCheckout as canCheckout,
  cartImageFallback,
  deriveCartShippingSummary,
  getCartItemLowStockCount,
  getCartLineAmount,
  getCartQuantityLimit,
  isCartItemAvailable as isAvailable,
  normalizeCartQuantity,
  resolveCartImage,
  roundCartMoney,
} from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getLocalStorageItem, removeSessionStorageItem, setSessionStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import { useNativeBackHandler } from '../utils/nativeBack';
import './CartDrawer.css';
import '../styles/mobile-page-contrast.css';

const { Text } = Typography;
const AddOnAssistant = React.lazy(() => import('./AddOnAssistant'));
const PetPersonalizedAssistant = React.lazy(() => import('./PetPersonalizedAssistant'));
const expressPaymentCodesByCurrency: Record<string, string[]> = {
  MXN: ['MERCADO_PAGO', 'SPEI', 'OXXO', 'MX_LOCAL_CARD'],
  USD: ['SHOP_PAY', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY'],
  CAD: ['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'STRIPE'],
  EUR: ['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'STRIPE'],
  GBP: ['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'STRIPE'],
};

const expressPaymentIcon = (code: string) => {
  if (code === 'APPLE_PAY') return <AppleOutlined />;
  if (code === 'GOOGLE_PAY') return <GoogleOutlined />;
  if (code === 'STRIPE' || code === 'MX_LOCAL_CARD') return <CreditCardOutlined />;
  return <WalletOutlined />;
};

const applyCartImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src === cartImageFallback) return;
  event.currentTarget.removeAttribute('srcset');
  event.currentTarget.src = cartImageFallback;
};

type CartDrawerOpenRequest = {
  id: number;
  items?: CartItem[];
};

type CartDrawerProps = {
  initialOpenRequest?: CartDrawerOpenRequest | null;
  onReady?: () => void;
};

const CartDrawer: React.FC<CartDrawerProps> = ({ initialOpenRequest, onReady }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutPaymentSubmitting, setCheckoutPaymentSubmitting] = useState<string | null>(null);
  const [updatingQuantityIds, setUpdatingQuantityIds] = useState<Record<number, boolean>>({});
  const [savingForLaterIds, setSavingForLaterIds] = useState<Record<number, boolean>>({});
  const mountedRef = useRef(true);
  const loadCartRequestRef = useRef(0);
  const refreshCartTimerRef = useRef<number | null>(null);
  const handledOpenRequestRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { currency, market, formatMoney } = useMarket();
  const getCartItemName = useCallback((item: Pick<CartItem, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  ), [t]);
  const closeDrawer = useCallback(() => setOpen(false), []);

  useNativeBackHandler(open, () => {
    closeDrawer();
    return true;
  });

  const loadCart = useCallback(async () => {
    const requestId = loadCartRequestRef.current + 1;
    loadCartRequestRef.current = requestId;
    const authenticated = hasAuthenticatedCartSession();
    if (!authenticated) {
      if (mountedRef.current) setItems(getGuestCartItems());
      return;
    }
    if (mountedRef.current) setLoading(true);
    try {
      const res = await cartApi.getItems(0);
      if (!mountedRef.current || loadCartRequestRef.current !== requestId) return;
      setItems(res.data);
    } catch (error: unknown) {
      if (mountedRef.current && loadCartRequestRef.current === requestId) {
        if (isAuthExpiredError(error)) {
          setItems(getGuestCartItems());
        } else {
          message.error(getApiErrorMessage(error, t('pages.cart.fetchFailed'), language));
        }
      }
    } finally {
      if (mountedRef.current && loadCartRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [language, t]);

  const isCartDrawerMounted = useCallback(() => mountedRef.current, []);

  const clearQuantityPendingState = useCallback((itemIds: number[]) => {
    if (!mountedRef.current || itemIds.length === 0) return;
    setUpdatingQuantityIds((current) => {
      const next = { ...current };
      itemIds.forEach((itemId) => {
        delete next[itemId];
      });
      return next;
    });
  }, []);

  const setQuantityPending = useCallback((itemId: number, pending: boolean) => {
    if (!mountedRef.current) return;
    setUpdatingQuantityIds((current) => {
      const next = { ...current };
      if (pending) {
        next[itemId] = true;
      } else {
        delete next[itemId];
      }
      return next;
    });
  }, []);

  const handleQuantitySyncError = useCallback(async (err: unknown) => {
    message.error(getApiErrorMessage(err, t('pages.cart.quantityFailed'), language));
    await loadCart();
  }, [language, loadCart, t]);

  const {
    cancelQuantitySync,
    flushPendingQuantityUpdates,
    scheduleQuantitySync,
  } = useCartQuantitySync({
    isMounted: isCartDrawerMounted,
    onQuantitySyncError: handleQuantitySyncError,
    setQuantityPending,
    clearQuantityPending: clearQuantityPendingState,
  });

  const openCart = useCallback((detailItems?: CartItem[]) => {
    setOpen(true);
    if (Array.isArray(detailItems)) {
      setItems(detailItems);
      setLoading(false);
      return;
    }
    loadCart();
  }, [loadCart]);

  const scheduleCartRefresh = useCallback(() => {
    if (refreshCartTimerRef.current !== null) {
      window.clearTimeout(refreshCartTimerRef.current);
    }
    refreshCartTimerRef.current = window.setTimeout(() => {
      refreshCartTimerRef.current = null;
      loadCart();
    }, 220);
  }, [loadCart]);

  useEffect(() => {
    const handleOpenCart = (event: Event) => {
      const detailItems = (event as CustomEvent<{ items?: CartItem[] }>).detail?.items;
      openCart(detailItems);
    };
    const refreshCart = (event: Event) => {
      const detailItems = (event as CustomEvent<{ items?: CartItem[] }>).detail?.items;
      if (Array.isArray(detailItems)) {
        setItems(detailItems);
        setLoading(false);
        return;
      }
      scheduleCartRefresh();
    };
    const refreshGuestCartFromStorage = (event: StorageEvent) => {
      if (event.key === 'shop-guest-cart' && !getLocalStorageItem('token')) {
        scheduleCartRefresh();
      }
    };
    window.addEventListener('shop:open-cart', handleOpenCart);
    window.addEventListener('shop:cart-updated', refreshCart);
    window.addEventListener('storage', refreshGuestCartFromStorage);
    onReady?.();
    return () => {
      window.removeEventListener('shop:open-cart', handleOpenCart);
      window.removeEventListener('shop:cart-updated', refreshCart);
      window.removeEventListener('storage', refreshGuestCartFromStorage);
    };
  }, [onReady, openCart, scheduleCartRefresh]);

  useEffect(() => {
    if (!initialOpenRequest || handledOpenRequestRef.current === initialOpenRequest.id) return;
    handledOpenRequestRef.current = initialOpenRequest.id;
    openCart(initialOpenRequest.items);
  }, [initialOpenRequest, openCart]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (refreshCartTimerRef.current !== null) {
      window.clearTimeout(refreshCartTimerRef.current);
      refreshCartTimerRef.current = null;
    }
  }, []);

  const checkoutItems = useMemo(() => items.filter(canCheckout), [items]);
  const blockedItems = useMemo(() => items.filter((item) => !canCheckout(item)), [items]);
  const subtotal = useMemo(() => roundCartMoney(
    checkoutItems.reduce((sum, item) => sum + getCartLineAmount(item), 0),
  ), [checkoutItems]);
  const blockedCount = blockedItems.length;
  const checkoutUnitCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = checkoutItems.filter((item) => getCartItemLowStockCount(item) !== null).length;
  const pendingQuantityCount = Object.values(updatingQuantityIds).filter(Boolean).length;
  const hasPendingQuantityUpdates = pendingQuantityCount > 0;
  const freeShippingThreshold = market.freeShippingThreshold;
  const shippingSummary = deriveCartShippingSummary(checkoutItems, freeShippingThreshold, subtotal);
  const remaining = shippingSummary.remainingAmount;
  const freeShippingUnlocked = shippingSummary.freeShippingUnlocked;
  const benefitTarget = getNearestCartBenefitTarget(subtotal, freeShippingUnlocked ? 0 : freeShippingThreshold, currency);
  const giftUnlocked = isGiftUnlocked(subtotal, currency);
  const progress = shippingSummary.progressPercent;
  const renderDrawerAmountText = (label: string, amount: string) => {
    const parts = label.split(amount);
    if (parts.length <= 1) return label;
    return (
      <span className="cart-drawer__amountPhrase commerce-atomic">
        {parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  };
  const freeShippingRemainingText = (amount: number) => renderDrawerAmountText(
    t('pages.cart.freeShippingRemaining', { amount: formatMoney(amount) }),
    formatMoney(amount),
  );
  const freeShippingStatusText = freeShippingUnlocked
    ? t('pages.cart.freeShippingUnlocked')
    : remaining > 0
      ? freeShippingRemainingText(remaining)
      : t('pages.cart.shippingCalculatedAtCheckout');
  const drawerReady = checkoutItems.length > 0 && blockedCount === 0;
  const shippingStatusText = [
    drawerReady ? t('pages.cart.drawerReadyTitle') : t('pages.cart.drawerReviewTitle'),
    t('pages.cart.drawerReadyText', { count: checkoutUnitCount, blocked: blockedCount, low: lowStockCount }),
    ...(hasPendingQuantityUpdates ? [t('pages.cart.drawerSyncingQuantity', { count: pendingQuantityCount })] : []),
  ].join(' · ');
  const expressHint = checkoutItems.length === 0
    ? t('pages.cart.drawerExpressEmpty')
    : blockedCount > 0
      ? t('pages.cart.drawerExpressBlocked', { count: blockedCount })
      : benefitTarget
      ? benefitTarget.reason === 'gift'
        ? renderDrawerAmountText(t('pages.cart.drawerExpressGiftHint', { amount: formatMoney(benefitTarget.remainingAmount) }), formatMoney(benefitTarget.remainingAmount))
        : renderDrawerAmountText(t('pages.cart.drawerExpressAddOnHint', { amount: formatMoney(benefitTarget.remainingAmount) }), formatMoney(benefitTarget.remainingAmount))
      : t('pages.cart.drawerExpressReadyHint');
  const expressPaymentCodes = expressPaymentCodesByCurrency[currency] || expressPaymentCodesByCurrency.USD;
  const drawerHighlights = [
    {
      key: 'subtotal',
      title: t('common.subtotal'),
      text: formatMoney(subtotal),
    },
    {
      key: 'ready',
      title: t('pages.cart.readyItems', { count: checkoutItems.length }),
      text: t('pages.cart.selectedSummary', { count: checkoutUnitCount }),
    },
    {
      key: 'blocked',
      title: t('pages.cart.blockedItems', { count: blockedCount }),
      text: blockedCount > 0 ? t('pages.cart.drawerReviewTitle') : t('pages.cart.drawerReadyTitle'),
    },
  ];

  const updateQuantity = (item: CartItem, quantity: number) => {
    const normalizedQuantity = normalizeCartQuantity(item, quantity);
    const authenticated = hasAuthenticatedCartSession();
    if (!authenticated) {
      setItems(updateGuestCartQuantity(item.id, normalizedQuantity));
      return;
    }

    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: normalizedQuantity } : entry));
    scheduleQuantitySync(item.id, normalizedQuantity);
  };

  const removeItem = async (item: CartItem) => {
    cancelQuantitySync([item.id]);
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(item.id);
        if (!mountedRef.current) return;
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));
    }
  };

  const saveForLater = async (item: CartItem) => {
    if (savingForLaterIds[item.id]) return;
    cancelQuantitySync([item.id]);
    const previousSavedItems = getSavedForLaterItems();
    const savedItem = saveCartItemForLater(item);
    if (!savedItem) {
      message.error(t('messages.operationFailed'));
      return;
    }
    setSavingForLaterIds((current) => ({ ...current, [item.id]: true }));
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(item.id);
        if (!mountedRef.current) return;
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      message.success(t('pages.cart.savedForLater'));
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch (err: unknown) {
      replaceSavedForLaterItems(previousSavedItems);
      if (!mountedRef.current) return;
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      if (mountedRef.current) {
        setSavingForLaterIds((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }
    }
  };

  const goCheckout = async (paymentMethod?: string) => {
    if (checkoutSubmitting) return;
    if (checkoutItems.length === 0) {
      message.warning(t('pages.cart.chooseItems'));
      return;
    }
    if (paymentMethod && !drawerReady) {
      message.warning(t('pages.cart.drawerExpressBlocked', { count: blockedCount }));
      return;
    }
    setCheckoutSubmitting(true);
    setCheckoutPaymentSubmitting(paymentMethod || 'standard');
    try {
      await flushPendingQuantityUpdates(checkoutItems);
      syncCheckoutCartItemIds(checkoutItems);
      if (paymentMethod) {
        setSessionStorageItem('checkoutPaymentMethod', paymentMethod);
      } else {
        removeSessionStorageItem('checkoutPaymentMethod');
      }
      setOpen(false);
      navigate('/checkout');
    } catch (error) {
      reportNonBlockingError('CartDrawer.goCheckout', error);
      return;
    } finally {
      if (mountedRef.current) {
        setCheckoutSubmitting(false);
        setCheckoutPaymentSubmitting(null);
      }
    }
  };

  const clearBlockedItems = async () => {
    if (blockedItems.length === 0) return;
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        const results = await allSettledWithConcurrency(
          blockedItems,
          (item) => cartApi.removeItem(item.id),
        );
        if (!mountedRef.current) return;
        const removedIds = new Set(
          blockedItems
            .filter((_, index) => results[index]?.status === 'fulfilled')
            .map((item) => item.id),
        );
        if (removedIds.size === 0) {
          const firstFailed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
          message.error(getApiErrorMessage(firstFailed?.reason, t('messages.operationFailed'), language));
          return;
        }
        setItems((current) => current.filter((item) => !removedIds.has(item.id)));
        dispatchDomEvent('shop:cart-updated');
        message.success(t('pages.cart.drawerClearedBlocked', { count: removedIds.size }));
      } else {
        setItems(removeGuestCartItems(blockedItems.map((item) => item.id)));
        message.success(t('pages.cart.drawerClearedBlocked', { count: blockedItems.length }));
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    }
  };

  const addSuggestedProduct = async (product: Product) => {
    const authenticated = hasAuthenticatedCartSession();
    if (authenticated) {
      await cartApi.addItem(0, product.id, 1);
      const response = await cartApi.getItems(0);
      if (!mountedRef.current) return;
      setItems(response.data);
      dispatchDomEvent('shop:cart-updated', { items: response.data });
      return;
    }
    addGuestCartItem(product, 1);
    const nextItems = getGuestCartItems();
    setItems(nextItems);
    dispatchDomEvent('shop:cart-updated', { items: nextItems });
  };

  const drawerNextAction = (() => {
    if (items.length === 0) {
      return null;
    }

    if (blockedCount > 0) {
      return {
        tone: 'attention',
        icon: <ClockCircleOutlined />,
        title: t('pages.cart.nextActionClearTitle'),
        text: t('pages.cart.nextActionClearText', { count: blockedCount }),
        label: t('pages.cart.drawerClearBlocked'),
        onClick: clearBlockedItems,
      };
    }

    if (checkoutItems.length > 0 && benefitTarget) {
      return {
        tone: 'boost',
        icon: <ShoppingOutlined />,
        title: benefitTarget.reason === 'gift'
          ? t('pages.cart.nextActionGiftTitle')
          : t('pages.cart.nextActionShippingTitle'),
        text: benefitTarget.reason === 'gift'
          ? renderDrawerAmountText(t('pages.cart.nextActionGiftText', { amount: formatMoney(benefitTarget.remainingAmount) }), formatMoney(benefitTarget.remainingAmount))
          : renderDrawerAmountText(t('pages.cart.nextActionShippingText', { amount: formatMoney(benefitTarget.remainingAmount) }), formatMoney(benefitTarget.remainingAmount)),
        label: t('pages.cart.nextActionFindAddOn'),
        onClick: () => navigate('/products'),
      };
    }

    return {
      tone: 'ready',
      icon: <CheckCircleOutlined />,
      title: t('pages.cart.nextActionCheckoutTitle'),
      text: renderDrawerAmountText(t('pages.cart.nextActionCheckoutText', { amount: formatMoney(subtotal) }), formatMoney(subtotal)),
      label: t('pages.cart.checkout'),
      onClick: () => goCheckout(),
    };
  })();
  const clearBlockedActionLabel = `${t('pages.cart.drawerClearBlocked')}: ${t('pages.cart.blockedItems', { count: blockedCount })}`;
  const checkoutDrawerActionLabel = `${t('pages.cart.checkout')}: ${formatMoney(subtotal)}`;
  const fullCartActionLabel = `${t('pages.cart.viewFullCart')}: ${t('pages.cart.yourCart')}`;
  const emptyDrawerBrowseActionLabel = `${t('pages.cart.browse')}: ${t('pages.cart.empty')}`;

  return (
    <Drawer
      title={t('pages.cart.yourCart')}
      placement="right"
      width="min(420px, 100vw)"
      open={open}
      onClose={closeDrawer}
      rootClassName="cart-drawer__root"
      className={`cart-drawer cart-drawer--${language}`}
      styles={{ body: { padding: 16 } }}
      extra={<Text strong className="commerce-money">{formatMoney(subtotal)}</Text>}
    >
      <div className="cart-drawer__content">
        <section className="cart-drawer__hero">
          {drawerHighlights.map((item) => (
            <article key={item.key} className="cart-drawer__heroStat">
              <strong>{item.title}</strong>
              <span className={item.key === 'subtotal' ? 'commerce-money' : 'commerce-atomic'}>{item.text}</span>
            </article>
          ))}
        </section>

        <div className={`cart-drawer__shipping${drawerReady ? ' cart-drawer__shipping--ready' : ''}`} role="status" aria-live="polite">
          <div className="cart-drawer__shippingHeader">
            <CheckCircleOutlined className={`cart-drawer__shippingIcon${drawerReady ? ' cart-drawer__shippingIcon--ready' : ''}`} />
            <div className="cart-drawer__shippingText">
              <Text strong>{freeShippingStatusText}</Text>
              <Text type="secondary" className="cart-drawer__shippingStatus">
                {shippingStatusText}
              </Text>
            </div>
          </div>
          <Progress
            percent={progress}
            showInfo={false}
            strokeColor="#124734"
            size="small"
            aria-label={freeShippingUnlocked
              ? t('pages.cart.freeShippingUnlocked')
              : remaining > 0
                ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(remaining) })
                : t('pages.cart.shippingCalculatedAtCheckout')}
          />
          {giftUnlocked ? (
            <Text type="secondary" className="cart-drawer__shippingGift">{t('pages.cart.drawerGiftUnlocked')}</Text>
          ) : null}
        </div>

        {drawerNextAction ? (
          <section className={`cart-drawer__nextAction cart-drawer__nextAction--${drawerNextAction.tone}`} aria-label={t('pages.cart.nextActionEyebrow')}>
            <span className="cart-drawer__nextActionIcon">{drawerNextAction.icon}</span>
            <span className="cart-drawer__nextActionCopy">
              <Text strong>{drawerNextAction.title}</Text>
              <Text type="secondary">{drawerNextAction.text}</Text>
            </span>
            {drawerNextAction.tone === 'attention' ? (
              <Popconfirm
                classNames={{ root: 'shop-mobile-popup-layer cart-drawer-popconfirm' }}
                title={t('pages.cart.drawerClearBlockedConfirm', { count: blockedCount })}
                onConfirm={drawerNextAction.onClick}
                okText={t('pages.cart.drawerClearBlocked')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': clearBlockedActionLabel, title: clearBlockedActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearBlockedActionLabel}`, title: `${t('common.cancel')}: ${clearBlockedActionLabel}` }}
              >
                <Button
                  size="small"
                  aria-label={clearBlockedActionLabel}
                  title={clearBlockedActionLabel}
                  disabled={checkoutSubmitting}
                >
                  {drawerNextAction.label}
                </Button>
              </Popconfirm>
            ) : (
              <Button
                size="small"
                type={drawerNextAction.tone === 'ready' ? 'primary' : 'default'}
                aria-label={`${drawerNextAction.label}: ${drawerNextAction.title}`}
                title={`${drawerNextAction.label}: ${drawerNextAction.title}`}
                onClick={drawerNextAction.onClick}
                disabled={checkoutSubmitting}
              >
                {drawerNextAction.label}
              </Button>
            )}
          </section>
        ) : null}

        {blockedCount > 0 ? (
          <div className="cart-drawer__unavailable">
            <Text type="secondary">{t('pages.cart.unavailableSummary', { count: blockedCount })}</Text>
            <Popconfirm
              classNames={{ root: 'shop-mobile-popup-layer cart-drawer-popconfirm' }}
              title={t('pages.cart.drawerClearBlockedConfirm', { count: blockedCount })}
              onConfirm={clearBlockedItems}
              okText={t('pages.cart.drawerClearBlocked')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': clearBlockedActionLabel, title: clearBlockedActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearBlockedActionLabel}`, title: `${t('common.cancel')}: ${clearBlockedActionLabel}` }}
            >
              <Button size="small" aria-label={clearBlockedActionLabel} title={clearBlockedActionLabel}>{t('pages.cart.drawerClearBlocked')}</Button>
            </Popconfirm>
          </div>
        ) : null}

        {checkoutItems.length > 0 && benefitTarget ? (
          <Suspense fallback={null}>
            <AddOnAssistant
              cartProductIds={checkoutItems.map((item) => item.productId)}
              remainingAmount={benefitTarget.remainingAmount}
              reason={benefitTarget.reason}
              onAdd={addSuggestedProduct}
            />
          </Suspense>
        ) : null}

        {items.length > 0 ? (
          <details className="cart-drawer__boostPanel">
            <summary>
              <span>
                <Text strong>{t('pages.checkout.expressCheckout')}</Text>
                <Text type="secondary">{expressHint}</Text>
              </span>
              {benefitTarget ? <Tag color="orange">{t('pages.cart.nextActionFindAddOn')}</Tag> : null}
            </summary>
            <div className="cart-drawer__expressWrap">
              <Space.Compact block className="cart-drawer__express">
                {expressPaymentCodes.map((code) => (
                  (() => {
                    const paymentLabel = paymentMethodLabel(code, t);
                    const expressPaymentActionLabel = `${t('pages.checkout.expressCheckout')}: ${paymentLabel}, ${formatMoney(subtotal)}`;
                    return (
                      <Button
                        key={code}
                        disabled={!drawerReady || checkoutSubmitting}
                        loading={checkoutPaymentSubmitting === code}
                        icon={expressPaymentIcon(code)}
                        aria-label={expressPaymentActionLabel}
                        title={expressPaymentActionLabel}
                        onClick={() => goCheckout(code)}
                      >
                        {paymentLabel}
                      </Button>
                    );
                  })()
                ))}
              </Space.Compact>
            </div>
          </details>
        ) : null}

        {items.length === 0 ? (
          <Empty image={<ShoppingOutlined style={{ fontSize: 54, color: '#ccc' }} />} description={t('pages.cart.empty')}>
            <Button type="primary" aria-label={emptyDrawerBrowseActionLabel} title={emptyDrawerBrowseActionLabel} onClick={() => { setOpen(false); navigate('/products'); }}>
              {t('pages.cart.browse')}
            </Button>
          </Empty>
        ) : (
          <List
            loading={loading}
            dataSource={items}
            className="cart-drawer__list"
            renderItem={(item) => {
              const itemName = getCartItemName(item);
              const saveActionLabel = `${t('pages.cart.saveForLaterShort')}: ${itemName}`;
              const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
              const productLinkLabel = `${t('pages.productList.viewPick')}: ${itemName}`;
              return (
              <List.Item
                className="cart-drawer__item"
                actions={[
                  <Button
                    key="later"
                    type="link"
                    className="cart-drawer__itemAction cart-drawer__itemAction--save"
                    icon={<ClockCircleOutlined />}
                    loading={savingForLaterIds[item.id]}
                    disabled={savingForLaterIds[item.id]}
                    aria-label={saveActionLabel}
                    title={saveActionLabel}
                    onClick={() => saveForLater(item)}
                  >
                    {t('pages.cart.saveForLaterShort')}
                  </Button>,
                  <Popconfirm
                    key="delete"
                    classNames={{ root: 'shop-mobile-popup-layer cart-drawer-popconfirm' }}
                    title={t('pages.cart.deleteConfirm')}
                    onConfirm={() => removeItem(item)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                  >
                    <Button type="link" danger className="cart-drawer__itemAction cart-drawer__itemAction--delete" icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel}>
                      {t('common.delete')}
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <img
                      src={getOptimizedImageUrl(resolveCartImage(item.imageUrl), 144)}
                      srcSet={buildResponsiveImageSrcSet(resolveCartImage(item.imageUrl), [96, 144, 192, 288])}
                      sizes="72px"
                      alt={itemName}
                      className="cart-drawer__image"
                      width={72}
                      height={72}
                      loading="lazy"
                      decoding="async"
                      onError={applyCartImageFallback}
                    />
                  }
                  title={<button type="button" className="cart-drawer__productLink" aria-label={productLinkLabel} title={productLinkLabel} onClick={() => { setOpen(false); navigate(`/products/${item.productId}`); }}>{itemName}</button>}
                  description={
                    <Space direction="vertical" size={4}>
                      {!canCheckout(item) ? <Tag color="red">{t('pages.cart.unavailable')}</Tag> : null}
                      {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</Text> : null}
                      {canCheckout(item) && getCartItemLowStockCount(item) !== null ? (
                        <Tag color="orange" className="cart-drawer__urgency">
                          {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                        </Tag>
                      ) : null}
                      <div className="cart-drawer__itemCommerce">
                        <div className="cart-drawer__itemCommerceTop">
                          <span className="cart-drawer__itemPrice commerce-atomic commerce-price-quantity">
                            <Text className="cart-drawer__itemUnitPrice commerce-money">{formatMoney(item.price)}</Text>
                            <span className="cart-drawer__itemQuantity commerce-quantity">x {item.quantity}</span>
                          </span>
                          <Text strong className="cart-drawer__lineTotal commerce-money">{formatMoney(getCartLineAmount(item))}</Text>
                        </div>
                        <InputNumber
                          min={1}
                          max={getCartQuantityLimit(item.stock)}
                          size="small"
                          value={item.quantity}
                          disabled={!isAvailable(item)}
                          status={updatingQuantityIds[item.id] ? 'warning' : undefined}
                          aria-label={`${t('common.quantity')}: ${itemName}`}
                          title={`${t('common.quantity')}: ${itemName}`}
                          onChange={(value) => updateQuantity(item, value || 1)}
                        />
                      </div>
                      {updatingQuantityIds[item.id] ? (
                        <Text type="secondary" className="cart-drawer__syncText">
                          {t('pages.cart.drawerSyncingQuantity', { count: 1 })}
                        </Text>
                      ) : null}
                    </Space>
                  }
                />
              </List.Item>
              );
            }}
          />
        )}

        {open && items.length > 0 ? (
          <Suspense fallback={null}>
            <PetPersonalizedAssistant
              variant="compact"
              excludedProductIds={items.map((item) => item.productId)}
              onAdd={addSuggestedProduct}
            />
          </Suspense>
        ) : null}
      </div>

      <div className="cart-drawer__footer">
        <Space direction="vertical" className="cart-drawer__footerStack">
          <div className="cart-drawer__subtotal">
            <Text>{t('common.subtotal')}</Text>
            <Text strong className="commerce-money">{formatMoney(subtotal)}</Text>
          </div>
          <Button
            type="primary"
            block
            size="large"
            className="cart-drawer__checkoutButton"
            onClick={() => goCheckout()}
            aria-label={checkoutDrawerActionLabel}
            title={checkoutDrawerActionLabel}
            loading={checkoutPaymentSubmitting === 'standard'}
            disabled={checkoutItems.length === 0 || checkoutSubmitting}
          >
            {checkoutSubmitting && hasPendingQuantityUpdates ? t('pages.cart.checkoutSyncing') : t('pages.cart.checkout')}
          </Button>
          <div className="cart-drawer__trustRow" aria-label={t('pages.checkout.trustSecureTitle')}>
            <span><CheckCircleOutlined /> {t('pages.checkout.trustSecureTitle')}</span>
            <span><ShoppingOutlined /> {t('pages.productDetail.trustShippingTitle')}</span>
            <span><ClockCircleOutlined /> {t('pages.productDetail.trustReturnsTitle')}</span>
          </div>
          <Text type="secondary" className="cart-drawer__footerHint">
            {t('pages.cart.drawerFooterHint')}
          </Text>
          <Button block aria-label={fullCartActionLabel} title={fullCartActionLabel} onClick={() => { setOpen(false); navigate('/cart'); }}>
            {t('pages.cart.viewFullCart')}
          </Button>
        </Space>
      </div>
    </Drawer>
  );
};

export default CartDrawer;
