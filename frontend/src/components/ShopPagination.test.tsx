import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopPagination from './ShopPagination';

describe('ShopPagination', () => {
  it('renders commercial page controls and changes pages', () => {
    const onChange = jest.fn();
    render(
      <ShopPagination
        current={2}
        total={48}
        pageSize={12}
        onChange={onChange}
        showTotal={(total) => `${total} products`}
        prevLabel="Previous page"
        nextLabel="Next page"
      />,
    );

    expect(screen.getByText('48 products')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveClass('shop-pagination');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('hides when total fits one page', () => {
    const { container } = render(
      <ShopPagination current={1} total={8} pageSize={12} onChange={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
