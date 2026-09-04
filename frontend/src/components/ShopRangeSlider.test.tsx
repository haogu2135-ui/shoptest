import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopRangeSlider from './ShopRangeSlider';

describe('ShopRangeSlider', () => {
  it('updates range handles and commits on pointer end', () => {
    const onChange = jest.fn();
    const onChangeComplete = jest.fn();
    render(
      <ShopRangeSlider
        min={0}
        max={100}
        step={5}
        value={[10, 80]}
        onChange={onChange}
        onChangeComplete={onChangeComplete}
        ariaLabelForHandle={['Min price', 'Max price']}
      />,
    );

    const maxHandle = screen.getByLabelText('Max price');
    fireEvent.change(maxHandle, { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith([10, 60]);
    fireEvent.mouseUp(maxHandle);
    expect(onChangeComplete).toHaveBeenCalledWith([10, 60]);
  });

  it('normalizes invalid bounds, values, and step', () => {
    const onChange = jest.fn();
    render(
      <ShopRangeSlider
        min={10}
        max={0}
        step={0}
        value={[Number.NaN, Number.POSITIVE_INFINITY]}
        onChange={onChange}
      />,
    );
    const handles = screen.getAllByRole('slider');
    expect(handles[0]).toHaveAttribute('min', '0');
    expect(handles[0]).toHaveAttribute('max', '10');
    expect(handles[0]).toHaveAttribute('step', '1');
    expect(handles[0]).toHaveValue('0');
    expect(handles[1]).toHaveValue('10');
  });

  it('uses the latest step when props change', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <ShopRangeSlider min={0} max={10} step={1} value={[0, 10]} onChange={onChange} />,
    );

    rerender(<ShopRangeSlider min={0} max={10} step={5} value={[0, 10]} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '3' } });

    expect(onChange).toHaveBeenCalledWith([5, 10]);
  });
});
