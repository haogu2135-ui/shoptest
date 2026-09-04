import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('keeps searchable popups inside a narrow viewport', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    const { rerender } = render(
      <ShopSelect
        ariaLabel="Brand"
        showSearch
        options={[{ value: 'brand', label: 'Long Trusted Pet Wellness Brand International' }]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Brand' });
    const rectMock = jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      width: 304,
      height: 44,
      top: 50,
      right: 335,
      bottom: 94,
      left: 31,
      x: 31,
      y: 50,
      toJSON: () => ({}),
    } as DOMRect);
    rerender(
      <ShopSelect
        ariaLabel="Brand"
        open
        showSearch
        options={[{ value: 'brand', label: 'Long Trusted Pet Wellness Brand International' }]}
      />,
    );

    try {
      const listbox = screen.getByRole('listbox', { name: 'Brand' });
      await waitFor(() => {
        expect(listbox.style.left).toBe('8px');
        expect(listbox.style.width).toBe('304px');
        expect(listbox.style.minWidth).toBe('304px');
        expect(listbox.style.maxWidth).toBe('calc(100vw - 16px)');
      });
    } finally {
      rectMock.mockRestore();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    }
  });

  it('filters options when showSearch is enabled', () => {
    render(
      <ShopSelect
        ariaLabel="Carrier"
        showSearch
        open
        searchPlaceholder="Find carrier"
        options={[
          { value: 'DHL', label: 'DHL Express' },
          { value: 'FEDEX', label: 'FedEx' },
        ]}
      />,
    );
    expect(screen.getByRole('option', { name: 'DHL Express' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find carrier' }), { target: { value: 'fed' } });
    expect(screen.queryByRole('option', { name: 'DHL Express' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'FedEx' })).toBeInTheDocument();
  });

  it('supports keyboard option navigation and de-duplicates values', () => {
    const onChange = jest.fn();
    render(
      <ShopSelect
        ariaLabel="Carrier"
        open
        value=""
        options={[
          { value: 'dhl', label: 'DHL' },
          { value: 'dhl', label: 'Duplicate DHL' },
          { value: 'fedex', label: 'FedEx' },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(2);
    const listbox = screen.getByRole('listbox', { name: 'Carrier' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('fedex');
  });

  it('uses a custom clear label', () => {
    render(
      <ShopSelect ariaLabel="Status" value="ready" allowClear clearLabel="Reset status" options={[{ value: 'ready', label: 'Ready' }]} />,
    );
    expect(screen.getByRole('button', { name: 'Reset status' })).toBeInTheDocument();
  });

});
