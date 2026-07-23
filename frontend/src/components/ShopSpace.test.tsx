import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopSpace from './ShopSpace';

describe('ShopSpace', () => {
  it('renders horizontal dual classes and children', () => {
    const { container } = render(
      <ShopSpace size={8} wrap>
        <span>One</span>
        <span>Two</span>
      </ShopSpace>,
    );
    const root = container.querySelector('.shop-space');
    expect(root).toHaveClass('ant-space');
    expect(root).toHaveClass('ant-space-horizontal');
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });
});
