import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopInputNumber from './ShopInputNumber';

describe('ShopInputNumber', () => {
  it('emits numeric values for Form.Item compatibility', () => {
    const onChange = jest.fn();
    render(<ShopInputNumber aria-label="Weight" onChange={onChange} min={0} precision={2} />);
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '3.5' } });
    expect(onChange).toHaveBeenCalledWith(3.5);
  });

  it('emits null when cleared', () => {
    const onChange = jest.fn();
    render(<ShopInputNumber aria-label="Weight" value={2} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('supports prefix suffix and addonAfter', () => {
    render(
      <ShopInputNumber
        aria-label="Price"
        prefix={<span data-testid="prefix">$</span>}
        suffix={<span data-testid="suffix">%</span>}
        addonAfter={<span data-testid="addon">MXN</span>}
      />
    );
    expect(screen.getByTestId('prefix')).toBeInTheDocument();
    expect(screen.getByTestId('suffix')).toBeInTheDocument();
    expect(screen.getByTestId('addon')).toBeInTheDocument();
  });
});
