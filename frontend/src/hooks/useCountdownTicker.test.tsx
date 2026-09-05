import React, { useState } from 'react';
import { act, render } from '@testing-library/react';
import { useCountdownTicker } from './useCountdownTicker';

const CountdownProbe: React.FC<{ initialValue: number }> = ({ initialValue }) => {
  const [value, setValue] = useState(initialValue);
  useCountdownTicker(value, setValue);
  return <span>{value}</span>;
};

describe('useCountdownTicker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('schedules one bounded tick and cleans it up when the value changes', () => {
    const { container, unmount } = render(<CountdownProbe initialValue={2} />);

    act(() => jest.advanceTimersByTime(1000));
    expect(container.textContent).toBe('1');
    unmount();
    act(() => jest.advanceTimersByTime(1000));
    expect(container.textContent).toBe('');
  });

  it('does not schedule timers for expired values', () => {
    const { container } = render(<CountdownProbe initialValue={0} />);

    act(() => jest.advanceTimersByTime(2000));
    expect(container.textContent).toBe('0');
  });
});
