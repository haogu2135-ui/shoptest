import React, { useEffect, useState } from 'react';
import { Rate, Input, Button, List, Avatar, Space, message, Select, Empty, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import type { Order } from '../types';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { formatSafeDate, formatSafeDateTime } from '../utils/dateFormat';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import './ProductReview.css';

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
    const navigate = useNavigate();
    const isLoggedIn = !!getLocalStorageItem('token');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [orderId, setOrderId] = useState<number | undefined>(reviewableOrders[0]?.id);
    const [submitting, setSubmitting] = useState(false);
    const { t, language } = useLanguage();
    const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

    useEffect(() => {
        setOrderId((current) =>
            current && reviewableOrders.some((order) => order.id === current)
                ? current
                : reviewableOrders[0]?.id
        );
    }, [reviewableOrders]);

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            message.warning(t('messages.loginRequired'));
            navigate(buildLoginUrlFromWindow());
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
            message.error(getApiErrorMessage(error, t('pages.review.failed'), language));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="product-review">
            <h3 className="product-review__title">{t('pages.review.title')}</h3>
            {isLoggedIn ? (
                <div className="product-review__composer">
                    {reviewableOrders.length > 0 ? (
                        <Space direction="vertical" className="product-review__form">
                            <Select
                                value={orderId}
                                onChange={setOrderId}
                                placeholder={t('pages.review.selectOrder')}
                                className="product-review__orderSelect"
                                popupClassName="shop-mobile-popup-layer"
                                getPopupContainer={() => document.body}
                                options={reviewableOrders.map((order) => ({
                                    value: order.id,
                                    label: `${order.orderNo || `#${order.id}`}${formatSafeDate(order.createdAt, dateLocale, '') ? ` - ${formatSafeDate(order.createdAt, dateLocale)}` : ''}`,
                                }))}
                            />
                            <Rate className="product-review__rate" value={rating} onChange={setRating} />
                            <TextArea
                                className="product-review__textarea"
                                rows={4}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t('pages.review.placeholder')}
                                maxLength={1000}
                                showCount
                            />
                            <Button
                                type="primary"
                                className="product-review__submit"
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
            ) : (
                <div className="product-review__composer product-review__composer--login">
                    <Text type="secondary">{t('messages.loginRequired')}</Text>
                    <Button type="primary" onClick={() => navigate(buildLoginUrlFromWindow())}>
                        {t('nav.login')}
                    </Button>
                </div>
            )}
            <List
                className="product-review__list"
                itemLayout="horizontal"
                dataSource={reviews}
                renderItem={(review) => (
                    <List.Item className="product-review__item">
                        <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} />}
                            title={
                                <Space className="product-review__meta" wrap>
                                    <span>{review.username}</span>
                                    <Rate disabled value={review.rating} />
                                </Space>
                            }
                            description={
                                <>
                                    <p>{review.comment}</p>
                                    {review.adminReply && (
                                        <div className="product-review__adminReply">
                                            <Text strong>{t('pages.adminReviews.reply')}: </Text>
                                            <Text>{review.adminReply}</Text>
                                        </div>
                                    )}
                                    <small>{formatSafeDateTime(review.createdAt, dateLocale, '-')}</small>
                                </>
                            }
                        />
                    </List.Item>
                )}
            />
        </div>
    );
}; 
