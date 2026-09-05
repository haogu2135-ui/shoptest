import type { ProductPublic as Product } from '../types';
import { getLowStockCount } from '../utils/conversionConfig';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';

export type BrowsingHistoryTranslate = (key: string, params?: Record<string, string | number>) => string;

export type HistoryQuickFilter = 'all' | 'recent' | 'deals' | 'lowStock';

export const fallbackImage = productImageFallback;
export const resolveHistoryImage = resolveProductImage;

export const isDealProduct = (product: Product) => {
  const activePrice = Number(product.effectivePrice ?? product.price ?? 0);
  const originalPrice = Number(product.originalPrice ?? 0);
  return Number(product.discount || product.effectiveDiscountPercent || 0) > 0 || (originalPrice > activePrice && activePrice > 0);
};

export const isPurchasable = (product: Product) =>
  product.stock === undefined || product.stock > 0;

export const historyProductName = (
  product: Pick<Product, 'id' | 'name'>,
  t: BrowsingHistoryTranslate,
) => (product.name || '').trim() || t('pages.profile.productFallback', { id: product.id });

export const buildViewedAtById = (
  recentEntries: Array<{ productId: number; viewedAt: number }>,
) => new Map(recentEntries.map((entry) => [entry.productId, entry.viewedAt]));

export const orderHistoryProducts = (products: Product[], recentIds: number[]) => {
  const productById = new Map(products.map((product) => [product.id, product]));
  return recentIds
    .map((productId) => productById.get(productId))
    .filter(Boolean) as Product[];
};

export type HistoryInsights = {
  viewedToday: number;
  deals: number;
  lowStock: number;
  readyToCart: number;
  topBrand?: string;
  bestRecovery?: Product;
};

export const deriveHistoryInsights = (
  historyProducts: Product[],
  viewedAtById: Map<number, number>,
): HistoryInsights => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let viewedToday = 0;
  let deals = 0;
  let lowStock = 0;
  let readyToCart = 0;
  let bestRecovery: Product | undefined;
  let bestRecoveryScore = Number.NEGATIVE_INFINITY;
  const brandCounts = new Map<string, number>();
  historyProducts.forEach((product) => {
    const viewedAt = Number(viewedAtById.get(product.id) || 0);
    const viewedRecently = viewedAt >= oneDayAgo;
    const deal = isDealProduct(product);
    const hasLowStock = getLowStockCount(product.stock, 1) !== null;
    if (viewedRecently) viewedToday += 1;
    if (deal) deals += 1;
    if (hasLowStock) lowStock += 1;
    if (isPurchasable(product) && !needsOptionSelection(product)) readyToCart += 1;
    if (product.brand) brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
    const score = (viewedRecently ? 28 : 0)
      + (deal ? 24 : 0)
      + (hasLowStock ? 18 : 0)
      + Math.min(Number(product.averageRating || 0), 5) * 5;
    if (score > bestRecoveryScore) {
      bestRecovery = product;
      bestRecoveryScore = score;
    }
  });
  const topBrand = Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { viewedToday, deals, lowStock, readyToCart, topBrand, bestRecovery };
};

