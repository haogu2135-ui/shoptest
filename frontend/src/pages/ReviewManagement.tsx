import React, { useEffect, useState } from 'react';
import { Table, Button, Popconfirm, Rate, message, Typography, Divider, Input, Modal, Select, Space, Tag } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, CheckOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { Review } from '../types';
import { useLanguage } from '../i18n';

const { Title, Paragraph } = Typography;

const ReviewManagement: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { t, language } = useLanguage();

  const statusColors: Record<string, string> = {
    PENDING: 'orange',
    APPROVED: 'green',
    HIDDEN: 'default',
  };

  const filteredReviews = statusFilter ? reviews.filter((review) => (review.status || 'PENDING') === statusFilter) : reviews;

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReviews();
      setReviews(res.data);
    } catch {
      message.error(t('pages.adminReviews.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteReview(id);
      message.success(t('messages.deleteSuccess'));
      fetchReviews();
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const openReply = (review: Review) => {
    setReplyTarget(review);
    setReplyText(review.adminReply || '');
  };

  const handleReply = async () => {
    if (!replyTarget) return;
    try {
      setReplying(true);
      await adminApi.replyReview(replyTarget.id, replyText);
      message.success(t('messages.updateSuccess'));
      setReplyTarget(null);
      setReplyText('');
      fetchReviews();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.updateFailed'));
    } finally {
      setReplying(false);
    }
  };

  const handleStatus = async (review: Review, status: string) => {
    try {
      await adminApi.updateReviewStatus(review.id, status);
      message.success(t('messages.updateSuccess'));
      fetchReviews();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.updateFailed'));
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
        return <Tag color={statusColors[value]}>{value}</Tag>;
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
              Approve
            </Button>
          )}
          {(record.status || 'PENDING') !== 'HIDDEN' && (
            <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => handleStatus(record, 'HIDDEN')}>
              Hide
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
    <div>
      <Title level={4}>{t('pages.adminReviews.title')}</Title>
      <Divider />
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'HIDDEN', label: 'Hidden' },
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
        open={!!replyTarget}
        onCancel={() => setReplyTarget(null)}
        onOk={handleReply}
        confirmLoading={replying}
        title={t('pages.adminReviews.replyAction')}
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
