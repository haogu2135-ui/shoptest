const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const JITTER_RATIO = 0.35;

export const getReconnectDelayMs = (attempt: number) => {
  const normalizedAttempt = Math.max(0, Math.min(Number.isFinite(attempt) ? Math.floor(attempt) : 0, 12));
  const baseDelay = Math.min(MAX_RECONNECT_DELAY_MS, INITIAL_RECONNECT_DELAY_MS * (2 ** normalizedAttempt));
  const jitterRange = baseDelay * JITTER_RATIO;
  const jitter = (Math.random() - 0.5) * jitterRange;
  return Math.max(INITIAL_RECONNECT_DELAY_MS, Math.round(baseDelay + jitter));
};
