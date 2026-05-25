import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Drawer, Empty, InputNumber, List, message, Progress, Space, Tag, Typography } from 'antd';
import { AppleOutlined, CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined, DeleteOutlined, GoogleOutlined, ShoppingOutlined, WalletOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { cartApi } from '../api';
import type { CartItem, Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, removeGuestCartItems, updateGuestCartQuantity } from '../utils/guestCart';
import { saveCartItemForLater } from '../utils/saveForLater';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { hasAuthenticatedCartSession, syncCheckoutCartItemIds } from '../utils/cartSession';
import { canCartItemCheckout as canCheckout, cartImageFallback, getCartItemLowStockCount, isCartItemAvailable as isAvailable, resolveCartImage } from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getLocalStorageItem, removeSessionStorageItem, setSessionStorageItem } from '../utils/safeStorage';
import './CartDrawer.css';

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

const normalizeCartQuantity = (item: CartItem, quantity: number) => {
  const parsedQuantity = Math.floor(Number(quantity));
  const safeQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
  const normalizedQuantity = Math.max(1, safeQuantity);
  const stock = item.stock === undefined || item.stock === null ? null : Math.floor(Number(item.stock));
  return stock && Number.isFinite(stock) && stock > 0
    ? Math.min(normalizedQuantity, stock)
    : normalizedQuantity;
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
  const mountedRef = useRef(true);
  const loadCartRequestRef = useRef(0);
  const refreshCartTimerRef = useRef<number | null>(null);
  const quantityTimersRef = useRef<Record<number, number>>({});
  const quantityRequestPromisesRef = useRef<Record<number, Promise<void> | undefined>>({});
  const quantityRequestVersionRef = useRef<Record<number, number>>({});
  const handledOpenRequestRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { currency, market, formatMoney } = useMarket();

  const clearQuantityTimer = useCallback((itemId: number) => {
    const timerId = quantityTimersRef.current[itemId];
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      delete quantityTimersRef.current[itemId];
    }
  }, []);

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
    } catch {
      if (mountedRef.current && loadCartRequestRef.current === requestId) {
        message.error(t('pages.cart.fetchFailed'));
      }
    } finally {
      if (mountedRef.current && loadCartRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [t]);

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
    Object.values(quantityTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    quantityTimersRef.current = {};
  }, []);

  const checkoutItems = useMemo(() => items.filter(canCheckout), [items]);
  const blockedItems = useMemo(() => items.filter((item) => !canCheckout(item)), [items]);
  const subtotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [checkoutItems]);
  const blockedCount = blockedItems.length;
  const checkoutUnitCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = checkoutItems.filter((item) => getCartItemLowStockCount(item) !== null).length;
  const pendingQuantityCount = Object.values(updatingQuantityIds).filter(Boolean).length;
  const hasPendingQuantityUpdates = pendingQuantityCount > 0;
  const freeShippingThreshold = market.freeShippingThreshold;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const benefitTarget = getNearestCartBenefitTarget(subtotal, freeShippingThreshold, currency);
  const giftUnlocked = isGiftUnlocked(subtotal, currency);
  const progress = freeShippingThreshold > 0
    ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    : 100;
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
        ? t('pages.cart.drawerExpressGiftHint', { amount: formatMoney(benefitTarget.remainingAmount) })
        : t('pages.cart.drawerExpressAddOnHint', { amount: formatMoney(benefitTarget.remainingAmount) })
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
    clearQuantityTimer(item.id);
    const requestVersion = (quantityRequestVersionRef.current[item.id] || 0) + 1;
    quantityRequestVersionRef.current[item.id] = requestVersion;
    setUpdatingQuantityIds((current) => ({ ...current, [item.id]: true }));
    quantityTimersRef.current[item.id] = window.setTimeout(() => {
      delete quantityTimersRef.current[item.id];
      const syncPromise = cartApi.updateQuantity(item.id, normalizedQuantity)
        .then(() => {
          if (!mountedRef.current || quantityRequestVersionRef.current[item.id] !== requestVersion) return;
          dispatchDomEvent('shop:cart-updated');
        })
        .catch((err: any) => {
          if (!mountedRef.current || quantityRequestVersionRef.current[item.id] !== requestVersion) return;
          message.error(err?.response?.data?.error || t('pages.cart.quantityFailed'));
          loadCart();
          throw err;
        })
        .finally(() => {
          if (quantityRequestVersionRef.current[item.id] === requestVersion) {
            delete quantityRequestPromisesRef.current[item.id];
          }
          if (mountedRef.current && quantityRequestVersionRef.current[item.id] === requestVersion) {
            setUpdatingQuantityIds((current) => {
              const next = { ...current };
              delete next[item.id];
              return next;
            });
          }
        });
      quantityRequestPromisesRef.current[item.id] = syncPromise;
      void syncPromise.catch(() => undefined);
    }, 350);
  };

  const clearQuantityPendingState = (itemIds: number[]) => {
    if (!mountedRef.current || itemIds.length === 0) return;
    setUpdatingQuantityIds((current) => {
      const next = { ...current };
      itemIds.forEach((itemId) => {
        delete next[itemId];
      });
      return next;
    });
  };

  const flushPendingQuantityUpdates = async (checkoutSnapshot: CartItem[]) => {
    if (!hasAuthenticatedCartSession()) return;
    const affectedIds = new Set<number>();
    const inFlightPromises = checkoutSnapshot
      .map((item) => {
        const promise = quantityRequestPromisesRef.current[item.id];
        if (promise) affectedIds.add(item.id);
        return promise;
      })
      .filter((promise): promise is Promise<void> => Boolean(promise));

    checkoutSnapshot.forEach((item) => {
      if (quantityTimersRef.current[item.id] !== undefined) {
        affectedIds.add(item.id);
        clearQuantityTimer(item.id);
      }
    });
    if (affectedIds.size === 0) return;

    if (inFlightPromises.length > 0) {
      await Promise.allSettled(inFlightPromises);
    }
    const itemsToSync = checkoutSnapshot.filter((item) => affectedIds.has(item.id));
    itemsToSync.forEach((item) => {
      quantityRequestVersionRef.current[item.id] = (quantityRequestVersionRef.current[item.id] || 0) + 1;
      delete quantityRequestPromisesRef.current[item.id];
    });
    try {
      const results = await allSettledWithConcurrency(
        itemsToSync,
        (item) => cartApi.updateQuantity(item.id, normalizeCartQuantity(item, item.quantity)),
      );
      const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) {
        throw failed.reason;
      }
      dispatchDomEvent('shop:cart-updated');
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('pages.cart.quantityFailed'));
      await loadCart();
      throw err;
    } finally {
      clearQuantityPendingState(itemsToSync.map((item) => item.id));
    }
  };

  const removeItem = async (item: CartItem) => {
    clearQuantityTimer(item.id);
    quantityRequestVersionRef.current[item.id] = (quantityRequestVersionRef.current[item.id] || 0) + 1;
    delete quantityRequestPromisesRef.current[item.id];
    clearQuantityPendingState([item.id]);
    try {
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(item.id);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const saveForLater = async (item: CartItem) => {
    clearQuantityTimer(item.id);
    quantityRequestVersionRef.current[item.id] = (quantityRequestVersionRef.current[item.id] || 0) + 1;
    delete quantityRequestPromisesRef.current[item.id];
    clearQuantityPendingState([item.id]);
    try {
      saveCartItemForLater(item);
      const authenticated = hasAuthenticatedCartSession();
      if (authenticated) {
        await cartApi.removeItem(item.id);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      message.success(t('pages.cart.savedForLater'));
      if (authenticated) dispatchDomEvent('shop:cart-updated');
    } catch {
      message.error(t('messages.operationFailed'));
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
    } catch {
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
        const removedIds = new Set(
          blockedItems
            .filter((_, index) => results[index]?.status === 'fulfilled')
            .map((item) => item.id),
        );
        if (removedIds.size === 0) {
          message.error(t('messages.operationFailed'));
          return;
        }
        setItems((current) => current.filter((item) => !removedIds.has(item.id)));
        dispatchDomEvent('shop:cart-updated');
        message.success(t('pages.cart.drawerClearedBlocked', { count: removedIds.size }));
      } else {
        setItems(removeGuestCartItems(blockedItems.map((item) => item.id)));
        message.success(t('pages.cart.drawerClearedBlocked', { count: blockedItems.length }));
      }
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const addSuggestedProduct = async (product: Product) => {
    const authenticated = hasAuthenticatedCartSession();
    if (authenticated) {
      await cartApi.addItem(0, product.id, 1);
      const response = await cartApi.getItems(0);
      if (mountedRef.current) {
        setItems(response.data);
      }
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
          ? t('pages.cart.nextActionGiftText', { amount: formatMoney(benefitTarget.remainingAmount) })
          : t('pages.cart.nextActionShippingText', { amount: formatMoney(benefitTarget.remainingAmount) }),
        label: t('pages.cart.nextActionFindAddOn'),
        onClick: () => navigate('/products'),
      };
    }

    return {
      tone: 'ready',
      icon: <CheckCircleOutlined />,
      title: t('pages.cart.nextActionCheckoutTitle'),
      text: t('pages.cart.nextActionCheckoutText', { amount: formatMoney(subtotal) }),
      label: t('pages.cart.checkout'),
      onClick: () => goCheckout(),
    };
  })();

  return (
    <Drawer
      title={t('pages.cart.yourCart')}
      placement="right"
      width="min(420px, 100vw)"
      open={open}
      onClose={() => setOpen(false)}
      className={`cart-drawer cart-drawer--${language}`}
      styles={{ body: { padding: 16 } }}
      extra={<Text strong>{formatMoney(subtotal)}</Text>}
    >
      <section className="cart-drawer__hero">
        {drawerHighlights.map((item) => (
          <article key={item.key} className="cart-drawer__heroStat">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </section>

      <div className={`cart-drawer__shipping${drawerReady ? ' cart-drawer__shipping--ready' : ''}`} role="status" aria-live="polite">
        <div className="cart-drawer__shippingHeader">
          <CheckCircleOutlined className={`cart-drawer__shippingIcon${drawerReady ? ' cart-drawer__shippingIcon--ready' : ''}`} />
          <div className="cart-drawer__shippingText">
            <Text strong>{remaining > 0 ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(remaining) }) : t('pages.cart.freeShippingUnlocked')}</Text>
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
          aria-label={remaining > 0 ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(remaining) }) : t('pages.cart.freeShippingUnlocked')}
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
          <Button
            size="small"
            type={drawerNextAction.tone === 'ready' ? 'primary' : 'default'}
            onClick={drawerNextAction.onClick}
            disabled={checkoutSubmitting}
          >
            {drawerNextAction.label}
          </Button>
        </section>
      ) : null}

      {blockedCount > 0 ? (
        <div className="cart-drawer__unavailable">
          <Text type="secondary">{t('pages.cart.unavailableSummary', { count: blockedCount })}</Text>
          <Button size="small" onClick={clearBlockedItems}>{t('pages.cart.drawerClearBlocked')}</Button>
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
                <Button
                  key={code}
                  disabled={!drawerReady || checkoutSubmitting}
                  loading={checkoutPaymentSubmitting === code}
                  icon={expressPaymentIcon(code)}
                  onClick={() => goCheckout(code)}
                >
                  {paymentMethodLabel(code, t)}
                </Button>
              ))}
            </Space.Compact>
          </div>
        </details>
      ) : null}

      {items.length === 0 ? (
        <Empty image={<ShoppingOutlined style={{ fontSize: 54, color: '#ccc' }} />} description={t('pages.cart.empty')}>
          <Button type="primary" onClick={() => { setOpen(false); navigate('/products'); }}>
            {t('pages.cart.browse')}
          </Button>
        </Empty>
      ) : (
        <List
          loading={loading}
          dataSource={items}
          className="cart-drawer__list"
          renderItem={(item) => (
            <List.Item
              className="cart-drawer__item"
              actions={[
                <Button key="later" type="link" className="cart-drawer__itemAction cart-drawer__itemAction--save" icon={<ClockCircleOutlined />} onClick={() => saveForLater(item)}>
                  {t('pages.cart.saveForLaterShort')}
                </Button>,
                <Button key="delete" type="link" danger className="cart-drawer__itemAction cart-drawer__itemAction--delete" icon={<DeleteOutlined />} aria-label={t('common.delete')} title={t('common.delete')} onClick={() => removeItem(item)}>
                  {t('common.delete')}
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <img
                    src={getOptimizedImageUrl(resolveCartImage(item.imageUrl), 144)}
                    srcSet={buildResponsiveImageSrcSet(resolveCartImage(item.imageUrl), [96, 144, 192, 288])}
                    sizes="72px"
                    alt={item.productName}
                    className="cart-drawer__image"
                    width={72}
                    height={72}
                    loading="lazy"
                    decoding="async"
                    onError={applyCartImageFallback}
                  />
                }
                title={<button type="button" className="cart-drawer__productLink" onClick={() => { setOpen(false); navigate(`/products/${item.productId}`); }}>{item.productName}</button>}
                description={
                  <Space direction="vertical" size={4}>
                    {!canCheckout(item) ? <Tag color="red">{t('pages.cart.unavailable')}</Tag> : null}
                    {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                    {canCheckout(item) && getCartItemLowStockCount(item) !== null ? (
                      <Tag color="orange" className="cart-drawer__urgency">
                        {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                      </Tag>
                    ) : null}
                    <div className="cart-drawer__itemCommerce">
                      <span className="cart-drawer__itemPrice">
                        <Text>{formatMoney(item.price)}</Text>
                        <Text type="secondary">x {item.quantity}</Text>
                      </span>
                      <InputNumber
                        min={1}
                        max={item.stock ?? undefined}
                        size="small"
                        value={item.quantity}
                        disabled={!isAvailable(item)}
                        status={updatingQuantityIds[item.id] ? 'warning' : undefined}
                        onChange={(value) => updateQuantity(item, value || 1)}
                      />
                      <Text strong className="cart-drawer__lineTotal">{formatMoney(item.price * item.quantity)}</Text>
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
          )}
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

      <div className="cart-drawer__footer">
        <Space direction="vertical" className="cart-drawer__footerStack">
          <div className="cart-drawer__subtotal">
            <Text>{t('common.subtotal')}</Text>
            <Text strong>{formatMoney(subtotal)}</Text>
          </div>
          <Button
            type="primary"
            block
            size="large"
            className="cart-drawer__checkoutButton"
            onClick={() => goCheckout()}
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
          <Button block onClick={() => { setOpen(false); navigate('/cart'); }}>
            {t('pages.cart.viewFullCart')}
          </Button>
        </Space>
      </div>
    </Drawer>
  );
};

export default CartDrawer;
