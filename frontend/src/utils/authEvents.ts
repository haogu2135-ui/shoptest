/** localStorage keys cleared on logout or session expiry. */
export const AUTH_SESSION_STORAGE_KEYS: string[] = [
  'token',
  'refreshToken',
  'user',
];

/**
 * Dispatch a DOM CustomEvent so other components (cart, support widget, etc.)
 * can react to login / logout without prop-drilling.
 */
export const dispatchAuthSessionChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent('auth-session-changed'));
  } catch {
    // SSR or restricted environment — ignore
  }
};
