const LOGIN_PATH = '/login';
const DEFAULT_REDIRECT_PATH = '/';

const normalizeRelativePath = (value: unknown) => {
  const path = String(value || '').trim();
  if (!path.startsWith('/')) return '';
  if (path.startsWith('//')) return '';
  return path;
};

export const getCurrentRelativeUrl = (
  locationLike: Pick<Location, 'pathname' | 'search' | 'hash'> | null | undefined = window.location,
) => {
  if (!locationLike) return DEFAULT_REDIRECT_PATH;
  const path = normalizeRelativePath(`${locationLike.pathname || '/'}${locationLike.search || ''}${locationLike.hash || ''}`);
  if (!path || path.startsWith(LOGIN_PATH)) {
    return DEFAULT_REDIRECT_PATH;
  }
  return path;
};

export const buildLoginUrl = (redirectTo?: string | null) => {
  const safeRedirect = normalizeRelativePath(redirectTo);
  if (!safeRedirect || safeRedirect === DEFAULT_REDIRECT_PATH || safeRedirect.startsWith(LOGIN_PATH)) {
    return LOGIN_PATH;
  }
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(safeRedirect)}`;
};

export const buildLoginUrlFromWindow = () => buildLoginUrl(getCurrentRelativeUrl());

export const getPostLoginRedirectTarget = (search: string, fallback = DEFAULT_REDIRECT_PATH) => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const safeRedirect = normalizeRelativePath(params.get('redirect'));
  if (!safeRedirect || safeRedirect.startsWith(LOGIN_PATH)) {
    return fallback;
  }
  return safeRedirect;
};
