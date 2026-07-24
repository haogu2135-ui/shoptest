import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopInput from '../components/ShopInput';
import ShopTag from '../components/ShopTag';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { PaymentCustomer } from '../types';
import { formatPaymentUrlLabel } from '../utils/paymentRecovery';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type PaymentInstructionsPanelsProps = {
  amountText: string;
  applyGuestEmailForVerify: () => void;
  canVerify: boolean;
  channel: string;
  expiresText: string;
  guestEmail: string;
  guestEmailInput: string;
  isAuthenticated: boolean;
  isExpiredOrFailed: boolean;
  isFailed: boolean;
  isPaid: boolean;
  isReconcileRequired: boolean;
  isRefunded: boolean;
  isRefunding: boolean;
  navigate: NavigateFunction;
  normalizeGuestEmailInput: (value: unknown) => string;
  normalizedOrderNo: string;
  openOrders: () => void;
  openPaymentActionLabel: string;
  openPaymentUrl: () => void;
  openSupport: () => void;
  openTrackOrder: () => void;
  payment: PaymentCustomer | null;
  paymentContextLabel: string;
  paymentStatus: string;
  paymentSteps: string[];
  recoveryIsExpired: boolean;
  refreshStatusActionLabel: string;
  refreshing: boolean;
  refreshPaymentStatus: () => void | Promise<void>;
  retryVerifyActionLabel: string;
  setGuestEmailInput: (value: string) => void;
  setReloadToken: React.Dispatch<React.SetStateAction<number>>;
  statusTagColor: string;
  statusText: string;
  statusTitle: string;
  statusTone: string;
  supportActionLabel: string;
  t: Translate;
  trackOrderActionLabel: string;
  verifying: boolean;
  verifyError: string;
};

