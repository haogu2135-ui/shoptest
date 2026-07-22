import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'HomePetGallery.tsx'), 'utf8');

describe('HomePetGallery storefront UGC contract', () => {
  it('keeps upload, preview, like, and delete actions accessible', () => {
    expect(source).toContain('accept="image/jpeg,image/png,image/gif"');
    expect(source).toContain('aria-label={uploadButtonLabel}');
    expect(source).toContain('aria-label={galleryActionLabel}');
    expect(source).toContain('aria-label={likeActionLabel}');
    expect(source).toContain('aria-pressed={item.likedByMe}');
    expect(source).toContain('aria-label={deleteActionLabel}');
    expect(source).toContain("rootClassName='shop-mobile-popup-layer shopee-home-popconfirm'");
    expect(source).toContain('ShopPopconfirm');
    expect(source).not.toMatch(/(?<!Shop)Popconfirm/);
  });

  it('keeps gallery images optimized and modal previews safe on mobile', () => {
    expect(source).toContain('buildResponsiveImageSrcSet(item.image, [240, 360, 520])');
    expect(source).toContain('sizes={petGalleryImageSizes}');
    expect(source).toContain('loading="lazy"');
    expect(source).toContain('decoding="async"');
    expect(source).toContain('className="profile-mobile-safe-modal pet-ugc-preview"');
    expect(source).toContain('ShopModal');
    expect(source).toContain('rootClassName="pet-ugc-preview-root"');
    expect(source).not.toMatch(/<Modal\b/);
    expect(source).toContain('onError={applyPetGalleryImageFallback}');
  });
});
