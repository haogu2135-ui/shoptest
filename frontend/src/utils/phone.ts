export type PhoneOptions = {
  minDigits?: number;
  maxDigits?: number;
  maxInputLength?: number;
  collapseWhitespace?: boolean;
};

const DEFAULT_MIN_DIGITS = 6;
const DEFAULT_MAX_DIGITS = 20;
const DEFAULT_MAX_INPUT_LENGTH = 40;

export const stripPhoneControlChars = (value: unknown) => {
  const raw = String(value || '');
  let cleaned = '';
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    cleaned += code <= 31 || code === 127 ? ' ' : raw[index];
  }
  return cleaned;
};

const countPhoneDigits = (value: string) => {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 48 && code <= 57) count += 1;
  }
  return count;
};

export const normalizePhoneInputText = (value: unknown, options: PhoneOptions = {}) => {
  const maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const raw = stripPhoneControlChars(value).trim();
  const normalized = options.collapseWhitespace ? raw.replace(/\s+/g, ' ') : raw;
  return normalized.slice(0, maxInputLength);
};

export const normalizePhoneNumber = (value: unknown, options: PhoneOptions = {}) => {
  const text = normalizePhoneInputText(value, options);
  const startsWithPlus = text.startsWith('+');
  let digits = '';
  for (let index = startsWithPlus ? 1 : 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 48 && code <= 57) digits += text[index];
  }
  return startsWithPlus ? `+${digits}` : digits;
};

export const isLikelyPhoneNumber = (value: unknown, options: PhoneOptions = {}) => {
  const minDigits = options.minDigits ?? DEFAULT_MIN_DIGITS;
  const maxDigits = options.maxDigits ?? DEFAULT_MAX_DIGITS;
  const maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  const text = normalizePhoneInputText(value, options);
  if (text.length < minDigits || text.length > maxInputLength) return false;
  const phoneBody = text.startsWith('+') ? text.slice(1) : text;
  if (!/^[\d\s().-]+$/.test(phoneBody)) return false;
  const digitCount = countPhoneDigits(text);
  return digitCount >= minDigits && digitCount <= maxDigits;
};

export const normalizeLikelyPhoneNumber = (value: unknown, options: PhoneOptions = {}) =>
  isLikelyPhoneNumber(value, options) ? normalizePhoneNumber(value, options) : normalizePhoneInputText(value, options);
