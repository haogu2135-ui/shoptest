import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopSearchField from './ShopSearchField';

describe('ShopSearchField', () => {
  it('submits on enter and button click', () => {
    const onSearch = jest.fn();
    render(
      <ShopSearchField
        ariaLabel="Search products"
        submitLabel="Submit search"
        defaultValue="cat"
        onSearch={onSearch}
      />,
    );

    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search products' }), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('cat');

    fireEvent.click(screen.getByRole('button', { name: 'Submit search' }));
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it('supports controlled value and clear', () => {
    const onChange = jest.fn();
    render(
      <ShopSearchField
        ariaLabel="Search products"
        submitLabel="Submit search"
        value="dog bed"
        onChange={onChange}
        onSearch={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('can hide submit and keep prefix', () => {
    render(
      <ShopSearchField
        ariaLabel="Filter"
        showSubmit={false}
        prefix={<span data-testid="prefix">*</span>}
        placeholder="Filter products"
      />,
    );
    expect(screen.getByTestId('prefix')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
  });
});
