import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
