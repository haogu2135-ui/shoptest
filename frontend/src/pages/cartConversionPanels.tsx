import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopProgress from '../components/ShopProgress';
import { ShopIcon, SI } from '../components/ShopIcon';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type CartPaymentReturnBannerProps = {
  cartItemCount: number;
  clearPaymentReturnParams: () => void;
  navigate: NavigateFunction;
  paymentCancelledCheckoutLabel: string;
  paymentCancelledResumeLabel: string;
  paymentCancelledTrackLabel: string;
  paymentReturnOrderNo: string;
  paymentReturnStatus: string;
  t: Translate;
};

/** Commercial payment-return recovery banner for cancelled/failed checkout returns. */
export const CartPaymentReturnBanner: React.FC<CartPaymentReturnBannerProps> = ({
  cartItemCount,
  clearPaymentReturnParams,
  navigate,
  paymentCancelledCheckoutLabel,
  paymentCancelledResumeLabel,
  paymentCancelledTrackLabel,
  paymentReturnOrderNo,
  paymentReturnStatus,
  t,
}) => (
  <ShopAlert
    className="cart-page__paymentReturn"
    type={paymentReturnStatus === 'failed' ? 'error' : 'warning'}
    showIcon
    closable
    role="alert"
    aria-live="assertive"
    onClose={clearPaymentReturnParams}
    message={paymentReturnStatus === 'failed'
      ? t('pages.cart.paymentFailedTitle')
      : t('pages.cart.paymentCancelledTitle')}
    description={paymentReturnOrderNo
      ? t(
        paymentReturnStatus === 'failed'
          ? 'pages.cart.paymentFailedOrderText'
          : 'pages.cart.paymentCancelledOrderText',
        { orderNo: paymentReturnOrderNo },
      )
      : t(
        paymentReturnStatus === 'failed'
          ? 'pages.cart.paymentFailedText'
          : 'pages.cart.paymentCancelledText',
      )}
    action={(
      <div className="cart-page__paymentReturnActions">
        <ShopButton
          type="primary"
          size="small"
          aria-label={paymentCancelledResumeLabel}
          title={paymentCancelledResumeLabel}
          onClick={() => {
            clearPaymentReturnParams();
            navigate(paymentReturnOrderNo
              ? `/profile?tab=orders&orderNo=${encodeURIComponent(paymentReturnOrderNo)}`
              : '/profile?tab=orders');
          }}
        >
          {t('pages.cart.paymentCancelledResume')}
        </ShopButton>
        {paymentReturnOrderNo ? (
          <ShopButton
            size="small"
            aria-label={paymentCancelledTrackLabel}
            title={paymentCancelledTrackLabel}
            onClick={() => {
              clearPaymentReturnParams();
              navigate(`/track-order?orderNo=${encodeURIComponent(paymentReturnOrderNo)}`);
            }}
          >
            {t('pages.cart.paymentCancelledTrack')}
          </ShopButton>
        ) : null}
        {cartItemCount > 0 ? (
          <ShopButton
            size="small"
            aria-label={paymentCancelledCheckoutLabel}
            title={paymentCancelledCheckoutLabel}
            onClick={() => {
              clearPaymentReturnParams();
              navigate('/checkout');
            }}
          >
            {t('pages.cart.checkout')}
          </ShopButton>
        ) : (
          <ShopButton
            size="small"
            aria-label={t('pages.cart.browse')}
            title={t('pages.cart.browse')}
            onClick={() => {
              clearPaymentReturnParams();
              navigate('/products');
            }}
          >
            {t('pages.cart.browse')}
          </ShopButton>
        )}
      </div>
    )}
  />
);

export type CartInlineEmptyPanelProps = {
  emptyBrowseActionLabel: string;
  emptyCouponsActionLabel: string;
  emptyHistoryActionLabel: string;
  emptyPetFinderActionLabel: string;
  navigate: NavigateFunction;
  t: Translate;
};

