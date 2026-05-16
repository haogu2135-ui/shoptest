import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, message, Space, Select, Tag, Switch, DatePicker,
  Tooltip, Typography, Divider, Image, Popconfirm, TreeSelect, Upload, Tabs,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled,
  SearchOutlined, MinusCircleOutlined, UploadOutlined, DownloadOutlined, CopyOutlined, SyncOutlined,
} from '@ant-design/icons';
import { apiBaseUrl, productApi, categoryApi, adminApi, brandApi } from '../api';
import type { Product, Category, Brand } from '../types';
import { buildCategoryTree, descendantIdSet, flattenCategoryTree, getCategoryPath, toTreeOptions } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import dayjs from 'dayjs';
import ProductRichDetailEditor from '../components/ProductRichDetailEditor';
import ProductRichDetail, { isHttpMediaUrl } from '../components/ProductRichDetail';
import { useMarket } from '../hooks/useMarket';
import './ProductManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const productAdminImageFallback = 'https://via.placeholder.com/80?text=IMG';

const resolveProductAdminImage = (imageUrl?: string) => {
  if (!imageUrl) return productAdminImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

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

const bundleItemsToFormRows = (value?: string) => {
  if (!value) return [{ name: '', quantity: 1 }];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const rows = parsed
        .map((item) => ({
          name: String(item?.name || '').trim(),
          quantity: Number(item?.quantity || 1),
        }))
        .filter((item) => item.name);
      return rows.length > 0 ? rows : [{ name: '', quantity: 1 }];
    }
  } catch {
    // Fall through to plain text parsing.
  }
  const rows = value
    .split(/[+,，、]/)
    .map((name) => ({ name: name.trim(), quantity: 1 }))
    .filter((item) => item.name);
  return rows.length > 0 ? rows : [{ name: '', quantity: 1 }];
};

const normalizeVariantOptionText = (value?: string) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseVariantOptions = (variant: any) => {
  if (variant?.options && typeof variant.options === 'object' && !Array.isArray(variant.options)) {
    return Object.entries(variant.options).reduce((result: Record<string, string>, [key, value]) => {
      const normalizedKey = String(key || '').trim();
      const normalizedValue = String(value || '').trim();
      if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
      return result;
    }, {});
  }

  return String(variant?.optionText || '')
    .split(',')
    .reduce((result: Record<string, string>, item) => {
      const [rawKey, ...rawValue] = item.split('=');
      const key = String(rawKey || '').trim();
      const value = rawValue.join('=').trim();
      if (key && value) result[key] = value;
      return result;
    }, {});
};

const formatVariantOptionText = (variant: any) =>
  Object.entries(parseVariantOptions(variant)).map(([key, value]) => `${key}=${value}`).join(', ');

