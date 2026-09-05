import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiAbortController, seckillApi, paymentApi } from '../api';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopInput from '../components/ShopInput';
import { useAuth } from '../hooks/useAuth';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useDocumentVisibility } from '../hooks/useDocumentVisibility';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { usePageTitle } from '../hooks/usePageTitle';
import type { PaymentChannel, SeckillCampaign, SeckillItem } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { getApiErrorMessage } from '../utils/apiError';
import { resolveApiAssetUrl } from '../utils/mediaAssets';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import './Seckill.css';

type PurchaseForm = {
  quantity: number;
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  contactEmail: string;
  paymentMethod: string;
};

const SECKILL_PURCHASE_BODY_CLASS = 'shop-seckill-purchase-open';

const initialForm: PurchaseForm = {
  quantity: 1,
  shippingAddress: '',
  recipientName: '',
  recipientPhone: '',
  contactEmail: '',
  paymentMethod: '',
};

const remainingMs = (target?: string, now = Date.now()) => {
  if (!target) return 0;
  const timestamp = new Date(target).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : 0;
};

const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days > 0 ? `${days}d ` : ''}${[hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')}`;
};

const Seckill: React.FC = () => {
  const { t, language } = useLanguage();
  const { token, loading: authLoading } = useAuth();
  const { formatMoney } = useMarket();
  const [campaigns, setCampaigns] = useState<SeckillCampaign[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [paymentChannelsLoading, setPaymentChannelsLoading] = useState(false);
  const [paymentChannelsError, setPaymentChannelsError] = useState('');
  const [paymentChannelsReloadKey, setPaymentChannelsReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<{ campaign: SeckillCampaign; item: SeckillItem } | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const documentVisible = useDocumentVisibility();
  const [submitLoading, setSubmitLoading] = useState(false);
  const submitLoadingRef = useRef(false);
  const mountedRef = useRef(true);
  const paymentChannelsRequestSeqRef = useRef(0);
  const campaignsAbortRef = useRef<AbortController | null>(null);
  const paymentChannelsAbortRef = useRef<AbortController | null>(null);
  const purchaseAbortRef = useRef<AbortController | null>(null);
  const purchaseCloseRef = useRef<HTMLButtonElement>(null);
  const purchaseDialogRef = useRef<HTMLElement>(null);

  submitLoadingRef.current = submitLoading;

  usePageTitle(t('pages.seckill.title'));
  useDocumentMeta({
    title: t('pages.seckill.title'),
    description: t('pages.seckill.seoDescription'),
    path: '/seckill',
    type: 'website',
    siteName: t('common.siteTitle'),
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      campaignsAbortRef.current?.abort();
      paymentChannelsAbortRef.current?.abort();
      purchaseAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || campaigns.length === 0 || !documentVisible) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [campaigns.length, documentVisible, now]);

  useEffect(() => {
    let disposed = false;
    const abortController = createApiAbortController();
    campaignsAbortRef.current?.abort();
    campaignsAbortRef.current = abortController;
    setLoading(true);
    seckillApi.getCampaigns({ signal: abortController.signal })
      .then((response) => {
        if (!disposed) {
          setCampaigns(Array.isArray(response.data) ? response.data : []);
          setError('');
        }
      })
      .catch((requestError) => {
        if (abortController.signal.aborted) return;
        if (!disposed) {
          const message = getApiErrorMessage(requestError, t('pages.seckill.loadFailed'), language);
          setError(message);
          announceAccessibleMessage(message, 'error');
        }
      })
      .finally(() => {
        if (!disposed && !abortController.signal.aborted) setLoading(false);
      });
    return () => {
      disposed = true;
      abortController.abort();
      if (campaignsAbortRef.current === abortController) campaignsAbortRef.current = null;
    };
  }, [language, t]);

  useEffect(() => {
    if (!token) {
      paymentChannelsRequestSeqRef.current += 1;
      setPaymentChannels([]);
      setPaymentChannelsLoading(false);
      setPaymentChannelsError('');
      setForm((current) => ({ ...current, paymentMethod: '' }));
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    paymentChannelsAbortRef.current?.abort();
    paymentChannelsAbortRef.current = abortController;
    const requestSeq = paymentChannelsRequestSeqRef.current + 1;
    paymentChannelsRequestSeqRef.current = requestSeq;
    const isCurrentRequest = () => !disposed
      && mountedRef.current
      && paymentChannelsRequestSeqRef.current === requestSeq;
    setPaymentChannelsLoading(true);
    setPaymentChannelsError('');
    setPaymentChannels([]);
    setForm((current) => ({ ...current, paymentMethod: '' }));
    paymentApi.getChannels({ signal: abortController.signal })
      .then((response) => {
        if (!isCurrentRequest()) return;
        const channels = Array.isArray(response.data) ? response.data : [];
        setPaymentChannels(channels);
        setPaymentChannelsError('');
        setForm((current) => ({
          ...current,
          paymentMethod: channels.some((channel) => channel.code === current.paymentMethod)
            ? current.paymentMethod
            : channels[0]?.code || '',
        }));
        setPaymentChannelsLoading(false);
      })
      .catch((requestError) => {
        if (abortController.signal.aborted) return;
        if (!isCurrentRequest()) return;
        const message = getApiErrorMessage(
          requestError,
          t('pages.seckill.paymentUnavailableDescription'),
          language,
        );
        setPaymentChannels([]);
        setForm((current) => ({ ...current, paymentMethod: '' }));
        setPaymentChannelsError(message);
        setPaymentChannelsLoading(false);
        announceAccessibleMessage(message, 'error');
        reportNonBlockingError('Seckill.loadPaymentChannels', requestError);
      });
    return () => {
      disposed = true;
      abortController.abort();
      if (paymentChannelsAbortRef.current === abortController) paymentChannelsAbortRef.current = null;
    };
  }, [language, paymentChannelsReloadKey, t, token]);

  useEffect(() => {
    if (!selected) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const shouldCompensateScrollbar = scrollbarWidth > 0 && !previousBodyPaddingRight;
    document.body.classList.add(SECKILL_PURCHASE_BODY_CLASS);
    document.body.style.overflow = 'hidden';
    if (shouldCompensateScrollbar) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePurchase();
    };
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = purchaseDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>([
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','))).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('keydown', trapFocus);
    const focusFrame = window.requestAnimationFrame(() => purchaseCloseRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('keydown', trapFocus);
      window.cancelAnimationFrame(focusFrame);
      document.body.classList.remove(SECKILL_PURCHASE_BODY_CLASS);
      document.body.style.overflow = previousBodyOverflow;
      if (shouldCompensateScrollbar) {
        document.body.style.paddingRight = previousBodyPaddingRight;
      }
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [selected]);

  const resolveCampaignState = useCallback((campaign: SeckillCampaign) => {
    if (campaign.state === 'UPCOMING' && remainingMs(campaign.startAt, now) === 0) return 'ONGOING';
    if (campaign.state === 'ONGOING' && remainingMs(campaign.endAt, now) === 0) return 'ENDED';
    return campaign.state;
  }, [now]);

  const activeCampaignCount = useMemo(
    () => campaigns.filter((campaign) => resolveCampaignState(campaign) === 'ONGOING').length,
    [campaigns, resolveCampaignState],
  );

  const stateLabel = useCallback((state: string) => {
    switch (state) {
      case 'ONGOING': return t('pages.seckill.ongoing');
      case 'UPCOMING': return t('pages.seckill.upcoming');
      case 'ENDED': return t('pages.seckill.ended');
      default: return t('pages.seckill.paused');
    }
  }, [t]);

  const countdownLabel = useCallback((campaign: SeckillCampaign) => {
    const state = resolveCampaignState(campaign);
    if (state === 'UPCOMING') {
      return t('pages.seckill.startsIn', { time: formatCountdown(remainingMs(campaign.startAt, now)) });
    }
    if (state === 'ONGOING') {
      return t('pages.seckill.endsIn', { time: formatCountdown(remainingMs(campaign.endAt, now)) });
    }
    return t('pages.seckill.windowClosed');
  }, [now, resolveCampaignState, t]);

  const maxPurchaseQuantity = selected
    ? Math.max(1, Math.min(selected.item.limitPerUser, selected.item.remaining))
    : 1;

  const openPurchase = (campaign: SeckillCampaign, item: SeckillItem) => {
    if (!token) {
      window.location.assign(buildLoginUrlFromWindow());
      return;
    }
    if (resolveCampaignState(campaign) !== 'ONGOING' || item.remaining <= 0) return;
    setSelected({ campaign, item });
    setSelectedOptions({});
    setForm((current) => ({
      ...current,
      quantity: Math.max(1, Math.min(Math.max(1, current.quantity), item.limitPerUser, item.remaining)),
    }));
  };

  const closePurchase = () => {
    if (submitLoadingRef.current) return;
    setSelected(null);
  };

  const updateForm = (field: keyof PurchaseForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'quantity'
        ? Math.min(maxPurchaseQuantity, Math.max(1, Number(value) || 1))
        : value,
    }));
  };

  const reloadPaymentChannels = useCallback(() => {
    setPaymentChannelsReloadKey((key) => key + 1);
  }, []);

  const paymentMethodsAvailable = !paymentChannelsLoading
    && !paymentChannelsError
    && paymentChannels.length > 0;

  const submitPurchase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || submitLoading || submitLoadingRef.current) return;
    if (!paymentMethodsAvailable) {
      announceAccessibleMessage(
        paymentChannelsError || t('pages.seckill.paymentUnavailable'),
        'error',
      );
      return;
    }
    if (!paymentChannels.some((channel) => channel.code === form.paymentMethod)) {
      announceAccessibleMessage(t('pages.seckill.paymentRequired'), 'error');
      return;
    }
    if (!form.paymentMethod) {
      announceAccessibleMessage(t('pages.seckill.paymentRequired'), 'error');
      return;
    }
    const quantity = Math.min(form.quantity, selected.item.limitPerUser, selected.item.remaining);
    if (quantity < 1) return;
    submitLoadingRef.current = true;
    setSubmitLoading(true);
    purchaseAbortRef.current?.abort();
    const abortController = createApiAbortController();
    purchaseAbortRef.current = abortController;
    const key = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `seckill-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const response = await seckillApi.purchase(selected.campaign.id, {
        itemId: selected.item.id,
        ...form,
        quantity,
        selectedSpecs: Object.keys(selectedOptions).length > 0 ? JSON.stringify(selectedOptions) : undefined,
      }, key, { signal: abortController.signal });
      if (abortController.signal.aborted || !mountedRef.current) return;
      const message = t('pages.seckill.orderCreated');
      announceAccessibleMessage(message, 'success');
      if (response.data.orderNo) {
        window.location.assign(`/payment/${encodeURIComponent(response.data.orderNo)}`);
      }
    } catch (requestError) {
      if (abortController.signal.aborted || !mountedRef.current) return;
      const message = getApiErrorMessage(requestError, t('pages.seckill.purchaseFailed'), language);
      announceAccessibleMessage(message, 'error');
      setError(message);
    } finally {
      submitLoadingRef.current = false;
      if (purchaseAbortRef.current === abortController) purchaseAbortRef.current = null;
      if (mountedRef.current) setSubmitLoading(false);
    }
  };

  return (
    <main className="seckill-page" id="main-content">
      <section className="seckill-page__hero" aria-labelledby="seckill-title">
        <div>
          <p className="seckill-page__eyebrow"><ShopIcon path={SI.thunder} /> {t('pages.seckill.eyebrow')}</p>
          <h1 id="seckill-title">{t('pages.seckill.title')}</h1>
          <p>{t('pages.seckill.subtitle')}</p>
        </div>
        <div className="seckill-page__heroStat" aria-label={t('pages.seckill.liveCount', { count: activeCampaignCount })}>
          <strong>{activeCampaignCount}</strong>
          <span>{t('pages.seckill.liveNow')}</span>
        </div>
      </section>

      {error ? <div className="seckill-page__error" role="alert">{error}</div> : null}
      {loading || authLoading ? (
        <div className="seckill-page__state" role="status">{t('common.loading')}</div>
      ) : campaigns.length === 0 ? (
        <section className="seckill-page__empty" aria-live="polite">
          <ShopIcon path={SI.clock} />
          <h2>{t('pages.seckill.emptyTitle')}</h2>
          <p>{t('pages.seckill.emptyText')}</p>
        </section>
      ) : (
        <div className="seckill-page__campaigns">
          {campaigns.map((campaign) => {
            const state = resolveCampaignState(campaign);
            const campaignBanner = resolveApiAssetUrl(campaign.bannerUrl);
            return (
            <section className="seckill-campaign" key={campaign.id} aria-labelledby={`seckill-campaign-${campaign.id}`}>
              {campaignBanner ? (
                <div className="seckill-campaign__banner">
                  <img
                    src={campaignBanner}
                    alt={campaign.title}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                </div>
              ) : null}
              <div className="seckill-campaign__header">
                <div>
                  <span className={`seckill-campaign__status seckill-campaign__status--${state.toLowerCase()}`}>
                    <ShopIcon path={state === 'ONGOING' ? SI.fire : SI.clock} /> {stateLabel(state)}
                  </span>
                  <h2 id={`seckill-campaign-${campaign.id}`}>{campaign.title}</h2>
                  {campaign.subtitle ? <p>{campaign.subtitle}</p> : null}
                </div>
                <div className="seckill-campaign__countdown">
                  <span>{countdownLabel(campaign)}</span>
                  <strong>{state === 'ONGOING' ? formatCountdown(remainingMs(campaign.endAt, now)) : formatCountdown(remainingMs(campaign.startAt, now))}</strong>
                </div>
              </div>
              <div className="seckill-campaign__items">
                {campaign.items.map((item) => {
                  const soldOut = item.remaining <= 0;
                  const progress = item.quota > 0 ? Math.min(100, Math.round((item.sold / item.quota) * 100)) : 100;
                  return (
                    <article className={`seckill-item${soldOut ? ' seckill-item--soldOut' : ''}`} key={item.id}>
                      <a className="seckill-item__media" href={`/products/${item.productId}`} aria-label={item.productName || t('pages.seckill.product')}>
                        <img
                          src={resolveProductImage(item.imageUrl)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            if (event.currentTarget.src !== productImageFallback) event.currentTarget.src = productImageFallback;
                          }}
                        />
                      </a>
                      <div className="seckill-item__body">
                        <a className="seckill-item__name" href={`/products/${item.productId}`}>{item.productName || t('pages.seckill.product')}</a>
                        <div className="seckill-item__priceRow">
                          <strong>{formatMoney(item.seckillPrice)}</strong>
                          {item.originalPrice && item.originalPrice > item.seckillPrice ? <del>{formatMoney(item.originalPrice)}</del> : null}
                        </div>
                        <div className="seckill-item__progress" aria-label={t('pages.seckill.soldProgress', { sold: item.sold, quota: item.quota })}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <div className="seckill-item__meta">
                          <span>{t('pages.seckill.remaining', { count: item.remaining })}</span>
                          <span>{t('pages.seckill.limit', { count: item.limitPerUser })}</span>
                        </div>
                        <ShopButton
                          type="primary"
                          block
                          icon={<ShopIcon path={SI.thunder} />}
                          aria-label={soldOut ? t('pages.seckill.soldOut') : t('pages.seckill.buyNow')}
                          title={soldOut ? t('pages.seckill.soldOut') : t('pages.seckill.buyNow')}
                          disabled={soldOut || state !== 'ONGOING'}
                          onClick={() => openPurchase(campaign, item)}
                        >
                          {soldOut ? t('pages.seckill.soldOut') : state === 'UPCOMING' ? t('pages.seckill.notStarted') : state === 'ENDED' ? t('pages.seckill.ended') : t('pages.seckill.buyNow')}
                        </ShopButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="seckill-purchaseBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePurchase(); }}>
          <section ref={purchaseDialogRef} className="seckill-purchase" role="dialog" aria-modal="true" aria-labelledby="seckill-purchase-title" tabIndex={-1}>
            <div className="seckill-purchase__header">
              <div>
                <span>{t('pages.seckill.purchaseEyebrow')}</span>
                <h2 id="seckill-purchase-title">{selected.item.productName || t('pages.seckill.product')}</h2>
              </div>
              <button ref={purchaseCloseRef} type="button" className="seckill-purchase__close" onClick={closePurchase} aria-label={t('common.close')} title={t('common.close')}>
                <ShopIcon path={SI.close} />
              </button>
            </div>
            <div className="seckill-purchase__summary">
              <strong>{formatMoney(selected.item.seckillPrice)}</strong>
              <span>{t('pages.seckill.limit', { count: selected.item.limitPerUser })}</span>
            </div>
            <form onSubmit={submitPurchase} className="seckill-purchase__form">
              <label>{t('pages.seckill.quantity')}
                <ShopInput type="number" min={1} max={maxPurchaseQuantity} value={String(form.quantity)} onChange={(event) => updateForm('quantity', event.target.value)} inputMode="numeric" aria-label={t('pages.seckill.quantity')} aria-required="true" required />
              </label>
              {selected.item.optionGroups?.map((group) => {
                const values = group.values || group.options || [];
                return (
                  <label key={group.name}>{group.name}
                    <select
                      value={selectedOptions[group.name] || ''}
                      onChange={(event) => setSelectedOptions((current) => ({ ...current, [group.name]: event.target.value }))}
                      aria-label={group.name}
                      required
                    >
                      <option value="">{t('pages.seckill.chooseOption')}</option>
                      {values.map((value) => <option value={value} key={value}>{value}</option>)}
                    </select>
                  </label>
                );
              })}
              <label>{t('pages.seckill.recipientName')}
                <ShopInput value={form.recipientName} onChange={(event) => updateForm('recipientName', event.target.value)} autoComplete="name" aria-label={t('pages.seckill.recipientName')} aria-required="true" required maxLength={120} />
              </label>
              <label>{t('pages.seckill.recipientPhone')}
                <ShopInput value={form.recipientPhone} onChange={(event) => updateForm('recipientPhone', event.target.value)} autoComplete="tel" inputMode="tel" aria-label={t('pages.seckill.recipientPhone')} aria-required="true" required maxLength={40} pattern="^(?=(?:.*\d){6,20})\+?[\d\s().-]{6,40}$" />
              </label>
              <label>{t('pages.seckill.shippingAddress')}
                <textarea value={form.shippingAddress} onChange={(event) => updateForm('shippingAddress', event.target.value)} rows={3} autoComplete="street-address" aria-label={t('pages.seckill.shippingAddress')} aria-required="true" required maxLength={2000} />
              </label>
              <label>{t('pages.seckill.contactEmail')}
                <ShopInput type="email" value={form.contactEmail} onChange={(event) => updateForm('contactEmail', event.target.value)} autoComplete="email" aria-label={t('pages.seckill.contactEmail')} maxLength={160} />
              </label>
              {paymentChannelsLoading ? (
                <div className="seckill-purchase__paymentState" role="status" aria-live="polite">
                  <ShopIcon path={SI.wallet} />
                  <span>{t('pages.seckill.paymentLoading')}</span>
                </div>
              ) : paymentChannelsError ? (
                <ShopAlert
                  className="seckill-purchase__paymentState seckill-purchase__paymentState--alert"
                  type="warning"
                  showIcon
                  role="alert"
                  aria-live="polite"
                  message={t('pages.seckill.paymentUnavailable')}
                  description={paymentChannelsError}
                  action={(
                    <ShopButton
                      type="primary"
                      size="small"
                      loading={paymentChannelsLoading}
                      icon={<ShopIcon path={SI.reload} />}
                      aria-label={t('pages.seckill.paymentRetry')}
                      title={t('pages.seckill.paymentRetry')}
                      onClick={reloadPaymentChannels}
                    >
                      {t('pages.seckill.paymentRetry')}
                    </ShopButton>
                  )}
                />
              ) : !paymentMethodsAvailable ? (
                <ShopAlert
                  className="seckill-purchase__paymentState seckill-purchase__paymentState--alert"
                  type="warning"
                  showIcon
                  role="alert"
                  aria-live="polite"
                  message={t('pages.seckill.paymentUnavailable')}
                  description={t('pages.seckill.paymentUnavailableEmpty')}
                  action={(
                    <ShopButton
                      type="primary"
                      size="small"
                      icon={<ShopIcon path={SI.reload} />}
                      aria-label={t('pages.seckill.paymentRetry')}
                      title={t('pages.seckill.paymentRetry')}
                      onClick={reloadPaymentChannels}
                    >
                      {t('pages.seckill.paymentRetry')}
                    </ShopButton>
                  )}
                />
              ) : (
                <label>{t('pages.seckill.paymentMethod')}
                  <select value={form.paymentMethod} onChange={(event) => updateForm('paymentMethod', event.target.value)} aria-label={t('pages.seckill.paymentMethod')} required>
                    <option value="">{t('pages.seckill.choosePayment')}</option>
                    {paymentChannels.map((channel) => <option value={channel.code} key={channel.code}>{channel.displayName || channel.code}</option>)}
                  </select>
                </label>
              )}
              <div className="seckill-purchase__total">
                <span>{t('common.subtotal')}</span>
                <strong>{formatMoney(selected.item.seckillPrice * Math.min(form.quantity, maxPurchaseQuantity))}</strong>
              </div>
              <ShopButton type="primary" htmlType="submit" block loading={submitLoading} disabled={!paymentMethodsAvailable} icon={<ShopIcon path={SI.thunder} />} aria-label={t('pages.seckill.confirmPurchase')}>
                {t('pages.seckill.confirmPurchase')}
              </ShopButton>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default Seckill;
