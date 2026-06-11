import { getApiErrorMessage, getApiErrorStatus, isAuthExpiredError } from './apiError';

const apiError = (message: string) => ({ response: { data: { error: message } } });
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

  it('classifies auth-expired API responses from one shared helper', () => {
    expect(getApiErrorStatus({ response: { status: '401' } })).toBe(401);
    expect(isAuthExpiredError({ response: { status: 401 } })).toBe(true);
    expect(isAuthExpiredError({ response: { status: '403' } })).toBe(true);
    expect(isAuthExpiredError({ response: { status: 404 } })).toBe(false);
    expect(isAuthExpiredError(new Error('network'))).toBe(false);
  });
});
