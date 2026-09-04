import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../i18n';
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

  it('keeps a form-provided undefined value controlled', () => {
    const onChange = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(<ShopInput aria-label="Email" value={undefined} onChange={onChange} />);

    expect(screen.getByLabelText('Email')).toHaveValue('');
    rerender(<ShopInput aria-label="Email" value="shopper@example.com" onChange={onChange} />);

    expect(screen.getByLabelText('Email')).toHaveValue('shopper@example.com');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('changing an uncontrolled input to be controlled');
    consoleError.mockRestore();
  });

  it('clears an uncontrolled value and emits one empty change event', () => {
    const onChange = jest.fn();
    render(<ShopInput aria-label="Search" defaultValue="treats" allowClear onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('');
  });

  it('keeps a controlled value for the parent to clear', () => {
    const onChange = jest.fn();
    const { rerender } = render(<ShopInput aria-label="Search" value="treats" allowClear onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByLabelText('Search')).toHaveValue('treats');
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<ShopInput aria-label="Search" value="" allowClear onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });
});

describe('ShopPasswordInput', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('toggles visibility with iconRender button', () => {
    render(
      <LanguageProvider>
        <ShopPasswordInput
          aria-label="Password"
          defaultValue="secret"
          iconRender={(visible) => (
            <button type="button" aria-label={visible ? 'Hide password' : 'Show password'}>
              {visible ? 'hide' : 'show'}
            </button>
          )}
        />
      </LanguageProvider>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('localizes default visibility toggle labels', () => {
    window.localStorage.setItem('shop-language', 'es');
    render(
      <LanguageProvider>
        <ShopPasswordInput aria-label="Password" defaultValue="secret" />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button', { name: 'Password: Mostrar contraseña' })).toBeInTheDocument();
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

  it('keeps a form-provided undefined value controlled', () => {
    const onChange = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(<ShopTextArea aria-label="Notes" value={undefined} onChange={onChange} />);

    expect(screen.getByLabelText('Notes')).toHaveValue('');
    rerender(<ShopTextArea aria-label="Notes" value="Leave at reception" onChange={onChange} />);

    expect(screen.getByLabelText('Notes')).toHaveValue('Leave at reception');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('changing an uncontrolled input to be controlled');
    consoleError.mockRestore();
  });

  it('supports clearing a text area', () => {
    const onChange = jest.fn();
    render(<ShopTextArea aria-label="Notes" defaultValue="Leave at door" allowClear onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByLabelText('Notes')).toHaveValue('');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('');
  });
});
