import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'ProductRichDetailEditor.tsx'), 'utf8');

describe('ProductRichDetailEditor admin content contract', () => {
  it('keeps add, edit, reorder, and delete controls labelled for operators', () => {
    expect(source).toContain('aria-label={addRichTextLabel}');
    expect(source).toContain('aria-label={addRichImageLabel}');
    expect(source).toContain('aria-label={addRichVideoLabel}');
    expect(source).toContain('aria-label={typeSelectLabel}');
    expect(source).toContain('aria-label={moveUpLabel}');
    expect(source).toContain('aria-label={moveDownLabel}');
    expect(source).toContain('aria-label={deleteLabel}');
    expect(source).toContain('aria-label={textInputLabel}');
    expect(source).toContain('aria-label={urlInputLabel}');
    expect(source).toContain('aria-label={captionInputLabel}');
  });

  it('keeps mobile-safe popups, compaction, and media preview restrictions', () => {
    expect(source).toContain("root: 'shop-mobile-popup-layer product-management-page__editorPopup'");
    expect(source).toContain('getPopupContainer={() => document.body}');
    expect(source).toContain('const compactBlocks = (blocks: ProductDetailBlock[])');
    expect(source).toContain('emit(compactBlocks(blocks));');
    expect(source).toContain('if (!canEmbedVideoUrl(mediaUrl))');
    expect(source).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(source).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(source).toContain('allow="fullscreen; picture-in-picture"');
    expect(source).toContain("t('pages.productAdmin.richInvalidUrl')");
  });


  it('uses ShopInput/ShopTextArea instead of ant Input', () => {
    expect(source).toContain('ShopInput');
    expect(source).toContain('ShopTextArea');
    expect(source).not.toMatch(/import \{[^}]*\bInput\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/const \{ TextArea \} = Input|<TextArea\b|<Input\b/);
  });

});
