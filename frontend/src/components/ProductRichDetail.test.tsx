import { render, screen } from '@testing-library/react';
import ProductRichDetail, {
  isDirectVideo,
  isHttpMediaUrl,
  parseDetailContent,
  resolveRichMediaUrl,
  toEmbeddableVideoUrl,
} from './ProductRichDetail';

const mockBuildResponsiveImageSrcSet = jest.fn((value: string) => `${value}?w=480 480w, ${value}?w=960 960w`);

jest.mock('../utils/mediaAssets', () => ({
  buildResponsiveImageSrcSet: (value: string) => mockBuildResponsiveImageSrcSet(value),
  resolveApiAssetUrl: (value: string) => value,
}));

describe('ProductRichDetail helpers', () => {
  it('trims media urls and rejects credentialed urls', () => {
    expect(isHttpMediaUrl(' https://cdn.example.com/image.jpg ')).toBe(true);
    expect(resolveRichMediaUrl(' https://cdn.example.com/image.jpg ')).toBe('https://cdn.example.com/image.jpg');
    expect(isHttpMediaUrl('https://user:pass@example.com/image.jpg')).toBe(false);
  });

  it('rejects obfuscated rich media urls', () => {
    expect(isHttpMediaUrl('https:\\\\cdn.example.com/image.jpg')).toBe(false);
    expect(isHttpMediaUrl('/uploads/products%5csecret.jpg')).toBe(false);
    expect(isHttpMediaUrl('https://cdn.example.com/video.mp4%00.jpg')).toBe(false);
  });

  it('normalizes rich detail blocks and drops unsupported entries', () => {
    expect(parseDetailContent(JSON.stringify([
      { type: 'text', content: '  Details  ' },
      { type: 'image', url: ' https://cdn.example.com/a.jpg ', caption: ' Photo ' },
      { type: 'script', content: 'bad' },
      { type: 'video', url: '' },
    ]))).toEqual([
      { type: 'text', content: 'Details' },
      { type: 'image', url: 'https://cdn.example.com/a.jpg', caption: 'Photo' },
    ]);
  });

  it('recognizes direct video urls with query or hash suffixes', () => {
    expect(isDirectVideo('https://cdn.example.com/demo.mp4#t=1')).toBe(true);
    expect(isDirectVideo('https://cdn.example.com/demo.webm?token=1')).toBe(true);
  });

  it('normalizes youtube and vimeo embeds', () => {
    expect(toEmbeddableVideoUrl('https://youtu.be/abc123')).toBe('https://www.youtube.com/embed/abc123');
    expect(toEmbeddableVideoUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
  });

  it('renders rich detail images with responsive loading attributes', () => {
    render(
      <ProductRichDetail
        detailContent={[
          { type: 'image', url: 'https://images.example.com/pet-bed.jpg', caption: 'Pet bed detail' },
        ]}
      />
    );

    const image = screen.getByRole('img', { name: 'Pet bed detail' });
    expect(image).toHaveAttribute('src', 'https://images.example.com/pet-bed.jpg');
    expect(image).toHaveAttribute('srcset', expect.stringContaining('480w'));
    expect(image).toHaveAttribute('sizes', 'min(860px, 100vw)');
    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '900');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(mockBuildResponsiveImageSrcSet).toHaveBeenCalledWith('https://images.example.com/pet-bed.jpg');
  });
});
