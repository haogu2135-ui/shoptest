import React from 'react';
import { Button, Card, Empty, Image, Input, Select, Space, Typography } from 'antd';
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

const { Text } = Typography;
const { TextArea } = Input;

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

const RichVideoPreview: React.FC<{ block: ProductDetailBlock; index: number }> = ({ block, index }) => {
  const mediaUrl = resolveRichMediaUrl(block.url);
  if (!mediaUrl) return null;
  const videoUrl = toEmbeddableVideoUrl(mediaUrl);
  if (!canEmbedVideoUrl(mediaUrl)) {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
        {block.caption || block.url}
      </a>
    );
  }

  return (
    <div className="product-rich-detail-editor__videoPreview">
      {isDirectVideo(videoUrl) ? (
        <video src={videoUrl} controls className="product-rich-detail-editor__videoFrame" />
      ) : (
        <iframe
          src={videoUrl}
          title={block.caption || `Rich media preview ${index + 1}`}
          allowFullScreen
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

  return (
    <Space className="product-rich-detail-editor" direction="vertical" size="middle">
      <Space className="product-rich-detail-editor__toolbar" wrap>
        <Button icon={<FontSizeOutlined />} onClick={() => addBlock('text')}>{t('pages.productAdmin.addRichText')}</Button>
        <Button icon={<FileImageOutlined />} onClick={() => addBlock('image')}>{t('pages.productAdmin.addRichImage')}</Button>
        <Button icon={<VideoCameraOutlined />} onClick={() => addBlock('video')}>{t('pages.productAdmin.addRichVideo')}</Button>
      </Space>

      {blocks.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.productAdmin.richContent')} />
      ) : (
        <Space className="product-rich-detail-editor__blocks" direction="vertical" size="middle">
          {blocks.map((block, index) => (
            <Card
              className="product-rich-detail-editor__block"
              key={`${block.type}-${index}`}
              size="small"
              title={
                <Space className="product-rich-detail-editor__blockTitle">
                  <Select
                    className="product-rich-detail-editor__typeSelect"
                    value={block.type}
                    popupClassName="shop-mobile-popup-layer"
                    getPopupContainer={() => document.body}
                    options={[
                      { value: 'text', label: t('pages.productAdmin.richText') },
                      { value: 'image', label: t('pages.productAdmin.richImage') },
                      { value: 'video', label: t('pages.productAdmin.richVideo') },
                    ]}
                    onChange={(type) => updateBlock(index, createBlock(type))}
                  />
                  <Text type="secondary">#{index + 1}</Text>
                </Space>
              }
              extra={
                <Space className="product-rich-detail-editor__blockActions">
                  <Button icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveBlock(index, -1)} />
                  <Button icon={<ArrowDownOutlined />} disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} />
                  <Button danger icon={<DeleteOutlined />} onClick={() => removeBlock(index)} />
                </Space>
              }
            >
              {block.type === 'text' ? (
                <TextArea
                  rows={5}
                  value={block.content}
                  placeholder={t('pages.productAdmin.richTextPlaceholder')}
                  onChange={(event) => updateBlock(index, { content: event.target.value })}
                  onBlur={normalizeBeforeBlur}
                />
              ) : (
                <Space className="product-rich-detail-editor__mediaFields" direction="vertical" size="middle">
                  <Input
                    value={block.url}
                    placeholder={block.type === 'image' ? t('pages.productAdmin.richImagePlaceholder') : t('pages.productAdmin.richVideoPlaceholder')}
                    onChange={(event) => updateBlock(index, { url: event.target.value })}
                    onBlur={normalizeBeforeBlur}
                  />
                  <Input
                    value={block.caption}
                    placeholder={t('pages.productAdmin.richCaptionPlaceholder')}
                    onChange={(event) => updateBlock(index, { caption: event.target.value })}
                  />
                  {block.type === 'image' && block.url ? (
                    isHttpMediaUrl(block.url) ? (
                      <Image
                        className="product-rich-detail-editor__imagePreview"
                        src={resolveRichMediaUrl(block.url) || undefined}
                        fallback={imageFallbacks.media}
                      />
                    ) : (
                      <Text type="danger">{t('pages.productAdmin.richInvalidUrl')}</Text>
                    )
                  ) : null}
                  {block.type === 'video' && block.url ? <RichVideoPreview block={block} index={index} /> : null}
                </Space>
              )}
            </Card>
          ))}
        </Space>
      )}
    </Space>
  );
};

export default ProductRichDetailEditor;
