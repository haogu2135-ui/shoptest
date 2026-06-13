import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'SkeletonLoader.tsx'), 'utf8');

describe('SkeletonLoader shared loading contract', () => {
  it('keeps shared skeleton variants decorative and layout-stable', () => {
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('skeleton skeleton--${type}');
    expect(source).toContain('Array.from({ length: rows })');
    expect(source).toContain('titleWidths[i % titleWidths.length]');
    expect(source).toContain('metaWidths[i % metaWidths.length]');
    expect(source).toContain("typeof height === 'number' ? height : 80");
  });

  it('keeps hero, product-card, and stats skeleton exports available', () => {
    expect(source).toContain('export const HeroSkeleton');
    expect(source).toContain('export const ProductCardSkeleton');
    expect(source).toContain('export const StatsStripSkeleton');
    expect(source).toContain('product-skeleton__card');
    expect(source).toContain('stats-strip-skeleton');
    expect(source).toContain('export default SkeletonLoader;');
  });
});
