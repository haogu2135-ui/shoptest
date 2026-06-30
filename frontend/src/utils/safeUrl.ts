const hasUnsafeControlCharacter = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });

type SafeHttpUrlOptions = {
  allowInsecureHttp?: boolean;
};

const shouldAllowInsecureHttp = (options: SafeHttpUrlOptions) =>
  options.allowInsecureHttp ?? process.env.NODE_ENV !== 'production';

export const isSafeHttpUrl = (value?: string | null, options: SafeHttpUrlOptions = {}) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  if (hasUnsafeControlCharacter(trimmed) || trimmed.includes('\\') || normalized.includes('%00') || normalized.includes('%5c')) {
    return false;
  }
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    const protocolIsAllowed = url.protocol === 'https:' || (url.protocol === 'http:' && shouldAllowInsecureHttp(options));
    return protocolIsAllowed && !url.username && !url.password;
  } catch (_error) {
    return false;
  }
};

export const normalizeSafeHttpUrl = (value?: string | null, options: SafeHttpUrlOptions = {}) => {
  if (!isSafeHttpUrl(value, options)) return null;
  return new URL(String(value).trim()).toString();
};

export const navigateToSafeUrl = (
  value?: string | null,
  navigate: (url: string) => void = (url) => {
    window.location.href = url;
  },
  options: SafeHttpUrlOptions = {},
) => {
  const url = normalizeSafeHttpUrl(value, options);
  if (!url) return false;
  navigate(url);
  return true;
};
