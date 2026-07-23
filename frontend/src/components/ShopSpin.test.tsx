import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopSpin from './ShopSpin';

describe('ShopSpin', () => {
  it('renders standalone spinner with tip', () => {
    render(<ShopSpin size="large" tip="Checking" aria-label="Checking access" />);
    expect(screen.getByRole('status', { name: 'Checking access' })).toHaveClass('shop-spin');
    expect(screen.getByText('Checking')).toBeInTheDocument();
  });

  it('wraps nested content while spinning', () => {
    render(
      <ShopSpin spinning tip="Loading">
        <div>Body</div>
      </ShopSpin>,
    );
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('hides overlay when not spinning', () => {
    render(
      <ShopSpin spinning={false}>
        <div>Ready</div>
      </ShopSpin>,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});
