export type PhoneOptions = {
  minDigits?: number;
  maxDigits?: number;
  maxInputLength?: number;
  collapseWhitespace?: boolean;
};

const DEFAULT_MIN_DIGITS = 6;
const DEFAULT_MAX_DIGITS = 20;
const DEFAULT_MAX_INPUT_LENGTH = 40;

export const stripPhoneControlChars = (value: unknown) => Array.from(String(value || ''), (char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127 ? ' ' : char;
}).join('');

export const normalizePhoneInputText = (value: unknown, options: PhoneOptions = {}) => {
  const maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const raw = stripPhoneControlChars(value).trim();
  const normalized = options.collapseWhitespace ? raw.replace(/\s+/g, ' ') : raw;
  return normalized.slice(0, maxInputLength);
};

export const normalizePhoneNumber = (value: unknown, options: PhoneOptions = {}) => {
  const text = normalizePhoneInputText(value, options);
  return text.startsWith('+') ? `+${text.slice(1).replace(/\D+/g, '')}` : text.replace(/\D+/g, '');
};

export const isLikelyPhoneNumber = (value: unknown, options: PhoneOptions = {}) => {
  const minDigits = options.minDigits ?? DEFAULT_MIN_DIGITS;
  const maxDigits = options.maxDigits ?? DEFAULT_MAX_DIGITS;
  const maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const text = normalizePhoneInputText(value, options);
  if (text.length < minDigits || text.length > maxInputLength) return false;
  const phoneBody = text.startsWith('+') ? text.slice(1) : text;
  if (!/^[\d\s().-]+$/.test(phoneBody)) return false;
  const digitCount = (text.match(/\d/g) || []).length;
  return digitCount >= minDigits && digitCount <= maxDigits;
};

export const normalizeLikelyPhoneNumber = (value: unknown, options: PhoneOptions = {}) =>
  isLikelyPhoneNumber(value, options) ? normalizePhoneNumber(value, options) : normalizePhoneInputText(value, options);
