import fs from 'fs';
import path from 'path';

const readPageSource = (filename: string) => fs.readFileSync(path.join(__dirname, filename), 'utf8');

const loadingRegions = [
  { file: 'Notifications.tsx', marker: 'notifications-page notifications-page--loading' },
  { file: 'Wishlist.tsx', marker: 'wishlist-page__loading' },
  { file: 'BrowsingHistory.tsx', marker: 'browsing-history--loading' },
  { file: 'PetFinder.tsx', marker: 'pet-finder-page__loading' },
  { file: 'ProductCompare.tsx', marker: 'product-compare__loading' },
  { file: 'Checkout.tsx', marker: 'checkout-page--loading' },
];

const getOpeningTagAroundMarker = (source: string, marker: string) => {
  const markerIndex = source.indexOf(marker);
  const openingTagStart = Math.max(
    source.lastIndexOf('<div', markerIndex),
    source.lastIndexOf('<main', markerIndex),
  );
  const openingTagEnd = source.indexOf('>', markerIndex);

  return {
    markerIndex,
    openingTagStart,
    openingTagEnd,
    openingTag: openingTagStart >= 0 && openingTagEnd > openingTagStart
      ? source.slice(openingTagStart, openingTagEnd + 1)
      : '',
  };
};

describe('storefront loading accessibility guards', () => {
  it('keeps customer-facing spinner loading states announced as busy status regions', () => {
    loadingRegions.forEach(({ file, marker }) => {
      const source = readPageSource(file);
      const { markerIndex, openingTagStart, openingTagEnd, openingTag } = getOpeningTagAroundMarker(source, marker);

      expect(markerIndex).toBeGreaterThan(-1);
      expect(openingTagStart).toBeGreaterThan(-1);
      expect(openingTagEnd).toBeGreaterThan(openingTagStart);
      expect(openingTag).toContain('role="status"');
      expect(openingTag).toContain('aria-live="polite"');
      expect(openingTag).toContain('aria-busy="true"');
      expect(openingTag).toContain("aria-label={t('common.loading')}");
    });
  });
});
