import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Input, Tag } from 'antd';
import ShopSelect from '../components/ShopSelect';
import { useNavigate } from 'react-router-dom';
import { cartApi, couponApi } from '../api';
import type { CartItem, CouponPublic, UserCoupon } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { useMarket } from '../hooks/useMarket';
import { dispatchDomEvent } from '../utils/domEvents';
import { getGuestCartItems } from '../utils/guestCart';
import { getCouponUiText } from '../utils/couponUiText';
import { getLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import { getApiErrorMessage } from '../utils/apiError';
import {
  filterPublicCoupons,
  getCartItemCount,
  getCartSubtotal,
  getCouponEstimatedValue,
  getFallbackPublicCoupons,
  getCouponPayablePercent,
  getCouponRemaining,
  isCouponInValidWindow,
  getDaysUntilEnd,
  isCouponEndingSoon,
  sortPublicCoupons,
  toFiniteNumber,
  toSafeArray,
} from '../utils/couponCenter';
import type { CouponFilter, CouponSort } from '../utils/couponCenter';
import './CouponCenter.css';
import '../styles/mobile-page-contrast.css';


const couponStatusColor: Record<string, string> = {
  UNUSED: 'green',
  USED: 'default',
  EXPIRED: 'volcano',
};
const COUPON_WALLET_STATUS_KEYS = new Set(['UNUSED', 'USED', 'EXPIRED']);

type WalletFilter = 'all' | 'UNUSED' | 'USED' | 'EXPIRED';
const CLAIM_BATCH_SIZE = 4;

const getCouponDisplayName = (coupon: CouponPublic | UserCoupon) =>
  'couponName' in coupon ? coupon.couponName : coupon.name;

const isFallbackCoupon = (couponId: number) => couponId < 0;

const claimCouponsInBatches = async (coupons: CouponPublic[]) => {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let index = 0; index < coupons.length; index += CLAIM_BATCH_SIZE) {
    const batch = coupons.slice(index, index + CLAIM_BATCH_SIZE);
    results.push(...await Promise.allSettled(batch.map((coupon) => couponApi.claim(coupon.id, 0))));
  }
  return results;
};

