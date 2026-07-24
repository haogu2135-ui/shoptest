import React from 'react';
import ShopButton from '../components/ShopButton';
import ShopModal from '../components/ShopModal';
import ShopRate from '../components/ShopRate';
import ShopSelect from '../components/ShopSelect';
import ShopTag from '../components/ShopTag';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { ProductPublic as Product, ProductVariant } from '../types';
import type { Language } from '../i18n';
import { getBundleInfo } from '../utils/bundle';
import { getLocalizedOptionLabel } from '../utils/localizedProductOptions';
import {
  getProductOptionGroups,
  getProductVariants,
  optionValueIsCompatible,
  type ProductOptionGroup,
} from '../utils/productOptions';
import { productImageFallback } from '../utils/productMedia';
import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from '../utils/mediaAssets';
import {
  getDiscountPercent,
  getPrice,
  getSavingsAmount,
  hasReviewSignal,
  isProductSoldOut,
  isQuickAddReady,
  resolveProductPrimaryImage,
  type ProductListTranslate,
} from './productListHelpers';

export type ProductListQuickAddModalProps = {
  formatMoney: (value?: number | null) => string;
  language: Language | string;
  onClose: () => void;
  onOk: () => void | Promise<void>;
  onResetOptions: () => void;
  onSelectOption: (groupName: string, value: string) => void;
  options: Record<string, string>;
  optionGroups: ProductOptionGroup[];
  product: Product | null;
  productName: string;
  submitDisabled: boolean;
  submitting: boolean;
  t: ProductListTranslate;
  variants: ProductVariant[];
  bundleInfo: ReturnType<typeof getBundleInfo>;
  missingOption?: ProductOptionGroup;
  invalidSelection: boolean;
  price: number;
  selectedVariant?: ProductVariant;
};

export type ProductListPreviewModalProps = {
  formatMoney: (value?: number | null) => string;
  onClose: () => void;
  onPrimary: (event: React.MouseEvent, product: Product) => void;
  onStockAlert: (event: React.MouseEvent, product: Product, stockAlerted: boolean) => void;
  onViewDetails: (productId: number) => void;
  onWishlistToggle: (event: React.MouseEvent, product: Product) => void;
  product: Product | null;
  productName: string;
  renderBadges: (product: Product) => Array<{ label: string; color: string }>;
  renderSavingsText: (amount: number) => React.ReactNode;
  stockAlerted: boolean;
  t: ProductListTranslate;
  topCategoryName: string;
  wishlisted: boolean;
};

const ProductListQuickAddOptions: React.FC<{
  language: Language | string;
  onResetOptions: () => void;
  onSelectOption: (groupName: string, value: string) => void;
  optionGroups: ProductOptionGroup[];
  options: Record<string, string>;
  productName: string;
  resetActionLabel: string;
  t: ProductListTranslate;
  variants: ProductVariant[];
}> = ({
  language,
  onResetOptions,
  onSelectOption,
  optionGroups,
  options,
  productName,
  resetActionLabel,
  t,
  variants,
}) => (
  <>
    <span className="product-list__text product-list__text--secondary">{t('pages.productList.quickAddHint')}</span>
    {optionGroups.map((group) => {
      const groupLabel = getLocalizedOptionLabel(group.name, language);
      const quickAddOptionLabel = `${groupLabel}: ${productName || t('pages.productList.quickAdd')}`;
      return (
        <ShopSelect
          key={group.name}
          placeholder={groupLabel}
          value={options[group.name] || undefined}
          ariaLabel={quickAddOptionLabel}
          title={quickAddOptionLabel}
          onChange={(value) => { if (value) onSelectOption(group.name, value); }}
          options={group.values.map((value) => ({
            value,
            label: getLocalizedOptionLabel(value, language),
            disabled: !optionValueIsCompatible(variants, options, group.name, value),
          }))}
          className="product-list__quickAddSelect"
          popupClassName="shop-mobile-popup-layer product-list__quickAddPopup"
          popupZIndex={1100}
        />
      );
    })}
    {Object.keys(options).length > 0 && (
      <ShopButton
        type="link"
        onClick={onResetOptions}
        className="product-list__quickAddReset"
        aria-label={resetActionLabel}
        title={resetActionLabel}
      >
        {t('common.reset')}
      </ShopButton>
    )}
  </>
);

