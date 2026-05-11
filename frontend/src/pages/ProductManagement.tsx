import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, message, Space, Select, Tag, Switch, DatePicker,
  Tooltip, Typography, Divider, Image, Popconfirm, TreeSelect, Upload, Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled,
  SearchOutlined, MinusCircleOutlined, UploadOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { productApi, categoryApi, adminApi, brandApi } from '../api';
import type { Product, Category, Brand } from '../types';
import { buildCategoryTree, descendantIdSet, flattenCategoryTree, getCategoryPath, toTreeOptions } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import dayjs from 'dayjs';
import ProductRichDetailEditor from '../components/ProductRichDetailEditor';
import ProductRichDetail from '../components/ProductRichDetail';
import { useMarket } from '../hooks/useMarket';
import './ProductManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const tagColorMap: Record<string, string> = { hot: 'red', new: 'blue', discount: 'orange' };
const productStatusColors: Record<string, string> = {
  ACTIVE: 'green',
  PENDING_REVIEW: 'orange',
  REJECTED: 'red',
  INACTIVE: 'default',
};
const productStatusLabels: Record<string, string> = {
  ACTIVE: 'pages.productAdmin.approved',
  PENDING_REVIEW: 'pages.productAdmin.pending',
  REJECTED: 'pages.productAdmin.rejected',
  INACTIVE: 'status.INACTIVE',
};

const emptyDetailBlock = { type: 'text', content: '', url: '', caption: '' };

const parseJsonArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
};

