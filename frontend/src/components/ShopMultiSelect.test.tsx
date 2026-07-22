import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopMultiSelect from './ShopMultiSelect';

describe('ShopMultiSelect', () => {
  it('toggles multiple options and emits string arrays', () => {
    const onChange = jest.fn();
    render(
      <ShopMultiSelect
        ariaLabel="Users"
        open
        value={['1']}
        options={[
          { value: '1', label: 'Ada (#1)' },
          { value: '2', label: 'Bob (#2)' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('option', { name: 'Bob (#2)' }));
    expect(onChange).toHaveBeenCalledWith(['1', '2']);
    fireEvent.click(screen.getByRole('option', { name: 'Ada (#1)' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('supports tags mode by adding free-form values on Enter', () => {
    const onChange = jest.fn();
    render(
      <ShopMultiSelect
        ariaLabel="Tags"
        mode="tags"
        open
        showSearch
        searchPlaceholder="Add tag"
        value={['hot']}
        options={[
          { value: 'hot', label: 'Hot' },
          { value: 'new', label: 'New' },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Add tag' }), { target: { value: 'custom' } });
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Add tag' }), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['hot', 'custom']);
  });

  it('calls onSearch for remote lookups when filterOption is false', () => {
    const onSearch = jest.fn();
    render(
      <ShopMultiSelect
        ariaLabel="Remote users"
        open
        showSearch
        filterOption={false}
        searchPlaceholder="Find user"
        options={[{ value: '9', label: 'Zed (#9)' }]}
        onSearch={onSearch}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find user' }), { target: { value: 'zed' } });
    expect(onSearch).toHaveBeenCalledWith('zed');
  });
});
