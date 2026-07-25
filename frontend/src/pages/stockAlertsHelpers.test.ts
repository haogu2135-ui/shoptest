import type { ProductPublic as Product } from '../types';
import type { StockAlertItem } from '../utils/stockAlerts';
import {
  buildStockAlertItemActionLabels,
  buildStockAlertMobileNextActionStatus,
  buildStockAlertsActionLabels,
  deriveStockAlertInsights,
  maskStaleStockAlertInsights,
  resolveStockAlertNextActionDescriptor,
  stockAlertProductName,
  type StockAlertInsights,
  type StockAlertsTranslate,
} from './stockAlertsHelpers';

const t: StockAlertsTranslate = (key, params) => (
  params ? `${key}:${JSON.stringify(params)}` : key
);

const buildProduct = ({ id, ...overrides }: Partial<Product> & Pick<Product, 'id'>): Product => ({
  id,
  name: `Product ${id}`,
  description: '',
  price: 100,
  stock: 10,
  categoryId: 1,
  imageUrl: '',
  ...overrides,
});

const buildAlert = (productId: number): StockAlertItem => ({
  productId,
  productName: `Saved product ${productId}`,
  imageUrl: `/products/${productId}.jpg`,
  createdAt: '2026-07-25T12:00:00.000Z',
});

const emptyInsights = (): StockAlertInsights => ({
  items: [],
  backInStockItems: [],
  directAddItems: [],
  optionItems: [],
  waitingItems: 0,
  urgentItems: [],
  bestReadyItem: undefined,
});

describe('stock alerts insights', () => {
  it('separates direct, option, urgent, sold-out, and unresolved alerts', () => {
    const alerts = [1, 2, 3, 4].map(buildAlert);
    const products = {
      1: buildProduct({ id: 1, price: 80, stock: 3 }),
      2: buildProduct({
        id: 2,
        price: 120,
        effectivePrice: 60,
        optionGroups: [{ name: 'Size', values: ['S', 'M'], options: ['S', 'M'] }],
      }),
      3: buildProduct({ id: 3, price: 40, stock: 0 }),
    };

    const insights = deriveStockAlertInsights(alerts, products);

    expect(insights.items.map((item) => item.productId)).toEqual([1, 2, 3, 4]);
    expect(insights.backInStockItems.map((item) => item.productId)).toEqual([1, 2]);
    expect(insights.directAddItems.map((item) => item.productId)).toEqual([1]);
    expect(insights.optionItems.map((item) => item.productId)).toEqual([2]);
    expect(insights.urgentItems.map((item) => item.productId)).toEqual([1]);
    expect(insights.waitingItems).toBe(2);
    expect(insights.bestReadyItem?.productId).toBe(2);
  });

  it('masks stale product facts without mutating the retained alert list', () => {
    const live = deriveStockAlertInsights(
      [buildAlert(1)],
      { 1: buildProduct({ id: 1, stock: 2 }) },
    );

    const stale = maskStaleStockAlertInsights(live);

    expect(stale.items).toBe(live.items);
    expect(stale.backInStockItems).toEqual([]);
    expect(stale.directAddItems).toEqual([]);
    expect(stale.optionItems).toEqual([]);
    expect(stale.urgentItems).toEqual([]);
    expect(stale.waitingItems).toBe(1);
    expect(stale.bestReadyItem).toBeUndefined();
    expect(live.backInStockItems).toHaveLength(1);
  });
});

