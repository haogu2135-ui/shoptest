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

  it('clamps custom dimensions and declares lazy image geometry', () => {
    const { container } = render(<ShopAvatar src="/avatar.png" size={9999} />);
    const root = container.querySelector('.shop-avatar') as HTMLElement;
    const image = screen.getByRole('img');

    expect(root.style.width).toBe('256px');
    expect(image).toHaveAttribute('width', '256');
    expect(image).toHaveAttribute('height', '256');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });
});
