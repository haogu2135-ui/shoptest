import { clearCheckoutCartItemIds, getAuthenticatedCartUserId, readCheckoutCartItemIds, syncCheckoutCartItemIds } from './cartSession';

describe('cartSession', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('deduplicates malformed checkout item ids from storage', () => {
    sessionStorage.setItem('checkoutCartItemIds:guest', JSON.stringify([3, '3', 4, null, 0, -2, 1.5, Number.MAX_SAFE_INTEGER + 1]));

    expect(readCheckoutCartItemIds()).toEqual([3, 4]);
  });

  it('clears the legacy checkout key when syncing current scoped ids', () => {
    sessionStorage.setItem('checkoutCartItemIds', JSON.stringify([9]));

    syncCheckoutCartItemIds([{ id: 2 }, { id: 5 }]);

    expect(sessionStorage.getItem('checkoutCartItemIds')).toBeNull();
    expect(readCheckoutCartItemIds()).toEqual([2, 5]);
  });

  it('uses the authenticated user id instead of a hard-coded cart owner', () => {
    localStorage.setItem('token', 'token-for-user-42');
    localStorage.setItem('userId', '42');

    expect(getAuthenticatedCartUserId()).toBe(42);
  });

  it('scopes checkout item ids by authenticated user id so token refreshes keep the selection', () => {
    localStorage.setItem('token', 'first-token');
    localStorage.setItem('userId', '42');
    syncCheckoutCartItemIds([{ id: 7 }]);

    localStorage.setItem('token', 'refreshed-token');

    expect(readCheckoutCartItemIds()).toEqual([7]);
  });

  it('can still read checkout ids saved by the older token-hash scoped key', () => {
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem('userId', '42');
    sessionStorage.setItem('checkoutCartItemIds:auth:1vyj9x1', JSON.stringify([8, '9']));

    expect(readCheckoutCartItemIds()).toEqual([8, 9]);
  });

  it('removes legacy token-hash checkout ids when clearing current checkout selection', () => {
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem('userId', '42');
    sessionStorage.setItem('checkoutCartItemIds:auth:1vyj9x1', JSON.stringify([8]));

    clearCheckoutCartItemIds();

    expect(sessionStorage.getItem('checkoutCartItemIds:auth:1vyj9x1')).toBeNull();
    expect(readCheckoutCartItemIds()).toEqual([]);
  });

  it('does not invent an authenticated cart user id when storage is incomplete', () => {
    localStorage.setItem('token', 'token-without-user');

    expect(getAuthenticatedCartUserId()).toBeNull();
  });

  it('keeps checkout ids scoped by token when a token exists but user id is missing', () => {
    localStorage.setItem('token', 'token-without-user');

    syncCheckoutCartItemIds([{ id: 11 }]);

    expect(readCheckoutCartItemIds()).toEqual([11]);
  });

  it('normalizes checkout ids before syncing them', () => {
    syncCheckoutCartItemIds([{ id: 3 }, { id: 3 }, { id: 0 }, { id: Number.MAX_SAFE_INTEGER + 1 }]);

    expect(readCheckoutCartItemIds()).toEqual([3]);
  });

  it('does not throw when checkout selection storage writes are unavailable', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => syncCheckoutCartItemIds([{ id: 2 }])).not.toThrow();

    setItemSpy.mockRestore();
  });

  it('does not throw when checkout selection cleanup storage is unavailable', () => {
    const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearCheckoutCartItemIds()).not.toThrow();

    removeItemSpy.mockRestore();
  });
});
