import React, { useEffect, useState } from 'react';
import ShopRate from './ShopRate';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from './ShopIcon';

import { ShopTextArea } from './ShopInput';
import ShopSelect from './ShopSelect';
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
import ShopButton from './ShopButton';
import ShopUpload from './ShopUpload';
import ShopAvatar from './ShopAvatar';

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
    const [reviewPage, setReviewPage] = useState(1);
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
            announceAccessibleMessage(t('pages.review.imageInvalidType'), 'warning');
            return ShopUpload.LIST_IGNORE;
        }
        if (file.size > MAX_REVIEW_IMAGE_SIZE_BYTES) {
            announceAccessibleMessage(t('pages.review.imageTooLarge'), 'warning');
            return ShopUpload.LIST_IGNORE;
        }
        if (imageUrls.length >= MAX_REVIEW_IMAGES) {
            announceAccessibleMessage(t('pages.review.imageLimit', { count: MAX_REVIEW_IMAGES }), 'warning');
            return ShopUpload.LIST_IGNORE;
        }
        setUploadingImage(true);
        try {
            const res = await reviewApi.uploadImage(file);
            const uploadedUrl = String(res.data.imageUrl || '').trim();
            if (!uploadedUrl) {
                throw new Error('Empty review image URL');
            }
            setImageUrls((current) => [...current, uploadedUrl].slice(0, MAX_REVIEW_IMAGES));
            announceAccessibleMessage(t('pages.review.imageUploadSuccess'), 'success');
        } catch (error: unknown) {
            announceAccessibleMessage(getApiErrorMessage(error, t('pages.review.imageUploadFailed'), language), 'error');
        } finally {
            setUploadingImage(false);
        }
        return ShopUpload.LIST_IGNORE;
    };

    const removeImage = (imageUrl: string) => {
        setImageUrls((current) => current.filter((item) => item !== imageUrl));
    };

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            announceAccessibleMessage(t('messages.loginRequired'), 'warning');
            navigate(buildLoginUrlFromWindow());
            return;
        }
        if (!orderId) {
            announceAccessibleMessage(t('pages.review.selectOrder'), 'warning');
            return;
        }
        if (!comment.trim()) {
            announceAccessibleMessage(t('pages.review.emptyComment'), 'warning');
            return;
        }
        if (comment.trim().length > MAX_REVIEW_COMMENT_LENGTH) {
            announceAccessibleMessage(t('pages.review.commentTooLong', { count: MAX_REVIEW_COMMENT_LENGTH }), 'warning');
            return;
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            announceAccessibleMessage(t('pages.review.invalidRating'), 'warning');
            return;
        }
        const safeImageUrls = imageUrls
            .map((imageUrl) => imageUrl.trim())
            .filter(Boolean);
        if (safeImageUrls.length > MAX_REVIEW_IMAGES || safeImageUrls.some((imageUrl) => !REVIEW_IMAGE_URL_PATTERN.test(imageUrl))) {
            announceAccessibleMessage(t('pages.review.imageInvalid'), 'warning');
            return;
        }

        setSubmitting(true);
        try {
            await onAddReview(orderId, rating, comment.trim(), safeImageUrls);
            setComment('');
            setRating(5);
            setImageUrls([]);
            setOrderId(undefined);
            announceAccessibleMessage(t('pages.review.success'), 'success');
        } catch (error: unknown) {
            announceAccessibleMessage(getApiErrorMessage(error, t('pages.review.failed'), language), 'error');
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
                        <div className="product-review__form product-review__stack">
                            <ShopSelect
                                value={orderId != null ? String(orderId) : undefined}
                                onChange={(value) => setOrderId(value ? Number(value) : undefined)}
                                placeholder={t('pages.review.selectOrder')}
                                className="product-review__orderSelect"
                                popupClassName="shop-mobile-popup-layer"
                                popupZIndex={2400}
                                ariaLabel={reviewOrderSelectLabel}
                                title={reviewOrderSelectLabel}
                                options={reviewableOrders.map((order) => ({
                                    value: String(order.id),
                                    label: `${order.orderNo || `#${order.id}`}${formatSafeDate(order.createdAt, dateLocale, '') ? ` - ${formatSafeDate(order.createdAt, dateLocale)}` : ''}`,
                                }))}
                            />
                            <div role="group" aria-label={reviewRatingLabel} title={reviewRatingLabel}>
                                <ShopRate className="product-review__rate" value={rating} onChange={setRating} ariaLabel="review-rating" />
                            </div>
                            <ShopTextArea
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
                                    <span className="product-review__text product-review__text--strong">{t('pages.review.imageUpload')}</span>
                                    <span className="product-review__text product-review__text--secondary">{t('pages.review.imageHint', { count: MAX_REVIEW_IMAGES })}</span>
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
                                                <ShopButton
                                                    type="text"
                                                    danger
                                                    icon={<ShopIcon path={SI.delete} />}
                                                    aria-label={t('pages.review.imageRemove', { index: index + 1 })}
                                                    title={t('pages.review.imageRemove', { index: index + 1 })}
                                                    onClick={() => removeImage(imageUrl)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                {imageUrls.length < MAX_REVIEW_IMAGES ? (
                                    <ShopUpload
                                        accept="image/jpeg,image/png,image/gif"
                                        showUploadList={false}
                                        beforeUpload={handleImageUpload}
                                        disabled={uploadingImage || submitting}
                                    >
                                        <ShopButton
                                            icon={<ShopIcon path={SI.plus} />}
                                            loading={uploadingImage}
                                            aria-label={reviewImageUploadLabel}
                                            title={reviewImageUploadLabel}
                                        >
                                            {t('pages.review.imageAdd')}
                                        </ShopButton>
                                    </ShopUpload>
                                ) : null}
                            </div>
                            <ShopButton
                                type="primary"
                                className="product-review__submit"
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={uploadingImage}
                                aria-label={reviewSubmitLabel}
                                title={reviewSubmitLabel}
                            >
                                {t('pages.review.submit')}
                            </ShopButton>
                        </div>
                    ) : (
                        <div className="product-review__composerEmpty" data-review-no-order-recovery="true">
                            <div className="product-review__emptyPanel">
                                <div className="product-review__emptyCopy">
                                    <div>{t('pages.review.noReviewableOrder')}</div>
                                    <div className="product-review__emptyHint">{t('pages.review.noReviewableOrderHint')}</div>
                                </div>
                                <div className="product-review__emptyActions">
                                    <ShopButton
                                        type="primary"
                                        aria-label={t('pages.orderTracking.emptyProfileOrders')}
                                        title={t('pages.orderTracking.emptyProfileOrders')}
                                        onClick={() => navigate('/profile?tab=orders')}
                                    >
                                        {t('pages.orderTracking.emptyProfileOrders')}
                                    </ShopButton>
                                    <ShopButton
                                        aria-label={t('pages.cart.browse')}
                                        title={t('pages.cart.browse')}
                                        onClick={() => navigate('/products')}
                                    >
                                        {t('pages.cart.browse')}
                                    </ShopButton>
                                    <ShopButton
                                        aria-label={t('pages.review.emptyCoupons')}
                                        title={t('pages.review.emptyCoupons')}
                                        onClick={() => navigate('/coupons')}
                                    >
                                        {t('pages.review.emptyCoupons')}
                                    </ShopButton>
                                    <ShopButton
                                        aria-label={t('nav.trackOrder')}
                                        title={t('nav.trackOrder')}
                                        onClick={() => navigate('/track-order')}
                                    >
                                        {t('nav.trackOrder')}
                                    </ShopButton>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className="product-review__composer product-review__composer--login"
                    data-review-auth-gate="true"
                >
                    <span className="product-review__text product-review__text--secondary">{t('messages.loginRequired')}</span>
                    <div className="product-review__emptyActions">
                        <ShopButton
                            type="primary"
                            aria-label={t('nav.login')}
                            title={t('nav.login')}
                            onClick={() => navigate(buildLoginUrlFromWindow())}
                        >
                            {t('nav.login')}
                        </ShopButton>
                        <ShopButton
                            aria-label={t('nav.register')}
                            title={t('nav.register')}
                            onClick={() => navigate(`/register?redirect=${encodeURIComponent(getCurrentRelativeUrl())}`)}
                        >
                            {t('nav.register')}
                        </ShopButton>
                        <ShopButton
                            aria-label={t('pages.cart.browse')}
                            title={t('pages.cart.browse')}
                            onClick={() => navigate('/products')}
                        >
                            {t('pages.cart.browse')}
                        </ShopButton>
                        <ShopButton
                            aria-label={t('pages.review.emptyCoupons')}
                            title={t('pages.review.emptyCoupons')}
                            onClick={() => navigate('/coupons')}
                        >
                            {t('pages.review.emptyCoupons')}
                        </ShopButton>
                    </div>
                </div>
            )}
            {reviews.length === 0 ? (
                <div className="product-review__emptyPrompt">
                    <strong>{t('pages.review.firstReviewTitle', { defaultValue: 'Be the first reviewer' })}</strong>
                    <span>{t('pages.review.firstReviewText', { defaultValue: 'Share a purchase photo after ordering and earn reward points.' })}</span>
                </div>
            ) : (
                <>
                <ul className="product-review__list product-review__itemList" role="list">
                  {reviews.slice((Math.max(reviewPage, 1) - 1) * 8, Math.max(reviewPage, 1) * 8).map((review) => (
                        <li key={review.id} className="product-review__item">
                            <div className="product-review__itemMeta">
                                <ShopAvatar icon={<ShopIcon path={SI.user} />} />
                                <div className="product-review__itemBody">
                                    <div className="product-review__meta">
                                        <span>{review.username}</span>
                                        <span role="group" aria-label={`${t('pages.productDetail.rating')}: ${review.rating}, ${review.username}`} title={`${t('pages.productDetail.rating')}: ${review.rating}, ${review.username}`}>
                                            <ShopRate disabled value={review.rating} ariaLabel={`rating-${review.rating}`} />
                                        </span>
                                    </div>
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
                                        {review.adminReply ? (
                                            <div className="product-review__adminReply">
                                                <span className="product-review__text product-review__text--strong">{t('pages.adminReviews.reply')}: </span>
                                                <span className="product-review__text">{review.adminReply}</span>
                                            </div>
                                        ) : null}
                                        <small>{formatSafeDateTime(review.createdAt, dateLocale, '-')}</small>
                                </div>
                            </div>
                        </li>
                  ))}
                </ul>
                {reviews.length > 8 ? (
                  <div className="product-review__pagination">
                    <ShopButton
                      size="small"
                      disabled={reviewPage <= 1}
                      aria-label={t('common.prev', { defaultValue: 'Previous' })}
                      onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
                    >
                      {t('common.prev', { defaultValue: 'Previous' })}
                    </ShopButton>
                    <span className="product-review__text product-review__text--secondary">
                      {reviewPage} / {Math.ceil(reviews.length / 8)}
                    </span>
                    <ShopButton
                      size="small"
                      disabled={reviewPage >= Math.ceil(reviews.length / 8)}
                      aria-label={t('common.next', { defaultValue: 'Next' })}
                      onClick={() => setReviewPage((page) => Math.min(Math.ceil(reviews.length / 8), page + 1))}
                    >
                      {t('common.next', { defaultValue: 'Next' })}
                    </ShopButton>
                  </div>
                ) : null}
                </>
            )}
        </div>
    );
};
