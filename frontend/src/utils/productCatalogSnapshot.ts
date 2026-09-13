import type { CategoryPublic, ProductPublic, ProductVariant } from '../types';
import { imageFallbacks, normalizePersistentImageUrl } from './mediaAssets';
import { reportNonBlockingError } from './nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export const PRODUCT_CATALOG_SNAPSHOT_KEY = 'shop-product-catalog-snapshot';
export const PRODUCT_CATALOG_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SNAPSHOT_PRODUCTS = 24;
const MAX_SNAPSHOT_IMAGES = 6;
const MAX_SNAPSHOT_OPTIONS = 16;
const MAX_SNAPSHOT_VARIANTS = 20;
const MAX_SNAPSHOT_SPEC_KEYS = 32;
const fallbackProductImage = imageFallbacks.product;

export type ProductCatalogSnapshotProduct = ProductPublic & {
  categoryName?: string;
  rating?: number;
  sizes?: string[];
  colors?: string[];
};

type ProductCatalogSnapshot = {
  savedAt: number;
  products: ProductCatalogSnapshotProduct[];
};

const fallbackCategoryNames = [
  'Feeding & hydration',
  'Beds & comfort',
  'Walking gear',
  'Toys & enrichment',
  'Grooming care',
  'Food & treats',
  'Health & wellness',
  'Travel essentials',
  'Smart pet tech',
  'Everyday accessories',
];

const fallbackCategoryRules: Array<[RegExp, string]> = [
  [/\b(feeder|feeders|bowl|water|fountain|hydration|waterer)\b/i, 'Feeding & hydration'],
  [/\b(food|treat|kibble|salmon|chicken|nutrition)\b/i, 'Food & treats'],
  [/\b(bed|nap|blanket|furniture|calming|orthopedic)\b/i, 'Beds & comfort'],
  [/\b(leash|harness|collar|walking|travel|carrier)\b/i, 'Walking gear'],
  [/\b(toy|chew|puzzle|play|enrichment)\b/i, 'Toys & enrichment'],
  [/\b(groom|shampoo|brush|hygiene|litter|pad)\b/i, 'Grooming care'],
  [/\b(health|vitamin|dental|wellness)\b/i, 'Health & wellness'],
  [/\b(smart|automatic|camera|tracker|sensor|connected)\b/i, 'Smart pet tech'],
  [/\b(accessory|accessories|supply|supplies|essential|essentials|starter|kit)\b/i, 'Everyday accessories'],
];

const categoryIdLabelPattern = /^(category|categoria|categor[ií]a)\s*#?\s*\d+$/i;
const chineseCategoryIdLabelPattern = /^分类\s*#?\s*\d+$/;
const SNAPSHOT_WHITESPACE_PATTERN = /\s+/g;

