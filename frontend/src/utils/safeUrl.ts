export const isSafeHttpUrl = (value?: string | null) => {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const navigateToSafeUrl = (value?: string | null) => {
  if (!isSafeHttpUrl(value)) {
    return false;
  }
  window.location.href = new URL(value as string, window.location.origin).toString();
  return true;
};
