import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopCheckbox, { ShopCheckboxGroup } from './ShopCheckbox';

describe('ShopCheckbox', () => {
  it('emits ant-compatible change events', () => {
    const onChange = jest.fn();
    render(
      <ShopCheckbox ariaLabel="Select all" onChange={onChange}>
        Select all
      </ShopCheckbox>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.checked).toBe(true);
  });

  it('supports indeterminate aria state', () => {
    render(<ShopCheckbox ariaLabel="Partial" indeterminate checked={false} />);
    expect(screen.getByRole('checkbox', { name: 'Partial' })).toHaveAttribute('aria-checked', 'mixed');
  });

  it('supports grouped options and child values', () => {
    const onChange = jest.fn();
    render(
      <ShopCheckboxGroup
        ariaLabel="Filters"
        value={['a']}
        onChange={onChange}
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('supports child checkboxes inside a group', () => {
    const onChange = jest.fn();
    render(
      <ShopCheckboxGroup value={[]} onChange={onChange} ariaLabel="Colors">
        <ShopCheckbox value="red" ariaLabel="Red">
          Red
        </ShopCheckbox>
        <ShopCheckbox value="blue" ariaLabel="Blue">
          Blue
        </ShopCheckbox>
      </ShopCheckboxGroup>,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blue' }));
    expect(onChange).toHaveBeenCalledWith(['blue']);
  });
});
