import { isSafeHttpUrl, navigateToSafeUrl } from './safeUrl';

describe('safeUrl', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('rejects blank, script, and credentialed urls', () => {
    expect(isSafeHttpUrl('   ')).toBe(false);
    expect(isSafeHttpUrl('/checkout/session')).toBe(false);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('https://user:pass@pay.example.com/checkout')).toBe(false);
  });

  it('rejects obfuscated redirect urls', () => {
    expect(isSafeHttpUrl('https:\\\\pay.example.com/session')).toBe(false);
    expect(isSafeHttpUrl('https://pay.example.com/%5cadmin')).toBe(false);
    expect(isSafeHttpUrl('https://pay.example.com/session%00.png')).toBe(false);
  });

  it('trims safe payment urls before navigating', () => {
    const locationMock = { ...originalLocation, href: 'http://localhost/' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationMock,
    });

    expect(navigateToSafeUrl(' https://pay.example.com/session ')).toBe(true);
    expect(window.location.href).toBe('https://pay.example.com/session');
  });
});
