import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import ShopDatePicker from './ShopDatePicker';

describe('ShopDatePicker', () => {
  it('renders native date input and emits dayjs on change', () => {
    const onChange = jest.fn();
    render(
      <ShopDatePicker
        ariaLabel="Birthday"
        value={dayjs('2020-05-01')}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText('Birthday') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'date');
    expect(input.value).toBe('2020-05-01');

    fireEvent.change(input, { target: { value: '2021-06-15' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(dayjs.isDayjs(next)).toBe(true);
    expect(next.format('YYYY-MM-DD')).toBe('2021-06-15');
  });

  it('supports showTime via datetime-local', () => {
    const onChange = jest.fn();
    render(
      <ShopDatePicker
        ariaLabel="Starts at"
        showTime
        value={dayjs('2020-05-01T14:30:00')}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText('Starts at') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input.value).toBe('2020-05-01T14:30');

    fireEvent.change(input, { target: { value: '2021-06-15T09:15' } });
    const next = onChange.mock.calls[0][0];
    expect(next.format('YYYY-MM-DD HH:mm')).toBe('2021-06-15 09:15');
  });

  it('emits null when cleared', () => {
    const onChange = jest.fn();
    render(
      <ShopDatePicker
        ariaLabel="Birthday"
        value={dayjs('2020-05-01')}
        onChange={onChange}
        allowClear
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('applies className to the wrapper', () => {
    const { container } = render(
      <ShopDatePicker className="profile-pet-modal__field" ariaLabel="Birthday" />,
    );
    expect(container.querySelector('.shop-date-picker.profile-pet-modal__field')).toBeTruthy();
  });
});
