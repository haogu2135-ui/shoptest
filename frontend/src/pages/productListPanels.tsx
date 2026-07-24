import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopButton from '../components/ShopButton';
import ShopCheckbox, { ShopCheckboxGroup } from '../components/ShopCheckbox';
import ShopDrawer from '../components/ShopDrawer';
import ShopPagination from '../components/ShopPagination';
import ShopRangeSlider from '../components/ShopRangeSlider';
import ShopTag from '../components/ShopTag';
import { ShopIcon, SI } from '../components/ShopIcon';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import { ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';
import type { CategoryPublic, ProductPublic as Product } from '../types';
import { ProductListCard } from './productListCard';
import type { ProductListTranslate } from './productListHelpers';

export type ProductListDiscoveryAction = {
  key: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  ariaLabel: string;
  primary?: boolean;
  onClick: () => void;
};

export type ProductListCategoryRow = {
  id: number;
  title: string;
};

export type ProductListFilterOption = {
  value: string;
  label: string;
  swatch?: string;
};

/** Shared category stack for desktop sidebar and mobile filter drawer. */
export const ProductListCategoryPanel: React.FC<{
  allCategoriesLabel: string;
  categoryDepthById: Map<number, number>;
  categoryId?: number;
  categoryRows: ProductListCategoryRow[];
  onCategoryChange: (categoryId?: number) => void;
  t: ProductListTranslate;
}> = ({
  allCategoriesLabel,
  categoryDepthById,
  categoryId,
  categoryRows,
  onCategoryChange,
  t,
}) => (
  <div className="product-list__categoryStack">
    <ShopButton
      type={!categoryId ? 'primary' : 'text'}
      block
      aria-pressed={!categoryId}
      aria-label={allCategoriesLabel || t('pages.productList.allCategories')}
      title={allCategoriesLabel || t('pages.productList.allCategories')}
      onClick={() => onCategoryChange(undefined)}
      className="product-list__categoryButton"
    >
      {t('pages.productList.allCategories')}
    </ShopButton>
    {categoryRows.map((cat) => {
      const selected = categoryId === cat.id;
      return (
        <ShopButton
          key={cat.id}
          type={selected ? 'primary' : 'text'}
          block
          aria-pressed={selected}
          aria-label={cat.title}
          title={cat.title}
          onClick={() => onCategoryChange(cat.id)}
          className="product-list__categoryButton"
          style={{ paddingLeft: 12 + ((categoryDepthById.get(cat.id) || 1) - 1) * 14 }}
        >
          {cat.title}
        </ShopButton>
      );
    })}
  </div>
);

/** Shared refinement controls for desktop sidebar and mobile filter drawer. */
export const ProductListFilterPanel: React.FC<{
  colors: string[];
  colorOptions: ProductListFilterOption[];
  commitPriceRange: (value: [number, number]) => void;
  displayedPriceRange: [number, number];
  formatMoney: (value?: number | null) => string;
  materials: string[];
  materialOptions: ProductListFilterOption[];
  maxCatalogPrice: number;
  petSizeOptions: ProductListFilterOption[];
  petSizes: string[];
  priceStep: number;
  setCurrentPage: (page: number) => void;
  setPriceFilterTouched: (touched: boolean) => void;
  setPriceRange: (value: [number, number]) => void;
  t: ProductListTranslate;
  updateColors: (values: string[]) => void;
  updateMaterials: (values: string[]) => void;
  updatePetSizes: (values: string[]) => void;
}> = ({
  colors,
  colorOptions,
  commitPriceRange,
  displayedPriceRange,
  formatMoney,
  materials,
  materialOptions,
  maxCatalogPrice,
  petSizeOptions,
  petSizes,
  priceStep,
  setCurrentPage,
  setPriceFilterTouched,
  setPriceRange,
  t,
  updateColors,
  updateMaterials,
  updatePetSizes,
}) => (
  <div className="product-list__filterStack">
    <div>
      <span className="product-list__text product-list__text--strong">{t('pages.productList.price')}</span>
      <ShopRangeSlider
        className="product-list__priceSlider"
        min={0}
        max={maxCatalogPrice}
        step={priceStep}
        value={displayedPriceRange}
        ariaLabelForHandle={[
          `${t('pages.productList.price')} ${formatMoney(displayedPriceRange[0])}`,
          `${t('pages.productList.price')} ${formatMoney(displayedPriceRange[1])}`,
        ]}
        onChange={(value) => {
          setPriceFilterTouched(true);
          setPriceRange(value);
          setCurrentPage(1);
        }}
        onChangeComplete={(value) => commitPriceRange(value)}
      />
      <span className="product-list__text product-list__text--secondary commerce-atomic">{formatMoney(displayedPriceRange[0])} - {formatMoney(displayedPriceRange[1])}</span>
    </div>
    <div>
      <span className="product-list__text product-list__text--strong product-list__filterLabel">{t('pages.productList.filterSize')}</span>
      <ShopCheckboxGroup
        value={petSizes}
        aria-label={`${t('pages.productList.filterSize')}: ${t('pages.productList.filters')}`}
        onChange={(value) => updatePetSizes(value.map(String))}
        options={petSizeOptions}
      />
    </div>
    <div>
      <span className="product-list__text product-list__text--strong product-list__filterLabel">{t('pages.productList.filterMaterial')}</span>
      <ShopCheckboxGroup
        value={materials}
        aria-label={`${t('pages.productList.filterMaterial')}: ${t('pages.productList.filters')}`}
        onChange={(value) => updateMaterials(value.map(String))}
        options={materialOptions}
      />
    </div>
    <div>
      <span className="product-list__text product-list__text--strong product-list__filterLabel">{t('pages.productList.filterColor')}</span>
      <ShopCheckboxGroup
        value={colors}
        aria-label={`${t('pages.productList.filterColor')}: ${t('pages.productList.filters')}`}
        onChange={(value) => updateColors(value.map(String))}
      >
        {colorOptions.map((option) => (
          <ShopCheckbox key={option.value} value={option.value} aria-label={option.label}>
            <span className="product-list__colorOption">
              <span
                className="product-list__colorSwatch"
                style={{ backgroundColor: option.swatch }}
                aria-hidden="true"
                data-color-value={option.value}
              />
              <span className="product-list__colorName">{option.label}</span>
            </span>
          </ShopCheckbox>
        ))}
      </ShopCheckboxGroup>
    </div>
  </div>
);

/** Multipath recovery cards for empty/load-failed catalog states. */
export const ProductListDiscoveryActions: React.FC<{
  actions: ProductListDiscoveryAction[];
  t: ProductListTranslate;
}> = ({ actions, t }) => (
  <div className="product-list__emptyDiscovery" aria-label={t('pages.productList.guideTitle')}>
    {actions.map((action) => (
      <button
        key={action.key}
        type="button"
        className={`product-list__emptyDiscoveryCard${action.primary ? ' product-list__emptyDiscoveryCard--primary' : ''}`}
        aria-label={action.ariaLabel}
        title={action.ariaLabel}
        onClick={action.onClick}
      >
        <span className="product-list__emptyDiscoveryIcon">{action.icon}</span>
        <span>
          <strong>{action.title}</strong>
          <small>{action.text}</small>
        </span>
      </button>
    ))}
  </div>
);

export const ProductListLoadingPanel: React.FC<{ t: ProductListTranslate }> = ({ t }) => (
  <div className="product-list__loading" role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
    <StatsStripSkeleton cols={3} />
    <div className="product-list__loadingGrid">
      <ProductCardSkeleton count={12} />
    </div>
  </div>
);

export const ProductListLoadRecoveryPanel: React.FC<{
  allCategoriesRecoveryActionLabel: string;
  couponsRecoveryActionLabel: string;
  discoveryActions: ProductListDiscoveryAction[];
  onRetry: () => void;
  openSupport: () => void;
  refreshCatalogActionLabel: string;
  supportRecoveryActionLabel: string;
  t: ProductListTranslate;
  navigate: NavigateFunction;
}> = ({
  allCategoriesRecoveryActionLabel,
  couponsRecoveryActionLabel,
  discoveryActions,
  onRetry,
  openSupport,
  refreshCatalogActionLabel,
  supportRecoveryActionLabel,
  t,
  navigate,
}) => (
  <div className="product-list__loadFailed" data-product-list-load-recovery="true">
    <PageError
      className="product-list__loadError"
      title={t('pages.productList.fetchFailed')}
      description={(
        <div className="product-list__recovery">
          <span className="product-list__text">{t('pages.productList.loadRecoveryText')}</span>
          <div className="product-list__recoveryTips">
            <span>{t('pages.productList.loadRecoveryTipRefresh')}</span>
            <span>{t('pages.productList.loadRecoveryTipFilters')}</span>
            <span>{t('pages.productList.loadRecoveryTipSupport')}</span>
          </div>
        </div>
      )}
      actions={[
        {
          key: 'retry',
          label: refreshCatalogActionLabel,
          onClick: onRetry,
          type: 'primary',
        },
        {
          key: 'all',
          label: allCategoriesRecoveryActionLabel,
          onClick: () => navigate('/products'),
          type: 'default',
        },
        {
          key: 'coupons',
          label: couponsRecoveryActionLabel,
          onClick: () => navigate('/coupons'),
          type: 'default',
        },
        {
          key: 'support',
          label: supportRecoveryActionLabel,
          onClick: openSupport,
          type: 'default',
        },
      ]}
    />
    <div className="product-list__recovery product-list__recovery--secondary">
      <div className="product-list__recoveryGrid">
        <ShopButton icon={<ShopIcon path={SI.gift} />} aria-label={couponsRecoveryActionLabel} title={couponsRecoveryActionLabel} onClick={() => navigate('/coupons')}>
          {t('pages.productList.loadRecoveryCoupons')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.support} />} aria-label={supportRecoveryActionLabel} title={supportRecoveryActionLabel} onClick={openSupport}>
          {t('pages.productList.loadRecoverySupport')}
        </ShopButton>
      </div>
      <ProductListDiscoveryActions actions={discoveryActions} t={t} />
    </div>
  </div>
);

