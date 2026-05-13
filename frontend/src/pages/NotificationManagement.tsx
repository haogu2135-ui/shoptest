import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, message, Radio, Select, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, LinkOutlined, NotificationOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import { useLanguage } from '../i18n';
import { stripUnsafeHtml } from '../utils/sanitizeHtml';
import './NotificationManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const samplePromotionHtml = `<p><strong>Limited-time offer</strong>: free shipping on selected orders over $299.</p>
<p>Use coupon <strong>SHOPMX20</strong> for an extra discount.</p>
<p><a href="/coupons">Claim coupons now</a></p>`;

const NotificationManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const { t } = useLanguage();
  const contentFormat = Form.useWatch('contentFormat', form) || 'HTML';
  const notificationTitle = Form.useWatch('title', form) || '';
  const messageContent = Form.useWatch('message', form) || '';

  const previewHtml = useMemo(() => stripUnsafeHtml(messageContent), [messageContent]);
  const safePreviewHtml = useMemo(
    () => previewHtml || stripUnsafeHtml(`<p>${t('pages.notificationAdmin.richPreview')}</p>`),
    [previewHtml, t],
  );
  const plainContent = useMemo(() => messageContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), [messageContent]);
  const readinessSignals = useMemo(() => {
    const normalized = `${notificationTitle} ${plainContent}`.toLowerCase();
    const hasTitle = notificationTitle.trim().length >= 6 && notificationTitle.trim().length <= 80;
    const hasContent = plainContent.length >= 30;
    const hasLink = /href=|https?:\/\/|\/(products|coupons|cart|checkout)/i.test(messageContent);
    const hasConversionHook = /(coupon|discount|offer|shipping|birthday|limited|bundle|save|优惠|折扣|券|包邮|生日|限时|套装|ahorro|oferta|cupon|envio)/i.test(normalized);
    const readyCount = [hasTitle, hasContent, hasLink, hasConversionHook].filter(Boolean).length;
    return { hasTitle, hasContent, hasLink, hasConversionHook, readyCount };
  }, [messageContent, notificationTitle, plainContent]);

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setSending(true);
      const payload = {
        ...values,
        message: values.contentFormat === 'HTML' ? stripUnsafeHtml(values.message || '') : values.message,
      };
      const res = await adminApi.broadcastNotification(payload);
      message.success(t('pages.notificationAdmin.sent', { count: res.data.sent }));
      window.dispatchEvent(new Event('shop:notifications-updated'));
      form.resetFields();
      form.setFieldsValue({ type: 'PROMOTION', contentFormat: 'HTML' });
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.error || t('pages.notificationAdmin.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const insertSample = () => {
    form.setFieldsValue({
      type: 'PROMOTION',
      title: 'ShopMX limited-time offer',
      contentFormat: 'HTML',
      message: samplePromotionHtml,
    });
  };

  return (
    <div className="notification-management-page">
      <Space align="center">
        <NotificationOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>{t('pages.notificationAdmin.title')}</Title>
      </Space>
      <Divider />

      <section className="notification-readiness">
        <div className="notification-readiness__copy">
          <span>{t('pages.notificationAdmin.readinessEyebrow')}</span>
          <h2>{t('pages.notificationAdmin.readinessTitle')}</h2>
          <p>{t('pages.notificationAdmin.readinessSubtitle')}</p>
        </div>
        <div className="notification-readiness__score">
          <strong>{readinessSignals.readyCount}/4</strong>
          <span>{t('pages.notificationAdmin.readySignals')}</span>
        </div>
        <div className="notification-readiness__checks">
          <Tag color={readinessSignals.hasTitle ? 'green' : 'orange'} icon={<CheckCircleOutlined />}>
            {t('pages.notificationAdmin.checkTitle')}
          </Tag>
          <Tag color={readinessSignals.hasContent ? 'green' : 'orange'} icon={<NotificationOutlined />}>
            {t('pages.notificationAdmin.checkContent')}
          </Tag>
          <Tag color={readinessSignals.hasLink ? 'green' : 'orange'} icon={<LinkOutlined />}>
            {t('pages.notificationAdmin.checkLink')}
          </Tag>
          <Tag color={readinessSignals.hasConversionHook ? 'green' : 'orange'} icon={<ThunderboltOutlined />}>
            {t('pages.notificationAdmin.checkHook')}
          </Tag>
        </div>
      </section>

      <div className="notification-management-page__grid">
        <Card title={t('pages.notificationAdmin.compose')}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('pages.notificationAdmin.broadcastHint')}
          />
          <Form
            form={form}
            layout="vertical"
            initialValues={{ type: 'PROMOTION', contentFormat: 'HTML' }}
          >
            <Form.Item name="type" label={t('pages.notificationAdmin.type')} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'PROMOTION', label: t('status.PROMOTION') },
                  { value: 'SYSTEM', label: t('status.SYSTEM') },
                  { value: 'DELIVERY', label: t('status.DELIVERY') },
                  { value: 'ORDER', label: t('status.ORDER') },
                ]}
              />
            </Form.Item>
            <Form.Item name="title" label={t('pages.notificationAdmin.notificationTitle')} rules={[{ required: true, message: t('pages.notificationAdmin.titleRequired') }]}>
              <Input maxLength={100} showCount placeholder={t('pages.notificationAdmin.titlePlaceholder')} />
            </Form.Item>
            <Form.Item name="contentFormat" label={t('pages.notificationAdmin.contentFormat')}>
              <Radio.Group>
                <Radio.Button value="HTML">{t('pages.notificationAdmin.richText')}</Radio.Button>
                <Radio.Button value="TEXT">{t('pages.notificationAdmin.plainText')}</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="message" label={t('pages.notificationAdmin.content')} rules={[{ required: true, message: t('pages.notificationAdmin.contentRequired') }]}>
              <TextArea
                rows={10}
                placeholder={contentFormat === 'HTML' ? t('pages.notificationAdmin.htmlPlaceholder') : t('pages.notificationAdmin.textPlaceholder')}
              />
            </Form.Item>
            <Space wrap>
              <Button onClick={insertSample}>{t('pages.notificationAdmin.useSample')}</Button>
              <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={handleSend}>
                {t('pages.notificationAdmin.sendAll')}
              </Button>
            </Space>
          </Form>
        </Card>

        <Card title={t('pages.notificationAdmin.preview')}>
          <Text strong>{notificationTitle || t('pages.notificationAdmin.previewTitle')}</Text>
          <div className="notification-management-page__preview">
            {contentFormat === 'HTML' ? (
              <div className="notification-rich-content" dangerouslySetInnerHTML={{ __html: safePreviewHtml }} />
            ) : (
              <Text style={{ whiteSpace: 'pre-wrap' }}>{messageContent || t('pages.notificationAdmin.textPreview')}</Text>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NotificationManagement;
