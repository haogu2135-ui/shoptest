import type { Product, ProductVariant } from '../types';

export type ProductOptionGroup = {
  name: string;
  values: string[];
};

const splitOptionValues = (value: unknown) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeOptionValues = (values: unknown[]) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const parseVariantOptionText = (value: unknown): Record<string, string> =>
  String(value || '')
    .split(',')
    .reduce((result: Record<string, string>, item) => {
      const [rawKey, ...rawValue] = item.split('=');
      const key = String(rawKey || '').trim();
      const optionValue = rawValue.join('=').trim();
      if (key && optionValue) result[key] = optionValue;
      return result;
    }, {});

const normalizeVariantOptions = (variant: any): Record<string, string> => {
  if (variant?.options && typeof variant.options === 'object' && !Array.isArray(variant.options)) {
    return Object.entries(variant.options).reduce((result: Record<string, string>, [key, value]) => {
      const normalizedKey = String(key || '').trim();
      const normalizedValue = String(value || '').trim();
      if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
      return result;
    }, {});
  }
  return parseVariantOptionText(variant?.optionText);
};

export const getProductOptionGroups = (product?: Partial<Product> | null): ProductOptionGroup[] => {
  if (!product) return [];
  const specs = product.specifications || {};
  const configured = Object.entries(specs)
    .filter(([key]) => key.startsWith('options.'))
    .map(([key, value]) => ({
      name: key.replace(/^options\./, ''),
      values: normalizeOptionValues(splitOptionValues(value)),
    }))
    .filter((group) => group.name && group.values.length > 0);

  if (configured.length > 0) return configured;

  const fallback: ProductOptionGroup[] = [];
  if (Array.isArray(product.sizes) && product.sizes.length > 0) fallback.push({ name: 'Size', values: normalizeOptionValues(product.sizes) });
  if (Array.isArray(product.colors) && product.colors.length > 0) fallback.push({ name: 'Color', values: normalizeOptionValues(product.colors) });
  return fallback;
};

export const getProductVariants = (product?: Partial<Product> | null): ProductVariant[] => {
  if (!product) return [];
  const rawVariants = (product as { variants?: ProductVariant[] | string }).variants;
  const normalizeVariants = (items: any[]) =>
    items
      .map((variant) => ({
        sku: variant?.sku ? String(variant.sku).trim() : undefined,
        options: normalizeVariantOptions(variant),
        price: Number(variant?.price || 0),
        stock: Number.isFinite(Number(variant?.stock)) ? Number(variant.stock) : undefined,
        imageUrl: variant?.imageUrl ? String(variant.imageUrl).trim() : undefined,
      }))
      .filter((variant) => Object.keys(variant.options).length > 0 && Number.isFinite(variant.price) && variant.price > 0);
  if (Array.isArray(rawVariants)) return normalizeVariants(rawVariants);
  if (typeof rawVariants !== 'string' || !rawVariants.trim()) return [];
  try {
    const parsed = JSON.parse(rawVariants);
    return Array.isArray(parsed) ? normalizeVariants(parsed) : [];
  } catch {
    return [];
  }
};

export const needsOptionSelection = (product?: Partial<Product> | null) =>
  Boolean(product && (getProductOptionGroups(product).length > 0 || getProductVariants(product).length > 0));

export const variantMatchesSelectedOptions = (
  variants: ProductVariant[],
  selectedOptions: Record<string, string>,
) =>
  variants.some((variant) =>
    Object.entries(selectedOptions).every(([key, selectedValue]) => !selectedValue || variant.options?.[key] === selectedValue),
  );

export const optionValueHasVariant = (
  variants: ProductVariant[],
  groupName: string,
  value: string,
) => {
  if (!variants.length) return true;
  return variants.some((variant) => variant.options?.[groupName] === value);
};

export const selectCompatibleProductOption = (
  optionGroups: ProductOptionGroup[],
  variants: ProductVariant[],
  selectedOptions: Record<string, string>,
  groupName: string,
  value: string,
) => {
  const nextOptions = { ...selectedOptions, [groupName]: value };
  if (variants.length > 0) {
    optionGroups.forEach((group) => {
      if (group.name === groupName || !nextOptions[group.name]) return;
      const candidate = { ...nextOptions };
      if (!variantMatchesSelectedOptions(variants, candidate)) {
        delete nextOptions[group.name];
      }
    });
  }
  return nextOptions;
};