const fallbackCatalogProducts: ProductCatalogSnapshotProduct[] = [
  {
    id: 1,
    name: 'PawPilot Smart Pet Feeder 4L',
    description: 'Programmable automatic feeder with portion control for cats and small dogs.',
    price: 129.9,
    effectivePrice: 109.9,
    originalPrice: 159.9,
    discount: 19,
    effectiveDiscountPercent: 31,
    stock: 42,
    categoryId: 10,
    categoryName: 'Automatic Feeders',
    imageUrl: fallbackProductImage,
    images: [fallbackProductImage],
    brand: 'PawPilot',
    tag: 'Smart feeder',
    rating: 4.8,
    averageRating: 4.8,
    freeShipping: true,
    freeShippingThreshold: 69,
    warranty: '1-year limited warranty',
    shipping: 'Ships in 2-4 business days',
    isFeatured: true,
    activeLimitedTimeDiscount: true,
    positiveRate: 96,
    reviewCount: 128,
    specifications: {
      'Pet Size': 'Small, Medium',
      Capacity: '4 L',
      'options.Size': 'Small,Medium',
      'options.Color': 'White,Black',
    },
    sizes: ['Small', 'Medium'],
    colors: ['White', 'Black'],
  },
  {
    id: 2,
    name: 'HydraWhisk Quiet Cat Water Fountain',
    description: 'Low-noise filtered water fountain that encourages cats to drink more.',
    price: 49.9,
    originalPrice: 64.9,
    discount: 23,
    stock: 75,
    categoryId: 11,
    categoryName: 'Water Fountains',
    imageUrl: fallbackProductImage,
    images: [fallbackProductImage],
    brand: 'HydraWhisk',
    tag: 'Quiet fountain',
    rating: 4.7,
    averageRating: 4.7,
    freeShipping: false,
    freeShippingThreshold: 69,
    warranty: '30-day return support',
    shipping: 'Ships in 2-4 business days',
    isFeatured: true,
    positiveRate: 94,
    reviewCount: 86,
    specifications: {
      'Pet Size': 'Cat',
      Capacity: '2.5 L',
      'options.Color': 'Blue,White',
    },
    colors: ['Blue', 'White'],
  },
  {
    id: 3,
    name: 'TrailTails Walking Starter Bundle',
    description: 'Leash, collar and waste-bag holder bundled for safer daily walks.',
    price: 34.9,
    originalPrice: 54.9,
    discount: 27,
    stock: 120,
    categoryId: 13,
    categoryName: 'Harnesses & Leashes',
    imageUrl: fallbackProductImage,
    images: [fallbackProductImage],
    brand: 'TrailTails',
    tag: 'Walking bundle',
    rating: 4.6,
    averageRating: 4.6,
    freeShipping: false,
    freeShippingThreshold: 69,
    warranty: '30-day fit support',
    shipping: 'Ships in 2-4 business days',
    positiveRate: 95,
    reviewCount: 74,
    specifications: {
      'Pet Size': 'Small, Medium, Large',
      Material: 'Nylon',
      'options.Size': 'Small,Medium,Large',
      'options.Color': 'Black,Red,Blue',
      'bundle.enabled': 'true',
      'bundle.price': '39.90',
      'bundle.items': '[{"name":"Adjustable leash","quantity":1},{"name":"Matching collar","quantity":1},{"name":"Waste-bag roll","quantity":2}]',
    },
    sizes: ['Small', 'Medium', 'Large'],
    colors: ['Black', 'Red', 'Blue'],
  },
  {
    id: 4,
    name: 'CloudNap Orthopedic Calming Bed',
    description: 'Bolstered pet bed with orthopedic foam support and a washable cover.',
    price: 89.9,
    effectivePrice: 79.9,
    originalPrice: 109.9,
    discount: 18,
    effectiveDiscountPercent: 27,
    stock: 36,
    categoryId: 4,
    categoryName: 'Beds & Furniture',
    imageUrl: fallbackProductImage,
    images: [fallbackProductImage],
    brand: 'CloudNap',
    tag: 'Calming bed',
    rating: 4.9,
    averageRating: 4.9,
    freeShipping: true,
    freeShippingThreshold: 69,
    warranty: 'Washable-cover guarantee',
    shipping: 'Ships in 2-4 business days',
    isFeatured: true,
    activeLimitedTimeDiscount: true,
    positiveRate: 97,
    reviewCount: 91,
    specifications: {
      'Pet Size': 'Medium, Large',
      Material: 'Orthopedic foam',
      'options.Size': 'Medium,Large',
      'options.Color': 'Gray,Brown',
    },
    sizes: ['Medium', 'Large'],
    colors: ['Gray', 'Brown'],
  },
];

const clampString = (value: unknown, maxLength: number) =>
  String(value || '').replace(SNAPSHOT_WHITESPACE_PATTERN, ' ').trim().slice(0, maxLength);

const finiteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const positiveInt = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const boundedStringList = (value: unknown, limit: number, maxLength = 80) => {
  if (!Array.isArray(value)) return undefined;
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (normalized.length >= limit) break;
    const next = clampString(item, maxLength);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
};

const boundedImageList = (value: unknown, limit: number, maxLength = 1000) => {
  if (!Array.isArray(value)) return undefined;
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (normalized.length >= limit) break;
    const next = normalizePersistentImageUrl(clampString(item, maxLength));
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
};

const normalizeSpecifications = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const normalized: Record<string, string> = {};
  let entryCount = 0;
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (entryCount >= MAX_SNAPSHOT_SPEC_KEYS) break;
    const normalizedKey = clampString(key, 80);
    const specValue = clampString(rawValue, 500);
    if (normalizedKey && specValue) {
      normalized[normalizedKey] = specValue;
      entryCount += 1;
    }
  }
  return entryCount > 0 ? normalized : undefined;
};

