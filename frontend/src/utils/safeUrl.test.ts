import { isSafeHttpUrl, navigateToSafeUrl, normalizeSafeHttpUrl } from './safeUrl';

describe('safeUrl', () => {
  it('rejects blank, script, and credentialed urls', () => {
    expect(isSafeHttpUrl('   ')).toBe(false);
    expect(isSafeHttpUrl('/checkout/session')).toBe(false);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('https://user:pass@pay.example.com/checkout')).toBe(false);
  });

  it('allows http payment urls only when insecure http is enabled', () => {
    expect(isSafeHttpUrl('http://pay.example.com/checkout', { allowInsecureHttp: false })).toBe(false);
    expect(normalizeSafeHttpUrl(' http://pay.example.com/checkout ', { allowInsecureHttp: true })).toBe(
      'http://pay.example.com/checkout',
    );
  });

  it('rejects obfuscated redirect urls', () => {
    expect(isSafeHttpUrl('https:\\\\pay.example.com/session')).toBe(false);
    expect(isSafeHttpUrl('https://pay.example.com/%5cadmin')).toBe(false);
    expect(isSafeHttpUrl('https://pay.example.com/session%00.png')).toBe(false);
  });

  it('trims safe payment urls before navigating', () => {
    const navigate = jest.fn();

    expect(normalizeSafeHttpUrl(' https://pay.example.com/session ')).toBe('https://pay.example.com/session');
    expect(navigateToSafeUrl(' https://pay.example.com/session ', navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('https://pay.example.com/session');
  });

  it('uses the same protocol policy when navigating', () => {
    const navigate = jest.fn();

    expect(navigateToSafeUrl('http://pay.example.com/session', navigate, { allowInsecureHttp: false })).toBe(false);
    expect(navigateToSafeUrl('http://pay.example.com/session', navigate, { allowInsecureHttp: true })).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('http://pay.example.com/session');
  });
});
