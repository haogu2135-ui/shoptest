import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';

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
  });
});
