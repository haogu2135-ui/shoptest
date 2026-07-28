import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import ShopSearchField from '../components/ShopSearchField';
import ShopSelect from '../components/ShopSelect';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import type { ProductPublic as Product } from '../types';
import { productImageFallback } from '../utils/productMedia';
import { getOptimizedImageUrl } from '../utils/mediaAssets';
import { getLowStockCount } from '../utils/conversionConfig';
import {
  MAX_SEARCH_LENGTH,
  getPrice,
  getSavingsAmount,
  isQuickAddReady,
  resolveProductPrimaryImage,
  type ActiveResultContextAction,
  type ProductFetchFilters,
  type ProductListTranslate,
} from './productListHelpers';
import {
  ProductListEmptyPanel,
  ProductListFilterDrawer,
  ProductListLoadRecoveryPanel,
  ProductListLoadingPanel,
  ProductListResultsGrid,
  type ProductListDiscoveryAction,
} from './productListPanels';
import {
  ProductListModals,
  type ProductListModalsProps,
} from './productListModals';

export type ProductListShellAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  primary?: boolean;
  onClick: () => void;
};

export type ProductListInsightSummary = {
  quickAddReadyCount: number;
  bestValueCount: number;
  lowStockCount: number;
  averageSavings: number;
};

export type ProductListMainShellProps = {
  language: string;
  loading: boolean;
  loadFailed: boolean;
  filteredProducts: Product[];
  quickAddProduct: Product | null;
  previewProduct: Product | null;
  filterDrawerOpen: boolean;
  t: ProductListTranslate;
  selectedCategoryName?: string;
  categoryPanel: React.ReactNode;
  filterPanel: React.ReactNode;
  activeFilterCount: number;
  resetFilters: () => void;
  topCategoryName: string;
  catalogHeroTitle: string;
  collection?: string;
  collectionLabel: string;
  resultContextTags: Array<{ key: string; label: string; color: string }>;
  productCountLabel: string;
  productListInsights: ProductListInsightSummary;
  heroProduct: Product | null;
  heroProductName: string;
  heroProductHighlights: Array<string | undefined>;
  prefetchProduct: (productId: number) => void;
  openProductDetail: (productId: number) => void;
  formatMoney: (value?: number | null) => string;
  renderBadges: ProductListModalsProps['renderBadges'];
  keyword: string;
  setKeyword: React.Dispatch<React.SetStateAction<string>>;
  handleSearch: (value: string) => void;
  handleSearchTermKeyDown: (event: React.KeyboardEvent<HTMLElement>, term: string) => void;
  productSearchActionLabel: string;
  sortBy: string;
  applySort: (value: string) => void;
  sortOptions: Array<{ value: string; label: string }>;
  currentSortLabel: string;
  openFilterDrawerActionLabel: string;
  openMobileFilterDrawer: () => void;
  activeRefinementCount: number;
  activeResultContextActions: ActiveResultContextAction[];
  resetCatalogView: () => void;
  searchHistory: string[];
  clearSearchHistory: () => void;
  mobileDiscoveryActions: ProductListShellAction[];
  mobileNextStepTitle: string;
  mobileNextStepText: string;
  mobileNextStepActions: ProductListShellAction[];
  mobileHeroSignal: string;
  mobilePrimaryActionLabel: string;
  mobileSecondaryActionLabel: string;
  shopBestDealsActionLabel: string;
  shopQuickAddActionLabel: string;
  openQuickAdd: (event: React.MouseEvent, product: Product) => void;
  usingCatalogSnapshot: boolean;
  refreshCatalogActionLabel: string;
  fetchProducts: (keyword?: string, categoryId?: number, discount?: boolean, filters?: ProductFetchFilters) => void;
  categoryId?: number;
  discount: boolean;
  buildActiveFetchFilters: (page: number) => ProductFetchFilters;
  currentPage: number;
  checkoutPathProducts: Product[];
  checkoutPathReadyCount: number;
  productListGuideText: string;
  renderProductAmountText: (label: string, amount: string) => React.ReactNode;
  productListProductName: (product: Product) => string;
  emptyDiscoveryActions: ProductListDiscoveryAction[];
  allCategoriesRecoveryActionLabel: string;
  couponsRecoveryActionLabel: string;
  navigate: NavigateFunction;
  openSupport: () => void;
  supportRecoveryActionLabel: string;
  emptyAllCategoriesActionLabel: string;
  emptyCouponsActionLabel: string;
  emptyPetFinderActionLabel: string;
  emptyResetFiltersActionLabel: string;
  paginatedProducts: Product[];
  alertedStockProductIds: Set<number>;
  handleCompare: (event: React.MouseEvent, product: Product) => void;
  handleProductPageChange: (page: number) => void;
  handleStockAlert: (event: React.MouseEvent, product: Product, stockAlerted: boolean) => void;
  handleWishlistToggle: (event: React.MouseEvent, product: Product) => void;
  isProductCompared: (productId: number) => boolean;
  openProductPreview: (event: React.MouseEvent, product: Product) => void;
  pageSize: number;
  productCountForUi: number;
  renderSavingsText: (amount: number) => React.ReactNode;
  wishlistedProductIds: Set<number>;
  applyRefinementsActionLabel: string;
  resetMobileRefinements: () => void;
  resetRefinementsActionLabel: string;
  setFilterDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showBackToTop: boolean;
  backToTopActionLabel: string;
  handleBackToTop: () => void;
  setPreviewProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  setQuickAddProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  submitQuickAdd: () => void | Promise<void>;
  setQuickAddOptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectQuickAddOption: (groupName: string, value: string) => void;
  previewProductName: string;
  previewProductStockAlerted: boolean;
  previewProductWishlisted: boolean;
  quickAddBundleInfo: ProductListModalsProps['quickAddBundleInfo'];
  quickAddInvalidSelection: boolean;
  quickAddMissingOption: ProductListModalsProps['quickAddMissingOption'];
  quickAddOptionGroups: ProductListModalsProps['quickAddOptionGroups'];
  quickAddOptions: Record<string, string>;
  quickAddPrice: number;
  quickAddProductName: string;
  quickAddSubmitDisabled: boolean;
  quickAddSubmitting: boolean;
  quickAddVariant: ProductListModalsProps['quickAddVariant'];
  quickAddVariants: ProductListModalsProps['quickAddVariants'];
  showMobileFilterHint: boolean;
  dismissMobileFilterHint: () => void;
};

