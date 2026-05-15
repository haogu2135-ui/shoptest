import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, InputNumber, message, Popconfirm, Progress, Space, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, ExclamationCircleOutlined, ShoppingCartOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { apiBaseUrl, cartApi, productApi } from '../api';
import type { CartItem, Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, removeGuestCartItems, updateGuestCartQuantity } from '../utils/guestCart';
import {
  getSavedForLaterItems,
  removeSavedForLaterProduct,
  removeSavedForLaterItem,
  saveCartItemForLater,
  type SavedForLaterItem,
} from '../utils/saveForLater';
import { conversionConfig, getLowStockCount } from '../utils/conversionConfig';
import { getNearestCartBenefitTarget, isGiftUnlocked } from '../utils/cartBenefits';
import { loadProductViewPreferences } from '../utils/productViewPreferences';
import { needsOptionSelection } from '../utils/productOptions';
import { localizeProduct } from '../utils/localizedProduct';
import { getAuthenticatedCartUserId, syncCheckoutCartItemIds } from '../utils/cartSession';
import AddOnAssistant from '../components/AddOnAssistant';
import { ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import './Cart.css';

const { Title, Text } = Typography;
const cartImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';
const resolveCartPageImage = (imageUrl?: string) => {
  if (!imageUrl) return cartImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const isAvailable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock > 0);
const canCheckout = (item: CartItem) =>
  isAvailable(item) && (item.stock === undefined || item.stock >= item.quantity);
const getCartItemLowStockCount = (item: CartItem) => getLowStockCount(item.stock, item.quantity);
const getSavedAgeDays = (savedAt?: number) => {
  if (!savedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - savedAt) / 86400000));
};

