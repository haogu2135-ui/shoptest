import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import ShopRangePicker from './ShopRangePicker';

describe('ShopRangePicker', () => {
  it('renders start/end inputs and emits dayjs range', () => {
    const onChange = jest.fn();
    render(
      <ShopRangePicker
        ariaLabel="Valid time"
        showTime
        value={[dayjs('2020-01-01T10:00:00'), dayjs('2020-01-02T12:00:00')]}
        onChange={onChange}
        startAriaLabel="Start"
        endAriaLabel="End"
      />,
    );

    const start = screen.getByLabelText('Start') as HTMLInputElement;
    const end = screen.getByLabelText('End') as HTMLInputElement;
    expect(start).toHaveAttribute('type', 'datetime-local');
    expect(start.value).toBe('2020-01-01T10:00');
    expect(end.value).toBe('2020-01-02T12:00');

    fireEvent.change(start, { target: { value: '2020-02-01T08:30' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as [dayjs.Dayjs, dayjs.Dayjs];
    expect(next[0].format('YYYY-MM-DD HH:mm')).toBe('2020-02-01 08:30');
    expect(next[1].format('YYYY-MM-DD HH:mm')).toBe('2020-01-02 12:00');
  });

  it('emits null when cleared', () => {
    const onChange = jest.fn();
    render(
      <ShopRangePicker
        ariaLabel="Range"
        value={[dayjs('2020-01-01'), null]}
        onChange={onChange}
        allowClear
        startAriaLabel="Start"
        endAriaLabel="End"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('applies className and ids', () => {
    const { container } = render(
      <ShopRangePicker
        className="coupon-range"
        startId="range-start"
        endId="range-end"
        startAriaLabel="Start"
        endAriaLabel="End"
      />,
    );
    expect(container.querySelector('.shop-range-picker.coupon-range')).toBeTruthy();
    expect(container.querySelector('#range-start')).toBeTruthy();
    expect(container.querySelector('#range-end')).toBeTruthy();
  });
});