const specOptionsToFormRows = (specs: Record<string, string>) =>
  Object.entries(specs)
    .filter(([key]) => key.startsWith('options.'))
    .map(([key, value]) => ({
      name: key.replace(/^options\./, ''),
      values: String(value || '').split(',').map(item => item.trim()).filter(Boolean).join(', '),
    }));

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [selectedProductIds, setSelectedProductIds] = useState<React.Key[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const { t, language } = useLanguage();
  const detailContentPreview = Form.useWatch('detailContent', form);
  const descriptionPreview = Form.useWatch('description', form);
  const spanishNamePreview = Form.useWatch(['localizedContent', 'es', 'name'], form);
  const chineseNamePreview = Form.useWatch(['localizedContent', 'zh', 'name'], form);
  const previewName = Form.useWatch('name', form);
  const previewPrice = Form.useWatch('price', form);
  const previewOriginalPrice = Form.useWatch('originalPrice', form);
  const previewDiscount = Form.useWatch('discount', form);
  const previewStock = Form.useWatch('stock', form);
  const previewBrand = Form.useWatch('brand', form);
  const previewTag = Form.useWatch('tag', form);
  const previewFeatured = Form.useWatch('isFeatured', form);
  const previewFreeShipping = Form.useWatch('freeShipping', form);
  const { formatMoney } = useMarket();

  const tagOptions = [
    { value: 'hot', label: t('pages.productAdmin.hot'), color: 'red' },
    { value: 'new', label: t('pages.productAdmin.new'), color: 'blue' },
    { value: 'discount', label: t('pages.productAdmin.discount'), color: 'orange' },
  ];
  const tagLabelMap: Record<string, string> = {
    hot: t('pages.productAdmin.hot'),
    new: t('pages.productAdmin.new'),
    discount: t('pages.productAdmin.discount'),
  };

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const categoryOptions = useMemo(() => toTreeOptions(categoryTree, undefined, language), [categoryTree, language]);
  const selectedCategoryIds = useMemo(() => {
    if (!filterCategory) return null;
    const category = flatCategories.find(item => item.id === filterCategory);
    return category ? descendantIdSet(category) : new Set<number>([filterCategory]);
  }, [filterCategory, flatCategories]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await productApi.getAll();
      setProducts(response.data);
    } catch (error) {
      message.error(t('pages.productAdmin.fetchProductsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await categoryApi.getAll();
      setCategories(response.data);
    } catch (error) {
      message.error(t('pages.productAdmin.fetchCategoriesFailed'));
    }
  }, [t]);

  const fetchBrands = useCallback(async () => {
    try {
      const response = await brandApi.getAll({ activeOnly: true });
      setBrands(response.data);
    } catch (error) {
      message.error(t('pages.productAdmin.fetchBrandsFailed'));
    }
  }, [t]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, [fetchProducts, fetchCategories, fetchBrands]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchKeyword = !searchKeyword || p.name.toLowerCase().includes(searchKeyword.toLowerCase());
      const matchCategory = !selectedCategoryIds || selectedCategoryIds.has(p.categoryId);
      const matchStatus = !filterStatus || (p.status || 'ACTIVE') === filterStatus;
      return matchKeyword && matchCategory && matchStatus;
    });
  }, [products, searchKeyword, selectedCategoryIds, filterStatus]);

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue({
      images: [],
      specifications: [{}],
      optionGroups: [{ name: 'Size', values: '' }, { name: 'Color', values: '' }],
      variants: [],
      detailContent: [emptyDetailBlock],
      status: 'ACTIVE',
      freeShipping: false,
    });
    setImagePreviewUrl('');
    setModalVisible(true);
  };

  const handleEdit = (record: Product) => {
    setEditingProduct(record);
    const images = parseJsonArray(record.images).filter((image): image is string => typeof image === 'string');
    const specsObj = parseJsonObject(record.specifications);
    const localizedContent = {
      es: {
        name: specsObj['i18n.es.name'],
        description: specsObj['i18n.es.description'],
        brand: specsObj['i18n.es.brand'],
      },
      zh: {
        name: specsObj['i18n.zh.name'],
        description: specsObj['i18n.zh.description'],
        brand: specsObj['i18n.zh.brand'],
      },
    };
    Object.keys(specsObj).forEach((key) => {
      if (key.startsWith('i18n.')) delete specsObj[key];
    });
    const optionRows = specOptionsToFormRows(specsObj);
    Object.keys(specsObj).forEach((key) => {
      if (key.startsWith('options.')) delete specsObj[key];
    });
    const detailContent = parseJsonArray(record.detailContent);
    const variants = parseJsonArray(record.variants).map((variant: any) => ({
      sku: variant.sku,
      optionText: Object.entries(variant.options || {}).map(([key, value]) => `${key}=${value}`).join(', '),
      price: variant.price,
      stock: variant.stock,
      imageUrl: variant.imageUrl,
    }));
    const specs = Object.keys(specsObj).length > 0
      ? Object.entries(specsObj).map(([key, value]) => ({ key, value }))
      : [{}];
    form.setFieldsValue({
      ...record,
      images,
      specifications: specs,
      optionGroups: optionRows.length > 0 ? optionRows : [{ name: 'Size', values: '' }, { name: 'Color', values: '' }],
      variants,
      localizedContent,
      detailContent: detailContent.length > 0 ? detailContent : [emptyDetailBlock],
      limitedTimeRange: record.limitedTimeStartAt && record.limitedTimeEndAt
        ? [dayjs(record.limitedTimeStartAt), dayjs(record.limitedTimeEndAt)]
        : undefined,
    });
    setImagePreviewUrl(record.imageUrl || '');
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await productApi.delete(id);
      message.success(t('pages.productAdmin.deleted'));
      fetchProducts();
    } catch (error) {
      message.error(t('messages.deleteFailed'));
    }
  };

  const handleToggleFeatured = async (record: Product) => {
    try {
      await productApi.update(record.id, { ...record, isFeatured: !record.isFeatured });
      message.success(record.isFeatured ? t('pages.productAdmin.unfeatured') : t('pages.productAdmin.featured'));
      fetchProducts();
    } catch (err) {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleProductStatus = async (record: Product, status: string) => {
    try {
      await adminApi.updateProductStatus(record.id, status);
      message.success(t('messages.updateSuccess'));
      fetchProducts();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    }
  };

  const handleBatchProductStatus = async (status: string) => {
    if (selectedProductIds.length === 0) {
      message.error(t('pages.productAdmin.selectProductsFirst'));
      return;
    }
    try {
      const ids = selectedProductIds.map((id) => Number(id));
      const res = await adminApi.batchUpdateProductStatus(ids, status);
      message.success(t('pages.productAdmin.batchUpdateResult', res.data));
      setSelectedProductIds([]);
      fetchProducts();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    }
  };

  const generateVariantRows = () => {
    const optionGroups: Array<{ name: string; values: string[] }> = (form.getFieldValue('optionGroups') || [])
      .map((group: any) => ({
        name: String(group?.name || '').trim(),
        values: String(group?.values || '').split(',').map((item: string) => item.trim()).filter(Boolean),
      }))
      .filter((group: any) => group.name && group.values.length > 0);
    if (optionGroups.length === 0) {
      message.warning(t('pages.productAdmin.variantOptionsRequired'));
      return;
    }
    const combinations: Array<Record<string, string>> = optionGroups.reduce((rows: Array<Record<string, string>>, group) => {
      if (rows.length === 0) {
        return group.values.map((value: string) => ({ [group.name]: value }));
      }
      return rows.flatMap((row) => group.values.map((value: string) => ({ ...row, [group.name]: value })));
    }, []);
    form.setFieldValue('variants', combinations.map((options) => ({
      optionText: Object.entries(options).map(([key, value]) => `${key}=${value}`).join(', '),
      price: form.getFieldValue('price') || 0,
      stock: form.getFieldValue('stock') || 0,
    })));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // Convert specifications from array of {key, value} to object
      const specs: Record<string, string> = {};
      if (values.specifications) {
        values.specifications.forEach((s: any) => {
          if (s.key && s.key.trim() && s.value && s.value.trim()) specs[s.key.trim()] = s.value.trim();
        });
      }
      // Filter out empty image URLs
      const imageList = (values.images || []).filter((url: string) => url && url.trim());
      const detailContent = (values.detailContent || [])
        .map((block: any) => ({
          type: block.type || 'text',
          content: block.content?.trim(),
          url: block.url?.trim(),
          caption: block.caption?.trim(),
        }))
        .filter((block: any) => block.type === 'text' ? !!block.content : !!block.url);
      const localizedContent = values.localizedContent || {};
      ['es', 'zh'].forEach((locale) => {
        ['name', 'description', 'brand'].forEach((field) => {
          const text = localizedContent?.[locale]?.[field];
          if (typeof text === 'string' && text.trim()) {
            specs[`i18n.${locale}.${field}`] = text.trim();
          }
        });
      });
      (values.optionGroups || []).forEach((group: any) => {
        const name = String(group?.name || '').trim();
        const valuesText = String(group?.values || '').trim();
        if (name && valuesText) {
          const options = valuesText.split(',').map((item: string) => item.trim()).filter(Boolean);
          if (options.length) specs[`options.${name}`] = options.join(',');
        }
      });
      const variants = (values.variants || [])
        .map((variant: any) => {
          const optionText = String(variant?.optionText || '').trim();
          const options = optionText.split(',').reduce((result: Record<string, string>, item: string) => {
            const [rawKey, ...rawValue] = item.split('=');
            const key = String(rawKey || '').trim();
            const value = rawValue.join('=').trim();
            if (key && value) result[key] = value;
            return result;
          }, {});
          return {
            sku: variant?.sku?.trim(),
            options,
            price: Number(variant?.price || 0),
            stock: variant?.stock === undefined || variant?.stock === null ? undefined : Number(variant.stock),
            imageUrl: variant?.imageUrl?.trim(),
          };
        })
        .filter((variant: any) => Object.keys(variant.options).length > 0 && variant.price > 0);
      const { specifications: _specs, images: _images, detailContent: _detailContent, localizedContent: _localizedContent, optionGroups: _optionGroups, variants: _variants, limitedTimeRange, ...rest } = values;
      const payload: any = {
        ...rest,
        specifications: Object.keys(specs).length > 0 ? specs : null,
        images: imageList.length > 0 ? imageList : null,
        detailContent: detailContent.length > 0 ? detailContent : null,
        variants: variants.length > 0 ? variants : null,
        limitedTimeStartAt: limitedTimeRange?.[0] ? limitedTimeRange[0].format('YYYY-MM-DDTHH:mm:ss') : null,
        limitedTimeEndAt: limitedTimeRange?.[1] ? limitedTimeRange[1].format('YYYY-MM-DDTHH:mm:ss') : null,
      };
      if (editingProduct) {
        await productApi.update(editingProduct.id, payload);
        message.success(t('pages.productAdmin.updated'));
      } else {
        await productApi.create(payload);
        message.success(t('pages.productAdmin.created'));
      }
      setModalVisible(false);
      fetchProducts();
    } catch (error) {
      message.error(t('messages.operationFailed'));
    }
  };

  const downloadImportTemplate = () => {
    const headers = [
      'id', 'name', 'description', 'price', 'stock', 'categoryId', 'imageUrl', 'isFeatured',
      'brand', 'originalPrice', 'discount', 'limitedTimePrice', 'limitedTimeStartAt',
      'limitedTimeEndAt', 'tag', 'images', 'specifications', 'detailContent', 'warranty', 'shipping', 'status', 'freeShipping', 'freeShippingThreshold',
    ];
    const sample = [
      '', 'Sample product', 'Product description', '99.90', '100', categories[0]?.id || 1,
      'https://example.com/image.jpg', 'false', 'Brand', '129.90', '20', '', '', '',
      'new', '["https://example.com/extra.jpg"]', '{"material":"cotton"}',
      '[{"type":"text","content":"Detailed product story"},{"type":"image","url":"https://example.com/detail.jpg","caption":"Detail image"}]',
      '1 year', 'Free shipping', 'ACTIVE', 'false', '',
    ];
    const csv = `${headers.join(',')}\r\n${sample.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')}\r\n`;
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProducts = async (file: File) => {
    try {
      setLoading(true);
      const res = await adminApi.importProducts(file);
      const result = res.data;
      if (result.failed > 0) {
        Modal.warning({
          title: t('pages.productAdmin.importPartialTitle'),
          content: (
            <div>
              <p>{t('pages.productAdmin.importSummary', result as any)}</p>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{result.errors.join('\n')}</pre>
            </div>
          ),
          width: 640,
        });
      } else {
        message.success(t('pages.productAdmin.importSuccess', result as any));
      }
      fetchProducts();
    } catch (error: any) {
      message.error(error.response?.data?.errors?.join('\n') || t('pages.productAdmin.importFailed'));
    } finally {
      setLoading(false);
    }
    return false;
  };

  const renderPrice = (record: Product) => {
    const displayPrice = record.effectivePrice ?? record.price;
    const hasDiscount = record.originalPrice && record.originalPrice > displayPrice;
    const discountPercent = record.effectiveDiscountPercent || record.discount || (hasDiscount ? Math.round((1 - displayPrice / record.originalPrice!) * 100) : 0);
    return (
      <div>
        <span style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(displayPrice)}</span>
        {record.activeLimitedTimeDiscount ? <Tag color="red" style={{ marginLeft: 4 }}>{t('pages.productAdmin.limitedTimeActive')}</Tag> : null}
        {hasDiscount && (
          <>
            <br />
            <Text delete type="secondary" style={{ fontSize: 12 }}>{formatMoney(record.originalPrice!)}</Text>
            <Tag color="volcano" style={{ marginLeft: 4, fontSize: 11 }}>-{discountPercent}%</Tag>
          </>
        )}
      </div>
    );
  };

  const renderProductPreview = () => {
    const image = imagePreviewUrl || form.getFieldValue('imageUrl');
    const price = Number(previewPrice || 0);
    const originalPrice = Number(previewOriginalPrice || 0);
    const discount = Number(previewDiscount || 0);
    const hasOriginalPrice = originalPrice > price && price > 0;
    const computedDiscount = hasOriginalPrice ? Math.round((1 - price / originalPrice) * 100) : discount;
    const tagValues = Array.isArray(previewTag) ? previewTag : previewTag ? [previewTag] : [];

    return (
      <section className="shopify-card product-live-preview">
        <div className="shopify-card__header">
          <h3>{t('pages.productAdmin.livePreview')}</h3>
          {previewFeatured ? <Tag color="gold">{t('pages.productAdmin.bestSeller')}</Tag> : null}
        </div>
        <div className="product-live-preview__card">
          <div className="product-live-preview__image">
            {image ? (
              <img src={image} alt={previewName || t('pages.productAdmin.productTitlePreview')} />
            ) : (
              <span>{t('pages.productAdmin.mediaPreview')}</span>
            )}
            {computedDiscount > 0 ? <Tag color="volcano" className="product-live-preview__badge">-{computedDiscount}%</Tag> : null}
          </div>
          <div className="product-live-preview__body">
            <div className="product-live-preview__title">
              {previewName || t('pages.productAdmin.productTitlePreview')}
            </div>
            {previewBrand ? <Text type="secondary">{previewBrand}</Text> : null}
            <div className="product-live-preview__price">
              <span>{price > 0 ? formatMoney(price) : formatMoney(0)}</span>
              {hasOriginalPrice ? <Text delete type="secondary">{formatMoney(originalPrice)}</Text> : null}
            </div>
            <div className="product-live-preview__meta">
              <Tag color={Number(previewStock || 0) > 0 ? 'green' : 'red'}>
                {Number(previewStock || 0) > 0 ? `${previewStock} ${t('pages.productAdmin.inStockLow')}` : t('pages.productAdmin.outOfStock')}
              </Tag>
              {previewFreeShipping ? <Tag color="green">{t('pages.productAdmin.freeShipping')}</Tag> : null}
              {tagValues.map((tag) => (
                <Tag key={tag} color={tagColorMap[tag] || 'default'}>{tagLabelMap[tag] || tag}</Tag>
              ))}
            </div>
            <Text type="secondary" className="product-live-preview__description">
              {descriptionPreview || t('pages.productAdmin.metaDescriptionPreview')}
            </Text>
          </div>
        </div>
      </section>
    );
  };

  const columns = [
    {
      title: t('common.image'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url: string) => (
        <Image src={url} width={50} height={50} style={{ objectFit: 'cover', borderRadius: 6 }} fallback="https://via.placeholder.com/50" />
      ),
    },
    {
      title: t('pages.productAdmin.productName'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (name: string, record: Product) => (
        <div>
          <b>{name}</b>
          {record.brand && <div><Text type="secondary" style={{ fontSize: 12 }}>{record.brand}</Text></div>}
        </div>
      ),
    },
    {
      title: t('common.category'),
      dataIndex: 'categoryId',
      key: 'categoryId',
      width: 180,
      render: (id: number) => getCategoryPath(flatCategories, id, language) || id,
    },
    {
      title: t('pages.productAdmin.price'),
      key: 'price',
      width: 140,
      render: (_: any, record: Product) => renderPrice(record),
    },
    {
      title: t('pages.productAdmin.stock'),
      dataIndex: 'stock',
      key: 'stock',
      width: 70,
      render: (stock: number) => stock <= 0 ? <Tag color="red">{t('pages.productAdmin.outOfStock')}</Tag> : stock < 10 ? <Tag color="orange">{stock}</Tag> : stock,
    },
    {
      title: t('pages.productAdmin.shipping'),
      key: 'shippingRule',
      width: 150,
      render: (_: any, record: Product) => (
        <Space direction="vertical" size={0}>
          {record.freeShipping ? <Tag color="green">{t('pages.productAdmin.freeShipping')}</Tag> : <Tag>{t('pages.productAdmin.standardShipping')}</Tag>}
          {record.freeShippingThreshold ? <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.productAdmin.freeOver', { amount: formatMoney(record.freeShippingThreshold) })}</Text> : null}
        </Space>
      ),
    },
    {
      title: t('pages.productAdmin.tag'),
      dataIndex: 'tag',
      key: 'tag',
      width: 80,
      render: (tag: string) => tag ? <Tag color={tagColorMap[tag]}>{tagLabelMap[tag] || tag}</Tag> : '-',
    },
    {
      title: t('pages.productAdmin.reviewStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const value = status || 'ACTIVE';
        return <Tag color={productStatusColors[value]}>{productStatusLabels[value] ? t(productStatusLabels[value]) : value}</Tag>;
      },
    },
    {
      title: t('pages.productAdmin.featuredColumn'),
      dataIndex: 'isFeatured',
      key: 'isFeatured',
      width: 80,
      render: (v: boolean) => v ? <Tag color="gold" icon={<StarFilled />}>{t('pages.productAdmin.featuredYes')}</Tag> : <Tag icon={<StarOutlined />}>{t('pages.productAdmin.featuredNo')}</Tag>,
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 280,
      render: (_: any, record: Product) => (
        <Space size="small">
          <Tooltip title={record.isFeatured ? t('pages.productAdmin.unsetFeatured') : t('pages.productAdmin.setFeatured')}>
            <Button
              icon={record.isFeatured ? <StarFilled style={{ color: '#ff9800' }} /> : <StarOutlined />}
              onClick={() => handleToggleFeatured(record)}
              type={record.isFeatured ? 'primary' : 'default'}
              ghost
              size="small"
            />
          </Tooltip>
          <Button type="primary" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">{t('common.edit')}</Button>
          {(record.status || 'ACTIVE') !== 'ACTIVE' && (
            <Button size="small" onClick={() => handleProductStatus(record, 'ACTIVE')}>{t('pages.productAdmin.approve')}</Button>
          )}
          {(record.status || 'ACTIVE') !== 'REJECTED' && (
            <Button size="small" danger onClick={() => handleProductStatus(record, 'REJECTED')}>{t('pages.productAdmin.reject')}</Button>
          )}
          {(record.status || 'ACTIVE') !== 'PENDING_REVIEW' && (
            <Button size="small" onClick={() => handleProductStatus(record, 'PENDING_REVIEW')}>{t('pages.productAdmin.review')}</Button>
          )}
          <Popconfirm title={t('pages.productAdmin.deleteConfirm')} onConfirm={() => handleDelete(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
            <Button danger icon={<DeleteOutlined />} size="small">{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 24px' }}>
      <Title level={3} style={{ marginBottom: 0 }}>{t('pages.productAdmin.title')}</Title>
      <Divider />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <Space>
          <Input
            placeholder={t('pages.productAdmin.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <TreeSelect
            placeholder={t('pages.productAdmin.filterCategory')}
            allowClear
            treeDefaultExpandAll
            style={{ width: 220 }}
            value={filterCategory}
            onChange={v => setFilterCategory(v)}
            treeData={categoryOptions}
          />
          <Select
            placeholder={t('pages.productAdmin.reviewStatus')}
            allowClear
            style={{ width: 160 }}
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'ACTIVE', label: t('pages.productAdmin.approved') },
              { value: 'PENDING_REVIEW', label: t('pages.productAdmin.pending') },
              { value: 'REJECTED', label: t('pages.productAdmin.rejected') },
              { value: 'INACTIVE', label: t('status.INACTIVE') },
            ]}
          />
        </Space>
        <Space wrap>
          <Button disabled={selectedProductIds.length === 0} onClick={() => handleBatchProductStatus('ACTIVE')}>
            {t('pages.productAdmin.batchApprove')}
          </Button>
          <Button disabled={selectedProductIds.length === 0} danger onClick={() => handleBatchProductStatus('REJECTED')}>
            {t('pages.productAdmin.batchReject')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadImportTemplate}>
            {t('pages.productAdmin.downloadTemplate')}
          </Button>
          <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={handleImportProducts}>
            <Button icon={<UploadOutlined />}>{t('pages.productAdmin.importProducts')}</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t('pages.productAdmin.addProduct')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredProducts}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedProductIds,
          onChange: setSelectedProductIds,
        }}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => t('pages.productAdmin.tableTotal', { count: total }) }}
        bordered
        size="middle"
        scroll={{ x: 1100 }}
      />

      <Modal
        title={editingProduct ? t('pages.productAdmin.editTitle') : t('pages.productAdmin.addTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width="min(1280px, 96vw)"
        destroyOnClose
        className="shopify-product-modal"
        okText={editingProduct ? t('pages.productAdmin.saveProduct') : t('pages.productAdmin.addProduct')}
      >
        <Form form={form} layout="vertical" initialValues={{ images: [], specifications: [{}], optionGroups: [{ name: 'Size', values: '' }, { name: 'Color', values: '' }], detailContent: [emptyDetailBlock], freeShipping: false }}>
          <div className="shopify-product-editor">
            <div className="shopify-product-editor__main">
              <section className="shopify-card">
                <Form.Item name="name" label={t('pages.productAdmin.titleField')} rules={[{ required: true, message: t('pages.productAdmin.nameRequired') }]}>
                  <Input className="shopify-input" placeholder="智能自动宠物喂食器｜猫狗通用定时喂食" />
                </Form.Item>

                <Form.Item name="description" label={t('pages.productAdmin.description')} rules={[{ required: true, message: t('pages.productAdmin.descriptionRequired') }]}>
                  <TextArea className="shopify-rich-text" rows={7} placeholder="Describe benefits, materials, use cases and care instructions..." />
                </Form.Item>

                <Divider>{t('pages.productAdmin.languageSettings')}</Divider>
                <Tabs
                  items={[
                    {
                      key: 'es',
                      label: spanishNamePreview || t('pages.productAdmin.spanish'),
                      children: (
                        <div className="shopify-two-col">
                          <Form.Item name={['localizedContent', 'es', 'name']} label={t('pages.productAdmin.spanishTitle')}>
                            <Input className="shopify-input" placeholder={t('pages.productAdmin.fallbackEnglishTitle')} />
                          </Form.Item>
                          <Form.Item name={['localizedContent', 'es', 'brand']} label={t('pages.productAdmin.spanishBrand')}>
                            <Input className="shopify-input" placeholder={t('pages.productAdmin.optionalLocalizedBrand')} />
                          </Form.Item>
                          <Form.Item name={['localizedContent', 'es', 'description']} label={t('pages.productAdmin.spanishDescription')} style={{ gridColumn: '1 / -1' }}>
                            <TextArea rows={4} placeholder={t('pages.productAdmin.fallbackEnglishDescription')} />
                          </Form.Item>
                        </div>
                      ),
                    },
                    {
                      key: 'zh',
                      label: chineseNamePreview || t('pages.productAdmin.chinese'),
                      children: (
                        <div className="shopify-two-col">
                          <Form.Item name={['localizedContent', 'zh', 'name']} label={t('pages.productAdmin.chineseTitle')}>
                            <Input className="shopify-input" placeholder={t('pages.productAdmin.fallbackEnglishTitle')} />
                          </Form.Item>
                          <Form.Item name={['localizedContent', 'zh', 'brand']} label={t('pages.productAdmin.chineseBrand')}>
                            <Input className="shopify-input" placeholder={t('pages.productAdmin.optionalLocalizedBrand')} />
                          </Form.Item>
                          <Form.Item name={['localizedContent', 'zh', 'description']} label={t('pages.productAdmin.chineseDescription')} style={{ gridColumn: '1 / -1' }}>
                            <TextArea rows={4} placeholder={t('pages.productAdmin.fallbackEnglishDescription')} />
                          </Form.Item>
                        </div>
                      ),
                    },
                  ]}
                />

                <div className="shopify-section-title">{t('pages.productAdmin.media')}</div>
                <Form.Item name="imageUrl" label={t('pages.productAdmin.mainImage')} rules={[{ required: true, message: t('pages.productAdmin.mainImageRequired') }]}>
                  <Input
                    className="shopify-input"
                    placeholder={t('pages.productAdmin.mainImageRequired')}
                    onChange={(e) => setImagePreviewUrl(e.target.value)}
                  />
                </Form.Item>
                <div className="shopify-media-grid">
                  <div className="shopify-media-tile">
                    {imagePreviewUrl ? (
                      <Image src={imagePreviewUrl} width="100%" height="100%" style={{ objectFit: 'cover' }} fallback="https://via.placeholder.com/240" />
                    ) : (
                      <span>{t('pages.productAdmin.mediaPreview')}</span>
                    )}
                  </div>
                  <Form.List name="images">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }, index) => (
                          <div className="shopify-media-input" key={key}>
                            <Form.Item {...restField} name={name} style={{ marginBottom: 0 }}>
                              <Input placeholder={t('pages.productAdmin.imageUrl', { index: index + 1 })} />
                            </Form.Item>
                            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                          </div>
                        ))}
                        <button type="button" className="shopify-media-add" onClick={() => add()}>
                          <PlusOutlined /> {t('pages.productAdmin.addMedia')}
                        </button>
                      </>
                    )}
                  </Form.List>
                </div>

                <Form.Item name="categoryId" label={t('common.category')} rules={[{ required: true, message: t('pages.productAdmin.categoryRequired') }]}>
                  <TreeSelect
                    className="shopify-input"
                    placeholder="Automatic Feeders in Pet Bowls, Feeders & Waterers"
                    treeDefaultExpandAll
                    treeData={categoryOptions}
                  />
                </Form.Item>
                <Text type="secondary">{t('pages.productAdmin.categoryHint')}</Text>
              </section>

              <section className="shopify-card shopify-card--split">
                <div className="shopify-card__header">
                  <h3>{t('pages.productAdmin.price')}</h3>
                </div>
                <Form.Item name="price" label={t('pages.productAdmin.salePrice')} rules={[{ required: true, message: t('pages.productAdmin.priceRequired') }]}>
                  <InputNumber className="shopify-money-input" min={0} precision={2} prefix={t('common.currencySymbol')} placeholder="0.00" />
                </Form.Item>
                <div className="shopify-pill-row">
                  <Form.Item name="originalPrice" label={null}>
                    <InputNumber min={0} precision={2} prefix={t('pages.productAdmin.compareAt')} placeholder={t('pages.productAdmin.compareAtPrice')} />
                  </Form.Item>
                  <Form.Item name="discount" label={null}>
                    <InputNumber min={0} max={100} suffix="%" placeholder={t('pages.productAdmin.discount')} />
                  </Form.Item>
                </div>
              </section>

              <section className="shopify-card">
                <div className="shopify-card__header">
                  <h3>{t('pages.productAdmin.inventory')}</h3>
                  <Space><Text type="secondary">{t('pages.productAdmin.inventoryTracked')}</Text><Switch defaultChecked /></Space>
                </div>
                <div className="shopify-inventory-box">
                  <span>{t('pages.productAdmin.shopLocation')}</span>
                  <Form.Item name="stock" rules={[{ required: true, message: t('pages.productAdmin.stockRequired') }]} style={{ marginBottom: 0 }}>
                    <InputNumber min={0} placeholder="0" />
                  </Form.Item>
                </div>
                <div className="shopify-pill-row">
                  <span>{t('pages.productAdmin.sku')}</span>
                  <span>{t('pages.productAdmin.barcode')}</span>
                  <span>{t('pages.productAdmin.sellWhenOut')} <b>{t('pages.productAdmin.off')}</b></span>
                </div>
              </section>

              <section className="shopify-card">
                <div className="shopify-card__header">
                  <h3>{t('pages.productAdmin.shipping')}</h3>
                  <Form.Item name="freeShipping" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren={t('pages.productAdmin.free')} unCheckedChildren={t('pages.productAdmin.standardShipping')} />
                  </Form.Item>
                </div>
                <div className="shopify-two-col">
                  <Form.Item name="shipping" label={t('pages.productAdmin.shipping')}>
                    <Input placeholder="Store default • Sample box • 0 kg" />
                  </Form.Item>
                  <Form.Item name="freeShippingThreshold" label={t('pages.productAdmin.freeShippingThreshold')}>
                    <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder="50.00" />
                  </Form.Item>
                </div>
                <div className="shopify-pill-row">
                  <span>{t('pages.productAdmin.countryOfOrigin')}</span>
                  <span>{t('pages.productAdmin.hsCode')}</span>
                </div>
              </section>

              <section className="shopify-card">
                <div className="shopify-card__header">
                  <h3>{t('pages.productAdmin.variants')}</h3>
                </div>
                <Text type="secondary">{t('pages.productAdmin.variantHint')}</Text>
                <Form.List name="optionGroups">
                  {(fields, { add, remove }) => (
                    <div className="shopify-option-list">
                      {fields.map(({ key, name, ...restField }) => (
                        <div key={key} className="shopify-option-row">
                          <Form.Item {...restField} name={[name, 'name']} style={{ marginBottom: 0 }}>
                            <Input placeholder={t('pages.productAdmin.optionName')} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'values']} style={{ marginBottom: 0 }}>
                            <Input placeholder={t('pages.productAdmin.optionValues')} />
                          </Form.Item>
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                        </div>
                      ))}
                      <button type="button" className="shopify-link-button" onClick={() => add()}>
                        <PlusOutlined /> {t('pages.productAdmin.addOptions')}
                      </button>
                    </div>
                  )}
                </Form.List>
                <Divider>{t('pages.productAdmin.variantCombinations')}</Divider>
                <Button type="dashed" onClick={generateVariantRows} style={{ marginBottom: 12 }}>
                  {t('pages.productAdmin.generateVariants')}
                </Button>
                <Form.List name="variants">
                  {(fields, { add, remove }) => (
                    <div className="shopify-variant-list">
                      {fields.map(({ key, name, ...restField }) => (
                        <div key={key} className="shopify-variant-row">
                          <Form.Item {...restField} name={[name, 'sku']} style={{ marginBottom: 0 }}>
                            <Input placeholder={t('pages.productAdmin.variantSku')} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'optionText']} style={{ marginBottom: 0 }} rules={[{ required: true, message: t('pages.productAdmin.variantOptionsRequired') }]}>
                            <Input placeholder={t('pages.productAdmin.variantOptionText')} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'price']} style={{ marginBottom: 0 }} rules={[{ required: true, message: t('pages.productAdmin.priceRequired') }]}>
                            <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder={t('pages.productAdmin.salePrice')} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'stock']} style={{ marginBottom: 0 }}>
                            <InputNumber min={0} placeholder={t('pages.productAdmin.stock')} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'imageUrl']} style={{ marginBottom: 0 }}>
                            <Input placeholder={t('pages.productAdmin.variantImage')} />
                          </Form.Item>
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                        </div>
                      ))}
                      <button type="button" className="shopify-link-button" onClick={() => add({ price: form.getFieldValue('price') || 0, stock: form.getFieldValue('stock') || 0 })}>
                        <PlusOutlined /> {t('pages.productAdmin.addVariant')}
                      </button>
                    </div>
                  )}
                </Form.List>
              </section>

              <section className="shopify-card">
                <div className="shopify-card__header">
                  <h3>{t('pages.productAdmin.categoryMetafields')}</h3>
                  <span className="shopify-chip">Automatic Feeders in Pet Bowls, Feeders & Waterers</span>
                </div>
                <Form.Item label={t('pages.productAdmin.specs')}>
                  <Form.List name="specifications">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <div key={key} className="shopify-metafield-row">
                            <Form.Item {...restField} name={[name, 'key']} style={{ marginBottom: 0 }}>
                              <Input placeholder={t('pages.productAdmin.specKey')} />
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'value']} style={{ marginBottom: 0 }}>
                              <Input placeholder={t('pages.productAdmin.specValue')} />
                            </Form.Item>
                            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                          </div>
                        ))}
                        <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                          {t('pages.productAdmin.addMetafield')}
                        </Button>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              </section>

              <section className="shopify-card">
                <div className="shopify-card__header">
                  <h3>{t('pages.productAdmin.searchEngineListing')}</h3>
                </div>
                <div className="shopify-seo-preview">
                  <Text>{t('pages.productAdmin.myStore')}</Text>
                  <Text type="secondary">https://shopmx.example.com › products ›</Text>
                  <h4>{descriptionPreview ? form.getFieldValue('name') : t('pages.productAdmin.productTitlePreview')}</h4>
                  <p>{descriptionPreview || t('pages.productAdmin.metaDescriptionPreview')}</p>
                  <Text type="secondary">{formatMoney(form.getFieldValue('price'))}</Text>
                </div>
                <Form.Item name="warranty" label={t('pages.productAdmin.warranty')}>
                  <Input className="shopify-input" placeholder={t('pages.productAdmin.warrantyPlaceholder')} />
                </Form.Item>
                <Divider>{t('pages.productAdmin.richContent')}</Divider>
                <Form.Item name="detailContent" noStyle>
                  <ProductRichDetailEditor />
                </Form.Item>
                <Divider>{t('pages.productAdmin.richPreview')}</Divider>
                <div className="shopify-rich-preview">
                  <ProductRichDetail detailContent={detailContentPreview} fallback={descriptionPreview} emptyText={t('pages.productAdmin.richPreviewEmpty')} />
                </div>
              </section>
            </div>

            <aside className="shopify-product-editor__side">
              {renderProductPreview()}

              <section className="shopify-card">
                <h3>{t('common.status')}</h3>
                <Form.Item name="status" style={{ marginBottom: 0 }}>
                  <Select
                    className="shopify-input"
                    options={[
                      { value: 'ACTIVE', label: t('status.ACTIVE') },
                      { value: 'PENDING_REVIEW', label: t('pages.productAdmin.draft') },
                      { value: 'REJECTED', label: t('pages.productAdmin.archived') },
                      { value: 'INACTIVE', label: t('status.INACTIVE') },
                    ]}
                  />
                </Form.Item>
              </section>

              <section className="shopify-card">
                <h3>{t('pages.productAdmin.publishing')}</h3>
                <div className="shopify-channel-list">
                  <span>{t('pages.productAdmin.onlineStore')}</span>
                  <span>Shop</span>
                  <span>{t('pages.productAdmin.pointOfSale')}</span>
                </div>
              </section>

              <section className="shopify-card">
                <h3>{t('pages.productAdmin.productOrganization')}</h3>
                <Form.Item name="brand" label={t('pages.productAdmin.vendor')}>
                  <Select
                    showSearch
                    allowClear
                    className="shopify-input"
                    placeholder={t('pages.productAdmin.brandPlaceholder')}
                    optionFilterProp="label"
                    options={brands.map((brand) => ({ value: brand.name, label: brand.name }))}
                  />
                </Form.Item>
                <Form.Item name="tag" label={t('pages.productAdmin.tags')}>
                  <Select
                    mode="tags"
                    className="shopify-input"
                    placeholder={t('pages.productAdmin.selectTag')}
                    options={tagOptions.map(option => ({ value: option.value, label: option.label }))}
                  />
                </Form.Item>
                <Form.Item name="isFeatured" label={t('pages.productAdmin.bestSeller')} valuePropName="checked">
                  <Switch checkedChildren={t('pages.productAdmin.on')} unCheckedChildren={t('pages.productAdmin.off')} />
                </Form.Item>
              </section>

              <section className="shopify-card">
                <h3>{t('pages.productAdmin.themeTemplate')}</h3>
                <Select className="shopify-input" value="default-product" options={[{ value: 'default-product', label: t('pages.productAdmin.defaultProduct') }]} />
              </section>

              <section className="shopify-card shopify-card--muted">
                <h3>{t('pages.productAdmin.limitedTimeDiscount')}</h3>
                <Form.Item name="limitedTimePrice" label={t('pages.productAdmin.limitedTimePrice')}>
                  <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder={t('pages.productAdmin.limitedTimePricePlaceholder')} />
                </Form.Item>
                <Form.Item name="limitedTimeRange" label={t('pages.productAdmin.limitedTimeRange')}>
                  <DatePicker.RangePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </section>
            </aside>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductManagement;
