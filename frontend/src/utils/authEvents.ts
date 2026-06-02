/** localStorage keys cleared on logout or session expiry. */
export const AUTH_SESSION_STORAGE_KEYS: string[] = [
  'token',
  'refreshToken',
  'user',
  'userId',
  'username',
  'role',
  'adminDefaultPath',
];

export const AUTH_SESSION_CHANGED_EVENT = 'auth-session-changed';

/**
 * Dispatch a DOM CustomEvent so other components (cart, support widget, etc.)
 * can react to login / logout without prop-drilling.
 */
export const dispatchAuthSessionChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
  } catch {
    // SSR or restricted environment — ignore
  }
};
