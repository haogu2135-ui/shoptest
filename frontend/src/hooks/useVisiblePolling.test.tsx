import React, { useState } from 'react';
import { act, render } from '@testing-library/react';
import { useVisiblePolling } from './useVisiblePolling';

const PollingProbe: React.FC<{ enabled?: boolean; runImmediately?: boolean }> = ({ enabled = true, runImmediately = true }) => {
  const [runs, setRuns] = useState(0);
  useVisiblePolling({
    enabled,
    intervalMs: 1000,
    runImmediately,
    run: () => setRuns((current) => current + 1),
  });
  return <span>{runs}</span>;
};

describe('useVisiblePolling', () => {
  const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  });

  it('serializes runs and schedules the next timeout after completion', async () => {
    const { container, unmount } = render(<PollingProbe />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toBe('1');
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toBe('2');

    unmount();
    act(() => jest.advanceTimersByTime(2000));
    expect(container.textContent).toBe('');
  });

  it('does not schedule work while hidden and resumes on visibility', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    const { container } = render(<PollingProbe />);
    act(() => jest.advanceTimersByTime(2000));
    expect(container.textContent).toBe('0');

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toBe('1');
  });

  it('supports delayed first execution', async () => {
    const { container } = render(<PollingProbe runImmediately={false} />);
    expect(container.textContent).toBe('0');
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toBe('1');
  });
});
