import fs from 'fs';
import path from 'path';

const homeSource = fs.readFileSync(path.join(__dirname, 'Home.tsx'), 'utf8');
const localesRoot = path.resolve(__dirname, '../locales');
const localeFiles = ['en.json', 'es.json', 'zh.json'];
const requiredTrustKeys = [
  'freeShipping',
  'fastDispatch',
  'petSafe',
  'nonToxic',
  'easyReturns',
  'betterFit',
  'loved',
  'happyTails',
];

describe('Home trust badge i18n contracts', () => {
  it('keeps homepage trust badges translated instead of hardcoded', () => {
    for (const key of requiredTrustKeys) {
      expect(homeSource).toContain(`t('home.trust.${key}`);
    }

    expect(homeSource).not.toMatch(/['"`]24\/7[^'"`]*['"`]/);
    expect(homeSource).not.toMatch(/['"`]SSL[^'"`]*['"`]/);
    expect(homeSource).not.toContain('24/7 Customer Support');
    expect(homeSource).not.toContain('SSL Encrypted');
  });

  it('keeps every homepage trust key localized in supported locales', () => {
    for (const localeFile of localeFiles) {
      const locale = JSON.parse(fs.readFileSync(path.join(localesRoot, localeFile), 'utf8')) as {
        home?: { trust?: Record<string, string> };
      };
      const trust = locale.home?.trust || {};

      for (const key of requiredTrustKeys) {
        expect(typeof trust[key]).toBe('string');
        expect(trust[key].trim().length).toBeGreaterThan(0);
      }
    }
  });
});
