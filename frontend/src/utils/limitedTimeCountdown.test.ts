import { getLimitedTimeEndMs, getLimitedTimeRemainingMs, shouldRunLimitedTimeTicker } from './limitedTimeCountdown';

const now = Date.parse('2026-05-24T12:00:00Z');

describe('limitedTimeCountdown', () => {
  it('normalizes invalid or missing end times to zero', () => {
    expect(getLimitedTimeEndMs(undefined)).toBe(0);
    expect(getLimitedTimeEndMs('not-a-date')).toBe(0);
  });

  it('returns remaining milliseconds only for active future discounts', () => {
    expect(getLimitedTimeRemainingMs({ activeLimitedTimeDiscount: true, limitedTimeEndAt: '2026-05-24T12:01:30Z' } as any, now)).toBe(90000);
    expect(getLimitedTimeRemainingMs({ activeLimitedTimeDiscount: false, limitedTimeEndAt: '2026-05-24T12:01:30Z' } as any, now)).toBe(0);
    expect(getLimitedTimeRemainingMs({ activeLimitedTimeDiscount: true, limitedTimeEndAt: '2026-05-24T11:59:59Z' } as any, now)).toBe(0);
  });

  it('runs the ticker only while an active discount is still counting down', () => {
    expect(shouldRunLimitedTimeTicker({ activeLimitedTimeDiscount: true, limitedTimeEndAt: '2026-05-24T12:00:01Z' } as any, now)).toBe(true);
    expect(shouldRunLimitedTimeTicker({ activeLimitedTimeDiscount: true, limitedTimeEndAt: '2026-05-24T12:00:00Z' } as any, now)).toBe(false);
    expect(shouldRunLimitedTimeTicker(null, now)).toBe(false);
  });
});
