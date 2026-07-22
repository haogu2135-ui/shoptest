import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopDrawer from './ShopDrawer';

describe('ShopDrawer', () => {
  it('renders commercial bottom drawer chrome and closes from close control', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <ShopDrawer
        open
        onClose={onClose}
        placement="bottom"
        height="80vh"
        title="Filters"
        ariaLabel="Product filters"
        closeLabel="Close filters"
      >
        <div>Filter body</div>
      </ShopDrawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Product filters' })).toHaveClass('shop-drawer__panel');
    expect(screen.getByText('Filter body')).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Close filters' });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ShopDrawer open={false} onClose={onClose} title="Filters">
        hidden
      </ShopDrawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
