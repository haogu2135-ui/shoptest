import React, { useCallback, useEffect, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from './ShopIcon';
import { Alert, Button, Tag } from 'antd';
import ShopInput from './ShopInput';
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
      announceAccessibleMessage(t('pages.adminOrders.noTrackingNumber'), 'warning');
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
        announceAccessibleMessage(localizedError, 'error');
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
      announceAccessibleMessage(t('pages.adminOrders.noTrackingNumber'), 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(activeTrackingNumber);
      announceAccessibleMessage(t('pages.orderTracking.trackingNumberCopied'), 'success');
    } catch (error) {
      reportNonBlockingError('SeventeenTrackWidget.copyTrackingNumber', error);
      announceAccessibleMessage(t('pages.orderTracking.copyTrackingFailed'), 'error');
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
    <div className="seventeen-track-widget__recoveryActions" data-seventeen-track-recovery="true">
      {activeTrackingNumber ? (
        <Button
          icon={<ShopIcon path={SI.copy} />}
          onClick={() => { void copyTrackingNumber(); }}
          aria-label={`${t('pages.orderTracking.copyTrackingNumber')}: ${activeTrackingNumber}`}
          title={`${t('pages.orderTracking.copyTrackingNumber')}: ${activeTrackingNumber}`}
        >
          {t('pages.orderTracking.copyTrackingNumber')}
        </Button>
      ) : null}
      <Button
        icon={<ShopIcon path={SI.reload} />}
        loading={loading}
        onClick={runTrack}
        disabled={!value.trim() && !activeTrackingNumber}
        aria-label={`${t('pages.orderTracking.retryTracking')}: ${trackingContext}`}
        title={`${t('pages.orderTracking.retryTracking')}: ${trackingContext}`}
      >
        {t('pages.orderTracking.retryTracking')}
      </Button>
      <Button
        icon={<ShopIcon path={SI.shopping} />}
        onClick={() => navigate('/products')}
        aria-label={t('pages.orderTracking.shopAgain')}
        title={t('pages.orderTracking.shopAgain')}
      >
        {t('pages.orderTracking.shopAgain')}
      </Button>
      <Button
        icon={<ShopIcon path={SI.gift} />}
        onClick={() => navigate('/coupons')}
        aria-label={t('pages.orderTracking.emptyCoupons')}
        title={t('pages.orderTracking.emptyCoupons')}
      >
        {t('pages.orderTracking.emptyCoupons')}
      </Button>
      <Button
        icon={<ShopIcon path={SI.support} />}
        onClick={openSupport}
        aria-label={t('pages.profile.contactSupport')}
        title={t('pages.profile.contactSupport')}
      >
        {t('pages.profile.contactSupport')}
      </Button>
    </div>
  );

  return (
    <div className="seventeen-track-widget">
      <div className="seventeen-track-widget__search">
        <ShopInput
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              runTrack();
            }
          }}
          placeholder={t('pages.orderTracking.trackingNumber')}
          aria-label={trackingInputLabel}
          title={trackingInputLabel}
          autoComplete="off"
        />
        <Button
          type="primary"
          icon={<ShopIcon path={SI.search} />}
          loading={loading}
          onClick={runTrack}
          aria-label={trackActionLabel}
          title={trackActionLabel}
        >
          {t('pages.adminOrders.track')}
        </Button>
      </div>

      <div
        className="seventeen-track-widget__results"
        style={{ minHeight: resultsMinHeight }}
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && !result && !error ? (
          <span className="seventeen-track-widget__muted">{t('common.loading')}</span>
        ) : error ? (
          <div className="seventeen-track-widget__recovery">
            <Alert
              className="seventeen-track-widget__alert"
              type="error"
              showIcon
              message={t('pages.orderTracking.trackingFailed')}
              description={error}
            />
            <span className="seventeen-track-widget__recoveryHint seventeen-track-widget__muted">
              {t('pages.orderTracking.emptyRecoveryHint')}
            </span>
            {recoveryActions}
          </div>
        ) : result ? (
          <div className="seventeen-track-widget__content">
            <div className="seventeen-track-widget__summary">
              <div className="seventeen-track-widget__summaryMeta">
                <Tag color={statusColors[status] || 'default'}>{status || t('common.status')}</Tag>
                {result.carrier ? <Tag>{result.carrier}</Tag> : null}
                <strong className="seventeen-track-widget__trackingNo">{result.trackingNumber}</strong>
              </div>
              {result.summary ? (
                <span className="seventeen-track-widget__muted">{result.summary}</span>
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
                        <strong className="seventeen-track-widget__eventTitle">{eventDescription}</strong>
                        <span className="seventeen-track-widget__eventMeta seventeen-track-widget__muted">
                          {eventMeta}
                        </span>
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
                <span className="seventeen-track-widget__recoveryHint seventeen-track-widget__muted">
                  {t('pages.orderTracking.emptyRecoveryHint')}
                </span>
                {recoveryActions}
              </div>
            ) : (
              <div className="seventeen-track-widget__recovery">
                <div className="seventeen-track-widget__emptyPanel" role="status">
                  <div className="seventeen-track-widget__emptyDescription">{t('pages.orderTracking.noTrackingData')}</div>
                </div>
                <span className="seventeen-track-widget__recoveryHint seventeen-track-widget__muted">
                  {t('pages.orderTracking.emptyRecoveryHint')}
                </span>
                {recoveryActions}
              </div>
            )}
          </div>
        ) : (
          <div className="seventeen-track-widget__recovery">
            <div className="seventeen-track-widget__emptyPanel" role="status">
              <div className="seventeen-track-widget__emptyDescription">{t('pages.orderTracking.noTrackingData')}</div>
            </div>
            {needsEmptyRecovery ? (
              <>
                <span className="seventeen-track-widget__recoveryHint seventeen-track-widget__muted">
                  {t('pages.orderTracking.emptyRecoveryHint')}
                </span>
                {recoveryActions}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default SeventeenTrackWidget;
