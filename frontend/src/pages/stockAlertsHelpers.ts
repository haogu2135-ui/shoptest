import type { ProductPublic as Product } from '../types';
import type { StockAlertItem } from '../utils/stockAlerts';
import { needsOptionSelection } from '../utils/productOptions';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';

export type StockAlertsTranslate = (key: string, params?: Record<string, string | number>) => string;

export const stockAlertImageFallback = productImageFallback;
export const resolveStockAlertImage = resolveProductImage;

export const isBackInStock = (product?: Product) => Boolean(product && (product.stock === undefined || product.stock > 0));

export type StockAlertListItem = StockAlertItem & { product?: Product };

export type StockAlertInsights = {
  items: StockAlertListItem[];
  backInStockItems: StockAlertListItem[];
  directAddItems: StockAlertListItem[];
  optionItems: StockAlertListItem[];
  waitingItems: number;
  urgentItems: StockAlertListItem[];
  bestReadyItem?: StockAlertListItem;
};

export const stockAlertProductName = (
  item: { productId: number; productName?: string; product?: Pick<Product, 'id' | 'name'> },
  t: StockAlertsTranslate,
) => (
  (item.product?.name || item.productName || '').trim()
  || t('pages.profile.productFallback', { id: item.product?.id || item.productId })
);

export const deriveStockAlertInsights = (
  alerts: StockAlertItem[],
  products: Record<number, Product>,
): StockAlertInsights => {
  const items = alerts.map((alert) => ({
    ...alert,
    product: products[alert.productId],
  }));
  const backInStockItems = items.filter((item) => isBackInStock(item.product));
  const directAddItems = backInStockItems.filter((item) => item.product && !needsOptionSelection(item.product));
  const optionItems = backInStockItems.filter((item) => item.product && needsOptionSelection(item.product));
  const waitingItems = items.length - backInStockItems.length;
  const urgentItems = backInStockItems.filter((item) => {
    const stock = item.product?.stock;
    return stock !== undefined && stock > 0 && stock <= 5;
  });
  const bestReadyItem = backInStockItems
    .filter((item) => item.product)
    .sort((a, b) => (a.product?.effectivePrice ?? a.product?.price ?? 0) - (b.product?.effectivePrice ?? b.product?.price ?? 0))[0];
  return { items, backInStockItems, directAddItems, optionItems, waitingItems, urgentItems, bestReadyItem };
};

export const maskStaleStockAlertInsights = (insights: StockAlertInsights): StockAlertInsights => ({
  ...insights,
  backInStockItems: [],
  directAddItems: [],
  optionItems: [],
  urgentItems: [],
  waitingItems: insights.items.length,
  bestReadyItem: undefined,
});

export const buildStockAlertAssistantSubtitle = (params: {
  t: StockAlertsTranslate;
  hasStaleProductData: boolean;
  bestReadyItem?: StockAlertListItem;
  productName: (item: StockAlertListItem) => string;
}) => {
  const { t, hasStaleProductData, bestReadyItem, productName } = params;
  if (hasStaleProductData) {
    return t('pages.stockAlerts.staleDataWarning');
  }
  if (bestReadyItem?.product) {
    return t('pages.stockAlerts.assistantSubtitleBest', { name: productName(bestReadyItem) });
  }
  return t('pages.stockAlerts.assistantSubtitle');
};

export type StockAlertNextActionIntent =
  | { kind: 'retry' }
  | { kind: 'add-ready' }
  | { kind: 'resume-options'; productId: number }
  | { kind: 'browse-personalized' };

export type StockAlertNextActionDescriptor = {
  tone: 'stale' | 'ready' | 'options' | 'waiting' | 'browse';
  title: string;
  text: string;
  label: string;
  intent: StockAlertNextActionIntent;
};

