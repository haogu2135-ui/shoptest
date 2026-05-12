import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, Empty, InputNumber, message, Popconfirm, Progress, Space, Table, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, ShoppingCartOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi } from '../api';
import type { CartItem } from '../types';
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

const { Title, Text } = Typography;
const isAvailable = (item: CartItem) =>
  (item.productStatus || 'ACTIVE') === 'ACTIVE' && (item.stock === undefined || item.stock > 0);
const canCheckout = (item: CartItem) =>
  isAvailable(item) && (item.stock === undefined || item.stock >= item.quantity);

const Cart: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedItems, setSavedItems] = useState<SavedForLaterItem[]>(() => getSavedForLaterItems());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { market, formatMoney } = useMarket();

  const fetchCartItems = useCallback(async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) {
      const guestItems = getGuestCartItems();
      setCartItems(guestItems);
      setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));
      setLoading(false);
      return;
    }
    try {
      const response = await cartApi.getItems(Number(userId));
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

  const updateQuantity = async (itemId: number, quantity: number) => {
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
        await cartApi.updateQuantity(itemId, quantity);
        setCartItems((items) => items.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
      } else {
        setCartItems(updateGuestCartQuantity(itemId, quantity));
      }
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.cart.quantityFailed'));
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
        await cartApi.removeItem(itemId);
        setCartItems((items) => items.filter((item) => item.id !== itemId));
      } else {
        setCartItems(removeGuestCartItem(itemId));
      }
      message.success(t('messages.deleteSuccess'));
      setSelectedIds((ids) => ids.filter((id) => id !== itemId));
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const saveForLater = async (item: CartItem) => {
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
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
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const moveSavedItemToCart = async (item: SavedForLaterItem) => {
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
        await cartApi.addItem(Number(localStorage.getItem('userId')), item.productId, item.quantity, item.selectedSpecs);
        const response = await cartApi.getItems(Number(localStorage.getItem('userId')));
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
        setCartItems(getGuestCartItems());
      }
      removeSavedForLaterProduct(item.productId, item.selectedSpecs);
      setSavedItems(getSavedForLaterItems());
      message.success(t('pages.cart.movedToCart'));
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const removeSavedItem = (itemId: number) => {
    setSavedItems(removeSavedForLaterItem(itemId));
    message.success(t('messages.deleteSuccess'));
  };

  const removeItems = async (itemIds: number[], successMessage: string) => {
    if (itemIds.length === 0) return;
    try {
      if (localStorage.getItem('token') && localStorage.getItem('userId')) {
        await Promise.all(itemIds.map((itemId) => cartApi.removeItem(itemId)));
        setCartItems((items) => items.filter((item) => !itemIds.includes(item.id)));
      } else {
        setCartItems(removeGuestCartItems(itemIds));
      }
      setSelectedIds((ids) => ids.filter((id) => !itemIds.includes(id)));
      message.success(successMessage);
      window.dispatchEvent(new Event('shop:cart-updated'));
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const selectedItems = useMemo(
    () => cartItems.filter((item) => selectedIds.includes(item.id)),
    [cartItems, selectedIds],
  );
  const purchasableItems = useMemo(() => cartItems.filter(canCheckout), [cartItems]);
  const unavailableItems = useMemo(() => cartItems.filter((item) => !canCheckout(item)), [cartItems]);

  const selectedTotal = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const freeShippingThreshold = market.freeShippingThreshold;
  const freeShippingRemaining = Math.max(0, freeShippingThreshold - selectedTotal);
  const freeShippingPercent = Math.min(100, Math.round((selectedTotal / freeShippingThreshold) * 100));
  const selectedPurchasableCount = selectedIds.filter((id) => purchasableItems.some((item) => item.id === id)).length;
  const allSelected = purchasableItems.length > 0 && selectedPurchasableCount === purchasableItems.length;

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? purchasableItems.map((item) => item.id) : []);
  };

  const toggleOne = (itemId: number, checked: boolean) => {
    setSelectedIds((ids) => (checked ? [...ids, itemId] : ids.filter((id) => id !== itemId)));
  };

  const goCheckout = () => {
    if (selectedIds.length === 0) {
      message.warning(t('pages.cart.chooseItems'));
      return;
    }
    if (selectedItems.some((item) => !canCheckout(item))) {
      message.warning(t('pages.cart.unavailableSelected'));
      return;
    }
    sessionStorage.setItem('checkoutCartItemIds', JSON.stringify(selectedIds));
    navigate('/checkout');
  };

  const removeSelectedItems = () => {
    removeItems(selectedIds, t('pages.cart.removedSelected', { count: selectedIds.length }));
  };

  const clearUnavailableItems = () => {
    removeItems(unavailableItems.map((item) => item.id), t('pages.cart.clearedUnavailable', { count: unavailableItems.length }));
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
          <img src={record.imageUrl} alt={name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
          <div>
            <Link to={`/products/${record.productId}`}><Text>{name}</Text></Link>
            {record.selectedSpecs ? <div><Text type="secondary">{formatSelectedSpecs(record.selectedSpecs, t)}</Text></div> : null}
            {!canCheckout(record) && <div><Text type="danger">{t('pages.cart.unavailable')}</Text></div>}
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
          disabled={!isAvailable(record)}
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
          <Button type="text" icon={<ClockCircleOutlined />} size="small" onClick={() => saveForLater(record)}>
            {t('pages.cart.saveForLater')}
          </Button>
          <Popconfirm title={t('pages.cart.deleteConfirm')} onConfirm={() => removeItem(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small">{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!loading && cartItems.length === 0 && savedItems.length === 0) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <Empty image={<ShoppingOutlined style={{ fontSize: 64, color: '#ccc' }} />} description={t('pages.cart.empty')}>
          <Button type="primary" onClick={() => navigate('/products')}>{t('pages.cart.browse')}</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="cart-page" style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <Title level={2}>{t('pages.cart.title')}</Title>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Popconfirm
            title={t('pages.cart.deleteSelectedConfirm', { count: selectedIds.length })}
            disabled={selectedIds.length === 0}
            onConfirm={removeSelectedItems}
          >
            <Button danger icon={<DeleteOutlined />} disabled={selectedIds.length === 0}>
              {t('pages.cart.deleteSelected')}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={t('pages.cart.clearUnavailableConfirm', { count: unavailableItems.length })}
            disabled={unavailableItems.length === 0}
            onConfirm={clearUnavailableItems}
          >
            <Button disabled={unavailableItems.length === 0}>
              {t('pages.cart.clearUnavailable')}
            </Button>
          </Popconfirm>
          <Text type="secondary">{t('pages.cart.unavailableSummary', { count: unavailableItems.length })}</Text>
        </Space>
      </Card>
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
              <img src={item.imageUrl} alt={item.productName} />
              <div>
                <Link to={`/products/${item.productId}`}><Text strong>{item.productName}</Text></Link>
                {item.selectedSpecs ? <div><Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text></div> : null}
                {!canCheckout(item) && <div><Text type="danger">{t('pages.cart.unavailable')}</Text></div>}
                <Text type="secondary">{formatMoney(item.price)}</Text>
              </div>
            </div>
            <div className="cart-page__mobileItemBottom">
              <InputNumber
                min={1}
                max={item.stock || undefined}
                disabled={!isAvailable(item)}
                value={item.quantity}
                size="small"
                onChange={(value) => updateQuantity(item.id, value || 1)}
              />
              <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(item.price * item.quantity)}</Text>
              <Button type="text" icon={<ClockCircleOutlined />} size="small" onClick={() => saveForLater(item)}>
                {t('pages.cart.saveForLaterShort')}
              </Button>
              <Popconfirm title={t('pages.cart.deleteConfirm')} onConfirm={() => removeItem(item.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            </div>
          </Card>
        ))}
      </div>
      <Card style={{ marginTop: 16 }}>
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
            <Text>{t('pages.cart.selectedSummary', { count: selectedItems.reduce((sum, item) => sum + item.quantity, 0) })}</Text>
            <Text className="cart-page__total">
              {t('common.total')}: <Text strong style={{ color: '#ee4d2d', fontSize: 24 }}>{formatMoney(selectedTotal)}</Text>
            </Text>
          </div>
          <Button type="primary" size="large" onClick={goCheckout} disabled={selectedIds.length === 0}>
            {t('pages.cart.checkout')}
          </Button>
        </div>
      </Card>
      <Card
        title={`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}
        style={{ marginTop: 16 }}
      >
        {savedItems.length === 0 ? (
          <Empty description={t('pages.cart.saveForLaterEmpty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="cart-page__savedGrid">
            {savedItems.map((item) => (
              <div className="cart-page__savedItem" key={item.id}>
                <Link to={`/products/${item.productId}`}>
                  <img src={item.imageUrl} alt={item.productName} />
                </Link>
                <div className="cart-page__savedInfo">
                  <Link to={`/products/${item.productId}`}><Text strong>{item.productName}</Text></Link>
                  {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                  <Text type="secondary">{t('common.quantity')}: {item.quantity}</Text>
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

