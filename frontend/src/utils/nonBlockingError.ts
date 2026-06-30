type RuntimeConfigWithClientErrorReporting = {
  apiBaseUrl?: unknown;
  clientErrorReportUrl?: unknown;
  clientErrorReportingEnabled?: unknown;
};

type ClientErrorReportPayload = {
  context: string;
  name?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  path?: string;
  userAgent?: string;
  appVersion?: string;
  source: string;
  occurredAt: string;
};

type ErrorDetails = {
  name?: string;
  message: string;
  stack?: string;
  componentStack?: string;
};

const REPORT_ENDPOINT_PATH = '/errors';
const MAX_CONTEXT_LENGTH = 120;
const MAX_NAME_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_STACK_LENGTH = 4000;
const MAX_COMPONENT_STACK_LENGTH = 4000;
const MAX_PATH_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 240;
const MAX_APP_VERSION_LENGTH = 80;
const MAX_REPORTS_PER_MINUTE = 10;
const REPORT_WINDOW_MS = 60_000;
const DEDUPE_WINDOW_MS = 10_000;
const MAX_KEEPALIVE_BYTES = 60_000;

const SENSITIVE_KEY_WORDS = 'password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|credential|api[_-]?key|access[_-]?key|private[_-]?key|auth[_-]?header|authorization|signature|webhook[_-]?secret|callback[_-]?secret|cookie|set[_-]?cookie|session[_-]?id|jsessionid|id[_-]?card|card[_-]?number|cvv|cvc|phone|email';
const KEY_VALUE_PATTERN = new RegExp(`(\\b(?:${SENSITIVE_KEY_WORDS})\\b\\s*[=:]\\s*)((?:Bearer|Basic)\\s+)?([^,\\s;&}]+)`, 'gi');
const JSON_VALUE_PATTERN = new RegExp(`(["']?(?:${SENSITIVE_KEY_WORDS})["']?\\s*:\\s*["']?)((?:Bearer|Basic)\\s+)?([^"',;\\s}]+)(["']?)`, 'gi');
const QUERY_VALUE_PATTERN = new RegExp(`([?&;](?:${SENSITIVE_KEY_WORDS})=)((?:Bearer|Basic)\\s+)?([^&;\\s]+)`, 'gi');
const AUTH_HEADER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const COOKIE_HEADER_PATTERN = /\b(Set-Cookie|Cookie)\s*:\s*[^\r\n]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const STRIPE_KEY_PATTERN = /\b(?:sk|pk|rk|whsec)_(?:test|live)_[A-Za-z0-9]{8,}\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

let reportTimestamps: number[] = [];
const recentReports = new Map<string, number>();
let errorListener: ((event: ErrorEvent) => void) | null = null;
let rejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;

const runtimeConfig = (): RuntimeConfigWithClientErrorReporting => {
  if (typeof window === 'undefined') return {};
  return ((window as Window & {
    __SHOP_RUNTIME_CONFIG__?: RuntimeConfigWithClientErrorReporting;
  }).__SHOP_RUNTIME_CONFIG__) || {};
};

const legacyApiBaseUrl = () => {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { __SHOP_API_BASE_URL__?: unknown }).__SHOP_API_BASE_URL__;
};

const cleanString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
};

const maskSensitiveData = (value: string) => {
  let masked = value.replace(KEY_VALUE_PATTERN, '$1$2******');
  masked = masked.replace(JSON_VALUE_PATTERN, '$1$2******$4');
  masked = masked.replace(QUERY_VALUE_PATTERN, '$1$2******');
  masked = masked.replace(AUTH_HEADER_PATTERN, '$1 ******');
  masked = masked.replace(COOKIE_HEADER_PATTERN, '$1: ******');
  masked = masked.replace(JWT_PATTERN, 'jwt.******');
  masked = masked.replace(STRIPE_KEY_PATTERN, 'stripe_key_******');
  masked = masked.replace(EMAIL_PATTERN, 'email******');
  return masked;
};

const normalizeText = (value: unknown, maxLength: number) => {
  const cleaned = cleanString(value);
  if (!cleaned) return '';
  return maskSensitiveData(cleaned).slice(0, maxLength);
};

