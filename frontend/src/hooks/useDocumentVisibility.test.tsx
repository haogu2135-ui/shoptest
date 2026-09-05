import React from 'react';
import { act, render } from '@testing-library/react';
import { getDocumentVisibility, useDocumentVisibility } from './useDocumentVisibility';

const VisibilityProbe: React.FC = () => {
  const visible = useDocumentVisibility();
  return <span>{visible ? 'visible' : 'hidden'}</span>;
};

describe('useDocumentVisibility', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');

  afterEach(() => {
    if (originalDescriptor) Object.defineProperty(document, 'visibilityState', originalDescriptor);
  });

  it('treats a non-hidden document as visible', () => {
    expect(getDocumentVisibility()).toBe(true);
  });

  it('updates state from visibility events and cleans up on unmount', () => {
    const { container, unmount } = render(<VisibilityProbe />);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(container.textContent).toBe('hidden');

    unmount();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
  });
});
