import React from 'react';
import { ShopIcon, SI } from '../ShopIcon';
import ShopButton from '../ShopButton';
import ShopProgress from '../ShopProgress';
import ShopTag from '../ShopTag';
import AddOnAssistant from '../AddOnAssistant';
import type { CheckoutTranslationFn, CheckoutCouponOpportunity } from '../../utils/checkoutHelpers';
import type { ProductPublic as Product } from '../../types';

type Translate = CheckoutTranslationFn;

export type CheckoutHighlightCard = {
  key: string;
  title: string;
  text: string;
};

export type CheckoutCoachItem = {
  key: string;
  icon: React.ReactNode;
  ready: boolean;
  title: string;
  text: string;
};

export type CheckoutReadinessItem = {
  key: string;
  ready: boolean;
  label: string;
  text: string;
};

export type CheckoutNextActionLike = {
  key?: string;
  text: string;
} | null;

export type CheckoutDeliveryPromiseView = {
  enabled: boolean;
  windowText: string;
  shipsToday: boolean;
  cutoffHour: number | string;
};

export type CheckoutHeroSectionProps = {
  t: Translate;
  highlights: CheckoutHighlightCard[];
};

export const CheckoutHeroSection: React.FC<CheckoutHeroSectionProps> = ({ t, highlights }) => (
  <section className="checkout-page__hero">
    <div className="checkout-page__heroContent">
      <span className="checkout-page__heroEyebrow">{t('pages.checkout.readinessEyebrow')}</span>
      <h1 className="checkout-page__title">{t('pages.checkout.title')}</h1>
      <span className="checkout-page__text">{t('pages.checkout.savingsCoachSubtitle')}</span>
    </div>
    <div className="checkout-page__heroStats">
      {highlights.map((item) => (
        <article key={item.key} className="checkout-page__heroStat">
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </article>
      ))}
    </div>
  </section>
);

export type CheckoutSummaryStripProps = {
  cards: CheckoutHighlightCard[];
};

export const CheckoutSummaryStrip: React.FC<CheckoutSummaryStripProps> = ({ cards }) => (
  <section className="checkout-page__summaryStrip">
    {cards.map((item) => (
      <article key={item.key} className="checkout-page__summaryStripCard">
        <strong>{item.title}</strong>
        <span>{item.text}</span>
      </article>
    ))}
  </section>
);

export type CheckoutConfirmationBandProps = {
  t: Translate;
  checkoutBlockingAction: CheckoutNextActionLike;
  checkoutNextAction: CheckoutNextActionLike;
  checkoutReadinessScore: number;
  checkoutItemCount: number;
  payableAmountText: string;
  shippingQuoteReady: boolean;
  selectedPaymentTitle?: string | null;
  submitting: boolean;
  checkoutSubmitDisabled: boolean;
  checkoutConfirmationActionLabel: string;
  checkoutSubmitActionLabel: string;
  checkoutSubmitTooltip: string;
  checkoutNextActionLabel: string;
  shippingFeeText: string;
  onNextAction: () => void;
  onSubmit: () => void;
};