export const ProductListEmptyPanel: React.FC<{
  activeFilterCount: number;
  categoryId?: number;
  collection?: string;
  discoveryActions: ProductListDiscoveryAction[];
  emptyAllCategoriesActionLabel: string;
  emptyCouponsActionLabel: string;
  emptyPetFinderActionLabel: string;
  emptyResetFiltersActionLabel: string;
  keyword: string;
  openSupport: () => void;
  resetFilters: () => void;
  supportRecoveryActionLabel: string;
  t: ProductListTranslate;
  navigate: NavigateFunction;
}> = ({
  activeFilterCount,
  categoryId,
  collection,
  discoveryActions,
  emptyAllCategoriesActionLabel,
  emptyCouponsActionLabel,
  emptyPetFinderActionLabel,
  emptyResetFiltersActionLabel,
  keyword,
  openSupport,
  resetFilters,
  supportRecoveryActionLabel,
  t,
  navigate,
}) => (
  <PageEmpty
    className="product-list__empty"
    data-product-list-empty-actions="true"
    description={(
      <div className="product-list__emptyContent">
        <div>{t('pages.productList.empty')}</div>
        <ProductListDiscoveryActions actions={discoveryActions} t={t} />
      </div>
    )}
    actions={[
      (keyword || categoryId || collection || activeFilterCount > 0)
        ? {
            key: 'reset',
            label: emptyResetFiltersActionLabel,
            onClick: resetFilters,
          }
        : {
            key: 'all',
            label: emptyAllCategoriesActionLabel,
            onClick: () => navigate('/products'),
          },
      {
        key: 'coupons',
        label: emptyCouponsActionLabel,
        onClick: () => navigate('/coupons'),
        type: 'default',
      },
      {
        key: 'pet-finder',
        label: emptyPetFinderActionLabel,
        onClick: () => navigate('/pet-finder'),
        type: 'default',
      },
      {
        key: 'support',
        label: supportRecoveryActionLabel,
        onClick: openSupport,
        type: 'default',
      },
    ]}
  />
);

