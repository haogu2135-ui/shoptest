const hasUnsafeControlCharacter = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
};

type SafeHttpUrlOptions = {
  allowInsecureHttp?: boolean;
};

const shouldAllowInsecureHttp = (options: SafeHttpUrlOptions) =>
  options.allowInsecureHttp ?? process.env.NODE_ENV !== 'production';

const parseSafeHttpUrl = (value?: string | null, options: SafeHttpUrlOptions = {}) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (hasUnsafeControlCharacter(trimmed) || trimmed.includes('\\') || normalized.includes('%00') || normalized.includes('%5c')) {
    return null;
  }
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    const protocolIsAllowed = url.protocol === 'https:' || (url.protocol === 'http:' && shouldAllowInsecureHttp(options));
    return protocolIsAllowed && !url.username && !url.password ? url : null;
  } catch (_error) {
    return null;
  }
};

export const isSafeHttpUrl = (value?: string | null, options: SafeHttpUrlOptions = {}) => Boolean(parseSafeHttpUrl(value, options));

export const normalizeSafeHttpUrl = (value?: string | null, options: SafeHttpUrlOptions = {}) => {
  return parseSafeHttpUrl(value, options)?.toString() || null;
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
