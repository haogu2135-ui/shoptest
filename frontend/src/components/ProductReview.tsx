import React, { useEffect, useState } from 'react';
import { Rate, Input, Button, List, Avatar, Space, message, Select, Empty, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useLanguage } from '../i18n';
import type { Order } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

interface Review {
    id: number;
    userId: number;
    productId: number;
    rating: number;
    comment: string;
    username: string;
    createdAt: string;
    adminReply?: string;
    repliedAt?: string;
}

interface ProductReviewProps {
    productId: number;
    reviews: Review[];
    reviewableOrders: Order[];
    onAddReview: (orderId: number, rating: number, comment: string) => Promise<void>;
}

export const ProductReview: React.FC<ProductReviewProps> = ({
    productId,
    reviews,
    reviewableOrders,
    onAddReview,
}) => {
    const isLoggedIn = !!localStorage.getItem('token');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [orderId, setOrderId] = useState<number | undefined>(reviewableOrders[0]?.id);
    const [submitting, setSubmitting] = useState(false);
    const { t, language } = useLanguage();

    useEffect(() => {
        setOrderId((current) => current || reviewableOrders[0]?.id);
    }, [reviewableOrders]);

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            message.warning(t('messages.loginRequired'));
            return;
        }
        if (!orderId) {
            message.warning(t('pages.review.selectOrder'));
            return;
        }
        if (!comment.trim()) {
            message.warning(t('pages.review.emptyComment'));
            return;
        }

        setSubmitting(true);
        try {
            await onAddReview(orderId, rating, comment);
            setComment('');
            setRating(5);
            setOrderId(undefined);
            message.success(t('pages.review.success'));
        } catch (error: any) {
            message.error(error?.response?.data?.error || t('pages.review.failed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ marginTop: 24 }}>
            <h3>{t('pages.review.title')}</h3>
            {isLoggedIn && (
                <div style={{ marginBottom: 24 }}>
                    {reviewableOrders.length > 0 ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Select
                                value={orderId}
                                onChange={setOrderId}
                                placeholder={t('pages.review.selectOrder')}
                                style={{ width: '100%', maxWidth: 360 }}
                                options={reviewableOrders.map((order) => ({
                                    value: order.id,
                                    label: `${order.orderNo || `#${order.id}`} - ${new Date(order.createdAt || '').toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}`,
                                }))}
                            />
                            <Rate value={rating} onChange={setRating} />
                            <TextArea
                                rows={4}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t('pages.review.placeholder')}
                            />
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={submitting}
                            >
                                {t('pages.review.submit')}
                            </Button>
                        </Space>
                    ) : (
                        <Empty description={t('pages.review.noReviewableOrder')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                </div>
            )}
            <List
                itemLayout="horizontal"
                dataSource={reviews}
                renderItem={(review) => (
                    <List.Item>
                        <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} />}
                            title={
                                <Space>
                                    <span>{review.username}</span>
                                    <Rate disabled value={review.rating} />
                                </Space>
                            }
                            description={
                                <>
                                    <p>{review.comment}</p>
                                    {review.adminReply && (
                                        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                                            <Text strong>{t('pages.adminReviews.reply')}: </Text>
                                            <Text>{review.adminReply}</Text>
                                        </div>
                                    )}
                                    <small>{new Date(review.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}</small>
                                </>
                            }
                        />
                    </List.Item>
                )}
            />
        </div>
    );
}; 
