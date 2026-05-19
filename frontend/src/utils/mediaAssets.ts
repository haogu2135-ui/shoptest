import { apiBaseUrl } from '../api';

type PlaceholderOptions = {
  label: string;
  width?: number;
  height?: number;
  background?: string;
  foreground?: string;
};

const sanitizeSvgColor = (value: unknown, fallback: string) => {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) || /^[a-z]+$/i.test(color) ? color : fallback;
};

export const createSvgPlaceholder = ({
  label,
  width = 320,
  height = 240,
  background = '#f2f3f5',
  foreground = '#7b8794',
}: PlaceholderOptions) => {
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const safeWidth = Math.max(1, Math.min(Math.floor(Number.isFinite(numericWidth) ? numericWidth : 320), 2000));
  const safeHeight = Math.max(1, Math.min(Math.floor(Number.isFinite(numericHeight) ? numericHeight : 240), 2000));
  const safeLabel = String(label || 'Image').replace(/[<>&"']/g, '');
  const safeBackground = sanitizeSvgColor(background, '#f2f3f5');
  const safeForeground = sanitizeSvgColor(foreground, '#7b8794');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">`,
    `<rect width="100%" height="100%" rx="12" fill="${safeBackground}"/>`,
    `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${safeForeground}">${safeLabel}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const imageFallbacks = {
  product: createSvgPlaceholder({ label: 'Product', width: 900, height: 900, background: '#fff7ed', foreground: '#c2410c' }),
  brand: createSvgPlaceholder({ label: 'Logo', width: 160, height: 160, background: '#eef2ff', foreground: '#3730a3' }),
  category: createSvgPlaceholder({ label: 'Category', width: 160, height: 160, background: '#ecfdf5', foreground: '#047857' }),
  media: createSvgPlaceholder({ label: 'Media', width: 320, height: 240, background: '#f8fafc', foreground: '#475569' }),
};

export const resolveApiAssetUrl = (assetUrl?: string | null, fallback = '') => {
  const value = String(assetUrl || '').trim();
  if (!value) return fallback;
  if (/^data:/i.test(value)) {
    return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(value) ? value : fallback;
  }
  if (/^blob:/i.test(value)) return value;
  if (/^https?:/i.test(value)) {
    try {
      const url = new URL(value);
      return url.username || url.password ? fallback : url.toString();
    } catch {
      return fallback;
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return fallback;
  return `${apiBaseUrl}${value.startsWith('/') ? value : `/${value}`}`;
};

export const buildResponsiveImageSrcSet = (
  imageUrl?: string | null,
  widths = [320, 480, 720, 960, 1200],
) => {
  const value = String(imageUrl || '').trim();
  if (!value || /^data:/i.test(value) || /^blob:/i.test(value) || value.startsWith('//')) {
    return undefined;
  }
  try {
    const url = new URL(value, window.location.origin);
    const canResize = url.hostname.includes('images.unsplash.com') || url.searchParams.has('w');
    if (!canResize) return undefined;
    return widths
      .map((width) => {
        const nextUrl = new URL(url.toString());
        nextUrl.searchParams.set('auto', 'format');
        nextUrl.searchParams.set('w', String(width));
        nextUrl.searchParams.set('q', width >= 960 ? '80' : '76');
        return `${nextUrl.toString()} ${width}w`;
      })
      .join(', ');
  } catch {
    return undefined;
  }
};

export const getOptimizedImageUrl = (
  imageUrl?: string | null,
  width = 900,
) => {
  const value = String(imageUrl || '').trim();
  if (!value || /^data:/i.test(value) || /^blob:/i.test(value) || value.startsWith('//')) {
    return value || '';
  }
  try {
    const url = new URL(value, window.location.origin);
    const canResize = url.hostname.includes('images.unsplash.com') || url.searchParams.has('w');
    if (!canResize) return value;
    const safeWidth = Math.max(96, Math.min(Math.floor(Number(width) || 900), 2000));
    url.searchParams.set('auto', 'format');
    url.searchParams.set('w', String(safeWidth));
    url.searchParams.set('q', safeWidth >= 960 ? '80' : '76');
    return url.toString();
  } catch {
    return value;
  }
};
