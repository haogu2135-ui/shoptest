import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Divider, message, Space, Table, Tag, Typography } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import ShopSearchField from '../components/ShopSearchField';
import ShopModal from '../components/ShopModal';
import ShopConfirm from '../components/ShopConfirm';
import { DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logisticsCarrierApi } from '../api';
import { adminApi } from '../api/admin';
import type { AdminPayment, LogisticsCarrier, Order, OrderItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { useDebounce } from '../hooks/useDebounce';
import {
  isOrderNeedsAction,
  isOrderRefunded,
  isOrderShippable,
  getOrderSlaStart,
  getOrderSlaState,
  orderNextActionByStatus,
  orderStatusColors,
  orderValidTransitions,
} from '../utils/orderOperationsConfig';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import { labelTableSelectionCheckbox } from '../utils/tableSelectionAccessibility';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import {
  getEffectiveRole,
  hasAdminPermission,
  ORDER_EXPORT_PERMISSION,
  ORDER_FULFILLMENT_PERMISSION,
  ORDER_PAYMENT_PERMISSION,
  ORDER_REFUND_PERMISSION,
  ORDER_STATUS_PERMISSION,
} from '../utils/roles';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import './OrderManagement.css';

const { Title } = Typography;
const evidenceCell = (label: string): React.TdHTMLAttributes<HTMLElement> & Record<'data-label', string> => ({
  'data-label': label,
});

export const resolveOrderRouteFilters = (params: URLSearchParams) => {
  const quick = params.get('quick') || undefined;
  return {
    status: quick ? undefined : params.get('status') || undefined,
    quick,
  };
};

export const buildOrderFilterSearchParams = (
  params: URLSearchParams,
  filters: { status?: string; quick?: string },
) => {
  const nextParams = new URLSearchParams(params);
  if (filters.quick) {
    nextParams.set('quick', filters.quick);
    nextParams.delete('status');
  } else if (filters.status) {
    nextParams.set('status', filters.status);
    nextParams.delete('quick');
  } else {
    nextParams.delete('status');
    nextParams.delete('quick');
  }
  return nextParams;
};

const orderRecipientLine = (order: Pick<Order, 'recipientName' | 'recipientPhone'>) =>
  [order.recipientName, order.recipientPhone].filter(Boolean).join(' / ');

const orderShipToBlock = (order: Pick<Order, 'recipientName' | 'recipientPhone' | 'shippingAddress'>) =>
  [orderRecipientLine(order), order.shippingAddress].filter(Boolean).join('\n');

const orderDisplayLabel = (order: Pick<Order, 'id' | 'orderNo'>) => order.orderNo || `#${order.id}`;

const orderCustomerLabel = (order: Pick<Order, 'customerDisplayName' | 'customerUsername' | 'username' | 'userId'>) =>
  order.customerDisplayName || order.customerUsername || order.username || (order.userId ? `#${order.userId}` : '-');

const paymentDisplayLabel = (payment: Pick<AdminPayment, 'id' | 'orderId' | 'orderNo'>) =>
  payment.orderNo || (payment.orderId ? `#${payment.orderId}` : `#${payment.id}`);

const ORDER_STATUS_LABEL_KEYS = new Set([...Object.keys(orderStatusColors), 'PENDING_RECEIPT']);
const PAYMENT_STATUS_LABEL_KEYS = new Set(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED']);
const DIRECT_REFUND_ORDER_STATUSES = new Set(['PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED']);
const RECONCILIATION_REFUND_ORDER_STATUSES = new Set(['PENDING_PAYMENT', 'CANCELLED']);
const REFUND_RESTOCK_REQUIRED_STATUSES = new Set(['PENDING_SHIPMENT', 'COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED']);

const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();
const isRefundRestockRequired = (status?: string) => REFUND_RESTOCK_REQUIRED_STATUSES.has(normalizeStatusCode(status));
const AFTER_SALES_STATUS_PRIORITY: Record<string, number> = {
  RETURN_REQUESTED: 10,
  RETURN_SHIPPED: 20,
  RETURN_REFUNDING: 30,
  RETURN_APPROVED: 40,
  REFUNDING: 50,
  RETURNED: 60,
  REFUNDED: 70,
};

const getAfterSalesPriority = (order: Order) => {
  const statusPriority = AFTER_SALES_STATUS_PRIORITY[normalizeStatusCode(order.status)] ?? 100;
  return statusPriority;
};

const REFUND_REASON_PRESET_KEYS = [
  'customerRequest',
  'duplicatePayment',
  'outOfStock',
  'qualityIssue',
  'pricingError',
  'other',
] as const;


const OrderManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderLoadError, setOrderLoadError] = useState<string | null>(null);
  const [orderSnapshotLoaded, setOrderSnapshotLoaded] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(() => resolveOrderRouteFilters(searchParams).status);
  const [quickFilter, setQuickFilter] = useState<string | undefined>(() => resolveOrderRouteFilters(searchParams).quick);
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
  const debouncedSearchText = useDebounce(searchText.trim(), 300);
  const [batchShipOpen, setBatchShipOpen] = useState(false);
  const [batchTrackingPrefix, setBatchTrackingPrefix] = useState('BATCH');
  const [batchTrackingCarrierCode, setBatchTrackingCarrierCode] = useState<string | undefined>();
  const [batchShipping, setBatchShipping] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState('');
  const [selectedTrackingCarrierCode, setSelectedTrackingCarrierCode] = useState<string | undefined>();
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<number | undefined>();
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [manualRefundReference, setManualRefundReference] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundPayments, setRefundPayments] = useState<AdminPayment[]>([]);
  const [refundPaymentsLoading, setRefundPaymentsLoading] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<{
    orderId: number;
    nextStatus: string;
    title: string;
    description: string;
    okText: string;
    actionLabel: string;
    danger?: boolean;
  } | null>(null);
  const [statusConfirmLoading, setStatusConfirmLoading] = useState(false);
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [orderPayments, setOrderPayments] = useState<AdminPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [syncingPaymentIds, setSyncingPaymentIds] = useState<React.Key[]>([]);
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState<React.Key[]>([]);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const { t, language } = useLanguage();
  const orderPaginationItemRender = buildPaginationItemRender(
    `${t('common.previousPage')}: ${t('adminLayout.orders')}`,
    `${t('common.nextPage')}: ${t('adminLayout.orders')}`,
    `${t('common.previousPages')}: ${t('adminLayout.orders')}`,
    `${t('common.nextPages')}: ${t('adminLayout.orders')}`,
  );
  const orderItemProductName = (item: Pick<OrderItem, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  );
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const { formatMoney } = useMarket();
  const pageSizeRef = useRef(20);
  const detailRequestSeqRef = useRef(0);
  const canExportOrders = hasAdminPermission(adminPermissions, currentRole, ORDER_EXPORT_PERMISSION);
  const canUpdateOrderStatus = hasAdminPermission(adminPermissions, currentRole, ORDER_STATUS_PERMISSION);
  const canFulfillOrders = hasAdminPermission(adminPermissions, currentRole, ORDER_FULFILLMENT_PERMISSION);
  const canSyncOrderPayments = hasAdminPermission(adminPermissions, currentRole, ORDER_PAYMENT_PERMISSION);
  const canRefundOrders = hasAdminPermission(adminPermissions, currentRole, ORDER_REFUND_PERMISSION);
  const orderActionDisabled = loading || Boolean(orderLoadError) || !orderSnapshotLoaded;
  const orderActionUnavailableMessage = orderLoadError || (loading ? t('common.loading') : t('pages.adminOrders.fetchFailed'));
  const formatKnownStatusLabel = useCallback((status: string | undefined, knownStatuses: Set<string>) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = normalizeStatusCode(rawStatus);
    if (!normalizedStatus) return t('common.unknown');
    if (knownStatuses.has(normalizedStatus)) return t(`status.${normalizedStatus}`);
    return rawStatus;
  }, [t]);
  const formatOrderStatusLabel = useCallback(
    (status?: string) => formatKnownStatusLabel(status, ORDER_STATUS_LABEL_KEYS),
    [formatKnownStatusLabel],
  );
  const formatPaymentStatusLabel = useCallback(
    (status?: string) => formatKnownStatusLabel(status, PAYMENT_STATUS_LABEL_KEYS),
    [formatKnownStatusLabel],
  );
  const getOrderStatusColor = useCallback((status?: string) => {
    const normalizedStatus = normalizeStatusCode(status);
    if (!ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
    return orderStatusColors[normalizedStatus] || 'default';
  }, []);
  const getPaymentStatusColor = useCallback((status?: string) => {
    const normalizedStatus = normalizeStatusCode(status);
    if (!PAYMENT_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
    return orderStatusColors[normalizedStatus] || 'default';
  }, []);
  const syncRouteFilters = useCallback((filters: { status?: string; quick?: string }) => {
    const nextParams = buildOrderFilterSearchParams(searchParams, filters);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
      setOrderLoadError(null);
      setOrders(res.data.items || []);
      setOrderPage({
        page: res.data.page || 1,
        size: res.data.size || params.size || 20,
        total: res.data.total || 0,
        totalPages: res.data.totalPages || 0,
      });
      pageSizeRef.current = res.data.size || params.size || pageSizeRef.current;
      setOrderSummary(res.data.summary || {});
      setOrderSnapshotLoaded(true);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.adminOrders.fetchFailed'), language);
      setOrderLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: 1, size: pageSizeRef.current });
  }, [debouncedSearchText, fetchOrders, filterStatus, quickFilter]);

  useEffect(() => {
    const { status: nextStatus, quick: nextQuick } = resolveOrderRouteFilters(searchParams);
    const canonicalParams = buildOrderFilterSearchParams(searchParams, { status: nextStatus, quick: nextQuick });
    if (canonicalParams.toString() !== searchParams.toString()) {
      setSearchParams(canonicalParams, { replace: true });
    }
    setFilterStatus((current) => current === nextStatus ? current : nextStatus);
    setQuickFilter((current) => current === nextQuick ? current : nextQuick);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [filterStatus, quickFilter, debouncedSearchText]);

  useEffect(() => {
    let disposed = false;
    logisticsCarrierApi.getAll(true)
      .then((res) => {
        if (disposed) return;
        setCarriers(res.data || []);
      })
      .catch((error) => {
        if (disposed) return;
        reportNonBlockingError('OrderManagement carriers load failed', error);
        setCarriers([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((res) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
        setAdminPermissions(res.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const shippableIds = new Set(canFulfillOrders ? orders.filter(isOrderShippable).map((order) => order.id) : []);
    setSelectedOrderIds((current) => current.filter((id) => shippableIds.has(Number(id))));
  }, [canFulfillOrders, orders]);

  const permissionForOrderTransition = (currentStatus: string, nextStatus: string) => {
    if (nextStatus === 'PENDING_SHIPMENT') {
      return currentStatus === 'PENDING_PAYMENT' ? ORDER_PAYMENT_PERMISSION : ORDER_FULFILLMENT_PERMISSION;
    }
    if (nextStatus === 'SHIPPED' || nextStatus === 'RETURN_APPROVED'
      || (nextStatus === 'COMPLETED' && currentStatus === 'RETURN_REQUESTED')) {
      return ORDER_FULFILLMENT_PERMISSION;
    }
    if (nextStatus === 'RETURNED') {
      return ORDER_REFUND_PERMISSION;
    }
    return ORDER_STATUS_PERMISSION;
  };

  const canApplyOrderTransition = (order: Order, nextStatus: string) => {
    const permission = permissionForOrderTransition(order.status, nextStatus);
    if (permission === ORDER_PAYMENT_PERMISSION) return canSyncOrderPayments;
    if (permission === ORDER_FULFILLMENT_PERMISSION) return canFulfillOrders;
    if (permission === ORDER_REFUND_PERMISSION) return canRefundOrders;
    return canUpdateOrderStatus;
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    const order = orders.find((item) => item.id === orderId);
    if (order && !canApplyOrderTransition(order, newStatus)) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (statusUpdatingIds.includes(orderId)) {
      return;
    }
    try {
      setStatusUpdatingIds((current) => [...current, orderId]);
      await adminApi.updateOrderStatus(orderId, newStatus);
      message.success(t('pages.adminOrders.statusUpdated'));
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, t('messages.updateFailed'), language);
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
      return selectedSpecs ? formatSelectedSpecs(selectedSpecs, t, language) : '';
    } catch (error) {
      reportNonBlockingError('OrderManagement.formatLabelSpecs', error);
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
            <td>${escapeHtml(orderItemProductName(item))}</td>
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
              <div class="address">${escapeHtml(orderShipToBlock(order) || '-')}</div>
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
      const res = await adminApi.getOrderItems(order.id);
      items = res.data || [];
    } catch (error) {
      reportNonBlockingError('OrderManagement.loadLabelItems', error);
      items = [];
    }

    try {
      printWindow.document.open();
      printWindow.document.write(buildShippingLabelHtml(order, items));
      printWindow.document.close();
    } catch (error) {
      reportNonBlockingError('OrderManagement.printShippingLabel', error);
      printWindow.close();
      message.error(t('pages.adminOrders.printFailed'));
    }
  };

  const handleShip = async () => {
    if (!shippingOrder) {
      return;
    }
    if (!canFulfillOrders) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
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
    } catch (err: unknown) {
      printWindow?.close();
      const msg = getApiErrorMessage(err, t('messages.updateFailed'), language);
      message.error(msg);
    } finally {
      setShipping(false);
    }
  };

  const closeShippingModal = () => {
    if (shipping) return;
    setShippingOrder(null);
    setTrackingNumber('');
    setTrackingCarrierCode(undefined);
  };

  const handleViewItems = async (order: Order) => {
    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;
    setDetailOrder(order);
    setItemsLoading(true);
    setPaymentsLoading(canSyncOrderPayments);
    setOrderPayments([]);
    try {
      const itemsRes = await adminApi.getOrderItems(order.id);
      if (detailRequestSeqRef.current !== requestSeq) return;
      setOrderItems(itemsRes.data);
    } catch (error: unknown) {
      if (detailRequestSeqRef.current !== requestSeq) return;
      setOrderItems([]);
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
    } finally {
      if (detailRequestSeqRef.current === requestSeq) {
        setItemsLoading(false);
      }
    }
    if (!canSyncOrderPayments) {
      if (detailRequestSeqRef.current === requestSeq) {
        setPaymentsLoading(false);
      }
      return;
    }
    try {
      const paymentsRes = await adminApi.getOrderPayments(order.id);
      if (detailRequestSeqRef.current !== requestSeq) return;
      setOrderPayments(paymentsRes.data || []);
    } catch (error: unknown) {
      if (detailRequestSeqRef.current !== requestSeq) return;
      setOrderPayments([]);
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
    } finally {
      if (detailRequestSeqRef.current === requestSeq) {
        setPaymentsLoading(false);
      }
    }
  };

  const canRefundOrder = (order: Order) => {
    const status = normalizeStatusCode(order.status);
    return (DIRECT_REFUND_ORDER_STATUSES.has(status) || RECONCILIATION_REFUND_ORDER_STATUSES.has(status))
      && !isOrderRefunded(order);
  };

  const openRefundModal = async (order: Order) => {
    if (!canRefundOrders) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    setRefundOrder(order);
    setRefundReason(order.returnReason || '');
    setRefundRestock(isRefundRestockRequired(order.status));
    setRefundConfirmed(false);
    setRefundPayments([]);
    setRefundPaymentsLoading(canSyncOrderPayments);
    if (!canSyncOrderPayments) {
      return;
    }
    try {
      const res = await adminApi.getOrderPayments(order.id);
      setRefundPayments(res.data || []);
    } catch (error) {
      reportNonBlockingError('OrderManagement.openRefundModal.payments', error);
      setRefundPayments([]);
    } finally {
      setRefundPaymentsLoading(false);
    }
  };

  const closeRefundModal = () => {
    if (refunding) return;
    setRefundOrder(null);
    setRefundReason('');
    setManualRefundReference('');
    setRefundRestock(false);
    setRefundConfirmed(false);
    setRefundPayments([]);
    setRefundPaymentsLoading(false);
  };

  const handleRefundOrder = async () => {
    if (!refundOrder) return;
    if (!canRefundOrders) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    if (!refundReason.trim()) {
      message.warning(t('pages.adminOrders.refundReasonRequired'));
      return;
    }
    if (!refundConfirmed) {
      message.warning(t('pages.adminOrders.refundConfirmRequired'));
      return;
    }
    try {
      setRefunding(true);
      const effectiveRestock = isRefundRestockRequired(refundOrder.status) || refundRestock;
      const res = await adminApi.refundOrder(refundOrder.id, {
        reason: refundReason.trim(),
        restock: effectiveRestock,
        manualRefundReference: manualRefundReference.trim(),
      });
      message.success(t('pages.adminOrders.refundCompletedWithReference', { reference: res.data.payment.refundReference || res.data.payment.id }));
      setRefundOrder(null);
      setRefundReason('');
      setManualRefundReference('');
      setRefundRestock(false);
      setRefundConfirmed(false);
      setRefundPayments([]);
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('pages.adminOrders.refundFailed'), language));
    } finally {
      setRefunding(false);
    }
  };

  const hasLoadedRefundPayments = Boolean(refundOrder) && canSyncOrderPayments && !refundPaymentsLoading;
  const hasPaidRefundPayment = refundPayments.some((payment) => normalizeStatusCode(payment.status) === 'PAID');
  const hasReconcileRequiredRefundPayment = refundPayments.some((payment) => normalizeStatusCode(payment.status) === 'RECONCILE_REQUIRED');
  const refundAlreadyProcessing = refundPayments.some((payment) => normalizeStatusCode(payment.status) === 'REFUNDING');
  const hasRefundablePayment = hasPaidRefundPayment || hasReconcileRequiredRefundPayment || refundAlreadyProcessing;

  const mergePayment = (payments: AdminPayment[], syncedPayment: AdminPayment) =>
    payments.map((payment) => payment.id === syncedPayment.id ? syncedPayment : payment);

  const handleSyncPayment = async (payment: AdminPayment, scope: 'detail' | 'refund') => {
    if (!canSyncOrderPayments) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    if (syncingPaymentIds.includes(payment.id)) {
      return;
    }
    try {
      setSyncingPaymentIds((current) => [...current, payment.id]);
      const res = await adminApi.syncOrderPayment(payment.id);
      if (scope === 'refund') {
        setRefundPayments((current) => mergePayment(current, res.data));
      } else {
        setOrderPayments((current) => mergePayment(current, res.data));
      }
      message.success(t('pages.adminOrders.paymentSynced'));
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('pages.adminOrders.paymentSyncFailed'), language));
    } finally {
      setSyncingPaymentIds((current) => current.filter((id) => id !== payment.id));
    }
  };

  const handleBatchShip = async () => {
    if (!canFulfillOrders) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    if (selectedVisibleShippableIds.length === 0) {
      message.error(t('pages.adminOrders.selectPendingShipment'));
      return;
    }
    try {
      setBatchShipping(true);
      const res = await adminApi.batchShipOrders(selectedVisibleShippableIds, batchTrackingPrefix.trim() || 'BATCH', batchTrackingCarrierCode);
      message.success(t('pages.adminOrders.batchShipResult', { success: res.data.success, failed: res.data.failed }));
      setBatchShipOpen(false);
      setBatchTrackingPrefix('BATCH');
      setBatchTrackingCarrierCode(undefined);
      setSelectedOrderIds([]);
      fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      setBatchShipping(false);
    }
  };

  const closeBatchShipModal = () => {
    if (batchShipping) return;
    setBatchShipOpen(false);
    setBatchTrackingPrefix('BATCH');
    setBatchTrackingCarrierCode(undefined);
  };

  const closeTrackingModal = () => {
    setTrackingOpen(false);
    setSelectedTrackingNumber('');
    setSelectedTrackingCarrierCode(undefined);
    setSelectedTrackingOrderId(undefined);
  };

  const closeDetailModal = () => {
    setDetailOrder(null);
    setOrderItems([]);
    setOrderPayments([]);
    setItemsLoading(false);
    setPaymentsLoading(false);
  };

  const handleExport = async () => {
    if (!canExportOrders) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    setExporting(true);
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
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminOrders.exportFailed'), language));
    } finally {
      setExporting(false);
    }
  };

  const handleTrackShipment = (trackingNo?: string, carrierCode?: string, orderId?: number) => {
    if (!trackingNo) {
      message.warning(t('pages.adminOrders.noTrackingNumber'));
      return;
    }
    setSelectedTrackingNumber(trackingNo);
    setSelectedTrackingCarrierCode(carrierCode);
    setSelectedTrackingOrderId(orderId);
    setTrackingOpen(true);
  };
  const handleStatusFilterChange = (value?: string) => {
    const nextStatus = value || undefined;
    setFilterStatus(nextStatus);
    setQuickFilter(undefined);
    syncRouteFilters({ status: nextStatus });
  };
  const handleQuickFilterChange = (value?: string) => {
    const nextQuick = value && quickFilter !== value ? value : undefined;
    setQuickFilter(nextQuick);
    setFilterStatus(undefined);
    syncRouteFilters({ quick: nextQuick });
  };

  const carrierOptions = carriers.map((carrier) => ({
    value: String(carrier.trackingCode || ''),
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
  const selectedVisibleShippableIds = canFulfillOrders
    ? orders
      .filter((order) => selectedOrderIds.includes(order.id) && isOrderShippable(order))
      .map((order) => order.id)
    : [];
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
      key: 'missingTracking',
      label: t('pages.adminOrders.missingTrackingCard'),
      value: orderSummary.MISSING_TRACKING ?? orders.filter((order) => order.status === 'SHIPPED' && !String(order.trackingNumber || '').trim()).length,
      color: '#ad4e00',
      filter: 'MISSING_TRACKING',
    },
    {
      key: 'pendingShipment',
      label: t('status.PENDING_SHIPMENT'),
      value: orderSummary.PENDING_SHIPMENT ?? orders.filter(isOrderShippable).length,
      color: '#1677ff',
      filter: 'PENDING_SHIPMENT',
    },
    {
      key: 'afterSales',
      label: t('pages.adminDashboard.commercialReadiness.afterSales'),
      value: orderSummary.AFTER_SALES ?? orders.filter((order) => ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING'].includes(order.status)).length,
      color: '#cf1322',
      filter: 'AFTER_SALES',
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
      key: 'refunding',
      label: t('status.REFUNDING'),
      value: orderSummary.REFUNDING ?? 0,
      color: '#c41d7f',
      filter: 'REFUNDING',
    },
    {
      key: 'refunded',
      label: t('status.REFUNDED'),
      value: orderSummary.REFUNDED ?? orders.filter(isOrderRefunded).length,
      color: '#722ed1',
      filter: 'REFUNDED',
    },
  ];
  const specificQuickFilterLabels: Record<string, string> = {
    SLA_OVERDUE_PAYMENT: `${t('status.PENDING_PAYMENT')} · ${t('pages.adminOrders.slaOverdueCard')}`,
    SLA_OVERDUE_SHIPMENT: `${t('status.PENDING_SHIPMENT')} · ${t('pages.adminOrders.slaOverdueCard')}`,
    SLA_OVERDUE_RETURN_APPROVED: `${t('status.RETURN_APPROVED')} · ${t('pages.adminOrders.slaOverdueCard')}`,
    SLA_OVERDUE_RETURN_SHIPPED: `${t('status.RETURN_SHIPPED')} · ${t('pages.adminOrders.slaOverdueCard')}`,
  };
  const activeQuickFilterLabel = orderSummaryCards.find((item) => item.filter === quickFilter)?.label
    || (quickFilter ? specificQuickFilterLabels[quickFilter] : undefined);
  const afterSalesStatuses = ['AFTER_SALES', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED', 'REFUNDING', 'SLA_OVERDUE_RETURN_APPROVED', 'SLA_OVERDUE_RETURN_SHIPPED'];
  const showAfterSalesQueueHint = afterSalesStatuses.includes(String(quickFilter || ''))
    || afterSalesStatuses.includes(String(filterStatus || ''));
  const afterSalesBreakdown = [
    {
      key: 'RETURN_REQUESTED',
      filter: 'RETURN_REQUESTED',
      label: t('status.RETURN_REQUESTED'),
      value: orderSummary.RETURN_REQUESTED ?? orders.filter((order) => normalizeStatusCode(order.status) === 'RETURN_REQUESTED').length,
    },
    {
      key: 'RETURN_APPROVED',
      filter: 'RETURN_APPROVED',
      label: t('status.RETURN_APPROVED'),
      value: orderSummary.RETURN_APPROVED ?? orders.filter((order) => normalizeStatusCode(order.status) === 'RETURN_APPROVED').length,
    },
    {
      key: 'RETURN_SHIPPED',
      filter: 'RETURN_SHIPPED',
      label: t('status.RETURN_SHIPPED'),
      value: orderSummary.RETURN_SHIPPED ?? orders.filter((order) => normalizeStatusCode(order.status) === 'RETURN_SHIPPED').length,
    },
    {
      key: 'RETURN_REFUNDING',
      filter: 'RETURN_REFUNDING',
      label: t('status.RETURN_REFUNDING'),
      value: orderSummary.RETURN_REFUNDING ?? orders.filter((order) => normalizeStatusCode(order.status) === 'RETURN_REFUNDING').length,
    },
  ];
  const prioritizeAfterSalesQueue = showAfterSalesQueueHint
    || String(quickFilter || '') === 'SLA_OVERDUE'
    || String(quickFilter || '') === 'SLA_DUE_SOON';
  const displayOrders = prioritizeAfterSalesQueue
    ? [...orders].sort((left, right) => {
      const leftSla = getOrderSla(left);
      const rightSla = getOrderSla(right);
      const leftUrgency = leftSla?.overdue ? 0 : leftSla?.dueSoon ? 1 : 2;
      const rightUrgency = rightSla?.overdue ? 0 : rightSla?.dueSoon ? 1 : 2;
      if (leftUrgency !== rightUrgency) return leftUrgency - rightUrgency;
      const statusDiff = getAfterSalesPriority(left) - getAfterSalesPriority(right);
      if (statusDiff !== 0) return statusDiff;
      const leftStart = Date.parse(String(getOrderSlaStart(left) || left.createdAt || '')) || 0;
      const rightStart = Date.parse(String(getOrderSlaStart(right) || right.createdAt || '')) || 0;
      return leftStart - rightStart;
    })
    : orders;
  const currentOrderStatusLabel = filterStatus ? formatOrderStatusLabel(filterStatus) : t('pages.adminOrders.allStatus');
  const currentOrderSearchLabel = searchText.trim() || normalizedSearchText || t('pages.adminOrders.searchPlaceholder');
  const activeOrderFilterLabel = [
    `${t('pages.adminOrders.filter')} ${currentOrderStatusLabel}`,
    activeQuickFilterLabel ? t('pages.adminOrders.quickFilterActive', { filter: activeQuickFilterLabel }) : '',
    normalizedSearchText ? `${t('pages.adminOrders.searchPlaceholder')}: ${normalizedSearchText}` : '',
  ].filter(Boolean).join(', ');
  const orderStatusFilterLabel = `${t('pages.adminOrders.allStatus')}: ${currentOrderStatusLabel}`;
  const orderSearchInputLabel = `${t('pages.adminOrders.searchPlaceholder')}: ${currentOrderSearchLabel}`;
  const exportOrdersActionLabel = `${quickFilter || normalizedSearchText ? t('pages.adminOrders.exportVisibleOrders') : t('pages.adminOrders.exportOrders')}: ${activeOrderFilterLabel}`;
  const batchShipActionLabel = `${t('pages.adminOrders.batchShip')}: ${selectedVisibleShippableIds.length}`;
  const selectAllVisibleOrdersLabel = t('pages.adminOrders.selectAllVisibleOrders');
  const shippingOrderLabel = shippingOrder ? orderDisplayLabel(shippingOrder) : t('pages.adminOrders.title');
  const shippingSubmitActionLabel = `${t('pages.adminOrders.enterTracking')}: ${shippingOrderLabel}`;
  const shippingCarrierSelectLabel = `${t('pages.adminOrders.selectCarrier')}: ${shippingOrderLabel}`;
  const shippingTrackingInputLabel = `${t('pages.adminOrders.tracking')}: ${shippingOrderLabel}`;
  const autoPrintLabelActionLabel = `${t('pages.adminOrders.autoPrintLabel')}: ${shippingOrderLabel}`;
  const refundOrderLabel = refundOrder ? orderDisplayLabel(refundOrder) : t('pages.adminOrders.title');
  const refundSubmitActionLabel = `${t('pages.adminOrders.refundNow')}: ${refundOrderLabel}`;
  const refundReasonInputLabel = `${t('pages.adminOrders.refundReasonPlaceholder')}: ${refundOrderLabel}`;
  const manualRefundReferenceInputLabel = `${t('pages.adminOrders.manualRefundReferencePlaceholder')}: ${refundOrderLabel}`;
  const refundRestockActionLabel = `${t('pages.adminOrders.restockRefundItems')}: ${refundOrderLabel}`;
  const refundRestockRequired = isRefundRestockRequired(refundOrder?.status);
  const refundRestockChecked = refundRestockRequired || refundRestock;
  const refundRestockStatusLabel = formatKnownStatusLabel(refundOrder?.status, ORDER_STATUS_LABEL_KEYS);
  const batchShipSubmitActionLabel = `${t('pages.adminOrders.batchShip')}: ${selectedVisibleShippableIds.length}`;
  const batchTrackingPrefixInputLabel = `${t('pages.adminOrders.trackingPrefix')}: ${selectedVisibleShippableIds.length}`;
  const batchCarrierSelectLabel = `${t('pages.adminOrders.selectCarrier')}: ${t('pages.adminOrders.batchShipOrders')}, ${selectedVisibleShippableIds.length}`;
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
    return formatOrderStatusLabel(nextStatus);
  };
  const showInitialOrderLoading = loading && !orderSnapshotLoaded;
  const orderSnapshotUnavailable = Boolean(orderLoadError) && !orderSnapshotLoaded;
  const canRenderOrderSnapshot = !showInitialOrderLoading && !orderSnapshotUnavailable;

  const openStatusConfirm = (
    record: Order,
    nextStatus: string,
    title: string,
    description: string,
    okText: string,
    actionLabel: string,
    danger?: boolean,
  ) => {
    setStatusConfirm({
      orderId: record.id,
      nextStatus,
      title,
      description,
      okText,
      actionLabel,
      danger,
    });
  };

  const closeStatusConfirm = () => {
    if (statusConfirmLoading) return;
    setStatusConfirm(null);
  };

  const submitStatusConfirm = async () => {
    if (!statusConfirm) return;
    setStatusConfirmLoading(true);
    try {
      await handleStatusChange(statusConfirm.orderId, statusConfirm.nextStatus);
      setStatusConfirm(null);
    } finally {
      setStatusConfirmLoading(false);
    }
  };

  const confirmStatusChange = (record: Order, nextStatus: string) => {
    if (orderActionDisabled) {
      message.warning(orderActionUnavailableMessage);
      return;
    }
    if (!canApplyOrderTransition(record, nextStatus)) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    const orderStatusActionLabel = `${transitionLabel(record.status, nextStatus)}: ${orderDisplayLabel(record)}`;
    if (record.status === 'PENDING_PAYMENT' && nextStatus === 'PENDING_SHIPMENT') {
      openStatusConfirm(
        record,
        nextStatus,
        t('pages.adminOrders.confirmPaymentTitle'),
        t('pages.adminOrders.confirmPaymentContent'),
        t('pages.adminOrders.confirmPayment'),
        orderStatusActionLabel,
      );
      return;
    }
    if (record.status === 'RETURN_REQUESTED' && nextStatus === 'RETURN_APPROVED') {
      openStatusConfirm(
        record,
        nextStatus,
        t('pages.adminOrders.confirmApproveReturnTitle'),
        t('pages.adminOrders.confirmApproveReturnContent'),
        t('pages.adminOrders.approveReturn'),
        orderStatusActionLabel,
      );
      return;
    }
    if (record.status === 'RETURN_REQUESTED' && nextStatus === 'COMPLETED') {
      openStatusConfirm(
        record,
        nextStatus,
        t('pages.adminOrders.confirmRejectReturnTitle'),
        t('pages.adminOrders.confirmRejectReturnContent'),
        t('pages.adminOrders.rejectReturn'),
        orderStatusActionLabel,
        true,
      );
      return;
    }
    if (record.status === 'RETURN_SHIPPED' && nextStatus === 'RETURNED') {
      openStatusConfirm(
        record,
        nextStatus,
        t('pages.adminOrders.confirmReturnRefundTitle'),
        t('pages.adminOrders.confirmReturnRefundContent'),
        t('pages.adminOrders.confirmReturnReceivedAndRefund'),
        orderStatusActionLabel,
      );
      return;
    }
    openStatusConfirm(
      record,
      nextStatus,
      t('pages.adminOrders.statusChangeConfirmTitle'),
      t('pages.adminOrders.statusChangeConfirmContent', {
        order: orderDisplayLabel(record),
        customer: orderCustomerLabel(record),
        amount: formatMoney(record.totalAmount),
        from: formatOrderStatusLabel(record.status),
        to: formatOrderStatusLabel(nextStatus),
      }),
      transitionLabel(record.status, nextStatus),
      orderStatusActionLabel,
      nextStatus === 'CANCELLED',
    );
  };
  const runPrimaryNextAction = (order: Order) => {
    const status = normalizeStatusCode(order.status);
    if (status === 'PENDING_SHIPMENT' && canFulfillOrders) {
      setShippingOrder(order);
      setTrackingNumber(order.trackingNumber || '');
      setTrackingCarrierCode(order.trackingCarrierCode);
      return;
    }
    if (status === 'RETURN_REQUESTED') {
      const transitions = (orderValidTransitions[order.status] || []).filter((next) => canApplyOrderTransition(order, next));
      const approveStatus = transitions.find((next) => normalizeStatusCode(next) === 'RETURN_APPROVED');
      if (approveStatus) {
        confirmStatusChange(order, approveStatus);
        return;
      }
    }
    if (status === 'RETURN_SHIPPED' && canRefundOrders && canRefundOrder(order)) {
      void openRefundModal(order);
      return;
    }
    if (status === 'RETURN_REFUNDING' || status === 'REFUNDED' || status === 'RETURN_APPROVED' || status === 'SHIPPED' || status === 'PENDING_PAYMENT') {
      void handleViewItems(order);
      return;
    }
    void handleViewItems(order);
  };

  const primaryNextActionLabel = (order: Order) => {
    const status = normalizeStatusCode(order.status);
    if (status === 'PENDING_SHIPMENT') return t('pages.adminOrders.nextActionShipCta');
    if (status === 'RETURN_REQUESTED') return t('pages.adminOrders.nextActionReviewCta');
    if (status === 'RETURN_SHIPPED') return t('pages.adminOrders.nextActionRefundCta');
    if (status === 'RETURN_REFUNDING') return t('pages.adminOrders.nextActionRefundFollowCta');
    if (status === 'RETURN_APPROVED') return t('pages.adminOrders.nextActionInspectCta');
    return t('pages.adminOrders.items');
  };

  const canRunPrimaryNextAction = (order: Order) => {
    const status = normalizeStatusCode(order.status);
    if (orderActionDisabled) return false;
    if (status === 'PENDING_SHIPMENT') return canFulfillOrders;
    if (status === 'RETURN_REQUESTED') {
      return (orderValidTransitions[order.status] || []).some((next) => canApplyOrderTransition(order, next) && normalizeStatusCode(next) === 'RETURN_APPROVED');
    }
    if (status === 'RETURN_SHIPPED') return canRefundOrders && canRefundOrder(order);
    return true;
  };

  const renderNextAction = (order: Order) => {
    const action = orderNextActionByStatus[order.status] || orderNextActionByStatus.COMPLETED;
    const sla = getOrderSla(order);
    const ctaLabel = `${primaryNextActionLabel(order)}: ${orderDisplayLabel(order)}`;
    return (
      <div className={`order-management-page__nextAction order-management-page__nextAction--${action.tone}`}>
        <Typography.Text strong>{t(action.titleKey)}</Typography.Text>
        <Typography.Text type="secondary">{t(action.textKey)}</Typography.Text>
        {sla ? (
          <Tag color={sla.overdue ? 'red' : sla.dueSoon ? 'orange' : 'green'} className="order-management-page__slaTag">
            {sla.label}
          </Tag>
        ) : null}
        {canRunPrimaryNextAction(order) ? (
          <Button
            size="small"
            type={action.tone === 'urgent' || action.tone === 'warning' ? 'primary' : 'default'}
            danger={normalizeStatusCode(order.status) === 'RETURN_SHIPPED'}
            className="order-management-page__nextActionCta"
            aria-label={ctaLabel}
            title={ctaLabel}
            onClick={() => runPrimaryNextAction(order)}
          >
            {primaryNextActionLabel(order)}
          </Button>
        ) : null}
      </div>
    );
  };

  const renderCustomer = (order: Order) => {
    const isGuest = order.customerType === 'GUEST' || order.guestOrder;
    const displayName = orderCustomerLabel(order);
    return (
      <Space direction="vertical" size={2} className="order-management-page__compactStack order-management-page__customerStack">
        <Space size={4} wrap>
          <Typography.Text strong>{displayName}</Typography.Text>
          <Tag color={isGuest ? 'purple' : 'blue'}>
            {isGuest ? t('pages.adminOrders.guestCustomer') : t('pages.adminOrders.registeredCustomer')}
          </Tag>
        </Space>
        {order.customerEmail ? <Typography.Text type="secondary">{order.customerEmail}</Typography.Text> : null}
        {order.customerPhone ? <Typography.Text type="secondary">{order.customerPhone}</Typography.Text> : null}
        {order.userId ? <Typography.Text type="secondary">{t('common.id')} {order.userId}</Typography.Text> : null}
      </Space>
    );
  };


  const columns = [
    { title: t('pages.adminOrders.orderId'), dataIndex: 'id', key: 'id', width: 76, onCell: () => evidenceCell(t('pages.adminOrders.orderId')) },
    {
      title: t('pages.adminOrders.customer'),
      key: 'customer',
      width: 190,
      onCell: () => evidenceCell(t('pages.adminOrders.customer')),
      render: (_: unknown, record: Order) => renderCustomer(record),
    },
    {
      title: t('common.amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      onCell: () => evidenceCell(t('common.amount')),
      render: (v: number) => <span className="order-management-page__amount commerce-money">{formatMoney(v)}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 112,
      onCell: () => evidenceCell(t('common.status')),
      render: (s: string) => <Tag color={getOrderStatusColor(s)}>{formatOrderStatusLabel(s)}</Tag>,
    },
    {
      title: t('pages.adminOrders.nextAction'),
      key: 'nextAction',
      width: 170,
      onCell: () => evidenceCell(t('pages.adminOrders.nextAction')),
      render: (_: unknown, record: Order) => renderNextAction(record),
    },
    {
      title: t('pages.adminOrders.returnInfo'),
      key: 'returnInfo',
      width: 180,
      onCell: () => evidenceCell(t('pages.adminOrders.returnInfo')),
      render: (_: unknown, record: Order) => (
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
      onCell: () => evidenceCell(t('pages.adminOrders.address')),
      render: (_: string, record: Order) => (
        <Space direction="vertical" size={0} className="order-management-page__compactStack">
          {orderRecipientLine(record) ? <Typography.Text strong>{orderRecipientLine(record)}</Typography.Text> : null}
          <span className="order-management-page__addressText">{record.shippingAddress || '-'}</span>
          {record.contactEmail ? <Typography.Text type="secondary">{record.contactEmail}</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: t('pages.adminOrders.paymentMethod'),
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 92,
      onCell: () => evidenceCell(t('pages.adminOrders.paymentMethod')),
      render: (v: string) => v || '-',
    },
    {
      title: t('pages.adminOrders.tracking'),
      dataIndex: 'trackingNumber',
      key: 'trackingNumber',
      width: 150,
      onCell: () => evidenceCell(t('pages.adminOrders.tracking')),
      render: (v: string, record: Order) => {
        if (!v) return '-';
        const orderLabel = orderDisplayLabel(record);
        const trackActionLabel = `${t('pages.adminOrders.track')}: ${orderLabel} / ${v}`;
        const printActionLabel = `${t('pages.adminOrders.printLabel')}: ${orderLabel}`;
        return (
          <Space direction="vertical" size={0} className="order-management-page__compactStack">
            <span className="order-management-page__trackingText">{v}</span>
            {record.trackingCarrierName ? <Typography.Text type="secondary">{record.trackingCarrierName}</Typography.Text> : null}
            <Space size={8}>
              <Button size="small" type="link" className="order-management-page__linkButton" aria-label={trackActionLabel} title={trackActionLabel} onClick={() => handleTrackShipment(v, record.trackingCarrierCode, record.id)}>{t('pages.adminOrders.track')}</Button>
              <Button size="small" type="link" className="order-management-page__linkButton" aria-label={printActionLabel} title={printActionLabel} onClick={() => printShippingLabel(record)}>{t('pages.adminOrders.printLabel')}</Button>
            </Space>
          </Space>
        );
      },
    },
    {
      title: t('pages.adminOrders.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 145,
      onCell: () => evidenceCell(t('pages.adminOrders.createdAt')),
      render: (v: string) => v ? new Date(v).toLocaleString(dateLocale) : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 180,
      onCell: () => evidenceCell(t('common.actions')),
      render: (_: unknown, record: Order) => {
        const orderLabel = orderDisplayLabel(record);
        const transitions = orderValidTransitions[record.status] || [];
        const allowedTransitions = transitions.filter((status) => canApplyOrderTransition(record, status));
        const statusUpdating = statusUpdatingIds.includes(record.id);
        const itemsActionLabel = `${t('pages.adminOrders.items')}: ${orderLabel}`;
        const changeStatusActionLabel = `${t('pages.adminOrders.changeStatus')}: ${orderLabel}`;
        const refundActionLabel = `${t('pages.adminOrders.refundNow')}: ${orderLabel}`;
        return (
          <Space wrap size={[6, 6]} className="order-management-page__actions">
            <Button size="small" aria-label={itemsActionLabel} title={itemsActionLabel} onClick={() => handleViewItems(record)}>
              {t('pages.adminOrders.items')}
            </Button>
            {transitions.length === 0 ? (
              <span className="order-management-page__completed">{t('common.completed')}</span>
            ) : allowedTransitions.length > 0 ? (
              <ShopSelect
                size="small"
                className="order-management-page__transitionSelect" popupClassName="shop-mobile-popup-layer"
                loading={statusUpdating}
                disabled={statusUpdating || orderActionDisabled}
                placeholder={t('pages.adminOrders.changeStatus')}
                ariaLabel={changeStatusActionLabel}
                title={changeStatusActionLabel}
                onChange={(val) => {
                  if (!val) return;
                  if (val === 'SHIPPED') {
                    setShippingOrder(record);
                    setTrackingNumber(record.trackingNumber || '');
                    setTrackingCarrierCode(record.trackingCarrierCode);
                    return;
                  }
                  confirmStatusChange(record, val);
                }}
                options={allowedTransitions.map((s) => ({
                  value: s,
                  label: transitionLabel(record.status, s),
                }))}
              />
            ) : null}
            {canRefundOrders && canRefundOrder(record) ? (
              <Button size="small" danger disabled={orderActionDisabled} aria-label={refundActionLabel} title={refundActionLabel} onClick={() => openRefundModal(record)}>
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
      {orderLoadError && orderSnapshotLoaded ? (
        <Alert
          className="order-management-page__alert"
          type="warning"
          showIcon
          message={orderLoadError}
          description={t('pages.adminOrders.staleDataWarning')}
          action={(
            <Space wrap data-admin-orders-stale-recovery="true">
              <Button
                size="small"
                type="primary"
                onClick={() => fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size })}
                loading={loading}
              >
                {t('common.retry')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin')}>
                {t('pages.adminDashboard.title')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin/system')}>
                {t('pages.adminDashboard.paymentReturnOps.providerReadinessAction')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin/support')}>
                {t('adminLayout.support')}
              </Button>
            </Space>
          )}
        />
      ) : null}

      {orderLoadError && !orderSnapshotLoaded ? (
        <div className="order-management-page__error" data-admin-orders-load-recovery="true">
          <PageError
            title={t('pages.adminOrders.fetchFailed')}
            description={orderLoadError}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: () => {
                  void fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page: orderPage.page, size: orderPage.size });
                },
                type: 'primary',
              },
              {
                key: 'dashboard',
                label: t('pages.adminDashboard.title'),
                onClick: () => navigate('/admin'),
                type: 'default',
              },
              {
                key: 'system',
                label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'),
                onClick: () => navigate('/admin/system'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('adminLayout.support'),
                onClick: () => navigate('/admin/support'),
                type: 'default',
              },
            ]}
          />
        </div>
      ) : null}

      {showInitialOrderLoading ? (
        <Card
          className="order-management-page__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderOrderSnapshot ? (
        <>
          <div className="order-management-page__summaryGrid">
            {orderSummaryCards.map((item) => (
              <button
                key={item.key}
                type="button"
                className={quickFilter === item.filter ? 'order-management-page__summaryCard order-management-page__summaryCard--active' : 'order-management-page__summaryCard'}
                aria-pressed={quickFilter === item.filter}
                aria-label={`${item.label}: ${item.value}`}
                title={`${item.label}: ${item.value}`}
                disabled={orderActionDisabled}
                onClick={() => handleQuickFilterChange(item.filter)}
              >
                <span>{item.label}</span>
                <strong style={{ color: item.color }}>{item.value}</strong>
              </button>
            ))}
          </div>
          {showAfterSalesQueueHint ? (
            <div className="order-management-page__afterSalesPanel">
              <Alert
                className="order-management-page__alert order-management-page__afterSalesHint"
                type="info"
                showIcon
                message={t('pages.adminOrders.afterSalesQueueHint')}
                description={t('pages.adminOrders.afterSalesQueuePriorityHint')}
              />
              <div className="order-management-page__afterSalesBreakdown" role="group" aria-label={t('pages.adminOrders.afterSalesBreakdownLabel')}>
                {afterSalesBreakdown.map((item) => {
                  const active = quickFilter === item.filter || filterStatus === item.filter;
                  const label = `${item.label}: ${item.value}`;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={active
                        ? 'order-management-page__afterSalesChip order-management-page__afterSalesChip--active'
                        : 'order-management-page__afterSalesChip'}
                      aria-pressed={active}
                      aria-label={label}
                      title={label}
                      disabled={orderActionDisabled}
                      onClick={() => handleQuickFilterChange(item.filter)}
                    >
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <Card className="order-management-page__toolbar">
            <Space wrap>
              <span>{t('pages.adminOrders.filter')}</span>
              <div role="group" aria-label={orderStatusFilterLabel} title={orderStatusFilterLabel}>
                <ShopSelect
                  allowClear
                  placeholder={t('pages.adminOrders.allStatus')}
                  className="order-management-page__statusFilter" popupClassName="shop-mobile-popup-layer"
                  value={filterStatus}
                  onChange={(value) => { if (value) handleStatusFilterChange(value); }}
                  disabled={orderActionDisabled}
                  options={[
                    { value: 'PENDING_PAYMENT', label: t('status.PENDING_PAYMENT') },
                    { value: 'PENDING_SHIPMENT', label: t('status.PENDING_SHIPMENT') },
                    { value: 'SHIPPED', label: t('status.SHIPPED') },
                    { value: 'COMPLETED', label: t('status.COMPLETED') },
                    { value: 'RETURN_REQUESTED', label: t('status.RETURN_REQUESTED') },
                    { value: 'RETURN_APPROVED', label: t('status.RETURN_APPROVED') },
                    { value: 'RETURN_SHIPPED', label: t('status.RETURN_SHIPPED') },
                    { value: 'RETURN_REFUNDING', label: t('status.RETURN_REFUNDING') },
                    { value: 'RETURNED', label: t('status.RETURNED') },
                    { value: 'REFUNDED', label: t('status.REFUNDED') },
                    { value: 'CANCELLED', label: t('status.CANCELLED') },
                  ]}
                />
              </div>
              <ShopSearchField
                allowClear
                value={searchText}
                maxLength={120}
                onChange={(value) => setSearchText(value.slice(0, 120))}
                onSearch={(value) => setSearchText(value.slice(0, 120))}
                placeholder={t('pages.adminOrders.searchPlaceholder')}
                className="order-management-page__searchInput"
                disabled={orderActionDisabled}
                ariaLabel={orderSearchInputLabel}
                title={orderSearchInputLabel}
                submitLabel={orderSearchInputLabel}
              />
              {canExportOrders ? (
                <Button icon={<DownloadOutlined />} loading={exporting} disabled={orderActionDisabled} aria-label={exportOrdersActionLabel} title={exportOrdersActionLabel} onClick={handleExport}>
                  {quickFilter || normalizedSearchText ? t('pages.adminOrders.exportVisibleOrders') : t('pages.adminOrders.exportOrders')}
                </Button>
              ) : null}
              {canFulfillOrders ? (
                <Button
                  type="primary"
                  disabled={orderActionDisabled || selectedVisibleShippableIds.length === 0}
                  aria-label={batchShipActionLabel}
                  title={batchShipActionLabel}
                  onClick={() => setBatchShipOpen(true)}
                >
                  {t('pages.adminOrders.batchShip')}
                </Button>
              ) : null}
              {activeQuickFilterLabel ? (
                <Tag
                  closable={!orderActionDisabled}
                  color="orange"
                  onClose={(event) => {
                    event.preventDefault();
                    if (!orderActionDisabled) {
                      handleQuickFilterChange();
                    }
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
              className="shop-admin-selection-table order-management-page__mobileCardTable"
              columns={columns}
              dataSource={displayOrders}
              rowKey="id"
              rowSelection={canFulfillOrders ? {
                columnWidth: 56,
                columnTitle: (checkboxNode) => labelTableSelectionCheckbox(checkboxNode, selectAllVisibleOrdersLabel),
                selectedRowKeys: selectedOrderIds,
                onChange: setSelectedOrderIds,
                getCheckboxProps: (record) => ({
                  disabled: orderActionDisabled || !isOrderShippable(record),
                  'aria-label': t('pages.adminOrders.selectOrderRow', { order: orderDisplayLabel(record) }),
                  title: t('pages.adminOrders.selectOrderRow', { order: orderDisplayLabel(record) }),
                }),
              } : undefined}
              loading={loading}
              pagination={{
                current: orderPage.page,
                pageSize: orderPage.size,
                total: orderPage.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total) => t('pages.adminOrders.total', { count: total }),
                itemRender: orderPaginationItemRender,
                onChange: (page, size) => fetchOrders({ status: filterStatus, quick: quickFilter, search: debouncedSearchText, page, size }),
              }}
              bordered
              size="middle"
              scroll={{ x: 1500 }}
              tableLayout="fixed"
            />
          </div>
        </>
      ) : null}
      <ShopModal
        title={t('pages.adminOrders.enterTracking')}
        open={!!shippingOrder}
        className="profile-mobile-safe-modal order-management-page__shippingModal"
        confirmLoading={shipping}
        okText={t('pages.adminOrders.enterTracking')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !canFulfillOrders || orderActionDisabled, 'aria-label': shippingSubmitActionLabel, title: shippingSubmitActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${shippingSubmitActionLabel}`, title: `${t('common.cancel')}: ${shippingSubmitActionLabel}` }}
        onOk={handleShip}
        onClose={closeShippingModal}
      >
        <Space direction="vertical" className="order-management-page__modalStack">
          <ShopSelect
            allowClear
            showSearch
            value={trackingCarrierCode}
            onChange={setTrackingCarrierCode}
            disabled={orderActionDisabled}
            placeholder={t('pages.adminOrders.selectCarrier')}
            options={carrierOptions}
            className="order-management-page__carrierSelect"
            popupClassName="shop-mobile-popup-layer order-management-page__carrierPopup"
            ariaLabel={shippingCarrierSelectLabel}
            title={shippingCarrierSelectLabel}
          />
          <ShopInput
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={orderActionDisabled}
            placeholder={t('pages.adminOrders.tracking')}
            maxLength={100}
            aria-label={shippingTrackingInputLabel}
            title={shippingTrackingInputLabel}
          />
          <Checkbox checked={autoPrintLabel} disabled={orderActionDisabled} aria-label={autoPrintLabelActionLabel} title={autoPrintLabelActionLabel} onChange={(e) => setAutoPrintLabel(e.target.checked)}>
            {t('pages.adminOrders.autoPrintLabel')}
          </Checkbox>
        </Space>
      </ShopModal>
      <ShopModal
        title={t('pages.adminOrders.refundNow')}
        open={!!refundOrder}
        className="profile-mobile-safe-modal order-management-page__refundModal"
        confirmLoading={refunding}
        okText={t('pages.adminOrders.refundNow')}
        okButtonProps={{
          danger: true,
          disabled: !canRefundOrders || orderActionDisabled || refundPaymentsLoading || !refundReason.trim() || !refundConfirmed || (hasLoadedRefundPayments && !hasRefundablePayment),
          'aria-label': refundSubmitActionLabel,
          title: refundSubmitActionLabel,
        }}
        cancelText={t('common.cancel')}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${refundSubmitActionLabel}`, title: `${t('common.cancel')}: ${refundSubmitActionLabel}` }}
        onOk={handleRefundOrder}
        onClose={closeRefundModal}
      >
        <Space direction="vertical" className="order-management-page__modalStack">
          <Typography.Text type="secondary">
            {t('pages.adminOrders.refundConfirmHint', {
              orderNo: refundOrder?.orderNo || refundOrder?.id || '',
              amount: refundOrder ? formatMoney(refundOrder.totalAmount) : '',
            })}
          </Typography.Text>
          <ShopTextArea
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            disabled={orderActionDisabled}
            placeholder={t('pages.adminOrders.refundReasonPlaceholder')}
            maxLength={500}
            showCount
            rows={4}
            status={!refundReason.trim() ? 'error' : ''}
            aria-label={refundReasonInputLabel}
            title={refundReasonInputLabel}
          />
          <div className="order-management-page__refundReasonPresets" role="group" aria-label={t('pages.adminOrders.refundReasonPresetsLabel')}>
            <Typography.Text type="secondary">{t('pages.adminOrders.refundReasonPresetsLabel')}</Typography.Text>
            <Space wrap size={[8, 8]}>
              {REFUND_REASON_PRESET_KEYS.map((presetKey) => {
                const presetLabel = t(`pages.adminOrders.refundReasonPresets.${presetKey}`);
                const selected = refundReason.trim() === presetLabel;
                const presetActionLabel = `${t('pages.adminOrders.refundReasonPresetsLabel')}: ${presetLabel}`;
                return (
                  <Button
                    key={presetKey}
                    size="small"
                    type={selected ? 'primary' : 'default'}
                    disabled={orderActionDisabled}
                    aria-label={presetActionLabel}
                    title={presetActionLabel}
                    aria-pressed={selected}
                    onClick={() => setRefundReason(presetLabel)}
                  >
                    {presetLabel}
                  </Button>
                );
              })}
            </Space>
          </div>
          <Checkbox
            checked={refundConfirmed}
            disabled={orderActionDisabled}
            aria-label={t('pages.adminOrders.refundConfirmAcknowledge', {
              orderNo: refundOrder?.orderNo || refundOrder?.id || '',
              amount: refundOrder ? formatMoney(refundOrder.totalAmount) : '',
            })}
            onChange={(event) => setRefundConfirmed(event.target.checked)}
          >
            {t('pages.adminOrders.refundConfirmAcknowledge', {
              orderNo: refundOrder?.orderNo || refundOrder?.id || '',
              amount: refundOrder ? formatMoney(refundOrder.totalAmount) : '',
            })}
          </Checkbox>
          <ShopInput
            value={manualRefundReference}
            onChange={(event) => setManualRefundReference(event.target.value)}
            disabled={orderActionDisabled}
            placeholder={t('pages.adminOrders.manualRefundReferencePlaceholder')}
            maxLength={128}
            allowClear
            aria-label={manualRefundReferenceInputLabel}
            title={manualRefundReferenceInputLabel}
          />
          <Checkbox checked={refundRestockChecked} disabled={refundRestockRequired || orderActionDisabled} aria-label={refundRestockActionLabel} title={refundRestockActionLabel} onChange={(event) => setRefundRestock(event.target.checked)}>
            {t('pages.adminOrders.restockRefundItems')}
          </Checkbox>
          {refundRestockRequired ? (
            <Alert
              type="info"
              showIcon
              message={`${refundRestockStatusLabel}: ${t('pages.adminOrders.restockRefundItems')}`}
            />
          ) : null}
          {hasLoadedRefundPayments && refundAlreadyProcessing ? (
            <Alert
              type="warning"
              showIcon
              role="alert"
              aria-live="assertive"
              message={t('pages.adminOrders.refundProcessingHint')}
            />
          ) : null}
          {hasLoadedRefundPayments && !refundAlreadyProcessing && hasReconcileRequiredRefundPayment ? (
            <Alert
              type="warning"
              showIcon
              role="alert"
              aria-live="assertive"
              message={t('pages.adminOrders.refundReconcileRequiredHint')}
            />
          ) : null}
          {hasLoadedRefundPayments && !refundAlreadyProcessing && !hasPaidRefundPayment && !hasReconcileRequiredRefundPayment ? (
            <Alert
              type="error"
              showIcon
              role="alert"
              aria-live="assertive"
              message={t('pages.adminOrders.noPaidPaymentForRefund')}
            />
          ) : null}
          {!canSyncOrderPayments ? (
            <Alert
              type="warning"
              showIcon
              message={t('pages.adminOrders.refundPaymentPermissionHint')}
            />
          ) : null}
          {canSyncOrderPayments ? (
            <div className="order-management-page__modalEvidenceSection">
              <Typography.Text strong>{t('pages.adminOrders.refundPaymentEvidence')}</Typography.Text>
              <Table
                className="order-management-page__modalEvidenceTable"
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
                    onCell: () => evidenceCell(t('pages.adminOrders.paymentMethod')),
                    render: (channel: string) => paymentMethodLabel(channel, t),
                  },
                  {
                    title: t('common.status'),
                    dataIndex: 'status',
                    key: 'status',
                    width: 104,
                    onCell: () => evidenceCell(t('common.status')),
                    render: (status: string) => <Tag color={getPaymentStatusColor(status)}>{formatPaymentStatusLabel(status)}</Tag>,
                  },
                  {
                    title: t('common.amount'),
                    dataIndex: 'amount',
                    key: 'amount',
                    width: 112,
                    onCell: () => evidenceCell(t('common.amount')),
                    render: (value: number) => <span className="commerce-money">{formatMoney(value)}</span>,
                  },
                  {
                    title: t('pages.adminOrders.refundReference'),
                    dataIndex: 'refundReference',
                    key: 'refundReference',
                    onCell: () => evidenceCell(t('pages.adminOrders.refundReference')),
                    render: (value: string) => value || '-',
                  },
                  {
                    title: t('common.actions'),
                    key: 'actions',
                    width: 120,
                    onCell: () => evidenceCell(t('common.actions')),
                    render: (_: unknown, payment: AdminPayment) => {
                      const syncActionLabel = `${t('pages.adminOrders.syncPayment')}: ${paymentDisplayLabel(payment)}`;
                      return (
                        <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                          title={t('pages.adminOrders.syncPaymentConfirm', { id: payment.id })}
                          onConfirm={() => handleSyncPayment(payment, 'refund')}
                          okText={t('pages.adminOrders.syncPayment')}
                          cancelText={t('common.cancel')}
                          okButtonProps={{ disabled: orderActionDisabled, 'aria-label': syncActionLabel, title: syncActionLabel }}
                          cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${syncActionLabel}`, title: `${t('common.cancel')}: ${syncActionLabel}` }}
                          disabled={orderActionDisabled || payment.status !== 'PENDING' || syncingPaymentIds.includes(payment.id)}
                        >
                          <Button
                            size="small"
                            type="link"
                            aria-label={syncActionLabel}
                            title={syncActionLabel}
                            loading={syncingPaymentIds.includes(payment.id)}
                            disabled={orderActionDisabled || payment.status !== 'PENDING'}
                          >
                            {t('pages.adminOrders.syncPayment')}
                          </Button>
                        </ShopPopconfirm>
                      );
                    },
                  },
                ]}
              />
            </div>
          ) : null}
        </Space>
      </ShopModal>
      <ShopModal
        title={t('pages.adminOrders.batchShipOrders')}
        open={batchShipOpen}
        className="profile-mobile-safe-modal order-management-page__batchShipModal"
        confirmLoading={batchShipping}
        okText={t('pages.adminOrders.batchShip')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !canFulfillOrders || orderActionDisabled || selectedVisibleShippableIds.length === 0, 'aria-label': batchShipSubmitActionLabel, title: batchShipSubmitActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchShipSubmitActionLabel}`, title: `${t('common.cancel')}: ${batchShipSubmitActionLabel}` }}
        onOk={handleBatchShip}
        onClose={closeBatchShipModal}
      >
        <p>{t('pages.adminOrders.batchShipHint')}</p>
        <ShopInput
          value={batchTrackingPrefix}
          onChange={(e) => setBatchTrackingPrefix(e.target.value)}
          disabled={orderActionDisabled}
          placeholder={t('pages.adminOrders.trackingPrefix')}
          maxLength={40}
          aria-label={batchTrackingPrefixInputLabel}
          title={batchTrackingPrefixInputLabel}
        />
        <ShopSelect
          allowClear
          showSearch
          value={batchTrackingCarrierCode}
          onChange={setBatchTrackingCarrierCode}
          disabled={orderActionDisabled}
          placeholder={t('pages.adminOrders.selectCarrier')}
          options={carrierOptions}
          className="order-management-page__carrierSelect order-management-page__batchCarrierSelect"
          popupClassName="shop-mobile-popup-layer order-management-page__carrierPopup"
          ariaLabel={batchCarrierSelectLabel}
          title={batchCarrierSelectLabel}
        />
      </ShopModal>
      <ShopModal
        title={t('pages.adminOrders.logisticsTracking')}
        open={trackingOpen}
        onClose={closeTrackingModal}
        footer={null}
        width={720}
        className="profile-mobile-safe-modal order-management-page__trackingModal"
      >
        <SeventeenTrackWidget trackingNumber={selectedTrackingNumber} carrierCode={selectedTrackingCarrierCode} orderId={selectedTrackingOrderId} />
      </ShopModal>
      <ShopModal
        title={t('pages.adminOrders.orderItemsTitle', { id: detailOrder?.orderNo || detailOrder?.id || '' })}
        open={!!detailOrder}
        onClose={closeDetailModal}
        footer={null}
        width={720}
        className="profile-mobile-safe-modal order-management-page__detailModal"
      >
        <Space direction="vertical" className="order-management-page__detailStack" size="middle">
          <div className="order-management-page__modalEvidenceSection">
            <Table
              className="order-management-page__modalEvidenceTable"
              rowKey="id"
              loading={itemsLoading}
              dataSource={orderItems}
              pagination={false}
              size="small"
              columns={[
                { title: t('common.id'), dataIndex: 'productId', key: 'productId', width: 90, onCell: () => evidenceCell(t('common.id')) },
                {
                  title: t('pages.adminOrders.product'),
                  dataIndex: 'productName',
                  key: 'productName',
                  onCell: () => evidenceCell(t('pages.adminOrders.product')),
                  render: (v: string, item: OrderItem) => (
                    <Space direction="vertical" size={0}>
                      <span>{v || `#${item.productId}`}</span>
                      {item.selectedSpecs ? <Typography.Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</Typography.Text> : null}
                    </Space>
                  ),
                },
                { title: t('common.quantity'), dataIndex: 'quantity', key: 'quantity', width: 100, onCell: () => evidenceCell(t('common.quantity')) },
                {
                  title: t('common.amount'),
                  dataIndex: 'price',
                  key: 'price',
                  width: 120,
                  onCell: () => evidenceCell(t('common.amount')),
                  render: (v: number) => <span className="commerce-money">{formatMoney(v)}</span>,
                },
                {
                  title: t('common.subtotal'),
                  key: 'subtotal',
                  width: 120,
                  onCell: () => evidenceCell(t('common.subtotal')),
                  render: (_: unknown, item: OrderItem) => <span className="commerce-money">{formatMoney(item.price * item.quantity)}</span>,
                },
              ]}
            />
          </div>
          {canSyncOrderPayments ? (
            <div className="order-management-page__modalEvidenceSection">
              <Typography.Text strong>{t('pages.adminOrders.paymentHistory')}</Typography.Text>
              <Table
                className="order-management-page__modalEvidenceTable"
                rowKey="id"
                loading={paymentsLoading}
                dataSource={orderPayments}
                pagination={false}
                size="small"
                columns={[
                  { title: t('pages.adminOrders.paymentMethod'), dataIndex: 'channel', key: 'channel', width: 120, onCell: () => evidenceCell(t('pages.adminOrders.paymentMethod')) },
                  {
                    title: t('common.status'),
                    dataIndex: 'status',
                    key: 'status',
                    width: 110,
                    onCell: () => evidenceCell(t('common.status')),
                    render: (status: string) => <Tag color={getPaymentStatusColor(status)}>{formatPaymentStatusLabel(status)}</Tag>,
                  },
                  {
                    title: t('common.amount'),
                    dataIndex: 'amount',
                    key: 'amount',
                    width: 120,
                    onCell: () => evidenceCell(t('common.amount')),
                    render: (value: number) => <span className="commerce-money">{formatMoney(value)}</span>,
                  },
                  {
                    title: t('pages.adminOrders.refundReference'),
                    dataIndex: 'refundReference',
                    key: 'refundReference',
                    onCell: () => evidenceCell(t('pages.adminOrders.refundReference')),
                    render: (value: string) => value || '-',
                  },
                  {
                    title: t('pages.adminOrders.createdAt'),
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    width: 145,
                    onCell: () => evidenceCell(t('pages.adminOrders.createdAt')),
                    render: (value: string) => value ? new Date(value).toLocaleString(dateLocale) : '-',
                  },
                  {
                    title: t('common.actions'),
                    key: 'actions',
                    width: 120,
                    onCell: () => evidenceCell(t('common.actions')),
                    render: (_: unknown, payment: AdminPayment) => {
                      const syncActionLabel = `${t('pages.adminOrders.syncPayment')}: ${paymentDisplayLabel(payment)}`;
                      return (
                        <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                          title={t('pages.adminOrders.syncPaymentConfirm', { id: payment.id })}
                          onConfirm={() => handleSyncPayment(payment, 'detail')}
                          okText={t('pages.adminOrders.syncPayment')}
                          cancelText={t('common.cancel')}
                          okButtonProps={{ disabled: orderActionDisabled, 'aria-label': syncActionLabel, title: syncActionLabel }}
                          cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${syncActionLabel}`, title: `${t('common.cancel')}: ${syncActionLabel}` }}
                          disabled={orderActionDisabled || payment.status !== 'PENDING' || syncingPaymentIds.includes(payment.id)}
                        >
                          <Button
                            size="small"
                            type="link"
                            aria-label={syncActionLabel}
                            title={syncActionLabel}
                            loading={syncingPaymentIds.includes(payment.id)}
                            disabled={orderActionDisabled || payment.status !== 'PENDING'}
                          >
                            {t('pages.adminOrders.syncPayment')}
                          </Button>
                        </ShopPopconfirm>
                      );
                    },
                  },
                ]}
              />
            </div>
          ) : null}
        </Space>
      </ShopModal>
      <ShopConfirm
        open={Boolean(statusConfirm)}
        title={statusConfirm?.title || ''}
        description={statusConfirm?.description}
        okText={statusConfirm?.okText || t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={statusConfirmLoading}
        okButtonProps={{
          danger: statusConfirm?.danger,
          'aria-label': statusConfirm?.actionLabel,
          title: statusConfirm?.actionLabel,
        }}
        cancelButtonProps={{
          'aria-label': statusConfirm ? `${t('common.cancel')}: ${statusConfirm.actionLabel}` : t('common.cancel'),
          title: statusConfirm ? `${t('common.cancel')}: ${statusConfirm.actionLabel}` : t('common.cancel'),
        }}
        className="profile-mobile-safe-modal order-management-page__statusConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={submitStatusConfirm}
        onCancel={closeStatusConfirm}
      />
    </div>
  );
};

export default OrderManagement;
