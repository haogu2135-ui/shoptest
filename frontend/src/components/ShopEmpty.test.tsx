import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopEmpty from './ShopEmpty';

describe('ShopEmpty', () => {
  it('renders description and footer actions', () => {
    render(
      <ShopEmpty description="No sessions">
        <button type="button">Retry</button>
      </ShopEmpty>,
    );
    expect(screen.getByRole('status')).toHaveClass('shop-empty');
    expect(screen.getByRole('status')).toHaveClass('ant-empty');
    expect(screen.getByText('No sessions')).toHaveClass('ant-empty-description');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