const normalizeStack = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null) return '';
  const normalized = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 16)
    .join('\n');
  return maskSensitiveData(normalized).slice(0, maxLength);
};

const objectKeysSummary = (value: Record<string, unknown>) => {
  const keys = Object.keys(value).filter((key) => key !== 'error' && key !== 'componentStack').slice(0, 6);
  return keys.length ? `Non-Error object keys: ${keys.join(',')}` : 'Non-Error object';
};

const extractErrorDetails = (error: unknown): ErrorDetails => {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Error',
      stack: error.stack,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const nested = record.error;
    const componentStack = typeof record.componentStack === 'string' ? record.componentStack : undefined;
    if (nested instanceof Error) {
      return {
        ...extractErrorDetails(nested),
        componentStack,
      };
    }

    const message = typeof record.message === 'string' ? record.message : objectKeysSummary(record);
    const name = typeof record.name === 'string'
      ? record.name
      : Object.prototype.toString.call(error).replace(/^\[object\s+|\]$/g, '') || 'Object';
    return {
      name,
      message,
      componentStack,
    };
  }

  if (error === undefined || error === null) {
    return { message: 'Unknown non-blocking error' };
  }
  return {
    name: typeof error,
    message: String(error),
  };
};

const hasUnsafeUrlShape = (value: string) => {
  const normalized = value.toLowerCase();
  return value.includes('\\') || normalized.includes('%00') || normalized.includes('%5c');
};

const normalizeEndpointUrl = (value: unknown) => {
  const configured = cleanString(value);
  if (!configured || hasUnsafeUrlShape(configured)) return null;

  if (configured.startsWith('/')) {
    if (configured.startsWith('//')) return null;
    return configured.replace(/\/+$/, '') || REPORT_ENDPOINT_PATH;
  }

  try {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch (_error) {
    return null;
  }
};

const normalizeApiBaseUrl = (value: unknown) => {
  const configured = normalizeEndpointUrl(value);
  if (!configured) return null;
  return configured;
};

const resolveApiBaseUrl = () => {
  const runtimeApiBaseUrl = normalizeApiBaseUrl(runtimeConfig().apiBaseUrl);
  if (runtimeApiBaseUrl) return runtimeApiBaseUrl;

  const legacyRuntimeApiBaseUrl = normalizeApiBaseUrl(legacyApiBaseUrl());
  if (legacyRuntimeApiBaseUrl) return legacyRuntimeApiBaseUrl;

  const buildTimeApiBaseUrl = normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL);
  if (buildTimeApiBaseUrl) return buildTimeApiBaseUrl;

  if (process.env.NODE_ENV === 'production') return '/api';

  if (typeof window !== 'undefined' && window.location?.protocol && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return 'http://localhost:8080';
};

const resolveClientErrorReportUrl = () => {
  const explicitUrl = normalizeEndpointUrl(runtimeConfig().clientErrorReportUrl || process.env.REACT_APP_CLIENT_ERROR_REPORT_URL);
  if (explicitUrl) return explicitUrl;

  const baseUrl = resolveApiBaseUrl().replace(/\/+$/, '');
  if (!baseUrl || baseUrl === '/') return REPORT_ENDPOINT_PATH;
  return `${baseUrl}${REPORT_ENDPOINT_PATH}`;
};

const normalizeBoolean = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
};

const remoteReportingEnabled = () => normalizeBoolean(
  runtimeConfig().clientErrorReportingEnabled !== undefined
    ? runtimeConfig().clientErrorReportingEnabled
    : process.env.REACT_APP_CLIENT_ERROR_REPORTING,
  process.env.NODE_ENV !== 'test',
);
const shouldLogClientErrorsToConsole = () => process.env.NODE_ENV !== 'production';

const currentPath = () => {
  if (typeof window === 'undefined' || !window.location) return '';
  return normalizeText(window.location.pathname || '/', MAX_PATH_LENGTH) || '/';
};

const currentUserAgent = () => {
  if (typeof navigator === 'undefined') return '';
  return normalizeText(navigator.userAgent, MAX_USER_AGENT_LENGTH);
};

