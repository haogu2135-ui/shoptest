import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
const navbarSource = readSource('../components/Navbar.tsx');
const forgotPasswordSource = readSource('ForgotPassword.tsx');
const localesRoot = path.resolve(__dirname, '../locales');

describe('Storefront brand i18n contracts', () => {
  it('keeps visible storefront brand marks translated instead of hardcoded', () => {
    expect(navbarSource).toContain("<strong>{t('common.brand')}</strong>");
    expect(forgotPasswordSource).toContain('<div className="shopee-login-mark">{t(\'common.brand\')}</div>');

    expect(navbarSource).not.toContain('ShopMX');
    expect(forgotPasswordSource).not.toContain('ShopMX');
  });

  it('keeps the shared brand key available in supported locales', () => {
    for (const localeFile of ['en.json', 'es.json', 'zh.json']) {
      const locale = JSON.parse(fs.readFileSync(path.join(localesRoot, localeFile), 'utf8')) as {
        common?: { brand?: string };
      };

      expect(typeof locale.common?.brand).toBe('string');
      expect(locale.common?.brand?.trim().length).toBeGreaterThan(0);
    }
  });
});