/** Commercial payment-instructions hero, verify card, next-steps, and trust panels. */
export const PaymentInstructionsPanels: React.FC<PaymentInstructionsPanelsProps> = (props) => {
  const {
    amountText,
    applyGuestEmailForVerify,
    canVerify,
    channel,
    expiresText,
    guestEmail,
    guestEmailInput,
    isAuthenticated,
    isExpiredOrFailed,
    isFailed,
    isPaid,
    isReconcileRequired,
    isRefunded,
    isRefunding,
    navigate,
    normalizeGuestEmailInput,
    normalizedOrderNo,
    openOrders,
    openPaymentActionLabel,
    openPaymentUrl,
    openSupport,
    openTrackOrder,
    payment,
    paymentContextLabel,
    paymentStatus,
    paymentSteps,
    recoveryIsExpired,
    refreshStatusActionLabel,
    refreshing,
    refreshPaymentStatus,
    retryVerifyActionLabel,
    setGuestEmailInput,
    setReloadToken,
    statusTagColor,
    statusText,
    statusTitle,
    statusTone,
    supportActionLabel,
    t,
    trackOrderActionLabel,
    verifying,
    verifyError,
  } = props;
  const recovery = { isExpired: recoveryIsExpired };

  return (
    <>
      <section className="payment-instructions-page__hero">
        <span className="payment-instructions-page__text payment-instructions-page__eyebrow">{t('pages.payment.secureEyebrow')}</span>
        <h1 className="payment-instructions-page__title">
          {isPaid
            ? t('pages.paymentInstructions.paidTitle')
            : isRefunded
              ? t('pages.profile.paymentRefundedTitle')
              : isReconcileRequired
                ? t('pages.checkout.paymentRecoveryReconcileRequired')
                : isFailed
                  ? t('pages.paymentInstructions.failedTitle')
                  : recovery.isExpired
                    ? t('pages.paymentInstructions.expiredTitle')
                    : t('pages.paymentInstructions.title')}
        </h1>
        <span className="payment-instructions-page__text payment-instructions-page__subtitle">
          {isPaid
            ? t('pages.paymentInstructions.paidText')
            : isRefunded
              ? t('pages.profile.paymentRefundedNext')
              : isReconcileRequired
                ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
                : isFailed
                  ? t('pages.paymentInstructions.failedText')
                  : recovery.isExpired
                    ? t('pages.paymentInstructions.expiredText')
                    : t('pages.paymentInstructions.subtitle')}
        </span>
      </section>

      {!normalizedOrderNo ? (
        <ShopAlert
          className="payment-instructions-page__banner"
          type="warning"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.paymentInstructions.missingOrder')}
          description={t('pages.paymentInstructions.missingOrderText')}
          action={(
            <ShopButton size="small" type="primary" onClick={openTrackOrder}>
              {t('nav.trackOrder')}
            </ShopButton>
          )}
        />
      ) : null}

      <div className="payment-instructions-page__grid">
        <section className="payment-instructions-page__card">
          <div
            className="payment-instructions-page__verifyPanel"
            role="status"
            aria-live="polite"
            aria-busy={verifying}
            aria-label={verifying ? t('common.loading') : undefined}
          >
            {verifying ? (
              <div className="payment-instructions-page__spinnerOverlay" role="status" aria-live="polite">
                <span className="payment-instructions-page__spinner" aria-hidden="true" />
              </div>
            ) : null}
            <div className="payment-instructions-page__stack">
                {verifyError ? (
                  <ShopAlert
                    type="error"
                    showIcon
                    role="alert"
                    aria-live="assertive"
                    message={verifyError}
                    action={(
                      <ShopButton
                        size="small"
                        type="primary"
                        icon={<ShopIcon path={SI.reload} />}
                        loading={verifying}
                        aria-label={retryVerifyActionLabel}
                        title={retryVerifyActionLabel}
                        onClick={() => setReloadToken((value) => value + 1)}
                      >
                        {t('pages.paymentInstructions.retryVerify')}
                      </ShopButton>
                    )}
                  />
                ) : !guestEmail && !isAuthenticated ? (
                  <div className="payment-instructions-page__guestEmailGate" data-payment-guest-email-gate="true">
                    <ShopAlert
                      type="info"
                      showIcon
                      message={t('pages.paymentInstructions.guestEmailRequiredTitle')}
                      description={t('pages.paymentInstructions.guestEmailRequiredText')}
                    />
                    <div className="payment-instructions-page__guestEmailForm">
                      <ShopInput
                        prefix={<ShopIcon path={SI.mail} />}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={120}
                        value={guestEmailInput}
                        onChange={(event) => setGuestEmailInput(normalizeGuestEmailInput(event.target.value))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            applyGuestEmailForVerify();
                          }
                        }}
                        placeholder={t('pages.checkout.guestEmailPlaceholder')}
                        aria-label={t('pages.paymentInstructions.guestEmailLabel')}
                        title={t('pages.paymentInstructions.guestEmailLabel')}
                      />
                      <ShopButton
                        type="primary"
                        onClick={applyGuestEmailForVerify}
                        aria-label={t('pages.paymentInstructions.guestEmailSubmit')}
                        title={t('pages.paymentInstructions.guestEmailSubmit')}
                      >
                        {t('pages.paymentInstructions.guestEmailSubmit')}
                      </ShopButton>
                    </div>
                    <div className="payment-instructions-page__guestEmailRecovery" data-payment-guest-email-recovery="true">
                      <ShopButton type="link" onClick={openTrackOrder} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                        {t('pages.paymentInstructions.verifyWithTrackOrder')}
                      </ShopButton>
                      <ShopButton type="link" onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                        {t('pages.cart.browse')}
                      </ShopButton>
                      <ShopButton type="link" onClick={() => navigate('/coupons')} aria-label={t('nav.coupons')} title={t('nav.coupons')}>
                        {t('nav.coupons')}
                      </ShopButton>
                      <ShopButton type="link" onClick={openSupport} aria-label={t('pages.profile.contactSupport')} title={t('pages.profile.contactSupport')}>
                        {t('pages.profile.contactSupport')}
                      </ShopButton>
                    </div>
                  </div>
                ) : null}

                <div
                  className={`payment-instructions-page__status payment-instructions-page__status--${statusTone}`}
                  aria-label={`${statusTitle}: ${paymentContextLabel}`}
                >
                  {(isPaid || isRefunded) ? <ShopIcon path={SI.safety} /> : <ShopIcon path={SI.creditCard} />}
                  <span>
                    <span className="payment-instructions-page__text payment-instructions-page__text--strong">{statusTitle}</span>
                    <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{statusText}</span>
                  </span>
                  <ShopTag color={statusTagColor}>{channel}</ShopTag>
                </div>

                <dl className="payment-instructions-page__descList">
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.orderNo')}</dt>
                    <dd className="payment-instructions-page__descValue">{normalizedOrderNo || '-'}</dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.amount')}</dt>
                    <dd className="payment-instructions-page__descValue">
                      <span className="payment-instructions-page__amount commerce-money">{amountText}</span>
                    </dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.channel')}</dt>
                    <dd className="payment-instructions-page__descValue">{channel}</dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.statusLabel')}</dt>
                    <dd className="payment-instructions-page__descValue">
                      <ShopTag color={statusTagColor}>{paymentStatus || t('pages.paymentInstructions.pendingTitle')}</ShopTag>
                    </dd>
                  </div>
                  <div className="payment-instructions-page__descRow">
                    <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.expiresAt')}</dt>
                    <dd className="payment-instructions-page__descValue">{expiresText}</dd>
                  </div>
                  {payment?.paymentUrl && !isReconcileRequired && !isExpiredOrFailed ? (
                    <div className="payment-instructions-page__descRow">
                      <dt className="payment-instructions-page__descLabel">{t('pages.paymentInstructions.paymentLink')}</dt>
                      <dd className="payment-instructions-page__descValue">
                        <span className="payment-instructions-page__paymentUrl">{formatPaymentUrlLabel(payment.paymentUrl)}</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="payment-instructions-page__notice">
                  <ShopIcon path={SI.lock} />
                  <span className="payment-instructions-page__text">{t('pages.paymentInstructions.notice')}</span>
                </div>

                <div className="payment-instructions-page__primaryActions">
                  {!isPaid && !isRefunded && !isRefunding && !isReconcileRequired && !isFailed && payment?.paymentUrl && !recovery.isExpired ? (
                    <ShopButton
                      type="primary"
                      size="large"
                      icon={<ShopIcon path={SI.creditCard} />}
                      aria-label={openPaymentActionLabel}
                      title={openPaymentActionLabel}
                      onClick={openPaymentUrl}
                    >
                      {t('pages.paymentInstructions.openPayment')}
                    </ShopButton>
                  ) : null}
                  {canVerify ? (
                    <ShopButton
                      icon={<ShopIcon path={SI.reload} />}
                      loading={refreshing || verifying}
                      aria-label={refreshStatusActionLabel}
                      title={refreshStatusActionLabel}
                      onClick={() => { void refreshPaymentStatus(); }}
                    >
                      {t('pages.paymentInstructions.refreshStatus')}
                    </ShopButton>
                  ) : null}
                </div>
              </div>
          </div>
        </section>

        <section className="payment-instructions-page__card">
          <div className="payment-instructions-page__stack">
            <div>
              <span className="payment-instructions-page__text payment-instructions-page__recoveryEyebrow">{t('pages.paymentInstructions.recoveryEyebrow')}</span>
              <h3 className="payment-instructions-page__title">{t('pages.paymentInstructions.nextTitle')}</h3>
            </div>
            <div className="payment-instructions-page__steps" role="list" aria-label={`${t('pages.paymentInstructions.nextTitle')}: ${paymentContextLabel}`}>
              {paymentSteps.map((step, index) => (
                <div className="payment-instructions-page__step" role="listitem" aria-label={`${index + 1}. ${step}`} key={step}>
                  <span className="payment-instructions-page__stepNumber" aria-hidden="true">{index + 1}</span>
                  <span className="payment-instructions-page__text">{step}</span>
                </div>
              ))}
            </div>
            <div className="payment-instructions-page__actions">
              <ShopButton type="primary" icon={<ShopIcon path={SI.fileSearch} />} aria-label={trackOrderActionLabel} title={trackOrderActionLabel} onClick={openTrackOrder}>
                {t('nav.trackOrder')}
              </ShopButton>
              <ShopButton aria-label={`${t('pages.paymentInstructions.backToOrders')}: ${paymentContextLabel}`} title={t('pages.paymentInstructions.backToOrders')} onClick={openOrders}>
                {t('pages.paymentInstructions.backToOrders')}
              </ShopButton>
              <ShopButton icon={<ShopIcon path={SI.support} />} aria-label={supportActionLabel} title={supportActionLabel} onClick={openSupport}>
                {t('pages.profile.contactSupport')}
              </ShopButton>
            </div>
          </div>
        </section>
      </div>

      <div className="payment-instructions-page__trustBar" aria-label={t('pages.paymentInstructions.trustTitle')}>
        <div className="payment-instructions-page__trustItem">
          <ShopIcon path={SI.lock} aria-hidden="true" />
          <div>
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.trustSecureTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{t('pages.paymentInstructions.trustSecureText')}</span>
          </div>
        </div>
        <div className="payment-instructions-page__trustItem">
          <ShopIcon path={SI.fileSearch} aria-hidden="true" />
          <div>
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.trustTrackTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{t('pages.paymentInstructions.trustTrackText')}</span>
          </div>
        </div>
        <div className="payment-instructions-page__trustItem">
          <ShopIcon path={SI.support} aria-hidden="true" />
          <div>
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.trustSupportTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{t('pages.paymentInstructions.trustSupportText')}</span>
          </div>
        </div>
      </div>

    </>
  );
};
