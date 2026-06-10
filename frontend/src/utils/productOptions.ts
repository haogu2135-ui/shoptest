import type { ProductPublic, ProductVariant } from '../types';
import { normalizePersistentImageUrl } from './mediaAssets';

export type ProductOptionGroup = {
  name: string;
  values: string[];
};

const OPTION_VALUE_DELIMITER = /[,\uFF0C\u3001;\uFF1B\n]/;

const splitOptionValues = (value: unknown) =>
  String(value || '')
    .split(OPTION_VALUE_DELIMITER)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeOptionValues = (values: unknown[]) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const parseVariantOptionText = (value: unknown): Record<string, string> =>
  String(value || '')
    .split(OPTION_VALUE_DELIMITER)
    .reduce((result: Record<string, string>, item) => {
      const [rawKey, ...rawValue] = item.split('=');
      const key = String(rawKey || '').trim();
      const optionValue = rawValue.join('=').trim();
      if (key && optionValue) result[key] = optionValue;
      return result;
    }, {});

const normalizeVariantOptions = (variant: unknown): Record<string, string> => {
  if (!isRecord(variant)) return {};
  if (isRecord(variant.options)) {
    return Object.entries(variant.options).reduce((result: Record<string, string>, [key, value]) => {
      const normalizedKey = String(key || '').trim();
      if (value && typeof value === 'object') return result;
      const normalizedValue = String(value || '').trim();
      if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
      return result;
    }, {});
  }
  return parseVariantOptionText(variant?.optionText);
};

const normalizeOptionGroup = (group: unknown): ProductOptionGroup | null => {
  if (!isRecord(group)) return null;
  const values = Array.isArray(group.values)
    ? group.values
    : (Array.isArray(group.options) ? group.options : []);
  const normalized = {
    name: String(group.name || '').trim(),
    values: normalizeOptionValues(values),
  };
  return normalized.name && normalized.values.length > 0 ? normalized : null;
};

const normalizeVariant = (variant: unknown): ProductVariant | null => {
  if (!isRecord(variant)) return null;
  const normalized = {
    sku: variant.sku ? String(variant.sku).trim() : undefined,
    options: normalizeVariantOptions(variant),
    price: Number(variant.price || 0),
    stock: Number.isFinite(Number(variant.stock)) ? Math.max(0, Math.floor(Number(variant.stock))) : undefined,
    imageUrl: normalizePersistentImageUrl(typeof variant.imageUrl === 'string' ? variant.imageUrl : undefined) || undefined,
  };
  return Object.keys(normalized.options).length > 0 && Number.isFinite(normalized.price) && normalized.price > 0
    ? normalized
    : null;
};

type ProductOptionInput = Partial<ProductPublic> & {
  sizes?: unknown;
  colors?: unknown;
};

export const getProductOptionGroups = (product?: ProductOptionInput | null): ProductOptionGroup[] => {
  if (!product) return [];
  const directGroups = Array.isArray(product.optionGroups)
    ? product.optionGroups
      .map(normalizeOptionGroup)
      .filter((group): group is ProductOptionGroup => group !== null)
    : [];
  if (directGroups.length > 0) return directGroups;

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

export const getProductVariants = (product?: ProductOptionInput | null): ProductVariant[] => {
  if (!product) return [];
  const rawVariants = (product as { variants?: ProductVariant[] | string }).variants;
  const normalizeVariants = (items: unknown[]) =>
    items
      .map(normalizeVariant)
      .filter((variant): variant is ProductVariant => variant !== null);
  if (Array.isArray(rawVariants)) return normalizeVariants(rawVariants);
  if (typeof rawVariants !== 'string' || !rawVariants.trim()) return [];
  try {
    const parsed = JSON.parse(rawVariants);
    return Array.isArray(parsed) ? normalizeVariants(parsed) : [];
  } catch {
    return [];
  }
};

export const needsOptionSelection = (product?: ProductOptionInput | null) =>
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

export const optionValueIsCompatible = (
  variants: ProductVariant[],
  selectedOptions: Record<string, string>,
  groupName: string,
  value: string,
) => {
  if (!variants.length) return true;
  const candidateOptions = { ...selectedOptions, [groupName]: value };
  return variantMatchesSelectedOptions(variants, candidateOptions);
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
