import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'HomeProductCard.tsx'), 'utf8');

describe('HomeProductCard commerce tile contract', () => {
  it('keeps homepage product cards accessible and image-resilient', () => {
    expect(source).toContain('aria-label={imageViewActionLabel}');
    expect(source).toContain('aria-label={quickViewActionLabel}');
    expect(source).toContain('aria-label={cartActionLabel}');
    expect(source).toContain('aria-label={wishlistActionLabel}');
    expect(source).toContain('title={titleViewActionLabel}');
    expect(source).toContain('buildResponsiveImageSrcSet(card.primaryImage, card.imageWidths)');
    expect(source).toContain('onError={(event) => applyProductImageFallback(event, card.fallbackImage)}');
    expect(source).toContain('loading="lazy"');
    expect(source).toContain('decoding="async"');
  });

  it('keeps quick commerce state derived from product stock and options', () => {
    expect(source).toContain('isSoldOut: stockCount !== undefined && stockCount <= 0');
    expect(source).toContain('quickAddReady: stockCount === undefined || stockCount > 0 ? !needsOptionSelection(product) : false');
    expect(source).toContain('card.lowStockCount !== null');
    expect(source).toContain("t('pages.productList.selectOptions')");
    expect(source).toContain("t('pages.productList.soldOut')");
    expect(source).toContain('wishlistedProductIds.has(product.id)');
  });
});
