import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopSegmented from './ShopSegmented';

describe('ShopSegmented', () => {
  it('renders commercial segmented options and changes selection', () => {
    const onChange = jest.fn();
    render(
      <ShopSegmented
        ariaLabel="Purchase mode"
        value="once"
        onChange={onChange}
        block
        options={[
          { label: 'One-time', value: 'once' },
          { label: 'Bundle', value: 'bundle' },
        ]}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'Purchase mode' });
    expect(group).toHaveClass('shop-segmented');
    expect(group).toHaveClass('shop-segmented--block');

    const once = screen.getByRole('radio', { name: 'One-time' });
    const bundle = screen.getByRole('radio', { name: 'Bundle' });
    expect(once).toHaveAttribute('aria-checked', 'true');
    expect(bundle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(bundle);
    expect(onChange).toHaveBeenCalledWith('bundle');

    fireEvent.click(once);
    expect(onChange).not.toHaveBeenCalledWith('once');
  });

  it('returns null when options are empty', () => {
    const { container } = render(
      <ShopSegmented value="a" options={[]} onChange={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('skips disabled options during keyboard navigation', () => {
    const onChange = jest.fn();
    render(
      <ShopSegmented
        ariaLabel="Mode"
        value="a"
        onChange={onChange}
        options={[{ label: 'A', value: 'a' }, { label: 'Blocked', value: 'blocked', disabled: true }, { label: 'C', value: 'c' }]}
      />,
    );
    const first = screen.getByRole('radio', { name: 'A' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.getByRole('radio', { name: 'C' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Blocked' })).toBeDisabled();
  });
});