const normalizeVariants = (value: unknown): ProductVariant[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const variants: ProductVariant[] = [];
  for (const variant of value) {
    if (variants.length >= MAX_SNAPSHOT_VARIANTS) break;
    let optionCount = 0;
    const options = variant?.options && typeof variant.options === 'object' && !Array.isArray(variant.options)
      ? (() => {
        const normalizedOptions: Record<string, string> = {};
        for (const [key, rawValue] of Object.entries(variant.options as Record<string, unknown>)) {
          if (optionCount >= MAX_SNAPSHOT_OPTIONS) break;
          const normalizedKey = clampString(key, 60);
          const optionValue = clampString(rawValue, 80);
          if (normalizedKey && optionValue) {
            normalizedOptions[normalizedKey] = optionValue;
            optionCount += 1;
          }
        }
        return normalizedOptions;
      })()
      : {};
    const price = finiteNumber(variant?.price, 0);
    if (optionCount === 0 || price <= 0) continue;
    const normalizedVariant: ProductVariant = {
      options,
      price,
    };
    const sku = clampString(variant?.sku, 80);
    const imageUrl = normalizePersistentImageUrl(clampString(variant?.imageUrl, 1000));
    const stock = Number(variant?.stock);
    if (sku) normalizedVariant.sku = sku;
    if (Number.isFinite(stock)) normalizedVariant.stock = Math.max(0, Math.floor(stock));
    if (imageUrl) normalizedVariant.imageUrl = imageUrl;
    variants.push(normalizedVariant);
  }
  return variants.length ? variants : undefined;
};

export const normalizeProductForCatalogSnapshot = (value: unknown): ProductCatalogSnapshotProduct | null => {
  const product = value as Partial<ProductCatalogSnapshotProduct> | null | undefined;
  const id = positiveInt(product?.id);
  const name = clampString(product?.name, 180);
  const price = finiteNumber(product?.effectivePrice ?? product?.price, NaN);
  if (!id || !name || !Number.isFinite(price) || price < 0) return null;

  const categoryId = positiveInt(product?.categoryId) || 0;
  const originalPrice = finiteNumber(product?.originalPrice, NaN);
  const effectivePrice = finiteNumber(product?.effectivePrice, NaN);
  const discount = finiteNumber(product?.discount, NaN);
  const effectiveDiscountPercent = finiteNumber(product?.effectiveDiscountPercent, NaN);
  const freeShippingThreshold = finiteNumber(product?.freeShippingThreshold, NaN);
  const limitedTimePrice = finiteNumber(product?.limitedTimePrice, NaN);
  const rating = finiteNumber(product?.rating, NaN);
  const averageRating = finiteNumber(product?.averageRating, NaN);
  const positiveRate = finiteNumber(product?.positiveRate, NaN);
  const reviewCount = finiteNumber(product?.reviewCount, NaN);

  return {
    id,
    name,
    description: clampString(product?.description, 700),
    price,
    stock: Math.max(0, Math.floor(finiteNumber(product?.stock, 0))),
    categoryId,
    imageUrl: normalizePersistentImageUrl(clampString(product?.imageUrl, 1000)),
    categoryName: clampString(product?.categoryName, 120) || undefined,
    isFeatured: Boolean(product?.isFeatured),
    images: boundedImageList(product?.images, MAX_SNAPSHOT_IMAGES, 1000),
    brand: clampString(product?.brand, 120) || undefined,
    originalPrice: Number.isFinite(originalPrice) && originalPrice >= 0 ? originalPrice : undefined,
    discount: Number.isFinite(discount) ? Math.max(0, Math.min(discount, 100)) : undefined,
    limitedTimePrice: Number.isFinite(limitedTimePrice) ? Math.max(0, limitedTimePrice) : undefined,
    limitedTimeStartAt: clampString(product?.limitedTimeStartAt, 80) || undefined,
    limitedTimeEndAt: clampString(product?.limitedTimeEndAt, 80) || undefined,
    activeLimitedTimeDiscount: Boolean(product?.activeLimitedTimeDiscount),
    effectivePrice: Number.isFinite(effectivePrice) && effectivePrice >= 0 ? effectivePrice : undefined,
    effectiveDiscountPercent: Number.isFinite(effectiveDiscountPercent) ? Math.max(0, Math.min(effectiveDiscountPercent, 100)) : undefined,
    freeShipping: Boolean(product?.freeShipping),
    freeShippingThreshold: Number.isFinite(freeShippingThreshold) && freeShippingThreshold >= 0 ? freeShippingThreshold : undefined,
    tag: clampString(product?.tag, 80) || undefined,
    rating: Number.isFinite(rating) ? Math.max(0, Math.min(rating, 5)) : undefined,
    averageRating: Number.isFinite(averageRating) ? Math.max(0, Math.min(averageRating, 5)) : undefined,
    positiveRate: Number.isFinite(positiveRate) ? Math.max(0, Math.min(positiveRate, 100)) : undefined,
    reviewCount: Number.isFinite(reviewCount) ? Math.max(0, Math.floor(reviewCount)) : undefined,
    sizes: boundedStringList(product?.sizes, MAX_SNAPSHOT_OPTIONS),
    colors: boundedStringList(product?.colors, MAX_SNAPSHOT_OPTIONS),
    specifications: normalizeSpecifications(product?.specifications),
    variants: normalizeVariants(product?.variants),
    warranty: clampString(product?.warranty, 180) || undefined,
    shipping: clampString(product?.shipping, 180) || undefined,
  };
};

