import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopInput, { ShopPasswordInput, ShopTextArea } from './ShopInput';

describe('ShopInput', () => {
  it('emits change events for Form.Item compatibility', () => {
    const onChange = jest.fn();
    render(<ShopInput aria-label="Username" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mia' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target.value).toBe('mia');
  });

  it('supports prefix and addonAfter', () => {
    render(
      <ShopInput
        aria-label="Code"
        prefix={<span data-testid="prefix">P</span>}
        addonAfter={<button type="button">Send</button>}
      />,
    );
    expect(screen.getByTestId('prefix')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});

describe('ShopPasswordInput', () => {
  it('toggles visibility with iconRender button', () => {
    render(
      <ShopPasswordInput
        aria-label="Password"
        defaultValue="secret"
        iconRender={(visible) => (
          <button type="button" aria-label={visible ? 'Hide password' : 'Show password'}>
            {visible ? 'hide' : 'show'}
          </button>
        )}
      />,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('ShopTextArea', () => {
  it('emits change events and tracks count', () => {
    const onChange = jest.fn();
    render(<ShopTextArea aria-label="Address" maxLength={10} showCount onChange={onChange} />);
    const field = screen.getByLabelText('Address');
    fireEvent.change(field, { target: { value: 'Calle 1' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].target.value).toBe('Calle 1');
    expect(screen.getByText('7/10')).toBeInTheDocument();
  });
});
