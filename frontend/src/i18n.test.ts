import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import { translateForLanguage } from './i18n';
import fs from 'fs';
import path from 'path';

const flattenKeys = (source: unknown, prefix = ''): string[] => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];

  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value, path)
      : [path];
  });
};

const flattenStrings = (source: unknown): string[] => {
  if (typeof source === 'string') return [source];
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  return Object.values(source).flatMap(flattenStrings);
};

const readFrontendSourceFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readFrontendSourceFiles(fullPath);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [fs.readFileSync(fullPath, 'utf8')] : [];
  });
};

describe('locale coverage', () => {
  it('keeps admin payment and return operations copy complete in every language', () => {
    const enKeys = Object.keys(en.pages.adminDashboard.paymentReturnOps).sort();

    expect(Object.keys(es.pages.adminDashboard.paymentReturnOps).sort()).toEqual(enKeys);
    expect(Object.keys(zh.pages.adminDashboard.paymentReturnOps).sort()).toEqual(enKeys);
  });

  it('keeps translated locale files aligned with the English key structure', () => {
    const englishKeys = flattenKeys(en).sort();

    [
      ['es', es],
      ['zh', zh],
    ].forEach(([language, locale]) => {
      const translatedKeys = new Set(flattenKeys(locale).sort());
      const missingKeys = englishKeys.filter((key) => !translatedKeys.has(key));

      expect({ language, missingKeys }).toEqual({ language, missingKeys: [] });
    });
  });

  it('keeps Spanish copy free of mojibake and accidental operational text', () => {
    const spanishCopy = flattenStrings(es).join('\n');

    expect(spanishCopy).not.toMatch(/[铆贸帽�]/);
    expect(spanishCopy).not.toContain('公 益 token');
    expect(spanishCopy).not.toContain('公益token');
    expect(spanishCopy).not.toContain('t.me/');
    expect(spanishCopy).not.toContain('通 知 群');
    expect(spanishCopy).not.toContain('通知群');
    expect(spanishCopy).not.toMatch(/\b[Mm]etodos\b/);
  });

  it('keeps known Spanish locale values translated instead of English fallbacks', () => {
    expect(es.pages.productList.materialNylon).toBe('Nailon');
    expect(es.pages.registryAdmin.host).toBe('Servidor');
    expect(es.pages.bugAdmin.totalBugs).toBe('{count} errores');
  });

  it('keeps English customer and operator copy free of internal QA labels', () => {
    const englishCopy = flattenStrings(en).join('\n');

    expect(englishCopy).not.toMatch(/\bQA\b/i);
    expect(en.pages.checkout.readinessEyebrow).not.toMatch(/\bQA\b/i);
  });

  it('keeps English phone placeholders free of Chinese punctuation or copy', () => {
    expect(en.pages.auth.phonePlaceholder).toBe('+52 55 1234 5678');
    expect(en.pages.auth.phonePlaceholder).not.toMatch(/[（）\u3400-\u9fff]/);
  });

  it('keeps Chinese phone placeholders localized instead of pure number examples', () => {
    expect(zh.pages.auth.phonePlaceholder).toContain('手机号示例');
    expect(zh.pages.auth.phonePlaceholder).toMatch(/[\u3400-\u9fff]/);
  });

  it('replaces parameter names and values literally', () => {
    expect(translateForLanguage('en', 'missing.dynamicParamKey', {
      defaultValue: '{a.b} {aXb} {amount}',
      'a.b': 'exact',
      aXb: 'separate',
      amount: '$20 & $30',
    })).toBe('exact separate $20 & $30');
  });

  it('does not reintroduce stale namespace-style translation keys', () => {
    const source = readFrontendSourceFiles(path.join(__dirname)).join('\n');

    [
      'adminCoupons:singleUse',
      'adminCoupons:batchGenerate',
      'adminCoupons:discountPercentage',
      'adminOrders:actions.reviewReturnRequest',
      'checkout:form.saveAddressLabel',
      'checkout:orderSummary.totalPayable',
    ].forEach((staleKey) => {
      expect(source).not.toContain(staleKey);
    });
    expect(fs.existsSync(path.join(__dirname, 'pages', 'CreateCouponModal.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, 'pages', 'OrderDetailPage.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, 'components', 'CustomerInfoSection.tsx'))).toBe(false);
  });
});
