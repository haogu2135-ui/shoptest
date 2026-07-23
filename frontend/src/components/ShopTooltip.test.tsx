import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopTooltip from './ShopTooltip';

describe('ShopTooltip', () => {
  it('shows tooltip content on hover and keeps dual ant-tooltip classes', () => {
    const { container } = render(
      <ShopTooltip title="No permission" overlayClassName="demo-tip">
        <button type="button">Action</button>
      </ShopTooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(container.querySelector('.shop-tooltip') as HTMLElement);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveClass('shop-tooltip__overlay');
    expect(tip).toHaveClass('ant-tooltip');
    expect(tip).toHaveClass('demo-tip');
    expect(tip).toHaveTextContent('No permission');
  });

  it('renders children only when title is empty', () => {
    const { container } = render(
      <ShopTooltip title={undefined}>
        <button type="button">Plain</button>
      </ShopTooltip>,
    );
    expect(screen.getByRole('button', { name: 'Plain' })).toBeInTheDocument();
    expect(container.querySelector('.shop-tooltip')).toBeNull();
  });
});
