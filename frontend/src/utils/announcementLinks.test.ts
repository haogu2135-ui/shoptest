import { isSafeAnnouncementLink, normalizeAnnouncementLink } from './announcementLinks';

describe('announcement link helpers', () => {
  it('normalizes safe internal and http links', () => {
    expect(normalizeAnnouncementLink(' /coupons ')).toBe('/coupons');
    expect(normalizeAnnouncementLink('https://example.com/deals')).toBe('https://example.com/deals');
    expect(normalizeAnnouncementLink('http://example.com')).toBe('http://example.com');
  });

  it('drops unsafe announcement links', () => {
    expect(normalizeAnnouncementLink('javascript:alert(1)')).toBe('');
    expect(normalizeAnnouncementLink('//evil.example')).toBe('');
    expect(normalizeAnnouncementLink('https://user:pass@example.com/deals')).toBe('');
    expect(normalizeAnnouncementLink('https://example.com\\@evil.example')).toBe('');
    expect(normalizeAnnouncementLink('https://example.com/\npath')).toBe('');
  });

  it('accepts blank values but rejects unsafe nonblank values', () => {
    expect(isSafeAnnouncementLink('')).toBe(true);
    expect(isSafeAnnouncementLink('   ')).toBe(true);
    expect(isSafeAnnouncementLink('/pet-finder')).toBe(true);
    expect(isSafeAnnouncementLink('javascript:alert(1)')).toBe(false);
  });
});