/** Commercial in-page empty cart multipath panel (when recovery rails remain). */
export const CartInlineEmptyPanel: React.FC<CartInlineEmptyPanelProps> = ({
  emptyBrowseActionLabel,
  emptyCouponsActionLabel,
  emptyHistoryActionLabel,
  emptyPetFinderActionLabel,
  navigate,
  t,
}) => (
  <section className="cart-page__emptyPanel" role="status">
    <div className="cart-page__emptyPanelInner" role="status" aria-live="polite">
      <span className="cart-page__emptyPanelIconWrap" aria-hidden="true">
        <ShopIcon path={SI.shopping} className="cart-page__emptyPanelIcon" />
      </span>
      <div className="cart-page__emptyPanelDescription">{t('pages.cart.empty')}</div>
      <div className="cart-page__emptyPanelActions" data-cart-empty-panel-actions="true">
        <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} aria-label={emptyBrowseActionLabel} title={emptyBrowseActionLabel} onClick={() => navigate('/products')}>
          {t('pages.cart.browse')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyCouponsActionLabel} title={emptyCouponsActionLabel} onClick={() => navigate('/coupons')}>
          {t('nav.coupons')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={emptyPetFinderActionLabel} title={emptyPetFinderActionLabel} onClick={() => navigate('/pet-finder')}>
          {t('nav.petFinder')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.clock} />} aria-label={emptyHistoryActionLabel} title={emptyHistoryActionLabel} onClick={() => navigate('/history')}>
          {t('nav.history')}
        </ShopButton>
      </div>
    </div>
  </section>
);

export type CartOrderSummaryProps = {
  checkoutActionLabel: string;
  checkoutBlocked: boolean;
  checkoutSubmitting: boolean;
  formatMoney: (amount?: number | null) => string;
  freeShippingPercent: number;
  freeShippingStatusTitle: React.ReactNode;
  freeShippingUnlocked: boolean;
  goCheckout: () => void;
  hasStaleCartData: boolean;
  selectedTotal: number;
  selectedUnitCount: number;
  t: Translate;
};

/** Commercial cart order summary: free-shipping progress, total, checkout CTA, trust bar. */
export const CartOrderSummary: React.FC<CartOrderSummaryProps> = ({
  checkoutActionLabel,
  checkoutBlocked,
  checkoutSubmitting,
  formatMoney,
  freeShippingPercent,
  freeShippingStatusTitle,
  freeShippingUnlocked,
  goCheckout,
  hasStaleCartData,
  selectedTotal,
  selectedUnitCount,
  t,
}) => (
  <section className="cart-page__summary" aria-label={t('pages.cart.orderSummary')}>
    <div
      className="cart-page__summaryProgress"
      role="group"
      aria-label={t('pages.cart.freeShippingProgressLabel')}
    >
      <span className="cart-page__text cart-page__text--strong" id="cart-free-shipping-status">
        {freeShippingStatusTitle}
      </span>
      <ShopProgress
        percent={freeShippingPercent}
        showInfo={false}
        strokeColor="#124734"
        aria-labelledby="cart-free-shipping-status"
        format={() => t('pages.cart.freeShippingProgressValue', { percent: freeShippingPercent })}
      />
      <span className="cart-page__srOnly" aria-live="polite">
        {freeShippingUnlocked
          ? t('pages.cart.freeShippingUnlocked')
          : t('pages.cart.freeShippingProgressValue', { percent: freeShippingPercent })}
      </span>
    </div>
    <div className="cart-page__summaryFooter">
      <div>
        <span className="cart-page__text">{t('pages.cart.selectedSummary', { count: selectedUnitCount })}</span>
        <span className="cart-page__text cart-page__total">
          {t('common.total')}: <span className="cart-page__text cart-page__text--strong cart-page__totalAmount commerce-money">{formatMoney(selectedTotal)}</span>
        </span>
      </div>
      <ShopButton type="primary" size="large" aria-label={checkoutActionLabel} title={checkoutActionLabel} onClick={goCheckout} disabled={hasStaleCartData || checkoutBlocked || checkoutSubmitting} loading={checkoutSubmitting}>
        {checkoutSubmitting ? t('pages.cart.checkoutSyncing') : t('pages.cart.checkout')}
      </ShopButton>
    </div>
    <div className="cart-page__trustBar" aria-label={t('pages.cart.trustTitle')}>
      <div className="cart-page__trustItem">
        <ShopIcon path={SI.lock} aria-hidden="true" />
        <div>
          <span className="cart-page__text cart-page__text--strong">{t('pages.cart.trustSecureTitle')}</span>
          <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.trustSecureText')}</span>
        </div>
      </div>
      <div className="cart-page__trustItem">
        <ShopIcon path={SI.safety} aria-hidden="true" />
        <div>
          <span className="cart-page__text cart-page__text--strong">{t('pages.cart.trustReturnsTitle')}</span>
          <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.trustReturnsText')}</span>
        </div>
      </div>
      <div className="cart-page__trustItem">
        <ShopIcon path={SI.support} aria-hidden="true" />
        <div>
          <span className="cart-page__text cart-page__text--strong">{t('pages.cart.trustSupportTitle')}</span>
          <span className="cart-page__text cart-page__text--secondary">{t('pages.cart.trustSupportText')}</span>
        </div>
      </div>
    </div>
  </section>
);
