import {
  isLikelyPhoneNumber,
  normalizeLikelyPhoneNumber,
  normalizePhoneInputText,
  normalizePhoneNumber,
  stripPhoneControlChars,
} from './phone';
import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('phone utilities', () => {
  it('normalizes checkout/profile phone numbers with shared 6-20 digit rules', () => {
    expect(isLikelyPhoneNumber(' +52 (55) 1234-5678 ')).toBe(true);
    expect(normalizePhoneNumber(' +52 (55) 1234-5678 ')).toBe('+525512345678');
    expect(normalizeLikelyPhoneNumber('555.123.4567')).toBe('5551234567');
  });

  it('keeps invalid likely-phone input readable instead of stripping user text', () => {
    expect(isLikelyPhoneNumber('call me maybe')).toBe(false);
    expect(normalizeLikelyPhoneNumber(' call me maybe ')).toBe('call me maybe');
  });

  it('removes control characters before validation and normalization', () => {
    expect(stripPhoneControlChars('555\u0000\t123')).toBe('555  123');
    expect(normalizePhoneInputText('555\u0000\t123', { collapseWhitespace: true })).toBe('555 123');
    expect(normalizePhoneNumber('555\u0000\t123')).toBe('555123');
  });

  it('rejects unsupported plus placement and excessive digit counts', () => {
    expect(isLikelyPhoneNumber('55+51234567')).toBe(false);
    expect(isLikelyPhoneNumber('+123456789012345678901')).toBe(false);
  });

  it('supports stricter registration digit thresholds without duplicating normalization', () => {
    expect(isLikelyPhoneNumber('1234567', { minDigits: 8, maxInputLength: 32 })).toBe(false);
    expect(isLikelyPhoneNumber('12345678', { minDigits: 8, maxInputLength: 32 })).toBe(true);
    expect(normalizeLikelyPhoneNumber('+1 (234) 567-8901', { minDigits: 8, maxInputLength: 32 })).toBe('+12345678901');
  });

  it('keeps Checkout and Profile on the shared phone helpers', () => {
    const checkoutSource = readSource('../pages/Checkout.tsx');
    const profileSource = readSource('../pages/Profile.tsx');

    [checkoutSource, profileSource].forEach((source) => {
      expect(source).toContain("from '../utils/phone'");
      expect(source).toContain('isLikelyPhoneNumber');
      expect(source).toContain('normalizeLikelyPhoneNumber');
      expect(source).toContain('normalizePhoneNumber');
      expect(source).not.toContain('const checkoutPhonePattern');
      expect(source).not.toContain('const profilePhonePattern');
      expect(source).not.toContain('const stripProfileControlChars');
    });
  });
});
