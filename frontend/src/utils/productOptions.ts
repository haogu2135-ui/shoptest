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

export const getProductOptionGroups = (product?: Partial<Product> | null): ProductOptionGroup[] => {
  if (!product) return [];
  const specs = product.specifications || {};
  const configured = Object.entries(specs)
    .filter(([key]) => key.startsWith('options.'))
    .map(([key, value]) => ({
      name: key.replace(/^options\./, ''),
      values: splitOptionValues(value),
    }))
    .filter((group) => group.name && group.values.length > 0);

  if (configured.length > 0) return configured;

  const fallback: ProductOptionGroup[] = [];
  if (Array.isArray(product.sizes) && product.sizes.length > 0) fallback.push({ name: 'Size', values: product.sizes });
  if (Array.isArray(product.colors) && product.colors.length > 0) fallback.push({ name: 'Color', values: product.colors });
  return fallback;
};

export const getProductVariants = (product?: Partial<Product> | null): ProductVariant[] => {
  if (!product) return [];
  const rawVariants = (product as { variants?: ProductVariant[] | string }).variants;
  if (Array.isArray(rawVariants)) return rawVariants;
  if (typeof rawVariants !== 'string' || !rawVariants.trim()) return [];
  try {
    const parsed = JSON.parse(rawVariants);
    return Array.isArray(parsed) ? parsed : [];
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
