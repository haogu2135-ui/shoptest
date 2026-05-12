import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, List, message, Row, Space, Spin, Tag, Typography } from 'antd';
import { GiftOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { couponApi } from '../api';
import type { Coupon, UserCoupon } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';

const { Text, Title } = Typography;

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
      const publicRes = await couponApi.getPublic();
      setPublicCoupons(publicRes.data);
      if (userId) {
        const mineRes = await couponApi.getByUser(userId);
        setMyCoupons(mineRes.data);
      } else {
        setMyCoupons([]);
      }
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

  const describeCoupon = (coupon: Pick<Coupon, 'couponType' | 'thresholdAmount' | 'reductionAmount' | 'discountPercent' | 'maxDiscountAmount'>) => {
    if (coupon.couponType === 'FULL_REDUCTION') {
      return `${formatMoney(coupon.thresholdAmount)} - ${formatMoney(coupon.reductionAmount)}`;
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
    } else {
      message.error(t('pages.coupons.claimFailed'));
    }
    await loadCoupons();
    setClaimingAll(false);
  };

  if (loading) {
    return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
      <Title level={2}><GiftOutlined /> {t('pages.coupons.title')}</Title>

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
                    size="small"
                    title={coupon.name}
                    extra={<Tag color={coupon.couponType === 'FULL_REDUCTION' ? 'volcano' : 'blue'}>{coupon.couponType === 'FULL_REDUCTION' ? t('pages.coupons.fullReduction') : t('pages.coupons.discount')}</Tag>}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong style={{ color: '#ee4d2d', fontSize: 20 }}>{describeCoupon(coupon)}</Text>
                      {coupon.description ? <Text type="secondary">{coupon.description}</Text> : null}
                      {coupon.endAt ? <Text type="secondary">{t('pages.coupons.validUntil', { time: new Date(coupon.endAt).toLocaleString() })}</Text> : null}
                      {remaining !== null ? <Text type="secondary">{t('pages.coupons.remaining', { count: remaining })}</Text> : null}
                      <Button type="primary" disabled={claimingAll || claimed || remaining === 0} loading={claimingId === coupon.id} onClick={() => claimCoupon(coupon.id)}>
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
                  title={<Space><Text strong>{coupon.couponName}</Text><Tag>{t(`status.${coupon.status}`)}</Tag></Space>}
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
