import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Space, Tag, Typography, message } from 'antd';
import { CopyOutlined, CustomerServiceOutlined, GiftOutlined, ReloadOutlined, SearchOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { logisticsApi } from '../api';
import { useLanguage } from '../i18n';
import { getApiErrorDiagnosticText, getApiErrorMessage } from '../utils/apiError';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import type { LogisticsTrackResponse } from '../types';
import './SeventeenTrackWidget.css';

const localeByLanguage = {
  zh: 'zh-CN',
  es: 'es-MX',
  en: 'en-US',
} as const;

const statusColors: Record<string, string> = {
  DELIVERED: 'green',
  IN_TRANSIT: 'blue',
  PICKED_UP: 'cyan',
  DISPATCHING: 'gold',
  PROBLEM: 'red',
  RETURNED: 'volcano',
  RETURNING: 'orange',
  EXTERNAL_EMPTY: 'default',
  TRACKING_UNAVAILABLE: 'default',
  EXTERNAL: 'blue',
};

const formatEventTime = (value: string | undefined, locale: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : value;
};

const isProviderConfigurationError = (value: string) =>
  /not configured|provider.*configured|customer\/key/i.test(value);

type SeventeenTrackWidgetProps = {
  trackingNumber?: string;
  carrierCode?: string;
  orderId?: number;
  guestEmail?: string;
  orderNo?: string;
  height?: number;
};

const SeventeenTrackWidget: React.FC<SeventeenTrackWidgetProps> = ({
  trackingNumber = '',
  carrierCode,
  orderId,
  guestEmail,
  orderNo,
  height = 560,
}) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [value, setValue] = useState(trackingNumber);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LogisticsTrackResponse | null>(null);
  const [error, setError] = useState('');
  const requestSeq = useRef(0);
  const queryTrackingRef = useRef<(nextValue: string, silent?: boolean) => Promise<void>>(async () => undefined);
  const dateLocale = localeByLanguage[language] || localeByLanguage.en;
  const resultsMinHeight = Math.max(220, Math.min(height, 560));

  const queryTracking = useCallback(async (nextValue: string, silent = false) => {
    const num = nextValue.trim();
    if (!num) {
      message.warning(t('pages.adminOrders.noTrackingNumber'));
      return;
    }

    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setLoading(true);
    setError('');

    try {
      const response = await logisticsApi.track(num, carrierCode, orderId, guestEmail, orderNo);
      if (requestSeq.current !== requestId) return;
      setResult(response.data);
    } catch (err: unknown) {
      if (requestSeq.current !== requestId) return;
      const providerError = getApiErrorDiagnosticText(err);
      if (isProviderConfigurationError(providerError)) {
        setResult({
          trackingNumber: num,
          carrier: carrierCode,
          status: 'EXTERNAL_EMPTY',
          summary: t('pages.orderTracking.noTrackingData'),
          events: [],
        });
        setError('');
        return;
      }
      const localizedError = getApiErrorMessage(err, t('pages.orderTracking.trackingFailed'), language);
      setResult(null);
      setError(localizedError);
      if (!silent) {
        message.error(localizedError);
      }
    } finally {
      if (requestSeq.current === requestId) {
        setLoading(false);
      }
    }
  }, [carrierCode, guestEmail, language, orderId, orderNo, t]);

  useEffect(() => {
    queryTrackingRef.current = queryTracking;
  }, [queryTracking]);

  useEffect(() => {
    const normalized = trackingNumber.trim();
    setValue(normalized);
    setResult(null);
    setError('');
    if (normalized) {
      void queryTrackingRef.current(normalized, true);
    }
  }, [carrierCode, guestEmail, orderId, orderNo, trackingNumber]);

  const runTrack = () => {
    void queryTracking(value);
  };

  const events = result?.events || [];
  const status = result?.status || '';
  const trackingUnavailable = status === 'TRACKING_UNAVAILABLE';
  const externalEmpty = status === 'EXTERNAL_EMPTY';
  const activeTrackingNumber = value.trim() || result?.trackingNumber || trackingNumber.trim();
  const trackingContext = activeTrackingNumber || orderNo || t('pages.orderTracking.title');
  const trackingInputLabel = `${t('pages.orderTracking.trackingNumber')}: ${trackingContext}`;
  const trackActionLabel = `${t('pages.orderTracking.trackShipment')}: ${trackingContext}`;
  const trackingResultsLabel = `${t('pages.orderTracking.logistics')}: ${trackingContext}`;
  const needsEmptyRecovery = Boolean(error) || trackingUnavailable || externalEmpty || (result && events.length === 0) || !result;

  const copyTrackingNumber = async () => {
    if (!activeTrackingNumber) {
      message.warning(t('pages.adminOrders.noTrackingNumber'));
      return;
    }
    try {
      await navigator.clipboard.writeText(activeTrackingNumber);
      message.success(t('pages.orderTracking.trackingNumberCopied'));
    } catch (error) {
      reportNonBlockingError('SeventeenTrackWidget.copyTrackingNumber', error);
      message.error(t('pages.orderTracking.copyTrackingFailed'));
    }
  };

  const openSupport = () => {
    dispatchDomEvent('shop:open-support', {
      clearGuestContext: false,
      orderNo: orderNo || undefined,
      email: guestEmail || undefined,
    });
  };

  const recoveryActions = (
    <Space wrap className="seventeen-track-widget__recoveryActions" size={[8, 8]} data-seventeen-track-recovery="true">
      {activeTrackingNumber ? (
        <Button
          icon={<CopyOutlined />}
          onClick={() => { void copyTrackingNumber(); }}
          aria-label={`${t('pages.orderTracking.copyTrackingNumber')}: ${activeTrackingNumber}`}
          title={`${t('pages.orderTracking.copyTrackingNumber')}: ${activeTrackingNumber}`}
        >
          {t('pages.orderTracking.copyTrackingNumber')}
        </Button>
      ) : null}
      <Button
        icon={<ReloadOutlined />}
        loading={loading}
        onClick={runTrack}
        disabled={!value.trim() && !activeTrackingNumber}
        aria-label={`${t('pages.orderTracking.retryTracking')}: ${trackingContext}`}
        title={`${t('pages.orderTracking.retryTracking')}: ${trackingContext}`}
      >
        {t('pages.orderTracking.retryTracking')}
      </Button>
      <Button
        icon={<ShoppingOutlined />}
        onClick={() => navigate('/products')}
        aria-label={t('pages.orderTracking.shopAgain')}
        title={t('pages.orderTracking.shopAgain')}
      >
        {t('pages.orderTracking.shopAgain')}
      </Button>
      <Button
        icon={<GiftOutlined />}
        onClick={() => navigate('/coupons')}
        aria-label={t('pages.orderTracking.emptyCoupons')}
        title={t('pages.orderTracking.emptyCoupons')}
      >
        {t('pages.orderTracking.emptyCoupons')}
      </Button>
      <Button
        icon={<CustomerServiceOutlined />}
        onClick={openSupport}
        aria-label={t('pages.profile.contactSupport')}
        title={t('pages.profile.contactSupport')}
      >
        {t('pages.profile.contactSupport')}
      </Button>
    </Space>
  );

  return (
    <Space className="seventeen-track-widget" direction="vertical" size="middle">
      <Space.Compact className="seventeen-track-widget__search">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPressEnter={runTrack}
          placeholder={t('pages.orderTracking.trackingNumber')}
          aria-label={trackingInputLabel}
          title={trackingInputLabel}
          autoComplete="off"
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={loading}
          onClick={runTrack}
          aria-label={trackActionLabel}
          title={trackActionLabel}
        >
          {t('pages.adminOrders.track')}
        </Button>
      </Space.Compact>

      <div
        className="seventeen-track-widget__results"
        style={{ minHeight: resultsMinHeight }}
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && !result && !error ? (
          <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
        ) : error ? (
          <div className="seventeen-track-widget__recovery">
            <Alert
              className="seventeen-track-widget__alert"
              type="error"
              showIcon
              message={t('pages.orderTracking.trackingFailed')}
              description={error}
            />
            <Typography.Text type="secondary" className="seventeen-track-widget__recoveryHint">
              {t('pages.orderTracking.emptyRecoveryHint')}
            </Typography.Text>
            {recoveryActions}
          </div>
        ) : result ? (
          <div className="seventeen-track-widget__content">
            <div className="seventeen-track-widget__summary">
              <Space wrap size={[8, 8]}>
                <Tag color={statusColors[status] || 'default'}>{status || t('common.status')}</Tag>
                {result.carrier ? <Tag>{result.carrier}</Tag> : null}
                <Typography.Text strong>{result.trackingNumber}</Typography.Text>
              </Space>
              {result.summary ? (
                <Typography.Text type="secondary">{result.summary}</Typography.Text>
              ) : null}
            </div>
            {events.length > 0 ? (
              <div className="seventeen-track-widget__events" role="list" aria-label={trackingResultsLabel}>
                {events.map((event, index) => {
                  const eventDescription = event.description || t('pages.orderTracking.noTrackingData');
                  const eventMeta = [formatEventTime(event.time, dateLocale), event.location].filter(Boolean).join(' · ');
                  const eventLabel = eventMeta ? `${eventDescription} · ${eventMeta}` : eventDescription;
                  return (
                    <div
                      className="seventeen-track-widget__event"
                      key={`${event.time || 'event'}-${index}`}
                      role="listitem"
                      aria-label={eventLabel}
                    >
                      <span className="seventeen-track-widget__eventDot" aria-hidden="true" />
                      <div className="seventeen-track-widget__eventBody">
                        <Typography.Text strong>{eventDescription}</Typography.Text>
                        <Typography.Text type="secondary" className="seventeen-track-widget__eventMeta">
                          {eventMeta}
                        </Typography.Text>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : trackingUnavailable ? (
              <div className="seventeen-track-widget__recovery">
                <Alert
                  className="seventeen-track-widget__alert seventeen-track-widget__inlineAlert"
                  type="info"
                  showIcon
                  message={t('pages.orderTracking.trackingUnavailable')}
                  description={result.summary || t('pages.orderTracking.noTrackingData')}
                />
                <Typography.Text type="secondary" className="seventeen-track-widget__recoveryHint">
                  {t('pages.orderTracking.emptyRecoveryHint')}
                </Typography.Text>
                {recoveryActions}
              </div>
            ) : (
              <div className="seventeen-track-widget__recovery">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('pages.orderTracking.noTrackingData')}
                />
                <Typography.Text type="secondary" className="seventeen-track-widget__recoveryHint">
                  {t('pages.orderTracking.emptyRecoveryHint')}
                </Typography.Text>
                {recoveryActions}
              </div>
            )}
          </div>
        ) : (
          <div className="seventeen-track-widget__recovery">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.orderTracking.noTrackingData')} />
            {needsEmptyRecovery ? (
              <>
                <Typography.Text type="secondary" className="seventeen-track-widget__recoveryHint">
                  {t('pages.orderTracking.emptyRecoveryHint')}
                </Typography.Text>
                {recoveryActions}
              </>
            ) : null}
          </div>
        )}
      </div>
    </Space>
  );
};

export default SeventeenTrackWidget;
