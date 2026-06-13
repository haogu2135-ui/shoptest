import { act, render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { useDebounce } from './useDebounce';

const DebounceProbe = ({
  value,
  onDebounced,
}: {
  value: string;
  onDebounced?: (value: string) => void;
}) => {
  const debouncedValue = useDebounce(value, 300, onDebounced);
  return <div data-testid="debounced-value">{debouncedValue}</div>;
};

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('publishes only the last value after the debounce delay', () => {
    const onDebounced = jest.fn();
    const { rerender } = render(<DebounceProbe value="" onDebounced={onDebounced} />);

    rerender(<DebounceProbe value="d" onDebounced={onDebounced} />);
    rerender(<DebounceProbe value="do" onDebounced={onDebounced} />);
    rerender(<DebounceProbe value="dog" onDebounced={onDebounced} />);

    expect(screen.getByTestId('debounced-value')).toHaveTextContent('');
    expect(onDebounced).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('');
    expect(onDebounced).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('debounced-value')).toHaveTextContent('dog');
    expect(onDebounced).toHaveBeenCalledTimes(1);
    expect(onDebounced).toHaveBeenCalledWith('dog');
  });

  it('keeps admin keyword search pages on the shared debounce hook', () => {
    const managedPages = [
      'AnnouncementManagement.tsx',
      'BugManagement.tsx',
      'CouponManagement.tsx',
      'OrderManagement.tsx',
      'PetGalleryManagement.tsx',
      'ProductManagement.tsx',
      'ReviewManagement.tsx',
    ];

    managedPages.forEach((fileName) => {
      const source = fs.readFileSync(path.resolve(__dirname, '../pages', fileName), 'utf8');
      expect(source).toContain("from '../hooks/useDebounce'");
      expect(source).toContain('useDebounce(');
      expect(source).not.toContain('setDebouncedKeyword');
      expect(source).not.toContain('setDebouncedSearchKeyword');
      expect(source).not.toContain('setDebouncedSearchText');
      expect(source).not.toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*setDebounced/);
    });
  });
});
