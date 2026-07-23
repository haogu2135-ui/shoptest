import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopAlert from './ShopAlert';

describe('ShopAlert', () => {
  it('renders warning alert with dual ant-alert classes and closes', () => {
    const onClose = jest.fn();
    const { container } = render(
      <ShopAlert type="warning" showIcon closable message="Watch queue" description="Details" onClose={onClose} />,
    );
    const root = container.querySelector('.shop-alert');
    expect(root).toHaveClass('ant-alert');
    expect(root).toHaveClass('ant-alert-warning');
    expect(screen.getByText('Watch queue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('Watch queue')).not.toBeInTheDocument();
  });
});
