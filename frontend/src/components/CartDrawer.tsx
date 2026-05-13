import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Empty, InputNumber, List, message, Progress, Space, Tag, Typography } from 'antd';
import { AppleOutlined, CheckCircleOutlined, ClockCircleOutlined, GoogleOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl, cartApi } from '../api';
import type { CartItem, Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { addGuestCartItem, getGuestCartItems, removeGuestCartItem, updateGuestCartQuantity } from '../utils/guestCart';
import { saveCartItemForLater } from '../utils/saveForLater';
import { getLowStockCount } from '../utils/conversionConfig';
import AddOnAssistant from './AddOnAssistant';
import './CartDrawer.css';

const { Text } = Typography;
const cartDrawerImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveCartImage = (imageUrl?: string) => {
  if (!imageUrl) return cartDrawerImageFallback;
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

const CartDrawer: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { market, formatMoney } = useMarket();

  const loadCart = useCallback(async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) {
      setItems(getGuestCartItems());
      return;
    }
    setLoading(true);
    try {
      const res = await cartApi.getItems(Number(userId));
      setItems(res.data);
    } catch {
      message.error(t('pages.cart.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const openCart = () => {
      setOpen(true);
      loadCart();
    };
    const refreshCart = () => {
      loadCart();
    };
    const refreshGuestCartFromStorage = (event: StorageEvent) => {
      if (event.key === 'shop-guest-cart' && !localStorage.getItem('token')) {
        loadCart();
      }
    };
    window.addEventListener('shop:open-cart', openCart);
    window.addEventListener('shop:cart-updated', refreshCart);
    window.addEventListener('storage', refreshGuestCartFromStorage);
    return () => {
      window.removeEventListener('shop:open-cart', openCart);
      window.removeEventListener('shop:cart-updated', refreshCart);
      window.removeEventListener('storage', refreshGuestCartFromStorage);
    };
  }, [loadCart]);

  const checkoutItems = useMemo(() => items.filter(canCheckout), [items]);
  const subtotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [checkoutItems]);
  const blockedCount = items.length - checkoutItems.length;
  const checkoutUnitCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = checkoutItems.filter((item) => getCartItemLowStockCount(item) !== null).length;
  const freeShippingThreshold = market.freeShippingThreshold;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = freeShippingThreshold > 0
    ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    : 100;
  const drawerReady = checkoutItems.length > 0 && blockedCount === 0;
  const expressHint = checkoutItems.length === 0
    ? t('pages.cart.drawerExpressEmpty')
    : remaining > 0
      ? t('pages.cart.drawerExpressAddOnHint', { amount: formatMoney(remaining) })
      : t('pages.cart.drawerExpressReadyHint');

  const updateQuantity = async (item: CartItem, quantity: number) => {
    try {
      const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
      if (isAuthenticated) {
        await cartApi.updateQuantity(item.id, quantity);
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry));
      } else {
        setItems(updateGuestCartQuantity(item.id, quantity));
      }
      if (isAuthenticated) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('pages.cart.quantityFailed'));
    }
  };

  const removeItem = async (item: CartItem) => {
    try {
      const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
      if (isAuthenticated) {
        await cartApi.removeItem(item.id);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      if (isAuthenticated) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const saveForLater = async (item: CartItem) => {
    try {
      saveCartItemForLater(item);
      const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
      if (isAuthenticated) {
        await cartApi.removeItem(item.id);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      message.success(t('pages.cart.savedForLater'));
      if (isAuthenticated) window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const goCheckout = (paymentMethod?: string) => {
    if (checkoutItems.length === 0) {
      message.warning(t('pages.cart.chooseItems'));
      return;
    }
    sessionStorage.setItem('checkoutCartItemIds', JSON.stringify(checkoutItems.map((item) => item.id)));
    if (paymentMethod) {
      sessionStorage.setItem('checkoutPaymentMethod', paymentMethod);
    } else {
      sessionStorage.removeItem('checkoutPaymentMethod');
    }
    setOpen(false);
    navigate('/checkout');
  };

  const addSuggestedProduct = async (product: Product) => {
    const isAuthenticated = Boolean(localStorage.getItem('token') && localStorage.getItem('userId'));
    const userId = Number(localStorage.getItem('userId') || 0);
    if (isAuthenticated) {
      await cartApi.addItem(userId, product.id, 1);
      await loadCart();
      window.dispatchEvent(new Event('shop:cart-updated'));
      return;
    }
    addGuestCartItem(product, 1);
    setItems(getGuestCartItems());
  };

  return (
    <Drawer
      title={t('pages.cart.yourCart')}
      placement="right"
      width="min(420px, 100vw)"
      open={open}
      onClose={() => setOpen(false)}
      className="cart-drawer"
      styles={{ body: { padding: 16 } }}
      extra={<Text strong>{formatMoney(subtotal)}</Text>}
    >
      <div className="cart-drawer__shipping">
        <Text strong>
          {remaining > 0 ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(remaining) }) : t('pages.cart.freeShippingUnlocked')}
        </Text>
        <Progress percent={progress} showInfo={false} strokeColor="#124734" style={{ marginTop: 8 }} />
      </div>

      <div className={drawerReady ? 'cart-drawer__status cart-drawer__status--ready' : 'cart-drawer__status'}>
        <CheckCircleOutlined />
        <div>
          <Text strong>{drawerReady ? t('pages.cart.drawerReadyTitle') : t('pages.cart.drawerReviewTitle')}</Text>
          <Text type="secondary">
            {t('pages.cart.drawerReadyText', { count: checkoutUnitCount, blocked: blockedCount, low: lowStockCount })}
          </Text>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="cart-drawer__expressWrap">
          <Text type="secondary">{expressHint}</Text>
          <Space.Compact block className="cart-drawer__express">
            <Button disabled={checkoutItems.length === 0} onClick={() => goCheckout('SHOP_PAY')}>Shop Pay</Button>
            <Button disabled={checkoutItems.length === 0} onClick={() => goCheckout('PAYPAL')}>PayPal</Button>
            <Button disabled={checkoutItems.length === 0} icon={<AppleOutlined />} onClick={() => goCheckout('APPLE_PAY')}>Pay</Button>
            <Button disabled={checkoutItems.length === 0} icon={<GoogleOutlined />} onClick={() => goCheckout('GOOGLE_PAY')}>Pay</Button>
          </Space.Compact>
        </div>
      ) : null}

      {blockedCount > 0 ? (
        <Text type="secondary" className="cart-drawer__unavailable">
          {t('pages.cart.unavailableSummary', { count: blockedCount })}
        </Text>
      ) : null}

      {checkoutItems.length > 0 ? (
        <AddOnAssistant
          cartProductIds={checkoutItems.map((item) => item.productId)}
          remainingAmount={remaining}
          reason="shipping"
          onAdd={addSuggestedProduct}
        />
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
                <Button key="later" type="link" icon={<ClockCircleOutlined />} onClick={() => saveForLater(item)}>{t('pages.cart.saveForLaterShort')}</Button>,
                <Button key="delete" type="link" danger onClick={() => removeItem(item)}>{t('common.delete')}</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <img
                    src={resolveCartImage(item.imageUrl)}
                    alt={item.productName}
                    className="cart-drawer__image"
                    onError={(event) => {
                      if (event.currentTarget.src !== cartDrawerImageFallback) {
                        event.currentTarget.src = cartDrawerImageFallback;
                      }
                    }}
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
                    <Text>{formatMoney(item.price)}</Text>
                    <InputNumber
                      min={1}
                      max={item.stock || undefined}
                      size="small"
                      value={item.quantity}
                      disabled={!isAvailable(item)}
                      onChange={(value) => updateQuantity(item, value || 1)}
                    />
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      <div className="cart-drawer__footer">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="cart-drawer__subtotal">
            <Text>{t('common.subtotal')}</Text>
            <Text strong>{formatMoney(subtotal)}</Text>
          </div>
          <Button type="primary" block size="large" onClick={() => goCheckout()} disabled={checkoutItems.length === 0}>
            {t('pages.cart.checkout')}
          </Button>
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
