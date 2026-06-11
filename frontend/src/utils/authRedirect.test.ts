import {
  buildLoginUrl,
  getCurrentRelativeUrl,
  getPostLoginRedirectTarget,
} from './authRedirect';
import fs from 'fs';
import path from 'path';

const readPageSource = (fileName: string) => fs.readFileSync(path.resolve(__dirname, '../pages', fileName), 'utf8');

describe('authRedirect', () => {
  it('builds login urls only for safe relative redirects', () => {
    expect(buildLoginUrl('/products?keyword=dog#top')).toBe('/login?redirect=%2Fproducts%3Fkeyword%3Ddog%23top');
    expect(buildLoginUrl('/')).toBe('/login');
    expect(buildLoginUrl('/login?redirect=%2Fprofile')).toBe('/login');
    expect(buildLoginUrl('https://evil.example')).toBe('/login');
    expect(buildLoginUrl('//evil.example')).toBe('/login');
    expect(buildLoginUrl('/%5cevil.example/path')).toBe('/login');
    expect(buildLoginUrl('/products\\evil')).toBe('/login');
    expect(buildLoginUrl('/products%00hidden')).toBe('/login');
  });

  it('reads the current relative url and avoids recursive login redirects', () => {
    expect(getCurrentRelativeUrl({ pathname: '/wishlist', search: '?tab=saved', hash: '#top' })).toBe('/wishlist?tab=saved#top');
    expect(getCurrentRelativeUrl({ pathname: '/login', search: '?redirect=%2Fwishlist', hash: '' })).toBe('/');
  });

  it('returns only safe post-login redirect targets', () => {
    expect(getPostLoginRedirectTarget('?redirect=%2Fprofile%3Ftab%3Dorders')).toBe('/profile?tab=orders');
    expect(getPostLoginRedirectTarget('?redirect=https%3A%2F%2Fevil.example')).toBe('/');
    expect(getPostLoginRedirectTarget('?redirect=%2F%255cevil.example%2Fpath')).toBe('/');
    expect(getPostLoginRedirectTarget('?redirect=%2Fproducts%5Cevil')).toBe('/');
    expect(getPostLoginRedirectTarget('?redirect=%2Fproducts%2500hidden')).toBe('/');
    expect(getPostLoginRedirectTarget('?redirect=%2Flogin')).toBe('/');
    expect(getPostLoginRedirectTarget('')).toBe('/');
  });

  it('does not duplicate auth-expired predicates across checkout, profile, and tracking pages', () => {
    const checkoutSource = readPageSource('Checkout.tsx');
    const profileSource = readPageSource('Profile.tsx');
    const orderTrackingSource = readPageSource('OrderTracking.tsx');
    const pageSources = [checkoutSource, profileSource, orderTrackingSource].join('\n');

    expect(pageSources).not.toMatch(/const isAuthExpiredError\s*=/);
    expect(profileSource).not.toContain('isAuthExpiredError');
    expect(orderTrackingSource).not.toContain('isAuthExpiredError');
    expect(checkoutSource).toContain("isAuthExpiredError } from '../utils/apiError'");
  });
});
