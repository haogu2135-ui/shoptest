import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopSwitch from './ShopSwitch';

describe('ShopSwitch', () => {
  it('toggles uncontrolled state and emits onChange', () => {
    const onChange = jest.fn();
    render(<ShopSwitch ariaLabel="Featured" onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Featured' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('supports controlled checked and disabled', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <ShopSwitch ariaLabel="Debug" checked={false} onChange={onChange} />,
    );
    const control = screen.getByRole('switch', { name: 'Debug' });
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(control).toHaveAttribute('aria-checked', 'false');

    rerender(<ShopSwitch ariaLabel="Debug" checked disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Debug' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders checkedChildren text and dual ant classes when on', () => {
    const { container } = render(
      <ShopSwitch
        ariaLabel="Free shipping"
        checked
        checkedChildren="Free"
        unCheckedChildren="Paid"
      />,
    );
    expect(screen.getByRole('switch', { name: 'Free shipping' })).toHaveTextContent('Free');
    expect(container.querySelector('.shop-switch.ant-switch.ant-switch-checked')).toBeTruthy();
  });
});
