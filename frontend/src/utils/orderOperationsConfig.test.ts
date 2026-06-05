import { orderSlaHours } from './orderOperationsConfig';

describe('orderOperationsConfig', () => {
  it('keeps return-shipped refund SLA aligned with backend quick filters', () => {
    expect(orderSlaHours.RETURN_SHIPPED).toBe(24);
  });
});