const Cart: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedItems, setSavedItems] = useState<SavedForLaterItem[]>(() => getSavedForLaterItems());
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringSaved, setRestoringSaved] = useState(false);
  const [addingRecentId, setAddingRecentId] = useState<number | null>(null);
  const [updatingItemIds, setUpdatingItemIds] = useState<number[]>([]);
  const [removingItemIds, setRemovingItemIds] = useState<number[]>([]);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { currency, market, formatMoney } = useMarket();

  const fetchCartItems = useCallback(async () => {
    const userId = getAuthenticatedCartUserId();
    if (!userId) {
      const guestItems = getGuestCartItems();
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      setLoading(false);
      return;
    }
    try {
      const response = await cartApi.getItems(userId);
      setCartItems(response.data);
      setSelectedIds(response.data.filter(canCheckout).map((item) => item.id));
    } catch {
      message.error(t('pages.cart.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  useEffect(() => {
    if (!conversionConfig.cartRecentlyViewed.enabled) return;
    const loadRecentlyViewedProducts = async () => {
      const preferences = loadProductViewPreferences();
      if (preferences.recent.length === 0) {
        setRecentProducts([]);
        return;
      }
      try {
        const response = await productApi.getByIds(preferences.recent.slice(0, conversionConfig.cartRecentlyViewed.maxItems * 2));
        const productById = new Map(response.data.map((product) => [product.id, localizeProduct(product, language)]));
        setRecentProducts(
          preferences.recent
            .map((productId) => productById.get(productId))
            .filter((product): product is Product => Boolean(product))
            .filter((product) => (product.status || 'ACTIVE') === 'ACTIVE' && (product.stock === undefined || product.stock > 0))
            .slice(0, conversionConfig.cartRecentlyViewed.maxItems),
        );
      } catch {
        setRecentProducts([]);
      }
    };
    loadRecentlyViewedProducts();
    window.addEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
    return () => window.removeEventListener('shop:product-view-preferences-updated', loadRecentlyViewedProducts);
  }, [language]);

  useEffect(() => {
    const refreshSavedItems = () => setSavedItems(getSavedForLaterItems());
    const refreshGuestCartFromStorage = (event: StorageEvent) => {
      if (event.key !== 'shop-guest-cart' || localStorage.getItem('token')) return;
      const guestItems = getGuestCartItems();
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      setLoading(false);
    };
    window.addEventListener('shop:save-for-later-updated', refreshSavedItems);
    window.addEventListener('storage', refreshGuestCartFromStorage);
    return () => {
      window.removeEventListener('shop:save-for-later-updated', refreshSavedItems);
      window.removeEventListener('storage', refreshGuestCartFromStorage);
    };
  }, []);

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (updatingItemIds.includes(itemId)) return;
    const targetItem = cartItems.find((item) => item.id === itemId);
    const normalizedQuantity = Math.max(1, Math.min(Number(quantity) || 1, targetItem?.stock || 99));
    if (targetItem && normalizedQuantity === targetItem.quantity) return;
    try {
      setUpdatingItemIds((ids) => Array.from(new Set([...ids, itemId])));
      const userId = getAuthenticatedCartUserId();
      if (userId) {
        await cartApi.updateQuantity(itemId, normalizedQuantity);
        setCartItems((items) => items.map((item) => (item.id === itemId ? { ...item, quantity: normalizedQuantity } : item)));
      } else {
        setCartItems(updateGuestCartQuantity(itemId, normalizedQuantity));
      }
      if (userId) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.cart.quantityFailed'));
    } finally {
      setUpdatingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  };

  const removeItem = async (itemId: number) => {
    if (removingItemIds.includes(itemId)) return;
    try {
      setRemovingItemIds((ids) => Array.from(new Set([...ids, itemId])));
      const userId = getAuthenticatedCartUserId();
      if (userId) {
        await cartApi.removeItem(itemId);
        setCartItems((items) => items.filter((item) => item.id !== itemId));
      } else {
        setCartItems(removeGuestCartItem(itemId));
      }
      message.success(t('messages.deleteSuccess'));
      setSelectedIds((ids) => ids.filter((id) => id !== itemId));
      if (userId) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.deleteFailed'));
    } finally {
      setRemovingItemIds((ids) => ids.filter((id) => id !== itemId));
    }
  };

  const saveForLater = async (item: CartItem) => {
    try {
      const userId = getAuthenticatedCartUserId();
      if (userId) {
        await cartApi.removeItem(item.id);
        saveCartItemForLater(item);
        setCartItems((items) => items.filter((cartItem) => cartItem.id !== item.id));
      } else {
        saveCartItemForLater(item);
        setCartItems(removeGuestCartItem(item.id));
      }
      setSelectedIds((ids) => ids.filter((id) => id !== item.id));
      setSavedItems(getSavedForLaterItems());
      message.success(t('pages.cart.savedForLater'));
      if (userId) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const moveSavedItemToCart = async (item: SavedForLaterItem) => {
    try {
      const userId = getAuthenticatedCartUserId();
      if (userId) {
        await cartApi.addItem(userId, item.productId, item.quantity, item.selectedSpecs);
        const response = await cartApi.getItems(userId);
        setCartItems(response.data);
        setSelectedIds(response.data.filter(canCheckout).map((cartItem) => cartItem.id));
      } else {
        addGuestCartItem(
          {
            ...item,
            id: item.productId,
            name: item.productName,
            status: item.productStatus,
          },
          item.quantity,
          item.selectedSpecs,
          item.price,
        );
        const nextItems = getGuestCartItems();
        setCartItems(nextItems);
        setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
      }
      removeSavedForLaterProduct(item.productId, item.selectedSpecs);
      setSavedItems(getSavedForLaterItems());
      message.success(t('pages.cart.movedToCart'));
      if (userId) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const moveSavedItemsToCart = async (items: SavedForLaterItem[]) => {
    if (items.length === 0) return;
    const targetItems = items.slice(0, conversionConfig.saveForLater.maxBulkRestoreItems);
    setRestoringSaved(true);
    try {
      const userId = getAuthenticatedCartUserId();
      if (userId) {
        await Promise.all(targetItems.map((item) => cartApi.addItem(userId, item.productId, item.quantity, item.selectedSpecs)));
        const response = await cartApi.getItems(userId);
        setCartItems(response.data);
        setSelectedIds(response.data.filter(canCheckout).map((cartItem) => cartItem.id));
      } else {
        targetItems.forEach((item) => {
          addGuestCartItem(
            {
              ...item,
              id: item.productId,
              name: item.productName,
              status: item.productStatus,
            },
            item.quantity,
            item.selectedSpecs,
            item.price,
          );
        });
        const nextItems = getGuestCartItems();
        setCartItems(nextItems);
        setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));
      }
      targetItems.forEach((item) => removeSavedForLaterProduct(item.productId, item.selectedSpecs));
      setSavedItems(getSavedForLaterItems());
      message.success(t('pages.cart.movedSavedBatch', { count: targetItems.length }));
      if (userId) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.operationFailed'));
    } finally {
      setRestoringSaved(false);
    }
  };

  const removeSavedItem = (itemId: number) => {
    setSavedItems(removeSavedForLaterItem(itemId));
    message.success(t('messages.deleteSuccess'));
  };

  const removeItems = async (itemIds: number[], successMessage: string) => {
    if (itemIds.length === 0) return;
    const normalizedIds = Array.from(new Set(itemIds));
    try {
      setRemovingItemIds((ids) => Array.from(new Set([...ids, ...normalizedIds])));
      const userId = getAuthenticatedCartUserId();
      if (userId) {
        await cartApi.removeItems(normalizedIds);
        setCartItems((items) => items.filter((item) => !normalizedIds.includes(item.id)));
      } else {
        setCartItems(removeGuestCartItems(normalizedIds));
      }
      setSelectedIds((ids) => ids.filter((id) => !normalizedIds.includes(id)));
      message.success(successMessage);
      if (userId) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('messages.deleteFailed'));
    } finally {
      setRemovingItemIds((ids) => ids.filter((id) => !normalizedIds.includes(id)));
    }
  };

  const selectedItems = useMemo(
    () => cartItems.filter((item) => selectedIds.includes(item.id)),
    [cartItems, selectedIds],
  );
  const purchasableItems = useMemo(() => cartItems.filter(canCheckout), [cartItems]);
  const unavailableItems = useMemo(() => cartItems.filter((item) => !canCheckout(item)), [cartItems]);
  const savedReminderItems = useMemo(
    () => savedItems.filter((item) => getSavedAgeDays(item.savedAt) >= conversionConfig.saveForLater.reminderAfterDays),
    [savedItems],
  );
  const showRecentlyViewedRecovery = recentProducts.length > 0 && (cartItems.length === 0 || purchasableItems.length === 0);

  const selectedTotal = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const freeShippingThreshold = market.freeShippingThreshold;
  const freeShippingRemaining = Math.max(0, freeShippingThreshold - selectedTotal);
  const benefitTarget = getNearestCartBenefitTarget(selectedTotal, freeShippingThreshold, currency);
  const giftUnlocked = isGiftUnlocked(selectedTotal, currency);
  const freeShippingPercent = freeShippingThreshold > 0
    ? Math.min(100, Math.round((selectedTotal / freeShippingThreshold) * 100))
    : 100;
  const selectedPurchasableCount = selectedIds.filter((id) => purchasableItems.some((item) => item.id === id)).length;
  const allSelected = purchasableItems.length > 0 && selectedPurchasableCount === purchasableItems.length;
  const selectedUnitCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedLowStockCount = selectedItems.filter((item) => canCheckout(item) && getCartItemLowStockCount(item) !== null).length;
  const savedItemsTotal = savedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const checkoutBlocked = selectedIds.length === 0 || selectedItems.some((item) => !canCheckout(item));
  const checkoutConfidenceItems = [
    {
      key: 'selection',
      ready: selectedItems.length > 0,
      label: t('pages.cart.confidenceSelection'),
      text: selectedItems.length > 0
        ? t('pages.cart.confidenceSelectionReady', { count: selectedUnitCount })
        : t('pages.cart.confidenceSelectionNeeded'),
    },
    {
      key: 'stock',
      ready: selectedItems.length > 0 && selectedLowStockCount === 0 && selectedItems.every(canCheckout),
      label: t('pages.cart.confidenceStock'),
      text: selectedLowStockCount > 0
        ? t('pages.cart.confidenceStockLow', { count: selectedLowStockCount })
        : selectedItems.every(canCheckout)
          ? t('pages.cart.confidenceStockReady')
          : t('pages.cart.confidenceStockBlocked'),
    },
    {
      key: 'shipping',
      ready: freeShippingRemaining <= 0,
      label: t('pages.cart.confidenceShipping'),
      text: freeShippingRemaining <= 0
        ? t('pages.cart.confidenceShippingReady')
        : t('pages.cart.confidenceShippingGap', { amount: formatMoney(freeShippingRemaining) }),
    },
  ];
  const checkoutConfidenceReadyCount = checkoutConfidenceItems.filter((item) => item.ready).length;
  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? purchasableItems.map((item) => item.id) : []);
  };

  const toggleOne = (itemId: number, checked: boolean) => {
    setSelectedIds((ids) => (checked ? [...ids, itemId] : ids.filter((id) => id !== itemId)));
  };

  const goCheckout = () => {
    const checkoutItems = selectedItems.filter(canCheckout);
    if (checkoutItems.length === 0) {
      message.warning(t('pages.cart.chooseItems'));
      return;
    }
    syncCheckoutCartItemIds(checkoutItems);
    sessionStorage.removeItem('checkoutPaymentMethod');
    navigate('/checkout');
  };

  const removeSelectedItems = () => {
    removeItems(selectedIds, t('pages.cart.removedSelected', { count: selectedIds.length }));
  };

  const clearUnavailableItems = () => {
    removeItems(unavailableItems.map((item) => item.id), t('pages.cart.clearedUnavailable', { count: unavailableItems.length }));
  };

  const cartNextAction = (() => {
    if (unavailableItems.length > 0) {
      return {
        key: 'clear',
        tone: 'warning',
        title: t('pages.cart.nextActionClearTitle'),
        text: t('pages.cart.nextActionClearText', { count: unavailableItems.length }),
        label: t('pages.cart.clearUnavailable'),
        action: clearUnavailableItems,
      };
    }
    if (selectedItems.length === 0 && purchasableItems.length > 0) {
      return {
        key: 'select',
        tone: 'warning',
        title: t('pages.cart.nextActionSelectTitle'),
        text: t('pages.cart.nextActionSelectText', { count: purchasableItems.reduce((sum, item) => sum + item.quantity, 0) }),
        label: t('pages.cart.selectCheckoutReady'),
        action: () => toggleAll(true),
      };
    }
    if (selectedItems.length > 0 && benefitTarget) {
      return {
        key: benefitTarget.reason,
        tone: 'warm',
        title: benefitTarget.reason === 'gift'
          ? t('pages.cart.nextActionGiftTitle')
          : t('pages.cart.nextActionShippingTitle'),
        text: benefitTarget.reason === 'gift'
          ? t('pages.cart.nextActionGiftText', { amount: formatMoney(benefitTarget.remainingAmount) })
          : t('pages.cart.nextActionShippingText', { amount: formatMoney(benefitTarget.remainingAmount) }),
        label: t('pages.cart.nextActionFindAddOn'),
        action: () => {
          document.getElementById('cart-add-on-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      };
    }
    if (savedReminderItems.length > 0) {
      return {
        key: 'saved',
        tone: 'warm',
        title: t('pages.cart.nextActionSavedTitle'),
        text: t('pages.cart.nextActionSavedText', { count: savedReminderItems.length }),
        label: t('pages.cart.restoreReminder'),
        action: () => moveSavedItemsToCart(savedReminderItems),
      };
    }
    return {
      key: 'checkout',
      tone: 'ready',
      title: t('pages.cart.nextActionCheckoutTitle'),
      text: t('pages.cart.nextActionCheckoutText', { amount: formatMoney(selectedTotal) }),
      label: t('pages.cart.checkout'),
      action: goCheckout,
    };
  })();
  const cartHeroHighlights = [
    {
      key: 'total',
      title: t('common.total'),
      text: formatMoney(selectedTotal),
    },
    {
      key: 'shipping',
      title: t('pages.cart.freeShippingUnlocked'),
      text: freeShippingRemaining > 0
        ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingRemaining) })
        : t('pages.cart.freeShippingUnlocked'),
    },
    {
      key: 'saved',
      title: t('pages.cart.saveForLaterTitle'),
      text: t('pages.cart.savedValueText', { count: savedItems.length, amount: formatMoney(savedItemsTotal) }),
    },
  ];
  const cartSummaryCards = [
    {
      key: 'selected',
      title: t('pages.cart.selectedSummary', { count: selectedUnitCount }),
      text: formatMoney(selectedTotal),
    },
    {
      key: 'shipping',
      title: freeShippingRemaining > 0 ? t('pages.cart.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) }) : t('pages.cart.freeShippingUnlocked'),
      text: `${freeShippingPercent}%`,
    },
    {
      key: 'saved',
      title: t('pages.cart.saveForLaterTitle'),
      text: `${savedItems.length}`,
    },
  ];

  const addSuggestedProduct = async (product: Product) => {
    const userId = getAuthenticatedCartUserId();
    if (userId) {
      await cartApi.addItem(userId, product.id, 1);
      const response = await cartApi.getItems(userId);
      setCartItems(response.data);
      const addedItemIds = response.data
        .filter((item) => item.productId === product.id && canCheckout(item))
        .map((item) => item.id);
      setSelectedIds((ids) => Array.from(new Set([...ids, ...addedItemIds])));
      window.dispatchEvent(new Event('shop:cart-updated'));
      return;
    }
    addGuestCartItem(product, 1);
    const nextItems = getGuestCartItems();
    setCartItems(nextItems);
    const addedItemIds = nextItems
      .filter((item) => item.productId === product.id && canCheckout(item))
      .map((item) => item.id);
    setSelectedIds((ids) => Array.from(new Set([...ids, ...addedItemIds])));
  };

  const addRecentProduct = async (product: Product) => {
    if (needsOptionSelection(product)) {
      navigate(`/products/${product.id}`);
      return;
    }
    setAddingRecentId(product.id);
    try {
      await addSuggestedProduct(product);
      message.success(t('messages.addCartSuccess'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('messages.addFailed'));
    } finally {
      setAddingRecentId(null);
    }
  };

  const columns = [
    {
      title: (
        <Checkbox checked={allSelected} indeterminate={selectedPurchasableCount > 0 && !allSelected} onChange={(e) => toggleAll(e.target.checked)}>
          {t('pages.cart.selectAll')}
        </Checkbox>
      ),
      key: 'select',
      width: 90,
      render: (_: unknown, record: CartItem) => (
        <Checkbox
          disabled={!canCheckout(record)}
          checked={selectedIds.includes(record.id)}
          onChange={(e) => toggleOne(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: t('pages.cart.product'),
      dataIndex: 'productName',
      key: 'productName',
      render: (name: string, record: CartItem) => (
        <Space>
          <img
            src={resolveCartPageImage(record.imageUrl)}
            alt={name}
            style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              if (event.currentTarget.src !== cartImageFallback) {
                event.currentTarget.src = cartImageFallback;
              }
            }}
          />
          <div>
            <Link to={`/products/${record.productId}`}><Text>{name}</Text></Link>
            {record.selectedSpecs ? <div><Text type="secondary">{formatSelectedSpecs(record.selectedSpecs, t)}</Text></div> : null}
            {!canCheckout(record) && <div><Text type="danger">{t('pages.cart.unavailable')}</Text></div>}
            {canCheckout(record) && getCartItemLowStockCount(record) !== null ? (
              <div>
                <Text type="warning" className="cart-page__urgency">
                  {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(record) ?? 0 })}
                </Text>
              </div>
            ) : null}
          </div>
        </Space>
      ),
    },
    {
      title: t('pages.cart.unitPrice'),
      dataIndex: 'price',
      key: 'price',
      width: 110,
      render: (price: number) => <Text style={{ color: '#ee4d2d' }}>{formatMoney(price)}</Text>,
    },
    {
      title: t('common.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      width: 130,
      render: (_: unknown, record: CartItem) => (
        <InputNumber
          min={1}
          max={record.stock || undefined}
          disabled={!isAvailable(record) || updatingItemIds.includes(record.id) || removingItemIds.includes(record.id)}
          value={record.quantity}
          size="small"
          onChange={(value) => updateQuantity(record.id, value || 1)}
        />
      ),
    },
    {
      title: t('common.subtotal'),
      key: 'subtotal',
      width: 120,
      render: (_: unknown, record: CartItem) => <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(record.price * record.quantity)}</Text>,
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 150,
      render: (_: unknown, record: CartItem) => (
        <Space direction="vertical" size={2}>
          <Button type="text" icon={<ClockCircleOutlined />} size="small" onClick={() => saveForLater(record)} disabled={removingItemIds.includes(record.id)}>
            {t('pages.cart.saveForLater')}
          </Button>
          <Popconfirm title={t('pages.cart.deleteConfirm')} onConfirm={() => removeItem(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" loading={removingItemIds.includes(record.id)}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="cart-page">
        <section className="cart-page__hero">
          <div className="cart-page__heroContent">
            <div className="shimmer" style={{ width: 100, height: 18, borderRadius: 999 }} />
            <div className="shimmer" style={{ width: 220, height: 40, borderRadius: 10 }} />
            <div className="shimmer" style={{ width: '70%', height: 16, borderRadius: 6 }} />
            <div className="cart-page__heroActions">
              <div className="shimmer" style={{ width: 140, height: 40, borderRadius: 10 }} />
              <div className="shimmer" style={{ width: 100, height: 40, borderRadius: 10 }} />
            </div>
          </div>
          <div className="cart-page__heroStats">
            {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 80, borderRadius: 16 }} />)}
          </div>
        </section>
        <section className="cart-page__summaryStrip">
          <StatsStripSkeleton cols={3} />
        </section>
        <div style={{ marginTop: 16 }}>
          <ProductCardSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!loading && cartItems.length === 0 && savedItems.length === 0 && recentProducts.length === 0) {
    return (
      <div className="cart-page cart-page--empty">
        <Empty image={<ShoppingOutlined style={{ fontSize: 64, color: '#ccc' }} />} description={t('pages.cart.empty')}>
          <Button type="primary" onClick={() => navigate('/products')}>{t('pages.cart.browse')}</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <section className="cart-page__hero">
        <div className="cart-page__heroContent">
          <span className="cart-page__heroEyebrow">{t('pages.cart.nextActionEyebrow')}</span>
          <Title level={2}>{t('pages.cart.title')}</Title>
          <Text>{cartItems.length > 0 ? cartNextAction.text : t('pages.cart.empty')}</Text>
          <div className="cart-page__heroActions">
            <Button type={cartItems.length > 0 ? 'primary' : 'default'} onClick={cartItems.length > 0 ? cartNextAction.action : () => navigate('/products')}>
              {cartItems.length > 0 ? cartNextAction.label : t('pages.cart.browse')}
            </Button>
            <Button onClick={() => navigate('/products')}>
              {t('pages.cart.browse')}
            </Button>
          </div>
        </div>
        <div className="cart-page__heroStats">
          {cartHeroHighlights.map((item) => (
            <article key={item.key} className="cart-page__heroStat">
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="cart-page__summaryStrip">
        {cartSummaryCards.map((item) => (
          <article key={item.key} className="cart-page__summaryStripCard">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </section>
      {showRecentlyViewedRecovery ? (
        <Card className="cart-page__recentRecovery" style={{ marginBottom: 16 }}>
          <div className="cart-page__recentRecoveryHeader">
            <div>
              <Text strong>{t('pages.cart.recentRecoveryTitle')}</Text>
              <Text type="secondary">{t('pages.cart.recentRecoverySubtitle')}</Text>
            </div>
            <Button size="small" onClick={() => navigate('/products')}>{t('pages.cart.browse')}</Button>
          </div>
          <div className="cart-page__recentGrid">
            {recentProducts.map((product) => (
              <article
                key={product.id}
                className="cart-page__recentItem"
              >
                <button type="button" className="cart-page__recentLink" onClick={() => navigate(`/products/${product.id}`)}>
                  <img
                    src={resolveCartPageImage(product.imageUrl)}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== cartImageFallback) {
                        event.currentTarget.src = cartImageFallback;
                      }
                    }}
                  />
                  <span>
                    <Text strong>{product.name}</Text>
                    <Text type="secondary">{formatMoney(product.effectivePrice ?? product.price)}</Text>
                  </span>
                </button>
                <Button
                  size="small"
                  type={needsOptionSelection(product) ? 'default' : 'primary'}
                  icon={<ShoppingCartOutlined />}
                  loading={addingRecentId === product.id}
                  onClick={() => addRecentProduct(product)}
                >
                  {needsOptionSelection(product) ? t('pages.wishlist.selectOptions') : t('pages.cart.recentAddToCart')}
                </Button>
              </article>
            ))}
          </div>
        </Card>
      ) : null}
      {cartItems.length > 0 ? (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space wrap>
              <Popconfirm
                title={t('pages.cart.deleteSelectedConfirm', { count: selectedIds.length })}
                disabled={selectedIds.length === 0}
                onConfirm={removeSelectedItems}
              >
                <Button danger icon={<DeleteOutlined />} disabled={selectedIds.length === 0} loading={selectedIds.some((id) => removingItemIds.includes(id))}>
                  {t('pages.cart.deleteSelected')}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
                disabled={unavailableItems.length === 0}
                onConfirm={clearUnavailableItems}
              >
                <Button disabled={unavailableItems.length === 0} loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}>
                  {t('pages.cart.clearUnavailable')}
                </Button>
              </Popconfirm>
              <Text type="secondary">{t('pages.cart.unavailableSummary', { count: unavailableItems.length })}</Text>
            </Space>
          </Card>
          <div className={checkoutBlocked ? 'cart-page__readiness cart-page__readiness--warning' : 'cart-page__readiness'}>
            <div className="cart-page__readinessIntro">
              {checkoutBlocked ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
              <div>
                <Text strong>{checkoutBlocked ? t('pages.cart.readinessNeedsAction') : t('pages.cart.readinessReady')}</Text>
                <Text type="secondary">
                  {t('pages.cart.readinessSubtitle', {
                    selected: selectedUnitCount,
                    available: purchasableItems.reduce((sum, item) => sum + item.quantity, 0),
                  })}
                </Text>
              </div>
            </div>
            <div className="cart-page__readinessStats">
              <Tag color="green">{t('pages.cart.readyItems', { count: selectedPurchasableCount })}</Tag>
              <Tag color={unavailableItems.length > 0 ? 'red' : 'default'}>{t('pages.cart.blockedItems', { count: unavailableItems.length })}</Tag>
              <Tag color={freeShippingRemaining > 0 ? 'orange' : 'green'}>
                {freeShippingRemaining > 0
                  ? t('pages.cart.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) })
                  : t('pages.cart.freeShippingUnlocked')}
              </Tag>
              {giftUnlocked ? (
                <Tag color="green">{t('pages.cart.drawerGiftUnlocked')}</Tag>
              ) : null}
            </div>
            <div className="cart-page__readinessActions">
              <Button size="small" onClick={() => toggleAll(true)} disabled={purchasableItems.length === 0 || allSelected}>
                {t('pages.cart.selectCheckoutReady')}
              </Button>
              {unavailableItems.length > 0 ? (
                <Button size="small" onClick={clearUnavailableItems} loading={unavailableItems.some((item) => removingItemIds.includes(item.id))}>
                  {t('pages.cart.clearUnavailable')}
                </Button>
              ) : null}
            </div>
          </div>
          <details className="cart-page__confidencePanel">
            <summary>
              <span className="cart-page__confidenceIntro">
                <Text strong>{t('pages.cart.confidenceTitle')}</Text>
                <Text type="secondary">{t('pages.cart.confidenceSubtitle')}</Text>
              </span>
              <Tag color={checkoutConfidenceReadyCount === checkoutConfidenceItems.length ? 'green' : 'orange'}>
                {checkoutConfidenceReadyCount}/{checkoutConfidenceItems.length}
              </Tag>
            </summary>
            <div className="cart-page__confidenceGrid">
              {checkoutConfidenceItems.map((item) => (
                <div className={item.ready ? 'cart-page__confidenceItem cart-page__confidenceItem--ready' : 'cart-page__confidenceItem'} key={item.key}>
                  <CheckCircleOutlined />
                  <span>
                    <Text strong>{item.label}</Text>
                    <Text type="secondary">{item.text}</Text>
                  </span>
                </div>
              ))}
            </div>
          </details>
          <div className={`cart-page__nextAction cart-page__nextAction--${cartNextAction.tone}`}>
            <span>
              <Text type="secondary">{t('pages.cart.nextActionEyebrow')}</Text>
              <Text strong>{cartNextAction.title}</Text>
              <Text type="secondary">{cartNextAction.text}</Text>
            </span>
            <Button
              type={cartNextAction.tone === 'ready' ? 'primary' : 'default'}
              onClick={cartNextAction.action}
              loading={cartNextAction.key === 'saved' && restoringSaved}
            >
              {cartNextAction.label}
            </Button>
          </div>
          <div className="cart-page__table">
            <Table columns={columns} dataSource={cartItems} rowKey="id" loading={loading} pagination={false} />
          </div>
          <div className="cart-page__mobileList">
            {cartItems.map((item) => (
          <Card key={item.id} size="small" className="cart-page__mobileItem">
            <div className="cart-page__mobileItemTop">
              <Checkbox
                disabled={!canCheckout(item)}
                checked={selectedIds.includes(item.id)}
                onChange={(e) => toggleOne(item.id, e.target.checked)}
              />
              <img
                src={resolveCartPageImage(item.imageUrl)}
                alt={item.productName}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  if (event.currentTarget.src !== cartImageFallback) {
                    event.currentTarget.src = cartImageFallback;
                  }
                }}
              />
              <div>
                <Link to={`/products/${item.productId}`}><Text strong>{item.productName}</Text></Link>
                {item.selectedSpecs ? <div><Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text></div> : null}
                {!canCheckout(item) && <div><Text type="danger">{t('pages.cart.unavailable')}</Text></div>}
                {canCheckout(item) && getCartItemLowStockCount(item) !== null ? (
                  <div>
                    <Text type="warning" className="cart-page__urgency">
                      {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                    </Text>
                  </div>
                ) : null}
                <Text type="secondary">{formatMoney(item.price)}</Text>
              </div>
            </div>
            <div className="cart-page__mobileItemBottom">
              <InputNumber
                min={1}
                max={item.stock || undefined}
                disabled={!isAvailable(item) || updatingItemIds.includes(item.id) || removingItemIds.includes(item.id)}
                value={item.quantity}
                size="small"
                onChange={(value) => updateQuantity(item.id, value || 1)}
              />
              <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(item.price * item.quantity)}</Text>
              <Button type="text" icon={<ClockCircleOutlined />} size="small" onClick={() => saveForLater(item)} disabled={removingItemIds.includes(item.id)}>
                {t('pages.cart.saveForLaterShort')}
              </Button>
              <Popconfirm title={t('pages.cart.deleteConfirm')} onConfirm={() => removeItem(item.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} size="small" loading={removingItemIds.includes(item.id)} />
              </Popconfirm>
            </div>
          </Card>
            ))}
          </div>
          <Card className="cart-page__summary" style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>
                {freeShippingRemaining > 0
                  ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingRemaining) })
                  : t('pages.cart.freeShippingUnlocked')}
              </Text>
              <Progress percent={freeShippingPercent} showInfo={false} strokeColor="#124734" style={{ marginTop: 8 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Text>{t('pages.cart.selectedSummary', { count: selectedUnitCount })}</Text>
                <Text className="cart-page__total">
                  {t('common.total')}: <Text strong style={{ color: '#ee4d2d', fontSize: 24 }}>{formatMoney(selectedTotal)}</Text>
                </Text>
              </div>
              <Button type="primary" size="large" onClick={goCheckout} disabled={selectedIds.length === 0}>
                {t('pages.cart.checkout')}
              </Button>
            </div>
          </Card>
          {selectedItems.length > 0 ? (
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
        <Card className="cart-page__emptyPanel">
          <Empty image={<ShoppingOutlined style={{ fontSize: 54, color: '#ccc' }} />} description={t('pages.cart.empty')}>
            <Button type="primary" onClick={() => navigate('/products')}>{t('pages.cart.browse')}</Button>
          </Empty>
        </Card>
      )}
      <Card
        title={`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}
        extra={savedItems.length > 0 ? (
          <Button
            size="small"
            icon={<ShoppingCartOutlined />}
            loading={restoringSaved}
            onClick={() => moveSavedItemsToCart(savedItems)}
          >
            {t('pages.cart.moveAllToCart')}
          </Button>
        ) : null}
        style={{ marginTop: 16 }}
      >
        {savedItems.length > 0 ? (
          <div className="cart-page__savedValue">
            <ClockCircleOutlined />
            <span>
              <Text strong>{t('pages.cart.savedValueTitle')}</Text>
              <Text type="secondary">{t('pages.cart.savedValueText', { count: savedItems.length, amount: formatMoney(savedItemsTotal) })}</Text>
            </span>
          </div>
        ) : null}
        {conversionConfig.saveForLater.enabled && savedReminderItems.length > 0 ? (
          <Alert
            type="info"
            showIcon
            className="cart-page__savedReminder"
            message={t('pages.cart.savedReminderTitle', { count: savedReminderItems.length })}
            description={t('pages.cart.savedReminderText')}
            action={(
              <Button size="small" type="primary" loading={restoringSaved} onClick={() => moveSavedItemsToCart(savedReminderItems)}>
                {t('pages.cart.restoreReminder')}
              </Button>
            )}
          />
        ) : null}
        {savedItems.length === 0 ? (
          <Empty description={t('pages.cart.saveForLaterEmpty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="cart-page__savedGrid">
            {savedItems.map((item) => (
              <div className="cart-page__savedItem" key={item.id}>
                <Link to={`/products/${item.productId}`}>
                  <img
                    src={resolveCartPageImage(item.imageUrl)}
                    alt={item.productName}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== cartImageFallback) {
                        event.currentTarget.src = cartImageFallback;
                      }
                    }}
                  />
                </Link>
                <div className="cart-page__savedInfo">
                  <Link to={`/products/${item.productId}`}><Text strong>{item.productName}</Text></Link>
                  {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                  <Text type="secondary">{t('common.quantity')}: {item.quantity}</Text>
                  <Tag className="cart-page__savedAge">
                    {t('pages.cart.savedDaysAgo', { count: getSavedAgeDays(item.savedAt) })}
                  </Tag>
                  <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(item.price)}</Text>
                </div>
                <Space className="cart-page__savedActions">
                  <Button icon={<ShoppingCartOutlined />} onClick={() => moveSavedItemToCart(item)}>
                    {t('pages.cart.moveToCart')}
                  </Button>
                  <Popconfirm title={t('pages.cart.deleteSavedConfirm')} onConfirm={() => removeSavedItem(item.id)}>
                    <Button danger type="text" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Cart;