export const CheckoutConfirmationBand: React.FC<CheckoutConfirmationBandProps> = ({
  t,
  checkoutBlockingAction,
  checkoutNextAction,
  checkoutReadinessScore,
  checkoutItemCount,
  payableAmountText,
  shippingQuoteReady,
  selectedPaymentTitle,
  submitting,
  checkoutSubmitDisabled,
  checkoutConfirmationActionLabel,
  checkoutSubmitActionLabel,
  checkoutSubmitTooltip,
  checkoutNextActionLabel,
  shippingFeeText,
  onNextAction,
  onSubmit,
}) => (
  <section
    className={
      checkoutBlockingAction
        ? 'checkout-page__confirmationBand checkout-page__confirmationBand--blocked'
        : checkoutNextAction
          ? 'checkout-page__confirmationBand'
          : 'checkout-page__confirmationBand checkout-page__confirmationBand--ready'
    }
    aria-label={t('pages.checkout.readinessTitle')}
    data-checkout-confirmation-state={checkoutBlockingAction ? 'blocked' : checkoutNextAction ? 'coach' : 'ready'}
  >
    <div className="checkout-page__confirmationScore">
      <ShopProgress type="circle" percent={checkoutReadinessScore} size={58} strokeColor="#124734" />
      <span>
        <span className="checkout-page__text checkout-page__text--strong">
          {checkoutNextAction ? t('pages.checkout.nextActionTitle') : t('pages.checkout.nextActionReadyTitle')}
        </span>
        <span className="checkout-page__text checkout-page__text--secondary">
          {checkoutNextAction ? checkoutNextAction.text : t('pages.checkout.nextActionReadyText')}
        </span>
      </span>
    </div>
    <div className="checkout-page__confirmationFacts">
      <span>
        <span className="checkout-page__text checkout-page__text--secondary">
          {t('pages.checkout.itemSummary', { count: checkoutItemCount })}
        </span>
        <span className={`checkout-page__text checkout-page__text--strong ${shippingQuoteReady ? 'commerce-money' : ''}`}>
          {payableAmountText}
        </span>
      </span>
      <span>
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.paymentMethod')}</span>
        <span className="checkout-page__text checkout-page__text--strong">
          {selectedPaymentTitle || t('pages.checkout.paymentConfidenceDefault')}
        </span>
      </span>
    </div>
    <ShopButton
      type="primary"
      className="checkout-page__confirmationButton"
      onClick={checkoutBlockingAction ? onNextAction : onSubmit}
      loading={submitting}
      disabled={!checkoutBlockingAction && checkoutSubmitDisabled}
      aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}
      title={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitTooltip}
    >
      {checkoutBlockingAction
        ? checkoutNextActionLabel
        : shippingQuoteReady
          ? t('pages.checkout.submitWithAmount', { amount: payableAmountText })
          : shippingFeeText}
    </ShopButton>
  </section>
);

export type CheckoutTrustBarProps = {
  t: Translate;
};

export const CheckoutTrustBar: React.FC<CheckoutTrustBarProps> = ({ t }) => (
  <div className="checkout-page__trustBar" aria-label={t('pages.checkout.trustTitle')}>
    <div className="checkout-page__trustItem">
      <ShopIcon path={SI.safety} />
      <div>
        <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.trustSecureTitle')}</span>
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.trustSecureText')}</span>
      </div>
    </div>
    <div className="checkout-page__trustItem">
      <ShopIcon path={SI.swap} />
      <div>
        <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.trustReturnsTitle')}</span>
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.trustReturnsText')}</span>
      </div>
    </div>
    <div className="checkout-page__trustItem">
      <ShopIcon path={SI.support} />
      <div>
        <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.trustSupportTitle')}</span>
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.trustSupportText')}</span>
      </div>
    </div>
  </div>
);

export type CheckoutBenefitStripProps = {
  t: Translate;
  freeShippingRemaining: number;
  freeShippingPercent: number;
  formatMoney: (value: number | null | undefined) => string;
  deliveryPromise: CheckoutDeliveryPromiseView;
  giftEligible: boolean;
  giftUnlocked: boolean;
  giftRemaining: number;
  giftProgress: number;
  giftName: string;
};

