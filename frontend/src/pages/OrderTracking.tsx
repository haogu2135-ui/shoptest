import React, { useState } from 'react';
import { Button, Card, Descriptions, Empty, Form, Input, List, Space, Tag, Typography, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { apiBaseUrl, orderApi } from '../api';
import type { Order, OrderItem } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import './OrderTracking.css';

const { Text, Title } = Typography;
const orderTrackingImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveOrderTrackingImage = (imageUrl?: string) => {
  if (!imageUrl) return orderTrackingImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const statusColor: Record<string, string> = {
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

const OrderTracking: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

  const onFinish = async (values: { orderNo: string; email: string }) => {
    setLoading(true);
    try {
      const res = await orderApi.track(values.orderNo.trim(), values.email.trim());
      setOrder(res.data.order);
      setItems(res.data.items || []);
    } catch (error: any) {
      setOrder(null);
      setItems([]);
      message.error(error?.response?.data?.error || t('pages.orderTracking.notFound'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-tracking-page">
      <Title level={2}>{t('pages.orderTracking.title')}</Title>
      <Card style={{ marginBottom: 16 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="orderNo" label={t('pages.orderTracking.orderNo')} rules={[{ required: true, message: t('pages.orderTracking.orderNoRequired') }]}>
            <Input placeholder="SO202605..." autoComplete="off" />
          </Form.Item>
          <Form.Item name="email" label={t('pages.orderTracking.email')} rules={[{ required: true, message: t('pages.orderTracking.emailRequired') }, { type: 'email', message: t('pages.auth.emailInvalid') }]}>
            <Input placeholder="you@example.com" autoComplete="email" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
            {t('pages.orderTracking.search')}
          </Button>
        </Form>
      </Card>

      {!order ? (
        <Empty description={t('pages.orderTracking.empty')} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card title={t('pages.orderTracking.summary')}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('pages.orderTracking.orderNo')}>{order.orderNo || order.id}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={statusColor[order.status] || 'default'}>{t(`status.${order.status}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('common.amount')}>
                <Text strong className="order-tracking-page__amount">{formatMoney(order.totalAmount)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>
                {order.paymentMethod ? paymentMethodLabel(order.paymentMethod, t) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.address')}>{order.shippingAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.orderTracking.createdAt')}>
                {order.createdAt ? new Date(order.createdAt).toLocaleString(dateLocale) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.orderTracking.trackingNumber')}>
                {order.trackingNumber || t('pages.orderTracking.notShipped')}
              </Descriptions.Item>
              {order.trackingCarrierName ? (
                <Descriptions.Item label={t('pages.orderTracking.carrier')}>
                  {order.trackingCarrierName}
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </Card>

          <Card title={t('pages.profile.orderItems')}>
            <List
              dataSource={items}
              locale={{ emptyText: t('pages.profile.noOrderItems') }}
              renderItem={(item) => (
                <List.Item className="order-tracking-page__item">
                  <List.Item.Meta
                    avatar={
                      <img
                        src={resolveOrderTrackingImage(item.imageUrl)}
                        alt={item.productName}
                        className="order-tracking-page__image"
                        onError={(event) => {
                          if (event.currentTarget.src !== orderTrackingImageFallback) {
                            event.currentTarget.src = orderTrackingImageFallback;
                          }
                        }}
                      />
                    }
                    title={item.productName || t('pages.profile.productFallback', { id: item.productId })}
                    description={
                      <Space direction="vertical" size={0}>
                        {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                        <Text type="secondary">{formatMoney(item.price)} x {item.quantity}</Text>
                      </Space>
                    }
                  />
                  <Text strong className="order-tracking-page__itemTotal">{formatMoney(item.price * item.quantity)}</Text>
                </List.Item>
              )}
            />
          </Card>

          <Card title={t('pages.orderTracking.logistics')}>
            {order.trackingNumber ? (
              <SeventeenTrackWidget trackingNumber={order.trackingNumber} carrierCode={order.trackingCarrierCode} />
            ) : (
              <Empty description={t('pages.orderTracking.notShipped')} />
            )}
          </Card>
        </Space>
      )}
    </div>
  );
};

export default OrderTracking;