describe('stock alerts next action', () => {
  it('prioritizes retry when product data is stale', () => {
    const descriptor = resolveStockAlertNextActionDescriptor({
      t,
      hasStaleProductData: true,
      insights: emptyInsights(),
      productName: () => 'Ignored',
    });

    expect(descriptor.tone).toBe('stale');
    expect(descriptor.intent).toEqual({ kind: 'retry' });
  });

  it('prioritizes direct add before option selection and waiting alerts', () => {
    const directItem = { ...buildAlert(1), product: buildProduct({ id: 1 }) };
    const optionItem = { ...buildAlert(2), product: buildProduct({ id: 2 }) };
    const insights = {
      ...emptyInsights(),
      items: [directItem, optionItem],
      directAddItems: [directItem],
      optionItems: [optionItem],
      waitingItems: 1,
    };

    const descriptor = resolveStockAlertNextActionDescriptor({
      t,
      hasStaleProductData: false,
      insights,
      productName: (item) => item.product?.name || item.productName,
    });

    expect(descriptor.tone).toBe('ready');
    expect(descriptor.intent).toEqual({ kind: 'add-ready' });
    expect(descriptor.text).toContain('"count":1');
  });

  it('resumes the first option product when no direct item is ready', () => {
    const optionItem = { ...buildAlert(7), product: buildProduct({ id: 7, name: 'Harness' }) };
    const descriptor = resolveStockAlertNextActionDescriptor({
      t,
      hasStaleProductData: false,
      insights: { ...emptyInsights(), items: [optionItem], optionItems: [optionItem] },
      productName: (item) => item.product?.name || item.productName,
    });

    expect(descriptor.tone).toBe('options');
    expect(descriptor.intent).toEqual({ kind: 'resume-options', productId: 7 });
    expect(descriptor.text).toContain('Harness');
  });

  it('falls back to personalized browsing for waiting and empty states', () => {
    const waiting = resolveStockAlertNextActionDescriptor({
      t,
      hasStaleProductData: false,
      insights: { ...emptyInsights(), waitingItems: 2 },
      productName: () => '',
    });
    const empty = resolveStockAlertNextActionDescriptor({
      t,
      hasStaleProductData: false,
      insights: emptyInsights(),
      productName: () => '',
    });

    expect(waiting.tone).toBe('waiting');
    expect(waiting.intent).toEqual({ kind: 'browse-personalized' });
    expect(empty.tone).toBe('browse');
    expect(empty.intent).toEqual({ kind: 'browse-personalized' });
  });
});

describe('stock alerts labels', () => {
  it('uses live counts in mobile status and accessible action labels', () => {
    const directItem = { ...buildAlert(1), product: buildProduct({ id: 1 }) };
    const insights = { ...emptyInsights(), directAddItems: [directItem], waitingItems: 3 };

    expect(buildStockAlertMobileNextActionStatus({ t, tone: 'ready', insights }))
      .toContain('"count":1');
    expect(buildStockAlertMobileNextActionStatus({ t, tone: 'waiting', insights }))
      .toContain('"count":3');
    expect(buildStockAlertMobileNextActionStatus({ t, tone: 'stale', insights }))
      .toBe('pages.stockAlerts.loadFailed');

    expect(buildStockAlertsActionLabels({
      t,
      directReadyCount: 1,
      nextActionLabel: 'Add ready',
      nextActionTitle: 'Ready now',
      alertCount: 4,
    })).toEqual({
      addReadyActionLabel: 'pages.stockAlerts.addReadyToCart: pages.stockAlerts.directReady:{"count":1}',
      restockNextActionLabel: 'Add ready: Ready now',
      browseStockAlertsActionLabel: 'pages.stockAlerts.browse: pages.stockAlerts.title',
      clearStockAlertsActionLabel: 'pages.stockAlerts.clear: 4',
    });
  });

  it('builds product-specific labels and a localized fallback name', () => {
    expect(stockAlertProductName({ productId: 9, productName: '  ' }, t))
      .toBe('pages.profile.productFallback:{"id":9}');
    expect(buildStockAlertItemActionLabels({
      t,
      productName: 'Travel bowl',
      ready: true,
      needsSelection: true,
    })).toEqual({
      addActionText: 'pages.stockAlerts.selectOptions',
      addActionLabel: 'pages.stockAlerts.selectOptions: Travel bowl',
      removeActionLabel: 'pages.stockAlerts.remove: Travel bowl',
      productLinkLabel: 'pages.productList.viewDetails: Travel bowl',
    });
  });
});
