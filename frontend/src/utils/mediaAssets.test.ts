jest.mock('../api', () => ({
  apiBaseUrl: 'https://api.example.com',
}));

import { createSvgPlaceholder, resolveApiAssetUrl } from './mediaAssets';

describe('mediaAssets', () => {
  it('clamps placeholder dimensions and strips unsafe label characters', () => {
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
    expect(resolveApiAssetUrl('javascript:alert(1)', 'fallback')).toBe('fallback');
    expect(resolveApiAssetUrl('//evil.example.com/x.png', 'fallback')).toBe('fallback');
    expect(resolveApiAssetUrl('https://user:pass@example.com/x.png', 'fallback')).toBe('fallback');
    expect(resolveApiAssetUrl('data:text/html;base64,xxx', 'fallback')).toBe('fallback');
  });

  it('keeps safe remote, image data, blob, and relative asset URLs', () => {
    expect(resolveApiAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(resolveApiAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(resolveApiAssetUrl('blob:https://app.example.com/id')).toBe('blob:https://app.example.com/id');
    expect(resolveApiAssetUrl('/uploads/a.png')).toBe('https://api.example.com/uploads/a.png');
  });
});
