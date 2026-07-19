export type CommercialAnnouncementCopy = {
  title?: string | null;
  content?: string | null;
};

// Keep aligned with backend SiteAnnouncementService placeholder/gibberish guards.
const PLACEHOLDER_COPY_PATTERN = /(^|\b)(test|testing|dummy|placeholder|lorem|ipsum|asdf|qwer|sadsad|foobar|sample|demo|xxx|yyyy|zzzz|junk|garbage|qa|tmp|temp|hello\s*world|foo\s*bar)(\b|$)/i;
const REPEATED_CHARACTER_PATTERN = /([a-z\u00c0-\u024f])\1{4,}/i;
const LONG_ALPHANUMERIC_TOKEN_PATTERN = /\b[a-z0-9]{18,}\b/gi;
const KEYBOARD_MASH_PATTERN = /(qwerty|asdfgh|zxcvbn|123456789|987654321|abcdefg|aabbcc|abcabc)/i;
const MOSTLY_SYMBOL_OR_DIGIT_PATTERN = /^[\d\s\W_]{8,}$/;

const replaceControlCharacters = (value: string) => {
  let normalized = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    normalized += code <= 31 || code === 127 ? ' ' : char;
  }
  return normalized;
};

export const normalizeCommercialAnnouncementCopy = (value?: string | null) => replaceControlCharacters(String(value || ''))
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const looksLikeGibberishToken = (token: string) => {
  const letters = token.replace(/[^a-z\u00c0-\u024f]/gi, '');
  const digits = token.replace(/\D/g, '');
  if (digits.length >= 12) return true;
  if (letters.length < 8) return false;
  const vowels = letters.match(/[aeiou\u00e0-\u00ff]/gi)?.length || 0;
  return vowels / letters.length < 0.2;
};

export const isCommercialAnnouncementCopy = (title?: string | null, content?: string | null) => {
  const text = `${normalizeCommercialAnnouncementCopy(title)} ${normalizeCommercialAnnouncementCopy(content)}`.trim();
  if (!text) return false;
  if (PLACEHOLDER_COPY_PATTERN.test(text)
    || REPEATED_CHARACTER_PATTERN.test(text)
    || KEYBOARD_MASH_PATTERN.test(text)
    || MOSTLY_SYMBOL_OR_DIGIT_PATTERN.test(text)) {
    return false;
  }
  const tokens = text.match(LONG_ALPHANUMERIC_TOKEN_PATTERN) || [];
  return !tokens.some(looksLikeGibberishToken);
};

export const isCommercialAnnouncement = (announcement: CommercialAnnouncementCopy | null | undefined) => {
  if (!announcement) return false;
  return isCommercialAnnouncementCopy(announcement.title, announcement.content);
};

export const commercialAnnouncementRejectionReason = (
  title?: string | null,
  content?: string | null,
): 'empty' | 'placeholder' | null => {
  const text = `${normalizeCommercialAnnouncementCopy(title)} ${normalizeCommercialAnnouncementCopy(content)}`.trim();
  if (!text) return 'empty';
  return isCommercialAnnouncementCopy(title, content) ? null : 'placeholder';
};
