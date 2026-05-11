import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Empty, InputNumber, List, message, Progress, Space, Tag, Typography } from 'antd';
import { AppleOutlined, GoogleOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { cartApi } from '../api';
import type { CartItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { getGuestCartItems, removeGuestCartItem, updateGuestCartQuantity } from '../utils/guestCart';

const { Text } = Typography;

const canCheckout = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock ?? 0) > 0 && (item.stock ?? 0) >= item.quantity;

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
    window.addEventListener('shop:open-cart', openCart);
    window.addEventListener('shop:cart-updated', refreshCart);
    return () => {
      window.removeEventListener('shop:open-cart', openCart);
      window.removeEventListener('shop:cart-updated', refreshCart);
    };
  }, [loadCart]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);
  const checkoutItems = useMemo(() => items.filter(canCheckout), [items]);
  const freeShippingThreshold = market.freeShippingThreshold;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  const updateQuantity = async (item: CartItem, quantity: number) => {
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
        await cartApi.updateQuantity(item.id, quantity);
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry));
      } else {
        setItems(updateGuestCartQuantity(item.id, quantity));
      }
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch (err: any) {
      message.error(err?.response?.data?.error || t('pages.cart.quantityFailed'));
    }
  };

  const removeItem = async (item: CartItem) => {
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
        await cartApi.removeItem(item.id);
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      } else {
        setItems(removeGuestCartItem(item.id));
      }
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.deleteFailed'));
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
    }
    setOpen(false);
    navigate('/checkout');
  };

  return (
    <Drawer
      title={t('pages.cart.yourCart')}
      placement="right"
      width="min(420px, 100vw)"
      open={open}
      onClose={() => setOpen(false)}
      styles={{ body: { padding: 16 } }}
      extra={<Text strong>{formatMoney(subtotal)}</Text>}
    >
      <div style={{ marginBottom: 18 }}>
        <Text strong>
          {remaining > 0 ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(remaining) }) : t('pages.cart.freeShippingUnlocked')}
        </Text>
        <Progress percent={progress} showInfo={false} strokeColor="#124734" style={{ marginTop: 8 }} />
      </div>

      <Space.Compact block style={{ marginBottom: 16 }}>
        <Button onClick={() => goCheckout('SHOP_PAY')}>Shop Pay</Button>
        <Button onClick={() => goCheckout('PAYPAL')}>PayPal</Button>
        <Button icon={<AppleOutlined />} onClick={() => goCheckout('APPLE_PAY')}>Pay</Button>
        <Button icon={<GoogleOutlined />} onClick={() => goCheckout('GOOGLE_PAY')}>Pay</Button>
      </Space.Compact>

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
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button type="link" danger onClick={() => removeItem(item)}>{t('common.delete')}</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<img src={item.imageUrl} alt={item.productName} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />}
                title={<button type="button" style={{ border: 0, background: 'transparent', padding: 0, fontWeight: 700, cursor: 'pointer' }} onClick={() => { setOpen(false); navigate(`/products/${item.productId}`); }}>{item.productName}</button>}
                description={
                  <Space direction="vertical" size={4}>
                    {!canCheckout(item) ? <Tag color="red">{t('pages.cart.unavailable')}</Tag> : null}
                    {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                    <Text>{formatMoney(item.price)}</Text>
                    <InputNumber
                      min={1}
                      max={item.stock || undefined}
                      size="small"
                      value={item.quantity}
                      disabled={!canCheckout(item)}
                      onChange={(value) => updateQuantity(item, value || 1)}
                    />
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 16, background: '#fff' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>{t('common.subtotal')}</Text>
            <Text strong>{formatMoney(subtotal)}</Text>
          </div>
          <Button type="primary" block size="large" onClick={() => goCheckout()} disabled={checkoutItems.length === 0}>
            {t('pages.cart.checkout')}
          </Button>
          <Button block onClick={() => { setOpen(false); navigate('/cart'); }}>
            {t('pages.cart.viewFullCart')}
          </Button>
        </Space>
      </div>
    </Drawer>
  );
};

export default CartDrawer;
