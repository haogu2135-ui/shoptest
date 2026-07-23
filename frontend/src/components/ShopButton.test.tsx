import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopButton from './ShopButton';

describe('ShopButton', () => {
  it('renders primary button and handles click', () => {
    const onClick = jest.fn();
    render(
      <ShopButton type="primary" ariaLabel="Checkout" onClick={onClick}>
        Checkout
      </ShopButton>,
    );
    const button = screen.getByRole('button', { name: 'Checkout' });
    expect(button).toHaveClass('shop-button--primary');
    expect(button).toHaveClass('ant-btn-primary');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks click while loading or disabled', () => {
    const onClick = jest.fn();
    const { rerender } = render(
      <ShopButton loading ariaLabel="Pay" onClick={onClick}>
        Pay
      </ShopButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <ShopButton disabled ariaLabel="Pay" onClick={onClick}>
        Pay
      </ShopButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('supports htmlType submit and block layout', () => {
    render(
      <ShopButton htmlType="submit" block className="checkout-submit" aria-label="Place order">
        Place order
      </ShopButton>,
    );
    const button = screen.getByRole('button', { name: 'Place order' }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button).toHaveClass('shop-button--block');
    expect(button).toHaveClass('checkout-submit');
  });
});
