import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopTreeSelect from './ShopTreeSelect';

const treeData = [
  {
    value: 1,
    label: 'Pets',
    children: [
      { value: 2, label: 'Dogs' },
      { value: 3, label: 'Cats', disabled: true },
    ],
  },
  { value: 4, label: 'Food' },
];

describe('ShopTreeSelect', () => {
  it('opens listbox and selects a nested option', () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <ShopTreeSelect
        ariaLabel="Category"
        treeData={treeData}
        treeDefaultExpandAll
        onChange={onChange}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('listbox', { name: 'Category' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Dogs' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports allowClear and controlled open', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <ShopTreeSelect
        ariaLabel="Category"
        treeData={treeData}
        value={4}
        allowClear
        open={false}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Food');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(undefined);

    rerender(
      <ShopTreeSelect
        ariaLabel="Category"
        treeData={treeData}
        value={4}
        allowClear
        open
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('listbox', { name: 'Category' })).toBeInTheDocument();
  });

  it('expands collapsed branches before selection', () => {
    const onChange = jest.fn();
    render(
      <ShopTreeSelect
        ariaLabel="Category"
        treeData={treeData}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.queryByRole('option', { name: 'Dogs' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Pets' }));
    fireEvent.click(screen.getByRole('option', { name: 'Dogs' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
