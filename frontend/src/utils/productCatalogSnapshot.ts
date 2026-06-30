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
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);

const finiteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const positiveInt = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const boundedStringList = (value: unknown, limit: number, maxLength = 80) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => clampString(item, maxLength)).filter(Boolean))).slice(0, limit)
    : undefined;

const boundedImageList = (value: unknown, limit: number, maxLength = 1000) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => normalizePersistentImageUrl(clampString(item, maxLength))).filter(Boolean))).slice(0, limit)
    : undefined;

const normalizeSpecifications = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, rawValue]) => [clampString(key, 80), clampString(rawValue, 500)] as const)
    .filter(([key, specValue]) => key && specValue)
    .slice(0, MAX_SNAPSHOT_SPEC_KEYS);
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const normalizeVariants = (value: unknown): ProductVariant[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const variants = value
    .map((variant): ProductVariant | null => {
      const options = variant?.options && typeof variant.options === 'object' && !Array.isArray(variant.options)
        ? Object.fromEntries(
          Object.entries(variant.options as Record<string, unknown>)
            .map(([key, rawValue]) => [clampString(key, 60), clampString(rawValue, 80)] as const)
            .filter(([key, optionValue]) => key && optionValue)
            .slice(0, MAX_SNAPSHOT_OPTIONS),
        )
        : {};
      const price = finiteNumber(variant?.price, 0);
      if (Object.keys(options).length === 0 || price <= 0) return null;
      const normalizedVariant: ProductVariant = {
        options,
        price,
      };
      const sku = clampString(variant?.sku, 80);
      const imageUrl = normalizePersistentImageUrl(clampString(variant?.imageUrl, 1000));
      if (sku) normalizedVariant.sku = sku;
      if (Number.isFinite(Number(variant?.stock))) normalizedVariant.stock = Math.max(0, Math.floor(Number(variant.stock)));
      if (imageUrl) normalizedVariant.imageUrl = imageUrl;
      return normalizedVariant;
    })
    .filter((variant): variant is ProductVariant => Boolean(variant))
    .slice(0, MAX_SNAPSHOT_VARIANTS);
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
    limitedTimePrice: Number.isFinite(Number(product?.limitedTimePrice)) ? Math.max(0, Number(product?.limitedTimePrice)) : undefined,
    limitedTimeStartAt: clampString(product?.limitedTimeStartAt, 80) || undefined,
    limitedTimeEndAt: clampString(product?.limitedTimeEndAt, 80) || undefined,
    activeLimitedTimeDiscount: Boolean(product?.activeLimitedTimeDiscount),
    effectivePrice: Number.isFinite(effectivePrice) && effectivePrice >= 0 ? effectivePrice : undefined,
    effectiveDiscountPercent: Number.isFinite(effectiveDiscountPercent) ? Math.max(0, Math.min(effectiveDiscountPercent, 100)) : undefined,
    freeShipping: Boolean(product?.freeShipping),
    freeShippingThreshold: Number.isFinite(freeShippingThreshold) && freeShippingThreshold >= 0 ? freeShippingThreshold : undefined,
    tag: clampString(product?.tag, 80) || undefined,
    rating: Number.isFinite(Number(product?.rating)) ? Math.max(0, Math.min(Number(product?.rating), 5)) : undefined,
    averageRating: Number.isFinite(Number(product?.averageRating)) ? Math.max(0, Math.min(Number(product?.averageRating), 5)) : undefined,
    positiveRate: Number.isFinite(Number(product?.positiveRate)) ? Math.max(0, Math.min(Number(product?.positiveRate), 100)) : undefined,
    reviewCount: Number.isFinite(Number(product?.reviewCount)) ? Math.max(0, Math.floor(Number(product?.reviewCount))) : undefined,
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
    const normalizedProducts = products
      .map(normalizeProductForCatalogSnapshot)
      .filter((product): product is ProductCatalogSnapshotProduct => Boolean(product))
      .slice(0, MAX_SNAPSHOT_PRODUCTS);
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
    const products = Array.isArray(parsed?.products)
      ? parsed.products
        .map(normalizeProductForCatalogSnapshot)
        .filter((product: ProductCatalogSnapshotProduct | null): product is ProductCatalogSnapshotProduct => Boolean(product))
        .slice(0, MAX_SNAPSHOT_PRODUCTS)
      : [];
    return products.length ? { savedAt, products } : null;
  } catch (error) {
    reportNonBlockingError('productCatalogSnapshot.loadProductCatalogSnapshot', error);
    return null;
  }
};

export const loadFallbackProductCatalog = (): ProductCatalogSnapshotProduct[] =>
  fallbackCatalogProducts
    .map(normalizeProductForCatalogSnapshot)
    .filter((product): product is ProductCatalogSnapshotProduct => Boolean(product));

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

  const searchText = [
    product.name,
    product.description,
    product.tag,
    product.brand,
  ].filter(Boolean).join(' ');
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
  ].filter(Boolean);
  const candidate = candidates.find((name) => !usedNames.has(name.toLowerCase()));
  return candidate || cleanedBaseName;
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
    usedNames.add(name.toLowerCase());
    categories.set(id, {
      id,
      name,
      level: 1,
    });
  });
  return Array.from(categories.values()).sort((left, right) => left.name.localeCompare(right.name));
};
