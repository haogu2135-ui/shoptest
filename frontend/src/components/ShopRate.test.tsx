import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopRate from './ShopRate';

describe('ShopRate', () => {
  it('renders display rating with half-star fill', () => {
    render(<ShopRate value={3.5} allowHalf ariaLabel="Product rating 3.5" />);
    const root = screen.getByRole('img', { name: 'Product rating 3.5' });
    expect(root).toHaveClass('shop-rate');
    const fills = root.querySelectorAll('.shop-rate__fill');
    expect(fills).toHaveLength(5);
    expect((fills[0] as HTMLElement).style.width).toBe('100%');
    expect((fills[2] as HTMLElement).style.width).toBe('100%');
    expect((fills[3] as HTMLElement).style.width).toBe('50%');
    expect((fills[4] as HTMLElement).style.width).toBe('0%');
  });

  it('supports interactive selection', () => {
    const onChange = jest.fn();
    render(<ShopRate value={2} onChange={onChange} ariaLabel="Write review rating" />);
    const group = screen.getByRole('radiogroup', { name: 'Write review rating' });
    expect(group).toHaveClass('shop-rate--interactive');
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
