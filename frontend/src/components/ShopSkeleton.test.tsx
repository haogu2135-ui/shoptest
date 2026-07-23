import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopSkeleton from './ShopSkeleton';

describe('ShopSkeleton', () => {
  it('renders active skeleton rows with dual ant-skeleton classes', () => {
    render(<ShopSkeleton active paragraph={{ rows: 8 }} />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass('shop-skeleton');
    expect(status).toHaveClass('ant-skeleton');
    expect(status).toHaveClass('ant-skeleton-active');
    expect(status.querySelectorAll('.shop-skeleton__row')).toHaveLength(8);
  });
});
