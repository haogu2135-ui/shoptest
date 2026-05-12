import type { Product, ProductBundleItem } from '../types';

const parseBundleItems = (value?: string): ProductBundleItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
        .map((item) => ({
          name: String(item?.name || '').trim(),
          quantity: Number(item?.quantity || 1),
          productId: item?.productId ? Number(item.productId) : undefined,
        }))
        .filter((item) => item.name)
      : [];
  } catch {
    return value
      .split(/[+,\n，、/]/)
      .map((name) => ({ name: name.trim(), quantity: 1 }))
      .filter((item) => item.name);
  }
};

export const getBundleInfo = (product?: Product | null) => {
  const specs = product?.specifications || {};
  const enabled = String(specs['bundle.enabled'] || '').toLowerCase() === 'true';
  const price = Number(specs['bundle.price'] || 0);
  const items = parseBundleItems(specs['bundle.items']);
  if (!enabled || price <= 0 || items.length === 0) {
    return null;
  }
  return {
    price,
    title: specs['bundle.title'] || product?.name || 'Bundle',
    items,
  };
};

export const buildBundleSpecs = (product: Product, options: Record<string, string> = {}, variantSku?: string) => {
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
