import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Cascader, DatePicker, Descriptions, Empty, Form, Input, InputNumber, List, message, Modal, Popconfirm, Progress, Select, Space, Tabs, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EnvironmentOutlined, HeartOutlined, LockOutlined, PlusOutlined, ShoppingCartOutlined, StarFilled, StarOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addressApi, apiBaseUrl, cartApi, orderApi, paymentApi, petProfileApi, userApi } from '../api';
import type { Order, OrderItem, Payment, PetProfile, User, UserAddress } from '../types';
import { findRegionPath, regionData } from '../regionData';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, mexicoPaymentMethodDetails, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import './Profile.css';
import dayjs from 'dayjs';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { navigateToSafeUrl } from '../utils/safeUrl';
import { formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';

const { Title, Text } = Typography;
const orderImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveOrderImage = (imageUrl?: string) => {
  if (!imageUrl) return orderImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const useImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== orderImageFallback) {
    event.currentTarget.src = orderImageFallback;
  }
};

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
  REFUNDED: 'purple',
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

const normalizeProfileTab = (value: string | null) =>
  value === 'info' || value === 'addresses' || value === 'orders' || value === 'pets' ? value : null;

type OrderActionHintTone = 'pay' | 'wait' | 'ship' | 'return' | 'done' | 'neutral';

