import React, { useEffect, useState } from 'react';
import { Rate, Input, Button, List, Avatar, Space, message, Select, Empty, Typography, Upload } from 'antd';
import { DeleteOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import type { PublicReview, ReviewableOrder } from '../types';
import { reviewApi } from '../api';
import { buildLoginUrlFromWindow, getCurrentRelativeUrl } from '../utils/authRedirect';
import { formatSafeDate, formatSafeDateTime } from '../utils/dateFormat';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import './ProductReview.css';
import '../styles/mobile-page-contrast.css';

const { TextArea } = Input;
const { Text } = Typography;
const MAX_REVIEW_IMAGES = 4;
const MAX_REVIEW_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_COMMENT_LENGTH = 1000;
const REVIEW_IMAGE_URL_PATTERN = /^\/uploads\/reviews\/[0-9a-fA-F-]{36}\.(?:jpg|png)$/;

interface ProductReviewProps {
    productId: number;
    reviews: PublicReview[];
    reviewableOrders: ReviewableOrder[];
    onAddReview: (orderId: number, rating: number, comment: string, imageUrls: string[]) => Promise<void>;
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
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const { t, language } = useLanguage();
    const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
    const selectedReviewOrder = reviewableOrders.find((order) => Number(order.id) === Number(orderId));
    const selectedReviewOrderLabel = selectedReviewOrder?.orderNo || (selectedReviewOrder ? `#${selectedReviewOrder.id}` : t('pages.review.selectOrder'));
    const reviewOrderSelectLabel = `${t('pages.review.selectOrder')}: ${selectedReviewOrderLabel}`;
    const reviewRatingLabel = `${t('pages.productDetail.rating')}: ${rating}, ${selectedReviewOrderLabel}`;
    const reviewCommentLabel = `${t('pages.review.placeholder')}: ${selectedReviewOrderLabel}`;
    const reviewSubmitLabel = `${t('pages.review.submit')}: ${selectedReviewOrderLabel}, ${t('pages.productDetail.rating')} ${rating}`;
    const reviewImageUploadLabel = `${t('pages.review.imageUpload')}: ${selectedReviewOrderLabel}`;

    useEffect(() => {
        setOrderId((current) =>
            current && reviewableOrders.some((order) => order.id === current)
                ? current
                : reviewableOrders[0]?.id
        );
    }, [reviewableOrders]);

    const handleImageUpload = async (file: File) => {
        if (!file.type || !['image/jpeg', 'image/png', 'image/gif'].includes(file.type.toLowerCase())) {
            message.warning(t('pages.review.imageInvalidType'));
            return Upload.LIST_IGNORE;
        }
        if (file.size > MAX_REVIEW_IMAGE_SIZE_BYTES) {
            message.warning(t('pages.review.imageTooLarge'));
            return Upload.LIST_IGNORE;
        }
        if (imageUrls.length >= MAX_REVIEW_IMAGES) {
            message.warning(t('pages.review.imageLimit', { count: MAX_REVIEW_IMAGES }));
            return Upload.LIST_IGNORE;
        }
        setUploadingImage(true);
        try {
            const res = await reviewApi.uploadImage(file);
            const uploadedUrl = String(res.data.imageUrl || '').trim();
            if (!uploadedUrl) {
                throw new Error('Empty review image URL');
            }
            setImageUrls((current) => [...current, uploadedUrl].slice(0, MAX_REVIEW_IMAGES));
            message.success(t('pages.review.imageUploadSuccess'));
        } catch (error: unknown) {
            message.error(getApiErrorMessage(error, t('pages.review.imageUploadFailed'), language));
        } finally {
            setUploadingImage(false);
        }
        return Upload.LIST_IGNORE;
    };

    const removeImage = (imageUrl: string) => {
        setImageUrls((current) => current.filter((item) => item !== imageUrl));
    };

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
        if (comment.trim().length > MAX_REVIEW_COMMENT_LENGTH) {
            message.warning(t('pages.review.commentTooLong', { count: MAX_REVIEW_COMMENT_LENGTH }));
            return;
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            message.warning(t('pages.review.invalidRating'));
            return;
        }
        const safeImageUrls = imageUrls
            .map((imageUrl) => imageUrl.trim())
            .filter(Boolean);
        if (safeImageUrls.length > MAX_REVIEW_IMAGES || safeImageUrls.some((imageUrl) => !REVIEW_IMAGE_URL_PATTERN.test(imageUrl))) {
            message.warning(t('pages.review.imageInvalid'));
            return;
        }

        setSubmitting(true);
        try {
            await onAddReview(orderId, rating, comment.trim(), safeImageUrls);
            setComment('');
            setRating(5);
            setImageUrls([]);
            setOrderId(undefined);
            message.success(t('pages.review.success'));
        } catch (error: unknown) {
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
                                classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                                getPopupContainer={() => document.body}
                                aria-label={reviewOrderSelectLabel}
                                title={reviewOrderSelectLabel}
                                options={reviewableOrders.map((order) => ({
                                    value: order.id,
                                    label: `${order.orderNo || `#${order.id}`}${formatSafeDate(order.createdAt, dateLocale, '') ? ` - ${formatSafeDate(order.createdAt, dateLocale)}` : ''}`,
                                }))}
                            />
                            <div role="group" aria-label={reviewRatingLabel} title={reviewRatingLabel}>
                                <Rate className="product-review__rate" value={rating} onChange={setRating} />
                            </div>
                            <TextArea
                                className="product-review__textarea"
                                rows={4}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={t('pages.review.placeholder')}
                                maxLength={MAX_REVIEW_COMMENT_LENGTH}
                                showCount
                                aria-label={reviewCommentLabel}
                                title={reviewCommentLabel}
                            />
                            <div className="product-review__imageComposer">
                                <div className="product-review__imageHeader">
                                    <Text strong>{t('pages.review.imageUpload')}</Text>
                                    <Text type="secondary">{t('pages.review.imageHint', { count: MAX_REVIEW_IMAGES })}</Text>
                                </div>
                                {imageUrls.length > 0 ? (
                                    <div className="product-review__imagePreviewList">
                                        {imageUrls.map((imageUrl, index) => (
                                            <div className="product-review__imagePreview" key={imageUrl}>
                                                <img
                                                    src={resolveProductImage(imageUrl)}
                                                    alt={t('pages.review.imageAlt', { index: index + 1 })}
                                                    loading="lazy"
                                                    onError={(event) => {
                                                        if (event.currentTarget.src !== productImageFallback) {
                                                            event.currentTarget.src = productImageFallback;
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    aria-label={t('pages.review.imageRemove', { index: index + 1 })}
                                                    title={t('pages.review.imageRemove', { index: index + 1 })}
                                                    onClick={() => removeImage(imageUrl)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                {imageUrls.length < MAX_REVIEW_IMAGES ? (
                                    <Upload
                                        accept="image/jpeg,image/png,image/gif"
                                        showUploadList={false}
                                        beforeUpload={handleImageUpload}
                                        disabled={uploadingImage || submitting}
                                    >
                                        <Button
                                            icon={<PlusOutlined />}
                                            loading={uploadingImage}
                                            aria-label={reviewImageUploadLabel}
                                            title={reviewImageUploadLabel}
                                        >
                                            {t('pages.review.imageAdd')}
                                        </Button>
                                    </Upload>
                                ) : null}
                            </div>
                            <Button
                                type="primary"
                                className="product-review__submit"
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={uploadingImage}
                                aria-label={reviewSubmitLabel}
                                title={reviewSubmitLabel}
                            >
                                {t('pages.review.submit')}
                            </Button>
                        </Space>
                    ) : (
                        <div className="product-review__composerEmpty" data-review-no-order-recovery="true">
                            <Empty
                                description={(
                                    <div className="product-review__emptyCopy">
                                        <div>{t('pages.review.noReviewableOrder')}</div>
                                        <div className="product-review__emptyHint">{t('pages.review.noReviewableOrderHint')}</div>
                                    </div>
                                )}
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            >
                                <div className="product-review__emptyActions">
                                    <Button
                                        type="primary"
                                        aria-label={t('pages.orderTracking.emptyProfileOrders')}
                                        title={t('pages.orderTracking.emptyProfileOrders')}
                                        onClick={() => navigate('/profile?tab=orders')}
                                    >
                                        {t('pages.orderTracking.emptyProfileOrders')}
                                    </Button>
                                    <Button
                                        aria-label={t('pages.cart.browse')}
                                        title={t('pages.cart.browse')}
                                        onClick={() => navigate('/products')}
                                    >
                                        {t('pages.cart.browse')}
                                    </Button>
                                    <Button
                                        aria-label={t('pages.review.emptyCoupons')}
                                        title={t('pages.review.emptyCoupons')}
                                        onClick={() => navigate('/coupons')}
                                    >
                                        {t('pages.review.emptyCoupons')}
                                    </Button>
                                    <Button
                                        aria-label={t('nav.trackOrder')}
                                        title={t('nav.trackOrder')}
                                        onClick={() => navigate('/track-order')}
                                    >
                                        {t('nav.trackOrder')}
                                    </Button>
                                </div>
                            </Empty>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className="product-review__composer product-review__composer--login"
                    data-review-auth-gate="true"
                >
                    <Text type="secondary">{t('messages.loginRequired')}</Text>
                    <div className="product-review__emptyActions">
                        <Button
                            type="primary"
                            aria-label={t('nav.login')}
                            title={t('nav.login')}
                            onClick={() => navigate(buildLoginUrlFromWindow())}
                        >
                            {t('nav.login')}
                        </Button>
                        <Button
                            aria-label={t('nav.register')}
                            title={t('nav.register')}
                            onClick={() => navigate(`/register?redirect=${encodeURIComponent(getCurrentRelativeUrl())}`)}
                        >
                            {t('nav.register')}
                        </Button>
                        <Button
                            aria-label={t('pages.cart.browse')}
                            title={t('pages.cart.browse')}
                            onClick={() => navigate('/products')}
                        >
                            {t('pages.cart.browse')}
                        </Button>
                        <Button
                            aria-label={t('pages.review.emptyCoupons')}
                            title={t('pages.review.emptyCoupons')}
                            onClick={() => navigate('/coupons')}
                        >
                            {t('pages.review.emptyCoupons')}
                        </Button>
                    </div>
                </div>
            )}
            {reviews.length === 0 ? (
                <div className="product-review__emptyPrompt">
                    <strong>{t('pages.review.firstReviewTitle', { defaultValue: 'Be the first reviewer' })}</strong>
                    <span>{t('pages.review.firstReviewText', { defaultValue: 'Share a purchase photo after ordering and earn reward points.' })}</span>
                </div>
            ) : (
                <List
                    className="product-review__list"
                    itemLayout="horizontal"
                    dataSource={reviews}
                    pagination={reviews.length > 8 ? {
                        pageSize: 8,
                        size: 'small',
                        showSizeChanger: false,
                        hideOnSinglePage: true,
                    } : false}
                    renderItem={(review) => (
                        <List.Item className="product-review__item">
                            <List.Item.Meta
                                avatar={<Avatar icon={<UserOutlined />} />}
                                title={
                                    <Space className="product-review__meta" wrap>
                                        <span>{review.username}</span>
                                        <span role="group" aria-label={`${t('pages.productDetail.rating')}: ${review.rating}, ${review.username}`} title={`${t('pages.productDetail.rating')}: ${review.rating}, ${review.username}`}>
                                            <Rate disabled value={review.rating} />
                                        </span>
                                    </Space>
                                }
                                description={
                                    <>
                                        <p>{review.comment}</p>
                                        {Array.isArray(review.imageUrls) && review.imageUrls.length > 0 ? (
                                            <div className="product-review__gallery">
                                                {review.imageUrls.slice(0, MAX_REVIEW_IMAGES).map((imageUrl, index) => (
                                                    <img
                                                        key={`${review.id}-${imageUrl}`}
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
            )}
        </div>
    );
};
