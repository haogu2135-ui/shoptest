import { getApiErrorMessage } from './apiError';

const apiError = (message: string) => ({ response: { data: { error: message } } });

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
});
