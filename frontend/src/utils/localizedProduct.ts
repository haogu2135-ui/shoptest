import type { Product } from '../types';
import type { Language } from '../i18n';

type LocalizedProductField = 'name' | 'description' | 'brand';

const valueFromSpecs = (
  product: Product,
  language: Language,
  field: LocalizedProductField,
) => {
  const specs = product.specifications || {};
  return specs[`i18n.${language}.${field}`] || specs[`i18n.en.${field}`];
};

export const getLocalizedProductValue = (
  product: Product,
  language: Language,
  field: LocalizedProductField,
) => valueFromSpecs(product, language, field) || product[field] || '';

export const localizeProduct = (product: Product, language: Language): Product => ({
  ...product,
  name: getLocalizedProductValue(product, language, 'name'),
  description: getLocalizedProductValue(product, language, 'description'),
  brand: getLocalizedProductValue(product, language, 'brand') || product.brand,
});