/** Pure next-action descriptor for StockAlerts residual modularization. */
export const resolveStockAlertNextActionDescriptor = (params: {
  t: StockAlertsTranslate;
  hasStaleProductData: boolean;
  insights: StockAlertInsights;
  productName: (item: StockAlertListItem) => string;
}): StockAlertNextActionDescriptor => {
  const { t, hasStaleProductData, insights, productName } = params;
  if (hasStaleProductData) {
    return {
      tone: 'stale',
      title: t('pages.stockAlerts.nextActionStaleTitle'),
      text: t('pages.stockAlerts.nextActionStaleText'),
      label: t('common.retry'),
      intent: { kind: 'retry' },
    };
  }
  if (insights.directAddItems.length > 0) {
    return {
      tone: 'ready',
      title: t('pages.stockAlerts.nextActionReadyTitle'),
      text: t('pages.stockAlerts.nextActionReadyText', { count: insights.directAddItems.length }),
      label: t('pages.stockAlerts.addReadyToCart'),
      intent: { kind: 'add-ready' },
    };
  }
  if (insights.optionItems.length > 0) {
    const nextItem = insights.optionItems[0];
    return {
      tone: 'options',
      title: t('pages.stockAlerts.nextActionOptionsTitle'),
      text: t('pages.stockAlerts.nextActionOptionsText', { name: productName(nextItem) }),
      label: t('pages.stockAlerts.selectOptions'),
      intent: { kind: 'resume-options', productId: nextItem.productId },
    };
  }
  if (insights.waitingItems > 0) {
    return {
      tone: 'waiting',
      title: t('pages.stockAlerts.nextActionWaitingTitle'),
      text: t('pages.stockAlerts.nextActionWaitingText', { count: insights.waitingItems }),
      label: t('pages.stockAlerts.browsePersonalized'),
      intent: { kind: 'browse-personalized' },
    };
  }
  return {
    tone: 'browse',
    title: t('pages.stockAlerts.nextActionBrowseTitle'),
    text: t('pages.stockAlerts.nextActionBrowseText'),
    label: t('pages.stockAlerts.browse'),
    intent: { kind: 'browse-personalized' },
  };
};

export const buildStockAlertMobileNextActionStatus = (params: {
  t: StockAlertsTranslate;
  tone: StockAlertNextActionDescriptor['tone'];
  insights: StockAlertInsights;
}) => {
  const { t, tone, insights } = params;
  if (tone === 'ready') {
    return t('pages.stockAlerts.directReady', { count: insights.directAddItems.length });
  }
  if (tone === 'options') {
    return t('pages.stockAlerts.optionReady', { count: insights.optionItems.length });
  }
  if (tone === 'stale') {
    return t('pages.stockAlerts.loadFailed');
  }
  return t('pages.stockAlerts.stillWatchingCount', { count: insights.waitingItems });
};

/** Build a11y / CTA labels for StockAlerts residual modularization. */
export const buildStockAlertsActionLabels = (params: {
  t: StockAlertsTranslate;
  directReadyCount: number;
  nextActionLabel: string;
  nextActionTitle: string;
  alertCount: number;
}) => {
  const { t, directReadyCount, nextActionLabel, nextActionTitle, alertCount } = params;
  return {
    addReadyActionLabel: `${t('pages.stockAlerts.addReadyToCart')}: ${t('pages.stockAlerts.directReady', { count: directReadyCount })}`,
    restockNextActionLabel: `${nextActionLabel}: ${nextActionTitle}`,
    browseStockAlertsActionLabel: `${t('pages.stockAlerts.browse')}: ${t('pages.stockAlerts.title')}`,
    clearStockAlertsActionLabel: `${t('pages.stockAlerts.clear')}: ${alertCount}`,
  };
};

export const buildStockAlertItemActionLabels = (params: {
  t: StockAlertsTranslate;
  productName: string;
  ready: boolean;
  needsSelection: boolean;
}) => {
  const { t, productName, ready, needsSelection } = params;
  const addActionText = ready
    ? needsSelection
      ? t('pages.stockAlerts.selectOptions')
      : t('pages.stockAlerts.addToCart')
    : t('pages.productList.soldOut');
  return {
    addActionText,
    addActionLabel: `${addActionText}: ${productName}`,
    removeActionLabel: `${t('pages.stockAlerts.remove')}: ${productName}`,
    productLinkLabel: `${t('pages.productList.viewDetails')}: ${productName}`,
  };
};

/** Assemble StockAlerts panel prop bag in one pure surface for residual modularization. */
export const buildStockAlertsPanelProps = <T extends Record<string, unknown>>(props: T): T => props;
