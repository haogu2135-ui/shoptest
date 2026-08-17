import {
  clearGuestSupportContext,
  loadGuestSupportContext,
  normalizeGuestSupportContext,
  saveGuestSupportContext,
} from './guestSupportContext';

describe('guest support access context', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('preserves an order-bound access token without requiring the email to be stored', () => {
    const context = normalizeGuestSupportContext({
      guestOrderNo: ' SO202608160001 ',
      guestAccessToken: 'signed-token',
    });

    expect(context).toEqual({
      orderNo: 'SO202608160001',
      email: '',
      accessToken: 'signed-token',
    });
    expect(saveGuestSupportContext(context)).toBe(true);
    expect(loadGuestSupportContext()).toEqual(context);
  });

  it('keeps legacy email recovery and rejects an order number without either credential', () => {
    expect(normalizeGuestSupportContext({
      orderNo: 'SO202608160002',
      email: ' Guest@Example.com ',
    })).toEqual({
      orderNo: 'SO202608160002',
      email: 'guest@example.com',
    });
    expect(normalizeGuestSupportContext({ orderNo: 'SO202608160003' })).toBeNull();

    clearGuestSupportContext();
    expect(loadGuestSupportContext()).toBeNull();
  });
});