export const CheckoutBenefitStrip: React.FC<CheckoutBenefitStripProps> = ({
  t,
  freeShippingRemaining,
  freeShippingPercent,
  formatMoney,
  deliveryPromise,
  giftEligible,
  giftUnlocked,
  giftRemaining,
  giftProgress,
  giftName,
}) => (
  <section className="checkout-page__benefitStrip">
    <div className="checkout-page__benefitItem">
      <span className="checkout-page__benefitIcon"><ShopIcon path={SI.truck} /></span>
      <div>
        <span className="checkout-page__text checkout-page__text--strong">
          {freeShippingRemaining > 0
            ? t('pages.cart.freeShippingRemaining', { amount: formatMoney(freeShippingRemaining) })
            : t('pages.cart.freeShippingUnlocked')}
        </span>
        <ShopProgress percent={freeShippingPercent} showInfo={false} strokeColor="#124734" trailColor="#edf0ed" />
      </div>
    </div>
    {deliveryPromise.enabled ? (
      <div className="checkout-page__benefitItem">
        <span className="checkout-page__benefitIcon"><ShopIcon path={SI.safety} /></span>
        <div>
          <span className="checkout-page__text checkout-page__text--strong">
            {t('pages.checkout.deliveryPromise', { window: deliveryPromise.windowText })}
          </span>
          <span className="checkout-page__text checkout-page__text--secondary">
            {deliveryPromise.shipsToday
              ? t('pages.checkout.shipsToday', { cutoff: `${deliveryPromise.cutoffHour}:00` })
              : t('pages.checkout.shipsNextBusinessDay')}
          </span>
        </div>
      </div>
    ) : null}
    {giftEligible ? (
      <div className={giftUnlocked ? 'checkout-page__benefitItem checkout-page__benefitItem--ready' : 'checkout-page__benefitItem'}>
        <span className="checkout-page__benefitIcon">
          {giftUnlocked ? <ShopIcon path={SI.checkCircle} /> : <ShopIcon path={SI.gift} />}
        </span>
        <div>
          <span className="checkout-page__text checkout-page__text--strong">
            {giftUnlocked
              ? t('pages.checkout.giftUnlocked', { gift: giftName })
              : t('pages.checkout.giftRemaining', { amount: formatMoney(giftRemaining), gift: giftName })}
          </span>
          <ShopProgress
            percent={giftProgress}
            showInfo={false}
            strokeColor={giftUnlocked ? '#124734' : '#ffb84d'}
            trailColor="#edf0ed"
          />
        </div>
      </div>
    ) : null}
  </section>
);

export type CheckoutSupportCoachPanelProps = {
  t: Translate;
  supportPanelOpen: boolean;
  onSupportPanelToggle: (event: React.SyntheticEvent<HTMLDetailsElement>) => void;
  checkoutNextAction: CheckoutNextActionLike;
  checkoutReadinessScore: number;
  savingsCoachItems: CheckoutCoachItem[];
  addOnTarget: { remainingAmount: number; reason: 'shipping' | 'gift' } | null;
  cartProductIds: number[];
  savingsAddOnsActionLabel: string;
  onScrollToAddOns: () => void;
  onAddSuggestedProduct: (product: Product) => Promise<void>;
  couponOpportunity: CheckoutCouponOpportunity | null;
  couponOpportunityActionLabel: string;
  onCouponOpportunityAction: () => void;
  checkoutReadinessItems: CheckoutReadinessItem[];
  readinessActionLabel: string;
  coachActionLabel: string;
  onNextAction: () => void;
};

