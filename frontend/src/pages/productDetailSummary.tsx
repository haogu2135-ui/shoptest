import React from 'react';
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopInput from '../components/ShopInput';
import ShopSegmented from '../components/ShopSegmented';
import ShopRate from '../components/ShopRate';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import ShopModal from '../components/ShopModal';
import type { ProductPublic as Product, ProductVariant } from '../types';
import { getLocalizedOptionLabel, isSizeOptionName } from '../utils/localizedProductOptions';
import { optionValueIsCompatible, type ProductOptionGroup } from '../utils/productOptions';
import {
  normalizeSizeCalculatorWeight,
  PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG,
  renderTrustIcon,
} from './productDetailHelpers';
import { ProductDetailCompleteSet } from './productDetailRecommendations';
import { ProductDetailMobileBuyBar } from './productDetailBuyBar';

type DeliveryPromiseView = {
  enabled: boolean;
  shipsToday: boolean;
  cutoffHour: number;
  windowText: string;
};

type SelectedOptionTag = {
  name: string;
  label: string;
  value?: string;
  valueLabel: string;
};

type PurchaseChecklistItem = {
  key: string;
  icon: ReactNode;
  ready: boolean;
  title: string;
  text: ReactNode;
};

type BundleInfoView = {
  price: number;
  title: string;
  items: Array<{ name: string; quantity?: number; productId?: number }>;
};

type TrustBadgeView = {
  titleKey: string;
  textKey: string;
  icon: string;
};

type SizeOptionGroupView = ProductOptionGroup | undefined;

export type ProductDetailSummaryProps = {
  addToCartActionLabel: string;
  addToCartBlocked: boolean;
  bundleInfo: BundleInfoView | null;
  bundleSavings: number;
  buyNowBlocked: boolean;
  buyNowBlockedReason: string;
  compareActionLabel: string;
  completeSetItems: Product[];
  decisionChecklist: PurchaseChecklistItem[];
  decreaseQuantityLabel: string;
  deliveryPromise: DeliveryPromiseView;
  detailProductName: (item: Pick<Product, 'id' | 'name'>) => string;
  displayPrice: number;
  displayedRating: number;
  favoriteActionLabel: string;
  fitConfidenceText: string;
  formatCountdown: (milliseconds: number) => string;
  formatMoney: (amount?: number | null) => string;
  handleAddRecommendationToCart: (event: React.MouseEvent<HTMLElement>, item: Product) => void | Promise<void>;
  handleAddToCart: () => void | Promise<void>;
  handleBuyNow: () => void | Promise<void>;
  handleCompare: () => void;
  handleFavorite: () => void | Promise<void>;
  handleQuantityChange: (next: number) => void;
  handleStockAlert: () => void;
  hasCompleteOptions: boolean;
  hasUnavailableSelectedVariant: boolean;
  homeActionLabel: string;
  increaseQuantityLabel: string;
  isAlerted: boolean;
  isCompared: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isWishlisted: boolean;
  language: string;
  limitedTimePromoActive: boolean;
  limitedTimeRemaining: number;
  lowStockCount: number | null;
  lowStockUrgencyLabel: string;
  mobileAddToCartBlocked: boolean;
  mobileBuybarPrice: string;
  mobileBuybarStatus: string;
  mobileCartBlockedReason: string;
  navigate: NavigateFunction;
  optionGroups: ProductOptionGroup[];
  optionsSectionRef: MutableRefObject<HTMLDivElement | null>;
  originalReferencePrice?: number;
  priceSavingsAmount: number;
  priceSavingsPercent: number;
  product: Product;
  productFreeShippingText: ReactNode;
  productName: string;
  productShippingText: ReactNode;
  purchaseMode: 'once' | 'bundle';
  purchaseModeActionLabel: string;
  purchaseModeLabel: string;
  purchaseReadinessItems: PurchaseChecklistItem[];
  purchaseSavings: number;
  purchaseSelectionBlocked: boolean;
  purchaseSubmitting: 'cart' | 'buy' | null;
  purchaseSubtotal: number;
  quantity: number;
  quantityValueLabel: string;
  recommendationAddingId: number | null;
  recommendedPathText: ReactNode;
  recommendedPathTitle: string;
  recommendedPurchaseMode: 'once' | 'bundle';
  recommendedSize: string | null;
  recommendedSizeLabel: string;
  recommendedSizeValue?: string;
  renderProductDetailAmountText: (label: string, amount: string) => ReactNode;
  resetSelectedOptionsActionLabel: string;
  selectOptionValue: (groupName: string, value: string) => void;
  selectedOptionTags: SelectedOptionTag[];
  selectedOptions: Record<string, string>;
  selectedStock?: number;
  selectedVariant?: ProductVariant | null;
  setPurchaseMode: Dispatch<SetStateAction<'once' | 'bundle'>>;
  setSelectedOptions: Dispatch<SetStateAction<Record<string, string>>>;
  setSizeCalculatorBreed: Dispatch<SetStateAction<string>>;
  setSizeCalculatorWeight: Dispatch<SetStateAction<string>>;
  setSizeGuideOpen: Dispatch<SetStateAction<boolean>>;
  shouldShowDecisionChecklist: boolean;
  sizeBreedInputLabel: string;
  sizeCalculatorBreed: string;
  sizeCalculatorWeight: string;
  sizeGuideActionLabel: string;
  sizeOptionGroup: SizeOptionGroupView;
  sizeWeightInputLabel: string;
  stockAlertActionLabel: string;
  stockLabel: string | number;
  t: (key: string, params?: Record<string, string | number>) => string;
  trustBadges: TrustBadgeView[];
  useRecommendedPathActionLabel: string;
  variants: ProductVariant[];
};

