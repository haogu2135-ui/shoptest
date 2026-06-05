const hasUnsafeUrlCharacter = (value: string) => Array.from(value).some((char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127;
});

export const normalizeAnnouncementLink = (value?: string | null) => {
  const link = String(value || '').trim();
  const normalizedLink = link.toLowerCase();
  if (!link) return '';
  if (
    link.includes('\\')
    || hasUnsafeUrlCharacter(link)
    || normalizedLink.includes('%00')
    || normalizedLink.includes('%5c')
  ) return '';
  if (link.startsWith('/')) return link.startsWith('//') ? '' : link;
  try {
    const url = new URL(link);
    const isHttps = url.protocol === 'https:';
    const hasHost = Boolean(url.hostname.trim());
    const hasCredentials = Boolean(url.username || url.password);
    return isHttps && hasHost && !hasCredentials ? link : '';
  } catch {
    return '';
  }
};

export const isSafeAnnouncementLink = (value?: string | null) => {
  const link = String(value || '').trim();
  return !link || normalizeAnnouncementLink(link) === link;
};
