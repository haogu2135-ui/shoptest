import type { SupportMessage, SupportMessageCustomer, SupportSession, SupportSessionCustomer } from '../types';
import { reportNonBlockingError } from './nonBlockingError';

const DEFAULT_SUPPORT_MESSAGE_MAX_CHARS = 1000;
type SupportSocketSession = SupportSession | SupportSessionCustomer;
type SupportSocketMessage = SupportMessage | SupportMessageCustomer;

export type SupportSocketPayload =
  | { type: 'ERROR'; message?: string }
  | { type: 'MESSAGE'; session: SupportSocketSession; message: SupportSocketMessage }
  | { type: 'SESSION_CLOSED' | 'SESSION_UPDATED'; session: SupportSocketSession };

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  if (!/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 5000) : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isPositiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

const isSupportSocketSession = (value: unknown): value is SupportSocketSession =>
  isRecord(value) && isPositiveInteger(value.id) && typeof value.status === 'string';

const isSupportSocketMessage = (value: unknown): value is SupportSocketMessage =>
  isRecord(value)
  && isPositiveInteger(value.id)
  && isPositiveInteger(value.sessionId)
  && typeof value.senderRole === 'string'
  && typeof value.content === 'string';

const errorPayload = (message?: unknown): SupportSocketPayload => {
  const text = typeof message === 'string' ? message.trim() : '';
  return text ? { type: 'ERROR', message: text } : { type: 'ERROR' };
};

export const supportChatConfig = {
  maxMessageChars: parsePositiveInt(
    process.env.REACT_APP_SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS,
    DEFAULT_SUPPORT_MESSAGE_MAX_CHARS
  ),
};

export const parseSupportSocketPayload = (data: string): SupportSocketPayload => {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!isRecord(parsed) || typeof parsed.type !== 'string') {
      return errorPayload();
    }
    if (parsed.type === 'ERROR') {
      return errorPayload(parsed.message);
    }
    if (parsed.type === 'MESSAGE') {
      return isSupportSocketSession(parsed.session) && isSupportSocketMessage(parsed.message)
        ? { type: 'MESSAGE', session: parsed.session, message: parsed.message }
        : errorPayload();
    }
    if (parsed.type === 'SESSION_CLOSED' || parsed.type === 'SESSION_UPDATED') {
      return isSupportSocketSession(parsed.session)
        ? { type: parsed.type, session: parsed.session }
        : errorPayload();
    }
    return errorPayload();
  } catch (error) {
    reportNonBlockingError('supportChatConfig.parseSupportSocketPayload', error);
    return errorPayload();
  }
};
