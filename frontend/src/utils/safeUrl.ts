const hasUnsafeControlCharacter = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });

export const isSafeHttpUrl = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  if (hasUnsafeControlCharacter(trimmed) || trimmed.includes('\\') || normalized.includes('%00') || normalized.includes('%5c')) {
    return false;
  }
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const navigateToSafeUrl = (value?: string | null) => {
  if (!isSafeHttpUrl(value)) {
    return false;
  }
  window.location.href = new URL(String(value).trim()).toString();
  return true;
};
