import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
  RETURN_REASON_MIN_LENGTH,
  RETURN_REASON_PRESET_KEYS,
} from './returnFlow';

describe('returnFlow', () => {
  it('normalizes commercial return reason and tracking values', () => {
    expect(normalizeReturnReason('  item   arrived damaged  ')).toBe('item arrived damaged');
    expect(normalizeReturnTrackingNumber(' 1z 999 aa  ')).toBe('1Z999AA');
  });

  it('enforces commercial minimum reason length', () => {
    expect(isReturnReasonReady('short')).toBe(false);
    expect(isReturnReasonReady('a'.repeat(RETURN_REASON_MIN_LENGTH - 1))).toBe(false);
    expect(isReturnReasonReady('Package arrived damaged and unusable')).toBe(true);
  });

  it('validates return tracking numbers for customer shipment entry', () => {
    expect(isReturnTrackingReady('123')).toBe(false);
    expect(isReturnTrackingReady('1Z999AA10123456784')).toBe(true);
    expect(isReturnTrackingReady('sf123-4567890')).toBe(true);
    expect(RETURN_REASON_PRESET_KEYS).toContain('damaged');
  });
});
