import {
  buildSupportOrderWorkflowActions,
  findSupportOrderWorkflowActionByMessage,
} from './supportWorkflow';

describe('supportWorkflow', () => {
  it('builds localized order workflow actions for payment follow-up', () => {
    const actions = buildSupportOrderWorkflowActions(
      { id: 8, orderNo: 'ORD-8', status: 'PENDING_PAYMENT' },
      'en',
      'Pending payment'
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      key: 'PENDING_PAYMENT-Check payment-0',
      label: 'Check payment',
      helper: 'For failed payment, duplicate charge, or a stale payment state',
    });
    expect(actions[0].customerPrefill).toContain('Order ORD-8 is currently Pending payment');
    expect(actions[0].adminReply).toContain('order ORD-8 (Pending payment)');
  });

  it('returns multiple shipment actions with Spanish copy', () => {
    const actions = buildSupportOrderWorkflowActions(
      { id: 9, orderNo: 'MX-9', status: 'PENDING_SHIPMENT' },
      'es',
      'Pendiente de envío'
    );

    expect(actions.map((action) => action.label)).toEqual(['Acelerar envío', 'Cambiar dirección']);
    expect(actions[0].customerPrefill).toContain('El pedido MX-9 está en estado Pendiente de envío');
    expect(actions[1].adminReply).toContain('MX-9 (Pendiente de envío)');
  });

  it('falls back to a clear next-step action for unknown statuses and missing order numbers', () => {
    const actions = buildSupportOrderWorkflowActions(
      { id: 42, orderNo: '', status: 'MANUAL_REVIEW' },
      'zh',
      '人工审核'
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      key: 'MANUAL_REVIEW-给出下一步-0',
      label: '给出下一步',
    });
    expect(actions[0].customerPrefill).toContain('订单 #42');
    expect(actions[0].adminReply).toContain('#42（人工审核）');
  });

  it('matches workflow messages after whitespace normalization for both actors', () => {
    const actions = buildSupportOrderWorkflowActions(
      { id: 12, orderNo: 'ORD-12', status: 'SHIPPED' },
      'en',
      'Shipped'
    );

    expect(findSupportOrderWorkflowActionByMessage(
      actions,
      'Order ORD-12 is currently Shipped.\nPlease help me check the latest shipment progress and whether there is any delay or exception.'
    )?.label).toBe('Check tracking');
    expect(findSupportOrderWorkflowActionByMessage(
      actions,
      'I am checking the latest delivery progress for order ORD-12 (Shipped) and will share the latest update shortly.',
      'admin'
    )?.label).toBe('Check tracking');
    expect(findSupportOrderWorkflowActionByMessage(actions, 'unrelated')).toBeNull();
  });
});