export const ProductListResultsGrid: React.FC<{
  alertedStockProductIds: Set<number>;
  currentPage: number;
  formatMoney: (value?: number | null) => string;
  handleCompare: (event: React.MouseEvent, product: Product) => void;
  handleProductPageChange: (page: number) => void;
  handleStockAlert: (event: React.MouseEvent, product: Product, stockAlerted: boolean) => void;
  handleWishlistToggle: (event: React.MouseEvent, product: Product) => void;
  openProductPreview: (event: React.MouseEvent, product: Product) => void;
  openQuickAdd: (event: React.MouseEvent, product: Product) => void;
  pageSize: number;
  paginatedProducts: Product[];
  prefetchProduct: (productId: number) => void;
  productCountForUi: number;
  productListProductName: (product: Product) => string;
  renderSavingsText: (amount: number) => React.ReactNode;
  t: ProductListTranslate;
  wishlistedProductIds: Set<number>;
  isProductCompared: (productId: number) => boolean;
}> = ({
  alertedStockProductIds,
  currentPage,
  formatMoney,
  handleCompare,
  handleProductPageChange,
  handleStockAlert,
  handleWishlistToggle,
  openProductPreview,
  openQuickAdd,
  pageSize,
  paginatedProducts,
  prefetchProduct,
  productCountForUi,
  productListProductName,
  renderSavingsText,
  t,
  wishlistedProductIds,
  isProductCompared,
}) => (
  <>
    <div className="product-list__grid">
      {paginatedProducts.map((product, index) => (
        <ProductListCard
          key={product.id}
          product={product}
          index={index}
          currentPage={currentPage}
          productName={productListProductName(product)}
          wishlisted={wishlistedProductIds.has(product.id)}
          stockAlerted={alertedStockProductIds.has(product.id)}
          compared={isProductCompared(product.id)}
          t={t}
          formatMoney={formatMoney}
          renderSavingsText={renderSavingsText}
          onPrefetch={prefetchProduct}
          onPreview={openProductPreview}
          onQuickAdd={openQuickAdd}
          onStockAlert={handleStockAlert}
          onWishlistToggle={handleWishlistToggle}
          onCompare={handleCompare}
        />
      ))}
    </div>
    {productCountForUi > pageSize && (
      <div className="product-list__pagination">
        <ShopPagination
          current={currentPage}
          total={productCountForUi}
          pageSize={pageSize}
          onChange={handleProductPageChange}
          showTotal={(total) => t('pages.productList.count', { count: total })}
          prevLabel={t('common.previousPage')}
          nextLabel={t('common.nextPage')}
          ariaLabel={t('pages.productList.count', { count: productCountForUi })}
        />
      </div>
    )}
  </>
);

