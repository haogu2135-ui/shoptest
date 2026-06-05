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

const hasUnsafeUrlCharacter = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });

const IPV4_HOST_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const unreliableRemoteImageRules = [
  { hostname: 'images.unsplash.com', pathIncludes: '/photo-1601758123927-1967a0d5f11b' },
];

const isPrivateIpv4Host = (hostname: string) => {
  if (!IPV4_HOST_PATTERN.test(hostname)) return false;
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = parts;
  return first === 0
    || first === 10
    || first === 127
    || first >= 224
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
};

const ipv4FromMappedIpv6Host = (hostname: string) => {
  if (!hostname.startsWith('::ffff:')) return null;
  const tail = hostname.slice('::ffff:'.length);
  if (IPV4_HOST_PATTERN.test(tail)) return tail;
  const parts = tail.split(':');
  if (parts.length !== 2) return null;
  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (![high, low].every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff)) {
    return null;
  }
  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
};

const isUnsafeImageHost = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)]$/, '$1');
  if (
    normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.lan')
  ) {
    return true;
  }
  if (isPrivateIpv4Host(normalized)) return true;
  const mappedIpv4 = ipv4FromMappedIpv6Host(normalized);
  if (mappedIpv4 && isPrivateIpv4Host(mappedIpv4)) return true;
  if (!normalized.includes(':')) return false;
  return normalized === '::1'
    || normalized === '0:0:0:0:0:0:0:1'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('ff');
};

const isKnownUnreliableRemoteImageUrl = (url: URL) => {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  return unreliableRemoteImageRules.some((rule) =>
    hostname === rule.hostname && pathname.includes(rule.pathIncludes),
  );
};

const isSafeImageUrlValue = (value: string) => {
  const normalized = value.toLowerCase();
  return Boolean(value)
    && !hasUnsafeUrlCharacter(value)
    && !value.includes('\\')
    && !value.startsWith('//')
    && !normalized.includes('%00')
    && !normalized.includes('%5c');
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
  const safeLabel = String(label || '').replace(/[<>&"']/g, '');
  const safeBackground = sanitizeSvgColor(background, '#f2f3f5');
  const safeForeground = sanitizeSvgColor(foreground, '#7b8794');
  const iconSize = Math.min(safeWidth, safeHeight);
  const iconStrokeWidth = Math.max(2, Math.min(Math.round(iconSize * 0.035), 10));
  const iconRadius = Math.max(12, Math.min(Math.round(iconSize * 0.18), 72));
  const centerX = Math.round(safeWidth / 2);
  const centerY = Math.round(safeHeight / 2);
  const iconMarkup = safeLabel
    ? `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${safeForeground}">${safeLabel}</text>`
    : [
        `<circle cx="${centerX}" cy="${centerY}" r="${iconRadius}" fill="none" stroke="${safeForeground}" stroke-width="${iconStrokeWidth}" opacity="0.45"/>`,
        `<path d="M ${centerX - iconRadius} ${centerY + Math.round(iconRadius * 0.35)} L ${centerX - Math.round(iconRadius * 0.28)} ${centerY - Math.round(iconRadius * 0.15)} L ${centerX + Math.round(iconRadius * 0.05)} ${centerY + Math.round(iconRadius * 0.12)} L ${centerX + iconRadius} ${centerY - Math.round(iconRadius * 0.45)}" fill="none" stroke="${safeForeground}" stroke-width="${iconStrokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>`,
      ].join('');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">`,
    `<rect width="100%" height="100%" rx="12" fill="${safeBackground}"/>`,
    iconMarkup,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const imageFallbacks = {
  product: createSvgPlaceholder({ label: '', width: 900, height: 900, background: '#fff7ed', foreground: '#c2410c' }),
  brand: createSvgPlaceholder({ label: '', width: 160, height: 160, background: '#eef2ff', foreground: '#3730a3' }),
  category: createSvgPlaceholder({ label: '', width: 160, height: 160, background: '#ecfdf5', foreground: '#047857' }),
  media: createSvgPlaceholder({ label: '', width: 320, height: 240, background: '#f8fafc', foreground: '#475569' }),
};

const generatedFallbackImageUrls = new Set(Object.values(imageFallbacks));

export const normalizePersistentImageUrl = (assetUrl?: string | null) => {
  const value = String(assetUrl || '').trim();
  if (!value || /^data:/i.test(value) || /^blob:/i.test(value) || !isSafeImageUrlValue(value)) {
    return '';
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const standardPort = !url.port || url.port === '80' || url.port === '443';
      return !url.username
        && !url.password
        && standardPort
        && !isKnownUnreliableRemoteImageUrl(url)
        && !isUnsafeImageHost(url.hostname)
        ? url.toString()
        : '';
    } catch {
      return '';
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return '';
  if (value.startsWith('/uploads/')) return value;
  if (value.startsWith('uploads/')) return `/${value}`;
  return '';
};

export const resolveApiAssetUrl = (assetUrl?: string | null, fallback = '') => {
  return normalizePersistentImageUrl(assetUrl) || fallback;
};

export const buildResponsiveImageSrcSet = (
  imageUrl?: string | null,
  widths = [320, 480, 720, 960, 1200],
) => {
  const value = String(imageUrl || '').trim();
  if (!value || /^data:/i.test(value) || /^blob:/i.test(value)) {
    return undefined;
  }
  const safeValue = normalizePersistentImageUrl(value);
  if (!safeValue) return undefined;
  try {
    const url = new URL(safeValue, window.location.origin);
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
  if (!value) return '';
  if (/^data:/i.test(value)) return generatedFallbackImageUrls.has(value) ? value : '';
  if (/^blob:/i.test(value)) return '';
  const safeValue = normalizePersistentImageUrl(value);
  if (!safeValue) return '';
  try {
    const url = new URL(safeValue, window.location.origin);
    const canResize = url.hostname.includes('images.unsplash.com') || url.searchParams.has('w');
    if (!canResize) return safeValue;
    const safeWidth = Math.max(96, Math.min(Math.floor(Number(width) || 900), 2000));
    url.searchParams.set('auto', 'format');
    url.searchParams.set('w', String(safeWidth));
    url.searchParams.set('q', safeWidth >= 960 ? '80' : '76');
    return url.toString();
  } catch {
    return safeValue;
  }
};
