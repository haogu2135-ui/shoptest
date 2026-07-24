import React, { Suspense } from 'react';
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import { ShopTextArea } from '../components/ShopInput';
import ShopButton from '../components/ShopButton';
import ShopAlert from '../components/ShopAlert';
import type {
  ProductPublic as Product,
  PublicReview,
  ProductQuestionPublic,
  ReviewableOrder,
} from '../types';
import { formatProductSpecLabel } from '../utils/productSpecLabels';
import { handleRovingTablistKeyDown } from '../utils/tablistKeyboard';
import {
  PRODUCT_DETAIL_TAB_KEYS,
  PRODUCT_QUESTION_MAX_LENGTH,
  type PendingProductQuestion,
  type ProductDetailTabKey,
} from './productDetailHelpers';
import { ProductDetailLazyFallback } from './productDetailShell';

const ProductRichDetail = React.lazy(() => import('../components/ProductRichDetail'));
const ProductReview = React.lazy(() => import('../components/ProductReview').then((module) => ({ default: module.ProductReview })));

type FaqItem = {
  question: string;
  answer: string;
};

export type ProductDetailContentProps = {
  detailActiveTab: ProductDetailTabKey;
  detailContentRef: MutableRefObject<HTMLDivElement | null>;
  handleAddReview: (orderId: number, rating: number, comment: string, imageUrls: string[]) => Promise<void>;
  handleAskQuestion: () => void | Promise<void>;
  id: string | undefined;
  language: string;
  openProductDetailTab: (tabKey: string) => void;
  pendingQuestions: PendingProductQuestion[];
  product: Product;
  productFaqItems: FaqItem[];
  productShippingText: ReactNode;
  questionInputLabel: string;
  questionSubmitActionLabel: string;
  questionSubmitting: boolean;
  questionText: string;
  questions: ProductQuestionPublic[];
  reviewableOrders: ReviewableOrder[];
  reviews: PublicReview[];
  setQuestionText: Dispatch<SetStateAction<string>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial product-detail content stack:
 * details/specs/service tabs, reviews, and Q&A conversion assist.
 */
export const ProductDetailContent: React.FC<ProductDetailContentProps> = ({
  detailActiveTab,
  detailContentRef,
  handleAddReview,
  handleAskQuestion,
  id,
  language,
  openProductDetailTab,
  pendingQuestions,
  product,
  productFaqItems,
  productShippingText,
  questionInputLabel,
  questionSubmitActionLabel,
  questionSubmitting,
  questionText,
  questions,
  reviewableOrders,
  reviews,
  setQuestionText,
  t,
}) => (
  <>
        <div ref={detailContentRef} className="product-detail-content-anchor" />
        <section className="product-tabs-card" id="product-service-tabs" aria-label={t('pages.productDetail.details')}>
          <div className="product-detail-tabs">
            <div
              className="product-detail-tabs__nav"
              role="tablist"
              aria-orientation="horizontal"
              aria-label={t('pages.productDetail.details')}
            >
              {([
                { key: 'details' as const, label: t('pages.productDetail.details') },
                { key: 'specs' as const, label: t('pages.productDetail.specs') },
                { key: 'service' as const, label: t('pages.productDetail.service') },
              ]).map((tab) => {
                const selected = detailActiveTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`product-detail-tab-${tab.key}`}
                    className={`product-detail-tabs__tab${selected ? ' product-detail-tabs__tab--active' : ''}`}
                    aria-selected={selected}
                    aria-controls={`product-detail-panel-${tab.key}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => openProductDetailTab(tab.key)}
                    onKeyDown={(event) => {
                      handleRovingTablistKeyDown(event, {
                        tabKeys: PRODUCT_DETAIL_TAB_KEYS as unknown as string[],
                        activeKey: detailActiveTab,
                        onActivate: openProductDetailTab,
                        getTabElementId: (key) => `product-detail-tab-${key}`,
                      });
                    }}
                  >
                    <span className="product-detail-tabs__tabLabel">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div
              className="product-detail-tabs__panel"
              role="tabpanel"
              id="product-detail-panel-details"
              aria-labelledby="product-detail-tab-details"
              hidden={detailActiveTab !== 'details'}
            >
              <div className="product-tab-content">
                <Suspense fallback={<ProductDetailLazyFallback label={t('common.loading')} variant="rich" />}>
                  <ProductRichDetail
                    detailContent={product.detailContent}
                    fallback={product.description}
                    emptyText={t('pages.productDetail.noDetails')}
                    labels={{
                      imageAlt: t('pages.productDetail.richImageAlt'),
                      videoTitle: (index) => t('pages.productDetail.richVideoTitle', { index }),
                      openVideo: t('pages.productDetail.openRichVideo'),
                      unsupported: t('pages.productDetail.unsupportedRichContent'),
                    }}
                  />
                </Suspense>
              </div>
            </div>
            <div
              className="product-detail-tabs__panel"
              role="tabpanel"
              id="product-detail-panel-specs"
              aria-labelledby="product-detail-tab-specs"
              hidden={detailActiveTab !== 'specs'}
            >
              <div className="product-tab-content">
                    {product.specifications && Object.entries(product.specifications)
                      .filter(([key]) => !key.startsWith('options.') && !key.startsWith('i18n.') && !key.startsWith('bundle.'))
                      .map(([key, value]) => (
                        <div key={key} className="product-spec-row">
                          <span className="product-detail-page__text product-detail-page__text--strong">{formatProductSpecLabel(key, t)}: </span>
                          <span className="product-detail-page__text">{value as string}</span>
                        </div>
                      ))}
                  </div>
            </div>
            <div
              className="product-detail-tabs__panel"
              role="tabpanel"
              id="product-detail-panel-service"
              aria-labelledby="product-detail-tab-service"
              hidden={detailActiveTab !== 'service'}
            >
              <div className="product-tab-content">
                    <div className="product-warranty-row">
                      <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.warranty')}</span>
                      <span className="product-detail-page__text">{product.warranty || t('pages.productDetail.defaultWarranty')}</span>
                    </div>
                    <div>
                      <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.shipping')}</span>
                      <span className="product-detail-page__text">{productShippingText}</span>
                    </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product reviews */}
        <section className="product-review-card" id="product-reviews-card" aria-label={t('pages.review.title')}>
          <Suspense fallback={<ProductDetailLazyFallback label={t('common.loading')} variant="review" />}>
            <ProductReview
              productId={Number(id)}
              reviews={reviews}
              reviewableOrders={reviewableOrders}
              onAddReview={handleAddReview}
            />
          </Suspense>
        </section>

        <section className="product-qa-card" id="product-qa-card" aria-label={t('pages.ask.title')}>
          <h4 className="product-detail-page__title product-detail-page__title--qa">{t('pages.ask.title')}</h4>
          <div className="product-qa-space">
            <ShopTextArea
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={t('pages.ask.placeholder')}
              maxLength={PRODUCT_QUESTION_MAX_LENGTH}
              showCount
              aria-label={questionInputLabel}
              title={questionInputLabel}
            />
            <ShopButton type="primary" aria-label={questionSubmitActionLabel} title={questionSubmitActionLabel} onClick={handleAskQuestion} loading={questionSubmitting}>
              {t('pages.ask.submit')}
            </ShopButton>
          </div>
          {pendingQuestions.length > 0 ? (
            <div className="product-qa-pending" role="status" aria-live="polite" aria-label={t('pages.ask.pendingTitle')}>
              <ShopAlert
                type="success"
                showIcon
                message={t('pages.ask.pendingTitle')}
                description={t('pages.ask.pendingDescription')}
              />
              <ul className="product-qa-pending-list product-detail-page__itemList" role="list">
                {pendingQuestions.map((pendingQuestion) => (
                  <li key={pendingQuestion.id} className="product-detail-page__item">
                    <div className="product-question-item product-question-item--pending">
                      <div className="product-question-text">{pendingQuestion.question}</div>
                      <div className="product-question-meta">
                        {new Date(pendingQuestion.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}
                      </div>
                      <div className="product-answer-box product-answer-box--pending">
                        <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.ask.answerLabel')}: </span>
                        <span className="product-detail-page__text">{t('pages.ask.pendingAnswer')}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {questions.length === 0 ? (
            <div className="product-qa-faq" aria-label={t('pages.ask.empty')}>
              <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.faqTitle', { defaultValue: 'Frequently asked questions' })}</span>
              <div className="product-qa-faq__list">
                {productFaqItems.map((item) => (
                  <div key={item.question} className="product-qa-faq__item">
                    <strong>{item.question}</strong>
                    <span>{item.answer}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul className="product-detail-page__itemList product-qa-list" role="list">
              {questions.map((q) => (
                <li key={q.id} className="product-detail-page__item">
                  <div className="product-question-item">
                    <div className="product-question-text">{q.question}</div>
                    <div className="product-question-meta">
                      {new Date(q.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US')}
                    </div>
                    <div className="product-answer-box">
                      <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.ask.answerLabel')}: </span>
                      <span className="product-detail-page__text">{q.answer}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>


  </>
);