export const saveProductCatalogSnapshot = (products: ProductPublic[], now = Date.now()) => {
  try {
    const normalizedProducts: ProductCatalogSnapshotProduct[] = [];
    for (const product of products) {
      if (normalizedProducts.length >= MAX_SNAPSHOT_PRODUCTS) break;
      const normalized = normalizeProductForCatalogSnapshot(product);
      if (normalized) normalizedProducts.push(normalized);
    }
    if (normalizedProducts.length === 0) return;
    setLocalStorageItem(PRODUCT_CATALOG_SNAPSHOT_KEY, JSON.stringify({
      savedAt: now,
      products: normalizedProducts,
    }));
  } catch (error) {
    reportNonBlockingError('productCatalogSnapshot.saveProductCatalogSnapshot', error);
  }
};

export const loadProductCatalogSnapshot = (now = Date.now()): ProductCatalogSnapshot | null => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(PRODUCT_CATALOG_SNAPSHOT_KEY) || 'null');
    const savedAt = Number(parsed?.savedAt);
    if (!Number.isFinite(savedAt) || savedAt <= 0 || now - savedAt > PRODUCT_CATALOG_SNAPSHOT_TTL_MS) return null;
    const products: ProductCatalogSnapshotProduct[] = [];
    if (Array.isArray(parsed?.products)) {
      for (const product of parsed.products) {
        if (products.length >= MAX_SNAPSHOT_PRODUCTS) break;
        const normalized = normalizeProductForCatalogSnapshot(product);
        if (normalized) products.push(normalized);
      }
    }
    return products.length ? { savedAt, products } : null;
  } catch (error) {
    reportNonBlockingError('productCatalogSnapshot.loadProductCatalogSnapshot', error);
    return null;
  }
};

export const loadFallbackProductCatalog = (): ProductCatalogSnapshotProduct[] => {
  const products: ProductCatalogSnapshotProduct[] = [];
  for (const product of fallbackCatalogProducts) {
    const normalized = normalizeProductForCatalogSnapshot(product);
    if (normalized) products.push(normalized);
  }
  return products;
};

const cleanFallbackCategoryName = (value: unknown) => {
  const cleaned = clampString(value, 80);
  if (!cleaned) return '';
  if (categoryIdLabelPattern.test(cleaned) || chineseCategoryIdLabelPattern.test(cleaned)) {
    return '';
  }
  return cleaned;
};

const inferFallbackCategoryName = (product: ProductCatalogSnapshotProduct, fallbackIndex: number) => {
  const explicitName = cleanFallbackCategoryName(product.categoryName);
  if (explicitName) return explicitName;

  const searchParts: string[] = [];
  for (const value of [product.name, product.description, product.tag, product.brand]) {
    if (value) searchParts.push(value);
  }
  const searchText = searchParts.join(' ');
  const matchedRule = fallbackCategoryRules.find(([pattern]) => pattern.test(searchText));
  if (matchedRule) return matchedRule[1];

  return fallbackCategoryNames[fallbackIndex % fallbackCategoryNames.length];
};

const uniqueFallbackCategoryName = (baseName: string, product: ProductCatalogSnapshotProduct, usedNames: Set<string>) => {
  const cleanedBaseName = cleanFallbackCategoryName(baseName) || 'Pet essentials';
  const brandName = cleanFallbackCategoryName(product.brand);
  const tagName = cleanFallbackCategoryName(product.tag);
  const candidates = [
    cleanedBaseName,
    `${cleanedBaseName} collection`,
    `${cleanedBaseName} picks`,
    brandName ? `${brandName} picks` : '',
    tagName,
  ];
  for (const candidate of candidates) {
    if (candidate && !usedNames.has(candidate.toLowerCase())) return candidate;
  }
  return cleanedBaseName;
};

export const buildProductCatalogFallbackCategories = (products: ProductCatalogSnapshotProduct[]): CategoryPublic[] => {
  const categories = new Map<number, CategoryPublic>();
  const usedNames = new Set<string>();
  products.forEach((product) => {
    const id = Number(product.categoryId);
    if (!Number.isSafeInteger(id) || id <= 0 || categories.has(id)) return;
    const name = uniqueFallbackCategoryName(
      inferFallbackCategoryName(product, categories.size),
      product,
      usedNames,
    );
    const normalizedName = name.toLowerCase();
    usedNames.add(normalizedName);
    categories.set(id, {
      id,
      name,
      level: 1,
    });
  });
  return Array.from(categories.values()).sort((left, right) => left.name.localeCompare(right.name));
};
