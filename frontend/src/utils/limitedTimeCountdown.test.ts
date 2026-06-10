import { getLimitedTimeEndMs, getLimitedTimeRemainingMs, shouldRunLimitedTimeTicker } from './limitedTimeCountdown';

const now = Date.parse('2026-05-24T12:00:00Z');
type LimitedTimeCountdownProduct = NonNullable<Parameters<typeof getLimitedTimeRemainingMs>[0]>;

const limitedTimeProduct = (
  activeLimitedTimeDiscount: boolean,
  limitedTimeEndAt: string,
): LimitedTimeCountdownProduct => ({
  activeLimitedTimeDiscount,
  limitedTimeEndAt,
});

describe('limitedTimeCountdown', () => {
  it('normalizes invalid or missing end times to zero', () => {
    expect(getLimitedTimeEndMs(undefined)).toBe(0);
    expect(getLimitedTimeEndMs('not-a-date')).toBe(0);
  });

  it('returns remaining milliseconds only for active future discounts', () => {
    expect(getLimitedTimeRemainingMs(limitedTimeProduct(true, '2026-05-24T12:01:30Z'), now)).toBe(90000);
    expect(getLimitedTimeRemainingMs(limitedTimeProduct(false, '2026-05-24T12:01:30Z'), now)).toBe(0);
    expect(getLimitedTimeRemainingMs(limitedTimeProduct(true, '2026-05-24T11:59:59Z'), now)).toBe(0);
  });

  it('runs the ticker only while an active discount is still counting down', () => {
    expect(shouldRunLimitedTimeTicker(limitedTimeProduct(true, '2026-05-24T12:00:01Z'), now)).toBe(true);
    expect(shouldRunLimitedTimeTicker(limitedTimeProduct(true, '2026-05-24T12:00:00Z'), now)).toBe(false);
    expect(shouldRunLimitedTimeTicker(null, now)).toBe(false);
  });
});
