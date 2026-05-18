import {
  SUPPORT_ORDER_MESSAGE_PREFIX,
  decodeSupportOrderMessage,
  encodeSupportOrderMessage,
  normalizeSupportOrderContext,
} from './supportOrderMessage';
import type { Order } from '../types';

const validOrder = {
  id: 12,
  orderNo: 'ORD-12',
  status: 'PAID',
  totalAmount: 24.5,
  paymentMethod: 'card',
  createdAt: '2026-05-16T10:00:00',
};

describe('supportOrderMessage', () => {
  it('decodes valid order payloads', () => {
    expect(decodeSupportOrderMessage(`${SUPPORT_ORDER_MESSAGE_PREFIX}${JSON.stringify(validOrder)}`)).toEqual(validOrder);
  });

  it('ignores non-order messages and malformed json', () => {
    expect(decodeSupportOrderMessage('hello')).toBeNull();
    expect(decodeSupportOrderMessage(`${SUPPORT_ORDER_MESSAGE_PREFIX}{bad`)).toBeNull();
  });

  it('rejects payloads without a safe positive id', () => {
    expect(normalizeSupportOrderContext({ ...validOrder, id: 0 })).toBeNull();
    expect(normalizeSupportOrderContext({ ...validOrder, id: Number.NaN })).toBeNull();
    expect(normalizeSupportOrderContext({ ...validOrder, id: 1.5 })).toBeNull();
  });

  it('rejects payloads without a usable status', () => {
    expect(normalizeSupportOrderContext({ ...validOrder, status: '' })).toBeNull();
    expect(normalizeSupportOrderContext({ ...validOrder, status: null })).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(normalizeSupportOrderContext(null)).toBeNull();
    expect(normalizeSupportOrderContext([])).toBeNull();
    expect(normalizeSupportOrderContext('order')).toBeNull();
  });

  it('normalizes optional text and unsafe totals', () => {
    const decoded = normalizeSupportOrderContext({
      ...validOrder,
      orderNo: ` ${'A'.repeat(100)} `,
      totalAmount: Infinity,
      paymentMethod: ` ${'P'.repeat(80)} `,
    });
    expect(decoded?.orderNo).toHaveLength(80);
    expect(decoded?.paymentMethod).toHaveLength(60);
    expect(decoded?.totalAmount).toBe(0);
  });

  it('encodes only the safe order context used by chat', () => {
    expect(encodeSupportOrderMessage(validOrder as Order)).toBe(`${SUPPORT_ORDER_MESSAGE_PREFIX}${JSON.stringify(validOrder)}`);
  });
});