const createSkuFromOptions = (options: Record<string, string>, index: number) => {
  const suffix = Object.values(options)
    .map((value) => String(value || '').trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())
    .filter(Boolean)
    .join('-');
  return suffix ? `SKU-${suffix}` : `SKU-${index + 1}`;
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

type ListingQualityIssue = 'image' | 'content' | 'stock' | 'localized' | 'commercialHook';
type ListingQualityFilter = ListingQualityIssue | 'ready';

const hasMeaningfulText = (value: unknown, minLength = 12) =>
  typeof value === 'string' && value.trim().length >= minLength;

const hasProductImage = (product: Product) => {
  const gallery = parseJsonArray(product.images);
  return Boolean(product.imageUrl || gallery.some((image) => typeof image === 'string' && image.trim()));
};

const hasRichProductContent = (product: Product) => {
  const detailBlocks = parseJsonArray(product.detailContent);
  const hasDetailBlock = detailBlocks.some((block: any) =>
    hasMeaningfulText(block?.content, 24) || hasMeaningfulText(block?.url, 8)
  );
  return hasMeaningfulText(product.description, 36) || hasDetailBlock;
};

const hasLocalizedContent = (product: Product) => {
  const specs = parseJsonObject(product.specifications);
  return ['es', 'zh'].every((locale) =>
    hasMeaningfulText(specs[`i18n.${locale}.name`], 4) && hasMeaningfulText(specs[`i18n.${locale}.description`], 16)
  );
};

const hasCommercialHook = (product: Product) => {
  const price = Number(product.effectivePrice ?? product.price ?? 0);
  const originalPrice = Number(product.originalPrice ?? 0);
  return Boolean(
    product.isFeatured ||
    product.freeShipping ||
    product.tag ||
    product.activeLimitedTimeDiscount ||
    Number(product.discount || product.effectiveDiscountPercent || 0) > 0 ||
    (originalPrice > price && price > 0)
  );
};

const getListingQualityIssues = (product: Product): ListingQualityIssue[] => {
  const issues: ListingQualityIssue[] = [];
  if (!hasProductImage(product)) issues.push('image');
  if (!hasRichProductContent(product)) issues.push('content');
  if (Number(product.stock || 0) <= 0 || Number(product.stock || 0) < 10) issues.push('stock');
  if (!hasLocalizedContent(product)) issues.push('localized');
  if (!hasCommercialHook(product)) issues.push('commercialHook');
  return issues;
};

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [batchStatusUpdating, setBatchStatusUpdating] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [listingQualityFilter, setListingQualityFilter] = useState<ListingQualityFilter | undefined>();
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
  const previewVariants = Form.useWatch('variants', form);
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
  const variantSummary = useMemo(() => {
    const rows = Array.isArray(previewVariants) ? previewVariants : [];
    const validRows = rows.filter((row: any) => String(row?.optionText || '').trim());
    const totalStock = validRows.reduce((sum: number, row: any) => sum + toSafeNumber(row?.stock), 0);
    const prices = validRows
      .map((row: any) => toSafeNumber(row?.price))
      .filter((price: number) => price > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    return { count: validRows.length, totalStock, minPrice, maxPrice };
  }, [previewVariants]);

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

  const baseFilteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchKeyword = !searchKeyword || p.name.toLowerCase().includes(searchKeyword.toLowerCase());
      const matchCategory = !selectedCategoryIds || selectedCategoryIds.has(p.categoryId);
      const matchStatus = !filterStatus || (p.status || 'ACTIVE') === filterStatus;
      return matchKeyword && matchCategory && matchStatus;
    });
  }, [products, searchKeyword, selectedCategoryIds, filterStatus]);

  const listingQualityStats = useMemo(() => {
    const initial = {
      total: baseFilteredProducts.length,
      ready: 0,
      image: 0,
      content: 0,
      stock: 0,
      localized: 0,
      commercialHook: 0,
      active: 0,
      featured: 0,
    };
    return baseFilteredProducts.reduce((stats, product) => {
      const issues = getListingQualityIssues(product);
      if (issues.length === 0) stats.ready += 1;
      issues.forEach((issue) => {
        stats[issue] += 1;
      });
      if ((product.status || 'ACTIVE') === 'ACTIVE') stats.active += 1;
      if (product.isFeatured) stats.featured += 1;
      return stats;
    }, initial);
  }, [baseFilteredProducts]);

  const filteredProducts = useMemo(() => {
    if (!listingQualityFilter) return baseFilteredProducts;
    return baseFilteredProducts.filter((product) => {
      const issues = getListingQualityIssues(product);
      return listingQualityFilter === 'ready' ? issues.length === 0 : issues.includes(listingQualityFilter);
    });
  }, [baseFilteredProducts, listingQualityFilter]);

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue({
      images: [],
      specifications: [{}],
      optionGroups: [{ name: 'Size', values: '' }, { name: 'Color', values: '' }],
      variants: [],
      detailContent: [emptyDetailBlock],
      bundleEnabled: false,
      bundleItems: [{ name: '', quantity: 1 }],
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
    const bundleEnabled = specsObj['bundle.enabled'] === 'true';
    const bundleTitle = specsObj['bundle.title'];
    const bundlePrice = specsObj['bundle.price'] ? Number(specsObj['bundle.price']) : undefined;
    const bundleItems = bundleItemsToFormRows(specsObj['bundle.items']);
    Object.keys(specsObj).forEach((key) => {
      if (key.startsWith('bundle.')) delete specsObj[key];
    });
    const detailContent = parseJsonArray(record.detailContent);
    const variants = parseJsonArray(record.variants).map((variant: any) => ({
      sku: variant.sku,
      optionText: formatVariantOptionText(variant),
      price: variant.price,
      stock: variant.stock,
      imageUrl: variant.imageUrl,
    })).filter((variant: any) => variant.optionText);
    const specs = Object.keys(specsObj).length > 0
      ? Object.entries(specsObj).map(([key, value]) => ({ key, value }))
      : [{}];
    form.setFieldsValue({
      ...record,
      images,
      specifications: specs,
      optionGroups: optionRows.length > 0 ? optionRows : [{ name: 'Size', values: '' }, { name: 'Color', values: '' }],
      variants,
      bundleEnabled,
      bundleTitle,
      bundlePrice,
      bundleItems,
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
      setBatchStatusUpdating(status);
      const ids = selectedProductIds.map((id) => Number(id));
      const res = await adminApi.batchUpdateProductStatus(ids, status);
      message.success(t('pages.productAdmin.batchUpdateResult', res.data));
      setSelectedProductIds([]);
      fetchProducts();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('messages.operationFailed'));
    } finally {
      setBatchStatusUpdating(null);
    }
  };

  const handleDuplicate = (record: Product) => {
    handleEdit(record);
    setEditingProduct(null);
    form.setFieldsValue({
      name: `${record.name} ${t('pages.productAdmin.copySuffix')}`,
      status: 'PENDING_REVIEW',
      isFeatured: false,
    });
    message.success(t('pages.productAdmin.duplicatedDraft'));
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
    const existingRows = new Map(
      (form.getFieldValue('variants') || [])
        .map((row: any) => [normalizeVariantOptionText(row?.optionText), row])
        .filter(([optionText]: any) => optionText)
    );
    form.setFieldValue('variants', combinations.map((options, index) => {
      const optionText = Object.entries(options).map(([key, value]) => `${key}=${value}`).join(', ');
      const existing = existingRows.get(normalizeVariantOptionText(optionText)) as any;
      return {
        sku: existing?.sku || createSkuFromOptions(options, index),
        optionText,
        price: existing?.price ?? form.getFieldValue('price') ?? 0,
        stock: existing?.stock ?? form.getFieldValue('stock') ?? 0,
        imageUrl: existing?.imageUrl,
      };
    }));
  };

  const syncStockFromVariants = () => {
    const rows = (form.getFieldValue('variants') || []).filter((row: any) => String(row?.optionText || '').trim());
    const totalStock = rows.reduce((sum: number, row: any) => sum + toSafeNumber(row?.stock), 0);
    form.setFieldValue('stock', totalStock);
    message.success(t('pages.productAdmin.stockSyncedFromVariants', { count: rows.length, stock: totalStock }));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setProductSubmitting(true);
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
        .filter((block: any) => block.type === 'text' ? !!block.content : !!block.url && isHttpMediaUrl(block.url));
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
      if (values.bundleEnabled) {
        const bundleItems = (values.bundleItems || [])
          .map((item: any) => ({
            name: String(item?.name || '').trim(),
            quantity: Number(item?.quantity || 1),
          }))
          .filter((item: any) => item.name && item.quantity > 0);
        if (bundleItems.length > 0 && Number(values.bundlePrice || 0) > 0) {
          specs['bundle.enabled'] = 'true';
          specs['bundle.title'] = String(values.bundleTitle || values.name || '').trim();
          specs['bundle.price'] = String(Number(values.bundlePrice).toFixed(2));
          specs['bundle.items'] = JSON.stringify(bundleItems);
        }
      }
      const variants = (values.variants || [])
        .map((variant: any) => {
          const optionText = String(variant?.optionText || '').trim();
          const options = parseVariantOptions({ optionText });
          const price = toSafeNumber(variant?.price);
          const stock = toSafeNumber(variant?.stock, NaN);
          return {
            sku: variant?.sku?.trim(),
            options,
            price,
            stock: Number.isFinite(stock) ? stock : undefined,
            imageUrl: variant?.imageUrl?.trim(),
          };
        })
        .filter((variant: any) => Object.keys(variant.options).length > 0 && Number.isFinite(variant.price) && variant.price > 0);
      const variantStockTotal = variants.reduce((sum: number, variant: any) => sum + toSafeNumber(variant.stock), 0);
      const {
        specifications: _specs,
        images: _images,
        detailContent: _detailContent,
        localizedContent: _localizedContent,
        optionGroups: _optionGroups,
        variants: _variants,
        bundleEnabled: _bundleEnabled,
        bundleTitle: _bundleTitle,
        bundlePrice: _bundlePrice,
        bundleItems: _bundleItems,
        limitedTimeRange,
        ...rest
      } = values;
      const payload: any = {
        ...rest,
        stock: variants.length > 0 ? variantStockTotal : rest.stock,
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
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(t('messages.operationFailed'));
    } finally {
      setProductSubmitting(false);
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

  const exportFilteredProducts = () => {
    if (filteredProducts.length === 0) {
      message.warning(t('pages.productAdmin.exportEmpty'));
      return;
    }
    const headers = [
      'id', 'name', 'description', 'price', 'stock', 'categoryId', 'categoryName', 'imageUrl',
      'isFeatured', 'brand', 'originalPrice', 'discount', 'tag', 'status', 'freeShipping',
      'freeShippingThreshold', 'variantCount', 'variantStock', 'createdAt',
    ];
    const rows = filteredProducts.map((product: any) => {
      const variants = parseJsonArray(product.variants);
      const variantStock = variants.reduce((sum: number, variant: any) => sum + toSafeNumber(variant?.stock), 0);
      return [
        product.id,
        product.name,
        product.description,
        product.price,
        product.stock,
        product.categoryId,
        product.categoryName,
        product.imageUrl,
        product.isFeatured ? 'true' : 'false',
        product.brand,
        product.originalPrice,
        product.discount,
        product.tag,
        product.status || 'ACTIVE',
        product.freeShipping ? 'true' : 'false',
        product.freeShippingThreshold,
        variants.length,
        variantStock,
        product.createdAt,
      ];
    });
    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\r\n');
    const blob = new Blob(['\uFEFF', `${csv}\r\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('pages.productAdmin.exportSuccess', { count: filteredProducts.length }));
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
              <img src={resolveProductAdminImage(image)} alt={previewName || t('pages.productAdmin.productTitlePreview')} />
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
        <Image src={resolveProductAdminImage(url)} width={50} height={50} style={{ objectFit: 'cover', borderRadius: 6 }} fallback={productAdminImageFallback} />
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
      title: t('pages.productAdmin.listingQualityColumn'),
      key: 'listingQuality',
      width: 180,
      render: (_: any, record: Product) => {
        const issues = getListingQualityIssues(record);
        if (issues.length === 0) {
          return <Tag color="green">{t('pages.productAdmin.listingReady')}</Tag>;
        }
        return (
          <Space size={[0, 4]} wrap>
            {issues.slice(0, 2).map((issue) => (
              <Tag key={issue} color="orange">{t(`pages.productAdmin.listingIssue.${issue}`)}</Tag>
            ))}
            {issues.length > 2 ? <Tag>{t('pages.productAdmin.moreIssues', { count: issues.length - 2 })}</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 340,
      render: (_: any, record: Product) => (
        <Space size="small" wrap className="product-action-space">
          <Tooltip title={record.isFeatured ? t('pages.productAdmin.unsetFeatured') : t('pages.productAdmin.setFeatured')}>
            <Button
              className={record.isFeatured ? 'product-feature-button product-feature-button--active' : 'product-feature-button'}
              icon={record.isFeatured ? <StarFilled /> : <StarOutlined />}
              onClick={() => handleToggleFeatured(record)}
              size="small"
            />
          </Tooltip>
          <Button type="primary" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small">{t('common.edit')}</Button>
          <Tooltip title={t('pages.productAdmin.duplicateProduct')}>
            <Button icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} size="small" />
          </Tooltip>
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
    <div className="product-management-page">
      <Title level={3} style={{ marginBottom: 0 }}>{t('pages.productAdmin.title')}</Title>
      <Divider />

      <div className="product-management-page__toolbar">
        <Space className="product-management-page__filters">
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
          <Button disabled={selectedProductIds.length === 0 || !!batchStatusUpdating} loading={batchStatusUpdating === 'ACTIVE'} onClick={() => handleBatchProductStatus('ACTIVE')}>
            {t('pages.productAdmin.batchApprove')}
          </Button>
          <Button disabled={selectedProductIds.length === 0 || !!batchStatusUpdating} loading={batchStatusUpdating === 'REJECTED'} danger onClick={() => handleBatchProductStatus('REJECTED')}>
            {t('pages.productAdmin.batchReject')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadImportTemplate}>
            {t('pages.productAdmin.downloadTemplate')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportFilteredProducts}>
            {t('pages.productAdmin.exportProducts')}
          </Button>
          <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={handleImportProducts}>
            <Button icon={<UploadOutlined />}>{t('pages.productAdmin.importProducts')}</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t('pages.productAdmin.addProduct')}
          </Button>
        </Space>
      </div>

      <section className="product-listing-quality" aria-label={t('pages.productAdmin.listingQualityTitle')}>
        <div className="product-listing-quality__summary">
          <div>
            <Text type="secondary">{t('pages.productAdmin.listingQualityEyebrow')}</Text>
            <h3>{t('pages.productAdmin.listingQualityTitle')}</h3>
            <p>{t('pages.productAdmin.listingQualitySubtitle')}</p>
          </div>
          <div className="product-listing-quality__score">
            <strong>{listingQualityStats.ready}/{listingQualityStats.total || 0}</strong>
            <span>{t('pages.productAdmin.readyToSell')}</span>
          </div>
        </div>
        <div className="product-listing-quality__metrics">
          <button
            type="button"
            className={!listingQualityFilter ? 'is-active' : ''}
            onClick={() => setListingQualityFilter(undefined)}
          >
            <span>{listingQualityStats.total}</span>
            {t('pages.productAdmin.allListings')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'ready' ? 'is-active' : ''}
            onClick={() => setListingQualityFilter('ready')}
          >
            <span>{listingQualityStats.ready}</span>
            {t('pages.productAdmin.listingReady')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'image' ? 'is-active' : ''}
            onClick={() => setListingQualityFilter('image')}
          >
            <span>{listingQualityStats.image}</span>
            {t('pages.productAdmin.missingImages')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'content' ? 'is-active' : ''}
            onClick={() => setListingQualityFilter('content')}
          >
            <span>{listingQualityStats.content}</span>
            {t('pages.productAdmin.weakContent')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'stock' ? 'is-active' : ''}
            onClick={() => setListingQualityFilter('stock')}
          >
            <span>{listingQualityStats.stock}</span>
            {t('pages.productAdmin.stockRisk')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'localized' ? 'is-active' : ''}
            onClick={() => setListingQualityFilter('localized')}
          >
            <span>{listingQualityStats.localized}</span>
            {t('pages.productAdmin.localizationGaps')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'commercialHook' ? 'is-active' : ''}
            onClick={() => setListingQualityFilter('commercialHook')}
          >
            <span>{listingQualityStats.commercialHook}</span>
            {t('pages.productAdmin.missingCommercialHook')}
          </button>
        </div>
        <div className="product-listing-quality__footer">
          <span>{t('pages.productAdmin.activeListings', { count: listingQualityStats.active })}</span>
          <span>{t('pages.productAdmin.featuredListings', { count: listingQualityStats.featured })}</span>
          {listingQualityFilter ? (
            <Button size="small" onClick={() => setListingQualityFilter(undefined)}>
              {t('pages.productAdmin.clearQualityFilter')}
            </Button>
          ) : null}
        </div>
      </section>

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
        scroll={{ x: 1240 }}
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
        confirmLoading={productSubmitting}
      >
        <Form form={form} layout="vertical" initialValues={{ images: [], specifications: [{}], optionGroups: [{ name: 'Size', values: '' }, { name: 'Color', values: '' }], detailContent: [emptyDetailBlock], bundleEnabled: false, bundleItems: [{ name: '', quantity: 1 }], freeShipping: false }}>
          <div className="shopify-product-editor">
            <div className="shopify-product-editor__main">
              <section className="shopify-card">
                <Form.Item name="name" label={t('pages.productAdmin.titleField')} rules={[{ required: true, message: t('pages.productAdmin.nameRequired') }]}>
                  <Input className="shopify-input" placeholder={t('pages.productAdmin.sampleNamePlaceholder')} />
                </Form.Item>

                <Form.Item name="description" label={t('pages.productAdmin.description')} rules={[{ required: true, message: t('pages.productAdmin.descriptionRequired') }]}>
                  <TextArea className="shopify-rich-text" rows={7} placeholder={t('pages.productAdmin.descriptionRichPlaceholder')} />
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
                    placeholder={t('pages.productAdmin.categoryPlaceholder')}
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
                  <h3>{t('bundle.bundleDeal')}</h3>
                  <Form.Item name="bundleEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren={t('pages.productAdmin.on')} unCheckedChildren={t('pages.productAdmin.off')} />
                  </Form.Item>
                </div>
                <div className="shopify-two-col">
                  <Form.Item name="bundleTitle" label={t('bundle.bundleTitle')}>
                    <Input placeholder={t('pages.productAdmin.bundleTitlePlaceholder')} />
                  </Form.Item>
                  <Form.Item name="bundlePrice" label={t('bundle.bundlePrice')}>
                    <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder="0.00" />
                  </Form.Item>
                </div>
                <Form.List name="bundleItems">
                  {(fields, { add, remove }) => (
                    <div className="shopify-option-list">
                      {fields.map(({ key, name, ...restField }) => (
                        <div key={key} className="shopify-option-row">
                          <Form.Item {...restField} name={[name, 'name']} style={{ marginBottom: 0 }}>
                            <Input placeholder={t('bundle.bundleItemName')} />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'quantity']} style={{ marginBottom: 0 }}>
                            <InputNumber min={1} placeholder={t('common.quantity')} />
                          </Form.Item>
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                        </div>
                      ))}
                      <button type="button" className="shopify-link-button" onClick={() => add({ quantity: 1 })}>
                        <PlusOutlined /> {t('bundle.addBundleItem')}
                      </button>
                    </div>
                  )}
                </Form.List>
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
                    <Input placeholder={t('pages.productAdmin.shippingRulePlaceholder')} />
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
                <div className="shopify-variant-summary">
                  <span>{t('pages.productAdmin.variants')}: <b>{variantSummary.count}</b></span>
                  <span>{t('pages.productAdmin.stock')}: <b>{variantSummary.totalStock}</b></span>
                  <span>{t('pages.productAdmin.price')}: <b>{variantSummary.minPrice && variantSummary.maxPrice ? `${formatMoney(variantSummary.minPrice)} - ${formatMoney(variantSummary.maxPrice)}` : formatMoney(0)}</b></span>
                </div>
                <div className="shopify-variant-actions">
                  <Button icon={<SyncOutlined />} onClick={syncStockFromVariants} disabled={variantSummary.count === 0}>
                    {t('pages.productAdmin.syncStockFromVariants')}
                  </Button>
                  <Text type="secondary">{t('pages.productAdmin.variantStockAutoSync')}</Text>
                </div>
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
                  <span className="shopify-chip">{t('pages.productAdmin.categoryMetafieldPreset')}</span>
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
                  <Text type="secondary">{t('pages.productAdmin.seoUrlPath')}</Text>
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