/** Quick-add option/variant modal for product list conversion path. */
export const ProductListQuickAddModal: React.FC<ProductListQuickAddModalProps> = ({
  bundleInfo,
  formatMoney,
  invalidSelection,
  language,
  missingOption,
  onClose,
  onOk,
  onResetOptions,
  onSelectOption,
  optionGroups,
  options,
  price,
  product,
  productName,
  selectedVariant,
  submitDisabled,
  submitting,
  t,
  variants,
}) => {
  const submitActionLabel = `${t('pages.productList.addToCart')}: ${productName || t('pages.productList.quickAdd')}`;
  const resetActionLabel = `${t('common.reset')}: ${productName || t('pages.productList.quickAdd')}`;
  const title = product
    ? t('pages.productList.quickAddTitle', { name: productName })
    : t('pages.productList.quickAdd');

  return (
    <ShopModal
      title={title}
      open={!!product}
      onClose={() => {
        if (submitting) return;
        onClose();
      }}
      onOk={onOk}
      okText={t('pages.productList.addToCart')}
      cancelText={t('common.cancel')}
      okButtonProps={{
        disabled: submitDisabled || submitting,
        loading: submitting,
        'aria-label': submitActionLabel,
        title: submitActionLabel,
      }}
      cancelButtonProps={{
        disabled: submitting,
        'aria-label': `${t('common.cancel')}: ${submitActionLabel}`,
        title: `${t('common.cancel')}: ${submitActionLabel}`,
      }}
      rootClassName="product-list__quickAddModalRoot"
      className="profile-mobile-safe-modal product-list__quickAddModal"
      closeLabel={t('common.close', { defaultValue: 'Close' })}
      ariaLabel={title}
    >
      <div className="product-list__quickAddContent">
        {bundleInfo ? (
          <>
            {optionGroups.length > 0 ? (
              <ProductListQuickAddOptions
                language={language}
                onResetOptions={onResetOptions}
                onSelectOption={onSelectOption}
                optionGroups={optionGroups}
                options={options}
                productName={productName}
                resetActionLabel={resetActionLabel}
                t={t}
                variants={variants}
              />
            ) : null}
            <span className="product-list__text product-list__text--secondary">{t('bundle.includes')}</span>
            <div className="product-list__chipRow">
              {bundleInfo.items.map((item) => (
                <ShopTag key={item.name} className="commerce-atomic">
                  {item.name} <span className="commerce-quantity">x{item.quantity || 1}</span>
                </ShopTag>
              ))}
            </div>
            <span className="product-list__text">
              {t('pages.productList.quickAddPrice')}: <span className="commerce-money">{formatMoney(bundleInfo.price)}</span>
            </span>
          </>
        ) : optionGroups.length > 0 ? (
          <>
            <ProductListQuickAddOptions
              language={language}
              onResetOptions={onResetOptions}
              onSelectOption={onSelectOption}
              optionGroups={optionGroups}
              options={options}
              productName={productName}
              resetActionLabel={resetActionLabel}
              t={t}
              variants={variants}
            />
            {missingOption ? (
              <span className="product-list__text product-list__text--secondary">
                {t('pages.productList.quickAddCompleteOptions', {
                  option: getLocalizedOptionLabel(missingOption.name, language),
                })}
              </span>
            ) : invalidSelection ? (
              <span className="product-list__text product-list__text--danger">
                {t('pages.productList.quickAddUnavailable')}
              </span>
            ) : (
              <span className="product-list__text product-list__text--success">
                {t('pages.productList.quickAddSelectionReady')}
              </span>
            )}
            <span className="product-list__text">
              {t('pages.productList.quickAddPrice')}: <span className="commerce-money">{formatMoney(price)}</span>
            </span>
            {selectedVariant?.stock !== undefined && (
              <span className="product-list__text product-list__text--secondary">
                {t('pages.productDetail.stock')}: {selectedVariant.stock}
              </span>
            )}
          </>
        ) : (
          <span className="product-list__text product-list__text--secondary">
            {t('pages.productList.quickAddNoOptions')}
          </span>
        )}
      </div>
    </ShopModal>
  );
};