/** Catalog layout shell: breadcrumb, sidebar, hero, toolbar, conversion rails, results composition, drawer, modals. */
export const ProductListMainShell: React.FC<ProductListMainShellProps> = ({
language,
  loading,
  loadFailed,
  filteredProducts,
  quickAddProduct,
  previewProduct,
  filterDrawerOpen,
  t,
  selectedCategoryName,
  categoryPanel,
  filterPanel,
  activeFilterCount,
  resetFilters,
  topCategoryName,
  catalogHeroTitle,
  collection,
  collectionLabel,
  resultContextTags,
  productCountLabel,
  productListInsights,
  heroProduct,
  heroProductName,
  heroProductHighlights,
  prefetchProduct,
  openProductDetail,
  formatMoney,
  renderBadges,
  keyword,
  setKeyword,
  handleSearch,
  handleSearchTermKeyDown,
  productSearchActionLabel,
  sortBy,
  applySort,
  sortOptions,
  currentSortLabel,
  openFilterDrawerActionLabel,
  openMobileFilterDrawer,
  activeRefinementCount,
  activeResultContextActions,
  resetCatalogView,
  searchHistory,
  clearSearchHistory,
  mobileDiscoveryActions,
  mobileNextStepTitle,
  mobileNextStepText,
  mobileNextStepActions,
  mobileHeroSignal,
  mobilePrimaryActionLabel,
  mobileSecondaryActionLabel,
  shopBestDealsActionLabel,
  shopQuickAddActionLabel,
  openQuickAdd,
  usingCatalogSnapshot,
  refreshCatalogActionLabel,
  fetchProducts,
  categoryId,
  discount,
  buildActiveFetchFilters,
  currentPage,
  checkoutPathProducts,
  checkoutPathReadyCount,
  productListGuideText,
  renderProductAmountText,
  productListProductName,
  emptyDiscoveryActions,
  allCategoriesRecoveryActionLabel,
  couponsRecoveryActionLabel,
  navigate,
  openSupport,
  supportRecoveryActionLabel,
  emptyAllCategoriesActionLabel,
  emptyCouponsActionLabel,
  emptyPetFinderActionLabel,
  emptyResetFiltersActionLabel,
  paginatedProducts,
  alertedStockProductIds,
  handleCompare,
  handleProductPageChange,
  handleStockAlert,
  handleWishlistToggle,
  isProductCompared,
  openProductPreview,
  pageSize,
  productCountForUi,
  renderSavingsText,
  wishlistedProductIds,
  applyRefinementsActionLabel,
  resetMobileRefinements,
  resetRefinementsActionLabel,
  setFilterDrawerOpen,
  showBackToTop,
  backToTopActionLabel,
  handleBackToTop,
  setPreviewProduct,
  setQuickAddProduct,
  submitQuickAdd,
  setQuickAddOptions,
  selectQuickAddOption,
  previewProductName,
  previewProductStockAlerted,
  previewProductWishlisted,
  quickAddBundleInfo,
  quickAddInvalidSelection,
  quickAddMissingOption,
  quickAddOptionGroups,
  quickAddOptions,
  quickAddPrice,
  quickAddProductName,
  quickAddSubmitDisabled,
  quickAddSubmitting,
  quickAddVariant,
  quickAddVariants,
  showMobileFilterHint,
  dismissMobileFilterHint,
}) => (

    <div className={`product-list product-list--${language}${!loading && !loadFailed && filteredProducts.length === 0 ? ' product-list--empty' : ''}${quickAddProduct ? ' product-list--quickAddOpen' : ''}${previewProduct ? ' product-list--previewOpen' : ''}${filterDrawerOpen ? ' product-list--filterDrawerOpen' : ''}`}>
      <ShopBreadcrumb
        ariaLabel={t('pages.productList.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          {
            key: 'products',
            label: t('pages.productList.title'),
            path: selectedCategoryName ? '/products' : undefined,
          },
          ...(selectedCategoryName
            ? [{ key: 'category', label: selectedCategoryName }]
            : []),
        ]}
      />
      <div className="product-list__layout">
        <aside className="product-list__sidebar">
          <section className="product-list__sidebarCard product-list__panel" aria-label={t('pages.productList.sidebarTitle')}>
            <div className="product-list__panelHead">
              <h2 className="product-list__panelTitle">{t('pages.productList.sidebarTitle')}</h2>
            </div>
            <div className="product-list__panelBody">
              {categoryPanel}
            </div>
          </section>
          <section className="product-list__sidebarCard product-list__panel" aria-label={t('pages.productList.filters')}>
            <div className="product-list__panelHead">
              <div className="product-list__inlineRow">
                <h2 className="product-list__panelTitle">{t('pages.productList.filters')}</h2>
                {activeFilterCount > 0 ? <ShopTag color="blue">{t('pages.productList.activeFilters', { count: activeFilterCount })}</ShopTag> : null}
              </div>
              <ShopButton type="link" size="small" disabled={activeFilterCount === 0} onClick={resetFilters}>
                {t('pages.productList.resetFilters')}
              </ShopButton>
            </div>
            <div className="product-list__panelBody">
              {filterPanel}
            </div>
          </section>
        </aside>
        <div className="product-list__main">
          <section className="product-list__heroBand">
            <div className="product-list__heroContent">
              <span className="product-list__heroEyebrow">{topCategoryName}</span>
              <h1>{catalogHeroTitle}</h1>
              <span className="product-list__text">
                {collection
                  ? `${t('pages.productList.resultContextLabel')}: ${collectionLabel}`
                  : resultContextTags.length > 0
                    ? resultContextTags.map((tag) => tag.label).join(' / ')
                    : t('pages.productList.searchPlaceholder')}
              </span>
              <div className="product-list__heroStats">
                <span>{productCountLabel}</span>
                <span>{t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}</span>
                <span>{t('pages.productList.bestValueCount', { count: productListInsights.bestValueCount })}</span>
              </div>
            </div>
            {heroProduct ? (
              <button
                type="button"
                className="product-list__heroCard"
                onMouseEnter={() => prefetchProduct(heroProduct.id)}
                onFocus={() => prefetchProduct(heroProduct.id)}
                onClick={() => openProductDetail(heroProduct.id)}
                aria-label={`${t('pages.productList.viewPick')}: ${heroProductName}`}
                title={`${t('pages.productList.viewPick')}: ${heroProductName}`}
              >
                <strong>{heroProductName}</strong>
                <span className="product-list__text commerce-money">{formatMoney(getPrice(heroProduct))}</span>
                <span>{renderBadges(heroProduct).slice(0, 2).map((badge) => badge.label).join(' / ') || t('pages.productList.viewPick')}</span>
                {heroProductHighlights.filter(Boolean).length ? (
                  <div className="product-list__heroHighlights">
                    {heroProductHighlights.filter((item): item is string => Boolean(item)).map((item) => (
                      <small key={item}>{item}</small>
                    ))}
                  </div>
                ) : null}
              </button>
            ) : null}
          </section>
          <section className="product-list__toolbar product-list__panel" aria-label={t('pages.productList.searchPlaceholder')}>
            <div className="product-list__panelBody product-list__toolbarBody">
            <div className="product-list__toolbarRow">
              <div className="product-list__toolbarSearch">
                <ShopSearchField
                  className="product-list__search"
                  placeholder={t('pages.productList.searchPlaceholder')}
                  ariaLabel={productSearchActionLabel}
                  title={productSearchActionLabel}
                  submitLabel={productSearchActionLabel}
                  value={keyword}
                  maxLength={MAX_SEARCH_LENGTH}
                  onChange={(value) => setKeyword(value.slice(0, MAX_SEARCH_LENGTH))}
                  onSearch={handleSearch}
                  allowClear
                />
              </div>
              <div className="product-list__toolbarSort">
                <ShopSelect
                  value={sortBy}
                  onChange={(value) => applySort(value || 'default')}
                  className="product-list__sortSelect"
                  ariaLabel={`${t('pages.productList.defaultSort')}: ${currentSortLabel}`}
                  title={`${t('pages.productList.defaultSort')}: ${currentSortLabel}`}
                  options={sortOptions}
                  popupClassName="shop-mobile-popup-layer"
                  popupZIndex={1100}
                />
              </div>
              <div className="product-list__toolbarMetaWrap">
                <div className="product-list__toolbarMeta">
                  <span className="product-list__text product-list__text--secondary">{productCountLabel}</span>
                  <div className="product-list__filterControl">
                    <ShopButton className="product-list__filterButton" icon={<ShopIcon path={SI.filter} />} aria-label={openFilterDrawerActionLabel} title={openFilterDrawerActionLabel} onClick={openMobileFilterDrawer}>
                      <span>{t('pages.productList.filters')}</span>
                      {activeRefinementCount > 0 ? (
                        <span className="product-list__filterCount">{activeRefinementCount > 99 ? '99+' : activeRefinementCount}</span>
                      ) : null}
                    </ShopButton>
                    {showMobileFilterHint && activeRefinementCount === 0 ? (
                      <div className="product-list__filterHint" role="status" aria-live="polite" data-product-list-filter-hint="true">
                        <span className="product-list__filterHintText">{t('pages.productList.mobileFilterHint')}</span>
                        <button
                          type="button"
                          className="product-list__filterHintDismiss"
                          onClick={dismissMobileFilterHint}
                          aria-label={t('pages.productList.mobileFilterHintDismiss')}
                          title={t('pages.productList.mobileFilterHintDismiss')}
                        >
                          {t('pages.productList.mobileFilterHintDismiss')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {activeResultContextActions.length > 0 ? (
              <section className="product-list__activeContextBar product-list__mobileContextBar" aria-label={t('pages.productList.resultContextLabel')}>
                {activeResultContextActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="product-list__activeContextChip product-list__mobileContextChip"
                    onClick={action.onClear}
                    aria-label={`${t('common.reset')}: ${action.label}`}
                    title={`${t('common.reset')}: ${action.label}`}
                  >
                    <span className="product-list__mobileContextIcon">{action.icon}</span>
                    <span>{action.label}</span>
                    <ShopIcon path={SI.close} className="product-list__mobileContextClose" aria-hidden  />
                  </button>
                ))}
                <ShopButton
                  type="link"
                  size="small"
                  className="product-list__activeContextReset"
                  aria-label={`${t('pages.productList.resetFilters')}: ${t('pages.productList.resultContextLabel')}`}
                  title={`${t('pages.productList.resetFilters')}: ${t('pages.productList.resultContextLabel')}`}
                  onClick={resetCatalogView}
                >
                  {t('pages.productList.resetFilters')}
                </ShopButton>
              </section>
            ) : null}
            {searchHistory.length > 0 && (
              <div className="product-list__recentSearches">
                <span className="product-list__text product-list__text--secondary">{t('pages.productList.recentSearches')}</span>
                {searchHistory.map((term) => (
                  <ShopTag
                    key={term}
                    className="product-list__recentSearchTag"
                    role="button"
                    tabIndex={0}
                    aria-label={`${t('common.search')}: ${term}`}
                    title={`${t('common.search')}: ${term}`}
                    onClick={() => handleSearch(term)}
                    onKeyDown={(event) => handleSearchTermKeyDown(event, term)}
                  >
                    {term}
                  </ShopTag>
                ))}
                <ShopButton type="link" size="small" aria-label={`${t('pages.productList.clearSearches')}: ${t('pages.productList.recentSearches')}`} title={`${t('pages.productList.clearSearches')}: ${t('pages.productList.recentSearches')}`} onClick={clearSearchHistory}>
                  {t('pages.productList.clearSearches')}
                </ShopButton>
              </div>
            )}
          </div>
          </section>
          <section className="product-list__mobileDiscovery" aria-label={t('home.categories')}>
            {mobileDiscoveryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={action.active ? 'product-list__mobileDiscoveryButton product-list__mobileDiscoveryButton--active' : 'product-list__mobileDiscoveryButton'}
                aria-pressed={action.active}
                aria-label={`${action.label}: ${t('home.categories')}`}
                title={`${action.label}: ${t('home.categories')}`}
                onClick={action.onClick}
              >
                <span className="product-list__mobileDiscoveryIcon">{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </section>
          {!loading && !loadFailed ? (
            <section
              className={`product-list__mobileNextStep${filteredProducts.length === 0 ? ' product-list__mobileNextStep--empty' : ''}`}
              aria-label={t('pages.productList.guideTitle')}
            >
              <div className="product-list__mobileNextStepCopy">
                <span>{t('pages.productList.guideTitle')}</span>
                <strong>{mobileNextStepTitle}</strong>
                <span className="product-list__text">{mobileNextStepText}</span>
              </div>
              <div className="product-list__mobileNextStepActions">
                {mobileNextStepActions.map((action) => (
                  <ShopButton
                    key={action.key}
                    size="small"
                    type={action.primary ? 'primary' : 'default'}
                    icon={action.icon}
                    aria-label={`${action.label}: ${mobileNextStepTitle}`}
                    title={`${action.label}: ${mobileNextStepTitle}`}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </ShopButton>
                ))}
              </div>
            </section>
          ) : null}
          {!loading && !loadFailed ? (
            <section
              className={`product-list__mobileConversionBar${filteredProducts.length === 0 ? ' product-list__mobileConversionBar--empty' : ''}`}
              aria-label={t('pages.productList.insightTitle')}
            >
              <div className="product-list__mobileConversionStats">
                <span className="product-list__mobileConversionEyebrow">{t('pages.productList.viewPick')}</span>
                <strong>{heroProduct?.name || productCountLabel}</strong>
                <span>
                  {activeRefinementCount > 0
                    ? t('pages.productList.activeFilters', { count: activeRefinementCount })
                    : mobileHeroSignal || t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}
                </span>
              </div>
              <div className="product-list__mobileConversionActions">
                <ShopButton icon={<ShopIcon path={SI.filter} />} aria-label={openFilterDrawerActionLabel} title={openFilterDrawerActionLabel} onClick={openMobileFilterDrawer}>
                  {t('pages.productList.filters')}
                </ShopButton>
                <ShopButton aria-label={mobileSecondaryActionLabel} title={mobileSecondaryActionLabel} onClick={filteredProducts.length > 0 ? () => applySort('discount-desc') : activeRefinementCount > 0 ? resetMobileRefinements : () => navigate('/products')}>
                  {filteredProducts.length > 0
                    ? t('pages.productList.shopBestDeals')
                    : activeRefinementCount > 0
                      ? t('pages.productList.resetFilters')
                      : t('pages.productList.allCategories')}
                </ShopButton>
                <ShopButton
                  type="primary"
                  icon={heroProduct || filteredProducts.length > 0 ? <ShopIcon path={SI.cart} /> : <ShopIcon path={SI.gift} />}
                  aria-label={mobilePrimaryActionLabel}
                  title={mobilePrimaryActionLabel}
                  onClick={(event) => {
                    if (heroProduct) {
                      if (isQuickAddReady(heroProduct)) {
                        openQuickAdd(event, heroProduct);
                        return;
                      }
                      openProductDetail(heroProduct.id);
                      return;
                    }
                    if (filteredProducts.length > 0) {
                      applySort('quick-add-desc');
                      return;
                    }
                    navigate('/coupons');
                  }}
                >
                  {heroProduct
                    ? !isQuickAddReady(heroProduct)
                    ? t('pages.productList.chooseOptionsAction')
                      : t('pages.productList.addToCart')
                    : filteredProducts.length > 0
                      ? t('pages.productList.shopQuickAdd')
                      : t('pages.productList.loadRecoveryCoupons')}
                </ShopButton>
              </div>
            </section>
          ) : null}
          {!loading && !loadFailed && filteredProducts.length > 0 ? (
            <>
              {usingCatalogSnapshot ? (
                <section className="product-list__snapshotNotice" role="status" aria-live="polite">
                  <div>
                    <span className="product-list__text product-list__text--strong">{t('pages.productList.snapshotTitle')}</span>
                    <span className="product-list__text product-list__text--secondary">{t('pages.productList.snapshotText')}</span>
                  </div>
                  <ShopButton
                    size="small"
                    icon={<ShopIcon path={SI.reload} />}
                    aria-label={refreshCatalogActionLabel}
                    title={refreshCatalogActionLabel}
                    onClick={() => fetchProducts(keyword, categoryId, discount, buildActiveFetchFilters(Math.max(0, currentPage - 1)))}
                  >
                    {t('common.refresh')}
                  </ShopButton>
                </section>
              ) : null}
              <section className="product-list__smartBar" aria-label={t('pages.productList.insightTitle')}>
                <div className="product-list__smartBarLeft">
                  <ShopIcon path={SI.check} />
                  <span className="product-list__text product-list__text--strong">{t('pages.productList.insightTitle')}</span>
                  <div className="product-list__smartStats">
                    <ShopTag className="product-list__smartStat product-list__smartStat--ready">
                      {t('pages.productList.quickAddReady', { count: productListInsights.quickAddReadyCount })}
                    </ShopTag>
                    <ShopTag className="product-list__smartStat product-list__smartStat--value">
                      {t('pages.productList.bestValueCount', { count: productListInsights.bestValueCount })}
                    </ShopTag>
                  </div>
                </div>
                <div className="product-list__smartActions">
                  {heroProduct ? (
                    <ShopButton
                      className="product-list__smartPick"
                      onMouseEnter={() => prefetchProduct(heroProduct.id)}
                      onFocus={() => prefetchProduct(heroProduct.id)}
                      aria-label={`${t('pages.productList.viewPick')}: ${heroProductName}`}
                      title={`${t('pages.productList.viewPick')}: ${heroProductName}`}
                      onClick={() => openProductDetail(heroProduct.id)}
                    >
                      <span>{t('pages.productList.viewPick')}</span>
                      <strong>{heroProductName}</strong>
                    </ShopButton>
                  ) : null}
                  <ShopButton className="product-list__smartAction" aria-label={shopBestDealsActionLabel} title={shopBestDealsActionLabel} onClick={() => applySort('discount-desc')}>
                    {t('pages.productList.shopBestDeals')}
                  </ShopButton>
                  <ShopButton className="product-list__smartPersonal" aria-label={shopQuickAddActionLabel} title={shopQuickAddActionLabel} onClick={() => applySort('quick-add-desc')}>
                    {t('pages.productList.shopQuickAdd')}
                  </ShopButton>
                </div>
              </section>
              <section className="product-list__insightPanel" aria-label={t('pages.productList.guideTitle')}>
                <div className="product-list__insightCopy">
                  <span>{t('pages.productList.guideTitle')}</span>
                  <strong>{topCategoryName}</strong>
                  <span className="product-list__text">{productListGuideText}</span>
                </div>
                <div className="product-list__insightMetrics">
                  <span>{renderProductAmountText(t('pages.productList.averageSavings', { amount: formatMoney(productListInsights.averageSavings) }), formatMoney(productListInsights.averageSavings))}</span>
                  <span>{t('pages.productList.lowStockCount', { count: productListInsights.lowStockCount })}</span>
                  {activeFilterCount > 0 ? (
                    <ShopButton type="link" aria-label={resetRefinementsActionLabel} title={resetRefinementsActionLabel} onClick={resetFilters}>{t('pages.productList.resetFilters')}</ShopButton>
                  ) : (
                    <ShopButton type="link" aria-label={`${t('pages.productList.shopTopRated')}: ${topCategoryName}`} title={`${t('pages.productList.shopTopRated')}: ${topCategoryName}`} onClick={() => applySort('positive-rate-desc')}>{t('pages.productList.shopTopRated')}</ShopButton>
                  )}
                </div>
              </section>
              {checkoutPathProducts.length > 0 ? (
                <section className="product-list__checkoutPath" aria-label={t('pages.productList.checkoutPathEyebrow')}>
                  <div className="product-list__checkoutPathCopy">
                    <span className="product-list__text product-list__checkoutPathEyebrow">{t('pages.productList.checkoutPathEyebrow')}</span>
                    <strong>{t('pages.productList.checkoutPathTitle')}</strong>
                    <span className="product-list__text">{t('pages.productList.checkoutPathText', { count: checkoutPathProducts.length, ready: checkoutPathReadyCount })}</span>
                  </div>
                  <div className="product-list__checkoutPathItems">
                    {checkoutPathProducts.map((product) => {
                      const productName = productListProductName(product);
                      const quickReady = isQuickAddReady(product);
                      const lowStock = getLowStockCount(product.stock);
                      const tagLabel = quickReady
                        ? t('pages.productList.cardQuickReady')
                        : lowStock !== null
                          ? t('pages.productList.cardLowStock', { count: lowStock })
                          : t('pages.productList.cardOptionsNeeded');
                      const tagColor = quickReady ? 'green' : lowStock !== null ? 'red' : 'blue';
                      const savings = getSavingsAmount(product);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          className="product-list__checkoutPathItem"
                          aria-label={`${t('pages.productList.viewPick')}: ${productName}`}
                          title={`${t('pages.productList.viewPick')}: ${productName}`}
                          onMouseEnter={() => prefetchProduct(product.id)}
                          onFocus={() => prefetchProduct(product.id)}
                          onClick={(event) => {
                            if (quickReady) {
                              openQuickAdd(event, product);
                              return;
                            }
                            openProductDetail(product.id);
                          }}
                        >
                          <img
                            className="product-list__checkoutPathThumb"
                            src={getOptimizedImageUrl(resolveProductPrimaryImage(product), 96)}
                            alt=""
                            width={40}
                            height={40}
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              if (event.currentTarget.src !== productImageFallback) {
                                event.currentTarget.src = productImageFallback;
                              }
                            }}
                          />
                          <span>
                            <strong>{productName}</strong>
                            <small className="commerce-atomic">
                              <span className="commerce-money">{formatMoney(getPrice(product))}</span>
                              {savings > 0 ? <span> - {renderSavingsText(savings)}</span> : null}
                            </small>
                          </span>
                          <ShopTag color={tagColor}>{tagLabel}</ShopTag>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
          {loading ? (
            <ProductListLoadingPanel t={t} />
          ) : loadFailed ? (
            <ProductListLoadRecoveryPanel
              allCategoriesRecoveryActionLabel={allCategoriesRecoveryActionLabel}
              couponsRecoveryActionLabel={couponsRecoveryActionLabel}
              discoveryActions={emptyDiscoveryActions}
              navigate={navigate}
              onRetry={() => fetchProducts(keyword, categoryId, discount, buildActiveFetchFilters(Math.max(0, currentPage - 1)))}
              openSupport={openSupport}
              refreshCatalogActionLabel={refreshCatalogActionLabel}
              supportRecoveryActionLabel={supportRecoveryActionLabel}
              t={t}
            />
          ) : paginatedProducts.length === 0 ? (
            <ProductListEmptyPanel
              activeFilterCount={activeFilterCount}
              categoryId={categoryId}
              collection={collection}
              discoveryActions={emptyDiscoveryActions}
              emptyAllCategoriesActionLabel={emptyAllCategoriesActionLabel}
              emptyCouponsActionLabel={emptyCouponsActionLabel}
              emptyPetFinderActionLabel={emptyPetFinderActionLabel}
              emptyResetFiltersActionLabel={emptyResetFiltersActionLabel}
              keyword={keyword}
              navigate={navigate}
              openSupport={openSupport}
              resetFilters={resetFilters}
              supportRecoveryActionLabel={supportRecoveryActionLabel}
              t={t}
            />
          ) : (
            <ProductListResultsGrid
              alertedStockProductIds={alertedStockProductIds}
              currentPage={currentPage}
              formatMoney={formatMoney}
              handleCompare={handleCompare}
              handleProductPageChange={handleProductPageChange}
              handleStockAlert={handleStockAlert}
              handleWishlistToggle={handleWishlistToggle}
              isProductCompared={isProductCompared}
              openProductPreview={openProductPreview}
              openQuickAdd={openQuickAdd}
              pageSize={pageSize}
              paginatedProducts={paginatedProducts}
              prefetchProduct={prefetchProduct}
              productCountForUi={productCountForUi}
              productListProductName={productListProductName}
              renderSavingsText={renderSavingsText}
              t={t}
              wishlistedProductIds={wishlistedProductIds}
            />
          )}
        </div>
      </div>
      <ProductListFilterDrawer
        activeRefinementCount={activeRefinementCount}
        applyRefinementsActionLabel={applyRefinementsActionLabel}
        categoryPanel={categoryPanel}
        filterDrawerOpen={filterDrawerOpen}
        filterPanel={filterPanel}
        productCountLabel={productCountLabel}
        resetMobileRefinements={resetMobileRefinements}
        resetRefinementsActionLabel={resetRefinementsActionLabel}
        setFilterDrawerOpen={setFilterDrawerOpen}
        t={t}
      />
      {showBackToTop ? (
        <ShopButton
          type="primary"
          shape="circle"
          size="large"
          icon={<ShopIcon path={SI.arrowUp} />}
          className="product-list__backToTop"
          aria-label={backToTopActionLabel}
          title={backToTopActionLabel}
          onClick={handleBackToTop}
        />
      ) : null}
      <ProductListModals
        formatMoney={formatMoney}
        language={language}
        onClosePreview={() => setPreviewProduct(null)}
        onCloseQuickAdd={() => setQuickAddProduct(null)}
        onPreviewPrimary={(event, product) => {
          openQuickAdd(event, product);
          setPreviewProduct(null);
        }}
        onQuickAddOk={submitQuickAdd}
        onResetQuickAddOptions={() => setQuickAddOptions({})}
        onSelectQuickAddOption={selectQuickAddOption}
        onStockAlert={handleStockAlert}
        onViewDetails={openProductDetail}
        onWishlistToggle={handleWishlistToggle}
        previewProduct={previewProduct}
        previewProductName={previewProductName}
        previewStockAlerted={previewProductStockAlerted}
        previewWishlisted={previewProductWishlisted}
        quickAddBundleInfo={quickAddBundleInfo}
        quickAddInvalidSelection={quickAddInvalidSelection}
        quickAddMissingOption={quickAddMissingOption}
        quickAddOptionGroups={quickAddOptionGroups}
        quickAddOptions={quickAddOptions}
        quickAddPrice={quickAddPrice}
        quickAddProduct={quickAddProduct}
        quickAddProductName={quickAddProductName}
        quickAddSubmitDisabled={quickAddSubmitDisabled}
        quickAddSubmitting={quickAddSubmitting}
        quickAddVariant={quickAddVariant}
        quickAddVariants={quickAddVariants}
        renderBadges={renderBadges}
        renderSavingsText={renderSavingsText}
        t={t}
        topCategoryName={topCategoryName}
      />
    </div>
);
