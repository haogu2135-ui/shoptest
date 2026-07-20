import { resolveAbsoluteUrl, resolveSiteOrigin } from './documentMeta';

export type ProductStructuredDataInput = {
  id: number | string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
  brand?: string | null;
  price?: number | null;
  currency?: string | null;
  stock?: number | null;
  path?: string | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  sku?: string | null;
};

export type BreadcrumbStructuredDataItem = {
  name: string;
  path?: string | null;
};

export type WebsiteStructuredDataInput = {
  name: string;
  description?: string | null;
  path?: string | null;
  searchPathTemplate?: string | null;
};

const cleanText = (value: unknown, maxLength = 500) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, maxLength);

const normalizeCurrency = (value?: string | null) => {
  const currency = cleanText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'MXN';
};

const normalizePrice = (value?: number | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric.toFixed(2);
};

const uniqueAbsoluteImages = (images: Array<string | null | undefined>, origin?: string | null) => {
  const seen = new Set<string>();
  const result: string[] = [];
  images.forEach((image) => {
    const absolute = resolveAbsoluteUrl(image, origin);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    result.push(absolute);
  });
  return result.slice(0, 8);
};

export const buildProductStructuredData = (
  input: ProductStructuredDataInput,
  origin?: string | null,
): Record<string, unknown> | null => {
  const name = cleanText(input.name, 180);
  if (!name) return null;

  const siteOrigin = resolveSiteOrigin(origin);
  const path = cleanText(input.path, 300) || `/products/${input.id}`;
  const url = resolveAbsoluteUrl(path.startsWith('/') ? path : `/${path}`, siteOrigin);
  const images = uniqueAbsoluteImages(
    [input.imageUrl, ...(Array.isArray(input.images) ? input.images : [])],
    siteOrigin,
  );
  const price = normalizePrice(input.price);
  const currency = normalizeCurrency(input.currency);
  const stock = Number(input.stock);
  const availability = Number.isFinite(stock) && stock <= 0
    ? 'https://schema.org/OutOfStock'
    : 'https://schema.org/InStock';
  const brandName = cleanText(input.brand, 120);
  const description = cleanText(input.description, 500);
  const sku = cleanText(input.sku || String(input.id), 80);
  const reviewCount = Number(input.reviewCount);
  const averageRating = Number(input.averageRating);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    sku,
  };

  if (description) data.description = description;
  if (images.length === 1) data.image = images[0];
  if (images.length > 1) data.image = images;
  if (brandName) {
    data.brand = {
      '@type': 'Brand',
      name: brandName,
    };
  }
  if (url && price) {
    data.offers = {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price,
      availability,
      itemCondition: 'https://schema.org/NewCondition',
    };
  }
  if (Number.isFinite(averageRating) && averageRating > 0 && Number.isFinite(reviewCount) && reviewCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: averageRating.toFixed(1),
      reviewCount: Math.floor(reviewCount),
    };
  }

  return data;
};

export const buildBreadcrumbStructuredData = (
  items: BreadcrumbStructuredDataItem[],
  origin?: string | null,
): Record<string, unknown> | null => {
  const siteOrigin = resolveSiteOrigin(origin);
  const list = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const name = cleanText(item.name, 120);
      if (!name) return null;
      const entry: Record<string, unknown> = {
        '@type': 'ListItem',
        position: index + 1,
        name,
      };
      const path = cleanText(item.path, 300);
      if (path) {
        const itemUrl = resolveAbsoluteUrl(path.startsWith('/') ? path : `/${path}`, siteOrigin);
        if (itemUrl) entry.item = itemUrl;
      }
      return entry;
    })
    .filter((item): item is Record<string, unknown> => Boolean(item));

  if (list.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list,
  };
};

export const buildWebsiteStructuredData = (
  input: WebsiteStructuredDataInput,
  origin?: string | null,
): Record<string, unknown> | null => {
  const name = cleanText(input.name, 120);
  if (!name) return null;
  const siteOrigin = resolveSiteOrigin(origin);
  const path = cleanText(input.path, 300) || '/';
  const url = resolveAbsoluteUrl(path.startsWith('/') ? path : `/${path}`, siteOrigin);
  const description = cleanText(input.description, 320);
  const searchTemplate = cleanText(input.searchPathTemplate, 300);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
  };
  if (url) data.url = url;
  if (description) data.description = description;
  if (searchTemplate) {
    const pathPart = searchTemplate.split('?')[0] || '/';
    const queryPart = searchTemplate.includes('?') ? searchTemplate.slice(searchTemplate.indexOf('?') + 1) : '';
    const absolutePath = resolveAbsoluteUrl(pathPart.startsWith('/') ? pathPart : `/${pathPart}`, siteOrigin);
    if (absolutePath) {
      const query = queryPart.includes('{search_term_string}')
        ? queryPart
        : `${queryPart ? `${queryPart}&` : ''}keyword={search_term_string}`;
      data.potentialAction = {
        '@type': 'SearchAction',
        target: `${absolutePath}?${query}`,
        'query-input': 'required name=search_term_string',
      };
    }
  }
  return data;
};

export type ItemListStructuredDataInput = {
  name: string;
  description?: string | null;
  path?: string | null;
  items: Array<{
    id: number | string;
    name: string;
    path?: string | null;
    imageUrl?: string | null;
    price?: number | null;
    currency?: string | null;
  }>;
};

export const buildItemListStructuredData = (
  input: ItemListStructuredDataInput,
  origin?: string | null,
): Record<string, unknown> | null => {
  const name = cleanText(input.name, 180);
  if (!name) return null;

  const siteOrigin = resolveSiteOrigin(origin);
  const listPath = cleanText(input.path, 300) || '/products';
  const listUrl = resolveAbsoluteUrl(listPath.startsWith('/') ? listPath : `/${listPath}`, siteOrigin);
  const description = cleanText(input.description, 320);

  const elements = (Array.isArray(input.items) ? input.items : [])
    .slice(0, 24)
    .map((item, index) => {
      const itemName = cleanText(item.name, 180);
      if (!itemName) return null;
      const itemPath = cleanText(item.path, 300) || `/products/${item.id}`;
      const itemUrl = resolveAbsoluteUrl(itemPath.startsWith('/') ? itemPath : `/${itemPath}`, siteOrigin);
      const image = resolveAbsoluteUrl(item.imageUrl, siteOrigin);
      const price = normalizePrice(item.price);
      const currency = normalizeCurrency(item.currency);

      const listItem: Record<string, unknown> = {
        '@type': 'ListItem',
        position: index + 1,
        name: itemName,
      };
      if (itemUrl) listItem.url = itemUrl;

      const productNode: Record<string, unknown> = {
        '@type': 'Product',
        name: itemName,
      };
      if (itemUrl) productNode.url = itemUrl;
      if (image) productNode.image = image;
      if (price) {
        productNode.offers = {
          '@type': 'Offer',
          price,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        };
        if (itemUrl) (productNode.offers as Record<string, unknown>).url = itemUrl;
      }
      listItem.item = productNode;
      return listItem;
    })
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));

  if (!elements.length) return null;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: elements.length,
    itemListElement: elements,
  };
  if (listUrl) data.url = listUrl;
  if (description) data.description = description;
  return data;
};