const CouponCenter: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.coupons.title'));
  useDocumentMeta({
    title: t('pages.coupons.title'),
    description: t('pages.coupons.seoDescription'),
    path: '/coupons',
    type: 'website',
    siteName: t('common.siteTitle'),
  });
  const token = getLocalStorageItem('token') || '';
  const isAuthenticated = Boolean(token);
  const mountedRef = useRef(true);
  const loadCouponsRequestRef = useRef(0);
  const priorityDragRef = useRef({
    dragging: false,
    moved: false,
    pointerId: -1,
    scrollLeft: 0,
    startX: 0,
    startY: 0,
  });
  const suppressPriorityClickRef = useRef(false);
  const [publicCoupons, setPublicCoupons] = useState<CouponPublic[]>([]);
  const [myCoupons, setMyCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [couponFilter, setCouponFilter] = useState<CouponFilter>('all');
  const [couponSearch, setCouponSearch] = useState('');
  const deferredCouponSearch = useDeferredValue(couponSearch);
  const [couponSort, setCouponSort] = useState<CouponSort>('recommended');
  const [walletFilter, setWalletFilter] = useState<WalletFilter>('all');
  const [claimBatchSummary, setClaimBatchSummary] = useState<{ claimed: number; total: number } | null>(null);
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const formatCouponDate = useCallback((value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(dateLocale) : '';
  }, [dateLocale]);
  const formatWalletStatusLabel = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = rawStatus.toUpperCase();
    if (!normalizedStatus) return t('common.unknown');
    if (COUPON_WALLET_STATUS_KEYS.has(normalizedStatus)) {
      return t(`status.${normalizedStatus}`);
    }
    return rawStatus;
  }, [t]);

  const loadCoupons = useCallback(async () => {
    const requestId = loadCouponsRequestRef.current + 1;
    loadCouponsRequestRef.current = requestId;
    setLoading(true);
    try {
      const cartPromise = isAuthenticated
        ? cartApi.getItems(0).then((res) => res.data || []).catch(() => [] as CartItem[])
        : Promise.resolve(getGuestCartItems());
      const [publicRes, mineRes, cartItems] = await Promise.all([
        couponApi.getPublic(),
        isAuthenticated ? couponApi.getByUser(0) : Promise.resolve({ data: [] as UserCoupon[] }),
        cartPromise,
      ]);
      if (!mountedRef.current || requestId !== loadCouponsRequestRef.current) return;
      const safeCartItems = toSafeArray<CartItem>(cartItems);
      const livePublicCoupons = toSafeArray<CouponPublic>(publicRes.data);
      setPublicCoupons(livePublicCoupons.length > 0 ? livePublicCoupons : getFallbackPublicCoupons());
      setMyCoupons(toSafeArray<UserCoupon>(mineRes.data));
      setCartSubtotal(getCartSubtotal(safeCartItems));
      setCartItemCount(getCartItemCount(safeCartItems));
      setLoadError(false);
    } catch (error) {
      reportNonBlockingError('CouponCenter.loadCoupons', error);
      if (mountedRef.current && requestId === loadCouponsRequestRef.current) {
        setPublicCoupons(getFallbackPublicCoupons());
        setMyCoupons([]);
        const fallbackCartItems = isAuthenticated ? [] : getGuestCartItems();
        setCartSubtotal(getCartSubtotal(fallbackCartItems));
        setCartItemCount(getCartItemCount(fallbackCartItems));
        setLoadError(true);
      }
    } finally {
      if (mountedRef.current && requestId === loadCouponsRequestRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ownedCouponIds = useMemo(() => new Set(myCoupons.map((item) => item.couponId)), [myCoupons]);
  const claimableCoupons = useMemo(
    () => publicCoupons.filter((coupon) => {
      const remaining = getCouponRemaining(coupon);
      return !ownedCouponIds.has(coupon.id) && remaining !== 0 && isCouponInValidWindow(coupon);
    }),
    [ownedCouponIds, publicCoupons],
  );
  const couponUiText = useMemo(() => getCouponUiText(t), [t]);
  const formatDaysBadge = useCallback((days: number | null | undefined, fallback?: string) => {
    if (days == null) return fallback || couponUiText.noExpiry;
    if (days < 0) return t('status.EXPIRED');
    if (days === 0) return couponUiText.today;
    return t('pages.coupons.ui.daysShort', { count: days });
  }, [couponUiText, t]);
  const sortedPublicCoupons = useMemo(
    () => sortPublicCoupons(publicCoupons, ownedCouponIds, deferredCouponSearch, couponSort),
    [couponSort, deferredCouponSearch, ownedCouponIds, publicCoupons],
  );
  const sortedClaimablePublicCoupons = useMemo(
    () => sortedPublicCoupons.filter((coupon) => !ownedCouponIds.has(coupon.id) && getCouponRemaining(coupon) !== 0 && isCouponInValidWindow(coupon)),
    [ownedCouponIds, sortedPublicCoupons],
  );
  const filteredClaimablePublicCoupons = useMemo(
    () => filterPublicCoupons(sortedClaimablePublicCoupons, ownedCouponIds, couponFilter),
    [couponFilter, ownedCouponIds, sortedClaimablePublicCoupons],
  );
  const usingFallbackCoupons = publicCoupons.some((coupon) => isFallbackCoupon(coupon.id));
  const couponInsights = useMemo(() => {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const expiringSoon = claimableCoupons.filter((coupon) => {
      if (!coupon.endAt) return false;
      const endAt = new Date(coupon.endAt).getTime();
      return Number.isFinite(endAt) && endAt >= now && endAt - now <= threeDaysMs;
    }).length;
    const limitedStock = claimableCoupons.filter((coupon) => {
      const remaining = getCouponRemaining(coupon);
      return remaining != null && remaining > 0 && remaining <= 10;
    }).length;
    const bestCoupon = claimableCoupons
      .slice()
      .sort((a, b) => getCouponEstimatedValue(b) - getCouponEstimatedValue(a))[0];
    const unusedMine = myCoupons.filter((coupon) => coupon.status === 'UNUSED').length;
    const nextToUse = myCoupons
      .filter((coupon) => coupon.status === 'UNUSED')
      .slice()
      .sort((a, b) => {
        const daysA = getDaysUntilEnd(a.endAt);
        const daysB = getDaysUntilEnd(b.endAt);
        const endScoreA = daysA == null ? Number.MAX_SAFE_INTEGER : daysA;
        const endScoreB = daysB == null ? Number.MAX_SAFE_INTEGER : daysB;
        return endScoreA - endScoreB || getCouponEstimatedValue(b) - getCouponEstimatedValue(a);
      })[0];
    const targetCoupon = nextToUse || bestCoupon;
    return { expiringSoon, limitedStock, bestCoupon, unusedMine, nextToUse, targetCoupon };
  }, [claimableCoupons, myCoupons]);

  const describeCoupon = (coupon: Pick<CouponPublic, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>) => {
    if (coupon.couponType === 'FULL_REDUCTION') {
      return `${t('pages.adminCoupons.minimumSpend')} ${formatMoney(Math.max(0, toFiniteNumber(coupon.thresholdAmount)))} / ${t('pages.adminCoupons.reductionAmount')} ${formatMoney(Math.max(0, toFiniteNumber(coupon.reductionAmount)))}`;
    }
    const maxDiscount = Math.max(0, toFiniteNumber(coupon.maxDiscountAmount));
    const payablePercent = getCouponPayablePercent(coupon);
    const discountPercent = Math.max(0, 100 - payablePercent);
    const maxText = maxDiscount > 0 ? `, ${t('pages.coupons.maxDiscount', { amount: formatMoney(maxDiscount) })}` : '';
    return t('pages.coupons.discountPayable', { percent: discountPercent }) + maxText;
  };

  const claimCoupon = async (couponId: number) => {
    if (claimingId != null || claimingAll) return;
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (isFallbackCoupon(couponId)) {
      announceAccessibleMessage(t('pages.coupons.previewOnly'), 'info');
      return;
    }
    setClaimingId(couponId);
    setClaimBatchSummary(null);
    try {
      await couponApi.claim(couponId, 0);
      announceAccessibleMessage(t('pages.coupons.claimedSuccess'), 'success');
      dispatchDomEvent('shop:coupons-updated');
      await loadCoupons();
    } catch (error: unknown) {
      announceAccessibleMessage(getApiErrorMessage(error, t('pages.coupons.claimFailed'), language), 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const claimAllCoupons = async () => {
    if (claimingAll || claimingId != null) return;
    if (!isAuthenticated) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    const liveClaimableCoupons = claimableCoupons.filter((coupon) => !isFallbackCoupon(coupon.id));
    if (claimableCoupons.length > 0 && liveClaimableCoupons.length === 0) {
      announceAccessibleMessage(t('pages.coupons.previewOnly'), 'info');
      return;
    }
    if (claimableCoupons.length === 0) {
      announceAccessibleMessage(t('pages.coupons.noClaimable'), 'info');
      return;
    }
    try {
      setClaimingAll(true);
      setClaimBatchSummary(null);
      const results = await claimCouponsInBatches(liveClaimableCoupons);
      const claimed = results.filter((result) => result.status === 'fulfilled').length;
      setClaimBatchSummary({ claimed, total: liveClaimableCoupons.length });
      if (claimed > 0) {
        announceAccessibleMessage(t('pages.coupons.claimedAllSuccess', { count: claimed }), 'success');
        dispatchDomEvent('shop:coupons-updated');
      } else {
        announceAccessibleMessage(t('pages.coupons.claimFailed'), 'error');
      }
      await loadCoupons();
    } catch (error) {
      reportNonBlockingError('CouponCenter.claimAllCoupons', error);
      announceAccessibleMessage(t('pages.coupons.claimFailed'), 'error');
    } finally {
      setClaimingAll(false);
    }
  };

  const targetThreshold = Math.max(0, toFiniteNumber(couponInsights.targetCoupon?.thresholdAmount));
  const hasCouponTarget = Boolean(couponInsights.targetCoupon);
  const couponCartGap = Math.max(0, targetThreshold - cartSubtotal);
  const bestCouponIsPreview = Boolean(couponInsights.bestCoupon && isFallbackCoupon(couponInsights.bestCoupon.id));
  const couponNextAction = (() => {
    if (!isAuthenticated && couponInsights.bestCoupon) {
      return {
        tone: 'warning',
        title: t('pages.coupons.nextActionLoginTitle'),
        text: t('pages.coupons.nextActionLoginText', { name: couponInsights.bestCoupon.name }),
        label: t('pages.coupons.loginToClaim'),
        action: () => navigate(buildLoginUrlFromWindow()),
      };
    }
    if (couponInsights.bestCoupon && !couponInsights.nextToUse) {
      return {
        tone: 'claim',
        title: t('pages.coupons.nextActionClaimTitle'),
        text: t('pages.coupons.nextActionClaimText', {
          name: couponInsights.bestCoupon.name,
          value: formatMoney(getCouponEstimatedValue(couponInsights.bestCoupon)),
        }),
        label: bestCouponIsPreview ? t('pages.coupons.preview') : t('pages.coupons.claimBest'),
        action: () => claimCoupon(couponInsights.bestCoupon!.id),
      };
    }
    if (couponInsights.nextToUse && couponCartGap <= 0) {
      return {
        tone: 'ready',
        title: t('pages.coupons.nextActionCartReadyTitle'),
        text: t('pages.coupons.nextActionCartReadyText', {
          count: cartItemCount,
          amount: formatMoney(cartSubtotal),
        }),
        label: t('pages.coupons.useNext'),
        action: () => navigate('/cart'),
      };
    }
    if (couponInsights.nextToUse && couponCartGap > 0) {
      return {
        tone: 'build',
        title: t('pages.coupons.nextActionBuildTitle'),
        text: t('pages.coupons.nextActionBuildText', {
          amount: formatMoney(couponCartGap),
          name: couponInsights.nextToUse.couponName,
        }),
        label: t('pages.coupons.nextActionBrowsePersonalized'),
        action: () => navigate('/products?sort=personalized-desc'),
      };
    }
    return {
      tone: 'neutral',
      title: t('pages.coupons.nextActionBrowseTitle'),
      text: t('pages.coupons.nextActionBrowseText'),
      label: t('pages.coupons.goShopping'),
      action: () => navigate('/products?sort=personalized-desc'),
    };
  })();
  const couponActionBusy = claimingAll || claimingId != null;
  const hasLiveClaimableCoupons = claimableCoupons.some((coupon) => !isFallbackCoupon(coupon.id));
  const claimAllActionDisabled = isAuthenticated
    ? claimableCoupons.length === 0 || couponActionBusy || !hasLiveClaimableCoupons
    : couponActionBusy;
  const showClaimCta = isAuthenticated ? claimableCoupons.length > 0 : publicCoupons.length > 0;
  const primaryClaimLabel = isAuthenticated && usingFallbackCoupons && !hasLiveClaimableCoupons
    ? t('pages.coupons.preview')
    : isAuthenticated
      ? t('pages.coupons.claimAll')
      : t('pages.coupons.loginToClaim');
  const primaryClaimActionLabel = `${primaryClaimLabel}: ${isAuthenticated ? claimableCoupons.length : publicCoupons.length}`;
  const couponNextActionLabel = `${couponNextAction.label}: ${couponNextAction.title}`;
  const goShoppingActionLabel = t('pages.coupons.goShopping');
  const bestCouponActionLabel = couponInsights.bestCoupon
    ? `${bestCouponIsPreview ? t('pages.coupons.preview') : t('pages.coupons.claimBest')}: ${couponInsights.bestCoupon.name}`
    : goShoppingActionLabel;
  const nextUseActionLabel = couponInsights.nextToUse
    ? `${t('pages.coupons.useNext')}: ${couponInsights.nextToUse.couponName}`
    : goShoppingActionLabel;
  const hideMobileSecondaryAction = !showClaimCta && couponNextAction.label === t('pages.coupons.goShopping');
  const hasAnyCouponAction = sortedClaimablePublicCoupons.length > 0 || couponInsights.unusedMine > 0;
  const couponPageStateClass = hasAnyCouponAction ? 'coupon-center-page--actionable' : 'coupon-center-page--quiet';
  const couponThresholdProgress = targetThreshold > 0
    ? Math.min(100, Math.round((cartSubtotal / targetThreshold) * 100))
    : couponInsights.targetCoupon ? 100 : 0;
  const couponProgressValueText = `${couponThresholdProgress}%: ${couponNextAction.title}`;
  const mobileCouponProgressLabel = `${t('pages.coupons.nextActionEyebrow')}: ${couponNextAction.title}`;
  const nextCouponProgressLabel = `${mobileCouponProgressLabel}, ${hasCouponTarget ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.noBestClaim')}: ${hasCouponTarget ? formatMoney(couponCartGap) : formatMoney(0)}`;
  const bestCouponValue = couponInsights.bestCoupon ? getCouponEstimatedValue(couponInsights.bestCoupon) : 0;
  const couponWalletStats = useMemo(() => ({
    unused: myCoupons.filter((coupon) => coupon.status === 'UNUSED').length,
    used: myCoupons.filter((coupon) => coupon.status === 'USED').length,
    expired: myCoupons.filter((coupon) => coupon.status === 'EXPIRED').length,
  }), [myCoupons]);
  const bestPublicCouponId = couponInsights.bestCoupon?.id;
  const sortedMyCoupons = useMemo(
    () => myCoupons.slice().sort((a, b) => {
      const statusScore = (coupon: UserCoupon) => coupon.status === 'UNUSED' ? 0 : coupon.status === 'USED' ? 1 : 2;
      const daysA = getDaysUntilEnd(a.endAt) ?? Number.MAX_SAFE_INTEGER;
      const daysB = getDaysUntilEnd(b.endAt) ?? Number.MAX_SAFE_INTEGER;
      return statusScore(a) - statusScore(b)
        || daysA - daysB
        || getCouponEstimatedValue(b) - getCouponEstimatedValue(a);
    }),
    [myCoupons],
  );
  const filteredWalletCoupons = useMemo(
    () => walletFilter === 'all'
      ? sortedMyCoupons
      : sortedMyCoupons.filter((coupon) => coupon.status === walletFilter),
    [sortedMyCoupons, walletFilter],
  );
  const walletGuide = useMemo(() => {
    const unusedCoupons = sortedMyCoupons.filter((coupon) => coupon.status === 'UNUSED');
    const nextExpiring = unusedCoupons.find((coupon) => getDaysUntilEnd(coupon.endAt) != null);
    const strongestSaved = unusedCoupons
      .slice()
      .sort((a, b) => getCouponEstimatedValue(b) - getCouponEstimatedValue(a))[0];
    return { nextExpiring, strongestSaved };
  }, [sortedMyCoupons]);
  const publicClaimStats = useMemo(() => ({
    matched: filteredClaimablePublicCoupons.length,
    saved: sortedPublicCoupons.filter((coupon) => ownedCouponIds.has(coupon.id)).length,
    total: sortedClaimablePublicCoupons.length,
  }), [filteredClaimablePublicCoupons.length, ownedCouponIds, sortedClaimablePublicCoupons.length, sortedPublicCoupons]);
  const couponSortLabels = useMemo<Record<CouponSort, string>>(() => ({
    recommended: couponUiText.sortRecommended,
    value: couponUiText.sortValue,
    ending: couponUiText.sortEnding,
    threshold: couponUiText.sortThreshold,
  }), [couponUiText]);
  const hasActiveCouponControls = couponSearch.trim() || couponSort !== 'recommended' || couponFilter !== 'all';
  const couponFilterOptions = useMemo<Array<{ key: CouponFilter; label: string; count: number }>>(() => {
    const endingCount = sortedClaimablePublicCoupons.filter((coupon) => isCouponEndingSoon(coupon.endAt)).length;
    return [
      { key: 'all', label: t('common.all'), count: sortedClaimablePublicCoupons.length },
      { key: 'claimable', label: t('pages.coupons.claimableCount'), count: sortedClaimablePublicCoupons.length },
      { key: 'ending', label: t('pages.coupons.expiringSoon'), count: endingCount },
    ];
  }, [sortedClaimablePublicCoupons, t]);
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const beginPriorityDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    priorityDragRef.current = {
      dragging: true,
      moved: false,
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.classList.add('coupon-priority-grid--dragging');
  };
  const movePriorityDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = priorityDragRef.current;
    if (!drag.dragging) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) <= 4 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    drag.moved = true;
    event.currentTarget.scrollLeft = drag.scrollLeft - deltaX;
    event.preventDefault();
  };
  const endPriorityDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = priorityDragRef.current;
    if (!drag.dragging) return;
    if (drag.moved) {
      suppressPriorityClickRef.current = true;
      window.setTimeout(() => {
        suppressPriorityClickRef.current = false;
      }, 120);
    }
    event.currentTarget.releasePointerCapture?.(drag.pointerId);
    event.currentTarget.classList.remove('coupon-priority-grid--dragging');
    priorityDragRef.current = { ...drag, dragging: false, pointerId: -1 };
  };
  const cancelPriorityClickAfterDrag = (event: React.MouseEvent<HTMLElement>) => {
    if (!suppressPriorityClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressPriorityClickRef.current = false;
  };

  if (loading) {
    return (
      <div
        className={`coupon-center-page coupon-center-page--loading coupon-center-page--${language}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <div className="coupon-center-page__loadingHero">
          <div className="coupon-center-page__skeleton coupon-center-page__skeleton--hero" aria-hidden="true">
            <span className="coupon-center-page__skeletonLine" />
            <span className="coupon-center-page__skeletonLine" />
            <span className="coupon-center-page__skeletonLine coupon-center-page__skeletonLine--short" />
          </div>
        </div>
        <div className="coupon-center-page__loadingGrid">
          {[0, 1, 2].map((index) => (
            <div key={index} className="coupon-center-page__skeleton" aria-hidden="true">
              <span className="coupon-center-page__skeletonLine" />
              <span className="coupon-center-page__skeletonLine" />
              <span className="coupon-center-page__skeletonLine" />
              <span className="coupon-center-page__skeletonLine coupon-center-page__skeletonLine--short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`coupon-center-page ${couponPageStateClass} coupon-center-page--${language}`}>
      <ShopBreadcrumb
        ariaLabel={t('pages.coupons.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'products', label: t('pages.productList.title'), path: '/products' },
          { key: 'coupons', label: t('pages.coupons.title') },
        ]}
      />
      {loadError && !usingFallbackCoupons ? (
        <div data-coupon-load-recovery="true">
          <PageError
            className="coupon-center-page__loadAlert"
            title={t('pages.coupons.loadFailed')}
            description={t('messages.loadFailedRetry')}
            actions={[
              {
                key: 'retry',
                label: t('messages.retry'),
                onClick: () => window.location.reload(),
                type: 'primary',
              },
              {
                key: 'shop',
                label: t('pages.coupons.goShopping'),
                onClick: () => navigate('/products'),
                type: 'default',
              },
              {
                key: 'cart',
                label: t('pages.cart.title'),
                onClick: () => navigate('/cart'),
                type: 'default',
              },
              {
                key: 'pet-finder',
                label: t('nav.petFinder'),
                onClick: () => navigate('/pet-finder'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('pages.productList.loadRecoverySupport'),
                onClick: () => dispatchDomEvent('shop:open-support'),
                type: 'default',
              },
            ]}
          />
        </div>
      ) : null}
      {usingFallbackCoupons ? (
        <Alert
          type="info"
          showIcon
          message={t('pages.coupons.catalogFallback')}
          description={t('pages.coupons.catalogFallbackDescription')}
          className="coupon-center-page__loadAlert"
          data-coupon-fallback-recovery="true"
          action={(
            <div className="coupon-center-page__fallbackActions" data-coupon-fallback-actions="true">
              <Button size="small" type="primary" onClick={() => window.location.reload()} aria-label={t('messages.retry')} title={t('messages.retry')}>
                {t('messages.retry')}
              </Button>
              <Button size="small" onClick={() => navigate('/products')} aria-label={t('pages.coupons.goShopping')} title={t('pages.coupons.goShopping')}>
                {t('pages.coupons.goShopping')}
              </Button>
              <Button size="small" onClick={() => navigate('/cart')} aria-label={t('pages.cart.title')} title={t('pages.cart.title')}>
                {t('pages.cart.title')}
              </Button>
              <Button size="small" onClick={() => navigate('/pet-finder')} aria-label={t('nav.petFinder')} title={t('nav.petFinder')}>
                {t('nav.petFinder')}
              </Button>
            </div>
          )}
        />
      ) : null}
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
            <Button
              type="primary"
              loading={showClaimCta && isAuthenticated ? claimingAll : false}
              disabled={showClaimCta ? (isAuthenticated ? claimAllActionDisabled : couponActionBusy) : couponActionBusy}
              aria-label={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
              title={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
              onClick={showClaimCta ? claimAllCoupons : couponNextAction.action}
            >
              {showClaimCta ? primaryClaimLabel : couponNextAction.label}
            </Button>
            <Button
              icon={<ShopIcon path={SI.shopping} />}
              className={hideMobileSecondaryAction ? 'coupon-center-page__secondaryAction--hidden' : undefined}
              aria-label={goShoppingActionLabel}
              title={goShoppingActionLabel}
              onClick={() => navigate('/products')}
            >
              {t('pages.coupons.goShopping')}
            </Button>
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
            <Button
              size="small"
              type="primary"
              aria-label={couponNextActionLabel}
              title={couponNextActionLabel}
              onClick={couponNextAction.action}
              disabled={claimingAll || claimingId != null || (isAuthenticated && bestCouponIsPreview)}
            >
              {couponNextAction.label}
            </Button>
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
        <Button
          type="primary"
          loading={showClaimCta ? claimingAll : false}
          disabled={showClaimCta ? (isAuthenticated ? claimAllActionDisabled : couponActionBusy) : couponActionBusy}
          aria-label={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
          title={showClaimCta ? primaryClaimActionLabel : couponNextActionLabel}
          onClick={showClaimCta ? claimAllCoupons : couponNextAction.action}
        >
          {showClaimCta ? primaryClaimLabel : couponNextAction.label}
        </Button>
        <Button
          icon={<ShopIcon path={SI.shopping} />}
          className={hideMobileSecondaryAction ? 'coupon-center-page__secondaryAction--hidden' : undefined}
          aria-label={goShoppingActionLabel}
          title={goShoppingActionLabel}
          onClick={() => navigate('/products')}
        >
          {t('pages.coupons.goShopping')}
        </Button>
      </div>

      <div className={hasAnyCouponAction ? 'coupon-section-header' : 'coupon-section-header coupon-section-header--quiet'}>
        <div>
          <span className="coupon-center-page__text coupon-center-page__text--secondary">{t('pages.coupons.opportunityEyebrow')}</span>
          <h2>{t('pages.coupons.opportunitySummaryTitle')}</h2>
        </div>
        <span>{t('pages.coupons.opportunitySummaryText')}</span>
      </div>

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
                <Tag color="volcano">{t('pages.coupons.validUntil', { time: bestCouponExpiry })}</Tag>
              ) : null;
            })()}
            {couponInsights.bestCoupon ? (
              <Button
                type="primary"
                loading={claimingId === couponInsights.bestCoupon.id}
                disabled={claimingAll || claimingId != null || (isAuthenticated && bestCouponIsPreview)}
                aria-label={bestCouponActionLabel}
                title={bestCouponActionLabel}
                onClick={() => claimCoupon(couponInsights.bestCoupon!.id)}
              >
                {bestCouponIsPreview ? t('pages.coupons.preview') : t('pages.coupons.claimBest')}
              </Button>
            ) : (
              <Button aria-label={goShoppingActionLabel} title={goShoppingActionLabel} onClick={() => navigate('/products')}>{t('pages.coupons.goShopping')}</Button>
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
              <Tag color={(getDaysUntilEnd(couponInsights.nextToUse.endAt) ?? 99) <= 3 ? 'volcano' : 'blue'}>
                {t('pages.coupons.daysLeft', { count: Math.max(0, getDaysUntilEnd(couponInsights.nextToUse.endAt) || 0) })}
              </Tag>
            ) : null}
            <Button icon={<ShopIcon path={SI.shopping} />} aria-label={nextUseActionLabel} title={nextUseActionLabel} onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}>
              {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
            </Button>
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
          <Button
            type="primary"
            icon={<ShopIcon path={SI.shopping} />}
            aria-label={nextUseActionLabel}
            title={nextUseActionLabel}
            onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}
          >
            {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
          </Button>
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
          <Button
            type={couponNextAction.tone === 'ready' || couponNextAction.tone === 'claim' ? 'primary' : 'default'}
            icon={<ShopIcon path={SI.shopping} />}
            loading={couponInsights.bestCoupon ? claimingId === couponInsights.bestCoupon.id : false}
            disabled={claimingAll || claimingId != null || (isAuthenticated && bestCouponIsPreview)}
            aria-label={couponNextActionLabel}
            title={couponNextActionLabel}
            onClick={couponNextAction.action}
          >
            {couponNextAction.label}
          </Button>
        </section>
      </div>

      <section className="coupon-claim-section__title" id="coupon-claim-list" style={{ marginBottom: 24 }}><div className="shop-panel__head"><div className="shop-panel__title">{(
          <span className="coupon-claim-section__title">
            <span>
              <strong>{t('pages.coupons.claimTitle')}</strong>
              <small>{t('pages.coupons.opportunitySummaryText')}</small>
            </span>
            <Tag color={claimableCoupons.length > 0 ? 'green' : 'default'}>{claimableCoupons.length}</Tag>
          </span>
        )}</div><div className="shop-panel__extra">{
          showClaimCta ? (
            <Button
              loading={claimingAll}
              disabled={claimAllActionDisabled}
              aria-label={primaryClaimActionLabel}
              title={primaryClaimActionLabel}
              onClick={claimAllCoupons}
            >
              {primaryClaimLabel}
            </Button>
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
            <Button
              type="primary"
              icon={isAuthenticated && myCoupons.length > 0 ? <ShopIcon path={SI.clock} /> : <ShopIcon path={SI.shopping} />}
              aria-label={isAuthenticated && myCoupons.length > 0 ? `${t('pages.coupons.myCoupons')}: ${myCoupons.length}` : goShoppingActionLabel}
              title={isAuthenticated && myCoupons.length > 0 ? `${t('pages.coupons.myCoupons')}: ${myCoupons.length}` : goShoppingActionLabel}
              onClick={() => isAuthenticated && myCoupons.length > 0 ? scrollToSection('coupon-wallet') : navigate('/products')}
            >
              {isAuthenticated && myCoupons.length > 0 ? t('pages.coupons.myCoupons') : t('pages.coupons.goShopping')}
            </Button>
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
                <Button
                  type="primary"
                  loading={claimingAll}
                  disabled={claimAllActionDisabled}
                  aria-label={primaryClaimActionLabel}
                  title={primaryClaimActionLabel}
                  onClick={claimAllCoupons}
                >
                  {primaryClaimLabel}
                </Button>
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
              <Input
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
                {couponSearch.trim() ? <Tag>{couponSearch.trim()}</Tag> : null}
                {couponSort !== 'recommended' ? <Tag>{couponSortLabels[couponSort]}</Tag> : null}
                {couponFilter !== 'all' ? <Tag>{couponFilterOptions.find((option) => option.key === couponFilter)?.label}</Tag> : null}
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
                      <Button
                        aria-label={`${t('pages.notifications.clearFilter')}: ${couponFilterOptions.find((option) => option.key === couponFilter)?.label || t('pages.productList.filters')}`}
                        title={`${t('pages.notifications.clearFilter')}: ${couponFilterOptions.find((option) => option.key === couponFilter)?.label || t('pages.productList.filters')}`}
                        onClick={() => setCouponFilter('all')}
                      >
                        {t('pages.notifications.clearFilter')}
                      </Button>
                      {couponSearch.trim() ? (
                        <Button
                          aria-label={`${couponUiText.resetSearch}: ${couponSearch.trim()}`}
                          title={`${couponUiText.resetSearch}: ${couponSearch.trim()}`}
                          onClick={() => setCouponSearch('')}
                        >
                          {couponUiText.resetSearch}
                        </Button>
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
                        {isBestPublicCoupon ? <Tag color="volcano">{couponUiText.bestMatch}</Tag> : null}
                        {previewCoupon ? <Tag color="blue">{t('pages.coupons.preview')}</Tag> : null}
                        {claimed ? <Tag color="green">{t('pages.coupons.claimed')}</Tag> : null}
                      </span>
                    )}</div><div className="shop-panel__extra">{(
                      <div className="coupon-center-page__couponTags">
                        {endingSoon ? <Tag color="volcano">{t('pages.coupons.expiringSoon')}</Tag> : null}
                        {limitedStock ? <Tag color="gold">{t('pages.coupons.limitedStock')}</Tag> : null}
                        <Tag color={coupon.couponType === 'FULL_REDUCTION' ? 'volcano' : 'blue'}>
                          {coupon.couponType === 'FULL_REDUCTION' ? t('pages.coupons.fullReduction') : t('pages.coupons.discount')}
                        </Tag>
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
                      <Button
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
                      </Button>
                    </div>
                  </article>
                </div>
              );
              })}
            </div>
          </>
        )}
      </section>

      <section className="coupon-wallet__heading" id="coupon-wallet"><div className="shop-panel__head"><div className="shop-panel__title">{(
          <span className="coupon-wallet__heading">
            <span>{t('pages.coupons.myCoupons')}</span>
            <Tag color={myCoupons.length > 0 ? 'green' : 'default'}>{myCoupons.length}</Tag>
          </span>
        )}</div></div>
        {myCoupons.length === 0 ? (
          <div className="coupon-wallet__empty" role="status">
            <span className="coupon-wallet__emptyIcon"><ShopIcon path={SI.gift} /></span>
            <h3>{t('pages.coupons.noMine')}</h3>
            <p>{t('pages.coupons.emptyWalletHint')}</p>
            <div className="coupon-wallet__emptyActions" data-coupon-wallet-empty-actions="true">
              <Button
                type="primary"
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={goShoppingActionLabel}
                title={goShoppingActionLabel}
                onClick={() => navigate('/products')}
              >
                {t('pages.coupons.goShopping')}
              </Button>
              <Button
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={t('pages.coupons.emptyWalletCart')}
                title={t('pages.coupons.emptyWalletCart')}
                onClick={() => navigate('/cart')}
              >
                {t('pages.coupons.emptyWalletCart')}
              </Button>
              <Button
                icon={<ShopIcon path={SI.gift} />}
                aria-label={t('pages.coupons.emptyWalletPetFinder')}
                title={t('pages.coupons.emptyWalletPetFinder')}
                onClick={() => navigate('/pet-finder')}
              >
                {t('pages.coupons.emptyWalletPetFinder')}
              </Button>
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
                    <Button
                      type="primary"
                      aria-label={couponUiText.walletAll}
                      title={couponUiText.walletAll}
                      onClick={() => setWalletFilter('all')}
                    >
                      {couponUiText.walletAll}
                    </Button>
                    <Button
                      icon={<ShopIcon path={SI.shopping} />}
                      aria-label={goShoppingActionLabel}
                      title={goShoppingActionLabel}
                      onClick={() => navigate('/products')}
                    >
                      {t('pages.coupons.goShopping')}
                    </Button>
                    <Button
                      icon={<ShopIcon path={SI.shopping} />}
                      aria-label={t('pages.coupons.emptyWalletCart')}
                      title={t('pages.coupons.emptyWalletCart')}
                      onClick={() => navigate('/cart')}
                    >
                      {t('pages.coupons.emptyWalletCart')}
                    </Button>
                    <Button
                      icon={<ShopIcon path={SI.gift} />}
                      aria-label={t('pages.coupons.emptyWalletPetFinder')}
                      title={t('pages.coupons.emptyWalletPetFinder')}
                      onClick={() => navigate('/pet-finder')}
                    >
                      {t('pages.coupons.emptyWalletPetFinder')}
                    </Button>
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
                      {isNextWalletCoupon ? <Tag className="coupon-wallet__nextTag" color="volcano">{couponUiText.walletNext}</Tag> : null}
                      <Tag className="coupon-wallet__status" color={couponStatusColor[coupon.status] || 'default'}>
                        {statusLabel}
                      </Tag>
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
                      <Button
                        type="primary"
                        icon={<ShopIcon path={SI.shopping} />}
                        className="coupon-wallet__action"
                        aria-label={walletUseActionLabel}
                        title={walletUseActionLabel}
                        onClick={() => navigate('/cart')}
                      >
                        {t('pages.coupons.use')}
                      </Button>
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
    </div>
  );
};

export default CouponCenter;
