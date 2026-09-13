const hasUnsafeUrlCharacter = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
};

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
  } catch (_error) {
    return '';
  }
};

export const isSafeAnnouncementLink = (value?: string | null) => {
  const link = String(value || '').trim();
  return !link || normalizeAnnouncementLink(link) === link;
};
