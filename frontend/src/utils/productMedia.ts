import { imageFallbacks, resolveApiAssetUrl } from './mediaAssets';

export const productImageFallback = imageFallbacks.product;

export const resolveProductImage = (imageUrl?: string) => resolveApiAssetUrl(imageUrl, productImageFallback);
