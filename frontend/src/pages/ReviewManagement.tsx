import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Popconfirm, Rate, message, Typography, Divider, Input, Modal, Select, Space, Tag } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, CheckOutlined, MessageOutlined, SearchOutlined, StarOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { Review } from '../types';
import { useLanguage } from '../i18n';
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [pageState, setPageState] = useState({ page: 1, size: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
  const [reviewSummary, setReviewSummary] = useState<Record<string, number>>({});
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const { t, language } = useLanguage();
  const canModerateReviews = hasAdminPermission(adminPermissions, currentRole, REVIEWS_MODERATE_PERMISSION);
  const canReplyReviews = hasAdminPermission(adminPermissions, currentRole, REVIEWS_REPLY_PERMISSION);
  const canDeleteReviews = hasAdminPermission(adminPermissions, currentRole, REVIEWS_DELETE_PERMISSION);

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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

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
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminReviews.fetchFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, language, statusFilter, t]);

  useEffect(() => {
    fetchReviews(1, pageSizeRef.current, statusFilter, debouncedKeyword);
  }, [debouncedKeyword, fetchReviews, statusFilter]);

  const handleDelete = async (id: number) => {
    if (!canDeleteReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.deleteReview(id);
      message.success(t('messages.deleteSuccess'));
      fetchReviews(pageState.page, pageState.size);
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));
    }
  };

  const openReply = (review: Review) => {
    if (!canReplyReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setReplyTarget(review);
    setReplyText(review.adminReply || '');
  };

  const handleReply = async () => {
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
    } catch (err: any) {
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
    if (!canModerateReviews) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.updateReviewStatus(review.id, status);
      message.success(t('messages.updateSuccess'));
      fetchReviews(pageState.page, pageState.size);
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.updateFailed'), language));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: t('pages.adminReviews.productId'),
      key: 'productId',
      width: 220,
      render: (_: any, record: Review) => {
        const productId = record.productId || (record as any).product?.id;
        const productName = record.productName || (record as any).product?.name;
        const rawProductImageUrl = record.productImageUrl || (record as any).product?.imageUrl;
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
              <strong>{productName || '-'}</strong>
              <span>{productId ? `#${productId}` : '-'}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: t('pages.adminReviews.user'),
      key: 'username',
      width: 100,
      render: (_: any, record: Review) => record.username || (record as any).user?.username || '-',
    },
    {
      title: t('pages.adminReviews.rating'),
      dataIndex: 'rating',
      key: 'rating',
      width: 150,
      render: (rating: number) => <Rate disabled defaultValue={rating} />,
    },
    {
      title: t('pages.adminReviews.statusFilter'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const value = String(status || 'PENDING').trim().toUpperCase();
        return <Tag color={statusColors[value] || 'default'}>{formatReviewStatus(status)}</Tag>;
      },
    },
    {
      title: t('pages.adminReviews.content'),
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (text: string) => <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{text}</Paragraph>,
    },
    {
      title: t('pages.adminReviews.reply'),
      dataIndex: 'adminReply',
      key: 'adminReply',
      ellipsis: true,
      render: (text: string) => text ? <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>{text}</Paragraph> : '-',
    },
    {
      title: t('pages.adminReviews.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 260,
      render: (_: any, record: Review) => {
        const reviewLabel = record.productName || record.username || `#${record.id}`;
        const actions = [
          canModerateReviews && (record.status || 'PENDING') !== 'APPROVED' ? (
            <Popconfirm key="approve" title={t('pages.adminReviews.approveConfirm', { review: reviewLabel })} onConfirm={() => handleStatus(record, 'APPROVED')}>
              <Button size="small" icon={<CheckOutlined />}>
                {t('pages.adminReviews.approve')}
              </Button>
            </Popconfirm>
          ) : null,
          canModerateReviews && (record.status || 'PENDING') !== 'HIDDEN' ? (
            <Popconfirm key="hide" title={t('pages.adminReviews.hideConfirm', { review: reviewLabel })} onConfirm={() => handleStatus(record, 'HIDDEN')}>
              <Button size="small" icon={<EyeInvisibleOutlined />}>
                {t('pages.adminReviews.hide')}
              </Button>
            </Popconfirm>
          ) : null,
          canReplyReviews ? (
          <Button key="reply" size="small" style={{ marginRight: 8 }} onClick={() => openReply(record)}>
            {t('pages.adminReviews.replyAction')}
          </Button>
          ) : null,
          canDeleteReviews ? (
          <Popconfirm key="delete" title={t('pages.adminReviews.deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
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
            <strong>{reviewStats.averageRating.toFixed(1)}</strong>
            <span>{t('pages.adminReviews.averageRating')}</span>
          </div>
          <div>
            <WarningOutlined />
            <strong>{reviewStats.lowRating}</strong>
            <span>{t('pages.adminReviews.lowRating')}</span>
          </div>
          <div>
            <MessageOutlined />
            <strong>{reviewStats.needsReply}</strong>
            <span>{t('pages.adminReviews.needsReply')}</span>
          </div>
          <div>
            <CheckOutlined />
            <strong>{reviewStats.approved}</strong>
            <span>{t('pages.adminReviews.approvedReviews')}</span>
          </div>
        </div>
      </section>
      <Space className="review-management-page__toolbar" wrap>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('common.search')}
          className="review-management-page__keywordInput"
        />
        <Select
          allowClear
          placeholder={t('pages.adminReviews.statusFilter')}
          className="review-management-page__statusFilter"
          value={statusFilter}
          onChange={setStatusFilter}
          popupClassName="shop-mobile-popup-layer"
          getPopupContainer={() => document.body}
          options={[
            { value: 'PENDING', label: t('pages.adminReviews.status.PENDING') },
            { value: 'APPROVED', label: t('pages.adminReviews.status.APPROVED') },
            { value: 'HIDDEN', label: t('pages.adminReviews.status.HIDDEN') },
          ]}
        />
        <Button icon={<SearchOutlined />} onClick={() => fetchReviews(1, pageSizeRef.current)}>
          {t('common.search')}
        </Button>
      </Space>
      <Table
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
        bordered
        size="middle"
        scroll={{ x: 1180 }}
      />
      <Modal
        className="profile-mobile-safe-modal review-management-page__replyModal"
        open={!!replyTarget}
        onCancel={closeReplyModal}
        onOk={handleReply}
        okButtonProps={{ disabled: !canReplyReviews }}
        confirmLoading={replying}
        title={t('pages.adminReviews.replyAction')}
        destroyOnHidden
      >
        <Input.TextArea
          rows={5}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={t('pages.adminReviews.replyPlaceholder')}
        />
      </Modal>
    </div>
  );
};

export default ReviewManagement;
