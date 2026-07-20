import { reportNonBlockingError } from './nonBlockingError';

export type OpenGraphType = 'website' | 'product' | 'article';

export type DocumentMetaInput = {
  description?: string | null;
  imageUrl?: string | null;
  path?: string | null;
  type?: OpenGraphType;
  noIndex?: boolean;
  siteName?: string | null;
  title?: string | null;
};

type ManagedMetaKey =
  | 'description'
  | 'robots'
  | 'og:type'
  | 'og:site_name'
  | 'og:title'
  | 'og:description'
  | 'og:image'
  | 'og:url'
  | 'twitter:card'
  | 'twitter:title'
  | 'twitter:description'
  | 'twitter:image';

type MetaSelector =
  | { attr: 'name'; key: Exclude<ManagedMetaKey, `og:${string}`> }
  | { attr: 'property'; key: Extract<ManagedMetaKey, `og:${string}`> }
  | { attr: 'name'; key: Extract<ManagedMetaKey, `twitter:${string}`> };

const META_SELECTORS: Record<ManagedMetaKey, MetaSelector> = {
  description: { attr: 'name', key: 'description' },
  robots: { attr: 'name', key: 'robots' },
  'og:type': { attr: 'property', key: 'og:type' },
  'og:site_name': { attr: 'property', key: 'og:site_name' },
  'og:title': { attr: 'property', key: 'og:title' },
  'og:description': { attr: 'property', key: 'og:description' },
  'og:image': { attr: 'property', key: 'og:image' },
  'og:url': { attr: 'property', key: 'og:url' },
  'twitter:card': { attr: 'name', key: 'twitter:card' },
  'twitter:title': { attr: 'name', key: 'twitter:title' },
  'twitter:description': { attr: 'name', key: 'twitter:description' },
  'twitter:image': { attr: 'name', key: 'twitter:image' },
};

const DEFAULT_SOCIAL_IMAGE_PATH = '/logo512.png';
const JSON_LD_PREFIX = 'shop-jsonld-';

const cleanMetaText = (value: unknown, maxLength = 320) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, maxLength);

const hasUnsafeUrlShape = (value: string) => {
  const normalized = value.toLowerCase();
  return value.includes('\\') || normalized.includes('%00') || normalized.includes('%5c');
};

export const resolveSiteOrigin = (origin?: string | null) => {
  const configured = cleanMetaText(origin, 500);
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        return '';
      }
      return parsed.origin;
    } catch (error) {
      reportNonBlockingError('documentMeta.resolveSiteOrigin.configured', error);
      return '';
    }
  }
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }
  return window.location.origin;
};

export const resolveAbsoluteUrl = (pathOrUrl?: string | null, origin?: string | null) => {
  const value = cleanMetaText(pathOrUrl, 2000);
  if (!value || hasUnsafeUrlShape(value)) {
    return '';
  }
  if (/^(data|blob|javascript):/i.test(value)) {
    return '';
  }

  const siteOrigin = resolveSiteOrigin(origin);
  try {
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        return '';
      }
      return parsed.toString();
    }
    if (!siteOrigin) {
      return value.startsWith('/') ? value : '';
    }
    return new URL(value, siteOrigin).toString();
  } catch (error) {
    reportNonBlockingError('documentMeta.resolveAbsoluteUrl', error);
    return '';
  }
};

export const resolveDefaultSocialImageUrl = (origin?: string | null) =>
  resolveAbsoluteUrl(`${process.env.PUBLIC_URL || ''}${DEFAULT_SOCIAL_IMAGE_PATH}` || DEFAULT_SOCIAL_IMAGE_PATH, origin);

const selectorFor = (metaKey: ManagedMetaKey) => {
  const selector = META_SELECTORS[metaKey];
  return `meta[${selector.attr}="${selector.key}"]`;
};

const readMetaContent = (metaKey: ManagedMetaKey) => {
  if (typeof document === 'undefined') return '';
  const node = document.head.querySelector(selectorFor(metaKey));
  return node?.getAttribute('content') || '';
};

const upsertMetaContent = (metaKey: ManagedMetaKey, content: string) => {
  if (typeof document === 'undefined') return;
  const selector = META_SELECTORS[metaKey];
  let node = document.head.querySelector(selectorFor(metaKey)) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(selector.attr, selector.key);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
};

