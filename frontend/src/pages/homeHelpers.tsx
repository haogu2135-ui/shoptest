import React from 'react';
import type { Language } from '../i18n';
import type { CategoryPublic, ProductPublic as Product } from '../types';
import { localizeProduct } from '../utils/localizedProduct';
import { imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import {
  buildProductCatalogFallbackCategories,
  loadFallbackProductCatalog,
  loadProductCatalogSnapshot,
} from '../utils/productCatalogSnapshot';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';

export const DISCOVERY_BATCH_SIZE = 12;
export const HOME_FEATURED_LIMIT = 12;
export const HOME_PRODUCT_PAGE_SIZE = 48;
export const PET_GALLERY_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const PET_GALLERY_LOCAL_LIKES_KEY = 'shop-pet-gallery-local-likes';

export const categoryImageFallback = imageFallbacks.category;
export const petGalleryImageFallback = imageFallbacks.media;
export const publicAssetUrl = (path: string) => `${process.env.PUBLIC_URL || ''}${path}`;

export const mergeProductsById = (...groups: Product[][]) => {
  const productsById = new Map<number, Product>();
  groups.flat().forEach((product) => {
    if (Number.isSafeInteger(product.id) && !productsById.has(product.id)) {
      productsById.set(product.id, product);
    }
  });
  return Array.from(productsById.values());
};

export const ugcImages = [
  { key: 'happy_pet_1', image: publicAssetUrl('/assets/home/hero-dog.webp'), label: '@happy_pet_1', likeCount: 42 },
  { key: 'cozy_paws', image: publicAssetUrl('/assets/home/hero-cat-dog.webp'), label: '@cozy_paws', likeCount: 36 },
  { key: 'cat_window_club', image: publicAssetUrl('/assets/home/hero-mobile-pet.webp'), label: '@cat_window_club', likeCount: 31 },
  { key: 'weekend_walks', image: publicAssetUrl('/assets/home/hero-dogs.webp'), label: '@weekend_walks', likeCount: 27 },
  { key: 'tailwag_home', image: publicAssetUrl('/assets/home/hero-pet-care.webp'), label: '@tailwag_home', likeCount: 22 },
  { key: 'softnap_cat', image: publicAssetUrl('/assets/home/hero-cat-dog.webp'), label: '@softnap_cat', likeCount: 19 },
];

export const readLocalPetGalleryLikes = () => {
  try {
    const parsed = JSON.parse(getLocalStorageItem(PET_GALLERY_LOCAL_LIKES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    reportNonBlockingError('Home.readLocalPetGalleryLikes', error);
    return [];
  }
};

export const writeLocalPetGalleryLikes = (keys: string[]) => {
  setLocalStorageItem(PET_GALLERY_LOCAL_LIKES_KEY, JSON.stringify(Array.from(new Set(keys))));
};

export const resolveAssetImage = (imageUrl: string, fallback = '') => resolveApiAssetUrl(imageUrl, fallback);

export const resolvePetGalleryImage = (imageUrl: string) => {
  if (!imageUrl) return petGalleryImageFallback;
  return resolveAssetImage(imageUrl, petGalleryImageFallback) || petGalleryImageFallback;
};

export const applyHomeImageFallback = (event: React.SyntheticEvent<HTMLImageElement>, fallback: string) => {
  if (event.currentTarget.src !== fallback) {
    event.currentTarget.removeAttribute('srcset');
    event.currentTarget.src = fallback;
  }
};

export type HomeCatalogBootstrap = {
  products: Product[];
  featured: Product[];
  categories: CategoryPublic[];
  source: 'snapshot' | 'fallback';
};

/** Paint a commercial catalog immediately (snapshot or built-in fallback) to avoid skeleton→content CLS. */
export const resolveHomeCatalogBootstrap = (language: Language): HomeCatalogBootstrap | null => {
  try {
    const snapshot = loadProductCatalogSnapshot();
    const sourceProducts = snapshot?.products?.length
      ? snapshot.products
      : loadFallbackProductCatalog();
    if (!sourceProducts.length) return null;
    const products = sourceProducts.map((product) => localizeProduct(product, language));
    const featuredFromFlag = products.filter((product) => product.isFeatured).slice(0, HOME_FEATURED_LIMIT);
    const featured = featuredFromFlag.length
      ? featuredFromFlag
      : products.slice(0, Math.min(HOME_FEATURED_LIMIT, products.length));
    return {
      products,
      featured,
      categories: buildProductCatalogFallbackCategories(sourceProducts),
      source: snapshot?.products?.length ? 'snapshot' : 'fallback',
    };
  } catch (error) {
    reportNonBlockingError('Home.resolveHomeCatalogBootstrap', error);
    return null;
  }
};

/** Lightweight home icons — keep ant-design icons package out of the Home route graph. */
export const HomeIcon: React.FC<{ path: string; className?: string }> = ({ path, className }) => (
  <svg className={className ? `shop-home-icon ${className}` : 'shop-home-icon'} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
    <path fill="currentColor" d={path} />
  </svg>
);

export const HI = {
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  truck: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  gift: 'M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 9.81 2 8.5 2 6.85 2 5.5 3.35 5.5 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM8.5 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z',
  support: 'M12 2C6.48 2 2 6.04 2 11c0 2.38 1.19 4.51 3.06 6.01L4 22l5.2-1.86C10.1 20.37 11.03 20.5 12 20.5 17.52 20.5 22 16.46 22 11.5S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z',
  compass: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5 7.51-3.23L17.5 6.5 9.99 9.73 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z',
  history: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  fire: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  appstore: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
  camera: 'M12 12m-3.2 0a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z',
  shopping: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  safety: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
  star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  mobile: 'M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z',
  shop: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
} as const;
