import { translateForLanguage } from '../i18n';
import type { Language, TranslationParams } from '../i18n';

type ApiErrorData = {
  code?: string;
  error?: string;
  message?: string;
  retryAfter?: number | string;
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
  const retryAfterValue = error.response?.data?.retryAfterSeconds
    ?? error.response?.data?.retryAfter
    ?? headerValue;
  const numeric = Number(retryAfterValue);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.min(Math.ceil(numeric), MAX_RETRY_AFTER_SECONDS);
};

const apiErrorMessage = (
  language: Language,
  key: string,
  defaultValue: string,
  params: TranslationParams = {},
) => translateForLanguage(language, `apiErrors.${key}`, { defaultValue, ...params });

export const getApiErrorMessage = (
  error: unknown,
  fallback: string,
  language: Language = 'en',
  options: ApiErrorMessageOptions = {},
) => {
  const errorLike = error as ApiErrorLike;
  const errorText = String(errorLike.message || '');
  if (!errorLike.response) {
    if (errorLike.code === 'ECONNABORTED' || /timeout/i.test(errorText)) {
      return apiErrorMessage(language, 'timeout', fallback);
    }
    if (/network error|failed to fetch|load failed/i.test(errorText)) {
      return apiErrorMessage(language, 'network', fallback);
    }
    if (options.includeClientMessage && errorText.trim()) {
      return errorText.trim();
    }
    return fallback;
  }
  const responseMessage = errorLike.response?.data;
  const responseCode = String(responseMessage?.code || '').trim();
  const status = Number(errorLike.response?.status);
  if (responseCode === 'LOGIN_SERVICE_UNAVAILABLE' || responseCode === 'SERVICE_UNAVAILABLE' || status === 503) {
    return apiErrorMessage(language, 'serviceUnavailable', fallback);
  }
  if (responseCode === 'RATE_LIMITED' || status === 429) {
    const retryAfterSeconds = normalizeRetryAfterSeconds(errorLike);
    return retryAfterSeconds
      ? apiErrorMessage(
        language,
        retryAfterSeconds === 1 ? 'rateLimitedWithOneSecond' : 'rateLimitedWithSeconds',
        fallback,
        { seconds: retryAfterSeconds },
      )
      : apiErrorMessage(language, 'rateLimited', fallback);
  }
  const serverMessage = getApiErrorDiagnosticText(errorLike);

  if (!serverMessage) return fallback;
  if (language === 'en') return serverMessage;
  if (language === 'zh') return hasChineseText(serverMessage) ? serverMessage : fallback;
  if (language === 'es') return hasSpanishSignal(serverMessage) ? serverMessage : fallback;
  return fallback;
};
