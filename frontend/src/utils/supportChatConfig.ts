const DEFAULT_SUPPORT_MESSAGE_MAX_CHARS = 1000;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  if (!/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 5000) : fallback;
};

export const supportChatConfig = {
  maxMessageChars: parsePositiveInt(
    process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS,
    DEFAULT_SUPPORT_MESSAGE_MAX_CHARS
  ),
};

export const parseSupportSocketPayload = (data: string) => {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : { type: 'ERROR', message: 'Invalid support message' };
  } catch {
    return { type: 'ERROR', message: 'Invalid support message' };
  }
};
