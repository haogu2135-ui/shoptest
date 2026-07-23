import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopStatistic from './ShopStatistic';

describe('ShopStatistic', () => {
  it('renders title, value, suffix and dual ant-statistic classes', () => {
    render(
      <ShopStatistic
        title="Conversion"
        value={62.5}
        precision={2}
        suffix="%"
        prefix={<span data-testid="prefix">↑</span>}
      />,
    );
    const root = screen.getByLabelText('Conversion');
    expect(root).toHaveClass('shop-statistic');
    expect(root).toHaveClass('ant-statistic');
    expect(root.querySelector('.ant-statistic-title')).toHaveTextContent('Conversion');
    expect(root.querySelector('.ant-statistic-content-value')).toHaveTextContent('62.50');
    expect(root.querySelector('.ant-statistic-content-suffix')).toHaveTextContent('%');
    expect(screen.getByTestId('prefix')).toBeInTheDocument();
  });

  it('supports custom formatter', () => {
    render(
      <ShopStatistic
        title="Revenue"
        value={12.3}
        formatter={(value) => `$${Number(value || 0).toFixed(2)}`}
      />,
    );
    expect(screen.getByLabelText('Revenue').querySelector('.ant-statistic-content-value')).toHaveTextContent('$12.30');
  });
});
