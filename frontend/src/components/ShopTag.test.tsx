import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopTag from './ShopTag';

describe('ShopTag', () => {
  it('renders dual ant/shop classes for preset colors', () => {
    const { container } = render(<ShopTag color="green">Ready</ShopTag>);
    expect(container.querySelector('.shop-tag.ant-tag.shop-tag--green.ant-tag-green')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('supports closable with preventDefault keep-open', () => {
    const onClose = jest.fn((event: React.MouseEvent) => {
      event.preventDefault();
    });
    const { container } = render(
      <ShopTag closable color="orange" onClose={onClose}>
        Active filter
      </ShopTag>,
    );
    fireEvent.click(container.querySelector('.shop-tag__close') as HTMLButtonElement);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Active filter')).toBeInTheDocument();
  });
});
