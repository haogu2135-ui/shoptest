import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('supports keyboard activation and de-duplicates row keys', () => {
    const onClick = jest.fn();
    const { container } = render(
      <ShopList
        dataSource={[{ id: 1, name: 'One' }, { id: 1, name: 'Two' }]}
        renderItem={(item) => <ShopList.Item onClick={onClick}>{item.name}</ShopList.Item>}
      />,
    );
    const items = container.querySelectorAll('.shop-list__item');
    expect(items).toHaveLength(2);
    fireEvent.keyDown(items[0], { key: 'Enter' });
    fireEvent.keyDown(items[1], { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('clamps invalid pagination values', () => {
    render(
      <ShopList dataSource={[]} pagination={{ current: 99, pageSize: 0, total: -2 }} locale={{ emptyText: 'Empty' }} />,
    );
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});
