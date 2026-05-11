import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, message, Radio, Select, Space, Typography } from 'antd';
import { NotificationOutlined, SendOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import { useLanguage } from '../i18n';

const { Title, Text } = Typography;
const { TextArea } = Input;

const stripUnsafeHtml = (html: string) => {
  const scriptProtocol = ['java', 'script:'].join('');
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith(scriptProtocol)) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
};

const samplePromotionHtml = `<p><strong>限时优惠</strong>：全场精选商品满 $299 包邮。</p>
<p>使用优惠券 <strong>SHOPMX20</strong> 可享额外折扣。</p>
<p><a href="/coupons">立即领取优惠券</a></p>`;

const NotificationManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const { t } = useLanguage();
  const contentFormat = Form.useWatch('contentFormat', form) || 'HTML';
  const messageContent = Form.useWatch('message', form) || '';

  const previewHtml = useMemo(() => stripUnsafeHtml(messageContent), [messageContent]);

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setSending(true);
      const res = await adminApi.broadcastNotification(values);
      message.success(t('pages.notificationAdmin.sent', { count: res.data.sent }));
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
      title: 'ShopMX 限时优惠',
      contentFormat: 'HTML',
      message: samplePromotionHtml,
    });
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <Space align="center">
        <NotificationOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>{t('pages.notificationAdmin.title')}</Title>
      </Space>
      <Divider />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(320px, 0.9fr)', gap: 24 }}>
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
            <Space>
              <Button onClick={insertSample}>{t('pages.notificationAdmin.useSample')}</Button>
              <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={handleSend}>
                {t('pages.notificationAdmin.sendAll')}
              </Button>
            </Space>
          </Form>
        </Card>

        <Card title={t('pages.notificationAdmin.preview')}>
          <Text strong>{form.getFieldValue('title') || t('pages.notificationAdmin.previewTitle')}</Text>
          <div style={{ marginTop: 12, padding: 16, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff' }}>
            {contentFormat === 'HTML' ? (
              <div className="notification-rich-content" dangerouslySetInnerHTML={{ __html: previewHtml || `<p>${t('pages.notificationAdmin.richPreview')}</p>` }} />
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
