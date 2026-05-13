import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, List, message, Row, Space, Spin, Tag, Typography } from 'antd';
import { ClockCircleOutlined, FireOutlined, GiftOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { couponApi } from '../api';
import type { Coupon, UserCoupon } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import './CouponCenter.css';

const { Text, Title } = Typography;

const couponStatusColor: Record<string, string> = {
  UNUSED: 'green',
  USED: 'default',
  EXPIRED: 'volcano',
};

const getCouponEstimatedValue = (coupon: Pick<Coupon, 'couponType' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'> | Pick<UserCoupon, 'couponType' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>) => {
  if (coupon.couponType === 'FULL_REDUCTION') {
    return Number(coupon.reductionAmount || 0);
  }
  const discountDepth = 100 - Number(coupon.discountPercent || 100);
  return Math.max(0, Number(coupon.maxDiscountAmount || 0), discountDepth);
};

const getDaysUntilEnd = (endAt?: string) => {
  if (!endAt) return null;
  const endTime = new Date(endAt).getTime();
  if (!Number.isFinite(endTime)) return null;
  return Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000));
};

const getCouponDisplayName = (coupon: Coupon | UserCoupon) =>
  'couponName' in coupon ? coupon.couponName : coupon.name;

const CouponCenter: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const token = localStorage.getItem('token');
  const userId = token ? Number(localStorage.getItem('userId') || 0) : 0;
  const [publicCoupons, setPublicCoupons] = useState<Coupon[]>([]);
  const [myCoupons, setMyCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const { formatMoney } = useMarket();

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const [publicRes, mineRes] = await Promise.all([
        couponApi.getPublic(),
        userId ? couponApi.getByUser(userId) : Promise.resolve({ data: [] as UserCoupon[] }),
      ]);
      setPublicCoupons(publicRes.data);
      setMyCoupons(mineRes.data);
    } catch {
      message.error(t('pages.coupons.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const ownedCouponIds = useMemo(() => new Set(myCoupons.map((item) => item.couponId)), [myCoupons]);
  const claimableCoupons = useMemo(
    () => publicCoupons.filter((coupon) => {
      const remaining = coupon.totalQuantity == null ? null : Math.max(0, coupon.totalQuantity - (coupon.claimedQuantity || 0));
      return !ownedCouponIds.has(coupon.id) && remaining !== 0;
    }),
    [ownedCouponIds, publicCoupons],
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
      if (coupon.totalQuantity == null) return false;
      const remaining = Math.max(0, coupon.totalQuantity - (coupon.claimedQuantity || 0));
      return remaining > 0 && remaining <= 10;
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
      return `${t('pages.adminCoupons.minimumSpend')} ${formatMoney(coupon.thresholdAmount)} / ${t('pages.adminCoupons.reductionAmount')} ${formatMoney(coupon.reductionAmount)}`;
    }
    const maxText = coupon.maxDiscountAmount ? `, ${t('pages.coupons.maxDiscount', { amount: formatMoney(coupon.maxDiscountAmount) })}` : '';
    return t('pages.coupons.discountPayable', { percent: coupon.discountPercent || 100 }) + maxText;
  };

  const claimCoupon = async (couponId: number) => {
    if (!userId) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    setClaimingId(couponId);
    try {
      await couponApi.claim(couponId, userId);
      message.success(t('pages.coupons.claimedSuccess'));
      window.dispatchEvent(new Event('shop:coupons-updated'));
      await loadCoupons();
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.coupons.claimFailed'));
    } finally {
      setClaimingId(null);
    }
  };

  const claimAllCoupons = async () => {
    if (!userId) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    if (claimableCoupons.length === 0) {
      message.info(t('pages.coupons.noClaimable'));
      return;
    }
    try {
      setClaimingAll(true);
      let claimed = 0;
      for (const coupon of claimableCoupons) {
        try {
          await couponApi.claim(coupon.id, userId);
          claimed += 1;
        } catch {
          // Other coupons can still be claimed if one is exhausted concurrently.
        }
      }
      if (claimed > 0) {
        message.success(t('pages.coupons.claimedAllSuccess', { count: claimed }));
        window.dispatchEvent(new Event('shop:coupons-updated'));
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

  if (loading) {
    return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div className="coupon-center-page">
      <Title level={2}><GiftOutlined /> {t('pages.coupons.title')}</Title>

      <section className="coupon-opportunity">
        <div className="coupon-opportunity__copy">
          <Text type="secondary">{t('pages.coupons.opportunityEyebrow')}</Text>
          <h2>{t('pages.coupons.opportunityTitle')}</h2>
          <p>
            {couponInsights.bestCoupon
              ? t('pages.coupons.opportunitySubtitleBest', { name: couponInsights.bestCoupon.name })
              : t('pages.coupons.opportunitySubtitle')}
          </p>
        </div>
        <div className="coupon-opportunity__metrics">
          <div>
            <GiftOutlined />
            <strong>{claimableCoupons.length}</strong>
            <span>{t('pages.coupons.claimableCount')}</span>
          </div>
          <div>
            <ClockCircleOutlined />
            <strong>{couponInsights.expiringSoon}</strong>
            <span>{t('pages.coupons.expiringSoon')}</span>
          </div>
          <div>
            <FireOutlined />
            <strong>{couponInsights.limitedStock}</strong>
            <span>{t('pages.coupons.limitedStock')}</span>
          </div>
          <div>
            <ThunderboltOutlined />
            <strong>{couponInsights.unusedMine}</strong>
            <span>{t('pages.coupons.readyToUse')}</span>
          </div>
        </div>
        <Space wrap className="coupon-opportunity__actions">
          <Button type="primary" loading={claimingAll} disabled={claimableCoupons.length === 0} onClick={claimAllCoupons}>
            {t('pages.coupons.claimAll')}
          </Button>
          <Button icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>
            {t('pages.coupons.goShopping')}
          </Button>
        </Space>
      </section>

      <section className="coupon-priority-grid">
        <div className="coupon-priority-card">
          <Text type="secondary">{t('pages.coupons.bestClaimEyebrow')}</Text>
          <h3>{couponInsights.bestCoupon?.name || t('pages.coupons.noBestClaim')}</h3>
          <p>
            {couponInsights.bestCoupon
              ? describeCoupon(couponInsights.bestCoupon)
              : t('pages.coupons.noBestClaimHint')}
          </p>
          <Space wrap>
            {couponInsights.bestCoupon?.endAt ? (
              <Tag color="volcano">{t('pages.coupons.validUntil', { time: new Date(couponInsights.bestCoupon.endAt).toLocaleString() })}</Tag>
            ) : null}
            {couponInsights.bestCoupon ? (
              <Button type="primary" loading={claimingId === couponInsights.bestCoupon.id} disabled={claimingAll} onClick={() => claimCoupon(couponInsights.bestCoupon!.id)}>
                {t('pages.coupons.claimBest')}
              </Button>
            ) : (
              <Button onClick={() => navigate('/products')}>{t('pages.coupons.goShopping')}</Button>
            )}
          </Space>
        </div>
        <div className="coupon-priority-card coupon-priority-card--use">
          <Text type="secondary">{t('pages.coupons.nextUseEyebrow')}</Text>
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

      <section className="coupon-savings-path" aria-label={t('pages.coupons.savingsPathTitle')}>
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
          <span>{couponInsights.bestCoupon ? t('pages.coupons.pathStepClaim') : t('pages.coupons.pathStepWalletReady')}</span>
          <span>{couponInsights.targetCoupon?.thresholdAmount ? t('pages.coupons.pathStepThreshold', { amount: formatMoney(couponInsights.targetCoupon.thresholdAmount) }) : t('pages.coupons.pathStepBrowse')}</span>
          <span>{couponInsights.nextToUse ? t('pages.coupons.pathStepUse') : t('pages.coupons.pathStepCheckout')}</span>
        </div>
        <Button
          type="primary"
          icon={<ShoppingOutlined />}
          onClick={() => navigate(couponInsights.nextToUse ? '/cart' : '/products')}
        >
          {couponInsights.nextToUse ? t('pages.coupons.useNext') : t('pages.coupons.goShopping')}
        </Button>
      </section>

      <Card
        title={t('pages.coupons.claimTitle')}
        style={{ marginBottom: 24 }}
        extra={
          publicCoupons.length > 0 ? (
            <Button loading={claimingAll} disabled={claimableCoupons.length === 0} onClick={claimAllCoupons}>
              {t('pages.coupons.claimAll')}
            </Button>
          ) : null
        }
      >
        {publicCoupons.length === 0 ? (
          <Empty description={t('pages.coupons.noPublic')} />
        ) : (
          <Row gutter={[16, 16]}>
            {publicCoupons.map((coupon) => {
              const claimed = ownedCouponIds.has(coupon.id);
              const remaining = coupon.totalQuantity == null ? null : Math.max(0, coupon.totalQuantity - (coupon.claimedQuantity || 0));
              return (
                <Col xs={24} md={12} lg={8} key={coupon.id}>
                  <Card
                    className="coupon-center-page__coupon"
                    size="small"
                    title={coupon.name}
                    extra={<Tag color={coupon.couponType === 'FULL_REDUCTION' ? 'volcano' : 'blue'}>{coupon.couponType === 'FULL_REDUCTION' ? t('pages.coupons.fullReduction') : t('pages.coupons.discount')}</Tag>}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong style={{ color: '#ee4d2d', fontSize: 20 }}>{describeCoupon(coupon)}</Text>
                      {coupon.description ? <Text type="secondary">{coupon.description}</Text> : null}
                      {coupon.endAt ? <Text type="secondary">{t('pages.coupons.validUntil', { time: new Date(coupon.endAt).toLocaleString() })}</Text> : null}
                      {remaining !== null ? <Text type="secondary">{t('pages.coupons.remaining', { count: remaining })}</Text> : null}
                      <Button type="primary" block disabled={claimingAll || claimed || remaining === 0} loading={claimingId === coupon.id} onClick={() => claimCoupon(coupon.id)}>
                        {claimed ? t('pages.coupons.claimed') : t('pages.coupons.claim')}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      <Card title={t('pages.coupons.myCoupons')}>
        {myCoupons.length === 0 ? (
          <Empty description={t('pages.coupons.noMine')}>
            <Button icon={<ShoppingOutlined />} onClick={() => navigate('/products')}>{t('pages.coupons.goShopping')}</Button>
          </Empty>
        ) : (
          <List
            dataSource={myCoupons}
            renderItem={(coupon) => (
              <List.Item
                actions={[
                  coupon.status === 'UNUSED' ? <Button type="link" onClick={() => navigate('/cart')}>{t('pages.coupons.use')}</Button> : null,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={<Space wrap><Text strong>{coupon.couponName}</Text><Tag color={couponStatusColor[coupon.status] || 'default'}>{t(`status.${coupon.status}`)}</Tag></Space>}
                  description={`${describeCoupon(coupon)} ${coupon.endAt ? t('pages.coupons.validUntilPrefix', { time: new Date(coupon.endAt).toLocaleString() }) : ''}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default CouponCenter;
