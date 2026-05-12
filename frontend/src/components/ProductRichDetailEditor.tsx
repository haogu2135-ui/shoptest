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
import { canEmbedVideoUrl, isDirectVideo, isHttpMediaUrl, toEmbeddableVideoUrl } from './ProductRichDetail';

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
  if (!isHttpMediaUrl(block.url)) return null;
  const videoUrl = toEmbeddableVideoUrl(block.url);
  if (!canEmbedVideoUrl(block.url)) {
    return (
      <a href={block.url} target="_blank" rel="noopener noreferrer">
        {block.caption || block.url}
      </a>
    );
  }

  return (
    <div style={{ width: 280, maxWidth: '100%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 6, background: '#111' }}>
      {isDirectVideo(videoUrl) ? (
        <video src={videoUrl} controls style={{ width: '100%', height: '100%' }} />
      ) : (
        <iframe
          src={videoUrl}
          title={block.caption || `Rich media preview ${index + 1}`}
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 0 }}
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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Button icon={<FontSizeOutlined />} onClick={() => addBlock('text')}>{t('pages.productAdmin.addRichText')}</Button>
        <Button icon={<FileImageOutlined />} onClick={() => addBlock('image')}>{t('pages.productAdmin.addRichImage')}</Button>
        <Button icon={<VideoCameraOutlined />} onClick={() => addBlock('video')}>{t('pages.productAdmin.addRichVideo')}</Button>
      </Space>

      {blocks.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pages.productAdmin.richContent')} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {blocks.map((block, index) => (
            <Card
              key={`${block.type}-${index}`}
              size="small"
              title={
                <Space>
                  <Select
                    value={block.type}
                    style={{ width: 120 }}
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
                <Space>
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
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
                    <Image
                      src={block.url}
                      width={180}
                      style={{ borderRadius: 6, objectFit: 'cover' }}
                      fallback="https://via.placeholder.com/180x120?text=Image"
                    />
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
