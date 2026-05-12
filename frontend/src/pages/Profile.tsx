import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Cascader, DatePicker, Descriptions, Empty, Form, Input, InputNumber, List, message, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, LockOutlined, PlusOutlined, ShoppingCartOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { addressApi, cartApi, orderApi, paymentApi, petProfileApi, userApi } from '../api';
import type { Order, OrderItem, Payment, PetProfile, User, UserAddress } from '../types';
import { findRegionPath, regionData } from '../regionData';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import './Profile.css';
import dayjs from 'dayjs';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { navigateToSafeUrl } from '../utils/safeUrl';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PENDING_SHIPMENT: 'blue',
  SHIPPED: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'gold',
  RETURN_APPROVED: 'geekblue',
  RETURN_SHIPPED: 'cyan',
  RETURNED: 'purple',
  PENDING: 'orange',
  PAID: 'blue',
  FAILED: 'red',
  EXPIRED: 'volcano',
  DELIVERED: 'green',
};

const getOrderSortTime = (order: Order) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

const sortOrdersNewestFirst = (items: Order[]) =>
  [...items].sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left) || right.id - left.id);

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [petProfiles, setPetProfiles] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [petModalVisible, setPetModalVisible] = useState(false);
  const [editingPet, setEditingPet] = useState<PetProfile | null>(null);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<Record<number, OrderItem[]>>({});
  const [reordering, setReordering] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('STRIPE');
  const [orderPayments, setOrderPayments] = useState<Payment[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [simulatingCallback, setSimulatingCallback] = useState(false);
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const [returnShipmentOrder, setReturnShipmentOrder] = useState<Order | null>(null);
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [submittingReturnShipment, setSubmittingReturnShipment] = useState(false);
  const [trackingVisible, setTrackingVisible] = useState(false);
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState('');
  const [selectedTrackingCarrierCode, setSelectedTrackingCarrierCode] = useState<string | undefined>();
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSearchText, setOrderSearchText] = useState('');
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [addressForm] = Form.useForm();
  const [petForm] = Form.useForm();

  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await userApi.getProfile();
      setUser(response.data);
    } catch {
      message.error(t('pages.profile.fetchUserFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchOrders = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      const response = await orderApi.getByUser(Number(userId));
      const sortedOrders = sortOrdersNewestFirst(response.data || []);
      setOrders(sortedOrders);
      const itemEntries = await Promise.all(
        sortedOrders.slice(0, 30).map(async (order) => {
          try {
            const res = await orderApi.getItems(order.id);
            return [order.id, res.data || []] as const;
          } catch {
            return [order.id, []] as const;
          }
        })
      );
      setOrderItemsByOrderId(Object.fromEntries(itemEntries));
    } catch {
      message.error(t('pages.profile.fetchOrdersFailed'));
    }
  }, [t]);

  const fetchAddresses = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      const response = await addressApi.getByUser(Number(userId));
      setAddresses(response.data);
    } catch {
      setAddresses([]);
    }
  }, []);

  const fetchPetProfiles = useCallback(async () => {
    try {
      const response = await petProfileApi.getMine();
      setPetProfiles(response.data || []);
    } catch {
      setPetProfiles([]);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    fetchUserInfo();
    fetchOrders();
    fetchAddresses();
    fetchPetProfiles();
  }, [fetchAddresses, fetchOrders, fetchPetProfiles, fetchUserInfo, navigate, t]);

  const refreshPaymentState = async (orderId: number) => {
    const [orderRes, paymentListRes] = await Promise.all([
      orderApi.getById(orderId),
      paymentApi.getByOrder(orderId),
    ]);
    const paymentList = paymentListRes.data || [];
    const latestPayment = paymentList[0] || null;
    setSelectedOrder(orderRes.data);
    setOrderPayments(paymentList);
    if (latestPayment) {
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(latestPayment.channel || 'STRIPE');
    }
  };

  const handleEditProfile = async () => {
    try {
      const values = await editForm.validateFields();
      await userApi.updateProfile(values);
      message.success(t('pages.profile.updated'));
      setEditModalVisible(false);
      fetchUserInfo();
    } catch {
      message.error(t('messages.updateFailed'));
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      const userId = Number(localStorage.getItem('userId'));
      await userApi.updatePassword(userId, values.oldPassword, values.newPassword);
      message.success(t('pages.profile.passwordChanged'));
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.passwordFailed'));
    }
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailVisible(true);
    try {
      const res = await orderApi.getItems(order.id);
      setOrderItems(res.data);
    } catch {
      setOrderItems([]);
    }
  };

  const openProductDetail = (productId: number) => {
    setOrderDetailVisible(false);
    navigate(`/products/${productId}`);
  };

  const handleReorder = async () => {
    const userId = Number(localStorage.getItem('userId'));
    if (!userId || orderItems.length === 0) return;
    setReordering(true);
    let added = 0;
    try {
      for (const item of orderItems) {
        try {
          await cartApi.addItem(userId, item.productId, item.quantity, item.selectedSpecs);
          added += item.quantity;
        } catch {
          // Keep trying the remaining order items.
        }
      }
      if (added === 0) {
        message.error(t('pages.profile.reorderFailed'));
        return;
      }
      message.success(
        added === orderItems.reduce((sum, item) => sum + item.quantity, 0)
          ? t('pages.profile.reordered', { count: added })
          : t('pages.profile.reorderPartial', { count: added }),
      );
      window.dispatchEvent(new Event('shop:cart-updated'));
      window.dispatchEvent(new Event('shop:open-cart'));
    } finally {
      setReordering(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      await orderApi.cancel(orderId);
      message.success(t('pages.profile.orderCancelled'));
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.cancelFailed'));
    }
  };

  const handleContinuePayment = async (order: Order) => {
    setPayingOrderId(order.id);
    try {
      const paymentListRes = await paymentApi.getByOrder(order.id);
      const paymentList = paymentListRes.data;
      const preferredMethod = order.paymentMethod || paymentList[0]?.channel || 'STRIPE';
      const latestPayment = paymentList[0] || (await paymentApi.create(order.id, preferredMethod)).data;
      setSelectedOrder(order);
      setOrderPayments(paymentList.length > 0 ? paymentList : [latestPayment]);
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(latestPayment.channel || preferredMethod);
      setPaymentModalVisible(true);
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.continuePayFailed'));
      fetchOrders();
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleSimulatePayment = async () => {
    if (!selectedPayment) return;
    setSimulatingPayment(true);
    try {
      const paidRes = await paymentApi.simulatePaid(selectedPayment.id);
      setSelectedPayment(paidRes.data);
      message.success(t('pages.checkout.paid'));
      await fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.checkout.payFailed'));
      await fetchOrders();
    } finally {
      setSimulatingPayment(false);
    }
  };

  const handleSimulateCallback = async () => {
    if (!selectedPayment) return;
    setSimulatingCallback(true);
    try {
      const callbackRes = await paymentApi.simulateCallback(selectedPayment.id);
      setSelectedPayment(callbackRes.data);
      setSelectedPaymentMethod(callbackRes.data.channel);
      message.success(t('pages.checkout.paid'));
      await fetchOrders();
      if (selectedOrder) {
        await refreshPaymentState(selectedOrder.id);
      }
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.checkout.payFailed'));
      await fetchOrders();
    } finally {
      setSimulatingCallback(false);
    }
  };

  const handleRefreshPayment = async () => {
    if (!selectedOrder) return;
    setRefreshingPayment(true);
    try {
      const paymentRes = await paymentApi.create(selectedOrder.id, selectedPaymentMethod || selectedPayment?.channel || selectedOrder.paymentMethod || 'STRIPE');
      setSelectedPayment(paymentRes.data);
      setSelectedPaymentMethod(paymentRes.data.channel);
      setOrderPayments((items) => [paymentRes.data, ...items.filter((item) => item.id !== paymentRes.data.id)]);
      message.success(t('pages.profile.paymentRefreshed'));
      await fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.continuePayFailed'));
      await fetchOrders();
    } finally {
      setRefreshingPayment(false);
    }
  };

  useEffect(() => {
    const orderId = selectedOrder?.id;
    if (!paymentModalVisible || !orderId) return undefined;
    const syncPaymentState = async () => {
      try {
        await refreshPaymentState(orderId);
      } catch {
        // keep the current modal content if one polling request fails
      }
    };
    syncPaymentState();
    const timer = window.setInterval(syncPaymentState, 5000);
    return () => window.clearInterval(timer);
  }, [paymentModalVisible, selectedOrder?.id]);

  const handleConfirmReceipt = async (orderId: number) => {
    try {
      await orderApi.confirm(orderId);
      message.success(t('pages.profile.receiptConfirmed'));
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.confirmFailed'));
    }
  };

  const handleReturnOrder = async (orderId: number) => {
    try {
      await orderApi.returnOrder(orderId);
      message.success(t('pages.profile.returnRequested'));
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.returnFailed'));
    }
  };

  const handleSubmitReturnShipment = async () => {
    if (!returnShipmentOrder) return;
    if (!returnTrackingNumber.trim()) {
      message.error(t('pages.profile.returnTrackingRequired'));
      return;
    }
    try {
      setSubmittingReturnShipment(true);
      await orderApi.submitReturnShipment(returnShipmentOrder.id, returnTrackingNumber.trim());
      message.success(t('pages.profile.returnShipmentSubmitted'));
      setReturnShipmentOrder(null);
      setReturnTrackingNumber('');
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.returnShipmentFailed'));
    } finally {
      setSubmittingReturnShipment(false);
    }
  };

  const handleTrackShipment = (trackingNumber?: string, carrierCode?: string) => {
    if (!trackingNumber) {
      message.warning('No tracking number');
      return;
    }
    setSelectedTrackingNumber(trackingNumber);
    setSelectedTrackingCarrierCode(carrierCode);
    setTrackingVisible(true);
  };

  const handleSaveAddress = async () => {
    try {
      const values = await addressForm.validateFields();
      const userId = Number(localStorage.getItem('userId'));
      const regionStr = values.region ? values.region.join(' ') : '';
      const fullAddress = `${regionStr} ${values.detail || ''}`.trim();
      const payload = { recipientName: values.recipientName, phone: values.phone, address: fullAddress };
      if (editingAddress) {
        await addressApi.update(editingAddress.id, { ...payload, userId });
        message.success(t('pages.profile.addressUpdated'));
      } else {
        await addressApi.create({ ...payload, userId });
        message.success(t('pages.profile.addressAdded'));
      }
      setAddressModalVisible(false);
      setEditingAddress(null);
      addressForm.resetFields();
      fetchAddresses();
    } catch {
      message.error(t('pages.profile.addressSaveFailed'));
    }
  };

  const handleDeleteAddress = async (id: number) => {
    try {
      await addressApi.delete(id);
      message.success(t('pages.profile.addressDeleted'));
      fetchAddresses();
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const handleSetDefault = async (id: number) => {
    const userId = Number(localStorage.getItem('userId'));
    try {
      await addressApi.setDefault(id, userId);
      message.success(t('pages.profile.defaultSet'));
      fetchAddresses();
    } catch {
      message.error(t('pages.profile.setFailed'));
    }
  };

  const openAddressModal = (address?: UserAddress) => {
    if (address) {
      const { region, detail } = findRegionPath(address.address);
      setEditingAddress(address);
      addressForm.setFieldsValue({
        recipientName: address.recipientName,
        phone: address.phone,
        region,
        detail,
      });
    } else {
      setEditingAddress(null);
      addressForm.resetFields();
    }
    setAddressModalVisible(true);
  };

  const openEditModal = () => {
    editForm.setFieldsValue({ email: user?.email, phone: user?.phone });
    setEditModalVisible(true);
  };

  const openPetModal = (pet?: PetProfile) => {
    setEditingPet(pet || null);
    if (pet) {
      petForm.setFieldsValue({
        ...pet,
        birthday: pet.birthday ? dayjs(pet.birthday) : undefined,
      });
    } else {
      petForm.resetFields();
      petForm.setFieldsValue({ petType: 'DOG', size: 'MEDIUM' });
    }
    setPetModalVisible(true);
  };

  const handleSavePet = async () => {
    try {
      const values = await petForm.validateFields();
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined,
      };
      if (editingPet) {
        await petProfileApi.update(editingPet.id, payload);
        message.success(t('messages.updateSuccess'));
      } else {
        await petProfileApi.create(payload);
        message.success(t('pages.profile.petAdded'));
      }
      setPetModalVisible(false);
      setEditingPet(null);
      fetchPetProfiles();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    }
  };

  const handleDeletePet = async (id: number) => {
    try {
      await petProfileApi.delete(id);
      message.success(t('messages.deleteSuccess'));
      fetchPetProfiles();
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const orderStatusTabs = [
    { key: 'all', label: t('pages.profile.allOrders') },
    { key: 'PENDING_PAYMENT', label: t('status.PENDING_PAYMENT') },
    { key: 'PENDING_SHIPMENT', label: t('status.PENDING_SHIPMENT') },
    { key: 'SHIPPED', label: t('status.SHIPPED') },
    { key: 'COMPLETED', label: t('status.COMPLETED') },
    { key: 'RETURN_REQUESTED', label: t('status.RETURN_REQUESTED') },
    { key: 'CANCELLED', label: t('status.CANCELLED') },
  ];
  const orderCountByStatus = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const normalizedSearchText = orderSearchText.trim().toLowerCase();
  const filteredOrders = (orderStatusFilter === 'all'
    ? orders
    : sortOrdersNewestFirst(orders.filter((order) => order.status === orderStatusFilter)))
    .filter((order) => {
      if (!normalizedSearchText) return true;
      const items = orderItemsByOrderId[order.id] || [];
      return [
        order.orderNo,
        order.id,
        order.trackingNumber,
        order.shippingAddress,
        ...items.map((item) => item.productName),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearchText));
    });
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'es-MX';
  const { formatMoney } = useMarket();
  const paymentOptions = createPaymentMethodOptions(t);

  if (loading || !user) {
    return <div style={{ textAlign: 'center', padding: 80 }}>{t('common.loading')}</div>;
  }

  return (
    <div className="profile-page" style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <Title level={2}>{t('pages.profile.title')}</Title>

      <Tabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: t('pages.profile.info'),
            children: (
              <Card>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label={t('pages.profile.username')}>{user.username}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.profile.email')}>{user.email || t('common.unset')}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.profile.phone')}>{user.phone || t('common.unset')}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.profile.defaultAddress')}>{addresses.find((item) => item.isDefault)?.address || t('common.unset')}</Descriptions.Item>
                </Descriptions>
                <Space style={{ marginTop: 16 }}>
                  <Button icon={<EditOutlined />} onClick={openEditModal}>{t('pages.profile.editProfile')}</Button>
                  <Button icon={<LockOutlined />} onClick={() => setPasswordModalVisible(true)}>{t('pages.profile.changePassword')}</Button>
                </Space>
              </Card>
            ),
          },
          {
            key: 'addresses',
            label: t('pages.profile.addresses', { count: addresses.length }),
            children: (
              <div>
                <Button type="dashed" icon={<PlusOutlined />} block style={{ marginBottom: 16 }} onClick={() => openAddressModal()}>
                  {t('pages.profile.addAddress')}
                </Button>
                {addresses.length === 0 ? (
                  <Empty description={t('pages.profile.noAddresses')} />
                ) : (
                  <List
                    dataSource={addresses}
                    renderItem={(address) => (
                      <Card key={address.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                          <div>
                            <Space>
                              <Text strong>{address.recipientName}</Text>
                              <Text type="secondary">{address.phone}</Text>
                              {address.isDefault && <Tag color="orange">{t('pages.checkout.defaultAddress')}</Tag>}
                            </Space>
                            <div style={{ marginTop: 4 }}><Text>{address.address}</Text></div>
                          </div>
                          <Space wrap>
                            {!address.isDefault ? (
                              <Button size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(address.id)}>{t('pages.profile.setDefault')}</Button>
                            ) : (
                              <Button size="small" icon={<StarFilled />} disabled type="primary">{t('pages.profile.defaultAddressButton')}</Button>
                            )}
                            <Button size="small" icon={<EditOutlined />} onClick={() => openAddressModal(address)}>{t('common.edit')}</Button>
                            <Popconfirm title={t('pages.profile.deleteAddressConfirm')} onConfirm={() => handleDeleteAddress(address.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                              <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                            </Popconfirm>
                          </Space>
                        </div>
                      </Card>
                    )}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'orders',
            label: t('pages.profile.orders', { count: orders.length }),
            children: orders.length === 0 ? (
              <Empty description={t('pages.profile.noOrders')}>
                <Button type="primary" onClick={() => navigate('/products')}>{t('pages.profile.goShopping')}</Button>
              </Empty>
            ) : (
              <div className="profile-orders">
                <div className="profile-orders__tabs">
                  {orderStatusTabs.map((tab) => {
                    const count = tab.key === 'all' ? orders.length : orderCountByStatus[tab.key] || 0;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={orderStatusFilter === tab.key ? 'profile-orders__tab profile-orders__tab--active' : 'profile-orders__tab'}
                        onClick={() => setOrderStatusFilter(tab.key)}
                      >
                        {tab.label}{tab.key !== 'all' && count > 0 ? ` ${count}` : ''}
                      </button>
                    );
                  })}
                </div>
                <div className="profile-orders__toolbar">
                  <Input.Search
                    allowClear
                    value={orderSearchText}
                    onChange={(event) => setOrderSearchText(event.target.value)}
                    placeholder="商品标题/订单号/快递单号"
                    style={{ maxWidth: 420 }}
                  />
                  <Button onClick={() => fetchOrders()}>{t('common.refresh') === 'common.refresh' ? 'Refresh' : t('common.refresh')}</Button>
                </div>
                <div className="profile-orders__header">
                  <span>订单信息</span>
                  <span>商品金额</span>
                  <span>实付款</span>
                  <span>订单操作</span>
                </div>
                {filteredOrders.length === 0 ? (
                  <Empty description={t('pages.profile.noOrders')} />
                ) : (
                  filteredOrders.map((order) => {
                    const items = orderItemsByOrderId[order.id] || [];
                    const primaryItem = items[0];
                    return (
                      <div className="profile-order-card" key={order.id}>
                        <div className="profile-order-card__top">
                          <Space wrap>
                            <Text>{order.createdAt ? new Date(order.createdAt).toLocaleDateString(dateLocale) : '-'}</Text>
                            <Text strong>{t('pages.profile.orderNo')}{order.orderNo || order.id}</Text>
                            <Tag color={statusColors[order.status]}>{t(`status.${order.status}`)}</Tag>
                            <button type="button" className="profile-order-card__link" onClick={() => handleViewOrder(order)}>
                              {t('pages.profile.detail')}
                            </button>
                          </Space>
                          <Text type="secondary">{order.trackingNumber ? `Tracking: ${order.trackingNumber}` : ''}</Text>
                        </div>
                        <div className="profile-order-card__body">
                          <div className="profile-order-card__items">
                            {primaryItem ? (
                              <div className="profile-order-item">
                                <button
                                  type="button"
                                  className="profile-order-item__imageButton"
                                  onClick={() => openProductDetail(primaryItem.productId)}
                                >
                                  <img src={primaryItem.imageUrl} alt={primaryItem.productName} />
                                </button>
                                <div className="profile-order-item__main">
                                  <button type="button" onClick={() => openProductDetail(primaryItem.productId)}>
                                    {primaryItem.productName || t('pages.profile.productFallback', { id: primaryItem.productId })}
                                  </button>
                                  <Text type="secondary">
                                    {formatMoney(primaryItem.price)} x {primaryItem.quantity}
                                  </Text>
                                  {primaryItem.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(primaryItem.selectedSpecs, t)}</Text> : null}
                                  {items.length > 1 ? <Text type="secondary">+{items.length - 1} more item(s)</Text> : null}
                                  {order.shippingAddress ? <Text type="secondary" ellipsis>{order.shippingAddress}</Text> : null}
                                </div>
                              </div>
                            ) : (
                              <Text type="secondary">{t('pages.profile.noOrderItems')}</Text>
                            )}
                          </div>
                          <div className="profile-order-card__amount">
                            <Text type="secondary" className="profile-order-card__mobileLabel">商品金额</Text>
                            <Text strong>{formatMoney(order.originalAmount || order.totalAmount)}</Text>
                            {order.discountAmount && order.discountAmount > 0 ? <Text type="secondary">-{formatMoney(order.discountAmount)}</Text> : null}
                            <Text type="secondary">x{items.reduce((sum, item) => sum + item.quantity, 0) || 1}</Text>
                          </div>
                          <div className="profile-order-card__paid">
                            <Text type="secondary" className="profile-order-card__mobileLabel">实付款</Text>
                            <Text strong>{formatMoney(order.totalAmount)}</Text>
                            <Text type="secondary">含运费：{formatMoney(0)}</Text>
                            <Tag>手机订单</Tag>
                          </div>
                          <div className="profile-order-card__actions">
                            {order.status === 'PENDING_PAYMENT' && (
                              <Button type="primary" loading={payingOrderId === order.id} onClick={() => handleContinuePayment(order)}>
                                {t('pages.profile.continuePay')}
                              </Button>
                            )}
                            {order.status === 'SHIPPED' && (
                              <Button type="primary" onClick={() => handleConfirmReceipt(order.id)}>{t('pages.profile.confirmReceipt')}</Button>
                            )}
                            {order.status === 'COMPLETED' && (
                              <Popconfirm title={t('pages.profile.returnOrderConfirm')} onConfirm={() => handleReturnOrder(order.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                                <Button>{t('pages.profile.returnOrder')}</Button>
                              </Popconfirm>
                            )}
                            <Button type="link" onClick={() => handleViewOrder(order)}>{t('pages.profile.detail')}</Button>
                            {order.trackingNumber ? <Button type="link" onClick={() => handleTrackShipment(order.trackingNumber, order.trackingCarrierCode)}>查看物流</Button> : null}
                            {order.status === 'PENDING_PAYMENT' && (
                              <Popconfirm title={t('pages.profile.cancelOrderConfirm')} onConfirm={() => handleCancelOrder(order.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                                <Button type="link" danger>{t('pages.profile.cancelOrder')}</Button>
                              </Popconfirm>
                            )}
                            {order.status === 'RETURN_APPROVED' && (
                              <Button type="link" onClick={() => { setReturnShipmentOrder(order); setReturnTrackingNumber(order.returnTrackingNumber || ''); }}>
                                {t('pages.profile.submitReturnShipment')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ),
          },
          {
            key: 'pets',
            label: t('pages.profile.pets', { count: petProfiles.length }),
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <Space direction="vertical" size={4}>
                    <Text strong>{t('pages.profile.petBirthdayPerkTitle')}</Text>
                    <Text type="secondary">{t('pages.profile.petBirthdayPerkText')}</Text>
                  </Space>
                </Card>
                <Button type="dashed" icon={<PlusOutlined />} block style={{ marginBottom: 16 }} onClick={() => openPetModal()}>
                  {t('pages.profile.addPet')}
                </Button>
                {petProfiles.length === 0 ? (
                  <Empty description={t('pages.profile.noPets')} />
                ) : (
                  <List
                    grid={{ gutter: 16, xs: 1, sm: 2, md: 2 }}
                    dataSource={petProfiles}
                    renderItem={(pet) => (
                      <List.Item>
                        <Card
                          title={pet.name}
                          extra={<Tag color="green">{pet.petType.replace('_', ' ')}</Tag>}
                          actions={[
                            <Button type="link" icon={<EditOutlined />} onClick={() => openPetModal(pet)}>{t('common.edit')}</Button>,
                            <Popconfirm title={t('pages.profile.deletePetConfirm')} onConfirm={() => handleDeletePet(pet.id)}>
                              <Button type="link" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                            </Popconfirm>,
                          ]}
                        >
                          <Space direction="vertical">
                            <Text>{t('pages.profile.petBreed')}: {pet.breed || t('common.unset')}</Text>
                            <Text>{t('pages.profile.petBirthday')}: {pet.birthday || t('common.unset')}</Text>
                            <Text>{t('pages.profile.petWeight')}: {pet.weight ? `${pet.weight} kg` : t('common.unset')}</Text>
                            <Text>{t('pages.profile.petSize')}: {pet.size || t('common.unset')}</Text>
                            {pet.birthday ? <Tag color="gold">{t('pages.profile.birthdayCouponEnabled')}</Tag> : null}
                          </Space>
                        </Card>
                      </List.Item>
                    )}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal title={t('pages.profile.editProfileTitle')} open={editModalVisible} onOk={handleEditProfile} onCancel={() => setEditModalVisible(false)}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="email" label={t('pages.profile.email')} rules={[{ type: 'email', message: t('pages.profile.emailInvalid') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('pages.profile.phone')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pages.profile.changePassword')} open={passwordModalVisible} onOk={handleChangePassword} onCancel={() => { setPasswordModalVisible(false); passwordForm.resetFields(); }}>
        <Form form={passwordForm} layout="vertical">
          <Form.Item name="oldPassword" label={t('pages.profile.oldPassword')} rules={[{ required: true, message: t('pages.profile.oldPasswordRequired') }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label={t('pages.profile.newPassword')} rules={[{ required: true, min: 6, message: t('pages.profile.newPasswordMin') }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('pages.profile.confirmNewPassword')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('pages.profile.confirmNewRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.profile.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingAddress ? t('pages.profile.editAddressTitle') : t('pages.profile.addAddressTitle')}
        open={addressModalVisible}
        onOk={handleSaveAddress}
        onCancel={() => { setAddressModalVisible(false); addressForm.resetFields(); setEditingAddress(null); }}
        width={560}
      >
        <Form form={addressForm} layout="vertical">
          <Form.Item name="recipientName" label={t('pages.profile.recipient')} rules={[{ required: true, message: t('pages.profile.recipientRequired') }]}>
            <Input placeholder={t('pages.profile.recipientRequired')} />
          </Form.Item>
          <Form.Item name="phone" label={t('pages.profile.phone')} rules={[{ required: true, message: t('pages.profile.phoneRequired') }]}>
            <Input placeholder={t('pages.profile.phoneRequired')} />
          </Form.Item>
          <Form.Item name="region" label={t('pages.profile.region')} rules={[{ required: true, message: t('pages.profile.regionRequired') }]}>
            <Cascader options={regionData} placeholder={t('pages.profile.region')} showSearch />
          </Form.Item>
          <Form.Item name="detail" label={t('pages.profile.detailAddress')} rules={[{ required: true, message: t('pages.profile.detailRequired') }]}>
            <Input.TextArea rows={2} placeholder={t('pages.profile.detailRequired')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPet ? t('pages.profile.editPet') : t('pages.profile.addPet')}
        open={petModalVisible}
        onOk={handleSavePet}
        onCancel={() => { setPetModalVisible(false); setEditingPet(null); petForm.resetFields(); }}
      >
        <Form form={petForm} layout="vertical">
          <Form.Item name="name" label={t('pages.profile.petName')} rules={[{ required: true, message: t('pages.profile.petNameRequired') }]}>
            <Input placeholder="Milo" />
          </Form.Item>
          <Form.Item name="petType" label={t('pages.profile.petType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DOG', label: t('pages.profile.petDog') },
                { value: 'CAT', label: t('pages.profile.petCat') },
                { value: 'SMALL_PET', label: t('pages.profile.petSmall') },
              ]}
            />
          </Form.Item>
          <Form.Item name="breed" label={t('pages.profile.petBreed')}>
            <Input placeholder="Golden Retriever" />
          </Form.Item>
          <Form.Item name="birthday" label={t('pages.profile.petBirthday')}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="weight" label={t('pages.profile.petWeightKg')}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="size" label={t('pages.profile.petSize')}>
            <Select
              allowClear
              options={[
                { value: 'SMALL', label: 'Small' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'LARGE', label: 'Large' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pages.profile.orderDetail', { id: selectedOrder?.orderNo || selectedOrder?.id || '' })} open={orderDetailVisible} onCancel={() => setOrderDetailVisible(false)} footer={null} width={640}>
        {selectedOrder && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('common.status')}><Tag color={statusColors[selectedOrder.status]}>{t(`status.${selectedOrder.status}`)}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('common.amount')}><Text strong style={{ color: '#ee4d2d' }}>{formatMoney(selectedOrder.totalAmount)}</Text></Descriptions.Item>
              {selectedOrder.originalAmount ? <Descriptions.Item label="Subtotal">{formatMoney(selectedOrder.originalAmount)}</Descriptions.Item> : null}
              {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 ? (
                <Descriptions.Item label="Coupon">{selectedOrder.couponName || '-'} / -{formatMoney(selectedOrder.discountAmount)}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('pages.checkout.address')}>{selectedOrder.shippingAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>{selectedOrder.paymentMethod ? paymentMethodLabel(selectedOrder.paymentMethod, t) : '-'}</Descriptions.Item>
              <Descriptions.Item label="Tracking">
                {selectedOrder.trackingNumber ? (
                  <Space>
                    <span>{selectedOrder.trackingNumber}</span>
                    {selectedOrder.trackingCarrierName ? <Tag>{selectedOrder.trackingCarrierName}</Tag> : null}
                    <Button size="small" onClick={() => handleTrackShipment(selectedOrder.trackingNumber, selectedOrder.trackingCarrierCode)}>Track</Button>
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnTracking')}>{selectedOrder.returnTrackingNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="Shipped at">{selectedOrder.shippedAt ? new Date(selectedOrder.shippedAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.adminOrders.createdAt')}>{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>{t('pages.profile.orderItems')}</Title>
              <Button icon={<ShoppingCartOutlined />} loading={reordering} disabled={orderItems.length === 0} onClick={handleReorder}>
                {t('pages.profile.reorder')}
              </Button>
            </div>
            {orderItems.length > 0 ? (
              <List
                dataSource={orderItems}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <button
                          type="button"
                          onClick={() => openProductDetail(item.productId)}
                          style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}
                        >
                          <img src={item.imageUrl} alt={item.productName} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                        </button>
                      }
                      title={
                        <button
                          type="button"
                          onClick={() => openProductDetail(item.productId)}
                          style={{ border: 0, background: 'transparent', padding: 0, color: '#1677ff', cursor: 'pointer', textAlign: 'left' }}
                        >
                          {item.productName || t('pages.profile.productFallback', { id: item.productId })}
                        </button>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                          <Text type="secondary">{formatMoney(item.price)} x {item.quantity}</Text>
                        </Space>
                      }
                    />
                    <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(item.price * item.quantity)}</Text>
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">{t('pages.profile.noOrderItems')}</Text>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={t('pages.profile.submitReturnShipment')}
        open={!!returnShipmentOrder}
        confirmLoading={submittingReturnShipment}
        onOk={handleSubmitReturnShipment}
        onCancel={() => { setReturnShipmentOrder(null); setReturnTrackingNumber(''); }}
      >
        <Input
          value={returnTrackingNumber}
          onChange={(e) => setReturnTrackingNumber(e.target.value)}
          placeholder={t('pages.profile.returnTrackingPlaceholder')}
          maxLength={100}
        />
      </Modal>

      <Modal
        title="Logistics tracking"
        open={trackingVisible}
        onCancel={() => setTrackingVisible(false)}
        footer={null}
        width={720}
      >
        <SeventeenTrackWidget trackingNumber={selectedTrackingNumber} carrierCode={selectedTrackingCarrierCode} />
      </Modal>

      <Modal
        title={t('pages.profile.continuePay')}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={[
          selectedPayment?.status === 'PENDING' && (
            <Button
              key="pay"
              type="primary"
              loading={simulatingPayment}
              onClick={selectedPayment.channel === 'STRIPE' && selectedPayment.paymentUrl ? () => {
                if (!navigateToSafeUrl(selectedPayment.paymentUrl)) {
                  message.error(t('pages.payment.failed'));
                }
              } : handleSimulatePayment}
            >
              {selectedPayment.channel === 'STRIPE' ? t('pages.checkout.openPayment') : t('pages.checkout.simulatePay')}
            </Button>
          ),
          selectedPayment && selectedPayment.status !== 'PAID' && (
            <Button key="refresh" loading={refreshingPayment} onClick={handleRefreshPayment}>
              {t('pages.profile.refreshPayment')}
            </Button>
          ),
          selectedPayment?.status === 'PENDING' && selectedPayment.channel !== 'STRIPE' && (
            <Button key="callback" loading={simulatingCallback} onClick={handleSimulateCallback}>
              {t('pages.checkout.simulateCallback')}
            </Button>
          ),
          <Button key="close" onClick={() => setPaymentModalVisible(false)}>{t('common.cancel')}</Button>,
        ].filter(Boolean)}
      >
        {selectedOrder && selectedPayment && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('pages.profile.orderNo')}>{selectedOrder.orderNo || selectedOrder.id}</Descriptions.Item>
              <Descriptions.Item label={t('common.amount')}>
                <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(selectedOrder.totalAmount)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>
                <Select
                  value={selectedPaymentMethod}
                  options={paymentOptions}
                  style={{ minWidth: 220 }}
                  onChange={setSelectedPaymentMethod}
                  disabled={selectedPayment.status === 'PAID'}
                />
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={selectedPayment.status === 'PAID' ? 'green' : selectedPayment.status === 'PENDING' ? 'orange' : 'red'}>
                  {t(`status.${selectedPayment.status}`)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentLink')}>{selectedPayment.paymentUrl || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.paymentExpiresAt')}>
                {selectedPayment.expiresAt ? new Date(selectedPayment.expiresAt).toLocaleString(dateLocale) : '-'}
              </Descriptions.Item>
              {selectedPayment.transactionId && (
                <Descriptions.Item label={t('pages.checkout.transactionId')}>{selectedPayment.transactionId}</Descriptions.Item>
              )}
            </Descriptions>
            <div>
              <Text strong>{t('pages.profile.paymentHistory')}</Text>
              <List
                size="small"
                dataSource={orderPayments}
                locale={{ emptyText: t('pages.profile.noPaymentHistory') }}
                renderItem={(payment) => (
                  <List.Item>
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color={payment.status === 'PAID' ? 'green' : payment.status === 'PENDING' ? 'orange' : 'red'}>
                          {t(`status.${payment.status}`)}
                        </Tag>
                        <Text>{paymentMethodLabel(payment.channel, t)}</Text>
                        {payment.amount ? <Text type="secondary">{formatMoney(payment.amount)}</Text> : null}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {payment.createdAt ? new Date(payment.createdAt).toLocaleString(dateLocale) : ''}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default Profile;
