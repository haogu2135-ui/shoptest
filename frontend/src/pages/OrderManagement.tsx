import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Checkbox, Divider, Input, message, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { adminApi, logisticsCarrierApi, orderApi } from '../api';
import type { LogisticsCarrier, Order, OrderItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';

const { Title } = Typography;

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
};

const validTransitions: Record<string, string[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PENDING_SHIPMENT: ['SHIPPED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'COMPLETED'],
  RETURN_APPROVED: [],
  RETURN_SHIPPED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrierCode, setTrackingCarrierCode] = useState<string | undefined>();
  const [autoPrintLabel, setAutoPrintLabel] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<React.Key[]>([]);
  const [batchShipOpen, setBatchShipOpen] = useState(false);
  const [batchTrackingPrefix, setBatchTrackingPrefix] = useState('BATCH');
  const [batchTrackingCarrierCode, setBatchTrackingCarrierCode] = useState<string | undefined>();
  const [batchShipping, setBatchShipping] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState('');
  const [selectedTrackingCarrierCode, setSelectedTrackingCarrierCode] = useState<string | undefined>();
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const { formatMoney } = useMarket();

  const fetchOrders = useCallback(async (status?: string) => {
    try {
      setLoading(true);
      const res = await adminApi.getOrders(status);
      setOrders(res.data);
    } catch {
      message.error(t('pages.adminOrders.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOrders(filterStatus);
  }, [fetchOrders, filterStatus]);

  useEffect(() => {
    logisticsCarrierApi.getAll(true)
      .then((res) => setCarriers(res.data || []))
      .catch(() => setCarriers([]));
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      message.success(t('pages.adminOrders.statusUpdated'));
      fetchOrders(filterStatus);
    } catch (err: any) {
      const msg = err.response?.data?.error || t('messages.updateFailed');
      message.error(msg);
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

  const buildShippingLabelHtml = (order: Order, items: OrderItem[]) => {
    const itemRows = items.length
      ? items.map((item) => `
          <tr>
            <td>${escapeHtml(item.productName || `#${item.productId}`)}</td>
            <td>${escapeHtml(item.selectedSpecs ? formatSelectedSpecs(item.selectedSpecs, t) : '')}</td>
            <td class="qty">${escapeHtml(item.quantity)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="muted">No item data</td></tr>';

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Shipping Label ${escapeHtml(order.orderNo || order.id)}</title>
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
                <div class="title">SHIPPING LABEL</div>
                <div>Order: ${escapeHtml(order.orderNo || order.id)}</div>
              </div>
              <div class="carrier">
                <strong>${escapeHtml(order.trackingCarrierName || 'Carrier auto')}</strong><br />
                ${escapeHtml(order.trackingCarrierCode || '')}
              </div>
            </div>
            <div class="tracking">
              <div class="label-text">Tracking Number</div>
              <div class="tracking-number">${escapeHtml(order.trackingNumber || '-')}</div>
              <div class="barcode">*${escapeHtml(order.trackingNumber || order.orderNo || order.id)}*</div>
            </div>
            <div class="section">
              <div class="label-text">Ship To</div>
              <div class="address">${escapeHtml(order.shippingAddress || '-')}</div>
            </div>
            <div class="section meta">
              <div><div class="label-text">Payment</div>${escapeHtml(order.paymentMethod || '-')}</div>
              <div><div class="label-text">Created</div>${escapeHtml(order.createdAt ? new Date(order.createdAt).toLocaleString(dateLocale) : '-')}</div>
            </div>
            <div class="section">
              <div class="label-text">Items</div>
              <table>
                <thead><tr><th>Product</th><th>Specs</th><th class="qty">Qty</th></tr></thead>
                <tbody>${itemRows}</tbody>
              </table>
            </div>
            <div class="footer">Generated by Shop Admin</div>
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
      message.warning('浏览器阻止了打印窗口，请允许弹窗后重试');
      return;
    }

    let items: OrderItem[] = [];
    try {
      const res = await orderApi.getItems(order.id);
      items = res.data || [];
    } catch {
      items = [];
    }

    printWindow.document.open();
    printWindow.document.write(buildShippingLabelHtml(order, items));
    printWindow.document.close();
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
      fetchOrders(filterStatus);
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
    try {
      const res = await orderApi.getItems(order.id);
      setOrderItems(res.data);
    } catch {
      setOrderItems([]);
      message.error(t('messages.operationFailed'));
    } finally {
      setItemsLoading(false);
    }
  };

  const handleBatchShip = async () => {
    const shippableIds = orders
      .filter((order) => selectedOrderIds.includes(order.id) && order.status === 'PENDING_SHIPMENT')
      .map((order) => order.id);
    if (shippableIds.length === 0) {
      message.error(t('pages.adminOrders.selectPendingShipment'));
      return;
    }
    try {
      setBatchShipping(true);
      const res = await adminApi.batchShipOrders(shippableIds, batchTrackingPrefix.trim() || 'BATCH', batchTrackingCarrierCode);
      message.success(t('pages.adminOrders.batchShipResult', { success: res.data.success, failed: res.data.failed }));
      setBatchShipOpen(false);
      setSelectedOrderIds([]);
      fetchOrders(filterStatus);
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    } finally {
      setBatchShipping(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await adminApi.exportOrders(filterStatus);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders${filterStatus ? '-' + filterStatus : ''}.csv`;
      link.click();
      URL.revokeObjectURL(url);
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

  const columns = [
    { title: t('pages.adminOrders.orderId'), dataIndex: 'id', key: 'id', width: 80 },
    { title: t('common.userId'), dataIndex: 'userId', key: 'userId', width: 80 },
    {
      title: t('common.amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 110,
      render: (v: number) => <span style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => <Tag color={statusColors[s]}>{t(`status.${s}`)}</Tag>,
    },
    {
      title: t('pages.adminOrders.address'),
      dataIndex: 'shippingAddress',
      key: 'shippingAddress',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: t('pages.adminOrders.paymentMethod'),
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: t('pages.adminOrders.tracking'),
      dataIndex: 'trackingNumber',
      key: 'trackingNumber',
      width: 140,
      render: (v: string, record: Order) => v ? (
        <Space direction="vertical" size={0}>
          <span>{v}</span>
          {record.trackingCarrierName ? <Typography.Text type="secondary">{record.trackingCarrierName}</Typography.Text> : null}
          <Space size={8}>
            <Button size="small" type="link" style={{ padding: 0 }} onClick={() => handleTrackShipment(v, record.trackingCarrierCode)}>{t('pages.adminOrders.track')}</Button>
            <Button size="small" type="link" style={{ padding: 0 }} onClick={() => printShippingLabel(record)}>打印面单</Button>
          </Space>
        </Space>
      ) : '-',
    },
    {
      title: t('pages.adminOrders.returnTracking'),
      dataIndex: 'returnTrackingNumber',
      key: 'returnTrackingNumber',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: t('pages.adminOrders.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString(dateLocale) : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 230,
      render: (_: any, record: Order) => {
        const transitions = validTransitions[record.status] || [];
        return (
          <Space wrap>
            <Button size="small" onClick={() => handleViewItems(record)}>
              {t('pages.adminOrders.items')}
            </Button>
            {transitions.length === 0 ? (
              <span style={{ color: '#999' }}>{t('common.completed')}</span>
            ) : (
              <Select
                size="small"
                style={{ width: 130 }}
                placeholder={t('pages.adminOrders.changeStatus')}
                onChange={(val) => {
                  if (val === 'SHIPPED') {
                    setShippingOrder(record);
                    setTrackingNumber(record.trackingNumber || '');
                    setTrackingCarrierCode(record.trackingCarrierCode);
                    return;
                  }
                  handleStatusChange(record.id, val);
                }}
                options={transitions.map((s) => ({
                  value: s,
                  label: t(`status.${s}`),
                }))}
              />
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={4}>{t('pages.adminOrders.title')}</Title>
      <Divider />
      <Card style={{ marginBottom: 16 }}>
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
              { value: 'CANCELLED', label: t('status.CANCELLED') },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            {t('pages.adminOrders.exportOrders')}
          </Button>
          <Button
            type="primary"
            disabled={selectedOrderIds.length === 0}
            onClick={() => setBatchShipOpen(true)}
          >
            {t('pages.adminOrders.batchShip')}
          </Button>
        </Space>
      </Card>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedOrderIds,
          onChange: setSelectedOrderIds,
          getCheckboxProps: (record) => ({
            disabled: record.status !== 'PENDING_SHIPMENT',
          }),
        }}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => t('pages.adminOrders.total', { count: total }) }}
        bordered
        size="middle"
        scroll={{ x: 1180 }}
      />
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
            placeholder="选择快递公司"
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
            发货后自动打印面单
          </Checkbox>
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
          placeholder="选择快递公司"
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
        }}
        footer={null}
        width={720}
      >
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
      </Modal>
    </div>
  );
};

export default OrderManagement;
