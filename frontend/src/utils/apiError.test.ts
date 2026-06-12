import { getApiErrorDiagnosticText, getApiErrorMessage, getApiErrorStatus, isAuthExpiredError } from './apiError';
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

describe('getApiErrorMessage', () => {
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
    expect(getApiErrorMessage(rateLimitedError('7'), '支付失败', 'zh'))
      .toBe('请求过于频繁，请在 7 秒后重试。');
    expect(getApiErrorMessage(rateLimitedError(), 'No se pudo pagar', 'es'))
      .toBe('Demasiadas solicitudes. Espera e inténtalo de nuevo.');
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
