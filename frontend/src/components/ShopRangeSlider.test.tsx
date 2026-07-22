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
});
