import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShopImage from './ShopImage';

const cssSource = fs.readFileSync(path.resolve(__dirname, 'ShopImage.css'), 'utf8');

describe('ShopImage', () => {
  it('renders dual ant-image classes and alt text', () => {
    const { container } = render(
      <ShopImage src="https://example.com/a.png" alt="Product" width={50} height={50} preview={false} />,
    );
    expect(container.querySelector('.shop-image.ant-image')).toBeTruthy();
    expect(screen.getByAltText('Product')).toBeInTheDocument();
  });

  it('falls back when image errors', () => {
    render(
      <ShopImage src="https://example.com/broken.png" alt="Broken" fallback="https://example.com/fallback.png" preview={false} />,
    );
    const img = screen.getByAltText('Broken') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.getAttribute('src')).toContain('fallback.png');
  });

  it('keeps image preview focus trapped and restores focus after closing', async () => {
    const { container } = render(
      <ShopImage src="https://example.com/preview.png" alt="Product preview" />,
    );
    const image = screen.getByRole('button', { name: 'Product preview' });
    image.focus();
    fireEvent.keyDown(image, { key: 'Enter' });

    const dialog = await screen.findByRole('dialog', { name: 'Product preview' });
    const close = screen.getByRole('button', { name: 'Close' });
    await waitFor(() => expect(close).toHaveFocus());

    const previewImage = container.querySelector('.shop-image-preview__img') as HTMLImageElement;
    fireEvent.click(previewImage);
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Product preview' })).not.toBeInTheDocument());
    expect(image).toHaveFocus();
  });

  it('keeps the preview close control on a commercial touch target', () => {
    expect(cssSource).toMatch(/\.shop-image-preview__close\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*height:\s*44px;[^}]*min-height:\s*44px/);
    expect(cssSource).not.toMatch(/\.shop-image-preview__close\s*\{[^}]*?(?:width|height|min-width|min-height):\s*(?:3[0-9]|4[0-3])px/);
  });

  it('closes a stale preview when the source changes and supports localized close text', () => {
    const { rerender } = render(
      <ShopImage src="https://example.com/first.png" alt="First" previewCloseLabel="Cerrar" />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();

    rerender(<ShopImage src="https://example.com/second.png" alt="Second" previewCloseLabel="Cerrar" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
