import { formatSafeDate, formatSafeDateTime, formatSafeTime, getSafeTime } from './dateFormat';

describe('dateFormat', () => {
  it('returns 0 for empty or invalid dates', () => {
    expect(getSafeTime('')).toBe(0);
    expect(getSafeTime(null)).toBe(0);
    expect(getSafeTime('not-a-date')).toBe(0);
  });

  it('formats valid dates and uses fallback for invalid values', () => {
    expect(formatSafeDate('2026-05-16T10:20:00Z', 'en-US')).toMatch(/\d/);
    expect(formatSafeDate('bad', 'en-US', '-')).toBe('-');
    expect(formatSafeDateTime(undefined, 'en-US', '#1')).toBe('#1');
    expect(formatSafeTime('bad', 'en-US', { hour: '2-digit', minute: '2-digit' })).toBe('');
  });
});
