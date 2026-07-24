import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { CouponPublic, UserCoupon } from '../types';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopInput from '../components/ShopInput';
import ShopSelect from '../components/ShopSelect';
import {
  getCouponEstimatedValue,
  getCouponRemaining,
  getDaysUntilEnd,
  isCouponEndingSoon,
  toFiniteNumber,
  type CouponFilter,
  type CouponSort,
} from '../utils/couponCenter';
import { getCouponUiText } from '../utils/couponUiText';
import {
  couponStatusColor,
  getCouponDisplayName,
  isFallbackCoupon,
  type WalletFilter,
} from './couponCenterPageHelpers';
import type { CouponCenterTranslate } from './couponCenterShellStates';

export type CouponNextAction = {
  tone: string;
  title: string;
  text: string;
  label: string;
  action: () => void;
};

export type CouponInsights = {
  expiringSoon: number;
  limitedStock: number;
  bestCoupon?: CouponPublic;
  unusedMine: number;
  nextToUse?: UserCoupon;
  targetCoupon?: CouponPublic | UserCoupon;
};

export type CouponWalletGuide = {
  nextExpiring?: UserCoupon;
  strongestSaved?: UserCoupon;
};

export type CouponCenterPanelsProps = {
  t: CouponCenterTranslate;
  navigate: NavigateFunction;
  formatMoney: (value?: number | null) => string;
  formatCouponDate: (value?: string) => string;
  formatWalletStatusLabel: (status?: string) => string;
  formatDaysBadge: (days: number | null | undefined, fallback?: string) => string;
  describeCoupon: (coupon: Pick<CouponPublic, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>) => string;
  couponUiText: ReturnType<typeof getCouponUiText>;
  isAuthenticated: boolean;
  claimingId: number | null;
  claimingAll: boolean;
  claimBatchSummary: { claimed: number; total: number } | null;
  cartSubtotal: number;
  cartItemCount: number;
  publicCoupons: CouponPublic[];
  myCoupons: UserCoupon[];
  claimableCoupons: CouponPublic[];
  sortedClaimablePublicCoupons: CouponPublic[];
  filteredClaimablePublicCoupons: CouponPublic[];
  ownedCouponIds: Set<number>;
  couponInsights: CouponInsights;
  couponNextAction: CouponNextAction;
  targetThreshold: number;
  hasCouponTarget: boolean;
  couponCartGap: number;
  bestCouponIsPreview: boolean;
  bestCouponValue: number;
  couponThresholdProgress: number;
  couponProgressValueText: string;
  mobileCouponProgressLabel: string;
  nextCouponProgressLabel: string;
  couponActionBusy: boolean;
  claimAllActionDisabled: boolean;
  showClaimCta: boolean;
  primaryClaimLabel: string;
  primaryClaimActionLabel: string;
  couponNextActionLabel: string;
  goShoppingActionLabel: string;
  bestCouponActionLabel: string;
  nextUseActionLabel: string;
  hideMobileSecondaryAction: boolean;
  hasAnyCouponAction: boolean;
  couponFilter: CouponFilter;
  setCouponFilter: React.Dispatch<React.SetStateAction<CouponFilter>>;
  couponSearch: string;
  setCouponSearch: React.Dispatch<React.SetStateAction<string>>;
  couponSort: CouponSort;
  setCouponSort: React.Dispatch<React.SetStateAction<CouponSort>>;
  couponSortLabels: Record<CouponSort, string>;
  couponFilterOptions: Array<{ key: CouponFilter; label: string; count: number }>;
  hasActiveCouponControls: boolean | string;
  publicClaimStats: { matched: number; saved: number; total: number };
  walletFilter: WalletFilter;
  setWalletFilter: React.Dispatch<React.SetStateAction<WalletFilter>>;
  couponWalletStats: { unused: number; used: number; expired: number };
  filteredWalletCoupons: UserCoupon[];
  walletGuide: CouponWalletGuide;
  bestPublicCouponId?: number;
  scrollToSection: (id: string) => void;
  claimCoupon: (couponId: number) => void | Promise<void>;
  claimAllCoupons: () => void | Promise<void>;
  beginPriorityDrag: (event: React.PointerEvent<HTMLElement>) => void;
  movePriorityDrag: (event: React.PointerEvent<HTMLElement>) => void;
  endPriorityDrag: (event: React.PointerEvent<HTMLElement>) => void;
  cancelPriorityClickAfterDrag: (event: React.MouseEvent<HTMLElement>) => void;
};

