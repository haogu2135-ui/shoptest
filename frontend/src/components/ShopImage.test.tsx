import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopImage from './ShopImage';

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
});
