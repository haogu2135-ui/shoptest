const DEFAULT_SUPPORT_MESSAGE_MAX_CHARS = 1200;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const supportChatConfig = {
  maxMessageChars: parsePositiveInt(
    process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS,
    DEFAULT_SUPPORT_MESSAGE_MAX_CHARS
  ),
};

export const parseSupportSocketPayload = (data: string) => {
  try {
    return JSON.parse(data);
  } catch {
    return { type: 'ERROR', message: 'Invalid support message' };
  }
};
