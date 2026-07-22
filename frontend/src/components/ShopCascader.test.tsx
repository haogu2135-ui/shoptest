import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopCascader from './ShopCascader';

const options = [
  {
    value: 'MX',
    label: 'Mexico',
    children: [
      {
        value: 'CDMX',
        label: 'Ciudad de México',
        children: [{ value: 'COYO', label: 'Coyoacán' }],
      },
    ],
  },
  { value: 'US', label: 'United States' },
];

describe('ShopCascader', () => {
  it('opens listbox and selects a leaf path', () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <ShopCascader
        ariaLabel="Region"
        options={options}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Region' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('listbox', { name: 'Region' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Mexico' }));
    fireEvent.click(screen.getByRole('option', { name: 'Ciudad de México' }));
    fireEvent.click(screen.getByRole('option', { name: 'Coyoacán' }));

    expect(onChange).toHaveBeenCalledWith(['MX', 'CDMX', 'COYO']);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports controlled open', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <ShopCascader
        ariaLabel="Region"
        options={options}
        open={false}
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    rerender(
      <ShopCascader
        ariaLabel="Region"
        options={options}
        open
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.getByRole('listbox', { name: 'Region' })).toBeInTheDocument();
  });

  it('supports allowClear and emits empty path', () => {
    const onChange = jest.fn();
    render(
      <ShopCascader
        ariaLabel="Region"
        value={['US']}
        allowClear
        options={options}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders selected labels in the trigger', () => {
    render(
      <ShopCascader
        ariaLabel="Region"
        value={['MX', 'CDMX', 'COYO']}
        options={options}
      />,
    );
    expect(screen.getByRole('button', { name: 'Region' })).toHaveTextContent('Mexico / Ciudad de México / Coyoacán');
  });
});
