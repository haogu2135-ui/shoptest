import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Table, Button, Rate, message, Typography, Divider, Space, Tag } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import ShopModal from '../components/ShopModal';
import { DeleteOutlined, EyeInvisibleOutlined, CheckOutlined, MessageOutlined, SearchOutlined, StarOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi } from '../api/admin';
import type { Review } from '../types';
import { useLanguage } from '../i18n';
import { useDebounce } from '../hooks/useDebounce';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import {
  getEffectiveRole,
  hasAdminPermission,
  REVIEWS_DELETE_PERMISSION,
  REVIEWS_MODERATE_PERMISSION,
  REVIEWS_REPLY_PERMISSION,
} from '../utils/roles';
import './ReviewManagement.css';

const { Title, Paragraph } = Typography;
const DEFAULT_PAGE_SIZE = 20;
const REVIEW_STATUS_KEYS = new Set(['PENDING', 'APPROVED', 'HIDDEN']);

const ReviewManagement: React.FC = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewSnapshotLoaded, setReviewSnapshotLoaded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword.trim(), 300);
  const [pageState, setPageState] = useState({ page: 1, size: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
  const [reviewSummary, setReviewSummary] = useState<Record<string, number>>({});
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const { t, language } = useLanguage();
  const canModerateReviews = hasAdminPermission(adminPermissions, currentRole, REVIEWS_MODERATE_PERMISSION);
  const canReplyReviews = hasAdminPermission(adminPermissions, currentRole, REVIEWS_REPLY_PERMISSION);
  const canDeleteReviews = hasAdminPermission(adminPermissions, currentRole, REVIEWS_DELETE_PERMISSION);
  const actionsDisabledByStaleData = Boolean(loadError);
  const adminReviewProductName = (record: Review) => (
    (record.productName || record.product?.name || '').trim()
      || t('pages.profile.productFallback', { id: record.productId || record.product?.id || record.id })
  );

  const statusColors: Record<string, string> = {
    PENDING: 'orange',
    APPROVED: 'green',
    HIDDEN: 'default',
  };
  const formatReviewStatus = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = (rawStatus || 'PENDING').toUpperCase();
    if (REVIEW_STATUS_KEYS.has(normalizedStatus)) {
      return t(`pages.adminReviews.status.${normalizedStatus}`);
    }
    return rawStatus || '-';
  }, [t]);
  const reviewStats = useMemo(() => {
    const summaryNumber = (key: string) => Number(reviewSummary[key] ?? 0);
    const pending = summaryNumber('PENDING');
    const lowRating = summaryNumber('LOW_RATING');
    const needsReply = summaryNumber('NEEDS_REPLY');
    const approved = summaryNumber('APPROVED');
    const averageRating = summaryNumber('AVERAGE_RATING');
    return { pending, lowRating, needsReply, approved, averageRating };
  }, [reviewSummary]);
  const currentReviewStatusLabel = statusFilter ? formatReviewStatus(statusFilter) : t('common.all');
  const currentReviewSearchLabel = keyword.trim() || debouncedKeyword || t('common.search');
  const reviewKeywordInputLabel = `${t('pages.adminReviews.title')} ${t('common.search')}: ${currentReviewSearchLabel}`;
  const reviewStatusFilterLabel = `${t('pages.adminReviews.statusFilter')}: ${currentReviewStatusLabel}`;
  const reviewSearchActionLabel = `${t('common.search')}: ${currentReviewStatusLabel}, ${currentReviewSearchLabel}`;
  const replyTargetLabel = replyTarget ? adminReviewProductName(replyTarget) : t('pages.adminReviews.title');
  const replyInputLabel = `${t('pages.adminReviews.replyAction')}: ${replyTargetLabel}`;
  const replySubmitActionLabel = `${t('pages.adminReviews.replyAction')}: ${replyTargetLabel}`;
  const reviewCellLabel = (label: string) => ({ 'data-label': label } as React.TdHTMLAttributes<HTMLElement>);
  const reviewColumnLabels = {
    id: 'ID',
    product: t('pages.adminReviews.productId'),
    user: t('pages.adminReviews.user'),
    rating: t('pages.adminReviews.rating'),
    status: t('pages.adminReviews.statusFilter'),
    content: t('pages.adminReviews.content'),
    reply: t('pages.adminReviews.reply'),
    createdAt: t('pages.adminReviews.createdAt'),
    actions: t('common.actions'),
  };

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((res) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
        setAdminPermissions(res.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const fetchReviews = useCallback(async (
    nextPage: number,
    nextSize: number,
    nextStatus = statusFilter,
    nextSearch = debouncedKeyword,
  ) => {
    try {
      setLoading(true);
      const res = await adminApi.getReviews({
        status: nextStatus,
        search: nextSearch || undefined,
        page: nextPage,
        size: nextSize,
      });
      setReviews(res.data.items || []);
      const resolvedSize = res.data.size || nextSize;
      pageSizeRef.current = resolvedSize;
      setPageState({
        page: res.data.page || nextPage,
        size: resolvedSize,
        total: res.data.total || 0,
        totalPages: res.data.totalPages || 0,
      });
      setReviewSummary(res.data.summary || {});
      setReviewSnapshotLoaded(true);
      setLoadError(null);
    } catch (err: unknown) {
      const errorMessage = getApiErrorMessage(err, t('pages.adminReviews.fetchFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, language, statusFilter, t]);

  useEffect(() => {
    fetchReviews(1, pageSizeRef.current, statusFilter, debouncedKeyword);
  }, [debouncedKeyword, fetchReviews, statusFilter]);

  const handleDelete = async (id: number) => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.adminReviews.staleActionBlocked'));
      return;
    }
    if (!canDeleteReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.deleteReview(id);
      message.success(t('messages.deleteSuccess'));
      fetchReviews(pageState.page, pageState.size);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));
    }
  };

  const openReply = (review: Review) => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.adminReviews.staleActionBlocked'));
      return;
    }
    if (!canReplyReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setReplyTarget(review);
    setReplyText(review.adminReply || '');
  };

  const handleReply = async () => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.adminReviews.staleActionBlocked'));
      return;
    }
    if (!canReplyReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (!replyTarget) return;
    if (!replyText.trim()) {
      message.warning(t('pages.adminReviews.replyRequired'));
      return;
    }
    try {
      setReplying(true);
      await adminApi.replyReview(replyTarget.id, replyText.trim());
      message.success(t('messages.updateSuccess'));
      setReplyTarget(null);
      setReplyText('');
      fetchReviews(pageState.page, pageState.size);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.updateFailed'), language));
    } finally {
      setReplying(false);
    }
  };

  const closeReplyModal = () => {
    if (replying) return;
    setReplyTarget(null);
    setReplyText('');
  };

  const handleStatus = async (review: Review, status: string) => {
    if (actionsDisabledByStaleData) {
      message.warning(t('pages.adminReviews.staleActionBlocked'));
      return;
    }
    if (!canModerateReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.updateReviewStatus(review.id, status);
      message.success(t('messages.updateSuccess'));
      fetchReviews(pageState.page, pageState.size);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.updateFailed'), language));
    }
  };

  const columns = [
    { title: reviewColumnLabels.id, dataIndex: 'id', key: 'id', width: 60, onCell: () => reviewCellLabel(reviewColumnLabels.id) },
    {
      title: reviewColumnLabels.product,
      key: 'productId',
      width: 220,
      onCell: () => reviewCellLabel(reviewColumnLabels.product),
      render: (_: unknown, record: Review) => {
        const productId = record.productId || record.product?.id;
        const productName = adminReviewProductName(record);
        const rawProductImageUrl = record.productImageUrl || record.product?.imageUrl;
        const productImageUrl = rawProductImageUrl ? resolveProductImage(rawProductImageUrl) : '';
        return (
          <div className="review-management-page__productCell">
            {productImageUrl ? (
              <img
                src={productImageUrl}
                alt=""
                loading="lazy"
                onError={(event) => {
                  if (event.currentTarget.src !== productImageFallback) {
                    event.currentTarget.src = productImageFallback;
                  }
                }}
              />
            ) : null}
            <div>
              <strong>{productName}</strong>
              <span>{productId ? `#${productId}` : '-'}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: reviewColumnLabels.user,
      key: 'username',
      width: 100,
      onCell: () => reviewCellLabel(reviewColumnLabels.user),
      render: (_: unknown, record: Review) => record.username || record.user?.username || '-',
    },
    {
      title: reviewColumnLabels.rating,
      dataIndex: 'rating',
      key: 'rating',
      width: 150,
      onCell: () => reviewCellLabel(reviewColumnLabels.rating),
      render: (rating: number, record: Review) => {
        const reviewLabel = adminReviewProductName(record) || record.username || `#${record.id}`;
        const ratingLabel = `${t('pages.adminReviews.rating')}: ${reviewLabel}, ${rating || 0}`;
        return (
          <span role="group" aria-label={ratingLabel} title={ratingLabel}>
            <Rate disabled value={rating || 0} />
          </span>
        );
      },
    },
    {
      title: reviewColumnLabels.status,
      dataIndex: 'status',
      key: 'status',
      width: 110,
      onCell: () => reviewCellLabel(reviewColumnLabels.status),
      render: (status: string) => {
        const value = String(status || 'PENDING').trim().toUpperCase();
        return <Tag color={statusColors[value] || 'default'}>{formatReviewStatus(status)}</Tag>;
      },
    },
    {
      title: reviewColumnLabels.content,
      dataIndex: 'comment',
      key: 'comment',
      width: 360,
      ellipsis: true,
      onCell: () => reviewCellLabel(reviewColumnLabels.content),
      render: (text: string, record: Review) => (
        <div className="review-management-page__contentCell">
          <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{text}</Paragraph>
          {Array.isArray(record.imageUrls) && record.imageUrls.length > 0 ? (
            <div className="review-management-page__reviewImages">
              {record.imageUrls.slice(0, 4).map((imageUrl, index) => (
                <img
                  key={`${record.id}-${imageUrl}`}
                  src={resolveProductImage(imageUrl)}
                  alt={t('pages.review.imageAlt', { index: index + 1 })}
                  loading="lazy"
                  onError={(event) => {
                    if (event.currentTarget.src !== productImageFallback) {
                      event.currentTarget.src = productImageFallback;
                    }
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: reviewColumnLabels.reply,
      dataIndex: 'adminReply',
      key: 'adminReply',
      width: 300,
      ellipsis: true,
      onCell: () => reviewCellLabel(reviewColumnLabels.reply),
      render: (text: string) => text ? <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{text}</Paragraph> : '-',
    },
    {
      title: reviewColumnLabels.createdAt,
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      onCell: () => reviewCellLabel(reviewColumnLabels.createdAt),
      render: (v: string) => v ? new Date(v).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : '-',
    },
    {
      title: reviewColumnLabels.actions,
      key: 'action',
      width: 260,
      onCell: () => reviewCellLabel(reviewColumnLabels.actions),
      render: (_: unknown, record: Review) => {
        const reviewLabel = adminReviewProductName(record) || record.username || `#${record.id}`;
        const approveActionLabel = `${t('pages.adminReviews.approve')}: ${reviewLabel}`;
        const hideActionLabel = `${t('pages.adminReviews.hide')}: ${reviewLabel}`;
        const replyActionLabel = `${t('pages.adminReviews.replyAction')}: ${reviewLabel}`;
        const deleteActionLabel = `${t('common.delete')}: ${reviewLabel}`;
        const actions = [
          canModerateReviews && (record.status || 'PENDING') !== 'APPROVED' ? (
            <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
              key="approve"
              title={t('pages.adminReviews.approveConfirm', { review: reviewLabel })}
              onConfirm={() => handleStatus(record, 'APPROVED')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ disabled: actionsDisabledByStaleData, 'aria-label': approveActionLabel, title: approveActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${approveActionLabel}`, title: `${t('common.cancel')}: ${approveActionLabel}` }}
            >
              <Button size="small" icon={<CheckOutlined />} aria-label={approveActionLabel} title={approveActionLabel} disabled={actionsDisabledByStaleData}>
                {t('pages.adminReviews.approve')}
              </Button>
            </ShopPopconfirm>
          ) : null,
          canModerateReviews && (record.status || 'PENDING') !== 'HIDDEN' ? (
            <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
              key="hide"
              title={t('pages.adminReviews.hideConfirm', { review: reviewLabel })}
              onConfirm={() => handleStatus(record, 'HIDDEN')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': hideActionLabel, title: hideActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${hideActionLabel}`, title: `${t('common.cancel')}: ${hideActionLabel}` }}
            >
              <Button size="small" icon={<EyeInvisibleOutlined />} aria-label={hideActionLabel} title={hideActionLabel} disabled={actionsDisabledByStaleData}>
                {t('pages.adminReviews.hide')}
              </Button>
            </ShopPopconfirm>
          ) : null,
          canReplyReviews ? (
            <Button key="reply" size="small" style={{ marginRight: 8 }} aria-label={replyActionLabel} title={replyActionLabel} onClick={() => openReply(record)} disabled={actionsDisabledByStaleData}>
              {t('pages.adminReviews.replyAction')}
            </Button>
          ) : null,
          canDeleteReviews ? (
            <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
              key="delete"
              title={t('pages.adminReviews.deleteConfirm')}
              description={reviewLabel}
              onConfirm={() => handleDelete(record.id)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, disabled: actionsDisabledByStaleData, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel} disabled={actionsDisabledByStaleData}>{t('common.delete')}</Button>
            </ShopPopconfirm>
          ) : null,
        ].filter(Boolean);
        return actions.length ? <Space size="small" wrap>{actions}</Space> : '-';
      },
    },
  ];

  return (
    <div className={`review-management-page review-management-page--${language}`}>
      <Title level={4}>{t('pages.adminReviews.title')}</Title>
      <Divider />
      <section className="review-ops-panel">
        <div className="review-ops-panel__copy">
          <span>{t('pages.adminReviews.opsEyebrow')}</span>
          <h2>{t('pages.adminReviews.opsTitle')}</h2>
          <p>{t('pages.adminReviews.opsSubtitle')}</p>
        </div>
        <div className="review-ops-panel__metrics">
          <div>
            <StarOutlined />
            <strong>{reviewSnapshotLoaded ? reviewStats.averageRating.toFixed(1) : '-'}</strong>
            <span>{t('pages.adminReviews.averageRating')}</span>
          </div>
          <div>
            <WarningOutlined />
            <strong>{reviewSnapshotLoaded ? reviewStats.lowRating : '-'}</strong>
            <span>{t('pages.adminReviews.lowRating')}</span>
          </div>
          <div>
            <MessageOutlined />
            <strong>{reviewSnapshotLoaded ? reviewStats.needsReply : '-'}</strong>
            <span>{t('pages.adminReviews.needsReply')}</span>
          </div>
          <div>
            <CheckOutlined />
            <strong>{reviewSnapshotLoaded ? reviewStats.approved : '-'}</strong>
            <span>{t('pages.adminReviews.approvedReviews')}</span>
          </div>
        </div>
      </section>
      <Space className="review-management-page__toolbar" wrap>
        <ShopInput
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('common.search')}
          className="review-management-page__keywordInput"
          aria-label={reviewKeywordInputLabel}
          title={reviewKeywordInputLabel}
        />
        <ShopSelect
          allowClear
          placeholder={t('pages.adminReviews.statusFilter')}
          className="review-management-page__statusFilter"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value || undefined)} popupClassName="shop-mobile-popup-layer"
          ariaLabel={reviewStatusFilterLabel}
          title={reviewStatusFilterLabel}
          options={[
            { value: 'PENDING', label: t('pages.adminReviews.status.PENDING') },
            { value: 'APPROVED', label: t('pages.adminReviews.status.APPROVED') },
            { value: 'HIDDEN', label: t('pages.adminReviews.status.HIDDEN') },
          ]}
        />
        <Button icon={<SearchOutlined />} aria-label={reviewSearchActionLabel} title={reviewSearchActionLabel} onClick={() => fetchReviews(1, pageSizeRef.current)}>
          {t('common.search')}
        </Button>
      </Space>
      {loadError && reviewSnapshotLoaded ? (
        <Alert
          className="review-management-page__loadAlert"
          type="warning"
          showIcon
          message={t('pages.adminReviews.loadErrorTitle')}
          description={t('pages.adminReviews.staleDataWarning')}
          action={(
            <Space wrap data-admin-reviews-stale-recovery="true">
              <Button size="small" type="primary" onClick={() => fetchReviews(pageState.page || 1, pageState.size || pageSizeRef.current)} loading={loading}>
                {t('common.retry')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</Button>
              <Button size="small" onClick={() => navigate('/admin/products')}>{t('pages.adminDashboard.products')}</Button>
              <Button size="small" onClick={() => navigate('/admin/orders')}>{t('pages.adminDashboard.orders')}</Button>
            </Space>
          )}
        />
      ) : null}

      {loadError && !reviewSnapshotLoaded ? (
        <div className="review-management-page__error" data-admin-reviews-load-recovery="true">
          <PageError
            title={t('pages.adminReviews.loadErrorTitle')}
            description={loadError}
            actions={[
              { key: 'retry', label: t('common.retry'), onClick: () => { void fetchReviews(pageState.page || 1, pageState.size || pageSizeRef.current); }, type: 'primary' },
              { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
              { key: 'products', label: t('pages.adminDashboard.products'), onClick: () => navigate('/admin/products'), type: 'default' },
              { key: 'orders', label: t('pages.adminDashboard.orders'), onClick: () => navigate('/admin/orders'), type: 'default' },
            ]}
          />
        </div>
      ) : null}
      <Table
        className="review-management-page__table"
        columns={columns}
        dataSource={reviews}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pageState.page,
          pageSize: pageState.size,
          total: pageState.total,
          showSizeChanger: true,
          showTotal: (total) => `${t('pages.adminReviews.total', { count: total })} | ${pageState.totalPages ? `${pageState.page}/${pageState.totalPages}` : '0/0'}`,
          onChange: (page, pageSize) => fetchReviews(page, pageSize),
        }}
        locale={{ emptyText: loadError && !reviewSnapshotLoaded ? t('pages.adminReviews.loadErrorTitle') : undefined }}
        bordered
        size="middle"
        scroll={{ x: 1730 }}
      />
      <ShopModal
        className="profile-mobile-safe-modal review-management-page__replyModal"
        open={!!replyTarget}
        onClose={closeReplyModal}
        onOk={handleReply}
        okText={t('pages.adminReviews.replyAction')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !canReplyReviews || actionsDisabledByStaleData, 'aria-label': replySubmitActionLabel, title: replySubmitActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${replySubmitActionLabel}`, title: `${t('common.cancel')}: ${replySubmitActionLabel}` }}
        confirmLoading={replying}
        title={t('pages.adminReviews.replyAction')}
      >
        <ShopTextArea
          rows={5}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={t('pages.adminReviews.replyPlaceholder')}
          aria-label={replyInputLabel}
          title={replyInputLabel}
        />
      </ShopModal>
    </div>
  );
};

export default ReviewManagement;
