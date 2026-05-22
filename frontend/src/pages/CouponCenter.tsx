import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Input, List, message, Row, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, FireOutlined, GiftOutlined, SearchOutlined, ShoppingOutlined, SortAscendingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { cartApi, couponApi } from '../api';
import type { CartItem, Coupon, UserCoupon } from '../types';
import { useLanguage } from '../i18n';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { useMarket } from '../hooks/useMarket';
import { dispatchDomEvent } from '../utils/domEvents';
import { getGuestCartItems } from '../utils/guestCart';
import { getCouponUiText } from '../utils/couponUiText';
import { getLocalStorageItem } from '../utils/safeStorage';
import {
  filterPublicCoupons,
  getCartItemCount,
  getCartSubtotal,
  getCouponEstimatedValue,
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

const { Text, Title } = Typography;

const couponStatusColor: Record<string, string> = {
  UNUSED: 'green',
  USED: 'default',
  EXPIRED: 'volcano',
};

type WalletFilter = 'all' | 'UNUSED' | 'USED' | 'EXPIRED';
const CLAIM_BATCH_SIZE = 4;

const getCouponDisplayName = (coupon: Coupon | UserCoupon) =>
  'couponName' in coupon ? coupon.couponName : coupon.name;

const claimCouponsInBatches = async (coupons: Coupon[]) => {
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
  const [publicCoupons, setPublicCoupons] = useState<Coupon[]>([]);
  const [myCoupons, setMyCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
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
      setPublicCoupons(toSafeArray<Coupon>(publicRes.data));
      setMyCoupons(toSafeArray<UserCoupon>(mineRes.data));
      setCartSubtotal(getCartSubtotal(safeCartItems));
      setCartItemCount(getCartItemCount(safeCartItems));
    } catch {
      if (mountedRef.current && requestId === loadCouponsRequestRef.current) {
        message.error(t('pages.coupons.loadFailed'));
      }
    } finally {
      if (mountedRef.current && requestId === loadCouponsRequestRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, t]);

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
  const couponUiText = useMemo(() => getCouponUiText(language), [language]);
  const formatDaysBadge = useCallback((days: number | null | undefined, fallback?: string) => {
    if (days == null) return fallback || couponUiText.noExpiry;
    if (days < 0) return t('status.EXPIRED');
    if (days === 0) return couponUiText.today;
    return couponUiText.daysShort.replace('{count}', String(days));
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

  const describeCoupon = (coupon: Pick<Coupon, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>) => {
    if (coupon.couponType === 'FULL_REDUCTION') {
      return `${t('pages.adminCoupons.minimumSpend')} ${formatMoney(Math.max(0, toFiniteNumber(coupon.thresholdAmount)))} / ${t('pages.adminCoupons.reductionAmount')} ${formatMoney(Math.max(0, toFiniteNumber(coupon.reductionAmount)))}`;
    }
    const maxDiscount = Math.max(0, toFiniteNumber(coupon.maxDiscountAmount));
    const discountPercent = Math.max(0, Math.min(toFiniteNumber(coupon.discountPercent, 0), 100));
    const maxText = maxDiscount > 0 ? `, ${t('pages.coupons.maxDiscount', { amount: formatMoney(maxDiscount) })}` : '';
    return t('pages.coupons.discountPayable', { percent: discountPercent }) + maxText;
  };

  const claimCoupon = async (couponId: number) => {
    if (claimingId != null || claimingAll) return;
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    setClaimingId(couponId);
    setClaimBatchSummary(null);
    try {
      await couponApi.claim(couponId, 0);
      message.success(t('pages.coupons.claimedSuccess'));
      dispatchDomEvent('shop:coupons-updated');
      await loadCoupons();
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.coupons.claimFailed'));
    } finally {
      setClaimingId(null);
    }
  };

  const claimAllCoupons = async () => {
    if (claimingAll || claimingId != null) return;
    if (!isAuthenticated) {
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (claimableCoupons.length === 0) {
      message.info(t('pages.coupons.noClaimable'));
      return;
    }
    try {
      setClaimingAll(true);
      setClaimBatchSummary(null);
      const results = await claimCouponsInBatches(claimableCoupons);
      const claimed = results.filter((result) => result.status === 'fulfilled').length;
      setClaimBatchSummary({ claimed, total: claimableCoupons.length });
      if (claimed > 0) {
        message.success(t('pages.coupons.claimedAllSuccess', { count: claimed }));
        dispatchDomEvent('shop:coupons-updated');
      } else {
        message.error(t('pages.coupons.claimFailed'));
      }
      await loadCoupons();
    } catch {
      message.error(t('pages.coupons.claimFailed'));
    } finally {
      setClaimingAll(false);
    }
  };

  const targetThreshold = Math.max(0, toFiniteNumber(couponInsights.targetCoupon?.thresholdAmount));
  const hasCouponTarget = Boolean(couponInsights.targetCoupon);
  const couponCartGap = Math.max(0, targetThreshold - cartSubtotal);
  const couponNextAction = (() => {
    if (!isAuthenticated && couponInsights.bestCoupon) {
      return {
        tone: 'warning',
        title: t('pages.coupons.nextActionLoginTitle'),
        text: t('pages.coupons.nextActionLoginText', { name: couponInsights.bestCoupon.name }),
        label: t('nav.login'),
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
        label: t('pages.coupons.claimBest'),
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
  const claimAllActionDisabled = isAuthenticated
    ? claimableCoupons.length === 0 || couponActionBusy
    : couponActionBusy;
  const showClaimCta = isAuthenticated ? claimableCoupons.length > 0 : publicCoupons.length > 0;
  const hideMobileSecondaryAction = !showClaimCta && couponNextAction.label === t('pages.coupons.goShopping');
  const hasAnyCouponAction = sortedClaimablePublicCoupons.length > 0 || couponInsights.unusedMine > 0;
  const couponPageStateClass = hasAnyCouponAction ? 'coupon-center-page--actionable' : 'coupon-center-page--quiet';
  const couponThresholdProgress = targetThreshold > 0
    ? Math.min(100, Math.round((cartSubtotal / targetThreshold) * 100))
    : couponInsights.targetCoupon ? 100 : 0;
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
      <div className={`coupon-center-page coupon-center-page--loading coupon-center-page--${language}`}>
        <div className="coupon-center-page__loadingHero">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
        <div className="coupon-center-page__loadingGrid">
          <Skeleton active paragraph={{ rows: 4 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`coupon-center-page ${couponPageStateClass} coupon-center-page--${language}`}>
      <section className={`coupon-center-page__hero coupon-center-page__hero--${couponNextAction.tone}`}>
        <div className="coupon-center-page__heroCopy">
          <Text className="coupon-center-page__eyebrow">{t('pages.coupons.title')}</Text>
          <Title level={2}><GiftOutlined /> {t('pages.coupons.opportunityTitle')}</Title>
          <Text className="coupon-center-page__heroText">
            {couponInsights.bestCoupon
              ? t('pages.coupons.opportunitySubtitleBest', { name: couponInsights.bestCoupon.name })
              : t('pages.coupons.opportunitySubtitle')}
          </Text>
          <Space wrap className="coupon-center-page__heroActions">
            <Button
              type="primary"
              loading={showClaimCta ? claimingAll : false}
              disabled={showClaimCta ? claimAllActionDisabled : couponActionBusy}
              onClick={showClaimCta ? claimAllCoupons : couponNextAction.action}
            >
              {showClaimCta ? (isAuthenticated ? t('pages.coupons.claimAll') : t('nav.login')) : couponNextAction.label}
            </Button>
            <Button
              icon={<ShoppingOutlined />}
              className={hideMobileSecondaryAction ? 'coupon-center-page__secondaryAction--hidden' : undefined}
              onClick={() => navigate('/products')}
            >
              {t('pages.coupons.goShopping')}
            </Button>
          </Space>
          <div className="coupon-center-page__heroBadges" aria-label={t('pages.coupons.opportunitySummaryTitle')}>
            <span className={bestCouponValue > 0 ? 'coupon-center-page__heroBadge coupon-center-page__heroBadge--primary' : 'coupon-center-page__heroBadge coupon-center-page__heroBadge--primary coupon-center-page__heroBadge--muted'}>
              <GiftOutlined />
              {bestCouponValue > 0 ? formatMoney(bestCouponValue) : t('pages.coupons.noBestClaim')}
            </span>
            <span className={couponInsights.expiringSoon > 0 ? 'coupon-center-page__heroBadge' : 'coupon-center-page__heroBadge coupon-center-page__heroBadge--muted'}>
              <ClockCircleOutlined />
              {t('pages.coupons.expiringSoon')}: {couponInsights.expiringSoon}
            </span>
            <span className={couponInsights.unusedMine > 0 ? 'coupon-center-page__heroBadge' : 'coupon-center-page__heroBadge coupon-center-page__heroBadge--muted'}>
              <ThunderboltOutlined />
              {t('pages.coupons.readyToUse')}: {couponInsights.unusedMine}
            </span>
          </div>
        </div>
        <div className="coupon-center-page__heroStats" aria-label={t('pages.coupons.title')}>
          <div className="coupon-center-page__statGrid">
            <div className={claimableCoupons.length === 0 ? 'coupon-center-page__statCard coupon-center-page__statCard--empty' : 'coupon-center-page__statCard'}>
              <span className="coupon-center-page__statIcon"><GiftOutlined /></span>
              <strong>{claimableCoupons.length}</strong>
              <span>{t('pages.coupons.claimableCount')}</span>
            </div>
            <div className={couponInsights.unusedMine === 0 ? 'coupon-center-page__statCard coupon-center-page__statCard--empty' : 'coupon-center-page__statCard'}>
              <span className="coupon-center-page__statIcon"><ThunderboltOutlined /></span>
              <strong>{couponInsights.unusedMine}</strong>
              <span>{t('pages.coupons.readyToUse')}</span>
            </div>
            <div className="coupon-center-page__statCard coupon-center-page__statCard--cart">
              <span className="coupon-center-page__statIcon"><ShoppingOutlined /></span>
              <strong>{formatMoney(cartSubtotal)}</strong>
              <span>{t('pages.coupons.currentCartValue')}</span>
            </div>
          </div>
          <div className={`coupon-center-page__heroPlan coupon-center-page__heroPlan--${couponNextAction.tone}`}>
            <Text type="secondary">{t('pages.coupons.nextActionEyebrow')}</Text>
            <strong>{couponNextAction.title}</strong>
            <span>{couponNextAction.text}</span>
            <Button size="small" type="primary" onClick={couponNextAction.action} disabled={claimingAll || claimingId != null}>
              {couponNextAction.label}
            </Button>
          </div>
        </div>
      </section>

      <nav className="coupon-center-page__quickNav" aria-label={t('pages.coupons.title')}>
        <button type="button" className={couponThresholdProgress <= 0 ? 'coupon-center-page__quickNavItem--muted' : undefined} onClick={() => scrollToSection('coupon-next-action')}>
          <ThunderboltOutlined /> {t('pages.coupons.nextActionEyebrow')} <span>{couponThresholdProgress}%</span>
        </button>
        <button type="button" className={sortedClaimablePublicCoupons.length === 0 ? 'coupon-center-page__quickNavItem--muted' : undefined} onClick={() => scrollToSection('coupon-claim-list')}>
          <GiftOutlined /> {t('pages.coupons.claimTitle')} <span>{sortedClaimablePublicCoupons.length}</span>
        </button>
        <button type="button" className={myCoupons.length === 0 ? 'coupon-center-page__quickNavItem--muted' : undefined} onClick={() => scrollToSection('coupon-wallet')}>
          <ClockCircleOutlined /> {t('pages.coupons.myCoupons')} <span>{myCoupons.length}</span>
        </button>
      </nav>

      <div className={hideMobileSecondaryAction ? 'coupon-center-page__mobileActionBar coupon-center-page__mobileActionBar--single' : 'coupon-center-page__mobileActionBar'}>
        <Button
          type="primary"
          loading={showClaimCta ? claimingAll : false}
          disabled={showClaimCta ? claimAllActionDisabled : couponActionBusy}
          onClick={showClaimCta ? claimAllCoupons : couponNextAction.action}
        >
          {showClaimCta ? (isAuthenticated ? t('pages.coupons.claimAll') : t('nav.login')) : couponNextAction.label}
        </Button>
        <Button
          icon={<ShoppingOutlined />}
          className={hideMobileSecondaryAction ? 'coupon-center-page__secondaryAction--hidden' : undefined}
          onClick={() => navigate('/products')}
        >
          {t('pages.coupons.goShopping')}
        </Button>
      </div>

      <div className={hasAnyCouponAction ? 'coupon-section-header' : 'coupon-section-header coupon-section-header--quiet'}>
        <div>
          <Text type="secondary">{t('pages.coupons.opportunityEyebrow')}</Text>
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
          <Text type="secondary" className="coupon-priority-card__label">
            <GiftOutlined /> {t('pages.coupons.bestClaimEyebrow')}
          </Text>
          <h3>{couponInsights.bestCoupon?.name || t('pages.coupons.noBestClaim')}</h3>
          <p>
            {couponInsights.bestCoupon
              ? describeCoupon(couponInsights.bestCoupon)
              : t('pages.coupons.noBestClaimHint')}
          </p>
          <Space wrap>
            {(() => {
              const bestCouponExpiry = formatCouponDate(couponInsights.bestCoupon?.endAt);
              return bestCouponExpiry ? (
                <Tag color="volcano">{t('pages.coupons.validUntil', { time: bestCouponExpiry })}</Tag>
              ) : null;
            })()}
            {couponInsights.bestCoupon ? (
              <Button type="primary" loading={claimingId === couponInsights.bestCoupon.id} disabled={claimingAll || claimingId != null} onClick={() => claimCoupon(couponInsights.bestCoupon!.id)}>
                {t('pages.coupons.claimBest')}
              </Button>
            ) : (
              <Button onClick={() => navigate('/products')}>{t('pages.coupons.goShopping')}</Button>
            )}
          </Space>
        </div>
        <div className={couponInsights.nextToUse ? 'coupon-priority-card coupon-priority-card--use' : 'coupon-priority-card coupon-priority-card--use coupon-priority-card--empty'}>
          <Text type="secondary" className="coupon-priority-card__label">
            <ClockCircleOutlined /> {t('pages.coupons.nextUseEyebrow')}
          </Text>
          <h3>{couponInsights.nextToUse?.couponName || t('pages.coupons.noNextUse')}</h3>
          <p>
            {couponInsights.nextToUse
              ? t('pages.coupons.nextUseHint', { value: describeCoupon(couponInsights.nextToUse) })
              : t('pages.coupons.noNextUseHint')}
          </p>
          <Space wrap>
            {couponInsights.nextToUse?.endAt ? (
              <Tag color={(getDaysUntilEnd(couponInsights.nextToUse.endAt) ?? 99) <= 3 ? 'volcano' : 'blue'}>
                {t('pages.coupons.daysLeft', { count: Math.max(0, getDaysUntilEnd(couponInsights.nextToUse.endAt) || 0) })}
              </Tag>
            ) : null}
            <Button icon={<ShoppingOutlined />} onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}>
              {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
            </Button>
          </Space>
        </div>
      </section>

      <div className={!hasCouponTarget ? 'coupon-guidance-grid coupon-guidance-grid--neutral' : 'coupon-guidance-grid'}>
        <section className={!hasCouponTarget ? 'coupon-savings-path coupon-savings-path--neutral' : 'coupon-savings-path'} aria-label={t('pages.coupons.savingsPathTitle')}>
          <div>
            <Text type="secondary">{t('pages.coupons.savingsPathEyebrow')}</Text>
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
            icon={<ShoppingOutlined />}
            onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}
          >
            {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
          </Button>
        </section>

        <section id="coupon-next-action" className={`coupon-next-action coupon-next-action--${couponNextAction.tone}`} aria-label={t('pages.coupons.nextActionEyebrow')}>
          <div>
            <Text type="secondary">{t('pages.coupons.nextActionEyebrow')}</Text>
            <h3>{couponNextAction.title}</h3>
            <p>{couponNextAction.text}</p>
          </div>
          <div className="coupon-next-action__meta">
            <span className="coupon-next-action__metaItem coupon-next-action__metaItem--cart">
              <strong>{formatMoney(cartSubtotal)}</strong>
              <Text type="secondary">{t('pages.coupons.currentCartValue')}</Text>
            </span>
            <span className={hasCouponTarget ? 'coupon-next-action__metaItem' : 'coupon-next-action__metaItem coupon-next-action__metaItem--empty'}>
              <strong>{couponCartGap > 0 ? formatMoney(couponCartGap) : formatMoney(0)}</strong>
              <Text type="secondary">{hasCouponTarget ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.noBestClaim')}</Text>
            </span>
          </div>
          <div
            className="coupon-next-action__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={couponThresholdProgress}
            style={{ ['--coupon-progress' as string]: `${couponThresholdProgress}%` }}
          >
            <span />
          </div>
          <div className="coupon-next-action__progressLabel">
            <span>{couponThresholdProgress}%</span>
            <Text type="secondary">{hasCouponTarget ? (couponCartGap > 0 ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.useNext')) : t('pages.coupons.goShopping')}</Text>
          </div>
          <Button
            type={couponNextAction.tone === 'ready' || couponNextAction.tone === 'claim' ? 'primary' : 'default'}
            icon={<ShoppingOutlined />}
            loading={couponInsights.bestCoupon ? claimingId === couponInsights.bestCoupon.id : false}
            disabled={claimingAll || claimingId != null}
            onClick={couponNextAction.action}
          >
            {couponNextAction.label}
          </Button>
        </section>
      </div>

      <Card
        id="coupon-claim-list"
        title={(
          <span className="coupon-claim-section__title">
            <span>
              <strong>{t('pages.coupons.claimTitle')}</strong>
              <small>{t('pages.coupons.opportunitySummaryText')}</small>
            </span>
            <Tag color={claimableCoupons.length > 0 ? 'green' : 'default'}>{claimableCoupons.length}</Tag>
          </span>
        )}
        className="coupon-claim-section"
        style={{ marginBottom: 24 }}
        extra={
          showClaimCta ? (
            <Button loading={claimingAll} disabled={claimAllActionDisabled} onClick={claimAllCoupons}>
              {isAuthenticated ? t('pages.coupons.claimAll') : t('nav.login')}
            </Button>
          ) : null
        }
      >
        {publicCoupons.length === 0 || sortedClaimablePublicCoupons.length === 0 ? (
          <div className={publicCoupons.length === 0 ? 'coupon-claim-section__empty' : 'coupon-claim-section__empty coupon-claim-section__empty--resolved'}>
            <span className="coupon-claim-section__emptyIcon"><GiftOutlined /></span>
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
              icon={isAuthenticated && myCoupons.length > 0 ? <ClockCircleOutlined /> : <ShoppingOutlined />}
              onClick={() => isAuthenticated && myCoupons.length > 0 ? scrollToSection('coupon-wallet') : navigate('/products')}
            >
              {isAuthenticated && myCoupons.length > 0 ? t('pages.coupons.myCoupons') : t('pages.coupons.goShopping')}
            </Button>
          </div>
        ) : (
          <>
            <div className="coupon-claim-section__toolbar">
              <div>
                <GiftOutlined className="coupon-claim-section__toolbarIcon" />
                <span>{t('pages.coupons.claimableCount')}</span>
                <strong>{claimableCoupons.length}</strong>
              </div>
              <div>
                <ClockCircleOutlined className="coupon-claim-section__toolbarIcon" />
                <span>{t('pages.coupons.expiringSoon')}</span>
                <strong>{couponInsights.expiringSoon}</strong>
              </div>
              <div>
                <FireOutlined className="coupon-claim-section__toolbarIcon" />
                <span>{t('pages.coupons.limitedStock')}</span>
                <strong>{couponInsights.limitedStock}</strong>
              </div>
              {showClaimCta ? (
                <Button type="primary" loading={claimingAll} disabled={claimAllActionDisabled} onClick={claimAllCoupons}>
                  {isAuthenticated ? t('pages.coupons.claimAll') : t('nav.login')}
                </Button>
              ) : null}
            </div>
            {claimableCoupons.length === 0 ? (
              <div className="coupon-claim-section__notice" role="status">
                <CheckCircleOutlined />
                <span>{t('pages.coupons.noBestClaimHint')}</span>
              </div>
            ) : null}
            {claimBatchSummary ? (
              <div className="coupon-claim-section__claimResult" role="status">
                <CheckCircleOutlined />
                <span>
                  {couponUiText.claimSummary
                    .replace('{claimed}', String(claimBatchSummary.claimed))
                    .replace('{total}', String(claimBatchSummary.total))}
                </span>
              </div>
            ) : null}
            <div className="coupon-claim-section__controls">
              <Input
                allowClear
                className="coupon-claim-section__search"
                prefix={<SearchOutlined />}
                value={couponSearch}
                placeholder={couponUiText.searchPlaceholder}
                onChange={(event) => setCouponSearch(event.target.value)}
              />
              <Select
                className="coupon-claim-section__sort"
                value={couponSort}
                suffixIcon={<SortAscendingOutlined />}
                onChange={(value) => setCouponSort(value)}
                options={[
                  { value: 'recommended', label: couponUiText.sortRecommended },
                  { value: 'value', label: couponUiText.sortValue },
                  { value: 'ending', label: couponUiText.sortEnding },
                  { value: 'threshold', label: couponUiText.sortThreshold },
                ]}
              />
            </div>
            <div className="coupon-claim-section__filters" aria-label={t('pages.productList.filters')}>
              <div className="coupon-claim-section__filterButtons">
                {couponFilterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={[
                      'coupon-claim-section__filterButton',
                      couponFilter === option.key ? 'coupon-claim-section__filterButton--active' : '',
                      option.count === 0 ? 'coupon-claim-section__filterButton--empty' : '',
                    ].filter(Boolean).join(' ')}
                    aria-pressed={couponFilter === option.key}
                    onClick={() => setCouponFilter(option.key)}
                  >
                    <span>{option.label}</span>
                    <strong>{option.count}</strong>
                  </button>
                ))}
              </div>
              <Text type="secondary">
                {couponUiText.visibleResults}: {filteredClaimablePublicCoupons.length} / {sortedClaimablePublicCoupons.length}
              </Text>
            </div>
            {hasActiveCouponControls ? (
              <div className="coupon-claim-section__activeContext">
                <span>{couponUiText.activeControls}</span>
                {couponSearch.trim() ? <Tag>{couponSearch.trim()}</Tag> : null}
                {couponSort !== 'recommended' ? <Tag>{couponSortLabels[couponSort]}</Tag> : null}
                {couponFilter !== 'all' ? <Tag>{couponFilterOptions.find((option) => option.key === couponFilter)?.label}</Tag> : null}
                <button
                  type="button"
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
            <Row gutter={[16, 16]}>
              {filteredClaimablePublicCoupons.length === 0 ? (
                <Col span={24}>
                  <div className="coupon-claim-section__filterEmpty">
                    <GiftOutlined />
                    <strong>{couponSearch.trim() ? couponUiText.noSearchResults : t('pages.coupons.noClaimable')}</strong>
                    <span>{t('pages.coupons.opportunitySubtitle')}</span>
                    <Space wrap>
                      <Button onClick={() => setCouponFilter('all')}>{t('pages.notifications.clearFilter')}</Button>
                      {couponSearch.trim() ? <Button onClick={() => setCouponSearch('')}>{couponUiText.resetSearch}</Button> : null}
                    </Space>
                  </div>
                </Col>
              ) : filteredClaimablePublicCoupons.map((coupon) => {
              const claimed = ownedCouponIds.has(coupon.id);
              const remaining = getCouponRemaining(coupon);
              const endingSoon = isCouponEndingSoon(coupon.endAt) && !claimed && remaining !== 0;
              const limitedStock = remaining != null && remaining > 0 && remaining <= 10 && !claimed;
              const estimatedValue = getCouponEstimatedValue(coupon);
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
              const validUntilText = formatCouponDate(coupon.endAt);
              return (
                <Col xs={24} md={12} lg={8} key={coupon.id}>
                  <Card
                    className={`coupon-center-page__coupon ${couponStateClass}`}
                    size="small"
                    title={(
                      <span className="coupon-center-page__couponTitle">
                        <span>{coupon.name}</span>
                        {isBestPublicCoupon ? <Tag color="volcano">{couponUiText.bestMatch}</Tag> : null}
                        {claimed ? <Tag color="green">{t('pages.coupons.claimed')}</Tag> : null}
                      </span>
                    )}
                    extra={(
                      <Space size={4} wrap className="coupon-center-page__couponTags">
                        {endingSoon ? <Tag color="volcano">{t('pages.coupons.expiringSoon')}</Tag> : null}
                        {limitedStock ? <Tag color="gold">{t('pages.coupons.limitedStock')}</Tag> : null}
                        <Tag color={coupon.couponType === 'FULL_REDUCTION' ? 'volcano' : 'blue'}>
                          {coupon.couponType === 'FULL_REDUCTION' ? t('pages.coupons.fullReduction') : t('pages.coupons.discount')}
                        </Tag>
                      </Space>
                    )}
                  >
                    <span className="coupon-center-page__couponRibbon">{couponStateLabel}</span>
                    <Space direction="vertical" className="coupon-center-page__couponBody" style={{ width: '100%' }}>
                      <div className="coupon-center-page__couponValueRow">
                        <Text strong className="coupon-center-page__couponValue">{describeCoupon(coupon)}</Text>
                      {estimatedValue > 0 ? <span className="coupon-center-page__couponEstimate">{formatMoney(estimatedValue)}</span> : null}
                      </div>
                      <div className="coupon-center-page__couponDetails" aria-label={coupon.name}>
                        <span>
                          <small>{t('pages.adminCoupons.minimumSpend')}</small>
                          <strong>{thresholdAmount > 0 ? formatMoney(thresholdAmount) : formatMoney(0)}</strong>
                        </span>
                        <span>
                          <small>{couponUiText.remainingLabel}</small>
                          <strong>{remaining !== null ? remaining : '-'}</strong>
                        </span>
                      </div>
                      <div className="coupon-center-page__couponMicroFacts">
                        <span>
                          <ClockCircleOutlined />
                          {formatDaysBadge(daysLeft)}
                        </span>
                        <span>
                          <GiftOutlined />
                          {remaining == null ? couponUiText.unlimitedStock : t('pages.coupons.remaining', { count: remaining })}
                        </span>
                      </div>
                      {!claimed && remaining !== 0 && thresholdAmount > 0 ? (
                        <div className={cartGap > 0 ? 'coupon-center-page__couponFit' : 'coupon-center-page__couponFit coupon-center-page__couponFit--ready'}>
                          <span>{cartGap > 0 ? t('pages.coupons.couponThresholdGap') : t('pages.coupons.useNext')}</span>
                          <strong>{cartGap > 0 ? formatMoney(cartGap) : formatMoney(0)}</strong>
                          <i style={{ ['--coupon-card-progress' as string]: `${cartProgress}%` }} />
                        </div>
                      ) : null}
                      {isCartReadyCoupon ? (
                        <span className="coupon-center-page__couponReady">
                          <CheckCircleOutlined /> {couponUiText.cartReady}
                        </span>
                      ) : null}
                      {coupon.description ? <Text type="secondary" className="coupon-center-page__couponMeta">{coupon.description}</Text> : null}
                      {validUntilText ? <Text type="secondary" className="coupon-center-page__couponMeta">{t('pages.coupons.validUntil', { time: validUntilText })}</Text> : null}
                      <Button
                        type="primary"
                        block
                        className="coupon-center-page__couponAction"
                        icon={!isAuthenticated ? undefined : claimed ? <CheckCircleOutlined /> : <GiftOutlined />}
                        disabled={claimingAll || claimingId != null || claimed || remaining === 0}
                        loading={claimingId === coupon.id}
                        aria-label={`${couponStateLabel}: ${coupon.name}`}
                        onClick={() => claimCoupon(coupon.id)}
                      >
                        {!isAuthenticated ? t('nav.login') : claimed ? t('pages.coupons.claimed') : t('pages.coupons.claim')}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              );
              })}
            </Row>
          </>
        )}
      </Card>

      <Card
        id="coupon-wallet"
        title={(
          <span className="coupon-wallet__heading">
            <span>{t('pages.coupons.myCoupons')}</span>
            <Tag color={myCoupons.length > 0 ? 'green' : 'default'}>{myCoupons.length}</Tag>
          </span>
        )}
        className={couponWalletStats.unused === 0 && myCoupons.length > 0 ? 'coupon-wallet coupon-wallet--historyOnly' : 'coupon-wallet'}
      >
        {myCoupons.length === 0 ? (
          <div className="coupon-wallet__empty">
            <span className="coupon-wallet__emptyIcon"><GiftOutlined /></span>
            <h3>{t('pages.coupons.noMine')}</h3>
            <p>{t('pages.coupons.noNextUseHint')}</p>
            <Button type="primary" icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>{t('pages.coupons.goShopping')}</Button>
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
          <div className="coupon-wallet__filters" aria-label={t('pages.coupons.myCoupons')}>
            {([
              ['all', couponUiText.walletAll, myCoupons.length],
              ['UNUSED', t('status.UNUSED'), couponWalletStats.unused],
              ['USED', t('status.USED'), couponWalletStats.used],
              ['EXPIRED', t('status.EXPIRED'), couponWalletStats.expired],
            ] as Array<[WalletFilter, string, number]>).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={[
                  'coupon-wallet__filter',
                  walletFilter === key ? 'coupon-wallet__filter--active' : '',
                  count === 0 ? 'coupon-wallet__filter--empty' : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={walletFilter === key}
                onClick={() => setWalletFilter(key)}
              >
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <List
            className="coupon-wallet__list"
            dataSource={filteredWalletCoupons}
            locale={{ emptyText: couponUiText.walletFilteredEmpty }}
            renderItem={(coupon) => {
              const expiryText = formatCouponDate(coupon.endAt);
              const statusLabel = coupon.status ? t(`status.${coupon.status}`) : '-';
              const daysLeft = getDaysUntilEnd(coupon.endAt);
              const walletCouponValue = getCouponEstimatedValue(coupon);
              const walletThreshold = Math.max(0, toFiniteNumber(coupon.thresholdAmount));
              const walletGap = Math.max(0, walletThreshold - cartSubtotal);
              const walletProgress = walletThreshold > 0 ? Math.min(100, Math.round((cartSubtotal / walletThreshold) * 100)) : 100;
              const isNextWalletCoupon = couponInsights.nextToUse?.id === coupon.id;
              const expiryTone = coupon.status !== 'UNUSED'
                ? 'muted'
                : daysLeft != null && daysLeft <= 3
                  ? 'urgent'
                  : 'normal';
              return (
              <List.Item className="coupon-wallet__item">
                <div className={`coupon-wallet__coupon coupon-wallet__coupon--${(coupon.status || 'unknown').toLowerCase()} ${isNextWalletCoupon ? 'coupon-wallet__coupon--next' : ''}`}>
                  <span className="coupon-wallet__couponIcon"><GiftOutlined /></span>
                  <div className="coupon-wallet__main">
                    <div className="coupon-wallet__titleRow">
                      <Text strong className="coupon-wallet__name">{coupon.couponName}</Text>
                      {isNextWalletCoupon ? <Tag className="coupon-wallet__nextTag" color="volcano">{couponUiText.walletNext}</Tag> : null}
                      <Tag className="coupon-wallet__status" color={couponStatusColor[coupon.status] || 'default'}>
                        {statusLabel}
                      </Tag>
                    </div>
                    <div className={coupon.status === 'UNUSED' ? 'coupon-wallet__valueRow' : 'coupon-wallet__valueRow coupon-wallet__valueRow--closed'}>
                      <Text className="coupon-wallet__value">{describeCoupon(coupon)}</Text>
                      {walletCouponValue > 0 ? <span>{formatMoney(walletCouponValue)}</span> : null}
                    </div>
                    {expiryText ? (
                      <span className={`coupon-wallet__expiryPill coupon-wallet__expiryPill--${expiryTone}`}>
                        <ClockCircleOutlined />
                        {t('pages.coupons.validUntilPrefix', { time: expiryText })}
                      </span>
                    ) : null}
                    <div className="coupon-wallet__quickFacts">
                      <span className={coupon.status === 'UNUSED' ? 'coupon-wallet__quickFact coupon-wallet__quickFact--time' : 'coupon-wallet__quickFact coupon-wallet__quickFact--closed'}>{coupon.status === 'UNUSED' ? formatDaysBadge(daysLeft) : statusLabel}</span>
                      <span className={walletThreshold > 0 ? 'coupon-wallet__quickFact coupon-wallet__quickFact--threshold' : 'coupon-wallet__quickFact coupon-wallet__quickFact--empty'}>{couponUiText.walletThreshold}: {formatMoney(walletThreshold)}</span>
                    </div>
                    {coupon.status === 'UNUSED' && walletThreshold > 0 ? (
                      <div className={walletGap > 0 ? 'coupon-wallet__fit' : 'coupon-wallet__fit coupon-wallet__fit--ready'}>
                        <span>{walletGap > 0 ? t('pages.coupons.couponThresholdGap') : couponUiText.cartReady}</span>
                        <strong>{walletGap > 0 ? formatMoney(walletGap) : formatMoney(0)}</strong>
                        <i style={{ ['--wallet-coupon-progress' as string]: `${walletProgress}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="coupon-wallet__actions">
                    {coupon.status === 'UNUSED' ? (
                      <Button type="primary" icon={<ShoppingOutlined />} className="coupon-wallet__action" onClick={() => navigate('/cart')}>
                        {t('pages.coupons.use')}
                      </Button>
                    ) : (
                      <span className={`coupon-wallet__closedAction coupon-wallet__closedAction--${(coupon.status || 'unknown').toLowerCase()}`}>{statusLabel}</span>
                    )}
                  </div>
                </div>
              </List.Item>
              );
            }}
          />
          </>
        )}
      </Card>
    </div>
  );
};

export default CouponCenter;
