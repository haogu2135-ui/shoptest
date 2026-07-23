import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