export const CheckoutSupportCoachPanel: React.FC<CheckoutSupportCoachPanelProps> = ({
  t,
  supportPanelOpen,
  onSupportPanelToggle,
  checkoutNextAction,
  checkoutReadinessScore,
  savingsCoachItems,
  addOnTarget,
  cartProductIds,
  savingsAddOnsActionLabel,
  onScrollToAddOns,
  onAddSuggestedProduct,
  couponOpportunity,
  couponOpportunityActionLabel,
  onCouponOpportunityAction,
  checkoutReadinessItems,
  readinessActionLabel,
  coachActionLabel,
  onNextAction,
}) => (
  <details
    className="checkout-page__supportPanel"
    open={supportPanelOpen}
    onToggle={onSupportPanelToggle}
  >
    <summary>
      <span>
        <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.savingsCoachTitle')}</span>
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.savingsCoachSubtitle')}</span>
      </span>
      <ShopTag color={checkoutNextAction ? 'orange' : 'green'}>{checkoutReadinessScore}%</ShopTag>
    </summary>

    <section className="checkout-page__savingsCoach">
      <div className="checkout-page__savingsCoachHeader">
        <div>
          <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.savingsCoachEyebrow')}</span>
          <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.savingsCoachTitle')}</span>
          <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.savingsCoachSubtitle')}</span>
        </div>
        {addOnTarget ? (
          <ShopButton
            size="small"
            icon={<ShopIcon path={SI.swap} />}
            className="checkout-page__addOnButton"
            aria-label={savingsAddOnsActionLabel}
            title={savingsAddOnsActionLabel}
            onClick={onScrollToAddOns}
          >
            {t('pages.checkout.savingsShopAddOns')}
          </ShopButton>
        ) : null}
      </div>
      <div className="checkout-page__savingsCoachGrid">
        {savingsCoachItems.map((item) => (
          <div
            className={item.ready ? 'checkout-page__savingsCoachItem checkout-page__savingsCoachItem--ready' : 'checkout-page__savingsCoachItem'}
            key={item.key}
          >
            <span className="checkout-page__savingsCoachIcon">
              {item.ready ? <ShopIcon path={SI.checkCircle} /> : item.icon}
            </span>
            <span>
              <span className="checkout-page__text checkout-page__text--strong">{item.title}</span>
              <span className="checkout-page__text checkout-page__text--secondary">{item.text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>

    {addOnTarget ? (
      <div id="checkout-add-on-assistant" className="checkout-page__addOnDock">
        <AddOnAssistant
          cartProductIds={cartProductIds}
          remainingAmount={addOnTarget.remainingAmount}
          reason={addOnTarget.reason}
          onAdd={onAddSuggestedProduct}
        />
      </div>
    ) : null}

    {couponOpportunity ? (
      <section
        className={
          couponOpportunity.type === 'ready'
            ? 'checkout-page__couponOpportunity checkout-page__couponOpportunity--ready'
            : 'checkout-page__couponOpportunity'
        }
      >
        <div>
          <span className="checkout-page__text checkout-page__text--strong">{couponOpportunity.title}</span>
          <span className="checkout-page__text checkout-page__text--secondary">{couponOpportunity.text}</span>
        </div>
        <ShopButton
          size="small"
          type={couponOpportunity.type === 'ready' ? 'default' : 'primary'}
          className="checkout-page__addOnButton"
          aria-label={couponOpportunityActionLabel}
          title={couponOpportunityActionLabel}
          onClick={onCouponOpportunityAction}
        >
          {couponOpportunity.action}
        </ShopButton>
      </section>
    ) : null}

    <section className="checkout-page__readiness">
      <div className="checkout-page__readinessHeader">
        <div>
          <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.readinessEyebrow')}</span>
          <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.readinessTitle')}</span>
        </div>
        <ShopProgress type="circle" percent={checkoutReadinessScore} size={64} strokeColor="#124734" />
      </div>
      <div className="checkout-page__readinessGrid">
        {checkoutReadinessItems.map((item) => (
          <div
            className={item.ready ? 'checkout-page__readinessItem checkout-page__readinessItem--ready' : 'checkout-page__readinessItem'}
            key={item.key}
          >
            <ShopIcon path={SI.checkCircle} />
            <span>
              <span className="checkout-page__text checkout-page__text--strong">{item.label}</span>
              <span className="checkout-page__text checkout-page__text--secondary">{item.text}</span>
            </span>
          </div>
        ))}
      </div>
      <div className={checkoutNextAction ? 'checkout-page__nextAction' : 'checkout-page__nextAction checkout-page__nextAction--ready'}>
        <span>
          <span className="checkout-page__text checkout-page__text--strong">
            {checkoutNextAction
              ? t('pages.checkout.nextActionTitle')
              : t('pages.checkout.nextActionReadyTitle')}
          </span>
          <span className="checkout-page__text checkout-page__text--secondary">
            {checkoutNextAction
              ? checkoutNextAction.text
              : t('pages.checkout.nextActionReadyText')}
          </span>
        </span>
        <ShopButton
          size="small"
          type={checkoutNextAction ? 'primary' : 'default'}
          aria-label={readinessActionLabel}
          title={readinessActionLabel}
          onClick={onNextAction}
        >
          {coachActionLabel}
        </ShopButton>
      </div>
    </section>
  </details>
);
