import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopAvatar from './ShopAvatar';

describe('ShopAvatar', () => {
  it('renders square avatar fallback text with dual ant-avatar classes', () => {
    const { container } = render(
      <ShopAvatar shape="square" size={48}>P</ShopAvatar>,
    );
    const root = container.querySelector('.shop-avatar');
    expect(root).toHaveClass('ant-avatar');
    expect(root).toHaveClass('ant-avatar-square');
    expect(root).toHaveTextContent('P');
  });

  it('renders icon mode', () => {
    render(<ShopAvatar icon={<span data-testid="ico">U</span>} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('recovers from an image failure when the source changes', () => {
    const { rerender } = render(<ShopAvatar src="/first.png">F</ShopAvatar>);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    rerender(<ShopAvatar src="/second.png">S</ShopAvatar>);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/second.png');
  });
});
