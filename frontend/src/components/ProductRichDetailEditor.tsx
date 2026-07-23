import React from 'react';
import ShopInput, { ShopTextArea } from './ShopInput';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  FileImageOutlined,
  FontSizeOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { ProductDetailBlock } from '../types';
import { useLanguage } from '../i18n';
import { imageFallbacks } from '../utils/mediaAssets';
import { canEmbedVideoUrl, isDirectVideo, isHttpMediaUrl, resolveRichMediaUrl, toEmbeddableVideoUrl } from './ProductRichDetail';
import './ProductRichDetailEditor.css';
import ShopButton from './ShopButton';
import ShopSelect from './ShopSelect';
import ShopImage from './ShopImage';

type ProductRichDetailEditorProps = {
  value?: ProductDetailBlock[];
  onChange?: (value: ProductDetailBlock[]) => void;
};

const createBlock = (type: ProductDetailBlock['type']): ProductDetailBlock => {
  if (type === 'image') return { type, url: '', caption: '' };
  if (type === 'video') return { type, url: '', caption: '' };
  return { type: 'text', content: '' };
};

const compactBlocks = (blocks: ProductDetailBlock[]) =>
  blocks.filter((block) => {
    if (block.type === 'text') return !!block.content?.trim();
    return !!block.url?.trim();
  });

const RichVideoPreview: React.FC<{ block: ProductDetailBlock; previewTitle: string }> = ({ block, previewTitle }) => {
  const mediaUrl = resolveRichMediaUrl(block.url);
  if (!mediaUrl) return null;
  const videoUrl = toEmbeddableVideoUrl(mediaUrl);
  const previewLabel = block.caption || previewTitle;
  if (!canEmbedVideoUrl(mediaUrl)) {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" aria-label={previewLabel} title={previewLabel}>
        {block.caption || block.url}
      </a>
    );
  }

  return (
    <div className="product-rich-detail-editor__videoPreview">
      {isDirectVideo(videoUrl) ? (
        <video src={videoUrl} controls aria-label={previewLabel} className="product-rich-detail-editor__videoFrame" />
      ) : (
        <iframe
          src={videoUrl}
          title={previewLabel}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; picture-in-picture"
          className="product-rich-detail-editor__videoFrame"
        />
      )}
    </div>
  );
};

