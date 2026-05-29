export type ShopRuntimeConfig = {
  apiBaseUrl?: string;
  supportWebSocketUrl?: string;
  apiGatewayEnabled?: boolean | string | number;
  apiGatewayPrefix?: string;
};

declare global {
  interface Window {
    __SHOP_RUNTIME_CONFIG__?: ShopRuntimeConfig;
    __SHOP_API_BASE_URL__?: string;
  }
}

const DEFAULT_GATEWAY_PREFIX = '/gateway';

const runtimeConfig = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  return window.__SHOP_RUNTIME_CONFIG__ || {};
};

const cleanString = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = Array.from(String(value), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim();
  return normalized || null;
};

export const normalizeApiBaseUrl = (value: unknown) => {
  const configured = cleanString(value);
  if (!configured) {
    return null;
  }

  if (configured.startsWith('/')) {
    if (configured.startsWith('//')) {
      return null;
    }
    const withoutTrailingSlash = configured.replace(/\/+$/, '');
    return withoutTrailingSlash || '/';
  }

  try {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch (error) {
    return null;
  }
};

export const normalizeSupportWebSocketUrl = (value: unknown) => {
  const configured = cleanString(value);
  if (!configured) {
    return null;
  }

  if (configured.startsWith('/')) {
    if (configured.startsWith('//')) {
      return null;
    }
    const withoutTrailingSlash = configured.replace(/\/+$/, '');
    return withoutTrailingSlash || null;
  }

  try {
    const parsed = new URL(configured);
    if (
      !['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
    ) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch (error) {
    return null;
  }
};

export const resolveApiBaseUrl = () => {
  const runtimeApiBaseUrl = normalizeApiBaseUrl(runtimeConfig().apiBaseUrl);
  if (runtimeApiBaseUrl) {
    return runtimeApiBaseUrl;
  }

  const legacyRuntimeApiBaseUrl = normalizeApiBaseUrl(
    typeof window === 'undefined' ? undefined : window.__SHOP_API_BASE_URL__,
  );
  if (legacyRuntimeApiBaseUrl) {
    return legacyRuntimeApiBaseUrl;
  }

  const buildTimeApiBaseUrl = normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL);
  if (buildTimeApiBaseUrl) {
    return buildTimeApiBaseUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }

  if (typeof window !== 'undefined' && window.location?.protocol && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return 'http://localhost:8080';
};

export const resolveSupportWebSocketUrl = () => {
  const runtimeUrl = normalizeSupportWebSocketUrl(runtimeConfig().supportWebSocketUrl);
  if (runtimeUrl) {
    return runtimeUrl;
  }

  const buildTimeUrl = normalizeSupportWebSocketUrl(process.env.REACT_APP_SUPPORT_WEBSOCKET_URL);
  if (buildTimeUrl) {
    return buildTimeUrl;
  }

  try {
    const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const apiUrl = new URL(resolveApiBaseUrl(), origin);
    if (apiUrl.protocol === 'http:' || apiUrl.protocol === 'https:') {
      apiUrl.pathname = '/ws/support';
      apiUrl.search = '';
      apiUrl.hash = '';
      return apiUrl.toString().replace(/\/+$/, '');
    }
  } catch (error) {
    // Fall through to the same-origin websocket endpoint used by the Nginx templates.
  }

  return '/ws/support';
};

export const normalizeGatewayPrefix = (value: unknown) => {
  const configured = cleanString(value) || DEFAULT_GATEWAY_PREFIX;
  if (/^https?:\/\//i.test(configured) || configured.startsWith('//')) {
    return DEFAULT_GATEWAY_PREFIX;
  }
  const withSlash = configured.startsWith('/') ? configured : `/${configured}`;
  const normalized = withSlash.replace(/\/{2,}/g, '/');
  return normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized;
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  return fallback;
};

export const resolveApiGatewayPrefix = () =>
  normalizeGatewayPrefix(runtimeConfig().apiGatewayPrefix || process.env.REACT_APP_API_GATEWAY_PREFIX);

export const resolveApiGatewayEnabled = () =>
  normalizeBoolean(
    runtimeConfig().apiGatewayEnabled !== undefined
      ? runtimeConfig().apiGatewayEnabled
      : process.env.REACT_APP_API_GATEWAY_ENABLED,
    false,
  );
