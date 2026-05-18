import {
  auditActionLabels,
  auditActionOptions,
  auditMessageLabels,
  localizedMapValue,
  resourceTypeLabels,
} from './SecurityAuditLogManagement';

jest.mock('../api', () => ({
  adminApi: {},
}));

describe('SecurityAuditLogManagement i18n labels', () => {
  it('localizes audit values while keeping query option values stable', () => {
    expect(auditActionOptions).toContain('PAYMENT_CALLBACK');
    expect(auditActionOptions).toContain('REFUND_COMPLETE');

    expect(localizedMapValue(auditActionLabels, 'zh', 'PAYMENT_CALLBACK')).toBe('支付回调');
    expect(localizedMapValue(auditActionLabels, 'es', 'REFUND_COMPLETE')).toBe('Reembolso completado');
    expect(localizedMapValue(resourceTypeLabels, 'zh', 'PAYMENT')).toBe('支付');
    expect(localizedMapValue(auditMessageLabels, 'zh', 'Payment created')).toBe('支付单已创建');
  });

  it('falls back to English or the raw enum for unmapped languages and actions', () => {
    expect(localizedMapValue(auditActionLabels, 'fr', 'ORDER_EXPORT')).toBe('Order export');
    expect(localizedMapValue(auditActionLabels, 'zh', 'UNKNOWN_ACTION')).toBe('UNKNOWN_ACTION');
    expect(localizedMapValue(auditActionLabels, 'zh')).toBe('-');
  });
});
