import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Divider, Input, message, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { adminApi, logisticsCarrierApi, orderApi, paymentApi } from '../api';
import type { LogisticsCarrier, Order, OrderItem, Payment } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import {
  isOrderNeedsAction,
  isOrderRefunded,
  isOrderShippable,
  getOrderSlaState,
  orderNextActionByStatus,
  orderPriority,
  orderStatusColors,
  orderValidTransitions,
} from '../utils/orderOperationsConfig';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import './OrderManagement.css';

const { Title } = Typography;

const OrderManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(() => searchParams.get('status') || undefined);
  const [quickFilter, setQuickFilter] = useState<string | undefined>(() => searchParams.get('quick') || undefined);
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [orderPage, setOrderPage] = useState({ page: 1, size: 20, total: 0, totalPages: 0 });
  const [orderSummary, setOrderSummary] = useState<Record<string, number>>({});
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrierCode, setTrackingCarrierCode] = useState<string | undefined>();
  const [autoPrintLabel, setAutoPrintLabel] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [batchShipOpen, setBatchShipOpen] = useState(false);
  const [batchTrackingPrefix, setBatchTrackingPrefix] = useState('BATCH');
  const [batchTrackingCarrierCode, setBatchTrackingCarrierCode] = useState<string | undefined>();
  const [batchShipping, setBatchShipping] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState('');
  const [selectedTrackingCarrierCode, setSelectedTrackingCarrierCode] = useState<string | undefined>();
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [manualRefundReference, setManualRefundReference] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundPayments, setRefundPayments] = useState<Payment[]>([]);
  const [refundPaymentsLoading, setRefundPaymentsLoading] = useState(false);
  const [orderPayments, setOrderPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [syncingPaymentIds, setSyncingPaymentIds] = useState<React.Key[]>([]);
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState<React.Key[]>([]);
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const { formatMoney } = useMarket();
  const pageSizeRef = useRef(20);

  const fetchOrders = useCallback(async (params: {
    status?: string;
    quick?: string;
    search?: string;
    page?: number;
    size?: number;
  } = {}) => {
    try {
      setLoading(true);
      const res = await adminApi.getOrdersPage({
        status: params.status,
        quick: params.quick,
        search: params.search,
        page: params.page || 1,
        size: params.size || 20,
      });
      setOrders(res.data.items || []);
      setOrderPage({
        page: res.data.page || 1,
        size: res.data.size || params.size || 20,
        total: res.data.total || 0,
        totalPages: res.data.totalPages || 0,
      });
      pageSizeRef.current = res.data.size || params.size || pageSizeRef.current;
      setOrderSummary(res.data.summary || {});
    } catch {
      message.error(t('pages.adminOrders.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: 1, size: pageSizeRef.current });
  }, [debouncedSearchText, fetchOrders, filterStatus, quickFilter]);

  useEffect(() => {
    const nextStatus = searchParams.get('status') || undefined;
    const nextQuick = searchParams.get('quick') || undefined;
    setFilterStatus((current) => current === nextStatus ? current : nextStatus);
    setQuickFilter((current) => current === nextQuick ? current : nextQuick);
  }, [searchParams]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [filterStatus, quickFilter, debouncedSearchText]);

  useEffect(() => {
    logisticsCarrierApi.getAll(true)
      .then((res) => setCarriers(res.data || []))
      .catch(() => setCarriers([]));
  }, []);

  useEffect(() => {
    const shippableIds = new Set(orders.filter(isOrderShippable).map((order) => order.id));
    setSelectedOrderIds((current) => current.filter((id) => shippableIds.has(Number(id))));
  }, [orders]);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    if (statusUpdatingIds.includes(orderId)) {
      return;
    }
    try {
      setStatusUpdatingIds((current) => [...current, orderId]);
      await adminApi.updateOrderStatus(orderId, newStatus);
      message.success(t('pages.adminOrders.statusUpdated'));
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: any) {
      const msg = err.response?.data?.error || t('messages.updateFailed');
      message.error(msg);
    } finally {
      setStatusUpdatingIds((current) => current.filter((id) => id !== orderId));
    }
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const getCarrierName = (carrierCode?: string) =>
    carriers.find((carrier) => carrier.trackingCode === carrierCode)?.name;

  const formatLabelSpecs = (selectedSpecs?: string | null) => {
    try {
      return selectedSpecs ? formatSelectedSpecs(selectedSpecs, t) : '';
    } catch {
      return selectedSpecs || '';
    }
  };

  const buildShippingLabelHtml = (order: Order, items: OrderItem[]) => {
    const labelCopy = {
      shippingLabel: t('pages.adminOrders.shippingLabel'),
      order: t('pages.adminOrders.orderLabel'),
      carrierAuto: t('pages.adminOrders.carrierAuto'),
      trackingNumber: t('pages.adminOrders.trackingNumberLabel'),
      shipTo: t('pages.adminOrders.shipTo'),
      payment: t('pages.adminOrders.paymentLabel'),
      created: t('pages.adminOrders.createdLabel'),
      items: t('pages.adminOrders.items'),
      product: t('pages.adminOrders.product'),
      specs: t('pages.adminOrders.specs'),
      qty: t('pages.adminOrders.qty'),
      noItemData: t('pages.adminOrders.noItemData'),
      generatedBy: t('pages.adminOrders.generatedBy'),
    };
    const itemRows = items.length
      ? items.map((item) => `
          <tr>
            <td>${escapeHtml(item.productName || `#${item.productId}`)}</td>
            <td>${escapeHtml(formatLabelSpecs(item.selectedSpecs))}</td>
            <td class="qty">${escapeHtml(item.quantity)}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="3" class="muted">${escapeHtml(labelCopy.noItemData)}</td></tr>`;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(labelCopy.shippingLabel)} ${escapeHtml(order.orderNo || order.id)}</title>
          <style>
            @page { size: 100mm 150mm; margin: 6mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #111; }
            .label { width: 100%; border: 2px solid #111; padding: 10px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; }
            .title { font-size: 22px; font-weight: 800; }
            .carrier { text-align: right; font-size: 13px; }
            .tracking { margin: 12px 0; text-align: center; border: 2px solid #111; padding: 10px 6px; }
            .tracking-number { font-size: 24px; font-weight: 800; letter-spacing: 1px; word-break: break-all; }
            .barcode { margin-top: 8px; font-family: "Libre Barcode 39", "Courier New", monospace; font-size: 34px; letter-spacing: 2px; }
            .section { border-top: 1px solid #111; padding: 8px 0; }
            .label-text { font-size: 11px; color: #555; text-transform: uppercase; margin-bottom: 3px; }
            .address { font-size: 17px; font-weight: 700; line-height: 1.35; word-break: break-word; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #bbb; padding: 4px; text-align: left; vertical-align: top; }
            th { background: #f2f2f2; }
            .qty { text-align: center; width: 42px; }
            .muted { color: #777; text-align: center; }
            .footer { margin-top: 8px; font-size: 10px; color: #555; text-align: center; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <div>
                <div class="title">${escapeHtml(labelCopy.shippingLabel)}</div>
                <div>${escapeHtml(labelCopy.order)}: ${escapeHtml(order.orderNo || order.id)}</div>
              </div>
              <div class="carrier">
                <strong>${escapeHtml(order.trackingCarrierName || labelCopy.carrierAuto)}</strong><br />
                ${escapeHtml(order.trackingCarrierCode || '')}
              </div>
            </div>
            <div class="tracking">
              <div class="label-text">${escapeHtml(labelCopy.trackingNumber)}</div>
              <div class="tracking-number">${escapeHtml(order.trackingNumber || '-')}</div>
              <div class="barcode">*${escapeHtml(order.trackingNumber || order.orderNo || order.id)}*</div>
            </div>
            <div class="section">
              <div class="label-text">${escapeHtml(labelCopy.shipTo)}</div>
              <div class="address">${escapeHtml(order.shippingAddress || '-')}</div>
            </div>
            <div class="section meta">
              <div><div class="label-text">${escapeHtml(labelCopy.payment)}</div>${escapeHtml(order.paymentMethod || '-')}</div>
              <div><div class="label-text">${escapeHtml(labelCopy.created)}</div>${escapeHtml(order.createdAt ? new Date(order.createdAt).toLocaleString(dateLocale) : '-')}</div>
            </div>
            <div class="section">
              <div class="label-text">${escapeHtml(labelCopy.items)}</div>
              <table>
                <thead><tr><th>${escapeHtml(labelCopy.product)}</th><th>${escapeHtml(labelCopy.specs)}</th><th class="qty">${escapeHtml(labelCopy.qty)}</th></tr></thead>
                <tbody>${itemRows}</tbody>
              </table>
            </div>
            <div class="footer">${escapeHtml(labelCopy.generatedBy)}</div>
          </div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>`;
  };

  const printShippingLabel = async (order: Order, existingWindow?: Window | null) => {
    const printWindow = existingWindow || window.open('', '_blank', 'width=480,height=760');
    if (!printWindow) {
      message.warning(t('pages.adminOrders.printBlocked'));
      return;
    }

    let items: OrderItem[] = [];
    try {
      const res = await orderApi.getItems(order.id);
      items = res.data || [];
    } catch {
      items = [];
    }

    try {
      printWindow.document.open();
      printWindow.document.write(buildShippingLabelHtml(order, items));
      printWindow.document.close();
    } catch {
      printWindow.close();
      message.error(t('pages.adminOrders.printFailed'));
    }
  };

  const handleShip = async () => {
    if (!shippingOrder) {
      return;
    }
    if (!trackingNumber.trim()) {
      message.error(t('pages.adminOrders.trackingRequired'));
      return;
    }
    const printWindow = autoPrintLabel ? window.open('', '_blank', 'width=480,height=760') : null;
    try {
      setShipping(true);
      await adminApi.updateOrderStatus(shippingOrder.id, 'SHIPPED', trackingNumber.trim(), trackingCarrierCode);
      message.success(t('pages.adminOrders.statusUpdated'));
      if (autoPrintLabel) {
        await printShippingLabel({
          ...shippingOrder,
          status: 'SHIPPED',
          trackingNumber: trackingNumber.trim(),
          trackingCarrierCode,
          trackingCarrierName: getCarrierName(trackingCarrierCode) || shippingOrder.trackingCarrierName,
        }, printWindow);
      }
      setShippingOrder(null);
      setTrackingNumber('');
      setTrackingCarrierCode(undefined);
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: any) {
      printWindow?.close();
      const msg = err.response?.data?.error || t('messages.updateFailed');
      message.error(msg);
    } finally {
      setShipping(false);
    }
  };

  const handleViewItems = async (order: Order) => {
    setDetailOrder(order);
    setItemsLoading(true);
    setPaymentsLoading(true);
    try {
      const [itemsRes, paymentsRes] = await Promise.all([
        orderApi.getItems(order.id),
        paymentApi.getByOrder(order.id),
      ]);
      setOrderItems(itemsRes.data);
      setOrderPayments(paymentsRes.data || []);
    } catch {
      setOrderItems([]);
      setOrderPayments([]);
      message.error(t('messages.operationFailed'));
    } finally {
      setItemsLoading(false);
      setPaymentsLoading(false);
    }
  };

  const canRefundOrder = (order: Order) =>
    ['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED'].includes(order.status)
    && !isOrderRefunded(order);

  const openRefundModal = async (order: Order) => {
    setRefundOrder(order);
    setRefundReason(order.returnReason || '');
    setRefundRestock(order.status === 'PENDING_SHIPMENT');
    setRefundPayments([]);
    setRefundPaymentsLoading(true);
    try {
      const res = await paymentApi.getByOrder(order.id);
      setRefundPayments(res.data || []);
    } catch {
      setRefundPayments([]);
    } finally {
      setRefundPaymentsLoading(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!refundOrder) return;
    try {
      setRefunding(true);
      const res = await adminApi.refundOrder(refundOrder.id, {
        reason: refundReason.trim(),
        restock: refundRestock,
        manualRefundReference: manualRefundReference.trim(),
      });
      message.success(t('pages.adminOrders.refundCompletedWithReference', { reference: res.data.payment.refundReference || res.data.payment.id }));
      setRefundOrder(null);
      setRefundReason('');
      setManualRefundReference('');
      setRefundRestock(false);
      setRefundPayments([]);
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.adminOrders.refundFailed'));
    } finally {
      setRefunding(false);
    }
  };

  const hasLoadedRefundPayments = refundPayments.length > 0;
  const hasPaidRefundPayment = refundPayments.some((payment) => payment.status === 'PAID');
  const refundAlreadyProcessing = refundPayments.some((payment) => payment.status === 'REFUNDING');

  const mergePayment = (payments: Payment[], syncedPayment: Payment) =>
    payments.map((payment) => payment.id === syncedPayment.id ? syncedPayment : payment);

  const handleSyncPayment = async (payment: Payment, scope: 'detail' | 'refund') => {
    if (syncingPaymentIds.includes(payment.id)) {
      return;
    }
    try {
      setSyncingPaymentIds((current) => [...current, payment.id]);
      const res = await paymentApi.sync(payment.id);
      if (scope === 'refund') {
        setRefundPayments((current) => mergePayment(current, res.data));
      } else {
        setOrderPayments((current) => mergePayment(current, res.data));
      }
      message.success(t('pages.adminOrders.paymentSynced'));
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.adminOrders.paymentSyncFailed'));
    } finally {
      setSyncingPaymentIds((current) => current.filter((id) => id !== payment.id));
    }
  };

  const handleBatchShip = async () => {
    if (selectedVisibleShippableIds.length === 0) {
      message.error(t('pages.adminOrders.selectPendingShipment'));
      return;
    }
    try {
      setBatchShipping(true);
      const res = await adminApi.batchShipOrders(selectedVisibleShippableIds, batchTrackingPrefix.trim() || 'BATCH', batchTrackingCarrierCode);
      message.success(t('pages.adminOrders.batchShipResult', { success: res.data.success, failed: res.data.failed }));
      setBatchShipOpen(false);
      setSelectedOrderIds([]);
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    } finally {
      setBatchShipping(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await adminApi.exportOrders(filterStatus, debouncedSearchText, quickFilter);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const suffix = [filterStatus, quickFilter, debouncedSearchText ? 'search' : ''].filter(Boolean).join('-');
      link.href = url;
      link.download = `orders${suffix ? '-' + suffix : ''}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      if (String(res.headers?.['x-export-truncated']) === 'true') {
        message.warning(t('pages.adminOrders.exportTruncated', {
          returned: res.headers?.['x-export-returned'] || '',
          total: res.headers?.['x-export-total'] || '',
        }));
      }
    } catch {
      message.error(t('pages.adminOrders.exportFailed'));
    }
  };

  const handleTrackShipment = (trackingNo?: string, carrierCode?: string) => {
    if (!trackingNo) {
      message.warning(t('pages.adminOrders.noTrackingNumber'));
      return;
    }
    setSelectedTrackingNumber(trackingNo);
    setSelectedTrackingCarrierCode(carrierCode);
    setTrackingOpen(true);
  };

  const carrierOptions = carriers.map((carrier) => ({
    value: carrier.trackingCode,
    label: `${carrier.name} (${carrier.trackingCode})`,
  }));
  const formatHours = (hours: number) => {
    if (hours < 24) {
      return t('pages.adminOrders.slaHours', { count: Math.max(1, Math.ceil(hours)) });
    }
    return t('pages.adminOrders.slaDays', { count: Math.max(1, Math.ceil(hours / 24)) });
  };

  const getOrderSla = (order: Order) => {
    const sla = getOrderSlaState(order);
    if (!sla) return null;
    return {
      ...sla,
      label: sla.overdue
        ? t('pages.adminOrders.slaOverdue', { time: formatHours(sla.diffHours) })
        : t('pages.adminOrders.slaRemaining', { time: formatHours(sla.diffHours) }),
    };
  };

  const normalizedSearchText = debouncedSearchText.trim().toLowerCase();
  const sortedFilteredOrders = [...orders].sort((left, right) => {
    const priorityDelta = (orderPriority[left.status] ?? 99) - (orderPriority[right.status] ?? 99);
    if (priorityDelta !== 0) return priorityDelta;
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime || right.id - left.id;
  });
  const selectedVisibleShippableIds = sortedFilteredOrders
    .filter((order) => selectedOrderIds.includes(order.id) && isOrderShippable(order))
    .map((order) => order.id);
  const orderSummaryCards = [
    {
      key: 'needsAction',
      label: t('pages.adminOrders.needsAction'),
      value: orderSummary.NEEDS_ACTION ?? orders.filter(isOrderNeedsAction).length,
      color: '#cf1322',
      filter: 'NEEDS_ACTION',
    },
    {
      key: 'slaOverdue',
      label: t('pages.adminOrders.slaOverdueCard'),
      value: orderSummary.SLA_OVERDUE ?? orders.filter((order) => getOrderSla(order)?.overdue).length,
      color: '#a8071a',
      filter: 'SLA_OVERDUE',
    },
    {
      key: 'slaDueSoon',
      label: t('pages.adminOrders.slaDueSoonCard'),
      value: orderSummary.SLA_DUE_SOON ?? orders.filter((order) => getOrderSla(order)?.dueSoon).length,
      color: '#fa8c16',
      filter: 'SLA_DUE_SOON',
    },
    {
      key: 'pendingShipment',
      label: t('status.PENDING_SHIPMENT'),
      value: orderSummary.PENDING_SHIPMENT ?? orders.filter(isOrderShippable).length,
      color: '#1677ff',
      filter: 'PENDING_SHIPMENT',
    },
    {
      key: 'returnRequested',
      label: t('status.RETURN_REQUESTED'),
      value: orderSummary.RETURN_REQUESTED ?? orders.filter((order) => order.status === 'RETURN_REQUESTED').length,
      color: '#d48806',
      filter: 'RETURN_REQUESTED',
    },
    {
      key: 'returnShipped',
      label: t('status.RETURN_SHIPPED'),
      value: orderSummary.RETURN_SHIPPED ?? orders.filter((order) => order.status === 'RETURN_SHIPPED').length,
      color: '#08979c',
      filter: 'RETURN_SHIPPED',
    },
    {
      key: 'refunded',
      label: t('status.REFUNDED'),
      value: orderSummary.REFUNDED ?? orders.filter(isOrderRefunded).length,
      color: '#722ed1',
      filter: 'REFUNDED',
    },
  ];
  const activeQuickFilterLabel = orderSummaryCards.find((item) => item.filter === quickFilter)?.label;
  const transitionLabel = (currentStatus: string, nextStatus: string) => {
    if (currentStatus === 'PENDING_PAYMENT' && nextStatus === 'PENDING_SHIPMENT') {
      return t('pages.adminOrders.confirmPayment');
    }
    if (currentStatus === 'RETURN_REQUESTED' && nextStatus === 'RETURN_APPROVED') {
      return t('pages.adminOrders.approveReturn');
    }
    if (currentStatus === 'RETURN_REQUESTED' && nextStatus === 'COMPLETED') {
      return t('pages.adminOrders.rejectReturn');
    }
    if (currentStatus === 'RETURN_SHIPPED' && nextStatus === 'RETURNED') {
      return t('pages.adminOrders.confirmReturnReceivedAndRefund');
    }
    return t(`status.${nextStatus}`);
  };
  const confirmStatusChange = (record: Order, nextStatus: string) => {
    if (record.status === 'PENDING_PAYMENT' && nextStatus === 'PENDING_SHIPMENT') {
      Modal.confirm({
        title: t('pages.adminOrders.confirmPaymentTitle'),
        content: t('pages.adminOrders.confirmPaymentContent'),
        okText: t('pages.adminOrders.confirmPayment'),
        cancelText: t('common.cancel'),
        onOk: () => handleStatusChange(record.id, nextStatus),
      });
      return;
    }
    if (record.status === 'RETURN_REQUESTED' && nextStatus === 'RETURN_APPROVED') {
      Modal.confirm({
        title: t('pages.adminOrders.confirmApproveReturnTitle'),
        content: t('pages.adminOrders.confirmApproveReturnContent'),
        okText: t('pages.adminOrders.approveReturn'),
        cancelText: t('common.cancel'),
        onOk: () => handleStatusChange(record.id, nextStatus),
      });
      return;
    }
    if (record.status === 'RETURN_REQUESTED' && nextStatus === 'COMPLETED') {
      Modal.confirm({
        title: t('pages.adminOrders.confirmRejectReturnTitle'),
        content: t('pages.adminOrders.confirmRejectReturnContent'),
        okText: t('pages.adminOrders.rejectReturn'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        onOk: () => handleStatusChange(record.id, nextStatus),
      });
      return;
    }
    if (record.status === 'RETURN_SHIPPED' && nextStatus === 'RETURNED') {
      Modal.confirm({
        title: t('pages.adminOrders.confirmReturnRefundTitle'),
        content: t('pages.adminOrders.confirmReturnRefundContent'),
        okText: t('pages.adminOrders.confirmReturnReceivedAndRefund'),
        cancelText: t('common.cancel'),
        onOk: () => handleStatusChange(record.id, nextStatus),
      });
      return;
    }
    handleStatusChange(record.id, nextStatus);
  };
  const renderNextAction = (order: Order) => {
    const action = orderNextActionByStatus[order.status] || orderNextActionByStatus.COMPLETED;
    const sla = getOrderSla(order);
    return (
      <div className={`order-management-page__nextAction order-management-page__nextAction--${action.tone}`}>
        <Typography.Text strong>{t(action.titleKey)}</Typography.Text>
        <Typography.Text type="secondary">{t(action.textKey)}</Typography.Text>
        {sla ? (
          <Tag color={sla.overdue ? 'red' : sla.dueSoon ? 'orange' : 'green'} className="order-management-page__slaTag">
            {sla.label}
          </Tag>
        ) : null}
      </div>
    );
  };


  const columns = [
    { title: t('pages.adminOrders.orderId'), dataIndex: 'id', key: 'id', width: 76 },
    { title: t('common.userId'), dataIndex: 'userId', key: 'userId', width: 72 },
    {
      title: t('common.amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      render: (v: number) => <span className="order-management-page__amount">{formatMoney(v)}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 112,
      render: (s: string) => <Tag color={orderStatusColors[s]}>{t(`status.${s}`)}</Tag>,
    },
    {
      title: t('pages.adminOrders.nextAction'),
      key: 'nextAction',
      width: 170,
      render: (_: any, record: Order) => renderNextAction(record),
    },
    {
      title: t('pages.adminOrders.returnInfo'),
      key: 'returnInfo',
      width: 180,
      render: (_: any, record: Order) => (
        <Space direction="vertical" size={2} className="order-management-page__compactStack">
          <Typography.Text>{record.returnReason || '-'}</Typography.Text>
          {record.returnTrackingNumber ? (
            <Typography.Text type="secondary">{record.returnTrackingNumber}</Typography.Text>
          ) : null}
          {record.refundedAt ? (
            <Typography.Text type="secondary">{new Date(record.refundedAt).toLocaleString(dateLocale)}</Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('pages.adminOrders.address'),
      dataIndex: 'shippingAddress',
      key: 'shippingAddress',
      width: 220,
      render: (v: string) => <span className="order-management-page__addressText">{v || '-'}</span>,
    },
    {
      title: t('pages.adminOrders.paymentMethod'),
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 92,
      render: (v: string) => v || '-',
    },
    {
      title: t('pages.adminOrders.tracking'),
      dataIndex: 'trackingNumber',
      key: 'trackingNumber',
      width: 150,
      render: (v: string, record: Order) => v ? (
        <Space direction="vertical" size={0} className="order-management-page__compactStack">
          <span className="order-management-page__trackingText">{v}</span>
          {record.trackingCarrierName ? <Typography.Text type="secondary">{record.trackingCarrierName}</Typography.Text> : null}
          <Space size={8}>
            <Button size="small" type="link" className="order-management-page__linkButton" onClick={() => handleTrackShipment(v, record.trackingCarrierCode)}>{t('pages.adminOrders.track')}</Button>
            <Button size="small" type="link" className="order-management-page__linkButton" onClick={() => printShippingLabel(record)}>{t('pages.adminOrders.printLabel')}</Button>
          </Space>
        </Space>
      ) : '-',
    },
    {
      title: t('pages.adminOrders.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 145,
      render: (v: string) => v ? new Date(v).toLocaleString(dateLocale) : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 180,
      render: (_: any, record: Order) => {
        const transitions = orderValidTransitions[record.status] || [];
        const statusUpdating = statusUpdatingIds.includes(record.id);
        return (
          <Space wrap size={[6, 6]} className="order-management-page__actions">
            <Button size="small" onClick={() => handleViewItems(record)}>
              {t('pages.adminOrders.items')}
            </Button>
            {transitions.length === 0 ? (
              <span className="order-management-page__completed">{t('common.completed')}</span>
            ) : (
              <Select
                size="small"
                style={{ width: 116 }}
                loading={statusUpdating}
                disabled={statusUpdating}
                placeholder={t('pages.adminOrders.changeStatus')}
                onChange={(val) => {
                  if (val === 'SHIPPED') {
                    setShippingOrder(record);
                    setTrackingNumber(record.trackingNumber || '');
                    setTrackingCarrierCode(record.trackingCarrierCode);
                    return;
                  }
                  confirmStatusChange(record, val);
                }}
                options={transitions.map((s) => ({
                  value: s,
                  label: transitionLabel(record.status, s),
                }))}
              />
            )}
            {canRefundOrder(record) ? (
              <Button size="small" danger onClick={() => openRefundModal(record)}>
                {t('pages.adminOrders.refundNow')}
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="order-management-page">
      <Title level={4}>{t('pages.adminOrders.title')}</Title>
      <Divider />
      <div className="order-management-page__summaryGrid">
        {orderSummaryCards.map((item) => (
          <button
            key={item.key}
            type="button"
            className={quickFilter === item.filter ? 'order-management-page__summaryCard order-management-page__summaryCard--active' : 'order-management-page__summaryCard'}
            aria-pressed={quickFilter === item.filter}
            onClick={() => setQuickFilter((current) => current === item.filter ? undefined : item.filter)}
          >
            <span>{item.label}</span>
            <strong style={{ color: item.color }}>{item.value}</strong>
          </button>
        ))}
      </div>
      <Card className="order-management-page__toolbar" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>{t('pages.adminOrders.filter')}</span>
          <Select
            allowClear
            placeholder={t('pages.adminOrders.allStatus')}
            style={{ width: 170 }}
            value={filterStatus}
            onChange={(v) => setFilterStatus(v)}
            options={[
              { value: 'PENDING_PAYMENT', label: t('status.PENDING_PAYMENT') },
              { value: 'PENDING_SHIPMENT', label: t('status.PENDING_SHIPMENT') },
              { value: 'SHIPPED', label: t('status.SHIPPED') },
              { value: 'COMPLETED', label: t('status.COMPLETED') },
              { value: 'RETURN_REQUESTED', label: t('status.RETURN_REQUESTED') },
              { value: 'RETURN_APPROVED', label: t('status.RETURN_APPROVED') },
              { value: 'RETURN_SHIPPED', label: t('status.RETURN_SHIPPED') },
              { value: 'RETURNED', label: t('status.RETURNED') },
              { value: 'REFUNDED', label: t('status.REFUNDED') },
              { value: 'CANCELLED', label: t('status.CANCELLED') },
            ]}
          />
          <Input.Search
            allowClear
            value={searchText}
            maxLength={120}
            onChange={(event) => setSearchText(event.target.value.slice(0, 120))}
            placeholder={t('pages.adminOrders.searchPlaceholder')}
            style={{ width: 260 }}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            {quickFilter || normalizedSearchText ? t('pages.adminOrders.exportVisibleOrders') : t('pages.adminOrders.exportOrders')}
          </Button>
          <Button
            type="primary"
            disabled={selectedVisibleShippableIds.length === 0}
            onClick={() => setBatchShipOpen(true)}
          >
            {t('pages.adminOrders.batchShip')}
          </Button>
          {activeQuickFilterLabel ? (
            <Tag
              closable
              color="orange"
              onClose={(event) => {
                event.preventDefault();
                setQuickFilter(undefined);
              }}
            >
              {t('pages.adminOrders.quickFilterActive', { filter: activeQuickFilterLabel })}
            </Tag>
          ) : null}
          <Tag color="blue">
            {t('pages.adminOrders.total', { count: orderPage.total })} | {orderPage.totalPages ? `${orderPage.page}/${orderPage.totalPages}` : '0/0'}
          </Tag>
        </Space>
      </Card>
      <div className="order-management-page__table">
        <Table
          columns={columns}
          dataSource={sortedFilteredOrders}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedOrderIds,
            onChange: setSelectedOrderIds,
            getCheckboxProps: (record) => ({
              disabled: !isOrderShippable(record),
            }),
          }}
          loading={loading}
          pagination={{
            current: orderPage.page,
            pageSize: orderPage.size,
            total: orderPage.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => t('pages.adminOrders.total', { count: total }),
            onChange: (page, size) => fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page, size }),
          }}
          bordered
          size="middle"
          scroll={{ x: 1500 }}
          tableLayout="fixed"
        />
      </div>
      <Modal
        title={t('pages.adminOrders.enterTracking')}
        open={!!shippingOrder}
        confirmLoading={shipping}
        onOk={handleShip}
        onCancel={() => {
          setShippingOrder(null);
          setTrackingNumber('');
          setTrackingCarrierCode(undefined);
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            allowClear
            showSearch
            value={trackingCarrierCode}
            onChange={setTrackingCarrierCode}
            placeholder={t('pages.adminOrders.selectCarrier')}
            options={carrierOptions}
            optionFilterProp="label"
          />
          <Input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder={t('pages.adminOrders.tracking')}
            maxLength={100}
          />
          <Checkbox checked={autoPrintLabel} onChange={(e) => setAutoPrintLabel(e.target.checked)}>
            {t('pages.adminOrders.autoPrintLabel')}
          </Checkbox>
        </Space>
      </Modal>
      <Modal
        title={t('pages.adminOrders.refundNow')}
        open={!!refundOrder}
        confirmLoading={refunding}
        okText={t('pages.adminOrders.refundNow')}
        okButtonProps={{
          danger: true,
          disabled: refundPaymentsLoading || (hasLoadedRefundPayments && !hasPaidRefundPayment),
        }}
        onOk={handleRefundOrder}
        onCancel={() => {
          setRefundOrder(null);
          setRefundReason('');
          setManualRefundReference('');
          setRefundRestock(false);
          setRefundPayments([]);
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            {t('pages.adminOrders.refundConfirmHint', {
              orderNo: refundOrder?.orderNo || refundOrder?.id || '',
              amount: refundOrder ? formatMoney(refundOrder.totalAmount) : '',
            })}
          </Typography.Text>
          <Input.TextArea
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder={t('pages.adminOrders.refundReasonPlaceholder')}
            maxLength={500}
            showCount
            rows={4}
          />
          <Input
            value={manualRefundReference}
            onChange={(event) => setManualRefundReference(event.target.value)}
            placeholder={t('pages.adminOrders.manualRefundReferencePlaceholder')}
            maxLength={128}
            allowClear
          />
          <Checkbox checked={refundRestock} onChange={(event) => setRefundRestock(event.target.checked)}>
            {t('pages.adminOrders.restockRefundItems')}
          </Checkbox>
          {hasLoadedRefundPayments && !hasPaidRefundPayment ? (
            <Alert
              type={refundAlreadyProcessing ? 'warning' : 'error'}
              showIcon
              message={refundAlreadyProcessing ? t('pages.adminOrders.refundProcessingHint') : t('pages.adminOrders.noPaidPaymentForRefund')}
            />
          ) : null}
          <div>
            <Typography.Text strong>{t('pages.adminOrders.refundPaymentEvidence')}</Typography.Text>
            <Table
              rowKey="id"
              loading={refundPaymentsLoading}
              dataSource={refundPayments}
              pagination={false}
              size="small"
              columns={[
                {
                  title: t('pages.adminOrders.paymentMethod'),
                  dataIndex: 'channel',
                  key: 'channel',
                  render: (channel: string) => paymentMethodLabel(channel, t),
                },
                {
                  title: t('common.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 104,
                  render: (status: string) => <Tag color={orderStatusColors[status] || 'default'}>{t(`status.${status}`)}</Tag>,
                },
                {
                  title: t('common.amount'),
                  dataIndex: 'amount',
                  key: 'amount',
                  width: 112,
                  render: (value: number) => formatMoney(value),
                },
                {
                  title: t('pages.adminOrders.refundReference'),
                  dataIndex: 'refundReference',
                  key: 'refundReference',
                  render: (value: string) => value || '-',
                },
                {
                  title: t('common.actions'),
                  key: 'actions',
                  width: 120,
                  render: (_: any, payment: Payment) => (
                    <Button
                      size="small"
                      type="link"
                      loading={syncingPaymentIds.includes(payment.id)}
                      disabled={payment.status !== 'PENDING'}
                      onClick={() => handleSyncPayment(payment, 'refund')}
                    >
                      {t('pages.adminOrders.syncPayment')}
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </Space>
      </Modal>
      <Modal
        title={t('pages.adminOrders.batchShipOrders')}
        open={batchShipOpen}
        confirmLoading={batchShipping}
        onOk={handleBatchShip}
        onCancel={() => setBatchShipOpen(false)}
      >
        <p>{t('pages.adminOrders.batchShipHint')}</p>
        <Input
          value={batchTrackingPrefix}
          onChange={(e) => setBatchTrackingPrefix(e.target.value)}
          placeholder={t('pages.adminOrders.trackingPrefix')}
          maxLength={40}
        />
        <Select
          allowClear
          showSearch
          value={batchTrackingCarrierCode}
          onChange={setBatchTrackingCarrierCode}
          placeholder={t('pages.adminOrders.selectCarrier')}
          options={carrierOptions}
          optionFilterProp="label"
          style={{ width: '100%', marginTop: 12 }}
        />
      </Modal>
      <Modal
        title={t('pages.adminOrders.logisticsTracking')}
        open={trackingOpen}
        onCancel={() => setTrackingOpen(false)}
        footer={null}
        width={720}
      >
        <SeventeenTrackWidget trackingNumber={selectedTrackingNumber} carrierCode={selectedTrackingCarrierCode} />
      </Modal>
      <Modal
        title={t('pages.adminOrders.orderItemsTitle', { id: detailOrder?.orderNo || detailOrder?.id || '' })}
        open={!!detailOrder}
        onCancel={() => {
          setDetailOrder(null);
          setOrderItems([]);
          setOrderPayments([]);
        }}
        footer={null}
        width={720}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Table
            rowKey="id"
            loading={itemsLoading}
            dataSource={orderItems}
            pagination={false}
            size="small"
            columns={[
              { title: t('common.id'), dataIndex: 'productId', key: 'productId', width: 90 },
              {
                title: t('pages.adminOrders.product'),
                dataIndex: 'productName',
                key: 'productName',
                render: (v: string, item: OrderItem) => (
                  <Space direction="vertical" size={0}>
                    <span>{v || `#${item.productId}`}</span>
                    {item.selectedSpecs ? <Typography.Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Typography.Text> : null}
                  </Space>
                ),
              },
              { title: t('common.quantity'), dataIndex: 'quantity', key: 'quantity', width: 100 },
              {
                title: t('common.amount'),
                dataIndex: 'price',
                key: 'price',
                width: 120,
                render: (v: number) => formatMoney(v),
              },
              {
                title: t('common.subtotal'),
                key: 'subtotal',
                width: 120,
                render: (_: any, item: OrderItem) => formatMoney(item.price * item.quantity),
              },
            ]}
          />
          <div>
            <Typography.Text strong>{t('pages.adminOrders.paymentHistory')}</Typography.Text>
            <Table
              rowKey="id"
              loading={paymentsLoading}
              dataSource={orderPayments}
              pagination={false}
              size="small"
              columns={[
                { title: t('pages.adminOrders.paymentMethod'), dataIndex: 'channel', key: 'channel', width: 120 },
                {
                  title: t('common.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 110,
                  render: (status: string) => <Tag color={orderStatusColors[status] || 'default'}>{t(`status.${status}`)}</Tag>,
                },
                {
                  title: t('common.amount'),
                  dataIndex: 'amount',
                  key: 'amount',
                  width: 120,
                  render: (value: number) => formatMoney(value),
                },
                {
                  title: t('pages.adminOrders.refundReference'),
                  dataIndex: 'refundReference',
                  key: 'refundReference',
                  render: (value: string) => value || '-',
                },
                {
                  title: t('pages.adminOrders.createdAt'),
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  width: 145,
                  render: (value: string) => value ? new Date(value).toLocaleString(dateLocale) : '-',
                },
                {
                  title: t('common.actions'),
                  key: 'actions',
                  width: 120,
                  render: (_: any, payment: Payment) => (
                    <Button
                      size="small"
                      type="link"
                      loading={syncingPaymentIds.includes(payment.id)}
                      disabled={payment.status !== 'PENDING'}
                      onClick={() => handleSyncPayment(payment, 'detail')}
                    >
                      {t('pages.adminOrders.syncPayment')}
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default OrderManagement;
