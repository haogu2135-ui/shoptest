import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopTabs from './ShopTabs';

describe('ShopTabs', () => {
  it('switches panels and keeps dual ant-tabs classes', () => {
    const { container } = render(
      <ShopTabs
        items={[
          { key: 'a', label: 'Alpha', children: <div>Panel A</div> },
          { key: 'b', label: 'Beta', children: <div>Panel B</div> },
        ]}
      />,
    );
    expect(container.querySelector('.shop-tabs')).toHaveClass('ant-tabs');
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });
});
