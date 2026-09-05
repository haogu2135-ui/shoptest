import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { cartApi, couponApi, createApiAbortController } from '../api';
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
import ShopButton from '../components/ShopButton';
import ShopAlert from '../components/ShopAlert';
import {
  COUPON_WALLET_STATUS_KEYS,
  claimCouponsInBatches,
  getCouponDisplayName,
  isFallbackCoupon,
  type WalletFilter,
} from './couponCenterPageHelpers';
import { CouponCenterLoadingShell } from './couponCenterShellStates';
import {
  CouponCenterConversionPanels,
  CouponCenterOpportunityPanels,
  CouponCenterClaimPanel,
  CouponCenterWalletPanel,
  type CouponCenterPanelsProps,
} from './couponCenterPanels';
import './CouponCenter.css';

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
  const loadCouponsAbortRef = useRef<AbortController | null>(null);
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
    loadCouponsAbortRef.current?.abort();
    const abortController = createApiAbortController();
    loadCouponsAbortRef.current = abortController;
    const requestId = loadCouponsRequestRef.current + 1;
    loadCouponsRequestRef.current = requestId;
    setLoading(true);
    try {
      const cartPromise = isAuthenticated
        ? cartApi.getItems(0, { signal: abortController.signal }).then((res) => res.data || []).catch(() => [] as CartItem[])
        : Promise.resolve(getGuestCartItems());
      const [publicRes, mineRes, cartItems] = await Promise.all([
        couponApi.getPublic({ signal: abortController.signal }),
        isAuthenticated ? couponApi.getByUser(0, { signal: abortController.signal }) : Promise.resolve({ data: [] as UserCoupon[] }),
        cartPromise,
      ]);
      if (!mountedRef.current || requestId !== loadCouponsRequestRef.current || abortController.signal.aborted) return;
      const safeCartItems = toSafeArray<CartItem>(cartItems);
      const livePublicCoupons = toSafeArray<CouponPublic>(publicRes.data);
      setPublicCoupons(livePublicCoupons.length > 0 ? livePublicCoupons : getFallbackPublicCoupons());
      setMyCoupons(toSafeArray<UserCoupon>(mineRes.data));
      setCartSubtotal(getCartSubtotal(safeCartItems));
      setCartItemCount(getCartItemCount(safeCartItems));
      setLoadError(false);
    } catch (error) {
      if (abortController.signal.aborted) return;
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
      if (loadCouponsAbortRef.current === abortController) loadCouponsAbortRef.current = null;
      if (mountedRef.current && requestId === loadCouponsRequestRef.current && !abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadCoupons();
    return () => {
      loadCouponsAbortRef.current?.abort();
    };
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
  const couponWalletStats = useMemo(() => myCoupons.reduce((stats, coupon) => {
    if (coupon.status === 'UNUSED') stats.unused += 1;
    if (coupon.status === 'USED') stats.used += 1;
    if (coupon.status === 'EXPIRED') stats.expired += 1;
    return stats;
  }, { unused: 0, used: 0, expired: 0 }), [myCoupons]);
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
    return <CouponCenterLoadingShell language={language} t={t} />;
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
        <ShopAlert
          type="info"
          showIcon
          message={t('pages.coupons.catalogFallback')}
          description={t('pages.coupons.catalogFallbackDescription')}
          className="coupon-center-page__loadAlert"
          data-coupon-fallback-recovery="true"
          action={(
            <div className="coupon-center-page__fallbackActions" data-coupon-fallback-actions="true">
              <ShopButton size="small" type="primary" onClick={() => window.location.reload()} aria-label={t('messages.retry')} title={t('messages.retry')}>
                {t('messages.retry')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/products')} aria-label={t('pages.coupons.goShopping')} title={t('pages.coupons.goShopping')}>
                {t('pages.coupons.goShopping')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/cart')} aria-label={t('pages.cart.title')} title={t('pages.cart.title')}>
                {t('pages.cart.title')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/pet-finder')} aria-label={t('nav.petFinder')} title={t('nav.petFinder')}>
                {t('nav.petFinder')}
              </ShopButton>
            </div>
          )}
        />
      ) : null}
      {(() => {
        const panelProps: CouponCenterPanelsProps = {
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
        };
        return (
          <>
            <CouponCenterConversionPanels {...panelProps} />
            <CouponCenterOpportunityPanels {...panelProps} />
            <CouponCenterClaimPanel {...panelProps} />
            <CouponCenterWalletPanel {...panelProps} />
          </>
        );
      })()}

    </div>
  );
};

export default CouponCenter;
