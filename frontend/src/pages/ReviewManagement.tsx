import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Popconfirm, Rate, message, Typography, Divider, Input, Modal, Select, Space, Tag } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, CheckOutlined, MessageOutlined, SearchOutlined, StarOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { Review } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import './ReviewManagement.css';

const { Title, Paragraph } = Typography;

const ReviewManagement: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const { t, language } = useLanguage();

  const statusColors: Record<string, string> = {
    PENDING: 'orange',
    APPROVED: 'green',
    HIDDEN: 'default',
  };

  const reviewStats = useMemo(() => {
    const pending = reviews.filter((review) => (review.status || 'PENDING') === 'PENDING').length;
    const lowRating = reviews.filter((review) => Number(review.rating || 0) <= 3).length;
    const needsReply = reviews.filter((review) => !String(review.adminReply || '').trim()).length;
    const approved = reviews.filter((review) => (review.status || 'PENDING') === 'APPROVED').length;
    const averageRating = reviews.length
      ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
      : 0;
    return { pending, lowRating, needsReply, approved, averageRating };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesStatus = statusFilter ? (review.status || 'PENDING') === statusFilter : true;
      if (!matchesStatus) return false;
      if (!text) return true;
      return [
        review.id,
        review.productId,
        (review as any).product?.id,
        (review as any).product?.name,
        review.username,
        (review as any).user?.username,
        review.comment,
        review.adminReply,
      ].some((value) => String(value || '').toLowerCase().includes(text));
    });
  }, [keyword, reviews, statusFilter]);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReviews();
      setReviews(res.data.items ?? res.data);
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminReviews.fetchFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteReview(id);
      message.success(t('messages.deleteSuccess'));
      fetchReviews();
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));
    }
  };

  const openReply = (review: Review) => {
    setReplyTarget(review);
    setReplyText(review.adminReply || '');
  };

  const handleReply = async () => {
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
      fetchReviews();
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
    try {
      await adminApi.updateReviewStatus(review.id, status);
      message.success(t('messages.updateSuccess'));
      fetchReviews();
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.updateFailed'), language));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: t('pages.adminReviews.productId'),
      key: 'productId',
      width: 80,
      render: (_: any, record: Review) => record.productId || (record as any).product?.id || '-',
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const value = status || 'PENDING';
        return <Tag color={statusColors[value]}>{t(`pages.adminReviews.status.${value}`)}</Tag>;
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
      render: (_: any, record: Review) => (
        <Space size="small" wrap>
          {(record.status || 'PENDING') !== 'APPROVED' && (
            <Button size="small" icon={<CheckOutlined />} onClick={() => handleStatus(record, 'APPROVED')}>
              {t('pages.adminReviews.approve')}
            </Button>
          )}
          {(record.status || 'PENDING') !== 'HIDDEN' && (
            <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => handleStatus(record, 'HIDDEN')}>
              {t('pages.adminReviews.hide')}
            </Button>
          )}
          <Button size="small" style={{ marginRight: 8 }} onClick={() => openReply(record)}>
            {t('pages.adminReviews.replyAction')}
          </Button>
          <Popconfirm title={t('pages.adminReviews.deleteConfirm')} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
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
      </Space>
      <Table
        columns={columns}
        dataSource={filteredReviews}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => t('pages.adminReviews.total', { count: total }) }}
        bordered
        size="middle"
        scroll={{ x: 1180 }}
      />
      <Modal
        className="profile-mobile-safe-modal review-management-page__replyModal"
        open={!!replyTarget}
        onCancel={closeReplyModal}
        onOk={handleReply}
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
