import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('honors bounded enter and leave delays', () => {
    jest.useFakeTimers();
    const { container } = render(
      <ShopTooltip title="Delayed" mouseEnterDelay={100} mouseLeaveDelay={200}>
        <button type="button">Action</button>
      </ShopTooltip>,
    );
    const root = container.querySelector('.shop-tooltip') as HTMLElement;

    fireEvent.mouseEnter(root);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(100));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(root);
    act(() => jest.advanceTimersByTime(199));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('cancels a pending show when the pointer leaves', () => {
    jest.useFakeTimers();
    const { container } = render(
      <ShopTooltip title="Delayed" mouseEnterDelay={100}>
        <button type="button">Action</button>
      </ShopTooltip>,
    );
    const root = container.querySelector('.shop-tooltip') as HTMLElement;
    fireEvent.mouseEnter(root);
    fireEvent.mouseLeave(root);
    act(() => jest.advanceTimersByTime(100));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
