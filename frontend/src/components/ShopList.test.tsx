import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopList from './ShopList';

describe('ShopList', () => {
  it('renders dataSource items via renderItem with dual ant-list classes', () => {
    const { container } = render(
      <ShopList
        dataSource={[{ id: 1, name: 'Alpha' }]}
        renderItem={(item) => (
          <ShopList.Item>
            <ShopList.Item.Meta title={item.name} description="desc" />
          </ShopList.Item>
        )}
      />,
    );
    expect(container.querySelector('.shop-list')).toHaveClass('ant-list');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('desc')).toBeInTheDocument();
  });

  it('shows empty text when dataSource is empty', () => {
    render(
      <ShopList
        dataSource={[]}
        locale={{ emptyText: 'Nothing here' }}
        renderItem={() => null}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
