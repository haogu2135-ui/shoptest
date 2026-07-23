import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopDivider from './ShopDivider';

describe('ShopDivider', () => {
  it('renders plain separator dual classes', () => {
    const { container } = render(<ShopDivider />);
    const root = container.querySelector('.shop-divider');
    expect(root).toHaveClass('ant-divider');
    expect(root).toHaveClass('ant-divider-horizontal');
  });

  it('renders labeled divider text', () => {
    render(<ShopDivider>Language</ShopDivider>);
    expect(screen.getByText('Language')).toBeInTheDocument();
  });
});