const upsertCanonicalLink = (href: string) => {
  if (typeof document === 'undefined') return;
  let node = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', href);
};

const readCanonicalHref = () => {
  if (typeof document === 'undefined') return '';
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
};

export type DocumentMetaSnapshot = {
  values: Partial<Record<ManagedMetaKey, string>>;
  canonical: string;
};

export const captureDocumentMeta = (): DocumentMetaSnapshot => ({
  values: {
    description: readMetaContent('description'),
    robots: readMetaContent('robots'),
    'og:type': readMetaContent('og:type'),
    'og:site_name': readMetaContent('og:site_name'),
    'og:title': readMetaContent('og:title'),
    'og:description': readMetaContent('og:description'),
    'og:image': readMetaContent('og:image'),
    'og:url': readMetaContent('og:url'),
    'twitter:card': readMetaContent('twitter:card'),
    'twitter:title': readMetaContent('twitter:title'),
    'twitter:description': readMetaContent('twitter:description'),
    'twitter:image': readMetaContent('twitter:image'),
  },
  canonical: readCanonicalHref(),
});

export const restoreDocumentMeta = (snapshot: DocumentMetaSnapshot) => {
  (Object.keys(META_SELECTORS) as ManagedMetaKey[]).forEach((metaKey) => {
    const value = snapshot.values[metaKey];
    if (value) {
      upsertMetaContent(metaKey, value);
      return;
    }
    if (typeof document !== 'undefined') {
      document.head.querySelector(selectorFor(metaKey))?.remove();
    }
  });
  if (snapshot.canonical) {
    upsertCanonicalLink(snapshot.canonical);
    return;
  }
  if (typeof document !== 'undefined') {
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }
};

export const applyDocumentMeta = (input: DocumentMetaInput, origin?: string | null) => {
  const siteOrigin = resolveSiteOrigin(origin);
  const title = cleanMetaText(input.title, 160);
  const description = cleanMetaText(input.description, 320);
  const siteName = cleanMetaText(input.siteName, 120);
  const type = input.type || 'website';
  const path = cleanMetaText(input.path, 500) || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/');
  const canonical = resolveAbsoluteUrl(path.startsWith('/') ? path : `/${path}`, siteOrigin);
  const imageUrl = resolveAbsoluteUrl(input.imageUrl, siteOrigin) || resolveDefaultSocialImageUrl(siteOrigin);

  if (description) {
    upsertMetaContent('description', description);
    upsertMetaContent('og:description', description);
    upsertMetaContent('twitter:description', description);
  }
  if (title) {
    upsertMetaContent('og:title', title);
    upsertMetaContent('twitter:title', title);
  }
  if (siteName) {
    upsertMetaContent('og:site_name', siteName);
  }
  upsertMetaContent('og:type', type);
  upsertMetaContent('twitter:card', imageUrl ? 'summary_large_image' : 'summary');
  if (imageUrl) {
    upsertMetaContent('og:image', imageUrl);
    upsertMetaContent('twitter:image', imageUrl);
  }
  if (canonical) {
    upsertMetaContent('og:url', canonical);
    upsertCanonicalLink(canonical);
  }
  upsertMetaContent('robots', input.noIndex ? 'noindex,nofollow' : 'index,follow');
};

export const serializeJsonLd = (data: Record<string, unknown> | Array<Record<string, unknown>>) =>
  JSON.stringify(data).replace(/</g, '\\u003c');

export const applyJsonLd = (id: string, data: Record<string, unknown> | Array<Record<string, unknown>> | null) => {
  if (typeof document === 'undefined') return;
  const scriptId = `${JSON_LD_PREFIX}${cleanMetaText(id, 80).replace(/[^a-zA-Z0-9_-]/g, '-') || 'block'}`;
  const existing = document.getElementById(scriptId);
  if (!data) {
    existing?.remove();
    return;
  }
  let script = existing as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = scriptId;
    document.head.appendChild(script);
  }
  script.textContent = serializeJsonLd(data);
};

export const removeJsonLd = (id: string) => applyJsonLd(id, null);

export const removeJsonLdByPrefix = (prefix = JSON_LD_PREFIX) => {
  if (typeof document === 'undefined') return;
  Array.from(document.head.querySelectorAll(`script[type="application/ld+json"][id^="${prefix}"]`)).forEach((node) => {
    node.remove();
  });
};
