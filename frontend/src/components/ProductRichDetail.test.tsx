import {
  isDirectVideo,
  isHttpMediaUrl,
  parseDetailContent,
  resolveRichMediaUrl,
  toEmbeddableVideoUrl,
} from './ProductRichDetail';

jest.mock('../utils/mediaAssets', () => ({
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
});