export const filterHistoryProducts = (params: {
  historyProducts: Product[];
  keyword: string;
  quickFilter: HistoryQuickFilter;
  viewedAtById: Map<number, number>;
}) => {
  const { historyProducts, keyword, quickFilter, viewedAtById } = params;
  const query = keyword.trim().toLowerCase();
  const keywordMatched = !query ? historyProducts : historyProducts.filter((product) =>
    [product.name, product.brand, product.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
  if (quickFilter === 'recent') {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return keywordMatched.filter((product) => Number(viewedAtById.get(product.id) || 0) >= oneDayAgo);
  }
  if (quickFilter === 'deals') {
    return keywordMatched.filter(isDealProduct);
  }
  if (quickFilter === 'lowStock') {
    return keywordMatched.filter((product) => getLowStockCount(product.stock, 1) !== null);
  }
  return keywordMatched;
};

export const formatHistoryViewedAt = (
  value: number | undefined,
  language: string,
  t: BrowsingHistoryTranslate,
) => {
  if (!value) return t('pages.browsingHistory.unknownTime');
  return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export type HistoryNextActionIntent =
  | { kind: 'browse-personalized' }
  | { kind: 'retry' }
  | { kind: 'add-best'; productId: number }
  | { kind: 'resume-product'; productId: number }
  | { kind: 'filter-low-stock' };

export type HistoryNextActionDescriptor = {
  tone: 'browse' | 'stale' | 'ready' | 'options' | 'urgent';
  title: string;
  text: string;
  label: string;
  intent: HistoryNextActionIntent;
};

/** Pure next-action descriptor for BrowsingHistory residual modularization. */
export const resolveHistoryNextActionDescriptor = (params: {
  t: BrowsingHistoryTranslate;
  hasHistory: boolean;
  loadError: boolean;
  historyInsights: HistoryInsights;
  historyProductName: (product: Pick<Product, 'id' | 'name'>) => string;
}): HistoryNextActionDescriptor => {
  const { t, hasHistory, loadError, historyInsights, historyProductName } = params;
  if (!hasHistory) {
    return {
      tone: 'browse',
      title: t('pages.browsingHistory.nextActionBrowseTitle'),
      text: t('pages.browsingHistory.nextActionBrowseText'),
      label: t('pages.browsingHistory.browsePersonalized'),
      intent: { kind: 'browse-personalized' },
    };
  }
  if (loadError) {
    return {
      tone: 'stale',
      title: t('pages.browsingHistory.nextActionStaleTitle'),
      text: t('pages.browsingHistory.nextActionStaleText'),
      label: t('messages.retry'),
      intent: { kind: 'retry' },
    };
  }
  if (historyInsights.bestRecovery && isPurchasable(historyInsights.bestRecovery) && !needsOptionSelection(historyInsights.bestRecovery)) {
    const productName = historyProductName(historyInsights.bestRecovery);
    return {
      tone: 'ready',
      title: t('pages.browsingHistory.nextActionAddTitle'),
      text: t('pages.browsingHistory.nextActionAddText', { name: productName }),
      label: t('pages.browsingHistory.addBestToCart'),
      intent: { kind: 'add-best', productId: historyInsights.bestRecovery.id },
    };
  }
  if (historyInsights.bestRecovery && needsOptionSelection(historyInsights.bestRecovery)) {
    const productName = historyProductName(historyInsights.bestRecovery);
    return {
      tone: 'options',
      title: t('pages.browsingHistory.nextActionOptionsTitle'),
      text: t('pages.browsingHistory.nextActionOptionsText', { name: productName }),
      label: t('pages.browsingHistory.resumeProduct'),
      intent: { kind: 'resume-product', productId: historyInsights.bestRecovery.id },
    };
  }
  if (historyInsights.lowStock > 0) {
    return {
      tone: 'urgent',
      title: t('pages.browsingHistory.nextActionLowStockTitle'),
      text: t('pages.browsingHistory.nextActionLowStockText', { count: historyInsights.lowStock }),
      label: t('pages.browsingHistory.filterLowStock'),
      intent: { kind: 'filter-low-stock' },
    };
  }
  return {
    tone: 'browse',
    title: t('pages.browsingHistory.nextActionBrowseTitle'),
    text: t('pages.browsingHistory.nextActionBrowseText'),
    label: t('pages.browsingHistory.browsePersonalized'),
    intent: { kind: 'browse-personalized' },
  };
};

/** Build a11y / CTA labels for BrowsingHistory residual modularization. */
export const buildBrowsingHistoryActionLabels = (params: {
  t: BrowsingHistoryTranslate;
  recentCount: number;
  nextActionLabel: string;
  nextActionTitle: string;
  filteredCount: number;
  historyCount: number;
}) => {
  const { t, recentCount, nextActionLabel, nextActionTitle, filteredCount, historyCount } = params;
  return {
    clearHistoryActionLabel: `${t('pages.browsingHistory.clear')}: ${recentCount}`,
    historyBrowseActionLabel: t('pages.browsingHistory.browse'),
    historyNextActionLabel: `${nextActionLabel}: ${nextActionTitle}`,
    resetHistoryFiltersLabel: `${t('pages.productList.resetFilters')}: ${filteredCount} / ${historyCount}`,
  };
};

export const buildBrowsingHistoryItemActionLabels = (params: {
  t: BrowsingHistoryTranslate;
  productName: string;
  productNeedsOptions: boolean;
}) => {
  const { t, productName, productNeedsOptions } = params;
  return {
    addActionLabel: `${t('pages.browsingHistory.addToCart')}: ${productName}`,
    viewActionLabel: `${productNeedsOptions ? t('pages.browsingHistory.resumeProduct') : t('pages.browsingHistory.viewProduct')}: ${productName}`,
    deleteActionLabel: `${t('common.delete')}: ${productName}`,
  };
};

/** Assemble BrowsingHistory panel prop bag in one pure surface for residual modularization. */
export const buildBrowsingHistoryPanelProps = <T extends Record<string, unknown>>(props: T): T => props;
