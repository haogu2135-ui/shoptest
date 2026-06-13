import type { ProductBundleItem, ProductPublic } from '../types';

const MAX_BUNDLE_ITEM_QUANTITY = 99;

const normalizeBundleQuantity = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(Math.floor(numeric), MAX_BUNDLE_ITEM_QUANTITY));
};

const parseBundleItems = (value?: string): ProductBundleItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
        .map((item) => ({
          name: String(item?.name || '').trim(),
          quantity: normalizeBundleQuantity(item?.quantity),
          productId: Number.isSafeInteger(Number(item?.productId)) && Number(item.productId) > 0 ? Number(item.productId) : undefined,
        }))
        .filter((item) => item.name)
      : [];
  } catch (_error) {
    return value
      .split(/[+,\n,，、]/)
      .map((name) => ({ name: name.trim(), quantity: 1 }))
      .filter((item) => item.name);
  }
};

export const getBundleInfo = (product?: ProductPublic | null) => {
  const directBundle = product?.bundle && typeof product.bundle === 'object' ? product.bundle : null;
  if (directBundle?.enabled) {
    const price = Number(directBundle.price || 0);
    const items = Array.isArray(directBundle.items)
      ? directBundle.items
        .map((item) => ({
          name: String(item?.name || '').trim(),
          quantity: normalizeBundleQuantity(item?.quantity),
          productId: Number.isSafeInteger(Number(item?.productId)) && Number(item.productId) > 0 ? Number(item.productId) : undefined,
        }))
        .filter((item) => item.name)
      : [];
    if (Number.isFinite(price) && price > 0 && items.length > 0) {
      return {
        price,
        title: String(directBundle.title || product?.name || 'Bundle').trim() || 'Bundle',
        items,
      };
    }
  }

  const specs = product?.specifications || {};
  const enabled = String(specs['bundle.enabled'] || '').toLowerCase() === 'true';
  const price = Number(specs['bundle.price'] || 0);
  const items = parseBundleItems(specs['bundle.items']);
  if (!enabled || !Number.isFinite(price) || price <= 0 || items.length === 0) {
    return null;
  }
  return {
    price,
    title: String(specs['bundle.title'] || product?.name || 'Bundle').trim() || 'Bundle',
    items,
  };
};

export const buildBundleSpecs = (product: ProductPublic, options: Record<string, string> = {}, variantSku?: string) => {
  const bundle = getBundleInfo(product);
  if (!bundle) return undefined;
  return JSON.stringify({
    ...options,
    ...(variantSku ? { _variantSku: variantSku } : {}),
    _purchaseMode: 'bundle',
    _bundleTitle: bundle.title,
    _bundleItems: bundle.items.map((item) => `${item.name} x${item.quantity || 1}`).join(', '),
  });
};
