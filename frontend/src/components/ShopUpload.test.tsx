import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import ShopUpload from './ShopUpload';

describe('ShopUpload', () => {
  it('invokes beforeUpload with selected file', async () => {
    const uploadedNames: string[] = [];
    const beforeUpload = jest.fn(async (file: File) => {
      uploadedNames.push(file.name);
      return ShopUpload.LIST_IGNORE;
    });
    render(
      <ShopUpload accept="image/png" beforeUpload={beforeUpload} aria-label="Upload image">
        <span>Pick</span>
      </ShopUpload>,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(['hello'], 'shot.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(beforeUpload).toHaveBeenCalledTimes(1);
    });
    expect(uploadedNames).toEqual(['shot.png']);
  });

  it('does not fire when disabled', async () => {
    const beforeUpload = jest.fn();
    render(
      <ShopUpload disabled beforeUpload={beforeUpload} aria-label="Upload image">
        <span>Pick</span>
      </ShopUpload>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(beforeUpload).not.toHaveBeenCalled();
    });
  });

  it('exposes LIST_IGNORE compatibility token', () => {
    expect(ShopUpload.LIST_IGNORE).toBe(false);
  });

  it('reports accepted files while excluding LIST_IGNORE entries', async () => {
    const onChange = jest.fn();
    render(
      <ShopUpload multiple onChange={onChange} beforeUpload={(file) => file.name === 'skip.png' ? ShopUpload.LIST_IGNORE : true}>
        <span>Pick</span>
      </ShopUpload>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [
        new File(['x'], 'skip.png', { type: 'image/png' }),
        new File(['y'], 'keep.png', { type: 'image/png' }),
      ] },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0].file.name).toBe('keep.png');
  });
});