/** Hero + quick nav + mobile conversion chrome. */
export const CouponCenterConversionPanels: React.FC<CouponCenterPanelsProps> = (p) => {
  const {
    t,
    navigate,
    formatMoney,
    formatCouponDate,
    formatWalletStatusLabel,
    formatDaysBadge,
    describeCoupon,
    couponUiText,
    isAuthenticated,
    claimingId,
    claimingAll,
    claimBatchSummary,
    cartSubtotal,
    cartItemCount,
    publicCoupons,
    myCoupons,
    claimableCoupons,
    sortedClaimablePublicCoupons,
    filteredClaimablePublicCoupons,
    ownedCouponIds,
    couponInsights,
    couponNextAction,
    targetThreshold,
    hasCouponTarget,
    couponCartGap,
    bestCouponIsPreview,
    bestCouponValue,
    couponThresholdProgress,
    couponProgressValueText,
    mobileCouponProgressLabel,
    nextCouponProgressLabel,
    couponActionBusy,
    claimAllActionDisabled,
    showClaimCta,
    primaryClaimLabel,
    primaryClaimActionLabel,
    couponNextActionLabel,
    goShoppingActionLabel,
    bestCouponActionLabel,
    nextUseActionLabel,
    hideMobileSecondaryAction,
    hasAnyCouponAction,
    couponFilter,
    setCouponFilter,
    couponSearch,
    setCouponSearch,
    couponSort,
    setCouponSort,
    couponSortLabels,
    couponFilterOptions,
    hasActiveCouponControls,
    publicClaimStats,
    walletFilter,
    setWalletFilter,
    couponWalletStats,
    filteredWalletCoupons,
    walletGuide,
    bestPublicCouponId,
    scrollToSection,
    claimCoupon,
    claimAllCoupons,
    beginPriorityDrag,
    movePriorityDrag,
    endPriorityDrag,
    cancelPriorityClickAfterDrag,
  } = p;
  return (
    <>
      <section className={`coupon-center-page__hero coupon-center-page__hero--${couponNextAction.tone}`}>
        <div className="coupon-center-page__heroCopy">
          <span className="coupon-center-page__text coupon-center-page__eyebrow">{t('pages.coupons.title')}</span>
          <h1 className="coupon-center-page__title"><ShopIcon path={SI.gift} /> {t('pages.coupons.opportunityTitle')}</h1>
          <span className="coupon-center-page__text coupon-center-page__heroText">
            {couponInsights.bestCoupon
              ? t('pages.coupons.opportunitySubtitleBest', { name: couponInsights.bestCoupon.name })
              : t('pages.coupons.opportunitySubtitle')}
          </span>
          <div className="coupon-center-page__heroActions">
            <ShopButton
              type="primary"
              loading={showClaimCta && isAuthenticated ? claimingAll : false}
              disabled={showClaimCta ? (isAuthenticated ? claimAllActionDisabled : couponActionBusy) : couponActionBusy}
              aria-label={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
              title={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
              onClick={showClaimCta ? claimAllCoupons : couponNextAction.action}
            >
              {showClaimCta ? primaryClaimLabel : couponNextAction.label}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              className={hideMobileSecondaryAction ? 'coupon-center-page__secondaryAction--hidden' : undefined}
              aria-label={goShoppingActionLabel}
              title={goShoppingActionLabel}
              onClick={() => navigate('/products')}
            >
              {t('pages.coupons.goShopping')}
            </ShopButton>
          </div>
          <div className="coupon-center-page__heroBadges" aria-label={t('pages.coupons.opportunitySummaryTitle')}>
            <span className={bestCouponValue > 0 ? 'coupon-center-page__heroBadge coupon-center-page__heroBadge--primary' : 'coupon-center-page__heroBadge coupon-center-page__heroBadge--primary coupon-center-page__heroBadge--muted'}>
              <ShopIcon path={SI.gift} />
              {bestCouponValue > 0 ? <span className="commerce-money">{formatMoney(bestCouponValue)}</span> : t('pages.coupons.noBestClaim')}
            </span>
            <span className={couponInsights.expiringSoon > 0 ? 'coupon-center-page__heroBadge' : 'coupon-center-page__heroBadge coupon-center-page__heroBadge--muted'}>
              <ShopIcon path={SI.clock} />
              {t('pages.coupons.expiringSoon')}: {couponInsights.expiringSoon}
            </span>
            <span className={couponInsights.unusedMine > 0 ? 'coupon-center-page__heroBadge' : 'coupon-center-page__heroBadge coupon-center-page__heroBadge--muted'}>
              <ShopIcon path={SI.thunder} />
              {t('pages.coupons.readyToUse')}: {couponInsights.unusedMine}
            </span>
          </div>
        </div>
        <div className="coupon-center-page__heroStats" aria-label={t('pages.coupons.title')}>
          <div className="coupon-center-page__statGrid">
            <div className={claimableCoupons.length === 0 ? 'coupon-center-page__statCard coupon-center-page__statCard--empty' : 'coupon-center-page__statCard'}>
              <span className="coupon-center-page__statIcon"><ShopIcon path={SI.gift} /></span>
              <strong>{claimableCoupons.length}</strong>
              <span>{t('pages.coupons.claimableCount')}</span>
            </div>
            <div className={couponInsights.unusedMine === 0 ? 'coupon-center-page__statCard coupon-center-page__statCard--empty' : 'coupon-center-page__statCard'}>
              <span className="coupon-center-page__statIcon"><ShopIcon path={SI.thunder} /></span>
              <strong>{couponInsights.unusedMine}</strong>
              <span>{t('pages.coupons.readyToUse')}</span>
            </div>
            <div className="coupon-center-page__statCard coupon-center-page__statCard--cart">
              <span className="coupon-center-page__statIcon"><ShopIcon path={SI.shopping} /></span>
              <strong className="commerce-money">{formatMoney(cartSubtotal)}</strong>
              <span>{t('pages.coupons.currentCartValue')}</span>
            </div>
          </div>
          <div className={`coupon-center-page__heroPlan coupon-center-page__heroPlan--${couponNextAction.tone}`}>
            <span className="coupon-center-page__text coupon-center-page__text--secondary">{t('pages.coupons.nextActionEyebrow')}</span>
            <strong>{couponNextAction.title}</strong>
            <span>{couponNextAction.text}</span>
            <ShopButton
              size="small"
              type="primary"
              aria-label={couponNextActionLabel}
              title={couponNextActionLabel}
              onClick={couponNextAction.action}
              disabled={claimingAll || claimingId != null || (isAuthenticated && bestCouponIsPreview)}
            >
              {couponNextAction.label}
            </ShopButton>
          </div>
        </div>
      </section>

      <nav className="coupon-center-page__quickNav" aria-label={t('pages.coupons.title')}>
        <button
          type="button"
          className={couponThresholdProgress <= 0 ? 'coupon-center-page__quickNavItem--muted' : undefined}
          aria-label={`${t('pages.coupons.nextActionEyebrow')}: ${couponThresholdProgress}%`}
          title={`${t('pages.coupons.nextActionEyebrow')}: ${couponThresholdProgress}%`}
          onClick={() => scrollToSection('coupon-next-action')}
        >
          <ShopIcon path={SI.thunder} /> <span className="coupon-center-page__quickNavLabel">{t('pages.coupons.nextActionEyebrow')}</span> <span className="coupon-center-page__quickNavCount">{couponThresholdProgress}%</span>
        </button>
        <button
          type="button"
          className={sortedClaimablePublicCoupons.length === 0 ? 'coupon-center-page__quickNavItem--muted' : undefined}
          aria-label={`${t('pages.coupons.claimTitle')}: ${sortedClaimablePublicCoupons.length}`}
          title={`${t('pages.coupons.claimTitle')}: ${sortedClaimablePublicCoupons.length}`}
          onClick={() => scrollToSection('coupon-claim-list')}
        >
          <ShopIcon path={SI.gift} /> <span className="coupon-center-page__quickNavLabel">{t('pages.coupons.claimTitle')}</span> <span className="coupon-center-page__quickNavCount">{sortedClaimablePublicCoupons.length}</span>
        </button>
        <button
          type="button"
          className={myCoupons.length === 0 ? 'coupon-center-page__quickNavItem--muted' : undefined}
          aria-label={`${t('pages.coupons.myCoupons')}: ${myCoupons.length}`}
          title={`${t('pages.coupons.myCoupons')}: ${myCoupons.length}`}
          onClick={() => scrollToSection('coupon-wallet')}
        >
          <ShopIcon path={SI.clock} /> <span className="coupon-center-page__quickNavLabel">{t('pages.coupons.myCoupons')}</span> <span className="coupon-center-page__quickNavCount">{myCoupons.length}</span>
        </button>
      </nav>

      <div className={hideMobileSecondaryAction ? 'coupon-center-page__mobileActionBar coupon-center-page__mobileActionBar--single' : 'coupon-center-page__mobileActionBar'}>
        <div className="coupon-center-page__mobileActionInsight">
          <span>{couponNextAction.title}</span>
          <strong>
            {hasCouponTarget
              ? couponCartGap > 0
                ? <span className="commerce-money">{formatMoney(couponCartGap)}</span>
                : t('pages.coupons.useNext')
              : <span className="commerce-money">{formatMoney(cartSubtotal)}</span>}
          </strong>
        </div>
        <div
          className="coupon-center-page__mobileActionProgress"
          role="progressbar"
          aria-label={mobileCouponProgressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={couponThresholdProgress}
          aria-valuetext={couponProgressValueText}
          style={{ ['--coupon-mobile-progress' as string]: `${couponThresholdProgress}%` }}
        >
          <span />
        </div>
        <ShopButton
          type="primary"
          loading={showClaimCta ? claimingAll : false}
          disabled={showClaimCta ? (isAuthenticated ? claimAllActionDisabled : couponActionBusy) : couponActionBusy}
          aria-label={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
          title={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
          onClick={showClaimCta ? claimAllCoupons : couponNextAction.action}
        >
          {showClaimCta ? primaryClaimLabel : couponNextAction.label}
        </ShopButton>
        <ShopButton
          icon={<ShopIcon path={SI.shopping} />}
          className={hideMobileSecondaryAction ? 'coupon-center-page__secondaryAction--hidden' : undefined}
          aria-label={goShoppingActionLabel}
          title={goShoppingActionLabel}
          onClick={() => navigate('/products')}
        >
          {t('pages.coupons.goShopping')}
        </ShopButton>
      </div>

      <div className={hasAnyCouponAction ? 'coupon-section-header' : 'coupon-section-header coupon-section-header--quiet'}>
        <div>
          <span className="coupon-center-page__text coupon-center-page__text--secondary">{t('pages.coupons.opportunityEyebrow')}</span>
          <h2>{t('pages.coupons.opportunitySummaryTitle')}</h2>
        </div>
        <span>{t('pages.coupons.opportunitySummaryText')}</span>
      </div>
    </>
  );
};

/** Priority rail, savings path, and next-action plan. */
export const CouponCenterOpportunityPanels: React.FC<CouponCenterPanelsProps> = (p) => {
  const {
    t,
    navigate,
    formatMoney,
    formatCouponDate,
    formatWalletStatusLabel,
    formatDaysBadge,
    describeCoupon,
    couponUiText,
    isAuthenticated,
    claimingId,
    claimingAll,
    claimBatchSummary,
    cartSubtotal,
    cartItemCount,
    publicCoupons,
    myCoupons,
    claimableCoupons,
    sortedClaimablePublicCoupons,
    filteredClaimablePublicCoupons,
    ownedCouponIds,
    couponInsights,
    couponNextAction,
    targetThreshold,
    hasCouponTarget,
    couponCartGap,
    bestCouponIsPreview,
    bestCouponValue,
    couponThresholdProgress,
    couponProgressValueText,
    mobileCouponProgressLabel,
    nextCouponProgressLabel,
    couponActionBusy,
    claimAllActionDisabled,
    showClaimCta,
    primaryClaimLabel,
    primaryClaimActionLabel,
    couponNextActionLabel,
    goShoppingActionLabel,
    bestCouponActionLabel,
    nextUseActionLabel,
    hideMobileSecondaryAction,
    hasAnyCouponAction,
    couponFilter,
    setCouponFilter,
    couponSearch,
    setCouponSearch,
    couponSort,
    setCouponSort,
    couponSortLabels,
    couponFilterOptions,
    hasActiveCouponControls,
    publicClaimStats,
    walletFilter,
    setWalletFilter,
    couponWalletStats,
    filteredWalletCoupons,
    walletGuide,
    bestPublicCouponId,
    scrollToSection,
    claimCoupon,
    claimAllCoupons,
    beginPriorityDrag,
    movePriorityDrag,
    endPriorityDrag,
    cancelPriorityClickAfterDrag,
  } = p;
  return (
    <>
      <section
        className={!couponInsights.bestCoupon && !couponInsights.nextToUse ? 'coupon-priority-grid coupon-priority-grid--empty' : 'coupon-priority-grid'}
        onClickCapture={cancelPriorityClickAfterDrag}
        onPointerCancel={endPriorityDrag}
        onPointerDown={beginPriorityDrag}
        onPointerLeave={endPriorityDrag}
        onPointerMove={movePriorityDrag}
        onPointerUp={endPriorityDrag}
      >
        <div className={couponInsights.bestCoupon ? 'coupon-priority-card coupon-priority-card--claim' : 'coupon-priority-card coupon-priority-card--claim coupon-priority-card--empty'}>
          <span className="coupon-center-page__text coupon-center-page__text--secondary coupon-priority-card__label">
            <ShopIcon path={SI.gift} /> {t('pages.coupons.bestClaimEyebrow')}
          </span>
          <h3>{couponInsights.bestCoupon?.name || t('pages.coupons.noBestClaim')}</h3>
          <p>
            {couponInsights.bestCoupon
              ? describeCoupon(couponInsights.bestCoupon)
              : t('pages.coupons.noBestClaimHint')}
          </p>
          <div className="coupon-center-page__actionRow">
            {(() => {
              const bestCouponExpiry = formatCouponDate(couponInsights.bestCoupon?.endAt);
              return bestCouponExpiry ? (
                <ShopTag color="volcano">{t('pages.coupons.validUntil', { time: bestCouponExpiry })}</ShopTag>
              ) : null;
            })()}
            {couponInsights.bestCoupon ? (
              <ShopButton
                type="primary"
                loading={claimingId === couponInsights.bestCoupon.id}
                disabled={claimingAll || claimingId != null || (isAuthenticated && bestCouponIsPreview)}
                aria-label={bestCouponActionLabel}
                title={bestCouponActionLabel}
                onClick={() => claimCoupon(couponInsights.bestCoupon!.id)}
              >
                {bestCouponIsPreview ? t('pages.coupons.preview') : t('pages.coupons.claimBest')}
              </ShopButton>
            ) : (
              <ShopButton aria-label={goShoppingActionLabel} title={goShoppingActionLabel} onClick={() => navigate('/products')}>{t('pages.coupons.goShopping')}</ShopButton>
            )}
          </div>
        </div>
        <div className={couponInsights.nextToUse ? 'coupon-priority-card coupon-priority-card--use' : 'coupon-priority-card coupon-priority-card--use coupon-priority-card--empty'}>
          <span className="coupon-center-page__text coupon-center-page__text--secondary coupon-priority-card__label">
            <ShopIcon path={SI.clock} /> {t('pages.coupons.nextUseEyebrow')}
          </span>
          <h3>{couponInsights.nextToUse?.couponName || t('pages.coupons.noNextUse')}</h3>
          <p>
            {couponInsights.nextToUse
              ? t('pages.coupons.nextUseHint', { value: describeCoupon(couponInsights.nextToUse) })
              : t('pages.coupons.noNextUseHint')}
          </p>
          <div className="coupon-center-page__actionRow">
            {couponInsights.nextToUse?.endAt ? (
              <ShopTag color={(getDaysUntilEnd(couponInsights.nextToUse.endAt) ?? 99) <= 3 ? 'volcano' : 'blue'}>
                {t('pages.coupons.daysLeft', { count: Math.max(0, getDaysUntilEnd(couponInsights.nextToUse.endAt) || 0) })}
              </ShopTag>
            ) : null}
            <ShopButton icon={<ShopIcon path={SI.shopping} />} aria-label={nextUseActionLabel} title={nextUseActionLabel} onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}>
              {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
            </ShopButton>
          </div>
        </div>
      </section>

      <div className={!hasCouponTarget ? 'coupon-guidance-grid coupon-guidance-grid--neutral' : 'coupon-guidance-grid'}>
        <section className={!hasCouponTarget ? 'coupon-savings-path coupon-savings-path--neutral' : 'coupon-savings-path'} aria-label={t('pages.coupons.savingsPathTitle')}>
          <div>
            <span className="coupon-center-page__text coupon-center-page__text--secondary">{t('pages.coupons.savingsPathEyebrow')}</span>
            <h3>{t('pages.coupons.savingsPathTitle')}</h3>
            <p>
              {couponInsights.targetCoupon
                ? couponInsights.targetCoupon.thresholdAmount
                  ? t('pages.coupons.savingsPathHint', {
                    name: getCouponDisplayName(couponInsights.targetCoupon),
                    threshold: formatMoney(couponInsights.targetCoupon.thresholdAmount),
                  })
                  : t('pages.coupons.savingsPathHintNoThreshold', {
                    name: getCouponDisplayName(couponInsights.targetCoupon),
                  })
                : t('pages.coupons.savingsPathEmpty')}
            </p>
          </div>
          <div className="coupon-savings-path__steps">
            <span>{couponInsights.bestCoupon ? t('pages.coupons.pathStepClaim') : hasCouponTarget ? t('pages.coupons.pathStepWalletReady') : t('pages.coupons.pathStepBrowse')}</span>
            <span>{couponInsights.targetCoupon?.thresholdAmount ? t('pages.coupons.pathStepThreshold', { amount: formatMoney(couponInsights.targetCoupon.thresholdAmount) }) : t('pages.coupons.pathStepBrowse')}</span>
            <span>{couponInsights.nextToUse ? t('pages.coupons.pathStepUse') : hasCouponTarget ? t('pages.coupons.pathStepCheckout') : t('pages.coupons.pathStepBrowse')}</span>
          </div>
          <ShopButton
            type="primary"
            icon={<ShopIcon path={SI.shopping} />}
            aria-label={nextUseActionLabel}
            title={nextUseActionLabel}
            onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}
          >
            {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
          </ShopButton>
        </section>

        <section id="coupon-next-action" className={`coupon-next-action coupon-next-action--${couponNextAction.tone}`} aria-label={t('pages.coupons.nextActionEyebrow')}>
          <div>
            <span className="coupon-center-page__text coupon-center-page__text--secondary">{t('pages.coupons.nextActionEyebrow')}</span>
            <h3>{couponNextAction.title}</h3>
            <p>{couponNextAction.text}</p>
          </div>
          <div className="coupon-next-action__meta">
            <span className="coupon-next-action__metaItem coupon-next-action__metaItem--cart">
              <strong className="commerce-money">{formatMoney(cartSubtotal)}</strong>
              <span className="coupon-center-page__text coupon-center-page__text--secondary">{t('pages.coupons.currentCartValue')}</span>
            </span>
            <span className={hasCouponTarget ? 'coupon-next-action__metaItem' : 'coupon-next-action__metaItem coupon-next-action__metaItem--empty'}>
              <strong className="commerce-money">{couponCartGap > 0 ? formatMoney(couponCartGap) : formatMoney(0)}</strong>
              <span className="coupon-center-page__text coupon-center-page__text--secondary">{hasCouponTarget ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.noBestClaim')}</span>
            </span>
          </div>
          <div
            className="coupon-next-action__progress"
            role="progressbar"
            aria-label={nextCouponProgressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={couponThresholdProgress}
            aria-valuetext={couponProgressValueText}
            style={{ ['--coupon-progress' as string]: `${couponThresholdProgress}%` }}
          >
            <span />
          </div>
          <div className="coupon-next-action__progressLabel">
            <span>{couponThresholdProgress}%</span>
            <span className="coupon-center-page__text coupon-center-page__text--secondary">{hasCouponTarget ? (couponCartGap > 0 ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.useNext')) : t('pages.coupons.goShopping')}</span>
          </div>
          <ShopButton
            type={couponNextAction.tone === 'ready' || couponNextAction.tone === 'claim' ? 'primary' : 'default'}
            icon={<ShopIcon path={SI.shopping} />}
            loading={couponInsights.bestCoupon ? claimingId === couponInsights.bestCoupon.id : false}
            disabled={claimingAll || claimingId != null || (isAuthenticated && bestCouponIsPreview)}
            aria-label={couponNextActionLabel}
            title={couponNextActionLabel}
            onClick={couponNextAction.action}
          >
            {couponNextAction.label}
          </ShopButton>
        </section>
      </div>
    </>
  );
};

/** Public claim list with filters, search, and coupon cards. */
export const CouponCenterClaimPanel: React.FC<CouponCenterPanelsProps> = (p) => {
  const {
    t,
    navigate,
    formatMoney,
    formatCouponDate,
    formatWalletStatusLabel,
    formatDaysBadge,
    describeCoupon,
    couponUiText,
    isAuthenticated,
    claimingId,
    claimingAll,
    claimBatchSummary,
    cartSubtotal,
    cartItemCount,
    publicCoupons,
    myCoupons,
    claimableCoupons,
    sortedClaimablePublicCoupons,
    filteredClaimablePublicCoupons,
    ownedCouponIds,
    couponInsights,
    couponNextAction,
    targetThreshold,
    hasCouponTarget,
    couponCartGap,
    bestCouponIsPreview,
    bestCouponValue,
    couponThresholdProgress,
    couponProgressValueText,
    mobileCouponProgressLabel,
    nextCouponProgressLabel,
    couponActionBusy,
    claimAllActionDisabled,
    showClaimCta,
    primaryClaimLabel,
    primaryClaimActionLabel,
    couponNextActionLabel,
    goShoppingActionLabel,
    bestCouponActionLabel,
    nextUseActionLabel,
    hideMobileSecondaryAction,
    hasAnyCouponAction,
    couponFilter,
    setCouponFilter,
    couponSearch,
    setCouponSearch,
    couponSort,
    setCouponSort,
    couponSortLabels,
    couponFilterOptions,
    hasActiveCouponControls,
    publicClaimStats,
    walletFilter,
    setWalletFilter,
    couponWalletStats,
    filteredWalletCoupons,
    walletGuide,
    bestPublicCouponId,
    scrollToSection,
    claimCoupon,
    claimAllCoupons,
    beginPriorityDrag,
    movePriorityDrag,
    endPriorityDrag,
    cancelPriorityClickAfterDrag,
  } = p;
  return (
      <section className="coupon-claim-section__title coupon-claim-section__title--list" id="coupon-claim-list"><div className="shop-panel__head"><div className="shop-panel__title">{(
          <span className="coupon-claim-section__title">
            <span>
              <strong>{t('pages.coupons.claimTitle')}</strong>
              <small>{t('pages.coupons.opportunitySummaryText')}</small>
            </span>
            <ShopTag color={claimableCoupons.length > 0 ? 'green' : 'default'}>{claimableCoupons.length}</ShopTag>
          </span>
        )}</div><div className="shop-panel__extra">{
          showClaimCta ? (
            <ShopButton
              loading={claimingAll}
              disabled={claimAllActionDisabled}
              aria-label={primaryClaimActionLabel}
              title={primaryClaimActionLabel}
              onClick={claimAllCoupons}
            >
              {primaryClaimLabel}
            </ShopButton>
          ) : null
        }</div></div>
        {publicCoupons.length === 0 || sortedClaimablePublicCoupons.length === 0 ? (
          <div className={publicCoupons.length === 0 ? 'coupon-claim-section__empty' : 'coupon-claim-section__empty coupon-claim-section__empty--resolved'}>
            <span className="coupon-claim-section__emptyIcon"><ShopIcon path={SI.gift} /></span>
            <h3>
              {isAuthenticated && myCoupons.length > 0
                ? t('pages.coupons.assignedReadyTitle')
                : publicCoupons.length === 0
                  ? t('pages.coupons.noPublic')
                  : t('pages.coupons.noClaimable')}
            </h3>
            <p>
              {isAuthenticated && myCoupons.length > 0
                ? t('pages.coupons.assignedReadyText')
                : publicCoupons.length === 0
                  ? t('pages.coupons.opportunitySubtitle')
                  : t('pages.coupons.noBestClaimHint')}
            </p>
            <ShopButton
              type="primary"
              icon={isAuthenticated && myCoupons.length > 0 ? <ShopIcon path={SI.clock} /> : <ShopIcon path={SI.shopping} />}
              aria-label={isAuthenticated && myCoupons.length > 0 ? `${t('pages.coupons.myCoupons')}: ${myCoupons.length}` : goShoppingActionLabel}
              title={isAuthenticated && myCoupons.length > 0 ? `${t('pages.coupons.myCoupons')}: ${myCoupons.length}` : goShoppingActionLabel}
              onClick={() => isAuthenticated && myCoupons.length > 0 ? scrollToSection('coupon-wallet') : navigate('/products')}
            >
              {isAuthenticated && myCoupons.length > 0 ? t('pages.coupons.myCoupons') : t('pages.coupons.goShopping')}
            </ShopButton>
          </div>
        ) : (
          <>
            <div className="coupon-claim-section__toolbar">
              <div>
                <ShopIcon path={SI.gift} className="coupon-claim-section__toolbarIcon" />
                <span>{t('pages.coupons.claimableCount')}</span>
                <strong>{claimableCoupons.length}</strong>
              </div>
              <div>
                <ShopIcon path={SI.clock} className="coupon-claim-section__toolbarIcon" />
                <span>{t('pages.coupons.expiringSoon')}</span>
                <strong>{couponInsights.expiringSoon}</strong>
              </div>
              <div>
                <ShopIcon path={SI.fire} className="coupon-claim-section__toolbarIcon" />
                <span>{t('pages.coupons.limitedStock')}</span>
                <strong>{couponInsights.limitedStock}</strong>
              </div>
              {showClaimCta ? (
                <ShopButton
                  type="primary"
                  loading={claimingAll}
                  disabled={claimAllActionDisabled}
                  aria-label={primaryClaimActionLabel}
                  title={primaryClaimActionLabel}
                  onClick={claimAllCoupons}
                >
                  {primaryClaimLabel}
                </ShopButton>
              ) : null}
            </div>
            {claimableCoupons.length === 0 ? (
              <div className="coupon-claim-section__notice" role="status">
                <ShopIcon path={SI.checkCircle} />
                <span>{t('pages.coupons.noBestClaimHint')}</span>
              </div>
            ) : null}
            {claimBatchSummary ? (
              <div className="coupon-claim-section__claimResult" role="status">
                <ShopIcon path={SI.checkCircle} />
                <span>
                  {t('pages.coupons.ui.claimSummary', {
                    claimed: claimBatchSummary.claimed,
                    total: claimBatchSummary.total,
                  })}
                </span>
              </div>
            ) : null}
            <div className="coupon-claim-section__controls">
              <ShopInput
                allowClear
                className="coupon-claim-section__search"
                prefix={<ShopIcon path={SI.search} />}
                value={couponSearch}
                placeholder={couponUiText.searchPlaceholder}
                aria-label={couponUiText.searchPlaceholder}
                onChange={(event) => setCouponSearch(event.target.value)}
              />
              <ShopSelect
                className="coupon-claim-section__sort"
                value={couponSort}
                ariaLabel={couponUiText.sortRecommended}
                title={couponUiText.sortRecommended}
                onChange={(value) => setCouponSort((value as CouponSort) || 'recommended')}
                popupClassName="shop-mobile-popup-layer"
                popupZIndex={2400}
                options={[
                  { value: 'recommended', label: couponUiText.sortRecommended },
                  { value: 'value', label: couponUiText.sortValue },
                  { value: 'ending', label: couponUiText.sortEnding },
                  { value: 'threshold', label: couponUiText.sortThreshold },
                ]}
              />
            </div>
            <div className="coupon-claim-section__filters" role="group" aria-label={t('pages.productList.filters')}>
              <div className="coupon-claim-section__filterButtons">
                {couponFilterOptions.map((option) => {
                  const couponFilterLabel = `${option.label}: ${option.count}`;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={[
                        'coupon-claim-section__filterButton',
                        couponFilter === option.key ? 'coupon-claim-section__filterButton--active' : '',
                        option.count === 0 ? 'coupon-claim-section__filterButton--empty' : '',
                      ].filter(Boolean).join(' ')}
                      aria-label={couponFilterLabel}
                      aria-pressed={couponFilter === option.key}
                      title={couponFilterLabel}
                      onClick={() => setCouponFilter(option.key)}
                    >
                      <span>{option.label}</span>
                      <strong>{option.count}</strong>
                    </button>
                  );
                })}
              </div>
              <span className="coupon-center-page__text coupon-center-page__text--secondary">
                {couponUiText.visibleResults}: {filteredClaimablePublicCoupons.length} / {sortedClaimablePublicCoupons.length}
              </span>
            </div>
            {hasActiveCouponControls ? (
              <div className="coupon-claim-section__activeContext">
                <span>{couponUiText.activeControls}</span>
                {couponSearch.trim() ? <ShopTag>{couponSearch.trim()}</ShopTag> : null}
                {couponSort !== 'recommended' ? <ShopTag>{couponSortLabels[couponSort]}</ShopTag> : null}
                {couponFilter !== 'all' ? <ShopTag>{couponFilterOptions.find((option) => option.key === couponFilter)?.label}</ShopTag> : null}
                <button
                  type="button"
                  aria-label={couponUiText.resetControls}
                  title={couponUiText.resetControls}
                  onClick={() => {
                    setCouponSearch('');
                    setCouponSort('recommended');
                    setCouponFilter('all');
                  }}
                >
                  {couponUiText.resetControls}
                </button>
              </div>
            ) : null}
            <div className="coupon-claim-section__resultSummary">
              <span className={publicClaimStats.matched === 0 ? 'coupon-claim-section__resultMetric coupon-claim-section__resultMetric--empty' : 'coupon-claim-section__resultMetric'}>
                <strong>{publicClaimStats.matched}</strong>
                <small>{couponUiText.listMatched}</small>
              </span>
              <span className={publicClaimStats.saved === 0 ? 'coupon-claim-section__resultMetric coupon-claim-section__resultMetric--empty' : 'coupon-claim-section__resultMetric coupon-claim-section__resultMetric--saved'}>
                <strong>{publicClaimStats.saved}</strong>
                <small>{couponUiText.alreadySaved}</small>
              </span>
              <span className={publicClaimStats.total === 0 ? 'coupon-claim-section__resultMetric coupon-claim-section__resultMetric--empty' : 'coupon-claim-section__resultMetric'}>
                <strong>{publicClaimStats.total}</strong>
                <small>{t('common.all')}</small>
              </span>
            </div>
            <div className="coupon-center-page__claimGrid">
              {filteredClaimablePublicCoupons.length === 0 ? (
                <div className="coupon-center-page__claimEmpty">
                  <div className="coupon-claim-section__filterEmpty">
                    <ShopIcon path={SI.gift} />
                    <strong>{couponSearch.trim() ? couponUiText.noSearchResults : t('pages.coupons.noClaimable')}</strong>
                    <span>{t('pages.coupons.opportunitySubtitle')}</span>
                    <div className="coupon-center-page__actionRow">
                      <ShopButton
                        aria-label={`${t('pages.notifications.clearFilter')}: ${couponFilterOptions.find((option) => option.key === couponFilter)?.label || t('pages.productList.filters')}`}
                        title={`${t('pages.notifications.clearFilter')}: ${couponFilterOptions.find((option) => option.key === couponFilter)?.label || t('pages.productList.filters')}`}
                        onClick={() => setCouponFilter('all')}
                      >
                        {t('pages.notifications.clearFilter')}
                      </ShopButton>
                      {couponSearch.trim() ? (
                        <ShopButton
                          aria-label={`${couponUiText.resetSearch}: ${couponSearch.trim()}`}
                          title={`${couponUiText.resetSearch}: ${couponSearch.trim()}`}
                          onClick={() => setCouponSearch('')}
                        >
                          {couponUiText.resetSearch}
                        </ShopButton>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : filteredClaimablePublicCoupons.map((coupon) => {
              const claimed = ownedCouponIds.has(coupon.id);
              const remaining = getCouponRemaining(coupon);
              const endingSoon = isCouponEndingSoon(coupon.endAt) && !claimed && remaining !== 0;
              const limitedStock = remaining != null && remaining > 0 && remaining <= 10 && !claimed;
              const estimatedValue = getCouponEstimatedValue(coupon);
              const previewCoupon = isFallbackCoupon(coupon.id);
              const thresholdAmount = Math.max(0, toFiniteNumber(coupon.thresholdAmount));
              const cartGap = Math.max(0, thresholdAmount - cartSubtotal);
              const cartProgress = thresholdAmount > 0 ? Math.min(100, Math.round((cartSubtotal / thresholdAmount) * 100)) : 100;
              const daysLeft = getDaysUntilEnd(coupon.endAt);
              const isBestPublicCoupon = coupon.id === bestPublicCouponId && !claimed && remaining !== 0;
              const isCartReadyCoupon = !claimed && remaining !== 0 && thresholdAmount > 0 && cartGap <= 0;
              const couponStateClass = claimed
                ? 'coupon-center-page__coupon--claimed'
                : remaining === 0
                  ? 'coupon-center-page__coupon--empty'
                  : isCartReadyCoupon
                    ? 'coupon-center-page__coupon--ready'
                    : endingSoon
                      ? 'coupon-center-page__coupon--ending'
                      : limitedStock
                        ? 'coupon-center-page__coupon--limited'
                        : '';
              const couponStateLabel = claimed
                ? t('pages.coupons.claimed')
                : remaining === 0
                  ? t('pages.coupons.noClaimable')
                  : isCartReadyCoupon
                    ? couponUiText.cartReady
                    : endingSoon
                      ? t('pages.coupons.expiringSoon')
                      : limitedStock
                        ? t('pages.coupons.limitedStock')
                        : t('pages.coupons.claim');
              const couponActionLabel = `${couponStateLabel}: ${coupon.name}`;
              const validUntilText = formatCouponDate(coupon.endAt);
              return (
                <div className="coupon-center-page__claimItem" key={coupon.id}>
                  <article className="coupon-center-page__couponTitle"><div className="shop-panel__head"><div className="shop-panel__title">{(
                      <span className="coupon-center-page__couponTitle">
                        <span>{coupon.name}</span>
                        {isBestPublicCoupon ? <ShopTag color="volcano">{couponUiText.bestMatch}</ShopTag> : null}
                        {previewCoupon ? <ShopTag color="blue">{t('pages.coupons.preview')}</ShopTag> : null}
                        {claimed ? <ShopTag color="green">{t('pages.coupons.claimed')}</ShopTag> : null}
                      </span>
                    )}</div><div className="shop-panel__extra">{(
                      <div className="coupon-center-page__couponTags">
                        {endingSoon ? <ShopTag color="volcano">{t('pages.coupons.expiringSoon')}</ShopTag> : null}
                        {limitedStock ? <ShopTag color="gold">{t('pages.coupons.limitedStock')}</ShopTag> : null}
                        <ShopTag color={coupon.couponType === 'FULL_REDUCTION' ? 'volcano' : 'blue'}>
                          {coupon.couponType === 'FULL_REDUCTION' ? t('pages.coupons.fullReduction') : t('pages.coupons.discount')}
                        </ShopTag>
                      </div>
                    )}</div></div>
                    <span className="coupon-center-page__couponRibbon">{couponStateLabel}</span>
                    <div className="coupon-center-page__couponBody">
                      <div className="coupon-center-page__couponValueRow">
                        <span className="coupon-center-page__text coupon-center-page__text--strong coupon-center-page__couponValue">{describeCoupon(coupon)}</span>
                      {estimatedValue > 0 ? <span className="coupon-center-page__couponEstimate commerce-money">{formatMoney(estimatedValue)}</span> : null}
                      </div>
                      <div className="coupon-center-page__couponDetails" aria-label={coupon.name}>
                        <span>
                          <small>{t('pages.adminCoupons.minimumSpend')}</small>
                          <strong className="commerce-money">{thresholdAmount > 0 ? formatMoney(thresholdAmount) : formatMoney(0)}</strong>
                        </span>
                        <span>
                          <small>{couponUiText.remainingLabel}</small>
                          <strong>{remaining !== null ? remaining : '-'}</strong>
                        </span>
                      </div>
                      <div className="coupon-center-page__couponMicroFacts">
                        <span>
                          <ShopIcon path={SI.clock} />
                          {formatDaysBadge(daysLeft)}
                        </span>
                        <span>
                          <ShopIcon path={SI.gift} />
                          {remaining == null ? couponUiText.unlimitedStock : t('pages.coupons.remaining', { count: remaining })}
                        </span>
                      </div>
                      {!claimed && remaining !== 0 && thresholdAmount > 0 ? (
                        <div className={cartGap > 0 ? 'coupon-center-page__couponFit' : 'coupon-center-page__couponFit coupon-center-page__couponFit--ready'}>
                          <span>{cartGap > 0 ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.useNext')}</span>
                          <strong className="commerce-money">{cartGap > 0 ? formatMoney(cartGap) : formatMoney(0)}</strong>
                          <i style={{ ['--coupon-card-progress' as string]: `${cartProgress}%` }} />
                        </div>
                      ) : null}
                      {isCartReadyCoupon ? (
                        <span className="coupon-center-page__couponReady">
                          <ShopIcon path={SI.checkCircle} /> {couponUiText.cartReady}
                        </span>
                      ) : null}
                      {coupon.description ? <span className="coupon-center-page__text coupon-center-page__text--secondary coupon-center-page__couponMeta">{coupon.description}</span> : null}
                      {validUntilText ? <span className="coupon-center-page__text coupon-center-page__text--secondary coupon-center-page__couponMeta">{t('pages.coupons.validUntil', { time: validUntilText })}</span> : null}
                      <ShopButton
                        type="primary"
                        block
                        className="coupon-center-page__couponAction"
                        icon={!isAuthenticated ? undefined : claimed ? <ShopIcon path={SI.checkCircle} /> : <ShopIcon path={SI.gift} />}
                        disabled={claimingAll || claimingId != null || claimed || remaining === 0 || (isAuthenticated && previewCoupon)}
                        loading={claimingId === coupon.id}
                        aria-label={couponActionLabel}
                        title={couponActionLabel}
                        onClick={() => claimCoupon(coupon.id)}
                      >
                        {!isAuthenticated
                          ? t('nav.login')
                          : previewCoupon
                            ? t('pages.coupons.preview')
                            : claimed
                              ? t('pages.coupons.claimed')
                              : t('pages.coupons.claim')}
                      </ShopButton>
                    </div>
                  </article>
                </div>
              );
              })}
            </div>
          </>
        )}
      </section>
  );
};

/** Authenticated wallet with filters and saved coupons. */
export const CouponCenterWalletPanel: React.FC<CouponCenterPanelsProps> = (p) => {
  const {
    t,
    navigate,
    formatMoney,
    formatCouponDate,
    formatWalletStatusLabel,
    formatDaysBadge,
    describeCoupon,
    couponUiText,
    isAuthenticated,
    claimingId,
    claimingAll,
    claimBatchSummary,
    cartSubtotal,
    cartItemCount,
    publicCoupons,
    myCoupons,
    claimableCoupons,
    sortedClaimablePublicCoupons,
    filteredClaimablePublicCoupons,
    ownedCouponIds,
    couponInsights,
    couponNextAction,
    targetThreshold,
    hasCouponTarget,
    couponCartGap,
    bestCouponIsPreview,
    bestCouponValue,
    couponThresholdProgress,
    couponProgressValueText,
    mobileCouponProgressLabel,
    nextCouponProgressLabel,
    couponActionBusy,
    claimAllActionDisabled,
    showClaimCta,
    primaryClaimLabel,
    primaryClaimActionLabel,
    couponNextActionLabel,
    goShoppingActionLabel,
    bestCouponActionLabel,
    nextUseActionLabel,
    hideMobileSecondaryAction,
    hasAnyCouponAction,
    couponFilter,
    setCouponFilter,
    couponSearch,
    setCouponSearch,
    couponSort,
    setCouponSort,
    couponSortLabels,
    couponFilterOptions,
    hasActiveCouponControls,
    publicClaimStats,
    walletFilter,
    setWalletFilter,
    couponWalletStats,
    filteredWalletCoupons,
    walletGuide,
    bestPublicCouponId,
    scrollToSection,
    claimCoupon,
    claimAllCoupons,
    beginPriorityDrag,
    movePriorityDrag,
    endPriorityDrag,
    cancelPriorityClickAfterDrag,
  } = p;
  return (
      <section className="coupon-wallet__heading" id="coupon-wallet"><div className="shop-panel__head"><div className="shop-panel__title">{(
          <span className="coupon-wallet__heading">
            <span>{t('pages.coupons.myCoupons')}</span>
            <ShopTag color={myCoupons.length > 0 ? 'green' : 'default'}>{myCoupons.length}</ShopTag>
          </span>
        )}</div></div>
        {myCoupons.length === 0 ? (
          <div className="coupon-wallet__empty" role="status">
            <span className="coupon-wallet__emptyIcon"><ShopIcon path={SI.gift} /></span>
            <h3>{t('pages.coupons.noMine')}</h3>
            <p>{t('pages.coupons.emptyWalletHint')}</p>
            <div className="coupon-wallet__emptyActions" data-coupon-wallet-empty-actions="true">
              <ShopButton
                type="primary"
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={goShoppingActionLabel}
                title={goShoppingActionLabel}
                onClick={() => navigate('/products')}
              >
                {t('pages.coupons.goShopping')}
              </ShopButton>
              <ShopButton
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={t('pages.coupons.emptyWalletCart')}
                title={t('pages.coupons.emptyWalletCart')}
                onClick={() => navigate('/cart')}
              >
                {t('pages.coupons.emptyWalletCart')}
              </ShopButton>
              <ShopButton
                icon={<ShopIcon path={SI.gift} />}
                aria-label={t('pages.coupons.emptyWalletPetFinder')}
                title={t('pages.coupons.emptyWalletPetFinder')}
                onClick={() => navigate('/pet-finder')}
              >
                {t('pages.coupons.emptyWalletPetFinder')}
              </ShopButton>
            </div>
          </div>
        ) : (
          <>
          <div className="coupon-wallet__summary">
            <span>
              <strong>{couponWalletStats.unused}</strong>
              <small>{t('status.UNUSED')}</small>
            </span>
            <span>
              <strong>{couponWalletStats.used}</strong>
              <small>{t('status.USED')}</small>
            </span>
            <span>
              <strong>{couponWalletStats.expired}</strong>
              <small>{t('status.EXPIRED')}</small>
            </span>
          </div>
          <div className="coupon-wallet__guide">
            <span>{couponUiText.walletGuide}</span>
            <div>
              <strong>{couponUiText.nextExpiry}</strong>
              <small>
                {walletGuide.nextExpiring
                  ? `${walletGuide.nextExpiring.couponName} - ${formatDaysBadge(getDaysUntilEnd(walletGuide.nextExpiring.endAt))}`
                  : couponUiText.noExpiry}
              </small>
            </div>
            <div>
              <strong>{couponUiText.strongestSaved}</strong>
              <small>
                {walletGuide.strongestSaved
                  ? `${walletGuide.strongestSaved.couponName} - ${formatMoney(getCouponEstimatedValue(walletGuide.strongestSaved))}`
                  : couponUiText.noSavedValue}
              </small>
            </div>
          </div>
          <div className="coupon-wallet__filters" role="group" aria-label={t('pages.coupons.myCoupons')}>
            {([
              ['all', couponUiText.walletAll, myCoupons.length],
              ['UNUSED', t('status.UNUSED'), couponWalletStats.unused],
              ['USED', t('status.USED'), couponWalletStats.used],
              ['EXPIRED', t('status.EXPIRED'), couponWalletStats.expired],
            ] as Array<[WalletFilter, string, number]>).map(([key, label, count]) => {
              const walletFilterLabel = `${label}: ${count}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'coupon-wallet__filter',
                    walletFilter === key ? 'coupon-wallet__filter--active' : '',
                    count === 0 ? 'coupon-wallet__filter--empty' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={walletFilterLabel}
                  aria-pressed={walletFilter === key}
                  title={walletFilterLabel}
                  onClick={() => setWalletFilter(key)}
                >
                  <span>{label}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
          {filteredWalletCoupons.length === 0 ? (
                <div className="coupon-wallet__filterEmpty" data-coupon-wallet-filter-empty="true">
                  <div className="coupon-wallet__filterEmptyCopy">
                    <strong>{couponUiText.walletFilteredEmpty}</strong>
                    <p>{t('pages.coupons.walletFilteredEmptyHint')}</p>
                  </div>
                  <div className="coupon-wallet__emptyActions" data-coupon-wallet-filter-empty-actions="true">
                    <ShopButton
                      type="primary"
                      aria-label={couponUiText.walletAll}
                      title={couponUiText.walletAll}
                      onClick={() => setWalletFilter('all')}
                    >
                      {couponUiText.walletAll}
                    </ShopButton>
                    <ShopButton
                      icon={<ShopIcon path={SI.shopping} />}
                      aria-label={goShoppingActionLabel}
                      title={goShoppingActionLabel}
                      onClick={() => navigate('/products')}
                    >
                      {t('pages.coupons.goShopping')}
                    </ShopButton>
                    <ShopButton
                      icon={<ShopIcon path={SI.shopping} />}
                      aria-label={t('pages.coupons.emptyWalletCart')}
                      title={t('pages.coupons.emptyWalletCart')}
                      onClick={() => navigate('/cart')}
                    >
                      {t('pages.coupons.emptyWalletCart')}
                    </ShopButton>
                    <ShopButton
                      icon={<ShopIcon path={SI.gift} />}
                      aria-label={t('pages.coupons.emptyWalletPetFinder')}
                      title={t('pages.coupons.emptyWalletPetFinder')}
                      onClick={() => navigate('/pet-finder')}
                    >
                      {t('pages.coupons.emptyWalletPetFinder')}
                    </ShopButton>
                  </div>
                </div>
              
          ) : (
            <ul className="coupon-wallet__list coupon-wallet__itemList" role="list">
              {filteredWalletCoupons.map((coupon) => {
              const expiryText = formatCouponDate(coupon.endAt);
              const statusLabel = formatWalletStatusLabel(coupon.status);
              const daysLeft = getDaysUntilEnd(coupon.endAt);
              const walletCouponValue = getCouponEstimatedValue(coupon);
              const walletThreshold = Math.max(0, toFiniteNumber(coupon.thresholdAmount));
              const walletGap = Math.max(0, walletThreshold - cartSubtotal);
              const walletProgress = walletThreshold > 0 ? Math.min(100, Math.round((cartSubtotal / walletThreshold) * 100)) : 100;
              const isNextWalletCoupon = couponInsights.nextToUse?.id === coupon.id;
              const walletUseActionLabel = `${t('pages.coupons.use')}: ${coupon.couponName}`;
              const expiryTone = coupon.status !== 'UNUSED'
                ? 'muted'
                : daysLeft != null && daysLeft <= 3
                  ? 'urgent'
                  : 'normal';
              return (
              <li key={String(coupon.id ?? coupon.couponName)} className="coupon-wallet__item">
                <div className={`coupon-wallet__coupon coupon-wallet__coupon--${(coupon.status || 'unknown').toLowerCase()} ${isNextWalletCoupon ? 'coupon-wallet__coupon--next' : ''}`}>
                  <span className="coupon-wallet__couponIcon"><ShopIcon path={SI.gift} /></span>
                  <div className="coupon-wallet__main">
                    <div className="coupon-wallet__titleRow">
                      <span className="coupon-center-page__text coupon-center-page__text--strong coupon-wallet__name">{coupon.couponName}</span>
                      {isNextWalletCoupon ? <ShopTag className="coupon-wallet__nextTag" color="volcano">{couponUiText.walletNext}</ShopTag> : null}
                      <ShopTag className="coupon-wallet__status" color={couponStatusColor[coupon.status] || 'default'}>
                        {statusLabel}
                      </ShopTag>
                    </div>
                    <div className={coupon.status === 'UNUSED' ? 'coupon-wallet__valueRow' : 'coupon-wallet__valueRow coupon-wallet__valueRow--closed'}>
                      <span className="coupon-center-page__text coupon-wallet__value">{describeCoupon(coupon)}</span>
                      {walletCouponValue > 0 ? <span className="commerce-money">{formatMoney(walletCouponValue)}</span> : null}
                    </div>
                    {expiryText ? (
                      <span className={`coupon-wallet__expiryPill coupon-wallet__expiryPill--${expiryTone}`}>
                        <ShopIcon path={SI.clock} />
                        {t('pages.coupons.validUntilPrefix', { time: expiryText })}
                      </span>
                    ) : null}
                    <div className="coupon-wallet__quickFacts">
                      <span className={coupon.status === 'UNUSED' ? 'coupon-wallet__quickFact coupon-wallet__quickFact--time' : 'coupon-wallet__quickFact coupon-wallet__quickFact--closed'}>{coupon.status === 'UNUSED' ? formatDaysBadge(daysLeft) : statusLabel}</span>
                      <span className={walletThreshold > 0 ? 'coupon-wallet__quickFact coupon-wallet__quickFact--threshold' : 'coupon-wallet__quickFact coupon-wallet__quickFact--empty'}>{couponUiText.walletThreshold}: <span className="commerce-money">{formatMoney(walletThreshold)}</span></span>
                    </div>
                    {coupon.status === 'UNUSED' && walletThreshold > 0 ? (
                      <div className={walletGap > 0 ? 'coupon-wallet__fit' : 'coupon-wallet__fit coupon-wallet__fit--ready'}>
                        <span>{walletGap > 0 ? t('pages.coupons.couponThresholdGap') : couponUiText.cartReady}</span>
                        <strong className="commerce-money">{walletGap > 0 ? formatMoney(walletGap) : formatMoney(0)}</strong>
                        <i style={{ ['--wallet-coupon-progress' as string]: `${walletProgress}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="coupon-wallet__actions">
                    {coupon.status === 'UNUSED' ? (
                      <ShopButton
                        type="primary"
                        icon={<ShopIcon path={SI.shopping} />}
                        className="coupon-wallet__action"
                        aria-label={walletUseActionLabel}
                        title={walletUseActionLabel}
                        onClick={() => navigate('/cart')}
                      >
                        {t('pages.coupons.use')}
                      </ShopButton>
                    ) : (
                      <span className={`coupon-wallet__closedAction coupon-wallet__closedAction--${(coupon.status || 'unknown').toLowerCase()}`}>{statusLabel}</span>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
            </ul>
          )}
          </>
        )}
      </section>
  );
};

