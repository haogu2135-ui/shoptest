import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import { ProductDetailRecommendations } from './productDetailRecommendations';
import { ProductDetailGallery, ProductDetailImagePreviewModal } from './productDetailGallery';
import { ProductDetailSummary, ProductDetailSizeGuideModal } from './productDetailSummary';
import { ProductDetailContent } from './productDetailContent';

export const ProductDetailSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="product-detail-page product-detail-page--loading">
    <div className="product-detail-shell">
      <div
        className="product-detail-skeleton"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        data-testid="product-detail-skeleton"
      >
        <span className="product-detail-skeleton__sr">{label}</span>
        <div className="product-detail-skeleton__breadcrumb" aria-hidden="true">
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb" />
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb product-detail-skeleton__block--crumbLong" />
          <span className="product-detail-skeleton__block product-detail-skeleton__block--crumb product-detail-skeleton__block--crumbShort" />
        </div>

        <div className="product-detail-skeleton__main">
          <section className="product-detail-skeleton__media" aria-hidden="true" data-testid="product-detail-skeleton-gallery">
            <div className="product-detail-skeleton__imageFrame">
              <span className="product-detail-skeleton__block product-detail-skeleton__block--image" />
            </div>
            <div className="product-detail-skeleton__thumbs">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--thumb" />
              ))}
            </div>
          </section>

          <section className="product-detail-skeleton__summary" aria-hidden="true" data-testid="product-detail-skeleton-summary">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--brand" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--title" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--subtitle" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--price" />
            <div className="product-detail-skeleton__signals">
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--signal" />
              ))}
            </div>
            <div className="product-detail-skeleton__options">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="product-detail-skeleton__optionGroup">
                  <span className="product-detail-skeleton__block product-detail-skeleton__block--optionLabel" />
                  <div className="product-detail-skeleton__optionPills">
                    {Array.from({ length: 3 }).map((__, pillIndex) => (
                      <span key={pillIndex} className="product-detail-skeleton__block product-detail-skeleton__block--pill" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="product-detail-skeleton__actions">
              <span className="product-detail-skeleton__block product-detail-skeleton__block--action" />
              <span className="product-detail-skeleton__block product-detail-skeleton__block--action product-detail-skeleton__block--actionPrimary" />
            </div>
          </section>
        </div>

        <div className="product-detail-skeleton__afterfold" aria-hidden="true" data-testid="product-detail-skeleton-afterfold">
          <div className="product-detail-skeleton__tabs">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--tab" />
          </div>
          <div className="product-detail-skeleton__detailRows">
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail product-detail-skeleton__block--detailLong" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail" />
            <span className="product-detail-skeleton__block product-detail-skeleton__block--detail product-detail-skeleton__block--detailShort" />
          </div>
          <div className="product-detail-skeleton__recommendations">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className="product-detail-skeleton__block product-detail-skeleton__block--recommendation" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ProductDetailLazyFallback: React.FC<{ label: string; variant: 'rich' | 'review' }> = ({ label, variant }) => (
  <div
    className={`product-detail-lazy-skeleton product-detail-lazy-skeleton--${variant}`}
    role="status"
    aria-live="polite"
    aria-busy="true"
    aria-label={label}
    data-testid={`product-detail-lazy-${variant}-fallback`}
  >
    <span className="product-detail-skeleton__sr">{label}</span>
    {variant === 'rich' ? (
      <>
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line product-detail-lazy-skeleton__line--wide" />
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line" />
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__media" />
      </>
    ) : (
      <>
        <span className="product-detail-skeleton__block product-detail-lazy-skeleton__title" />
        <div className="product-detail-lazy-skeleton__composer">
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__select" />
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__textarea" />
          <span className="product-detail-skeleton__block product-detail-lazy-skeleton__button" />
        </div>
        <div className="product-detail-lazy-skeleton__reviewRows">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="product-detail-lazy-skeleton__reviewRow" key={index}>
              <span className="product-detail-skeleton__block product-detail-lazy-skeleton__avatar" />
              <span className="product-detail-skeleton__block product-detail-lazy-skeleton__line" />
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);

type ProductDetailTranslate = (key: string, params?: Record<string, string | number>) => string;

export type ProductDetailLoadErrorShellProps = {
  t: ProductDetailTranslate;
  loadError: string | null;
  onRetry: () => void;
  onBrowse: () => void;
  onCoupons: () => void;
  onPetFinder: () => void;
  onSupport: () => void;
};

export const ProductDetailLoadErrorShell: React.FC<ProductDetailLoadErrorShellProps> = ({
  t,
  loadError,
  onRetry,
  onBrowse,
  onCoupons,
  onPetFinder,
  onSupport,
}) => (
  <div className="product-detail-empty" data-product-detail-load-recovery="true">
    <PageError
      className="product-detail-empty__panel product-detail-empty__panel--error"
      title={t('pages.productDetail.loadFailed')}
      description={loadError || t('pages.productDetail.loadFailedDescription')}
      actions={[
        {
          key: 'retry',
          label: t('common.refresh'),
          onClick: onRetry,
          type: 'primary',
        },
        {
          key: 'browse',
          label: t('pages.productList.title'),
          onClick: onBrowse,
          type: 'default',
        },
        {
          key: 'coupons',
          label: t('pages.productDetail.notFoundCoupons'),
          onClick: onCoupons,
          type: 'default',
        },
        {
          key: 'pet-finder',
          label: t('pages.productDetail.notFoundPetFinder'),
          onClick: onPetFinder,
          type: 'default',
        },
        {
          key: 'support',
          label: t('nav.support'),
          onClick: onSupport,
          type: 'default',
        },
      ]}
    />
  </div>
);

export type ProductDetailNotFoundShellProps = {
  t: ProductDetailTranslate;
  onBrowse: () => void;
  onWishlist: () => void;
  onCoupons: () => void;
  onPetFinder: () => void;
};

export const ProductDetailNotFoundShell: React.FC<ProductDetailNotFoundShellProps> = ({
  t,
  onBrowse,
  onWishlist,
  onCoupons,
  onPetFinder,
}) => (
  <div className="product-detail-empty">
    <PageEmpty
      className="product-detail-empty__panel"
      data-product-not-found-actions="true"
      description={(
        <div className="product-detail-empty__copy">
          <div>{t('pages.productDetail.notFound')}</div>
          <div className="product-detail-empty__hint">{t('pages.productDetail.notFoundHint')}</div>
        </div>
      )}
      actions={[
        {
          key: 'browse',
          label: t('pages.productList.title'),
          onClick: onBrowse,
        },
        {
          key: 'wishlist',
          label: t('pages.productDetail.notFoundWishlist'),
          onClick: onWishlist,
          type: 'default',
        },
        {
          key: 'coupons',
          label: t('pages.productDetail.notFoundCoupons'),
          onClick: onCoupons,
          type: 'default',
        },
        {
          key: 'pet-finder',
          label: t('pages.productDetail.notFoundPetFinder'),
          onClick: onPetFinder,
          type: 'default',
        },
      ]}
    />
  </div>
);

/** Ready product-detail composition: gallery, summary, content, recommendations, modals. */
export type ProductDetailMainShellProps = Record<string, any>;

export const ProductDetailMainShell: React.FC<ProductDetailMainShellProps> = (props) => {
  const {
    activeMobileImageIndex,
    addToCartActionLabel,
    addToCartBlocked,
    bundleInfo,
    bundleSavings,
    buyNowBlocked,
    buyNowBlockedReason,
    compareActionLabel,
    completeSetItems,
    decisionChecklist,
    decreaseQuantityLabel,
    deliveryPromise,
    detailActiveTab,
    detailContentRef,
    detailProductName,
    discountPercent,
    displayPrice,
    displayedRating,
    favoriteActionLabel,
    fitConfidenceText,
    formatCountdown,
    formatMoney,
    galleryImages,
    handleAddRecommendationToCart,
    handleAddReview,
    handleAddToCart,
    handleAskQuestion,
    handleBuyNow,
    handleCompare,
    handleFavorite,
    handleGalleryKeyDown,
    handleGalleryTouchStart,
    handleMobileGalleryScroll,
    handleQuantityChange,
    handleStockAlert,
    hasCompleteOptions,
    hasUnavailableSelectedVariant,
    heroImage,
    heroImageSizes,
    heroImageSrcSet,
    homeActionLabel,
    id,
    imagePaused,
    increaseQuantityLabel,
    isAlerted,
    isCompared,
    isLowStock,
    isModalVisible,
    isOutOfStock,
    isWishlisted,
    language,
    limitedTimePromoActive,
    limitedTimeRemaining,
    lowStockCount,
    lowStockUrgencyLabel,
    mobileAddToCartBlocked,
    mobileBuybarPrice,
    mobileBuybarStatus,
    mobileCartBlockedReason,
    mobileGalleryRef,
    navigate,
    openProductDetailTab,
    optionGroups,
    optionsSectionRef,
    originalReferencePrice,
    pauseImageRotation,
    pendingQuestions,
    pinchZoom,
    priceSavingsAmount,
    priceSavingsPercent,
    product,
    productFaqItems,
    productFreeShippingText,
    productImages,
    productName,
    productShippingText,
    purchaseMode,
    purchaseModeActionLabel,
    purchaseModeLabel,
    purchaseReadinessItems,
    purchaseSavings,
    purchaseSelectionBlocked,
    purchaseSubmitting,
    purchaseSubtotal,
    quantity,
    quantityValueLabel,
    questionInputLabel,
    questionSubmitActionLabel,
    questionSubmitting,
    questionText,
    questions,
    recommendationAddingId,
    recommendationsLoadFailed,
    recommendationsLoading,
    recommendedPathText,
    recommendedPathTitle,
    recommendedPurchaseMode,
    recommendedSize,
    recommendedSizeLabel,
    recommendedSizeValue,
    relatedRecommendations,
    renderProductDetailAmountText,
    resetGalleryPinch,
    resetSelectedOptionsActionLabel,
    resumeImageRotation,
    retryRecommendations,
    reviewableOrders,
    reviews,
    scheduleImageRotationResume,
    selectGalleryImage,
    selectOptionValue,
    selectedImage,
    selectedOptionTags,
    selectedOptions,
    selectedStock,
    selectedVariant,
    setImagePaused,
    setIsModalVisible,
    setPurchaseMode,
    setQuestionText,
    setSelectedImage,
    setSelectedOptions,
    setSizeCalculatorBreed,
    setSizeCalculatorWeight,
    setSizeGuideOpen,
    shouldShowDecisionChecklist,
    sizeBreedInputLabel,
    sizeCalculatorBreed,
    sizeCalculatorWeight,
    sizeGuideActionLabel,
    sizeGuideConfirmActionLabel,
    sizeGuideOpen,
    sizeOptionGroup,
    sizeWeightInputLabel,
    stockAlertActionLabel,
    stockLabel,
    t,
    trustBadges,
    useRecommendedPathActionLabel,
    variants,
  } = props;

  return (
    <div className={`product-detail-page product-detail-page--${language}`}>
      <div className="product-detail-shell">
        <ShopBreadcrumb
          className="product-detail-breadcrumb"
          ariaLabel={productName}
          items={[
            {
              key: 'home',
              path: '/',
              ariaLabel: t('nav.ariaHome'),
              label: <ShopIcon path={SI.home} />,
            },
            {
              key: 'products',
              path: '/products',
              label: t('pages.productList.title'),
            },
            {
              key: 'product',
              label: productName,
            },
          ]}
        />

        <div className="product-detail__layout">
          {/* Product media gallery */}
          <ProductDetailGallery
            activeMobileImageIndex={activeMobileImageIndex}
            discountPercent={discountPercent}
            galleryImages={galleryImages}
            handleGalleryKeyDown={handleGalleryKeyDown}
            handleGalleryTouchStart={handleGalleryTouchStart}
            handleMobileGalleryScroll={handleMobileGalleryScroll}
            heroImage={heroImage}
            heroImageSizes={heroImageSizes}
            heroImageSrcSet={heroImageSrcSet}
            imagePaused={imagePaused}
            mobileGalleryRef={mobileGalleryRef}
            pauseImageRotation={pauseImageRotation}
            pinchZoom={pinchZoom}
            productImages={productImages}
            productName={productName}
            resetGalleryPinch={resetGalleryPinch}
            resumeImageRotation={resumeImageRotation}
            scheduleImageRotationResume={scheduleImageRotationResume}
            selectGalleryImage={selectGalleryImage}
            selectedImage={selectedImage}
            setImagePaused={setImagePaused}
            setIsModalVisible={setIsModalVisible}
            setSelectedImage={setSelectedImage}
            t={t}
          />

          {/* Product purchase summary */}
          <ProductDetailSummary
            addToCartActionLabel={addToCartActionLabel}
            addToCartBlocked={addToCartBlocked}
            bundleInfo={bundleInfo}
            bundleSavings={bundleSavings}
            buyNowBlocked={buyNowBlocked}
            buyNowBlockedReason={buyNowBlockedReason}
            compareActionLabel={compareActionLabel}
            completeSetItems={completeSetItems}
            decisionChecklist={decisionChecklist}
            decreaseQuantityLabel={decreaseQuantityLabel}
            deliveryPromise={deliveryPromise}
            detailProductName={detailProductName}
            displayPrice={displayPrice}
            displayedRating={displayedRating}
            favoriteActionLabel={favoriteActionLabel}
            fitConfidenceText={fitConfidenceText}
            formatCountdown={formatCountdown}
            formatMoney={formatMoney}
            handleAddRecommendationToCart={handleAddRecommendationToCart}
            handleAddToCart={handleAddToCart}
            handleBuyNow={handleBuyNow}
            handleCompare={handleCompare}
            handleFavorite={handleFavorite}
            handleQuantityChange={handleQuantityChange}
            handleStockAlert={handleStockAlert}
            hasCompleteOptions={hasCompleteOptions}
            hasUnavailableSelectedVariant={hasUnavailableSelectedVariant}
            homeActionLabel={homeActionLabel}
            increaseQuantityLabel={increaseQuantityLabel}
            isAlerted={isAlerted}
            isCompared={isCompared}
            isLowStock={isLowStock}
            isOutOfStock={isOutOfStock}
            isWishlisted={isWishlisted}
            language={language}
            limitedTimePromoActive={limitedTimePromoActive}
            limitedTimeRemaining={limitedTimeRemaining}
            lowStockCount={lowStockCount}
            lowStockUrgencyLabel={lowStockUrgencyLabel}
            mobileAddToCartBlocked={mobileAddToCartBlocked}
            mobileBuybarPrice={mobileBuybarPrice}
            mobileBuybarStatus={mobileBuybarStatus}
            mobileCartBlockedReason={mobileCartBlockedReason}
            navigate={navigate}
            optionGroups={optionGroups}
            optionsSectionRef={optionsSectionRef}
            originalReferencePrice={originalReferencePrice}
            priceSavingsAmount={priceSavingsAmount}
            priceSavingsPercent={priceSavingsPercent}
            product={product}
            productFreeShippingText={productFreeShippingText}
            productName={productName}
            productShippingText={productShippingText}
            purchaseMode={purchaseMode}
            purchaseModeActionLabel={purchaseModeActionLabel}
            purchaseModeLabel={purchaseModeLabel}
            purchaseReadinessItems={purchaseReadinessItems}
            purchaseSavings={purchaseSavings}
            purchaseSelectionBlocked={purchaseSelectionBlocked}
            purchaseSubmitting={purchaseSubmitting}
            purchaseSubtotal={purchaseSubtotal}
            quantity={quantity}
            quantityValueLabel={quantityValueLabel}
            recommendationAddingId={recommendationAddingId}
            recommendedPathText={recommendedPathText}
            recommendedPathTitle={recommendedPathTitle}
            recommendedPurchaseMode={recommendedPurchaseMode}
            recommendedSize={recommendedSize}
            recommendedSizeLabel={recommendedSizeLabel}
            recommendedSizeValue={recommendedSizeValue}
            renderProductDetailAmountText={renderProductDetailAmountText}
            resetSelectedOptionsActionLabel={resetSelectedOptionsActionLabel}
            selectOptionValue={selectOptionValue}
            selectedOptionTags={selectedOptionTags}
            selectedOptions={selectedOptions}
            selectedStock={selectedStock}
            selectedVariant={selectedVariant}
            setPurchaseMode={setPurchaseMode}
            setSelectedOptions={setSelectedOptions}
            setSizeCalculatorBreed={setSizeCalculatorBreed}
            setSizeCalculatorWeight={setSizeCalculatorWeight}
            setSizeGuideOpen={setSizeGuideOpen}
            shouldShowDecisionChecklist={shouldShowDecisionChecklist}
            sizeBreedInputLabel={sizeBreedInputLabel}
            sizeCalculatorBreed={sizeCalculatorBreed}
            sizeCalculatorWeight={sizeCalculatorWeight}
            sizeGuideActionLabel={sizeGuideActionLabel}
            sizeOptionGroup={sizeOptionGroup}
            sizeWeightInputLabel={sizeWeightInputLabel}
            stockAlertActionLabel={stockAlertActionLabel}
            stockLabel={stockLabel}
            t={t}
            trustBadges={trustBadges}
            useRecommendedPathActionLabel={useRecommendedPathActionLabel}
            variants={variants}
          />
        </div>

        {/* Product details and specifications */}
        <ProductDetailContent
          detailActiveTab={detailActiveTab}
          detailContentRef={detailContentRef}
          handleAddReview={handleAddReview}
          handleAskQuestion={handleAskQuestion}
          id={id}
          language={language}
          openProductDetailTab={openProductDetailTab}
          pendingQuestions={pendingQuestions}
          product={product}
          productFaqItems={productFaqItems}
          productShippingText={productShippingText}
          questionInputLabel={questionInputLabel}
          questionSubmitActionLabel={questionSubmitActionLabel}
          questionSubmitting={questionSubmitting}
          questionText={questionText}
          questions={questions}
          reviewableOrders={reviewableOrders}
          reviews={reviews}
          setQuestionText={setQuestionText}
          t={t}
        />

        <ProductDetailRecommendations
          detailProductName={detailProductName}
          formatMoney={formatMoney}
          handleAddRecommendationToCart={handleAddRecommendationToCart}
          navigate={navigate}
          recommendationAddingId={recommendationAddingId}
          recommendationsLoadFailed={recommendationsLoadFailed}
          recommendationsLoading={recommendationsLoading}
          relatedRecommendations={relatedRecommendations}
          retryRecommendations={retryRecommendations}
          t={t}
        />
      </div>

      {/* Image preview modal */}
      <ProductDetailImagePreviewModal
        isModalVisible={isModalVisible}
        productImages={productImages}
        productName={productName}
        selectedImage={selectedImage}
        setIsModalVisible={setIsModalVisible}
        t={t}
      />

      <ProductDetailSizeGuideModal
        open={sizeGuideOpen}
        setOpen={setSizeGuideOpen}
        sizeGuideConfirmActionLabel={sizeGuideConfirmActionLabel}
        t={t}
      />
    </div>
  );
};

