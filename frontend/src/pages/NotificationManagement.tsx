import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Form } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopSegmented from '../components/ShopSegmented';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import { CheckCircleOutlined, LinkOutlined, NotificationOutlined, ReloadOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { adminApi } from '../api/admin';
import { useLanguage } from '../i18n';
import { stripUnsafeHtml } from '../utils/sanitizeHtml';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { dispatchDomEvent } from '../utils/domEvents';
import { getApiErrorMessage } from '../utils/apiError';
import { NOTIFICATIONS_BROADCAST_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './NotificationManagement.css';
import ShopButton from '../components/ShopButton';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import ShopSpace from '../components/ShopSpace';
import ShopTypography from '../components/ShopTypography';
import ShopCard from '../components/ShopCard';
import ShopDivider from '../components/ShopDivider';
import message from '../components/ShopMessage';
const Title = ShopTypography.Title;
const Text = ShopTypography.Text;

const conversionHookPattern = /(coupon|discount|offer|shipping|birthday|limited|bundle|save|\u4f18\u60e0|\u6298\u6263|\u5238|\u5305\u90ae|\u751f\u65e5|\u9650\u65f6|\u5957\u88c5|ahorro|oferta|cup[o\u00f3]n|env[i\u00ed]o)/i;
const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);
type PermissionStatus = 'loading' | 'ready' | 'error';

const NotificationManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('loading');
  const { t, language } = useLanguage();
  const notificationType = Form.useWatch('type', form) || 'PROMOTION';
  const contentFormat = Form.useWatch('contentFormat', form) || 'HTML';
  const notificationTitle = Form.useWatch('title', form) || '';
  const messageContent = Form.useWatch('message', form) || '';
  const canBroadcastNotifications = permissionStatus === 'ready'
    && hasAdminPermission(adminPermissions, currentRole, NOTIFICATIONS_BROADCAST_PERMISSION);

  const loadPermissions = useCallback(async () => {
    setPermissionStatus('loading');
    try {
      const response = await adminApi.getMyPermissions();
      setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
      setAdminPermissions(response.data.permissions || []);
      setPermissionStatus('ready');
    } catch (error) {
      reportNonBlockingError('NotificationManagement.loadPermissions', error);
      setCurrentRole('');
      setAdminPermissions([]);
      setPermissionStatus('error');
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    setPermissionStatus('loading');
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
        setPermissionStatus('ready');
      })
      .catch((error) => {
        if (disposed) return;
        reportNonBlockingError('NotificationManagement.loadPermissionsEffect', error);
        setCurrentRole('');
        setAdminPermissions([]);
        setPermissionStatus('error');
      });
    return () => {
      disposed = true;
    };
  }, []);

  const previewHtml = useMemo(() => stripUnsafeHtml(messageContent), [messageContent]);
  const safePreviewHtml = useMemo(
    () => previewHtml || stripUnsafeHtml(`<p>${t('pages.notificationAdmin.richPreview')}</p>`),
    [previewHtml, t],
  );
  const plainContent = useMemo(() => messageContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), [messageContent]);
  const notificationTargetLabel = notificationTitle.trim() || t('pages.notificationAdmin.title');
  const templateActionLabel = `${t('pages.notificationAdmin.useTemplate')}: ${t('pages.notificationAdmin.title')}`;
  const broadcastActionLabel = `${t('pages.notificationAdmin.sendAll')}: ${notificationTargetLabel}`;
  const notificationBroadcastSummary = `${t(`status.${notificationType}`)} / ${t('pages.notificationAdmin.contentFormat')}: ${contentFormat}`;
  const notificationTypeLabel = `${t('pages.notificationAdmin.type')}: ${t(`status.${notificationType}`)}`;
  const notificationTitleInputLabel = `${t('pages.notificationAdmin.notificationTitle')}: ${notificationTargetLabel}`;
  const notificationContentFormatLabel = `${t('pages.notificationAdmin.contentFormat')}: ${contentFormat}`;
  const notificationContentInputLabel = `${t('pages.notificationAdmin.content')}: ${notificationTargetLabel}`;
  const permissionGateActive = permissionStatus !== 'ready' || !canBroadcastNotifications;
  const permissionGateReason = permissionStatus === 'loading'
    ? t('pages.notificationAdmin.permissionLoading')
    : permissionStatus === 'error'
      ? t('pages.notificationAdmin.permissionLoadFailed')
      : t('pages.notificationAdmin.noBroadcastPermission');
  const readinessSignals = useMemo(() => {
    const normalized = `${notificationTitle} ${plainContent}`.toLowerCase();
    const hasTitle = notificationTitle.trim().length >= 6 && notificationTitle.trim().length <= 80;
    const hasContent = plainContent.length >= 30;
    const hasLink = /href=|https?:\/\/|\/(products|coupons|cart|checkout)/i.test(messageContent);
    const hasConversionHook = conversionHookPattern.test(normalized);
    const readyCount = [hasTitle, hasContent, hasLink, hasConversionHook].filter(Boolean).length;
    return { hasTitle, hasContent, hasLink, hasConversionHook, readyCount };
  }, [messageContent, notificationTitle, plainContent]);

  const handleSend = async () => {
    if (!canBroadcastNotifications) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setSending(true);
      const payload = {
        ...values,
        message: values.contentFormat === 'HTML' ? stripUnsafeHtml(values.message || '') : values.message,
      };
      const res = await adminApi.broadcastNotification(payload);
      message.success(t('pages.notificationAdmin.sent', { count: res.data.sent }));
      dispatchDomEvent('shop:notifications-updated');
      form.resetFields();
      form.setFieldsValue({ type: 'PROMOTION', contentFormat: 'HTML' });
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('pages.notificationAdmin.sendFailed'), language));
    } finally {
      setSending(false);
    }
  };

  const insertPromotionTemplate = () => {
    form.setFieldsValue({
      type: 'PROMOTION',
      title: t('pages.notificationAdmin.templateTitle'),
      contentFormat: 'HTML',
      message: t('pages.notificationAdmin.templateHtml'),
    });
  };

  return (
    <div className={`notification-management-page notification-management-page--${language}`}>
      <ShopSpace align="center">
        <NotificationOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>{t('pages.notificationAdmin.title')}</Title>
      </ShopSpace>
      <ShopDivider />

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
          <ShopTag color={readinessSignals.hasTitle ? 'green' : 'orange'} icon={<CheckCircleOutlined />}>
            {t('pages.notificationAdmin.checkTitle')}
          </ShopTag>
          <ShopTag color={readinessSignals.hasContent ? 'green' : 'orange'} icon={<NotificationOutlined />}>
            {t('pages.notificationAdmin.checkContent')}
          </ShopTag>
          <ShopTag color={readinessSignals.hasLink ? 'green' : 'orange'} icon={<LinkOutlined />}>
            {t('pages.notificationAdmin.checkLink')}
          </ShopTag>
          <ShopTag color={readinessSignals.hasConversionHook ? 'green' : 'orange'} icon={<ThunderboltOutlined />}>
            {t('pages.notificationAdmin.checkHook')}
          </ShopTag>
        </div>
      </section>

      <div className="notification-management-page__grid">
        <ShopCard title={t('pages.notificationAdmin.compose')}>
          {permissionStatus === 'loading' ? (
            <ShopAlert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('pages.notificationAdmin.permissionLoading')}
            />
          ) : null}
          {permissionStatus === 'error' ? (
            <ShopAlert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('pages.notificationAdmin.permissionLoadFailed')}
              action={(
                <ShopButton size="small" icon={<ReloadOutlined />} onClick={loadPermissions}>
                  {t('pages.notificationAdmin.permissionRetry')}
                </ShopButton>
              )}
            />
          ) : null}
          {permissionStatus === 'ready' && !canBroadcastNotifications ? (
            <ShopAlert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('pages.notificationAdmin.noBroadcastPermission')}
            />
          ) : null}
          <ShopAlert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('pages.notificationAdmin.broadcastHint')}
          />
          <Form
            form={form}
            layout="vertical"
            disabled={permissionGateActive}
            initialValues={{ type: 'PROMOTION', contentFormat: 'HTML' }}
          >
            <Form.Item name="type" label={t('pages.notificationAdmin.type')} rules={[{ required: true }]}>
              <ShopSelect popupClassName="shop-mobile-popup-layer"
                ariaLabel={notificationTypeLabel}
                title={notificationTypeLabel}
                options={[
                  { value: 'PROMOTION', label: t('status.PROMOTION') },
                  { value: 'SYSTEM', label: t('status.SYSTEM') },
                  { value: 'DELIVERY', label: t('status.DELIVERY') },
                  { value: 'ORDER', label: t('status.ORDER') },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="title"
              label={t('pages.notificationAdmin.notificationTitle')}
              rules={[
                { required: true, message: t('pages.notificationAdmin.titleRequired') },
                { max: 100, message: t('pages.notificationAdmin.titleRequired') },
              ]}
            >
              <ShopInput maxLength={100} showCount placeholder={t('pages.notificationAdmin.titlePlaceholder')} aria-label={notificationTitleInputLabel} title={notificationTitleInputLabel} />
            </Form.Item>
            <Form.Item name="contentFormat" label={t('pages.notificationAdmin.contentFormat')}>
              <ShopSegmented
                ariaLabel={notificationContentFormatLabel}
                title={notificationContentFormatLabel}
                options={[
                  { value: 'HTML', label: t('pages.notificationAdmin.richText') },
                  { value: 'TEXT', label: t('pages.notificationAdmin.plainText') },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="message"
              label={t('pages.notificationAdmin.content')}
              rules={[
                { required: true, message: t('pages.notificationAdmin.contentRequired') },
                { max: 5000, message: t('pages.notificationAdmin.contentRequired') },
              ]}
            >
              <ShopTextArea
                rows={10}
                maxLength={5000}
                showCount
                placeholder={contentFormat === 'HTML' ? t('pages.notificationAdmin.htmlPlaceholder') : t('pages.notificationAdmin.textPlaceholder')}
                aria-label={notificationContentInputLabel}
                title={notificationContentInputLabel}
              />
            </Form.Item>
            <ShopSpace wrap>
              <ShopButton aria-label={templateActionLabel} title={templateActionLabel} onClick={insertPromotionTemplate} disabled={permissionGateActive || sending}>{t('pages.notificationAdmin.useTemplate')}</ShopButton>
              {canBroadcastNotifications ? (
                <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                  title={broadcastActionLabel}
                  description={(
                    <ShopSpace direction="vertical" size={2}>
                      <Text>{notificationBroadcastSummary}</Text>
                      <Text type="secondary">{t('pages.notificationAdmin.sendAllConfirmDescription')}</Text>
                    </ShopSpace>
                  )}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': broadcastActionLabel, title: broadcastActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${broadcastActionLabel}`, title: `${t('common.cancel')}: ${broadcastActionLabel}` }}
                  onConfirm={handleSend}
                >
                  <ShopButton type="primary" icon={<SendOutlined />} aria-label={broadcastActionLabel} title={broadcastActionLabel} loading={sending}>
                    {t('pages.notificationAdmin.sendAll')}
                  </ShopButton>
                </ShopPopconfirm>
              ) : (
                <ShopButton
                  type="primary"
                  icon={<SendOutlined />}
                  aria-label={broadcastActionLabel}
                  title={permissionGateReason}
                  disabled
                >
                  {t('pages.notificationAdmin.sendAll')}
                </ShopButton>
              )}
            </ShopSpace>
          </Form>
        </ShopCard>

        <ShopCard title={t('pages.notificationAdmin.preview')}>
          <Text strong>{notificationTitle || t('pages.notificationAdmin.previewTitle')}</Text>
          <div className="notification-management-page__preview">
            {contentFormat === 'HTML' ? (
              <div className="notification-rich-content" dangerouslySetInnerHTML={{ __html: safePreviewHtml }} />
            ) : (
              <Text style={{ whiteSpace: 'pre-wrap' }}>{messageContent || t('pages.notificationAdmin.textPreview')}</Text>
            )}
          </div>
        </ShopCard>
      </div>
    </div>
  );
};

export default NotificationManagement;
