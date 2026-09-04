import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopBadge from './ShopBadge';

describe('ShopBadge', () => {
  it('hides zero counts by default', () => {
    const { container } = render(
      <ShopBadge count={0}>
        <span>cart</span>
      </ShopBadge>,
    );
    expect(container.querySelector('.shop-badge__count')).toBeNull();
    expect(screen.getByText('cart')).toBeInTheDocument();
  });

  it('shows overflow as 99+', () => {
    const { container } = render(
      <ShopBadge count={120} overflowCount={99} size="small">
        <span>icon</span>
      </ShopBadge>,
    );
    expect(container.querySelector('.shop-badge__count')?.textContent).toBe('99+');
  });

  it('renders exact count under overflow', () => {
    const { container } = render(
      <ShopBadge count={3} size="small">
        <span>icon</span>
      </ShopBadge>,
    );
    expect(container.querySelector('.shop-badge__count')?.textContent).toBe('3');
  });

  it('normalizes invalid overflow boundaries and labels the count', () => {
    const { container } = render(
      <ShopBadge count={8} overflowCount={-2} showZero>
        <span>icon</span>
      </ShopBadge>,
    );
    const count = container.querySelector('.shop-badge__count');
    expect(count).toHaveTextContent('0+');
    expect(count).toHaveAttribute('aria-label', '0+');
  });
  it('renders status mode with text', () => {
    render(<ShopBadge status="success" text="Online" />);
    expect(document.querySelector('.shop-badge--status-success')).toBeTruthy();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

});