export const ProductListFilterDrawer: React.FC<{
  activeRefinementCount: number;
  applyRefinementsActionLabel: string;
  categoryPanel: React.ReactNode;
  filterDrawerOpen: boolean;
  filterPanel: React.ReactNode;
  productCountLabel: string;
  resetMobileRefinements: () => void;
  resetRefinementsActionLabel: string;
  setFilterDrawerOpen: (open: boolean) => void;
  t: ProductListTranslate;
}> = ({
  activeRefinementCount,
  applyRefinementsActionLabel,
  categoryPanel,
  filterDrawerOpen,
  filterPanel,
  productCountLabel,
  resetMobileRefinements,
  resetRefinementsActionLabel,
  setFilterDrawerOpen,
  t,
}) => (
  <ShopDrawer
    open={filterDrawerOpen}
    onClose={() => setFilterDrawerOpen(false)}
    placement="bottom"
    height="82vh"
    rootClassName="product-list__filterDrawerRoot"
    className="profile-mobile-safe-modal product-list__mobileDrawer"
    ariaLabel={t('pages.productList.filters')}
    closeLabel={t('common.close', { defaultValue: 'Close' })}
    title={(
      <div className="product-list__inlineRow">
        <ShopIcon path={SI.filter} />
        <span>{t('pages.productList.filters')}</span>
        {activeRefinementCount > 0 ? <ShopTag color="blue">{t('pages.productList.activeFilters', { count: activeRefinementCount })}</ShopTag> : null}
      </div>
    )}
    extra={(
      <ShopButton type="link" disabled={activeRefinementCount === 0} aria-label={resetRefinementsActionLabel} title={resetRefinementsActionLabel} onClick={resetMobileRefinements}>
        {t('pages.productList.resetFilters')}
      </ShopButton>
    )}
  >
    <div className="product-list__drawerContent">
      <section className="product-list__drawerSummary" aria-live="polite">
        <span>{productCountLabel}</span>
        <strong>
          {activeRefinementCount > 0
            ? t('pages.productList.activeFilters', { count: activeRefinementCount })
            : t('pages.productList.allCategories')}
        </strong>
      </section>
      <div className="product-list__drawerPanels">
        <section className="product-list__panel product-list__drawerPanel" aria-label={t('pages.productList.drawerCategoryTitle')}>
          <div className="product-list__panelHead">
            <h2 className="product-list__panelTitle">{t('pages.productList.drawerCategoryTitle')}</h2>
          </div>
          <div className="product-list__panelBody">
            {categoryPanel}
          </div>
        </section>
        <section className="product-list__panel product-list__drawerPanel" aria-label={t('pages.productList.drawerFilterTitle')}>
          <div className="product-list__panelHead">
            <h2 className="product-list__panelTitle">{t('pages.productList.drawerFilterTitle')}</h2>
          </div>
          <div className="product-list__panelBody">
            {filterPanel}
          </div>
        </section>
      </div>
      <div className="product-list__drawerFooter">
        <ShopButton size="large" disabled={activeRefinementCount === 0} aria-label={resetRefinementsActionLabel} title={resetRefinementsActionLabel} onClick={resetMobileRefinements}>
          {t('pages.productList.resetFilters')}
        </ShopButton>
        <ShopButton type="primary" size="large" aria-label={applyRefinementsActionLabel} title={applyRefinementsActionLabel} onClick={() => setFilterDrawerOpen(false)}>
          {t('pages.productList.applyFilters')}
        </ShopButton>
      </div>
    </div>
  </ShopDrawer>
);
