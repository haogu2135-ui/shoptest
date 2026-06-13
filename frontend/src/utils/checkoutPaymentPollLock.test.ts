import {
  checkoutPaymentPollLockKey,
  checkoutPaymentPollWebLockName,
  claimCheckoutPaymentPollLock,
  parseCheckoutPaymentPollLock,
  releaseCheckoutPaymentPollLock,
  startCheckoutPaymentPollWebLockSession,
} from './checkoutPaymentPollLock';

const setNavigatorLocks = (locks: unknown) => {
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: locks,
  });
};

describe('checkoutPaymentPollLock', () => {
  afterEach(() => {
    window.localStorage.clear();
    setNavigatorLocks(undefined);
    jest.useRealTimers();
  });

  it('holds a Web Lock session until release', async () => {
    const request = jest.fn((name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<void>) => (
      Promise.resolve(callback({ name, options }))
    ));
    setNavigatorLocks({ request });

    const session = await startCheckoutPaymentPollWebLockSession(42);

    expect(request).toHaveBeenCalledWith(
      checkoutPaymentPollWebLockName(42),
      { ifAvailable: true },
      expect.any(Function),
    );
    expect(session?.acquired).toBe(true);

    let done = false;
    session?.done.then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);

    session?.release();
    await session?.done;

    expect(done).toBe(true);
  });

  it('reports an unavailable Web Lock without polling ownership', async () => {
    const request = jest.fn((name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<void>) => (
      Promise.resolve(callback(null))
    ));
    setNavigatorLocks({ request });

    const session = await startCheckoutPaymentPollWebLockSession(43);

    expect(request).toHaveBeenCalledWith(
      checkoutPaymentPollWebLockName(43),
      { ifAvailable: true },
      expect.any(Function),
    );
    expect(session?.acquired).toBe(false);
    await expect(session?.done).resolves.toBeUndefined();
  });

  it('rejects Web Lock startup when the browser request fails before acquisition', async () => {
    const requestError = new Error('locks unavailable');
    const request = jest.fn(() => Promise.reject(requestError));
    setNavigatorLocks({ request });

    await expect(startCheckoutPaymentPollWebLockSession(46)).rejects.toThrow('locks unavailable');
  });

  it('keeps only one storage fallback owner after simultaneous claims', async () => {
    const first = claimCheckoutPaymentPollLock(44, 'ORD-44', 'owner-a');
    const second = claimCheckoutPaymentPollLock(44, 'ORD-44', 'owner-b');

    const results = await Promise.all([first, second]);
    const winners = results.filter(Boolean);
    const lock = parseCheckoutPaymentPollLock(window.localStorage.getItem(checkoutPaymentPollLockKey(44)));

    expect(winners).toHaveLength(1);
    expect(lock?.ownerId).toBe(results[0] ? 'owner-a' : 'owner-b');
  });

  it('does not let another owner release an active storage fallback lock', async () => {
    await claimCheckoutPaymentPollLock(45, undefined, 'owner-a');

    releaseCheckoutPaymentPollLock(45, 'owner-b');
    expect(window.localStorage.getItem(checkoutPaymentPollLockKey(45))).not.toBeNull();

    releaseCheckoutPaymentPollLock(45, 'owner-a');
    expect(window.localStorage.getItem(checkoutPaymentPollLockKey(45))).toBeNull();
  });
});
