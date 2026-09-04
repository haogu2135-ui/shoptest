import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ShopTypography from './ShopTypography';

describe('ShopTypography', () => {
  it('renders Text with dual ant-typography classes', () => {
    render(
      <ShopTypography.Text type="secondary" strong>
        Ready
      </ShopTypography.Text>,
    );
    const node = screen.getByText('Ready').closest('.shop-typography-text');
    expect(node).toHaveClass('ant-typography');
    expect(node).toHaveClass('ant-typography-secondary');
  });

  it('applies multiline ellipsis and protects external links', () => {
    render(
      <>
        <ShopTypography.Text ellipsis={{ rows: 2 }}>A long value</ShopTypography.Text>
        <ShopTypography.Link href="https://example.com" target="_blank">Open</ShopTypography.Link>
      </>,
    );
    const ellipsisNode = screen.getByText('A long value').closest('.shop-typography-text') as HTMLElement;
    expect(ellipsisNode).toHaveClass('shop-typography-text--ellipsisMultiline');
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('cleans up and replaces copy feedback timers', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onCopy = jest.fn();
    const { unmount } = render(<ShopTypography.Text copyable={{ text: 'SKU-1', onCopy }}>SKU-1</ShopTypography.Text>);
    const copyButton = screen.getByRole('button', { name: 'Copy' });

    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1499));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    unmount();
    act(() => jest.advanceTimersByTime(1));
    jest.useRealTimers();
  });
});
