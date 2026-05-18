import { dispatchDomEvent } from './domEvents';

describe('dispatchDomEvent', () => {
  const originalEvent = window.Event;

  afterEach(() => {
    Object.defineProperty(window, 'Event', {
      configurable: true,
      writable: true,
      value: originalEvent,
    });
    jest.restoreAllMocks();
  });

  it('dispatches a plain DOM event', () => {
    const listener = jest.fn();
    window.addEventListener('shop:test-event', listener);

    const result = dispatchDomEvent('shop:test-event');

    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('shop:test-event', listener);
  });

  it('dispatches a CustomEvent with detail', () => {
    const listener = jest.fn();
    window.addEventListener('shop:test-detail', listener);

    dispatchDomEvent('shop:test-detail', { currency: 'USD' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ currency: 'USD' });
    window.removeEventListener('shop:test-detail', listener);
  });

  it('falls back when Event construction is unavailable', () => {
    Object.defineProperty(window, 'Event', {
      configurable: true,
      writable: true,
      value: jest.fn(() => {
        throw new Error('Event constructor unavailable');
      }),
    });
    const listener = jest.fn();
    window.addEventListener('shop:test-fallback', listener);

    const result = dispatchDomEvent('shop:test-fallback');

    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('shop:test-fallback', listener);
  });

  it('preserves detail in the fallback CustomEvent path', () => {
    const originalCustomEvent = window.CustomEvent;
    Object.defineProperty(window, 'CustomEvent', {
      configurable: true,
      writable: true,
      value: jest.fn(() => {
        throw new Error('CustomEvent constructor unavailable');
      }),
    });
    const listener = jest.fn();
    window.addEventListener('shop:test-fallback-detail', listener);

    const result = dispatchDomEvent('shop:test-fallback-detail', { count: 2 });

    expect(result).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ count: 2 });
    window.removeEventListener('shop:test-fallback-detail', listener);
    Object.defineProperty(window, 'CustomEvent', {
      configurable: true,
      writable: true,
      value: originalCustomEvent,
    });
  });
});
