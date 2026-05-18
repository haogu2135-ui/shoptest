export const getSafeTime = (value?: string | number | Date | null) => {
  if (value === undefined || value === null || value === '') return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const formatSafeDate = (
  value: string | number | Date | null | undefined,
  locale: string,
  fallback = '',
) => {
  const time = getSafeTime(value);
  return time ? new Date(time).toLocaleDateString(locale) : fallback;
};

export const formatSafeDateTime = (
  value: string | number | Date | null | undefined,
  locale: string,
  fallback = '',
) => {
  const time = getSafeTime(value);
  return time ? new Date(time).toLocaleString(locale) : fallback;
};

export const formatSafeTime = (
  value: string | number | Date | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
  fallback = '',
) => {
  const time = getSafeTime(value);
  return time ? new Date(time).toLocaleTimeString(locale, options) : fallback;
};
