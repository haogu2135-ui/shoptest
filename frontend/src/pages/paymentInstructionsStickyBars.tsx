import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopButton from '../components/ShopButton';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { PaymentCustomer } from '../types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type PaymentInstructionsStickyBarsProps = {
  amountText: string;
  canVerify: boolean;
  channel: string;
  isExpiredOrFailed: boolean;
  isFailed: boolean;
  isPaid: boolean;
  isReconcileRequired: boolean;
  isRefunded: boolean;
  isRefunding: boolean;
  navigate: NavigateFunction;
  openContinueShopping: () => void;
  openPaymentActionLabel: string;
  openPaymentUrl: () => void;
  openSupport: () => void;
  openTrackOrder: () => void;
  payment: PaymentCustomer | null;
  paymentContextLabel: string;
  recoveryIsExpired: boolean;
  refreshStatusActionLabel: string;
  refreshing: boolean;
  refreshPaymentStatus: () => void | Promise<void>;
  statusTitle: string;
  supportActionLabel: string;
  t: Translate;
  trackOrderActionLabel: string;
  verifying: boolean;
};

/** Commercial payment sticky rails: open-payment, recovery multipath, paid multipath. */
export const PaymentInstructionsStickyBars: React.FC<PaymentInstructionsStickyBarsProps> = (props) => {
  const {
    amountText,
    canVerify,
    channel,
    isExpiredOrFailed,
    isFailed,
    isPaid,
    isReconcileRequired,
    isRefunded,
    isRefunding,
    navigate,
    openContinueShopping,
    openPaymentActionLabel,
    openPaymentUrl,
    openSupport,
    openTrackOrder,
    payment,
    paymentContextLabel,
    recoveryIsExpired,
    refreshStatusActionLabel,
    refreshing,
    refreshPaymentStatus,
    statusTitle,
    supportActionLabel,
    t,
    trackOrderActionLabel,
    verifying,
  } = props;
  const recovery = { isExpired: recoveryIsExpired };

  return (
    <>
      {!isPaid && !isRefunded && !isRefunding && !isReconcileRequired && !isFailed && payment?.paymentUrl && !recovery.isExpired ? (
        <div className="payment-instructions-page__stickyBar" role="region" aria-label={t('pages.paymentInstructions.stickyOpenPayment')}>
          <div className="payment-instructions-page__stickyMeta">
            <span className="payment-instructions-page__text payment-instructions-page__text--strong commerce-money">{amountText}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{channel}</span>
          </div>
          <div className="payment-instructions-page__stickyActions">
            {canVerify ? (
              <ShopButton
                icon={<ShopIcon path={SI.reload} />}
                loading={refreshing || verifying}
                aria-label={refreshStatusActionLabel}
                title={refreshStatusActionLabel}
                onClick={() => { void refreshPaymentStatus(); }}
              >
                {t('pages.paymentInstructions.stickyRefresh')}
              </ShopButton>
            ) : null}
            <ShopButton
              type="primary"
              size="large"
              icon={<ShopIcon path={SI.creditCard} />}
              aria-label={openPaymentActionLabel}
              title={openPaymentActionLabel}
              onClick={openPaymentUrl}
            >
              {t('pages.paymentInstructions.stickyOpenPayment')}
            </ShopButton>
          </div>
        </div>
      ) : null}

      {isExpiredOrFailed && !isPaid && !isRefunded && !isRefunding && !isReconcileRequired ? (
        <div
          className="payment-instructions-page__stickyBar payment-instructions-page__stickyBar--recovery"
          role="region"
          aria-label={t('pages.paymentInstructions.stickyRecovery')}
          data-payment-recovery-sticky="true"
        >
          <div className="payment-instructions-page__stickyMeta">
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{statusTitle}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{paymentContextLabel}</span>
          </div>
          <div className="payment-instructions-page__stickyActions" data-payment-recovery-actions="true">
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              aria-label={t('pages.paymentInstructions.stickyContinueShopping')}
              title={t('pages.paymentInstructions.stickyContinueShopping')}
              onClick={openContinueShopping}
            >
              {t('pages.paymentInstructions.stickyContinueShopping')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.gift} />}
              aria-label={t('nav.coupons')}
              title={t('nav.coupons')}
              onClick={() => navigate('/coupons')}
            >
              {t('nav.coupons')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.support} />}
              aria-label={supportActionLabel}
              title={supportActionLabel}
              onClick={openSupport}
            >
              {t('pages.profile.contactSupport')}
            </ShopButton>
            <ShopButton
              type="primary"
              size="large"
              icon={<ShopIcon path={SI.fileSearch} />}
              aria-label={trackOrderActionLabel}
              title={trackOrderActionLabel}
              onClick={openTrackOrder}
            >
              {t('pages.paymentInstructions.stickyTrackOrder')}
            </ShopButton>
          </div>
        </div>
      ) : null}

      {isPaid ? (
        <div
          className="payment-instructions-page__stickyBar payment-instructions-page__stickyBar--paid"
          role="region"
          aria-label={t('pages.paymentInstructions.stickyTrackOrder')}
          data-payment-paid-sticky="true"
        >
          <div className="payment-instructions-page__stickyMeta">
            <span className="payment-instructions-page__text payment-instructions-page__text--strong">{t('pages.paymentInstructions.paidTitle')}</span>
            <span className="payment-instructions-page__text payment-instructions-page__text--secondary">{paymentContextLabel}</span>
          </div>
          <div className="payment-instructions-page__stickyActions" data-payment-paid-actions="true">
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              aria-label={t('pages.paymentInstructions.stickyContinueShopping')}
              title={t('pages.paymentInstructions.stickyContinueShopping')}
              onClick={openContinueShopping}
            >
              {t('pages.paymentInstructions.stickyContinueShopping')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.gift} />}
              aria-label={t('nav.coupons')}
              title={t('nav.coupons')}
              onClick={() => navigate('/coupons')}
            >
              {t('nav.coupons')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.fileSearch} />}
              aria-label={t('pages.orderTracking.emptyProfileOrders')}
              title={t('pages.orderTracking.emptyProfileOrders')}
              onClick={() => navigate('/profile?tab=orders')}
            >
              {t('pages.orderTracking.emptyProfileOrders')}
            </ShopButton>
            <ShopButton
              type="primary"
              size="large"
              icon={<ShopIcon path={SI.fileSearch} />}
              aria-label={trackOrderActionLabel}
              title={trackOrderActionLabel}
              onClick={openTrackOrder}
            >
              {t('pages.paymentInstructions.stickyTrackOrder')}
            </ShopButton>
          </div>
        </div>
      ) : null}
    </>
  );
};
