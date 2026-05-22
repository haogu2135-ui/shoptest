import {
  buildLoginUrl,
  getCurrentRelativeUrl,
  getPostLoginRedirectTarget,
} from './authRedirect';

describe('authRedirect', () => {
  it('builds login urls only for safe relative redirects', () => {
    expect(buildLoginUrl('/products?keyword=dog#top')).toBe('/login?redirect=%2Fproducts%3Fkeyword%3Ddog%23top');
    expect(buildLoginUrl('/')).toBe('/login');
    expect(buildLoginUrl('/login?redirect=%2Fprofile')).toBe('/login');
    expect(buildLoginUrl('https://evil.example')).toBe('/login');
    expect(buildLoginUrl('//evil.example')).toBe('/login');
  });

  it('reads the current relative url and avoids recursive login redirects', () => {
    expect(getCurrentRelativeUrl({ pathname: '/wishlist', search: '?tab=saved', hash: '#top' })).toBe('/wishlist?tab=saved#top');
    expect(getCurrentRelativeUrl({ pathname: '/login', search: '?redirect=%2Fwishlist', hash: '' })).toBe('/');
  });

  it('returns only safe post-login redirect targets', () => {
    expect(getPostLoginRedirectTarget('?redirect=%2Fprofile%3Ftab%3Dorders')).toBe('/profile?tab=orders');
    expect(getPostLoginRedirectTarget('?redirect=https%3A%2F%2Fevil.example')).toBe('/');
    expect(getPostLoginRedirectTarget('?redirect=%2Flogin')).toBe('/');
    expect(getPostLoginRedirectTarget('')).toBe('/');
  });
});