/** Lightweight product preview modal for product list discovery. */
export const ProductListPreviewModal: React.FC<ProductListPreviewModalProps> = ({
  formatMoney,
  onClose,
  onPrimary,
  onStockAlert,
  onViewDetails,
  onWishlistToggle,
  product,
  productName,
  renderBadges,
  renderSavingsText,
  stockAlerted,
  t,
  topCategoryName,
  wishlisted,
}) => {
  const primaryLabel = product
    ? isQuickAddReady(product) ? t('pages.productList.quickAdd') : t('pages.productList.chooseOptionsAction')
    : '';
  const primaryActionLabel = product ? `${primaryLabel}: ${productName}` : '';
  const stockAlertActionLabel = product
    ? `${stockAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}: ${productName}`
    : '';
  const viewActionLabel = product ? `${t('pages.productList.viewDetails')}: ${productName}` : '';
  const wishlistActionLabel = product
    ? `${wishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}: ${productName}`
    : '';
  const ratingValue = product ? Math.max(0, Math.min(5, Number(product.averageRating || 0))) : 0;
  const ratingSummary = product
    ? hasReviewSignal(product)
      ? t('pages.productList.positiveRate', {
        rate: Math.round(product.positiveRate || 0).toString(),
        count: product.reviewCount || 0,
      })
      : t('pages.productList.noReviewsYet')
    : '';
  const ratingLabel = product
    ? `${t('pages.productDetail.rating')}: ${ratingValue.toFixed(1)} / 5, ${ratingSummary}`
    : '';

  return (
    <ShopModal
      title={null}
      open={!!product}
      footer={null}
      onClose={onClose}
      width={860}
      rootClassName="product-list__previewModalRoot"
      className="profile-mobile-safe-modal product-list__previewModal"
      closeLabel={t('common.close', { defaultValue: 'Close' })}
      ariaLabel={productName || t('pages.productList.quickPreview')}
    >
      {product ? (
        <div className="product-list__preview">
          <div className="product-list__previewMedia">
            <img
              alt={productName}
              src={getOptimizedImageUrl(resolveProductPrimaryImage(product), 720)}
              srcSet={buildResponsiveImageSrcSet(resolveProductPrimaryImage(product), [360, 520, 720, 960])}
              sizes="(max-width: 720px) 100vw, 420px"
              onError={(event) => {
                if (event.currentTarget.src !== productImageFallback) {
                  event.currentTarget.removeAttribute('srcset');
                  event.currentTarget.src = productImageFallback;
                }
              }}
            />
            {getDiscountPercent(product) > 0 ? (
              <span className="product-list__previewDiscount">
                -{getDiscountPercent(product)}%
              </span>
            ) : null}
          </div>
          <div className="product-list__previewBody">
            <div className="product-list__previewBadges">
              {renderBadges(product).slice(0, 4).map((badge) => (
                <ShopTag key={badge.label} color={badge.color}>{badge.label}</ShopTag>
              ))}
            </div>
            <span className="product-list__text product-list__text--secondary product-list__previewBrand">
              {product.brand || topCategoryName}
            </span>
            <h2>{productName}</h2>
            <div className="product-list__previewRating" aria-label={ratingLabel} title={ratingLabel}>
              <ShopRate
                disabled
                allowHalf
                value={ratingValue}
                ariaLabel={`${Number(ratingValue || 0).toFixed(1)}`}
              />
              <span className="product-list__text product-list__text--secondary">{ratingSummary}</span>
            </div>
            <span className="product-list__text product-list__previewDescription">
              {product.description || t('pages.productList.previewNoDescription')}
            </span>
            <div className="product-list__previewPrice">
              <strong className="commerce-money">{formatMoney(getPrice(product))}</strong>
              {product.originalPrice && product.originalPrice > getPrice(product) ? (
                <span className="product-list__text product-list__text--delete commerce-money">
                  {formatMoney(product.originalPrice)}
                </span>
              ) : null}
            </div>
            <div className="product-list__previewSignals">
              <span>
                {isProductSoldOut(product)
                  ? t('pages.productList.previewSoldOut')
                  : product.stock !== undefined
                    ? t('pages.productList.previewStockReady', { count: product.stock })
                    : t('pages.productList.cardStockReady')}
              </span>
              <span>
                {hasReviewSignal(product)
                  ? t('pages.productList.positiveRate', {
                    rate: Math.round(product.positiveRate || 0).toString(),
                    count: product.reviewCount || 0,
                  })
                  : t('pages.productList.noReviewsYet')}
              </span>
              {getSavingsAmount(product) > 0 ? (
                <span>{renderSavingsText(getSavingsAmount(product))}</span>
              ) : null}
            </div>
            <div className="product-list__previewActions">
              {isProductSoldOut(product) ? (
                <ShopButton
                  icon={<ShopIcon path={SI.bell} />}
                  aria-pressed={stockAlerted}
                  aria-label={stockAlertActionLabel}
                  title={stockAlertActionLabel}
                  onClick={(event) => onStockAlert(event, product, stockAlerted)}
                >
                  {stockAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')}
                </ShopButton>
              ) : (
                <ShopButton
                  type="primary"
                  icon={<ShopIcon path={SI.cart} />}
                  aria-label={primaryActionLabel}
                  title={primaryActionLabel}
                  onClick={(event) => onPrimary(event, product)}
                >
                  {primaryLabel}
                </ShopButton>
              )}
              <ShopButton
                aria-label={viewActionLabel}
                title={viewActionLabel}
                onClick={() => onViewDetails(product.id)}
              >
                {t('pages.productList.viewDetails')}
              </ShopButton>
              <ShopButton
                icon={wishlisted ? <ShopIcon path={SI.heartFill} /> : <ShopIcon path={SI.heart} />}
                aria-pressed={wishlisted}
                aria-label={wishlistActionLabel}
                title={wishlistActionLabel}
                onClick={(event) => onWishlistToggle(event, product)}
              >
                {wishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}
              </ShopButton>
            </div>
          </div>
        </div>
      ) : null}
    </ShopModal>
  );
};

export type ProductListModalsProps = {
  formatMoney: (value?: number | null) => string;
  language: Language | string;
  onClosePreview: () => void;
  onCloseQuickAdd: () => void;
  onPreviewPrimary: (event: React.MouseEvent, product: Product) => void;
  onQuickAddOk: () => void | Promise<void>;
  onResetQuickAddOptions: () => void;
  onSelectQuickAddOption: (groupName: string, value: string) => void;
  onStockAlert: (event: React.MouseEvent, product: Product, stockAlerted: boolean) => void;
  onViewDetails: (productId: number) => void;
  onWishlistToggle: (event: React.MouseEvent, product: Product) => void;
  previewProduct: Product | null;
  previewProductName: string;
  previewStockAlerted: boolean;
  previewWishlisted: boolean;
  quickAddBundleInfo: ReturnType<typeof getBundleInfo>;
  quickAddInvalidSelection: boolean;
  quickAddMissingOption?: ProductOptionGroup;
  quickAddOptionGroups: ProductOptionGroup[];
  quickAddOptions: Record<string, string>;
  quickAddPrice: number;
  quickAddProduct: Product | null;
  quickAddProductName: string;
  quickAddSubmitDisabled: boolean;
  quickAddSubmitting: boolean;
  quickAddVariant?: ProductVariant;
  quickAddVariants: ProductVariant[];
  renderBadges: (product: Product) => Array<{ label: string; color: string }>;
  renderSavingsText: (amount: number) => React.ReactNode;
  t: ProductListTranslate;
  topCategoryName: string;
};

/** Product list conversion modals: quick-add + lightweight preview. */
export const ProductListModals: React.FC<ProductListModalsProps> = (props) => (
  <>
    <ProductListQuickAddModal
      bundleInfo={props.quickAddBundleInfo}
      formatMoney={props.formatMoney}
      invalidSelection={props.quickAddInvalidSelection}
      language={props.language}
      missingOption={props.quickAddMissingOption}
      onClose={props.onCloseQuickAdd}
      onOk={props.onQuickAddOk}
      onResetOptions={props.onResetQuickAddOptions}
      onSelectOption={props.onSelectQuickAddOption}
      optionGroups={props.quickAddOptionGroups}
      options={props.quickAddOptions}
      price={props.quickAddPrice}
      product={props.quickAddProduct}
      productName={props.quickAddProductName}
      selectedVariant={props.quickAddVariant}
      submitDisabled={props.quickAddSubmitDisabled}
      submitting={props.quickAddSubmitting}
      t={props.t}
      variants={props.quickAddVariants}
    />
    <ProductListPreviewModal
      formatMoney={props.formatMoney}
      onClose={props.onClosePreview}
      onPrimary={props.onPreviewPrimary}
      onStockAlert={props.onStockAlert}
      onViewDetails={props.onViewDetails}
      onWishlistToggle={props.onWishlistToggle}
      product={props.previewProduct}
      productName={props.previewProductName}
      renderBadges={props.renderBadges}
      renderSavingsText={props.renderSavingsText}
      stockAlerted={props.previewStockAlerted}
      t={props.t}
      topCategoryName={props.topCategoryName}
      wishlisted={props.previewWishlisted}
    />
  </>
);

/** Derive quick-add presentation state from product + selected options. */
export const deriveProductListQuickAddState = (
  product: Product | null,
  options: Record<string, string>,
) => {
  const optionGroups = getProductOptionGroups(product);
  const variants = getProductVariants(product);
  const bundleInfo = getBundleInfo(product);
  const selectedVariant = variants.length
    ? variants.find((variant) =>
      Object.entries(variant.options || {}).every(([key, value]) => options[key] === value),
    )
    : undefined;
  const price = bundleInfo?.price ?? selectedVariant?.price ?? (product ? getPrice(product) : 0);
  const missingOption = optionGroups.find((group) => !options[group.name]);
  const invalidSelection = variants.length > 0 && !missingOption && !selectedVariant;
  return {
    optionGroups,
    variants,
    bundleInfo,
    selectedVariant,
    price,
    missingOption,
    invalidSelection,
    submitDisabled: Boolean(missingOption || invalidSelection),
  };
};

export default ProductListModals;
