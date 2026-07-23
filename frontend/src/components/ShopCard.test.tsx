import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopCard from './ShopCard';

describe('ShopCard', () => {
  it('renders dual ant-card classes with title and body', () => {
    const { container } = render(
      <ShopCard title="Orders" extra={<span>extra</span>}>
        Body content
      </ShopCard>,
    );
    const root = container.querySelector('.shop-card');
    expect(root).toHaveClass('ant-card');
    expect(root).toHaveClass('ant-card-bordered');
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByText('extra')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(<ShopCard loading aria-label="Loading">Hidden</ShopCard>);
    expect(container.querySelector('.shop-card--loading.ant-card-loading')).toBeTruthy();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
