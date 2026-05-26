describe('mediaAssets', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete window.__SHOP_RUNTIME_CONFIG__;
    delete window.__SHOP_API_BASE_URL__;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('clamps placeholder dimensions and strips unsafe label characters', () => {
    const { createSvgPlaceholder } = require('./mediaAssets');
    const placeholder = decodeURIComponent(createSvgPlaceholder({
      label: '<img onerror=alert(1)>',
      width: Infinity,
      height: -20,
      background: '" onload="alert(1)',
      foreground: 'url(javascript:alert(1))',
    }).replace('data:image/svg+xml;charset=UTF-8,', ''));

    expect(placeholder).toContain('width="320"');
    expect(placeholder).toContain('height="1"');
    expect(placeholder).toContain('fill="#f2f3f5"');
    expect(placeholder).toContain('fill="#7b8794"');
    expect(placeholder).not.toContain('<img');
    expect(placeholder).not.toContain('onload');
  });

  it('rejects unsafe asset URL protocols and credentials', () => {
    const { resolveApiAssetUrl } = require('./mediaAssets');

    expect(resolveApiAssetUrl('javascript:alert(1)', 'fallback')).toBe('fallback');
    expect(resolveApiAssetUrl('//evil.example.com/x.png', 'fallback')).toBe('fallback');
    expect(resolveApiAssetUrl('https://user:pass@example.com/x.png', 'fallback')).toBe('fallback');
    expect(resolveApiAssetUrl('data:text/html;base64,xxx', 'fallback')).toBe('fallback');
  });

  it('keeps safe remote, image data, blob, and relative asset URLs', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com' };
    const { resolveApiAssetUrl } = require('./mediaAssets');

    expect(resolveApiAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(resolveApiAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(resolveApiAssetUrl('blob:https://app.example.com/id')).toBe('blob:https://app.example.com/id');
    expect(resolveApiAssetUrl('/uploads/a.png')).toBe('https://api.example.com/uploads/a.png');
  });

  it('resolves relative asset URLs from runtime API config without loading the API client', () => {
    jest.doMock('../api', () => {
      throw new Error('mediaAssets should not import the API client');
    });
    window.__SHOP_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://api.example.com/store/' };

    const { resolveApiAssetUrl } = require('./mediaAssets');

    expect(resolveApiAssetUrl('/uploads/product.png')).toBe('https://api.example.com/store/uploads/product.png');
    expect(resolveApiAssetUrl('uploads/product.png')).toBe('https://api.example.com/store/uploads/product.png');
  });

  it('builds responsive next-gen image candidates only for resize-aware URLs', () => {
    const { buildResponsiveImageSrcSet } = require('./mediaAssets');
    const srcSet = buildResponsiveImageSrcSet('https://images.unsplash.com/photo-1?fit=crop&w=900&q=80', [320, 640]);

    expect(srcSet).toContain('auto=format');
    expect(srcSet).toContain('w=320');
    expect(srcSet).toContain('320w');
    expect(srcSet).toContain('w=640');
    expect(srcSet).toContain('640w');
    expect(buildResponsiveImageSrcSet('https://cdn.example.com/pet.jpg')).toBeUndefined();
    expect(buildResponsiveImageSrcSet('data:image/png;base64,abc')).toBeUndefined();
  });

  it('returns optimized primary image URLs for resize-aware providers', () => {
    const { getOptimizedImageUrl } = require('./mediaAssets');
    const optimized = getOptimizedImageUrl('https://images.unsplash.com/photo-1?fit=crop&w=900&q=80', 640);

    expect(optimized).toContain('auto=format');
    expect(optimized).toContain('w=640');
    expect(optimized).toContain('q=76');
    expect(getOptimizedImageUrl('https://cdn.example.com/pet.jpg', 640)).toBe('https://cdn.example.com/pet.jpg');
  });
});

export {};
