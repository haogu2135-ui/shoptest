import type { ProductPublic, ProductVariant } from '../types';
import { normalizePersistentImageUrl } from './mediaAssets';
import { getLocalStorageItem, setLocalStorageItem } from './safeStorage';

export const PRODUCT_CATALOG_SNAPSHOT_KEY = 'shop-product-catalog-snapshot';
export const PRODUCT_CATALOG_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SNAPSHOT_PRODUCTS = 24;
const MAX_SNAPSHOT_IMAGES = 6;
const MAX_SNAPSHOT_OPTIONS = 16;
const MAX_SNAPSHOT_VARIANTS = 20;
const MAX_SNAPSHOT_SPEC_KEYS = 32;

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
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80',
    images: [
      'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80',
    ],
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
    imageUrl: 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80'],
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
    imageUrl: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=900&q=80'],
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
    imageUrl: 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=900&q=80',
    images: ['https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80'],
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
  } catch {
    // Catalog continuity is best-effort when storage is unavailable or full.
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
  } catch {
    return null;
  }
};

export const loadFallbackProductCatalog = (): ProductCatalogSnapshotProduct[] =>
  fallbackCatalogProducts
    .map(normalizeProductForCatalogSnapshot)
    .filter((product): product is ProductCatalogSnapshotProduct => Boolean(product));
