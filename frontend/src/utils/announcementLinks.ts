const hasUnsafeUrlCharacter = (value: string) => Array.from(value).some((char) => {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127;
});

export const normalizeAnnouncementLink = (value?: string | null) => {
  const link = String(value || '').trim();
  if (!link) return '';
  if (link.includes('\\') || hasUnsafeUrlCharacter(link)) return '';
  if (link.startsWith('/')) return link.startsWith('//') ? '' : link;
  try {
    const url = new URL(link);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const hasHost = Boolean(url.hostname.trim());
    const hasCredentials = Boolean(url.username || url.password);
    return isHttp && hasHost && !hasCredentials ? link : '';
  } catch {
    return '';
  }
};

export const isSafeAnnouncementLink = (value?: string | null) => {
  const link = String(value || '').trim();
  return !link || normalizeAnnouncementLink(link) === link;
};
