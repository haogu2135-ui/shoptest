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

  it('supports left placement for admin mobile navigation', () => {
    const onClose = jest.fn();
    render(
      <ShopDrawer
        open
        onClose={onClose}
        placement="left"
        width={288}
        title="Admin"
        rootClassName="admin-layout__mobileDrawer"
        bodyClassName="admin-layout__mobileDrawerBody"
        ariaLabel="Admin navigation"
        closeLabel="Close admin menu"
      >
        <div>Menu body</div>
      </ShopDrawer>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Admin navigation' });
    expect(dialog).toHaveClass('shop-drawer__panel');
    expect(dialog).toHaveClass('ant-drawer-content');
    expect(dialog.closest('.shop-drawer')).toHaveClass('shop-drawer--left');
    expect(dialog.closest('.shop-drawer')).toHaveClass('admin-layout__mobileDrawer');
    expect(screen.getByText('Menu body').parentElement).toHaveClass('admin-layout__mobileDrawerBody');
  });

  it('traps keyboard focus inside the drawer and restores trigger focus on close', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open drawer';
    document.body.appendChild(trigger);
    trigger.focus();

    const { container, rerender } = render(
      <ShopDrawer
        open
        onClose={onClose}
        title="Cart"
        ariaLabel="Your cart"
        closeLabel="Close cart"
      >
        <button type="button">Checkout</button>
      </ShopDrawer>,
    );

    jest.runOnlyPendingTimers();
    const closeControl = container.querySelector('.shop-drawer__close') as HTMLButtonElement;
    expect(closeControl).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Checkout' })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ShopDrawer open={false} onClose={onClose} title="Cart">
        hidden
      </ShopDrawer>,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
    jest.useRealTimers();
  });
});
