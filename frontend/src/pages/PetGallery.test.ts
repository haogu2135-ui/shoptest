import fs from 'fs';
import path from 'path';

const readPetGallerySource = () => fs.readFileSync(path.resolve(__dirname, 'PetGallery.tsx'), 'utf8');
const readPetGalleryCss = () => fs.readFileSync(path.resolve(__dirname, 'PetGallery.css'), 'utf8');

describe('PetGallery mobile layout source contracts', () => {
  it('keeps the mobile toolbar above the fixed storefront bottom nav', () => {
    const source = readPetGallerySource();
    const css = readPetGalleryCss();
    const f2858Css = css.slice(css.indexOf('/* F2858'));

    expect(source).toContain('<section className="pet-gallery-toolbar">');
    expect(source).toContain('aria-label={galleryLoginActionLabel}');
    expect(source).toContain('aria-label={galleryRefreshActionLabel}');
    expect(f2858Css).toMatch(/@media \(max-width:\s*620px\)\s*\{/);
    expect(f2858Css).toMatch(/\.pet-gallery-page\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 36px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?scroll-padding-bottom:/);
    expect(f2858Css).toMatch(/\.pet-gallery-toolbar\s*\{[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?top:\s*auto\s*!important;[\s\S]*?bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 12px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?z-index:\s*1240;/);
    expect(f2858Css).toMatch(/\.pet-gallery-toolbar \.ant-space\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(f2858Css).toMatch(/\.pet-gallery-insights\s*\{[\s\S]*?scroll-margin-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 24px \+ env\(safe-area-inset-bottom,\s*0px\)\);/);
  });

  it('keeps social-proof copy readable in short landscape viewports', () => {
    const source = readPetGallerySource();
    const css = readPetGalleryCss();
    const f2757Start = css.indexOf('/* F2757');
    const f2757Css = css.slice(f2757Start);

    expect(source).toContain('<section className="pet-gallery-insights"');
    expect(source).toContain('<section className="pet-gallery-actions"');
    expect(source).toContain('<section className="pet-gallery-conversion"');
    expect(f2757Start).toBeGreaterThanOrEqual(0);
    expect(f2757Css).toMatch(/@media \(max-width:\s*900px\) and \(max-height:\s*480px\)\s*\{/);
    expect(f2757Css).toMatch(/\.pet-gallery-insights,[\s\S]*?\.pet-gallery-actions,[\s\S]*?\.pet-gallery-conversion\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*?align-items:\s*stretch;/);
    expect(f2757Css).toMatch(/\.pet-gallery-insights__copy,[\s\S]*?\.pet-gallery-action-card,[\s\S]*?\.pet-gallery-conversion > div:first-child\s*\{[\s\S]*?min-width:\s*min\(100%,\s*280px\);[\s\S]*?word-break:\s*normal;[\s\S]*?writing-mode:\s*horizontal-tb;/);
    expect(f2757Css).toMatch(/\.pet-gallery-insights__eyebrow,[\s\S]*?\.pet-gallery-conversion \.pet-gallery-page__text[\s\S]*?\{[\s\S]*?overflow-wrap:\s*break-word;[\s\S]*?white-space:\s*normal;[\s\S]*?writing-mode:\s*horizontal-tb;/);
    expect(f2757Css).toMatch(/\.pet-gallery-insights__grid,[\s\S]*?\.pet-gallery-conversion__signals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?mask-image:\s*none\s*!important;/);
    expect(f2757Css).toMatch(/\.pet-gallery-action-card \.ant-space,[\s\S]*?\.pet-gallery-conversion__actions\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  });

  it('keeps mobile gallery card owner labels readable on image cards', () => {
    const source = readPetGallerySource();
    const css = readPetGalleryCss();
    const f9349Start = css.indexOf('/* F9349');
    const f9349Css = css.slice(f9349Start);

    expect(source).toContain('className="pet-gallery-card__owner"');
    expect(css).not.toContain('.overlay-title');
    expect(css).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\.6\)/);
    expect(source).not.toContain('className="overlay"');
    expect(f9349Start).toBeGreaterThanOrEqual(0);
    expect(f9349Css).toMatch(/@media \(max-width:\s*620px\)\s*\{/);
    expect(f9349Css).toMatch(/\.pet-gallery-card__owner\s*\{[\s\S]*?min-height:\s*32px;[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
    expect(f9349Css).toMatch(/\.pet-gallery-card__owner\s*\{[\s\S]*?background:\s*rgba\(18,\s*71,\s*52,\s*0\.92\);[\s\S]*?font-size:\s*14px\s*!important;[\s\S]*?line-height:\s*1\.25\s*!important;/);
  });

  it('keeps fallback gallery photos on local placeholder assets', () => {
    const source = readPetGallerySource();

    expect(source).toContain("import { buildResponsiveImageSrcSet, getOptimizedImageUrl, imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';");
    expect(source).toContain('const petGalleryImageFallback = imageFallbacks.media;');
    expect(source).toContain('image: petGalleryImageFallback');
    expect(source).not.toContain('images.unsplash.com');
    expect(source).not.toContain('unsplash.com');
  });

  it('keeps failed community loads distinct from live gallery content', () => {
    const source = readPetGallerySource();

    expect(source).toContain('setLoadError(true);');
    expect(source).not.toContain('setPhotos([]);');
    expect(source).toContain('if (loadError) {');
    expect(source).toContain('return apiItems.sort(');
    expect(source).toContain('const canUseLiveInteractions = hasLiveGalleryData && !isSampleOnlyGallery;');
    expect(source).toContain("announceAccessibleMessage(t('pages.petGallery.staleActionBlocked'), 'warning')");
    expect(source).toContain("message={t('pages.petGallery.staleDataWarning')}");
    expect(source).toContain("title={t('pages.petGallery.loadFailed')}");
    expect(source).toContain('PageError');
    expect(source).toContain("description={t('pages.petGallery.sampleFallbackDescription')}");
    expect(source).toContain("onClick={() => refreshGallery(true)}");
    expect(source).toContain("navigate('/products?keyword=pet')");
  });
});