const ProductRichDetailEditor: React.FC<ProductRichDetailEditorProps> = ({ value, onChange }) => {
  const blocks = Array.isArray(value) ? value : [];
  const { t } = useLanguage();

  const emit = (nextBlocks: ProductDetailBlock[]) => {
    onChange?.(nextBlocks);
  };

  const addBlock = (type: ProductDetailBlock['type']) => {
    emit([...blocks, createBlock(type)]);
  };

  const updateBlock = (index: number, patch: Partial<ProductDetailBlock>) => {
    emit(blocks.map((block, currentIndex) => currentIndex === index ? { ...block, ...patch } : block));
  };

  const removeBlock = (index: number) => {
    emit(blocks.filter((_, currentIndex) => currentIndex !== index));
  };

  const moveBlock = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const nextBlocks = [...blocks];
    const [block] = nextBlocks.splice(index, 1);
    nextBlocks.splice(targetIndex, 0, block);
    emit(nextBlocks);
  };

  const normalizeBeforeBlur = () => {
    emit(compactBlocks(blocks));
  };

  const editorLabel = t('pages.productAdmin.richContent');
  const addRichTextLabel = `${t('pages.productAdmin.addRichText')}: ${editorLabel}`;
  const addRichImageLabel = `${t('pages.productAdmin.addRichImage')}: ${editorLabel}`;
  const addRichVideoLabel = `${t('pages.productAdmin.addRichVideo')}: ${editorLabel}`;

  return (
    <div className="product-rich-detail-editor" aria-label={editorLabel}>
      <div className="product-rich-detail-editor__toolbar" aria-label={`${editorLabel}: ${blocks.length}`}>
        <ShopButton icon={<FontSizeOutlined />} aria-label={addRichTextLabel} title={addRichTextLabel} onClick={() => addBlock('text')}>{t('pages.productAdmin.addRichText')}</ShopButton>
        <ShopButton icon={<FileImageOutlined />} aria-label={addRichImageLabel} title={addRichImageLabel} onClick={() => addBlock('image')}>{t('pages.productAdmin.addRichImage')}</ShopButton>
        <ShopButton icon={<VideoCameraOutlined />} aria-label={addRichVideoLabel} title={addRichVideoLabel} onClick={() => addBlock('video')}>{t('pages.productAdmin.addRichVideo')}</ShopButton>
      </div>

      {blocks.length === 0 ? (
        <div className="product-rich-detail-editor__emptyPanel" role="status">
          <div className="product-rich-detail-editor__emptyDescription">{t('pages.productAdmin.richContent')}</div>
        </div>
      ) : (
        <div className="product-rich-detail-editor__blocks">
          {blocks.map((block, index) => {
            const blockNumber = index + 1;
            const blockTypeLabel = block.type === 'image'
              ? t('pages.productAdmin.richImage')
              : block.type === 'video'
                ? t('pages.productAdmin.richVideo')
                : t('pages.productAdmin.richText');
            const blockLabel = `${editorLabel} #${blockNumber}: ${blockTypeLabel}`;
            const typeSelectLabel = `${blockLabel}: ${blockTypeLabel}`;
            const moveUpLabel = `${t('pages.productAdmin.moveRichBlockUp')}: ${blockLabel}`;
            const moveDownLabel = `${t('pages.productAdmin.moveRichBlockDown')}: ${blockLabel}`;
            const deleteLabel = `${t('pages.productAdmin.deleteRichBlock')}: ${blockLabel}`;
            const textInputLabel = `${t('pages.productAdmin.richText')}: ${blockLabel}`;
            const urlInputLabel = `${block.type === 'image' ? t('pages.productAdmin.richImagePlaceholder') : t('pages.productAdmin.richVideoPlaceholder')}: ${blockLabel}`;
            const captionInputLabel = `${t('pages.productAdmin.richCaptionPlaceholder')}: ${blockLabel}`;

            return (
              <article key={`${block.type}-${index}`} className="product-rich-detail-editor__block"><div className="shop-panel__head"><div className="shop-panel__title">{
                  <div className="product-rich-detail-editor__blockTitle" aria-label={blockLabel}>
                    <ShopSelect
                      className="product-rich-detail-editor__typeSelect"
                      value={block.type}
                      ariaLabel={typeSelectLabel}
                      title={typeSelectLabel}
                      popupClassName="shop-mobile-popup-layer product-management-page__editorPopup"
                      options={[
                        { value: 'text', label: t('pages.productAdmin.richText') },
                        { value: 'image', label: t('pages.productAdmin.richImage') },
                        { value: 'video', label: t('pages.productAdmin.richVideo') },
                      ]}
                      onChange={(type) => {
                        if (!type) return;
                        updateBlock(index, createBlock(type as 'text' | 'image' | 'video'));
                      }}
                    />
                    <span className="product-rich-detail-editor__blockIndex">#{blockNumber}</span>
                  </div>
                }</div><div className="shop-panel__extra">{
                  <div className="product-rich-detail-editor__blockActions" aria-label={`${blockLabel}: ${t('common.actions')}`}>
                    <ShopButton
                      icon={<ArrowUpOutlined />}
                      disabled={index === 0}
                      aria-label={moveUpLabel}
                      title={moveUpLabel}
                      onClick={() => moveBlock(index, -1)}
                    />
                    <ShopButton
                      icon={<ArrowDownOutlined />}
                      disabled={index === blocks.length - 1}
                      aria-label={moveDownLabel}
                      title={moveDownLabel}
                      onClick={() => moveBlock(index, 1)}
                    />
                    <ShopButton
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={deleteLabel}
                      title={deleteLabel}
                      onClick={() => removeBlock(index)}
                    />
                  </div>
                }</div></div>
                {block.type === 'text' ? (
                  <ShopTextArea
                    rows={5}
                    value={block.content}
                    placeholder={t('pages.productAdmin.richTextPlaceholder')}
                    aria-label={textInputLabel}
                    title={textInputLabel}
                    onChange={(event) => updateBlock(index, { content: event.target.value })}
                    onBlur={normalizeBeforeBlur}
                  />
                ) : (
                  <div className="product-rich-detail-editor__mediaFields" aria-label={blockLabel}>
                    <ShopInput
                      value={block.url}
                      placeholder={block.type === 'image' ? t('pages.productAdmin.richImagePlaceholder') : t('pages.productAdmin.richVideoPlaceholder')}
                      aria-label={urlInputLabel}
                      title={urlInputLabel}
                      onChange={(event) => updateBlock(index, { url: event.target.value })}
                      onBlur={normalizeBeforeBlur}
                    />
                    <ShopInput
                      value={block.caption}
                      placeholder={t('pages.productAdmin.richCaptionPlaceholder')}
                      aria-label={captionInputLabel}
                      title={captionInputLabel}
                      onChange={(event) => updateBlock(index, { caption: event.target.value })}
                    />
                    {block.url && !isHttpMediaUrl(block.url) ? (
                      <span className="product-rich-detail-editor__invalidUrl">{t('pages.productAdmin.richInvalidUrl')}</span>
                    ) : null}
                    {block.type === 'image' && block.url && isHttpMediaUrl(block.url) ? (
                        <ShopImage
                          className="product-rich-detail-editor__imagePreview"
                          src={resolveRichMediaUrl(block.url) || undefined}
                          alt={block.caption || `${t('pages.productAdmin.mediaPreview')} #${blockNumber}`}
                          fallback={imageFallbacks.media}
                        />
                    ) : null}
                    {block.type === 'video' && block.url && isHttpMediaUrl(block.url) ? (
                      <RichVideoPreview block={block} previewTitle={`${t('pages.productAdmin.richPreview')} #${blockNumber}`} />
                    ) : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductRichDetailEditor;
