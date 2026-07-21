import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'HomeProductCard.tsx'), 'utf8');
const homeSource = fs.readFileSync(path.join(__dirname, '../pages/Home.tsx'), 'utf8');

describe('HomeProductCard commerce tile contract', () => {
  it('keeps homepage product cards accessible and image-resilient', () => {
    expect(source).toContain('aria-label={imageViewActionLabel}');
    expect(source).toContain('aria-label={quickViewActionLabel}');
    expect(source).toContain('aria-label={cartActionLabel}');
    expect(source).toContain('aria-label={wishlistActionLabel}');
    expect(source).toContain('title={titleViewActionLabel}');
    expect(source).toContain('buildResponsiveImageSrcSet(card.primaryImage, card.imageWidths)');
    expect(source).toContain('onError={(event) => applyProductImageFallback(event, card.fallbackImage)}');
    expect(source).toContain("loading={priority ? 'eager' : 'lazy'}");
    expect(source).toContain('decoding="async"');
    expect(source).toContain("fetchPriority={priority ? 'high' : 'auto'}");
  });

  it('uses local product placeholders instead of third-party fallback hosts', () => {
    expect(source).toContain('const productImageFallback = imageFallbacks.product;');
    expect(source).toContain('return Array.from(new Set([...images, productImageFallback].filter(Boolean))).slice(0, 6);');
    expect(source).not.toContain('images.unsplash.com');
    expect(source).not.toContain('unsplash.com');
  });

  it('keeps quick commerce state derived from product stock and options', () => {
    expect(source).toContain('isSoldOut: stockCount !== undefined && stockCount <= 0');
    expect(source).toContain('quickAddReady: stockCount === undefined || stockCount > 0 ? !needsOptionSelection(product) : false');
    expect(source).toContain('card.lowStockCount !== null');
    expect(source).toContain("t('pages.productList.cardOptionsNeeded')");
    expect(source).toContain("t('pages.productList.soldOut')");
    expect(source).toContain('wishlistedProductIds.has(product.id)');
  });

  it('keeps the home product tile as a memoized module-level component', () => {
    expect(homeSource).toContain("import HomeProductCard from '../components/HomeProductCard';");
    expect(homeSource).not.toContain('const ProductTile');
    expect(homeSource).not.toContain('function ProductTile');
    expect(source).toContain('const HomeProductCard: React.FC<HomeProductCardProps> = ({');
    expect(source).toContain('const MemoizedHomeProductCard = React.memo(HomeProductCard);');
    expect(source).toContain("MemoizedHomeProductCard.displayName = 'HomeProductCard';");
    expect(source).toContain('export default MemoizedHomeProductCard;');
  });

  it('reserves social, original, signal, and viewed slots for CLS-stable tiles', () => {
    expect(source).toContain('data-home-card-social=');
    expect(source).toContain('data-home-card-original=');
    expect(source).toContain('data-home-card-signal=');
    expect(source).toContain('data-home-card-viewed=');
    expect(source).toContain('shopee-product__original--empty');
    expect(source).toContain('shopee-product__lastViewed--empty');
    expect(source).toContain('width={card.imageWidth}');
    expect(source).toContain('height={card.imageWidth}');
    expect(source).toContain("priority ? 'eager' : 'lazy'");
  });
});
