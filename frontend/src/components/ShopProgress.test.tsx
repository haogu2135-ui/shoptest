import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopProgress from './ShopProgress';

describe('ShopProgress', () => {
  it('renders line progress with dual ant-progress classes', () => {
    render(<ShopProgress percent={42} showInfo={false} strokeColor="#124734" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveClass('shop-progress');
    expect(bar).toHaveClass('ant-progress');
    expect(bar).toHaveClass('ant-progress-line');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar.querySelector('.ant-progress-bg')).toHaveStyle({ width: '42%' });
  });

  it('renders circle progress info via format', () => {
    render(
      <ShopProgress
        type="circle"
        percent={80}
        size={64}
        format={(value) => `${value}`}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveClass('ant-progress-circle');
    expect(bar).toHaveTextContent('80');
  });
});
