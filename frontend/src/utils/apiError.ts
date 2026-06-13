import type { Language } from '../i18n';

type ApiErrorData = {
  code?: string;
  error?: string;
  message?: string;
  retryAfterSeconds?: number | string;
  details?: unknown;
  detail?: unknown;
  errors?: unknown;
  fieldErrors?: unknown;
  validationErrors?: unknown;
};

type ApiErrorLike = {
  code?: string;
  message?: string;
  response?: {
    status?: unknown;
    data?: ApiErrorData;
    headers?: Record<string, unknown> & {
      get?: (name: string) => unknown;
    };
  };
};

type ApiErrorMessageOptions = {
  includeClientMessage?: boolean;
};

const MAX_ERROR_DETAIL_ITEMS = 4;
const MAX_ERROR_DETAIL_LENGTH = 180;
const MAX_RETRY_AFTER_SECONDS = 5 * 60;

const hasChineseText = (value: string) => /[\u2e80-\u2eff\u2f00-\u2fdf\u3400-\u9fff\uf900-\ufaff\u{20000}-\u{2a6df}]/u.test(value);
const hasSpanishSignal = (value: string) =>
  /[áéíóúñü¿¡]/i.test(value) || /\b(el|la|los|las|un|una|pedido|pago|usuario|correo|contraseña|direccion|dirección|envio|envío|reembolso)\b/i.test(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeErrorText = (value: unknown) => {
  if (value === undefined || value === null) return '';
  const normalized = String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > MAX_ERROR_DETAIL_LENGTH
    ? `${normalized.slice(0, MAX_ERROR_DETAIL_LENGTH - 1).trim()}…`
    : normalized;
};

const compactErrorTexts = (values: string[]) => {
  const seen = new Set<string>();
  return values
    .map(normalizeErrorText)
    .filter((value) => {
      if (!value || seen.has(value.toLowerCase())) return false;
      seen.add(value.toLowerCase());
      return true;
    })
    .slice(0, MAX_ERROR_DETAIL_ITEMS);
};

const errorDetailTexts = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(errorDetailTexts);
  }
  if (!isRecord(value)) {
    return compactErrorTexts([normalizeErrorText(value)]);
  }

  const field = normalizeErrorText(value.field ?? value.name ?? value.property ?? value.path);
  const message = normalizeErrorText(value.message ?? value.defaultMessage ?? value.error ?? value.detail);
  if (field && message) {
    return [`${field}: ${message}`];
  }
  if (message) {
    return [message];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    if (Array.isArray(entry)) {
      return entry.flatMap((item) => {
        const itemText = normalizeErrorText(item);
        return itemText ? [`${key}: ${itemText}`] : [];
      });
    }
    if (isRecord(entry)) {
      return errorDetailTexts({ field: key, ...entry });
    }
    const entryText = normalizeErrorText(entry);
    return entryText ? [`${key}: ${entryText}`] : [];
  });
};

const responseDetailTexts = (data?: ApiErrorData) => {
  if (!data) return [];
  return compactErrorTexts([
    ...errorDetailTexts(data.detail),
    ...errorDetailTexts(data.details),
    ...errorDetailTexts(data.errors),
    ...errorDetailTexts(data.fieldErrors),
    ...errorDetailTexts(data.validationErrors),
  ]);
};

export const getApiErrorDiagnosticText = (error: unknown) => {
  const errorLike = error as ApiErrorLike;
  const responseMessage = errorLike.response?.data;
  const primary = normalizeErrorText(responseMessage?.error || responseMessage?.message || errorLike.message);
  const details = responseDetailTexts(responseMessage)
    .filter((item) => item.toLowerCase() !== primary.toLowerCase());
  if (!primary) return details.join('; ');
  return details.length ? `${primary}: ${details.join('; ')}` : primary;
};

export const getApiErrorStatus = (error: unknown) => {
  const status = Number((error as ApiErrorLike | null | undefined)?.response?.status);
  return Number.isFinite(status) ? status : null;
};

export const isAuthExpiredError = (error: unknown) => {
  const status = getApiErrorStatus(error);
  return status === 401 || status === 403;
};

const normalizeRetryAfterSeconds = (error: ApiErrorLike) => {
  const headers = error.response?.headers;
  const headerValue = headers?.get?.('Retry-After')
    ?? headers?.get?.('retry-after')
    ?? headers?.['Retry-After']
    ?? headers?.['retry-after'];
  const numeric = Number(error.response?.data?.retryAfterSeconds ?? headerValue);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.min(Math.ceil(numeric), MAX_RETRY_AFTER_SECONDS);
};

export const getApiErrorMessage = (
  error: unknown,
  fallback: string,
  language: Language = 'en',
  options: ApiErrorMessageOptions = {},
) => {
  const errorLike = error as ApiErrorLike;
  const errorText = String(errorLike.message || '');
  const localMessages = {
    en: {
      network: 'Network connection failed. Please check the storefront API proxy and try again.',
      timeout: 'The request timed out. Please try again.',
      serviceUnavailable: 'The service is temporarily unavailable. Please try again later.',
      rateLimited: (seconds: number | null) => seconds
        ? `Too many requests. Please try again in ${seconds} seconds.`
        : 'Too many requests. Please wait and try again.',
    },
    zh: {
      network: '网络连接失败，请检查前台 API 代理后重试。',
      timeout: '请求超时，请稍后重试。',
      serviceUnavailable: '服务暂不可用，请稍后重试。',
      rateLimited: (seconds: number | null) => seconds
        ? `请求过于频繁，请在 ${seconds} 秒后重试。`
        : '请求过于频繁，请稍后重试。',
    },
    es: {
      network: 'Falló la conexión de red. Verifica el proxy API de la tienda e inténtalo de nuevo.',
      timeout: 'La solicitud agotó el tiempo. Inténtalo de nuevo.',
      serviceUnavailable: 'El servicio no está disponible temporalmente. Inténtalo más tarde.',
      rateLimited: (seconds: number | null) => seconds
        ? `Demasiadas solicitudes. Inténtalo de nuevo en ${seconds} segundos.`
        : 'Demasiadas solicitudes. Espera e inténtalo de nuevo.',
    },
  }[language];
  if (!errorLike.response) {
    if (errorLike.code === 'ECONNABORTED' || /timeout/i.test(errorText)) {
      return localMessages?.timeout || fallback;
    }
    if (/network error|failed to fetch|load failed/i.test(errorText)) {
      return localMessages?.network || fallback;
    }
    if (options.includeClientMessage && errorText.trim()) {
      return errorText.trim();
    }
    return fallback;
  }
  const responseMessage = errorLike.response?.data;
  const responseCode = String(responseMessage?.code || '').trim();
  const status = Number(errorLike.response?.status);
  if (responseCode === 'LOGIN_SERVICE_UNAVAILABLE' || status === 503) {
    return localMessages?.serviceUnavailable || fallback;
  }
  if (responseCode === 'RATE_LIMITED' || status === 429) {
    return localMessages?.rateLimited(normalizeRetryAfterSeconds(errorLike)) || fallback;
  }
  const serverMessage = getApiErrorDiagnosticText(errorLike);

  if (!serverMessage) return fallback;
  if (language === 'en') return serverMessage;
  if (language === 'zh') return hasChineseText(serverMessage) ? serverMessage : fallback;
  if (language === 'es') return hasSpanishSignal(serverMessage) ? serverMessage : fallback;
  return fallback;
};