const currentAppVersion = () => normalizeText(process.env.REACT_APP_VERSION, MAX_APP_VERSION_LENGTH);

export const buildNonBlockingErrorReport = (context: string, error: unknown): ClientErrorReportPayload => {
  const details = extractErrorDetails(error);
  const payload: ClientErrorReportPayload = {
    context: normalizeText(context, MAX_CONTEXT_LENGTH) || 'unknown',
    message: normalizeText(details.message, MAX_MESSAGE_LENGTH) || 'Unknown non-blocking error',
    path: currentPath(),
    userAgent: currentUserAgent(),
    source: 'frontend',
    occurredAt: new Date().toISOString(),
  };

  const name = normalizeText(details.name, MAX_NAME_LENGTH);
  const stack = normalizeStack(details.stack, MAX_STACK_LENGTH);
  const componentStack = normalizeStack(details.componentStack, MAX_COMPONENT_STACK_LENGTH);
  const appVersion = currentAppVersion();

  if (name) payload.name = name;
  if (stack) payload.stack = stack;
  if (componentStack) payload.componentStack = componentStack;
  if (appVersion) payload.appVersion = appVersion;

  return payload;
};

const shouldSendReport = (payload: ClientErrorReportPayload) => {
  const now = Date.now();
  reportTimestamps = reportTimestamps.filter((timestamp) => now - timestamp < REPORT_WINDOW_MS);
  Array.from(recentReports.entries()).forEach(([fingerprint, timestamp]) => {
    if (now - timestamp >= DEDUPE_WINDOW_MS) recentReports.delete(fingerprint);
  });

  const fingerprint = `${payload.context}|${payload.message}|${payload.path || ''}`;
  const recentTimestamp = recentReports.get(fingerprint);
  if (recentTimestamp && now - recentTimestamp < DEDUPE_WINDOW_MS) {
    return false;
  }
  if (reportTimestamps.length >= MAX_REPORTS_PER_MINUTE) {
    return false;
  }
  reportTimestamps.push(now);
  recentReports.set(fingerprint, now);
  return true;
};

const sendRemoteReport = (payload: ClientErrorReportPayload) => {
  if (!remoteReportingEnabled() || !shouldSendReport(payload)) return;

  const url = resolveClientErrorReportUrl();
  const body = JSON.stringify(payload);

  try {
    const beaconSender = typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { sendBeacon?: (url: string, data?: BodyInit | null) => boolean }).sendBeacon;
    if (beaconSender && typeof Blob !== 'undefined' && body.length <= MAX_KEEPALIVE_BYTES) {
      const accepted = beaconSender.call(navigator, url, new Blob([body], { type: 'application/json' }));
      if (accepted) return;
    }

    if (typeof fetch === 'function') {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: body.length <= MAX_KEEPALIVE_BYTES,
        credentials: 'omit',
      }).catch(() => undefined);
    }
  } catch (_error) {
    if (shouldLogClientErrorsToConsole() && typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[shop] client error report dispatch skipped', _error);
    }
  }
};

export const reportNonBlockingError = (context: string, error: unknown) => {
  if (shouldLogClientErrorsToConsole() && typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[shop] ${context}`, error);
  }
  sendRemoteReport(buildNonBlockingErrorReport(context, error));
};

export const installGlobalErrorReporting = () => {
  if (typeof window === 'undefined' || errorListener || rejectionListener) return;

  errorListener = (event: ErrorEvent) => {
    reportNonBlockingError('window.error', event.error || event.message || 'Window error');
  };
  rejectionListener = (event: PromiseRejectionEvent) => {
    reportNonBlockingError('window.unhandledrejection', event.reason || 'Unhandled promise rejection');
  };

  window.addEventListener('error', errorListener);
  window.addEventListener('unhandledrejection', rejectionListener);
};

export const resetNonBlockingErrorReportingForTest = () => {
  reportTimestamps = [];
  recentReports.clear();
  if (typeof window !== 'undefined') {
    if (errorListener) window.removeEventListener('error', errorListener);
    if (rejectionListener) window.removeEventListener('unhandledrejection', rejectionListener);
  }
  errorListener = null;
  rejectionListener = null;
};
