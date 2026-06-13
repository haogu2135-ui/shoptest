import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from './passwordPolicy';

describe('passwordPolicy', () => {
  it('defines the commercial password length bounds', () => {
    expect(STRONG_PASSWORD_MIN_LENGTH).toBe(12);
    expect(STRONG_PASSWORD_MAX_LENGTH).toBe(128);
  });

  it('requires at least three password character classes', () => {
    expect(hasRequiredPasswordClasses('lowercase1234')).toBe(false);
    expect(hasRequiredPasswordClasses('StrongPass123')).toBe(true);
    expect(hasRequiredPasswordClasses('StrongPass!')).toBe(true);
    expect(hasRequiredPasswordClasses('STRONG123456!')).toBe(true);
  });

  it('rejects common passwords case-insensitively', () => {
    expect(isCommonPassword(' Password1234 ')).toBe(true);
    expect(isCommonPassword('StrongPass123')).toBe(false);
  });
});
