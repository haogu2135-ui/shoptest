export const STRONG_PASSWORD_MIN_LENGTH = 12;
export const STRONG_PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890ab',
  'admin123456',
  'admin123456!',
  'iloveyou123',
  'letmein12345',
  'password123',
  'password123!',
  'password1234',
  'qwerty12345',
  'qwerty123456',
  'shoptest123',
  'welcome1234',
  'welcome123!',
]);

export const isCommonPassword = (password: string) =>
  COMMON_PASSWORDS.has(String(password || '').trim().toLowerCase());

export const hasRequiredPasswordClasses = (password: string) => {
  const value = String(password || '');
  let classCount = 0;
  if (/[a-z]/.test(value)) classCount += 1;
  if (/[A-Z]/.test(value)) classCount += 1;
  if (/\d/.test(value)) classCount += 1;
  if (/[^A-Za-z0-9\s]/.test(value)) classCount += 1;
  return classCount >= 3;
};
