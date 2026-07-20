import { getApiErrorDiagnosticText, getApiErrorMessage, getApiErrorStatus, isAuthExpiredError } from './apiError';
import { ensureLanguagePack } from '../i18n';
import fs from 'fs';
import path from 'path';

const apiError = (message: string) => ({ response: { data: { error: message } } });
const apiErrorData = (data: Record<string, unknown>) => ({ response: { data } });
const rateLimitedError = (retryAfterSeconds?: number | string) => ({
  response: {
    status: 429,
    data: { code: 'RATE_LIMITED', error: 'Too many requests', retryAfterSeconds },
  },
});
const responseCodeError = (code: string, retryAfterSeconds?: number | string) => ({
  response: {
    data: { code, error: 'Request failed', retryAfterSeconds },
  },
});
const retryAfterAliasError = (retryAfter?: number | string) => ({
  response: {
    status: 429,
    data: { error: 'Too many requests', retryAfter },
  },
});
const apiErrorSource = fs.readFileSync(path.resolve(__dirname, 'apiError.ts'), 'utf8');

describe('getApiErrorMessage', () => {
  beforeAll(async () => {
    // apiErrors catalogs for es/zh are lazy-loaded with language packs.
    await Promise.all([ensureLanguagePack('es'), ensureLanguagePack('zh')]);
  });

  it('keeps retry-after normalization capped and string-alias aware in source', () => {
    const normalizeStart = apiErrorSource.indexOf('const normalizeRetryAfterSeconds = (error: ApiErrorLike) => {');
    const normalizeEnd = apiErrorSource.indexOf('const apiErrorMessage = (', normalizeStart);
    const normalizeSource = apiErrorSource.slice(normalizeStart, normalizeEnd);

    expect(apiErrorSource).toContain('const MAX_RETRY_AFTER_SECONDS = 5 * 60;');
    expect(normalizeStart).toBeGreaterThan(-1);
    expect(normalizeEnd).toBeGreaterThan(normalizeStart);
    expect(normalizeSource).toContain("headers?.get?.('Retry-After')");
    expect(normalizeSource).toContain('error.response?.data?.retryAfterSeconds');
    expect(normalizeSource).toContain('?? error.response?.data?.retryAfter');
    expect(normalizeSource).toContain('const numeric = Number(retryAfterValue);');
    expect(normalizeSource).toContain('if (!Number.isFinite(numeric) || numeric <= 0) return null;');
    expect(normalizeSource).toContain('return Math.min(Math.ceil(numeric), MAX_RETRY_AFTER_SECONDS);');
  });

  it('keeps localized API error source free of stale broad-any parsing paths', () => {
    expect(apiErrorSource).toContain('type ApiErrorLike = {');
    expect(apiErrorSource).toContain('export const getApiErrorStatus = (error: unknown) => {');
    expect(apiErrorSource).toContain('const errorLike = error as ApiErrorLike;');
    expect(apiErrorSource).not.toContain('parseApiError');
    expect(apiErrorSource).not.toContain('as any');
    expect(apiErrorSource).not.toContain('catch (error: any)');
    expect(apiErrorSource).not.toContain('catch (err: any)');
  });

  it('keeps Chinese server-message detection broad enough for rare CJK ranges', () => {
    expect(apiErrorSource).toContain("const hasChineseText = (value: string) => /[\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3400-\\u9fff\\uf900-\\ufaff\\u{20000}-\\u{2a6df}]/u.test(value);");
    expect(getApiErrorMessage(apiError('豈库存不足'), '支付失败', 'zh')).toBe('豈库存不足');
    expect(getApiErrorMessage(apiError('𠀀库存不足'), '支付失败', 'zh')).toBe('𠀀库存不足');
  });

  it('uses server detail for English pages', () => {
    expect(getApiErrorMessage(apiError('Payment link expired'), 'Payment failed', 'en')).toBe('Payment link expired');
  });

  it('keeps backend validation field details for English pages', () => {
    const error = apiErrorData({
      error: 'Validation failed',
      fieldErrors: [
        { field: 'email', message: 'must be a valid email address' },
        { field: 'password', defaultMessage: 'must be at least 12 characters' },
      ],
    });

    expect(getApiErrorDiagnosticText(error))
      .toBe('Validation failed: email: must be a valid email address; password: must be at least 12 characters');
    expect(getApiErrorMessage(error, 'Save failed', 'en'))
      .toBe('Validation failed: email: must be a valid email address; password: must be at least 12 characters');
  });

  it('keeps mapped backend error details instead of collapsing to a generic fallback', () => {
    const error = apiErrorData({
      message: 'Request failed',
      errors: {
        sku: 'already exists',
        price: ['must be positive'],
      },
    });

    expect(getApiErrorMessage(error, 'Save failed', 'en'))
      .toBe('Request failed: sku: already exists; price: must be positive');
  });

  it('keeps non-English pages on localized fallback when the server message is English', () => {
    expect(getApiErrorMessage(apiError('Payment link expired'), '支付失败', 'zh')).toBe('支付失败');
    expect(getApiErrorMessage(apiError('Payment link expired'), 'No se pudo pagar', 'es')).toBe('No se pudo pagar');
  });

  it('allows already-localized server messages', () => {
    expect(getApiErrorMessage(apiError('支付链接已过期'), '支付失败', 'zh')).toBe('支付链接已过期');
    expect(getApiErrorMessage(apiError('El pago ya expiro'), 'No se pudo pagar', 'es')).toBe('El pago ya expiro');
  });

  it('recognizes accented Spanish server messages', () => {
    expect(getApiErrorMessage(apiError('La dirección de envío no es válida'), 'No se pudo pagar', 'es'))
      .toBe('La dirección de envío no es válida');
  });

  it('shows localized retry guidance for rate-limited requests', () => {
    expect(getApiErrorMessage(rateLimitedError(12), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again in 12 seconds.');
    expect(getApiErrorMessage(responseCodeError('RATE_LIMITED', 4), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again in 4 seconds.');
    expect(getApiErrorMessage(rateLimitedError('7'), '支付失败', 'zh'))
      .toBe('请求过于频繁，请在 7 秒后重试。');
    expect(getApiErrorMessage(rateLimitedError(), 'No se pudo pagar', 'es'))
      .toBe('Demasiadas solicitudes. Espera e inténtalo de nuevo.');
  });

  it('normalizes retry-after edge cases for rate-limited responses', () => {
    expect(getApiErrorMessage(retryAfterAliasError('60'), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again in 60 seconds.');
    expect(getApiErrorMessage(rateLimitedError(0.5), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again in 1 second.');
    expect(getApiErrorMessage(rateLimitedError(999), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again in 300 seconds.');
    expect(getApiErrorMessage(rateLimitedError(Number.POSITIVE_INFINITY), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again later.');
    expect(getApiErrorMessage(rateLimitedError(-5), 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again later.');
    expect(getApiErrorMessage({ response: { status: 429 } }, 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again later.');
  });

  it('uses Retry-After headers only for rate-limited responses', () => {
    const headers = {
      get: (name: string) => (name.toLowerCase() === 'retry-after' ? '15' : undefined),
    };

    expect(getApiErrorMessage({ response: { status: 429, headers } }, 'Payment failed', 'en'))
      .toBe('Too many requests. Please try again in 15 seconds.');
    expect(getApiErrorMessage({ response: { status: 400, headers, data: { error: 'Bad request' } } }, 'Payment failed', 'en'))
      .toBe('Bad request');
  });

  it('uses backend service-unavailable codes even when status is unavailable', () => {
    expect(getApiErrorMessage(responseCodeError('SERVICE_UNAVAILABLE'), 'Payment failed', 'en'))
      .toBe('The service is temporarily unavailable. Please try again later.');
    expect(getApiErrorMessage(responseCodeError('LOGIN_SERVICE_UNAVAILABLE'), '支付失败', 'zh'))
      .toBe('服务暂不可用，请稍后重试。');
  });

  it('exposes diagnostic text for classifiers without duplicating response parsing in pages', () => {
    expect(getApiErrorDiagnosticText(apiError('Production logistics tracking provider is not configured')))
      .toBe('Production logistics tracking provider is not configured');
    expect(getApiErrorDiagnosticText(new Error('Local validation failed')))
      .toBe('Local validation failed');
  });

  it('classifies auth-expired API responses from one shared helper', () => {
    expect(getApiErrorStatus({ response: { status: '401' } })).toBe(401);
    expect(isAuthExpiredError({ response: { status: 401 } })).toBe(true);
    expect(isAuthExpiredError({ response: { status: '403' } })).toBe(true);
    expect(isAuthExpiredError({ response: { status: 404 } })).toBe(false);
    expect(isAuthExpiredError(new Error('network'))).toBe(false);
  });

  it('can surface local client errors only when explicitly requested', () => {
    const localError = new Error('Payment method is unavailable');

    expect(getApiErrorMessage(localError, 'Payment failed', 'en')).toBe('Payment failed');
    expect(getApiErrorMessage(localError, 'Payment failed', 'en', { includeClientMessage: true }))
      .toBe('Payment method is unavailable');
  });

  it('keeps language lookup fallback-free for the typed language union', () => {
    const source = fs.readFileSync(__filename.replace(/\.test\.ts$/, '.ts'), 'utf8');

    expect(source).not.toContain('}[language] || undefined');
  });

  it('keeps localizable API error copy in locale resources instead of apiError.ts dictionaries', () => {
    const apiErrorSource = fs.readFileSync(path.resolve(__dirname, 'apiError.ts'), 'utf8');
    const i18nSource = fs.readFileSync(path.resolve(__dirname, '../i18n.tsx'), 'utf8');
    const localeFiles = ['en.json', 'es.json', 'zh.json'].map((file) => (
      fs.readFileSync(path.resolve(__dirname, '../locales', file), 'utf8')
    ));

    expect(i18nSource).toContain('export const translateForLanguage =');
    expect(apiErrorSource).toContain('translateForLanguage(language, `apiErrors.${key}`');
    expect(apiErrorSource).not.toContain('const localMessages =');
    expect(apiErrorSource).not.toContain('网络连接失败，请检查前台 API 代理后重试。');
    expect(apiErrorSource).not.toContain('Falló la conexión de red');
    localeFiles.forEach((localeSource) => {
      expect(localeSource).toContain('"apiErrors"');
      expect(localeSource).toContain('"network"');
      expect(localeSource).toContain('"timeout"');
      expect(localeSource).toContain('"serviceUnavailable"');
      expect(localeSource).toContain('"rateLimited"');
      expect(localeSource).toContain('"rateLimitedWithOneSecond"');
      expect(localeSource).toContain('"rateLimitedWithSeconds"');
    });
  });

  it('keeps F3501 user-facing error handling on shared helpers', () => {
    const sourceFiles = [
      path.resolve(__dirname, '../components/SeventeenTrackWidget.tsx'),
      path.resolve(__dirname, '../pages/Profile.tsx'),
      path.resolve(__dirname, '../pages/Register.tsx'),
    ];
    const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    expect(source).not.toMatch(/response\?\.data\?\.error|response\.data\.error|response\?\.data\?\.message|response\.data\.message/);
    expect(source).not.toMatch(/message\.error\([^)]*(err|error)\.message/);
    expect(source).toContain('getApiErrorDiagnosticText');
    expect(source).toContain('getApiErrorMessage');
  });

  it('keeps auth-expired response parsing centralized for cart and checkout surfaces', () => {
    const apiErrorSource = fs.readFileSync(path.resolve(__dirname, 'apiError.ts'), 'utf8');
    const sourceFiles = [
      path.resolve(__dirname, '../pages/Cart.tsx'),
      path.resolve(__dirname, '../components/CartDrawer.tsx'),
      path.resolve(__dirname, '../pages/Checkout.tsx'),
    ];
    const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    expect(apiErrorSource).toContain('export const isAuthExpiredError = (error: unknown)');
    expect(source).toContain("isAuthExpiredError } from '../utils/apiError'");
    expect(source).not.toMatch(/const isAuthExpiredError\s*=/);
    expect(source).not.toMatch(/status === 401 \|\| status === 403/);
  });
});
