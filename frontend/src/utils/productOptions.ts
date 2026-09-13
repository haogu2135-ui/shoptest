import type { ProductPublic, ProductVariant } from '../types';
import { normalizePersistentImageUrl } from './mediaAssets';
import { reportNonBlockingError } from './nonBlockingError';

export type ProductOptionGroup = {
  name: string;
  values: string[];
};

const OPTION_VALUE_DELIMITER = /[,\uFF0C\u3001;\uFF1B\n]/;

const splitOptionValues = (value: unknown) => {
  const normalized: string[] = [];
  for (const item of String(value || '').split(OPTION_VALUE_DELIMITER)) {
    const next = item.trim();
    if (next) normalized.push(next);
  }
  return normalized;
};

const normalizeOptionValues = (values: unknown[]) => {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const item = String(value || '').trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
  }
  return normalized;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const parseVariantOptionText = (value: unknown): Record<string, string> =>
  String(value || '').split(OPTION_VALUE_DELIMITER).reduce((result: Record<string, string>, item) => {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex < 0) return result;
    const key = item.slice(0, separatorIndex).trim();
    const optionValue = item.slice(separatorIndex + 1).trim();
    if (key && optionValue) result[key] = optionValue;
    return result;
  }, {});

const normalizeVariantOptions = (variant: unknown): Record<string, string> => {
  if (!isRecord(variant)) return {};
  if (isRecord(variant.options)) {
    const result: Record<string, string> = {};
    for (const key of Object.keys(variant.options)) {
      const value = variant.options[key];
      const normalizedKey = String(key || '').trim();
      if (value && typeof value === 'object') continue;
      const normalizedValue = String(value || '').trim();
      if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
    }
    return result;
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
  const directGroups: ProductOptionGroup[] = [];
  if (Array.isArray(product.optionGroups)) {
    for (const group of product.optionGroups) {
      const normalized = normalizeOptionGroup(group);
      if (normalized) directGroups.push(normalized);
    }
  }
  if (directGroups.length > 0) return directGroups;

  const specs = product.specifications || {};
  const configured: ProductOptionGroup[] = [];
  for (const key of Object.keys(specs)) {
    const value = specs[key];
    if (!key.startsWith('options.')) continue;
    const group = {
      name: key.replace(/^options\./, ''),
      values: normalizeOptionValues(splitOptionValues(value)),
    };
    if (group.name && group.values.length > 0) configured.push(group);
  }

  if (configured.length > 0) return configured;

  const fallback: ProductOptionGroup[] = [];
  if (Array.isArray(product.sizes) && product.sizes.length > 0) fallback.push({ name: 'Size', values: normalizeOptionValues(product.sizes) });
  if (Array.isArray(product.colors) && product.colors.length > 0) fallback.push({ name: 'Color', values: normalizeOptionValues(product.colors) });
  return fallback;
};

export const getProductVariants = (product?: ProductOptionInput | null): ProductVariant[] => {
  if (!product) return [];
  const rawVariants = (product as { variants?: ProductVariant[] | string }).variants;
  const normalizeVariants = (items: unknown[]) => {
    const normalized: ProductVariant[] = [];
    for (const item of items) {
      const variant = normalizeVariant(item);
      if (variant) normalized.push(variant);
    }
    return normalized;
  };
  if (Array.isArray(rawVariants)) return normalizeVariants(rawVariants);
  if (typeof rawVariants !== 'string' || !rawVariants.trim()) return [];
  try {
    const parsed = JSON.parse(rawVariants);
    return Array.isArray(parsed) ? normalizeVariants(parsed) : [];
  } catch (error) {
    reportNonBlockingError('productOptions.getProductVariants', error);
    return [];
  }
};

export const needsOptionSelection = (product?: ProductOptionInput | null) =>
  Boolean(product && (getProductOptionGroups(product).length > 0 || getProductVariants(product).length > 0));

export const variantMatchesSelectedOptions = (
  variants: ProductVariant[],
  selectedOptions: Record<string, string>,
) => {
  const selectedKeys = Object.keys(selectedOptions);
  for (const variant of variants) {
    let matches = true;
    for (const key of selectedKeys) {
      const selectedValue = selectedOptions[key];
      if (selectedValue && variant.options?.[key] !== selectedValue) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
};

export const optionValueHasVariant = (
  variants: ProductVariant[],
  groupName: string,
  value: string,
) => {
  if (!variants.length) return true;
  for (const variant of variants) {
    if (variant.options?.[groupName] === value) return true;
  }
  return false;
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
    for (const group of optionGroups) {
      if (group.name === groupName || !nextOptions[group.name]) continue;
      const candidate = { ...nextOptions };
      if (!variantMatchesSelectedOptions(variants, candidate)) {
        delete nextOptions[group.name];
      }
    }
  }
  return nextOptions;
};