type OrderActionHint = {
  tone: OrderActionHintTone;
  title: string;
  text: string;
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedProfileTab = normalizeProfileTab(searchParams.get('tab'));
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
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const [returnShipmentOrder, setReturnShipmentOrder] = useState<Order | null>(null);
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [submittingReturnShipment, setSubmittingReturnShipment] = useState(false);
  const [returnRequestOrder, setReturnRequestOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [petSubmitting, setPetSubmitting] = useState(false);
  const [trackingVisible, setTrackingVisible] = useState(false);
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState('');
  const [selectedTrackingCarrierCode, setSelectedTrackingCarrierCode] = useState<string | undefined>();
  const [profileActiveTab, setProfileActiveTab] = useState(requestedProfileTab || 'info');
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

  useEffect(() => {
    if (requestedProfileTab) {
      setProfileActiveTab((current) => requestedProfileTab === current ? current : requestedProfileTab);
    }
  }, [requestedProfileTab]);

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
      setProfileSubmitting(true);
      await userApi.updateProfile(values);
      message.success(t('pages.profile.updated'));
      setEditModalVisible(false);
      fetchUserInfo();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(t('messages.updateFailed'));
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordSubmitting(true);
      const userId = Number(localStorage.getItem('userId'));
      await userApi.updatePassword(userId, values.oldPassword, values.newPassword);
      message.success(t('pages.profile.passwordChanged'));
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || t('pages.profile.passwordFailed'));
    } finally {
      setPasswordSubmitting(false);
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

  const openReturnModal = (order: Order) => {
    setReturnRequestOrder(order);
    setReturnReason(order.returnReason || '');
  };

  const handleReturnOrder = async () => {
    if (!returnRequestOrder) return;
    try {
      setRequestingReturn(true);
      await orderApi.returnOrder(returnRequestOrder.id, returnReason.trim());
      message.success(t('pages.profile.returnRequested'));
      setReturnRequestOrder(null);
      setReturnReason('');
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.profile.returnFailed'));
    } finally {
      setRequestingReturn(false);
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
      message.warning(t('pages.adminOrders.noTrackingNumber'));
      return;
    }
    setSelectedTrackingNumber(trackingNumber);
    setSelectedTrackingCarrierCode(carrierCode);
    setTrackingVisible(true);
  };

  const openSupport = () => {
    window.dispatchEvent(new Event('shop:open-support'));
  };

  const handleSaveAddress = async () => {
    try {
      const values = await addressForm.validateFields();
      setAddressSubmitting(true);
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
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(t('pages.profile.addressSaveFailed'));
    } finally {
      setAddressSubmitting(false);
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
      setPetSubmitting(true);
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
    } finally {
      setPetSubmitting(false);
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

  const afterSaleStatuses = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURNED'];
  const isReturnableOrder = (order: Order) => order.status === 'COMPLETED' && Boolean(order.returnable);
  const orderStatusTabs = [
    { key: 'all', label: t('pages.profile.allOrders') },
    { key: 'PENDING_PAYMENT', label: t('status.PENDING_PAYMENT'), statuses: ['PENDING_PAYMENT'] },
    { key: 'PENDING_SHIPMENT', label: t('status.PENDING_SHIPMENT'), statuses: ['PENDING_SHIPMENT'] },
    { key: 'SHIPPED', label: t('status.SHIPPED'), statuses: ['SHIPPED'] },
    { key: 'COMPLETED', label: t('status.COMPLETED'), statuses: ['COMPLETED'] },
    { key: 'RETURNABLE', label: t('pages.profile.afterSaleReturnable') },
    { key: 'AFTER_SALE', label: t('pages.profile.afterSale'), statuses: afterSaleStatuses },
    { key: 'CANCELLED', label: t('status.CANCELLED'), statuses: ['CANCELLED'] },
  ];
  const matchesOrderFilter = (order: Order) => {
    if (orderStatusFilter === 'all') return true;
    if (orderStatusFilter === 'RETURNABLE') return isReturnableOrder(order);
    const currentTab = orderStatusTabs.find((tab) => tab.key === orderStatusFilter);
    return currentTab?.statuses?.includes(order.status) || false;
  };
  const normalizedSearchText = orderSearchText.trim().toLowerCase();
  const filteredOrders = sortOrdersNewestFirst(orders.filter(matchesOrderFilter))
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
  const selectedPaymentMethodDetail = mexicoPaymentMethodDetails.find((method) => method.value === selectedPaymentMethod);
  const selectedPaymentRecovery = getPaymentRecoveryState(selectedPayment);
  const pendingPaymentCount = orders.filter((order) => order.status === 'PENDING_PAYMENT').length;
  const inTransitCount = orders.filter((order) => order.status === 'SHIPPED').length;
  const afterSaleCount = orders.filter((order) => afterSaleStatuses.includes(order.status)).length;
  const returnableOrdersCount = orders.filter(isReturnableOrder).length;
  const returnApprovedCount = orders.filter((order) => order.status === 'RETURN_APPROVED').length;
  const returnShippedCount = orders.filter((order) => order.status === 'RETURN_SHIPPED').length;
  const defaultAddressReady = addresses.some((address) => address.isDefault);
  const completedPetProfiles = petProfiles.filter((pet) => pet.name && pet.petType && pet.size && pet.weight && pet.birthday).length;
  const petProfileProgress = petProfiles.length > 0 ? Math.round((completedPetProfiles / petProfiles.length) * 100) : 0;
  const petsMissingBirthdayCount = petProfiles.filter((pet) => !pet.birthday).length;
  const petsMissingFitCount = petProfiles.filter((pet) => !pet.weight || !pet.size).length;
  const completeAddressCount = addresses.filter((address) => address.recipientName && address.phone && address.address).length;
  const addressesMissingPhoneCount = addresses.filter((address) => !address.phone).length;
  const addressesMissingDetailCount = addresses.filter((address) => !address.address || address.address.trim().length < 8).length;
  const addressReadinessProgress = addresses.length > 0
    ? Math.round(((completeAddressCount + (defaultAddressReady ? 1 : 0)) / (addresses.length + 1)) * 100)
    : 0;
  const accountHealthSignals = [
    Boolean(user?.email),
    Boolean(user?.phone),
    defaultAddressReady,
    petProfiles.length > 0,
  ];
  const accountHealthScore = Math.round((accountHealthSignals.filter(Boolean).length / accountHealthSignals.length) * 100);
  const nextReturnDeadline = useMemo(() => {
    const deadlines = orders
      .filter((order) => isReturnableOrder(order) && order.returnDeadline)
      .map((order) => new Date(order.returnDeadline as string))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => left.getTime() - right.getTime());
    return deadlines[0] ? deadlines[0].toLocaleDateString(dateLocale) : '';
  }, [dateLocale, orders]);
  const afterSaleFocusText = returnApprovedCount > 0
    ? t('pages.profile.afterSaleFocusShipment', { count: returnApprovedCount })
    : returnShippedCount > 0
      ? t('pages.profile.afterSaleFocusRefund', { count: returnShippedCount })
      : returnableOrdersCount > 0
        ? nextReturnDeadline
          ? t('pages.profile.afterSaleFocusWindowWithDate', { count: returnableOrdersCount, date: nextReturnDeadline })
          : t('pages.profile.afterSaleFocusWindow', { count: returnableOrdersCount })
        : t('pages.profile.afterSaleFocusHealthy');
  const petCompletenessText = petProfiles.length === 0
    ? t('pages.profile.petCompletenessEmpty')
    : petProfileProgress === 100
      ? t('pages.profile.petCompletenessReady')
      : t('pages.profile.petCompletenessImprove', { count: petProfiles.length - completedPetProfiles });
  const petProfileFocus = petProfiles.find((pet) => !pet.birthday || !pet.weight || !pet.size || !pet.breed) || null;
  const petProfileFocusText = petProfiles.length === 0
    ? t('pages.profile.petProfileActionEmpty')
    : petProfileFocus
      ? t('pages.profile.petProfileActionImprove', {
        name: petProfileFocus.name || t('pages.profile.petName'),
        fields: [
          !petProfileFocus.birthday ? t('pages.profile.petBirthday') : null,
          !petProfileFocus.weight ? t('pages.profile.petWeight') : null,
          !petProfileFocus.size ? t('pages.profile.petSize') : null,
          !petProfileFocus.breed ? t('pages.profile.petBreed') : null,
        ].filter(Boolean).join(', '),
      })
      : t('pages.profile.petProfileActionReady');
  const addressReadinessText = addresses.length === 0
    ? t('pages.profile.addressReadinessEmpty')
    : addressReadinessProgress === 100
      ? t('pages.profile.addressReadinessReady')
      : t('pages.profile.addressReadinessImprove');
  const petTypeLabel = (value?: string) => {
    if (value === 'DOG') return t('pages.profile.petDog');
    if (value === 'CAT') return t('pages.profile.petCat');
    if (value === 'SMALL_PET') return t('pages.profile.petSmall');
    return value || t('common.unset');
  };
  const petSizeLabel = (value?: string) => {
    if (value === 'SMALL') return t('pages.profile.petSizeSmall');
    if (value === 'MEDIUM') return t('pages.profile.petSizeMedium');
    if (value === 'LARGE') return t('pages.profile.petSizeLarge');
    return value || t('common.unset');
  };
  const profilePetShoppingFocus = petProfiles.find((pet) => pet.petType && (pet.size || pet.breed)) || petProfiles[0] || null;
  const petShoppingSizeValue = (value?: string) => {
    if (value === 'SMALL') return 'Small';
    if (value === 'MEDIUM') return 'Medium';
    if (value === 'LARGE') return 'Large';
    return '';
  };
  const petShoppingKeyword = (pet?: PetProfile | null) => {
    if (!pet) return '';
    if (pet.breed) return pet.breed;
    if (pet.petType === 'DOG') return 'dog';
    if (pet.petType === 'CAT') return 'cat';
    return 'small pet';
  };
  const openPetShoppingPath = (pet?: PetProfile | null) => {
    const targetPet = pet || profilePetShoppingFocus;
    const params = new URLSearchParams();
    const keywordValue = petShoppingKeyword(targetPet);
    const sizeValue = petShoppingSizeValue(targetPet?.size);
    if (keywordValue) params.set('keyword', keywordValue);
    if (sizeValue) params.set('petSize', sizeValue);
    params.set('sort', 'personalized-desc');
    navigate(`/products?${params.toString()}`);
  };
  const getOrderActionHint = (order: Order): OrderActionHint => {
    const returnDeadline = order.returnDeadline ? new Date(order.returnDeadline).toLocaleDateString(dateLocale) : '';
    if (order.status === 'PENDING_PAYMENT') {
      return {
        tone: 'pay',
        title: t('pages.profile.nextPayTitle'),
        text: t('pages.profile.nextPayText'),
      };
    }
    if (order.status === 'PENDING_SHIPMENT') {
      return {
        tone: 'wait',
        title: t('pages.profile.nextShipTitle'),
        text: t('pages.profile.nextShipText'),
      };
    }
    if (order.status === 'SHIPPED') {
      return {
        tone: 'ship',
        title: t('pages.profile.nextReceiveTitle'),
        text: order.trackingNumber
          ? t('pages.profile.nextReceiveWithTrackingText', { number: order.trackingNumber })
          : t('pages.profile.nextReceiveText'),
      };
    }
    if (isReturnableOrder(order)) {
      return {
        tone: 'return',
        title: t('pages.profile.nextReturnWindowTitle'),
        text: returnDeadline
          ? t('pages.profile.nextReturnWindowText', { date: returnDeadline })
          : t('pages.profile.nextReturnWindowNoDateText'),
      };
    }
    if (order.status === 'RETURN_REQUESTED') {
      return {
        tone: 'return',
        title: t('pages.profile.nextReturnReviewTitle'),
        text: t('pages.profile.nextReturnReviewText'),
      };
    }
    if (order.status === 'RETURN_APPROVED') {
      return {
        tone: 'return',
        title: t('pages.profile.nextReturnShipTitle'),
        text: t('pages.profile.nextReturnShipText'),
      };
    }
    if (order.status === 'RETURN_SHIPPED') {
      return {
        tone: 'return',
        title: t('pages.profile.nextRefundTitle'),
        text: t('pages.profile.nextRefundText'),
      };
    }
    if (order.status === 'RETURNED') {
      return {
        tone: 'done',
        title: t('pages.profile.nextReturnedTitle'),
        text: order.refundedAt
          ? t('pages.profile.nextReturnedWithRefundText', { date: new Date(order.refundedAt).toLocaleDateString(dateLocale) })
          : t('pages.profile.nextReturnedText'),
      };
    }
    if (order.status === 'COMPLETED') {
      return {
        tone: 'done',
        title: t('pages.profile.nextCompletedTitle'),
        text: t('pages.profile.nextCompletedText'),
      };
    }
    if (order.status === 'CANCELLED') {
      return {
        tone: 'neutral',
        title: t('pages.profile.nextCancelledTitle'),
        text: t('pages.profile.nextCancelledText'),
      };
    }
    return {
      tone: 'neutral',
      title: t('pages.profile.nextOrderTitle'),
      text: t('pages.profile.nextOrderText'),
    };
  };
  const openProfileTab = (tabKey: string) => {
    setProfileActiveTab(tabKey);
    if (tabKey === 'orders') {
      setOrderStatusFilter('all');
    }
  };
  const openOrdersWithFilter = (filter: string) => {
    setProfileActiveTab('orders');
    setOrderStatusFilter(filter);
  };

  if (loading || !user) {
    return <div style={{ textAlign: 'center', padding: 80 }}>{t('common.loading')}</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-overview">
        <div className="profile-overview__copy">
          <Text className="profile-overview__eyebrow">{t('pages.profile.title')}</Text>
          <Title level={2}>{user.username}</Title>
          <Text className="profile-overview__text">
            {defaultAddressReady ? petProfileFocusText : addressReadinessText}
          </Text>
          <Space wrap className="profile-overview__actions">
            <Button type="primary" onClick={() => openProfileTab('orders')}>
              {t('pages.profile.orders', { count: orders.length })}
            </Button>
            <Button onClick={() => openProfileTab(defaultAddressReady ? 'pets' : 'addresses')}>
              {defaultAddressReady
                ? (petProfiles.length > 0 ? t('pages.profile.completePetProfile') : t('pages.profile.addPet'))
                : t('pages.profile.addAddress')}
            </Button>
          </Space>
        </div>
        <div className="profile-overview__stats" aria-label={t('pages.profile.actionCenterTitle')}>
          <div className="profile-overview__stat">
            <strong>{orders.length}</strong>
            <span>{t('pages.profile.allOrders')}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{addresses.length}</strong>
            <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{petProfiles.length}</strong>
            <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{accountHealthScore}%</strong>
            <span>{t('pages.profile.accountHealthTitle')}</span>
          </div>
        </div>
      </div>

      <div className="profile-action-center" aria-label={t('pages.profile.actionCenterTitle')}>
        <div className="profile-action-center__intro">
          <UserOutlined />
          <div>
            <Text strong>{t('pages.profile.actionCenterTitle')}</Text>
            <Text type="secondary">{t('pages.profile.actionCenterSubtitle')}</Text>
          </div>
        </div>
        <div className="profile-action-center__cards">
          <button type="button" className="profile-action-center__card profile-action-center__card--pay" onClick={() => openOrdersWithFilter('PENDING_PAYMENT')}>
            <ShoppingCartOutlined />
            <span>
              <strong>{pendingPaymentCount}</strong>
              <Text>{t('pages.profile.actionPendingPay')}</Text>
            </span>
          </button>
          <button type="button" className="profile-action-center__card" onClick={() => openOrdersWithFilter('SHIPPED')}>
            <EnvironmentOutlined />
            <span>
              <strong>{inTransitCount}</strong>
              <Text>{t('pages.profile.actionInTransit')}</Text>
            </span>
          </button>
          <button type="button" className="profile-action-center__card profile-action-center__card--return" onClick={() => openOrdersWithFilter('AFTER_SALE')}>
            <HeartOutlined />
            <span>
              <strong>{afterSaleCount}</strong>
              <Text>{t('pages.profile.actionAfterSale')}</Text>
            </span>
          </button>
          <button type="button" className="profile-action-center__card" onClick={() => setProfileActiveTab(defaultAddressReady ? 'pets' : 'addresses')}>
            {defaultAddressReady ? <HeartOutlined /> : <EnvironmentOutlined />}
            <span>
              <strong>{defaultAddressReady ? `${petProfileProgress}%` : '!'}</strong>
              <Text>{defaultAddressReady ? t('pages.profile.actionPetProfile') : t('pages.profile.actionDefaultAddress')}</Text>
            </span>
          </button>
        </div>
      </div>

      <div className="profile-mobile-entry">
        <button type="button" className={profileActiveTab === 'orders' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'} onClick={() => openProfileTab('orders')}>
          <ShoppingCartOutlined />
          <span>{t('pages.profile.orders', { count: orders.length })}</span>
        </button>
        <button type="button" className={profileActiveTab === 'addresses' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'} onClick={() => openProfileTab('addresses')}>
          <EnvironmentOutlined />
          <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
        </button>
        <button type="button" className={profileActiveTab === 'info' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'} onClick={() => openProfileTab('info')}>
          <UserOutlined />
          <span>{t('pages.profile.info')}</span>
        </button>
        <button type="button" className={profileActiveTab === 'pets' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'} onClick={() => openProfileTab('pets')}>
          <HeartOutlined />
          <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
        </button>
      </div>

      <Tabs
        className="profile-tabs"
        activeKey={profileActiveTab}
        onChange={setProfileActiveTab}
        items={[
          {
            key: 'info',
            label: t('pages.profile.info'),
            children: (
              <Card className="profile-section-card">
                <div className="profile-health-panel">
                  <div>
                    <Text strong>{t('pages.profile.accountHealthTitle')}</Text>
                    <Text type="secondary">{t('pages.profile.accountHealthText')}</Text>
                  </div>
                  <Progress type="circle" percent={accountHealthScore} size={72} strokeColor="#124734" />
                  <div className="profile-health-panel__chips">
                    <Tag color={user.email ? 'green' : 'gold'}>{t('pages.profile.accountHealthEmail')}</Tag>
                    <Tag color={user.phone ? 'green' : 'gold'}>{t('pages.profile.accountHealthPhone')}</Tag>
                    <Tag color={defaultAddressReady ? 'green' : 'gold'}>{t('pages.profile.accountHealthDefaultAddress')}</Tag>
                    <Tag color={petProfiles.length > 0 ? 'green' : 'gold'}>{t('pages.profile.accountHealthPet')}</Tag>
                  </div>
                </div>
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
                <div className="profile-address-readiness">
                  <div className="profile-address-readiness__copy">
                    <Text strong>{t('pages.profile.addressReadinessTitle')}</Text>
                    <Text type="secondary">{addressReadinessText}</Text>
                    <Progress percent={addressReadinessProgress} size="small" strokeColor="#124734" />
                  </div>
                  <div className="profile-address-readiness__stats">
                    <span>
                      <strong>{defaultAddressReady ? 1 : 0}</strong>
                      <Text type="secondary">{t('pages.profile.addressDefaultReady')}</Text>
                    </span>
                    <span>
                      <strong>{addressesMissingPhoneCount}</strong>
                      <Text type="secondary">{t('pages.profile.addressMissingPhone')}</Text>
                    </span>
                    <span>
                      <strong>{addressesMissingDetailCount}</strong>
                      <Text type="secondary">{t('pages.profile.addressMissingDetail')}</Text>
                    </span>
                  </div>
                </div>
                <Button className="profile-block-button" type="dashed" icon={<PlusOutlined />} block style={{ marginBottom: 16 }} onClick={() => openAddressModal()}>
                  {t('pages.profile.addAddress')}
                </Button>
                {addresses.length === 0 ? (
                  <Empty description={t('pages.profile.noAddresses')} />
                ) : (
                  <List
                    dataSource={addresses}
                    renderItem={(address) => (
                      <Card key={address.id} className="profile-section-card profile-address-card" style={{ marginBottom: 12 }}>
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
                <div className="profile-after-sale-panel">
                  <div className="profile-after-sale-panel__main">
                    <Text strong>{t('pages.profile.afterSaleAssistantTitle')}</Text>
                    <Text type="secondary">{afterSaleFocusText}</Text>
                  </div>
                  <div className="profile-after-sale-panel__metrics">
                    <button type="button" onClick={() => setOrderStatusFilter('RETURNABLE')}>
                      <strong>{returnableOrdersCount}</strong>
                      <span>{t('pages.profile.afterSaleReturnable')}</span>
                    </button>
                    <button type="button" onClick={() => setOrderStatusFilter('AFTER_SALE')}>
                      <strong>{afterSaleCount}</strong>
                      <span>{t('pages.profile.afterSaleActiveCases')}</span>
                    </button>
                    <button type="button" onClick={() => setOrderStatusFilter('AFTER_SALE')}>
                      <strong>{returnApprovedCount}</strong>
                      <span>{t('pages.profile.afterSaleNeedShipment')}</span>
                    </button>
                  </div>
                </div>
                <div className="profile-orders__tabs">
                  {orderStatusTabs.map((tab) => {
                    const count = tab.key === 'all'
                      ? orders.length
                      : tab.key === 'RETURNABLE'
                        ? returnableOrdersCount
                        : orders.filter((order) => tab.statuses?.includes(order.status)).length;
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
                    placeholder={t('pages.profile.orderSearchPlaceholder')}
                    style={{ maxWidth: 420 }}
                  />
                  <Button onClick={() => fetchOrders()}>{t('common.refresh')}</Button>
                </div>
                <div className="profile-orders__header">
                  <span>{t('pages.profile.orderInfo')}</span>
                  <span>{t('pages.profile.goodsAmount')}</span>
                  <span>{t('pages.profile.paidAmount')}</span>
                  <span>{t('pages.profile.orderActions')}</span>
                </div>
                {filteredOrders.length === 0 ? (
                  <Empty description={t('pages.profile.noOrders')} />
                ) : (
                  filteredOrders.map((order) => {
                    const items = orderItemsByOrderId[order.id] || [];
                    const primaryItem = items[0];
                    const actionHint = getOrderActionHint(order);
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
                          <Text type="secondary">{order.trackingNumber ? t('pages.profile.trackingNo', { number: order.trackingNumber }) : ''}</Text>
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
                                  <img
                                    src={resolveOrderImage(primaryItem.imageUrl)}
                                    alt={primaryItem.productName || t('pages.profile.productFallback', { id: primaryItem.productId })}
                                    loading="lazy"
                                    decoding="async"
                                    onError={useImageFallback}
                                  />
                                </button>
                                <div className="profile-order-item__main">
                                  <button type="button" onClick={() => openProductDetail(primaryItem.productId)}>
                                    {primaryItem.productName || t('pages.profile.productFallback', { id: primaryItem.productId })}
                                  </button>
                                  <Text type="secondary">
                                    {formatMoney(primaryItem.price)} x {primaryItem.quantity}
                                  </Text>
                                  {primaryItem.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(primaryItem.selectedSpecs, t)}</Text> : null}
                                  {items.length > 1 ? <Text type="secondary">{t('pages.profile.moreItems', { count: items.length - 1 })}</Text> : null}
                                  {order.shippingAddress ? <Text type="secondary" ellipsis>{order.shippingAddress}</Text> : null}
                                </div>
                              </div>
                            ) : (
                              <Text type="secondary">{t('pages.profile.noOrderItems')}</Text>
                            )}
                          </div>
                          <div className="profile-order-card__amount">
                            <Text type="secondary" className="profile-order-card__mobileLabel">{t('pages.profile.goodsAmount')}</Text>
                            <Text strong>{formatMoney(order.originalAmount || order.totalAmount)}</Text>
                            {order.discountAmount && order.discountAmount > 0 ? <Text type="secondary">-{formatMoney(order.discountAmount)}</Text> : null}
                            <Text type="secondary">x{items.reduce((sum, item) => sum + item.quantity, 0) || 1}</Text>
                          </div>
                          <div className="profile-order-card__paid">
                            <Text type="secondary" className="profile-order-card__mobileLabel">{t('pages.profile.paidAmount')}</Text>
                            <Text strong>{formatMoney(order.totalAmount)}</Text>
                            <Text type="secondary">{t('pages.profile.includesShipping', { amount: formatMoney(order.shippingFee || 0) })}</Text>
                            <Tag>{t('pages.profile.onlineOrder')}</Tag>
                          </div>
                          <div className="profile-order-card__actions">
                            <div className={`profile-order-card__next profile-order-card__next--${actionHint.tone}`}>
                              <Text strong>{actionHint.title}</Text>
                              <Text type="secondary">{actionHint.text}</Text>
                            </div>
                            {order.status === 'PENDING_PAYMENT' && (
                              <Button type="primary" loading={payingOrderId === order.id} onClick={() => handleContinuePayment(order)}>
                                {t('pages.profile.continuePay')}
                              </Button>
                            )}
                            {order.status === 'SHIPPED' && (
                              <Button type="primary" onClick={() => handleConfirmReceipt(order.id)}>{t('pages.profile.confirmReceipt')}</Button>
                            )}
                            {isReturnableOrder(order) && (
                              <Button danger onClick={() => openReturnModal(order)}>{t('pages.profile.returnOrder')}</Button>
                            )}
                            {order.status === 'RETURN_REQUESTED' && (
                              <Tag color="gold">{t('status.RETURN_REQUESTED')}</Tag>
                            )}
                            {order.status === 'RETURN_APPROVED' && (
                              <Button type="link" onClick={() => { setReturnShipmentOrder(order); setReturnTrackingNumber(order.returnTrackingNumber || ''); }}>
                                {t('pages.profile.submitReturnShipment')}
                              </Button>
                            )}
                            {order.status === 'RETURN_SHIPPED' && (
                              <Tag color="cyan">{t('status.RETURN_SHIPPED')}</Tag>
                            )}
                            {(isReturnableOrder(order) || afterSaleStatuses.includes(order.status)) && (
                              <Button type="link" onClick={openSupport}>{t('pages.profile.contactSupport')}</Button>
                            )}
                            <Button type="link" onClick={() => handleViewOrder(order)}>{t('pages.profile.detail')}</Button>
                            {order.trackingNumber ? <Button type="link" onClick={() => handleTrackShipment(order.trackingNumber, order.trackingCarrierCode)}>{t('pages.orderTracking.trackShipment')}</Button> : null}
                            {order.status === 'PENDING_PAYMENT' && (
                              <Popconfirm title={t('pages.profile.cancelOrderConfirm')} onConfirm={() => handleCancelOrder(order.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                                <Button type="link" danger>{t('pages.profile.cancelOrder')}</Button>
                              </Popconfirm>
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
                <div className="profile-pet-insights">
                  <Card className="profile-pet-insights__card">
                    <Space direction="vertical" size={8}>
                      <Text strong>{t('pages.profile.petCompletenessTitle')}</Text>
                      <Text type="secondary">{petCompletenessText}</Text>
                      <Progress percent={petProfileProgress} size="small" strokeColor="#ff4d00" />
                    </Space>
                  </Card>
                  <Card className="profile-pet-insights__card">
                    <Space direction="vertical" size={8}>
                      <Text strong>{t('pages.profile.petBirthdayPerkTitle')}</Text>
                      <Text type="secondary">{t('pages.profile.petBirthdayPerkText')}</Text>
                      <Space wrap>
                        <Tag color={petsMissingBirthdayCount > 0 ? 'gold' : 'green'}>{t('pages.profile.petMissingBirthday', { count: petsMissingBirthdayCount })}</Tag>
                        <Tag color={petsMissingFitCount > 0 ? 'orange' : 'green'}>{t('pages.profile.petMissingFit', { count: petsMissingFitCount })}</Tag>
                      </Space>
                    </Space>
                  </Card>
                </div>
                <div className="profile-pet-next-step">
                  <div>
                    <Text strong>{t('pages.profile.petProfileActionTitle')}</Text>
                    <Text type="secondary">{petProfileFocusText}</Text>
                  </div>
                  <Button
                    type="primary"
                    onClick={() => petProfileFocus ? openPetModal(petProfileFocus) : openPetModal()}
                  >
                    {petProfileFocus ? t('pages.profile.completePetProfile') : t('pages.profile.addPet')}
                  </Button>
                </div>
                <div className="profile-pet-shop-path">
                  <div>
                    <Text type="secondary">{t('pages.profile.petShopPathEyebrow')}</Text>
                    <Text strong>
                      {profilePetShoppingFocus
                        ? t('pages.profile.petShopPathTitleWithName', { name: profilePetShoppingFocus.name })
                        : t('pages.profile.petShopPathTitle')}
                    </Text>
                    <Text type="secondary">
                      {profilePetShoppingFocus
                        ? t('pages.profile.petShopPathText', {
                          type: petTypeLabel(profilePetShoppingFocus.petType),
                          size: petSizeLabel(profilePetShoppingFocus.size),
                        })
                        : t('pages.profile.petShopPathEmpty')}
                    </Text>
                  </div>
                  <Space wrap className="profile-pet-shop-path__actions">
                    {profilePetShoppingFocus ? (
                      <Tag color="green">{t('pages.profile.petShopPathSignalReady')}</Tag>
                    ) : (
                      <Tag color="gold">{t('pages.profile.petShopPathNeedsProfile')}</Tag>
                    )}
                    <Button
                      icon={<ShoppingCartOutlined />}
                      onClick={() => profilePetShoppingFocus ? openPetShoppingPath(profilePetShoppingFocus) : openPetModal()}
                    >
                      {profilePetShoppingFocus ? t('pages.profile.shopForThisPet') : t('pages.profile.addPet')}
                    </Button>
                  </Space>
                </div>
                <Button className="profile-block-button" type="dashed" icon={<PlusOutlined />} block style={{ marginBottom: 16 }} onClick={() => openPetModal()}>
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
                          className="profile-section-card profile-pet-card"
                          title={pet.name}
                          extra={<Tag color="green">{petTypeLabel(pet.petType)}</Tag>}
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
                            <Text>{t('pages.profile.petSize')}: {petSizeLabel(pet.size)}</Text>
                            {pet.birthday ? <Tag color="gold">{t('pages.profile.birthdayCouponEnabled')}</Tag> : null}
                            <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => openPetShoppingPath(pet)}>
                              {t('pages.profile.shopForThisPet')}
                            </Button>
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

      <Modal title={t('pages.profile.editProfileTitle')} open={editModalVisible} onOk={handleEditProfile} onCancel={() => setEditModalVisible(false)} confirmLoading={profileSubmitting}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="email" label={t('pages.profile.email')} rules={[{ type: 'email', message: t('pages.profile.emailInvalid') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('pages.profile.phone')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pages.profile.changePassword')} open={passwordModalVisible} onOk={handleChangePassword} onCancel={() => { setPasswordModalVisible(false); passwordForm.resetFields(); }} confirmLoading={passwordSubmitting}>
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
        confirmLoading={addressSubmitting}
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
        confirmLoading={petSubmitting}
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
                { value: 'SMALL', label: t('pages.profile.petSizeSmall') },
                { value: 'MEDIUM', label: t('pages.profile.petSizeMedium') },
                { value: 'LARGE', label: t('pages.profile.petSizeLarge') },
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
              {selectedOrder.originalAmount ? <Descriptions.Item label={t('common.subtotal')}>{formatMoney(selectedOrder.originalAmount)}</Descriptions.Item> : null}
              {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 ? (
                <Descriptions.Item label={t('pages.checkout.coupon')}>{selectedOrder.couponName || '-'} / -{formatMoney(selectedOrder.discountAmount)}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('pages.checkout.address')}>{selectedOrder.shippingAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>{selectedOrder.paymentMethod ? paymentMethodLabel(selectedOrder.paymentMethod, t) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.adminOrders.tracking')}>
                {selectedOrder.trackingNumber ? (
                  <Space>
                    <span>{selectedOrder.trackingNumber}</span>
                    {selectedOrder.trackingCarrierName ? <Tag>{selectedOrder.trackingCarrierName}</Tag> : null}
                    <Button size="small" onClick={() => handleTrackShipment(selectedOrder.trackingNumber, selectedOrder.trackingCarrierCode)}>{t('pages.adminOrders.track')}</Button>
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnTracking')}>{selectedOrder.returnTrackingNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnDeadline')}>
                {selectedOrder.returnDeadline ? new Date(selectedOrder.returnDeadline).toLocaleString(dateLocale) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnReason')}>{selectedOrder.returnReason || '-'}</Descriptions.Item>
              {selectedOrder.returnRequestedAt ? (
                <Descriptions.Item label={t('pages.profile.returnRequestedAt')}>{new Date(selectedOrder.returnRequestedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnApprovedAt ? (
                <Descriptions.Item label={t('pages.profile.returnApprovedAt')}>{new Date(selectedOrder.returnApprovedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnRejectedAt ? (
                <Descriptions.Item label={t('pages.profile.returnRejectedAt')}>{new Date(selectedOrder.returnRejectedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnShippedAt ? (
                <Descriptions.Item label={t('pages.profile.returnShippedAt')}>{new Date(selectedOrder.returnShippedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnedAt ? (
                <Descriptions.Item label={t('pages.profile.returnedAt')}>{new Date(selectedOrder.returnedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.refundedAt ? (
                <Descriptions.Item label={t('pages.profile.refundedAt')}>{new Date(selectedOrder.refundedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('pages.profile.shippedAt')}>{selectedOrder.shippedAt ? new Date(selectedOrder.shippedAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.completedAt')}>{selectedOrder.completedAt ? new Date(selectedOrder.completedAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
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
                          <img
                            src={resolveOrderImage(item.imageUrl)}
                            alt={item.productName || t('pages.profile.productFallback', { id: item.productId })}
                            className="profile-order-detail__image"
                            loading="lazy"
                            decoding="async"
                            onError={useImageFallback}
                          />
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
        title={t('pages.profile.returnOrder')}
        open={!!returnRequestOrder}
        confirmLoading={requestingReturn}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onOk={handleReturnOrder}
        onCancel={() => { setReturnRequestOrder(null); setReturnReason(''); }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">{t('pages.profile.returnReviewHint')}</Text>
          {returnRequestOrder?.returnDeadline ? (
            <Text type="secondary">
              {t('pages.profile.returnAvailableUntil', { time: new Date(returnRequestOrder.returnDeadline).toLocaleString(dateLocale) })}
            </Text>
          ) : null}
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder={t('pages.profile.returnReasonPlaceholder')}
          />
        </Space>
      </Modal>

      <Modal
        title={t('pages.adminOrders.logisticsTracking')}
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
          selectedPayment?.status === 'PENDING' && selectedPayment.paymentUrl && (
            <Button
              key="pay"
              type="primary"
              onClick={() => {
                if (!navigateToSafeUrl(selectedPayment.paymentUrl)) {
                  message.error(t('pages.payment.failed'));
                }
              }}
            >
              {t('pages.checkout.openPayment')}
            </Button>
          ),
          selectedPayment && selectedPayment.status !== 'PAID' && (
            <Button key="refresh" loading={refreshingPayment} onClick={handleRefreshPayment}>
              {t('pages.profile.refreshPayment')}
            </Button>
          ),
          <Button key="close" onClick={() => setPaymentModalVisible(false)}>{t('common.cancel')}</Button>,
        ].filter(Boolean)}
      >
        {selectedOrder && selectedPayment && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div className="profile-payment-recovery">
              <div>
                <Text strong>{t('pages.checkout.paymentRecoveryStatus')}</Text>
                <Tag color={selectedPayment.status === 'PAID' ? 'green' : selectedPaymentRecovery.isExpired ? 'red' : selectedPaymentRecovery.isExpiringSoon ? 'orange' : 'blue'}>
                  {selectedPayment.status === 'PAID'
                    ? t('pages.checkout.paymentRecoveryPaid')
                    : selectedPaymentRecovery.isExpired
                      ? t('pages.checkout.paymentRecoveryExpired')
                      : t('pages.checkout.paymentRecoveryPending')}
                </Tag>
              </div>
              <div>
                <Text strong>{t('pages.checkout.paymentRecoveryWindow')}</Text>
                <Text type={selectedPaymentRecovery.isExpired ? 'danger' : selectedPaymentRecovery.isExpiringSoon ? 'warning' : 'secondary'}>
                  {selectedPaymentRecovery.minutesLeft === null
                    ? t('pages.checkout.paymentRecoveryWindowUnknown')
                    : selectedPaymentRecovery.isExpired
                      ? t('pages.checkout.paymentRecoveryWindowExpired')
                      : t('pages.checkout.paymentRecoveryWindowMinutes', { count: selectedPaymentRecovery.minutesLeft })}
                </Text>
              </div>
              <div>
                <Text strong>{t('pages.checkout.paymentRecoveryNext')}</Text>
                <Text type="secondary">
                  {selectedPayment.status === 'PAID'
                    ? t('pages.checkout.paymentRecoveryNextPaid')
                    : selectedPayment.paymentUrl
                      ? t('pages.checkout.paymentRecoveryNextOpen')
                      : t('pages.checkout.paymentRecoveryNextRetry')}
                </Text>
              </div>
            </div>
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
                {selectedPaymentMethodDetail ? (
                  <div className="profile-payment-method-hint">
                    <Tag color={selectedPaymentMethodDetail.value === 'OXXO' ? 'orange' : selectedPaymentMethodDetail.value === 'SPEI' ? 'blue' : 'green'}>
                      {t(selectedPaymentMethodDetail.badgeKey)}
                    </Tag>
                    <Text type="secondary">{t(selectedPaymentMethodDetail.descriptionKey)}</Text>
                  </div>
                ) : null}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={statusColors[selectedPayment.status] || 'default'}>
                  {t(`status.${selectedPayment.status}`)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentLink')}>
                {selectedPayment.paymentUrl ? (
                  <Button
                    type="link"
                    className="profile-payment-link"
                    onClick={() => {
                      if (!navigateToSafeUrl(selectedPayment.paymentUrl)) {
                        message.error(t('pages.payment.failed'));
                      }
                    }}
                  >
                    {formatPaymentUrlLabel(selectedPayment.paymentUrl)}
                  </Button>
                ) : '-'}
              </Descriptions.Item>
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
                        <Tag color={statusColors[payment.status] || 'default'}>
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
