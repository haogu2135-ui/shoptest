import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopSelect from './ShopSelect';

describe('ShopSelect', () => {
  it('opens listbox and selects an option', () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <ShopSelect
        ariaLabel="Language"
        value="en"
        options={[
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
        ]}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('listbox', { name: 'Language' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Español' }));
    expect(onChange).toHaveBeenCalledWith('es');
  });

  it('supports controlled open', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <ShopSelect
        ariaLabel="Currency"
        value="MXN"
        open={false}
        onOpenChange={onOpenChange}
        options={[{ value: 'MXN', label: 'MXN' }]}
      />,
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    rerender(
      <ShopSelect
        ariaLabel="Currency"
        value="MXN"
        open
        onOpenChange={onOpenChange}
        options={[{ value: 'MXN', label: 'MXN' }]}
      />,
    );
    expect(screen.getByRole('listbox', { name: 'Currency' })).toBeInTheDocument();
  });

  it('supports allowClear and emits undefined', () => {
    const onChange = jest.fn();
    render(
      <ShopSelect
        ariaLabel="Pet size"
        value="SMALL"
        allowClear
        options={[
          { value: 'SMALL', label: 'Small' },
          { value: 'MEDIUM', label: 'Medium' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('renders emptyContent when options are empty', () => {
    render(
      <ShopSelect
        ariaLabel="Orders"
        open
        options={[]}
        emptyContent={<div>No orders</div>}
      />,
    );
    expect(screen.getByText('No orders')).toBeInTheDocument();
  });
});