/**
 * Commercial product-detail purchase summary:
 * price/trust signals, mobile buybar, option selection, quantity/mode,
 * readiness checklist, primary purchase actions, and service disclosures.
 */
export const ProductDetailSummary: React.FC<ProductDetailSummaryProps> = ({
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
  detailProductName,
  displayPrice,
  displayedRating,
  favoriteActionLabel,
  fitConfidenceText,
  formatCountdown,
  formatMoney,
  handleAddRecommendationToCart,
  handleAddToCart,
  handleBuyNow,
  handleCompare,
  handleFavorite,
  handleQuantityChange,
  handleStockAlert,
  hasCompleteOptions,
  hasUnavailableSelectedVariant,
  homeActionLabel,
  increaseQuantityLabel,
  isAlerted,
  isCompared,
  isLowStock,
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
  navigate,
  optionGroups,
  optionsSectionRef,
  originalReferencePrice,
  priceSavingsAmount,
  priceSavingsPercent,
  product,
  productFreeShippingText,
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
  recommendationAddingId,
  recommendedPathText,
  recommendedPathTitle,
  recommendedPurchaseMode,
  recommendedSize,
  recommendedSizeLabel,
  recommendedSizeValue,
  renderProductDetailAmountText,
  resetSelectedOptionsActionLabel,
  selectOptionValue,
  selectedOptionTags,
  selectedOptions,
  selectedStock,
  selectedVariant,
  setPurchaseMode,
  setSelectedOptions,
  setSizeCalculatorBreed,
  setSizeCalculatorWeight,
  setSizeGuideOpen,
  shouldShowDecisionChecklist,
  sizeBreedInputLabel,
  sizeCalculatorBreed,
  sizeCalculatorWeight,
  sizeGuideActionLabel,
  sizeOptionGroup,
  sizeWeightInputLabel,
  stockAlertActionLabel,
  stockLabel,
  t,
  trustBadges,
  useRecommendedPathActionLabel,
  variants,
}) => (
  <>
          {/* Product purchase summary */}
          <div className="product-detail__summary">
            <section className="product-summary-card" aria-label={productName}>
              <div className="product-summary-space">
                <div className="product-title-block">
                  <h1 className="product-detail-page__title">{productName}</h1>
                  {product.brand && (
                    <span className="product-detail-page__text product-detail-page__text--secondary product-brand-text">{t('pages.productDetail.brand')}: {product.brand}</span>
                  )}
                </div>

                <div className="product-price-panel">
                  <div className="product-rating-row">
                    <ShopRate
                      disabled
                      allowHalf
                      value={displayedRating}
                      ariaLabel={`${displayedRating.toFixed(1)} ${t('pages.productDetail.rating')}`}
                    />
                    <span className="product-detail-page__text">{displayedRating.toFixed(1)} {t('pages.productDetail.rating')}</span>
                  </div>
                  <div className="product-price-line">
                    <span className="product-price-line__current commerce-money">{formatMoney(displayPrice)}</span>
                    {originalReferencePrice ? (
                      <span className="product-detail-page__text product-detail-page__text--delete product-price-line__original commerce-money">
                        {formatMoney(originalReferencePrice)}
                      </span>
                    ) : null}
                    {priceSavingsPercent > 0 && (
                      <ShopTag color="gold" className="product-price-line__discount">
                        {t('pages.productDetail.savePercent', { defaultValue: 'Save {percent}%', percent: priceSavingsPercent })}
                      </ShopTag>
                    )}
                  </div>
                  <div className="product-price-delivery">
                    <span><ShopIcon path={SI.truck} /> {deliveryPromise.enabled ? t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText }) : productShippingText}</span>
                    <span><ShopIcon path={SI.checkCircle} /> {productFreeShippingText}</span>
                  </div>
                  <div
                    className="product-mobile-promo"
                    role={limitedTimePromoActive ? 'status' : undefined}
                    aria-live={limitedTimePromoActive ? 'polite' : undefined}
                    aria-atomic={limitedTimePromoActive ? 'true' : undefined}
                  >
                    <span>{limitedTimePromoActive ? t('pages.productDetail.limitedTimeCountdown') : productFreeShippingText}</span>
                    <strong>{limitedTimePromoActive ? formatCountdown(limitedTimeRemaining) : t('pages.productDetail.authentic')}</strong>
                  </div>

	                  <div className="product-compact-signals">
	                    <span className={isLowStock ? 'product-detail__stockMeta product-detail__stockMeta--low' : 'product-detail__stockMeta'}>
                      {t('pages.productDetail.stock')}: {stockLabel}
                      {isLowStock ? <ShopTag color="orange">{lowStockUrgencyLabel}</ShopTag> : null}
                    </span>
	                    {priceSavingsAmount > 0 ? <span>{t('pages.productDetail.purchaseSavings')}: <span className="commerce-money">{formatMoney(priceSavingsAmount * quantity)}</span></span> : null}
	                  </div>
	                </div>

                <ProductDetailMobileBuyBar
                  buyNowBlocked={buyNowBlocked}
                  buyNowBlockedReason={buyNowBlockedReason}
                  compareActionLabel={compareActionLabel}
                  favoriteActionLabel={favoriteActionLabel}
                  handleAddToCart={handleAddToCart}
                  handleBuyNow={handleBuyNow}
                  handleCompare={handleCompare}
                  handleFavorite={handleFavorite}
                  handleStockAlert={handleStockAlert}
                  homeActionLabel={homeActionLabel}
                  isAlerted={isAlerted}
                  isCompared={isCompared}
                  isOutOfStock={isOutOfStock}
                  isWishlisted={isWishlisted}
                  mobileAddToCartBlocked={mobileAddToCartBlocked}
                  mobileBuybarPrice={mobileBuybarPrice}
                  mobileBuybarStatus={mobileBuybarStatus}
                  mobileCartBlockedReason={mobileCartBlockedReason}
                  navigate={navigate}
                  purchaseSelectionBlocked={purchaseSelectionBlocked}
                  purchaseSubmitting={purchaseSubmitting}
                  stockAlertActionLabel={stockAlertActionLabel}
                  t={t}
                />

	                <div className="product-purchase-readiness" role="list" aria-label={t('pages.productDetail.decisionTitle')}>
	                  {purchaseReadinessItems.map((item) => (
                    <div
                      key={item.key}
                      role="listitem"
                      className={`product-purchase-readiness__item${item.ready ? ' product-purchase-readiness__item--ready' : ' product-purchase-readiness__item--pending'}`}
                    >
                      <span className="product-purchase-readiness__icon">{item.icon}</span>
                      <span className="product-purchase-readiness__copy">
                        <span className="product-detail-page__text product-detail-page__text--strong">{item.title}</span>
                        <span className="product-detail-page__text product-detail-page__text--secondary">{item.text}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  ref={optionsSectionRef}
                  className={purchaseSelectionBlocked ? 'product-options-anchor product-options-anchor--attention' : 'product-options-anchor'}
                >
                  {optionGroups.map((group) => {
                    const optionGroupLabel = `${getLocalizedOptionLabel(group.name, language)}: ${productName}`;
                    return (
                      <div key={group.name} role="group" aria-label={optionGroupLabel} title={optionGroupLabel}>
                        <div className="product-option-header">
                          <span className="product-detail-page__text product-detail-page__text--strong">{getLocalizedOptionLabel(group.name, language)}</span>
                          {isSizeOptionName(group.name) ? (
                            <ShopButton
                              size="small"
                              type="link"
                              aria-label={sizeGuideActionLabel}
                              title={sizeGuideActionLabel}
                              onClick={() => setSizeGuideOpen(true)}
                            >
                              {t('pages.productDetail.sizeGuide')}
                            </ShopButton>
                          ) : null}
                        </div>
                        <div
                          className="product-option-radio"
                          role="radiogroup"
                          aria-label={optionGroupLabel}
                        >
                          {group.values.map((value) => {
                            const disabled = !optionValueIsCompatible(variants, selectedOptions, group.name, value);
                            const selected = selectedOptions[group.name] === value;
                            const optionLabel = getLocalizedOptionLabel(value, language);
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                className={`product-option-radio__option${selected ? ' product-option-radio__option--selected' : ''}${disabled ? ' product-option-radio__option--disabled' : ''}`}
                                aria-checked={selected}
                                aria-label={optionLabel}
                                title={optionLabel}
                                disabled={disabled}
                                onClick={() => {
                                  if (!disabled) selectOptionValue(group.name, value);
                                }}
                              >
                                {selected ? <ShopIcon path={SI.checkCircle} className="product-option-radio__check" /> : null}
                                <span>{optionLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {optionGroups.length > 0 && (
                  <div className={`product-selected-summary${hasUnavailableSelectedVariant ? ' product-selected-summary--warning' : ''}`}>
                    <div className="product-selected-summary__header">
                      <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.selectedOptionsTitle')}</span>
                      <div className="product-detail__chipRow">
                        <span className={`product-detail-page__text ${hasUnavailableSelectedVariant ? 'product-detail-page__text--danger' : 'product-detail-page__text--secondary'}`}>
                          {hasUnavailableSelectedVariant
                            ? t('pages.productDetail.selectedVariantUnavailable')
                            : hasCompleteOptions
                              ? t('pages.productDetail.selectedVariantStock', { stock: stockLabel })
                              : t('pages.productDetail.selectedOptionsEmpty')}
                        </span>
                        {selectedOptionTags.length > 0 ? (
                          <ShopButton
                            size="small"
                            type="link"
                            aria-label={resetSelectedOptionsActionLabel}
                            title={resetSelectedOptionsActionLabel}
                            onClick={() => setSelectedOptions({})}
                          >
                            {t('pages.productList.resetFilters')}
                          </ShopButton>
                        ) : null}
                      </div>
                    </div>
                    <div className="product-detail__chipRow">
                      {selectedOptionTags.length > 0 ? selectedOptionTags.map((item) => (
                        <ShopTag key={item.name}>{item.label}: {item.valueLabel}</ShopTag>
                      )) : (
                        <ShopTag>{t('pages.productDetail.selectedOptionsEmpty')}</ShopTag>
                      )}
                      {selectedVariant?.sku ? <ShopTag>{t('pages.productDetail.selectedVariantSku', { sku: selectedVariant.sku })}</ShopTag> : null}
                      {hasCompleteOptions && !hasUnavailableSelectedVariant ? (
                        <ShopTag color="green">{renderProductDetailAmountText(t('pages.productDetail.selectedVariantPrice', { price: formatMoney(displayPrice) }), formatMoney(displayPrice))}</ShopTag>
                      ) : null}
                    </div>
                  </div>
                )}

                {sizeOptionGroup ? (
                  <details className="product-detail-disclosure">
                    <summary>
                      <span>{t('pages.productDetail.sizeCalculatorTitle')}</span>
                      <span className="product-detail-page__text product-detail-page__text--secondary">{fitConfidenceText}</span>
                    </summary>
                    <div className="product-size-calculator">
                    <div className="product-size-calculator__header">
                      <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.sizeCalculatorTitle')}</span>
                      <ShopButton
                        size="small"
                        type="link"
                        aria-label={sizeGuideActionLabel}
                        title={sizeGuideActionLabel}
                        onClick={() => setSizeGuideOpen(true)}
                      >
                        {t('pages.productDetail.sizeGuide')}
                      </ShopButton>
                    </div>
                    <div className="product-size-calculator__inputs">
                      <ShopInput
                        value={sizeCalculatorBreed}
                        onChange={(event) => setSizeCalculatorBreed(event.target.value)}
                        placeholder={t('pages.productDetail.sizeCalculatorBreed')}
                        aria-label={sizeBreedInputLabel}
                        title={sizeBreedInputLabel}
                      />
                      <ShopInput
                        value={sizeCalculatorWeight}
                        type="number"
                        min={0}
                        max={PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG}
                        onChange={(event) => setSizeCalculatorWeight(normalizeSizeCalculatorWeight(event.target.value))}
                        placeholder={t('pages.productDetail.sizeCalculatorWeight')}
                        aria-label={sizeWeightInputLabel}
                        title={sizeWeightInputLabel}
                      />
                    </div>
                    {recommendedSize ? (
                      <ShopAlert
                        type={recommendedSizeValue ? 'success' : 'info'}
                        showIcon
                        message={t('pages.productDetail.sizeCalculatorResult', { size: recommendedSizeLabel })}
                        description={recommendedSizeValue
                          ? t('pages.productDetail.sizeCalculatorMatch')
                          : t('pages.productDetail.sizeCalculatorNoMatch')}
                        action={recommendedSizeValue ? (
                          <ShopButton
                            size="small"
                            type="primary"
                            aria-label={`${t('pages.productDetail.sizeCalculatorApply')}: ${recommendedSizeLabel}, ${productName}`}
                            title={`${t('pages.productDetail.sizeCalculatorApply')}: ${recommendedSizeLabel}, ${productName}`}
                            onClick={() => selectOptionValue(sizeOptionGroup.name, recommendedSizeValue)}
                          >
                            {t('pages.productDetail.sizeCalculatorApply')}
                          </ShopButton>
                        ) : undefined}
                      />
                    ) : (
                      <span className="product-detail-page__text product-detail-page__text--secondary">{t('pages.productDetail.sizeCalculatorHint')}</span>
                    )}
                    </div>
                  </details>
                ) : null}

                {bundleInfo ? (
                <div className="product-value-callout">
                  <span className="product-value-callout__icon"><ShopIcon path={SI.thunder} /></span>
                  <div className="product-value-callout__copy">
                    <span className="product-detail-page__text product-detail-page__text--strong">{recommendedPathTitle}</span>
                    <span className="product-detail-page__text product-detail-page__text--secondary">{recommendedPathText}</span>
                  </div>
                  {purchaseMode !== recommendedPurchaseMode ? (
                    <ShopButton
                      size="small"
                      type="primary"
                      aria-label={useRecommendedPathActionLabel}
                      title={useRecommendedPathActionLabel}
                      onClick={() => setPurchaseMode(recommendedPurchaseMode)}
                    >
                      {t('pages.productDetail.useRecommendedPath')}
                    </ShopButton>
                  ) : (
                    <ShopTag color="green">{t('pages.productDetail.decisionReady')}</ShopTag>
                  )}
                </div>
                ) : null}

                {bundleInfo ? (
                  <div className="product-purchase-mode">
                    <ShopSegmented
                      block
                      value={purchaseMode}
                      onChange={(value) => setPurchaseMode(value as 'once' | 'bundle')}
                      ariaLabel={purchaseModeActionLabel}
                      title={purchaseModeActionLabel}
                      options={[
                        { label: t('pages.productDetail.oneTimePurchase'), value: 'once' },
                        { label: t('bundle.bundleDeal'), value: 'bundle' },
                      ]}
                    />
                    {purchaseMode === 'bundle' ? (
                      <div className="product-purchase-mode__details">
                        <div className="product-purchase-mode__summary">
                          <span className="product-detail-page__text product-detail-page__text--strong">{t('bundle.includes')}</span>
                          <div className="product-detail__chipRow">
                            {bundleInfo.items.map((item) => (
                              <ShopTag key={item.name} className="commerce-atomic">{item.name} <span className="commerce-quantity">x{item.quantity || 1}</span></ShopTag>
                            ))}
                          </div>
                          <span className="product-detail-page__text product-detail-page__text--secondary">
                            {bundleSavings > 0
                              ? t('bundle.saveWithBundle', { amount: formatMoney(bundleSavings) })
                              : t('bundle.bundleHint')}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <span className="product-detail-page__text product-detail-page__text--strong product-quantity-label">{t('pages.productDetail.quantity')}</span>
                  <div className="product-quantity-row" role="group" aria-label={t('pages.productDetail.quantity')}>
                    <ShopButton
                      icon={<ShopIcon path={SI.minus} />}
                      aria-label={decreaseQuantityLabel}
                      title={decreaseQuantityLabel}
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1}
                    />
                    <span className="product-quantity__value" role="status" aria-live="polite" aria-label={quantityValueLabel}>
                      {quantity}
                    </span>
                    <ShopButton
                      icon={<ShopIcon path={SI.plus} />}
                      aria-label={increaseQuantityLabel}
                      title={increaseQuantityLabel}
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={selectedStock !== undefined && quantity >= selectedStock}
                    />
                  </div>
                </div>

                <div className="product-purchase-summary">
                  {bundleInfo ? (
                    <div className="product-purchase-summary__line">
                      <span className="product-detail-page__text product-detail-page__text--secondary">{t('pages.productDetail.purchaseMode')}</span>
                      <span className="product-detail-page__text product-detail-page__text--strong">{purchaseModeLabel}</span>
                    </div>
                  ) : null}
                  <div className="product-purchase-summary__line">
                    <span className="product-detail-page__text product-detail-page__text--secondary">{t('pages.productDetail.unitPrice')}</span>
                      <span className="product-detail-page__text commerce-money">{formatMoney(displayPrice)}</span>
                  </div>
                  <div className="product-purchase-summary__line">
                    <span className="product-detail-page__text product-detail-page__text--secondary">{t('pages.productDetail.purchaseQuantity')}</span>
                      <span className="product-detail-page__text commerce-quantity">{quantity}</span>
                  </div>
                  {purchaseSavings > 0 ? (
                    <div className="product-purchase-summary__line product-purchase-summary__line--saving">
                      <span className="product-detail-page__text">{t('pages.productDetail.purchaseSavings')}</span>
                      <span className="product-detail-page__text product-detail-page__text--strong commerce-money">{formatMoney(purchaseSavings)}</span>
                    </div>
                  ) : null}
                  <div className="product-purchase-summary__total">
                    <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.purchaseSubtotal')}</span>
                    <span className="product-detail-page__text product-detail-page__text--strong commerce-money">{formatMoney(purchaseSubtotal)}</span>
                  </div>
                </div>

                <ProductDetailCompleteSet
                  completeSetItems={completeSetItems}
                  detailProductName={detailProductName}
                  formatMoney={formatMoney}
                  handleAddRecommendationToCart={handleAddRecommendationToCart}
                  navigate={navigate}
                  recommendationAddingId={recommendationAddingId}
                  t={t}
                />

                {shouldShowDecisionChecklist ? (
                  <details className="product-detail-disclosure">
                    <summary>
                      <span>{t('pages.productDetail.decisionTitle')}</span>
                      <ShopTag color="orange">{t('pages.productDetail.decisionNeedsReview')}</ShopTag>
                    </summary>
                    <div className="product-conversion-nudges">
                      <div className="product-conversion-nudge">
                        <span className="product-conversion-nudge__icon"><ShopIcon path={SI.safety} /></span>
                        <span>
                          <span className="product-detail-page__text product-detail-page__text--strong">{t('pages.productDetail.fitConfidenceTitle')}</span>
                          <span className="product-detail-page__text product-detail-page__text--secondary">{fitConfidenceText}</span>
                        </span>
                      </div>
                    </div>
                    <div className="product-decision-card">
                      <div className="product-decision-card__grid">
                        {decisionChecklist.map((item) => (
                          <div className={`product-decision-item${item.ready ? ' product-decision-item--ready' : ' product-decision-item--pending'}`} key={item.key}>
                            <span className="product-decision-item__icon">{item.icon}</span>
                            <span>
                              <span className="product-detail-page__text product-detail-page__text--strong">{item.title}</span>
                              <span className="product-detail-page__text product-detail-page__text--secondary">{item.text}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}

                {isLowStock ? (
                  <ShopAlert
                    className="product-detail__lowStockAlert"
                    type="warning"
                    showIcon
                    message={lowStockUrgencyLabel}
                    description={t('pages.productDetail.lowStockUrgencyText', { count: lowStockCount ?? 0 })}
                  />
                ) : null}
                {isOutOfStock && (
                  <div className="product-detail__chipRow">
                    <ShopTag color="red" className="product-detail__soldOutTag">{t('pages.productDetail.soldOut')}</ShopTag>
                    <ShopButton icon={<ShopIcon path={SI.bell} />} aria-label={stockAlertActionLabel} title={stockAlertActionLabel} onClick={handleStockAlert}>
                      {isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                    </ShopButton>
                  </div>
                )}
                <div className="product-actions">
                  <ShopButton
                    type="primary"
                    size="large"
                    icon={<ShopIcon path={SI.cart} />}
                    className={isOutOfStock ? 'product-detail__soldoutButton' : undefined}
                    aria-label={isOutOfStock ? `${t('pages.productDetail.soldOut')}: ${productName}` : addToCartActionLabel}
                    title={isOutOfStock ? `${t('pages.productDetail.soldOut')}: ${productName}` : addToCartActionLabel}
                    onClick={handleAddToCart}
                    loading={purchaseSubmitting === 'cart'}
                    disabled={addToCartBlocked}
                  >
                    {isOutOfStock ? t('pages.productDetail.soldOut') : t('pages.productDetail.addCart')}
                  </ShopButton>
                  <ShopButton
                    type="primary"
                    size="large"
                    icon={<ShopIcon path={SI.thunder} />}
                    className={isOutOfStock ? 'product-detail__soldoutButton' : undefined}
                    aria-label={buyNowBlockedReason}
                    title={buyNowBlockedReason}
                    onClick={handleBuyNow}
                    loading={purchaseSubmitting === 'buy'}
                    disabled={buyNowBlocked}
                    ghost
                  >
                    {t('pages.productDetail.buyNow')}
                  </ShopButton>
                  {isOutOfStock ? (
                    <ShopButton size="large" icon={<ShopIcon path={SI.bell} />} aria-label={stockAlertActionLabel} title={stockAlertActionLabel} onClick={handleStockAlert}>
                      {isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                    </ShopButton>
                  ) : null}
                  <ShopButton size="large" icon={isWishlisted ? <ShopIcon path={SI.heartFill} className="product-detail__wishlistIcon product-detail__wishlistIcon--active" /> : <ShopIcon path={SI.heart} className="product-detail__wishlistIcon" />} aria-label={favoriteActionLabel} title={favoriteActionLabel} onClick={handleFavorite}>
                    {isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
                  </ShopButton>
                  <ShopButton size="large" icon={<ShopIcon path={SI.barChart} />} aria-label={compareActionLabel} title={compareActionLabel} onClick={handleCompare}>
                    {isCompared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}
                  </ShopButton>
                </div>

                <details className="product-detail-disclosure product-detail-disclosure--service">
                  <summary>
                    <span>{t('pages.productDetail.service')}</span>
                    {deliveryPromise.enabled ? <span className="product-detail-page__text product-detail-page__text--secondary">{t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })}</span> : null}
                  </summary>
                  <div className="product-service-list">
                  <div className="product-detail__stack">
                    {deliveryPromise.enabled ? (
                      <div className="product-delivery-promise">
                        <ShopIcon path={SI.truck} className="product-delivery-promise__icon" />
                        <div>
                          <span className="product-detail-page__text product-detail-page__text--strong">
                            {t('pages.productDetail.deliveryPromise', { window: deliveryPromise.windowText })}
                          </span>
                          <span className="product-detail-page__text product-detail-page__text--secondary">
                            {deliveryPromise.shipsToday
                              ? t('pages.productDetail.shipsToday', { cutoff: `${deliveryPromise.cutoffHour}:00` })
                              : t('pages.productDetail.shipsNextBusinessDay')}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {trustBadges.length > 0 ? (
                      <div className="product-trust-grid">
                        {trustBadges.map((badge) => (
                          <div className="product-trust-card" key={badge.titleKey}>
                            <span className="product-trust-card__icon">{renderTrustIcon(badge.icon)}</span>
                            <span>
                              <span className="product-detail-page__text product-detail-page__text--strong">{t(badge.titleKey)}</span>
                              <span className="product-detail-page__text product-detail-page__text--secondary">{t(badge.textKey)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </details>
              </div>
            </section>
          </div>
  </>
);


type ProductDetailSizeGuideModalProps = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  sizeGuideConfirmActionLabel: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial PDP size-guide dialog used from purchase option selection.
 */
export const ProductDetailSizeGuideModal: React.FC<ProductDetailSizeGuideModalProps> = ({
  open,
  setOpen,
  sizeGuideConfirmActionLabel,
  t,
}) => (
  <ShopModal
    title={t('pages.productDetail.sizeGuideTitle')}
    open={open}
    onClose={() => setOpen(false)}
    footer={<ShopButton type="primary" aria-label={sizeGuideConfirmActionLabel} title={sizeGuideConfirmActionLabel} onClick={() => setOpen(false)}>{t('pages.productDetail.sizeGuideGotIt')}</ShopButton>}
    className="profile-mobile-safe-modal product-detail__sizeGuideModal"
    rootClassName="product-detail__sizeGuideModalRoot"
    closeLabel={t('common.close', { defaultValue: 'Close' })}
    ariaLabel={t('pages.productDetail.sizeGuideTitle')}
  >
    <div className="pet-size-guide">
      <div>
        <strong>{t('pages.productDetail.sizeGuideNeck')}</strong>
        <span>{t('pages.productDetail.sizeGuideNeckText')}</span>
      </div>
      <div>
        <strong>{t('pages.productDetail.sizeGuideChest')}</strong>
        <span>{t('pages.productDetail.sizeGuideChestText')}</span>
      </div>
      <div>
        <strong>{t('pages.productDetail.sizeGuideBack')}</strong>
        <span>{t('pages.productDetail.sizeGuideBackText')}</span>
      </div>
    </div>
  </ShopModal>
);
