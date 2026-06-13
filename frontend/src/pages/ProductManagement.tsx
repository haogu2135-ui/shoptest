import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, message, Space, Select, Tag, Switch, DatePicker,
  Tooltip, Typography, Divider, Image, Popconfirm, TreeSelect, Upload, Tabs, Alert, Card,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled,
  SearchOutlined, MinusCircleOutlined, UploadOutlined, DownloadOutlined, CopyOutlined, SyncOutlined, LinkOutlined,
} from '@ant-design/icons';
import { adminApi } from '../api';
import type {
  Product,
  CategoryPublic,
  Brand,
  ProductImportResult,
  ProductImportHistoryEntry,
  ProductUrlImportPreview,
  ProductDetailBlock,
  ProductMutationPayload,
  ProductVariant,
  ProductImportRowError,
} from '../types';
import { buildCategoryTree, flattenCategoryTree, getCategoryPath, toTreeOptions } from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import dayjs, { type Dayjs } from 'dayjs';
import ProductRichDetailEditor from '../components/ProductRichDetailEditor';
import ProductRichDetail, { isHttpMediaUrl } from '../components/ProductRichDetail';
import { useMarket } from '../hooks/useMarket';
import { useDebounce } from '../hooks/useDebounce';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { csvRow } from '../utils/csvExport';
import { getApiErrorMessage } from '../utils/apiError';
import { labelTableSelectionCheckbox } from '../utils/tableSelectionAccessibility';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import {
  PRODUCTS_DELETE_PERMISSION,
  PRODUCTS_IMPORT_PERMISSION,
  PRODUCTS_STATUS_PERMISSION,
  PRODUCTS_WRITE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import './ProductManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const productAdminImageFallback = productImageFallback;
const resolveProductAdminImage = resolveProductImage;
const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };
const productEditorPopupClassNames = { popup: { root: 'shop-mobile-popup-layer product-management-page__editorPopup' } };
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };
const productAdminTableCell = (label: string): React.TdHTMLAttributes<HTMLElement> & Record<'data-label', string> => ({
  'data-label': label,
});

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
const DEFAULT_ADMIN_PRODUCT_PAGE_SIZE = 50;
const PRODUCT_SEARCH_DEBOUNCE_MS = 300;
const ADMIN_PRODUCT_DEFAULT_SORT = 'updatedAt,desc';
const PRODUCT_NAME_MAX_LENGTH = 200;
const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;

const productDisplayLabel = (product: Pick<Product, 'id' | 'name'>) => (
  String(product.name || '').trim() || `#${product.id}`
);

type ProductDetailContentBlock = ProductDetailBlock;

const emptyDetailBlock: ProductDetailContentBlock = { type: 'text', content: '', url: '', caption: '' };

type ProductSpecificationFormRow = {
  key?: unknown;
  value?: unknown;
};

type ProductOptionGroupFormRow = {
  name?: unknown;
  values?: unknown;
};

type ProductVariantFormRow = {
  sku?: string;
  optionText?: string;
  price?: number;
  stock?: number;
  imageUrl?: string;
};

type ProductBundleItemFormRow = {
  name?: unknown;
  quantity?: unknown;
};

type ProductFormValues = Partial<Omit<
  Product,
  'images' | 'specifications' | 'detailContent' | 'localizedContent' | 'optionGroups' | 'variants' | 'bundle' | 'limitedTimeStartAt' | 'limitedTimeEndAt'
>> & {
  images?: unknown[];
  specifications?: ProductSpecificationFormRow[];
  detailContent?: ProductDetailContentBlock[];
  localizedContent?: Record<string, Record<string, unknown> | undefined>;
  optionGroups?: ProductOptionGroupFormRow[];
  variants?: ProductVariantFormRow[];
  bundleEnabled?: boolean;
  bundleTitle?: unknown;
  bundlePrice?: unknown;
  bundleItems?: ProductBundleItemFormRow[];
  limitedTimeRange?: [Dayjs | null | undefined, Dayjs | null | undefined];
};

type ProductVariantSource = Partial<ProductVariant> & {
  optionText?: unknown;
};

type ProductImportResultPayload = Partial<ProductImportResult> & Record<string, unknown>;

type FormValidationError = {
  errorFields?: unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isFormValidationError = (error: unknown): error is FormValidationError => (
  isRecord(error) && Array.isArray(error.errorFields)
);

const getErrorResponseData = (error: unknown): unknown => {
  if (!isRecord(error) || !isRecord(error.response)) return undefined;
  return error.response.data;
};

const stringListFromUnknown = (value: unknown) => (
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

const productImportRowErrorsFromUnknown = (value: unknown): ProductImportRowError[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ProductImportRowError[] => {
    if (!isRecord(item)) return [];
    const messageText = String(item.message || '').trim();
    if (!messageText) return [];
    const rowNumber = Number(item.rowNumber || 0);
    const fieldText = typeof item.field === 'string' && item.field.trim() ? item.field.trim() : undefined;
    return [{
      rowNumber: Number.isFinite(rowNumber) ? rowNumber : 0,
      field: fieldText,
      message: messageText,
    }];
  });
};

const parseJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    reportNonBlockingError('ProductManagement.parseJsonArray', error);
    return [];
  }
};

const normalizeProductImageList = (...values: unknown[]) => {
  const flattened = values.flatMap((value) => {
    if (Array.isArray(value)) return value;
    const parsedArray = parseJsonArray(value);
    return parsedArray.length > 0 ? parsedArray : [value];
  });
  return Array.from(new Set(
    flattened
      .map((image) => String(image || '').trim())
      .filter((image) => image && isHttpMediaUrl(image))
  )).slice(0, 12);
};

const parseJsonObject = (value: unknown) => {
  if (isRecord(value)) return value as Record<string, string>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed as Record<string, string> : {};
  } catch (error) {
    reportNonBlockingError('ProductManagement.parseJsonObject', error);
    return {};
  }
};

const getProductAdminSpecs = (product: Product) => {
  const specs = { ...parseJsonObject(product.specifications) };
  const localizedContent = product.localizedContent && typeof product.localizedContent === 'object'
    ? product.localizedContent as Record<string, Record<string, unknown> | undefined>
    : {};
  Object.entries(localizedContent).forEach(([locale, fields]) => {
    if (!fields || typeof fields !== 'object') return;
    Object.entries(fields).forEach(([field, value]) => {
      const text = String(value || '').trim();
      if (locale && field && text) specs[`i18n.${locale}.${field}`] = text;
    });
  });
  (Array.isArray(product.optionGroups) ? product.optionGroups : []).forEach((group) => {
    const name = String(group?.name || '').trim();
    const values = Array.isArray(group?.values) ? group.values : (Array.isArray(group?.options) ? group.options : []);
    const normalizedValues = Array.from(new Set(values.map((value: unknown) => String(value || '').trim()).filter(Boolean)));
    if (name && normalizedValues.length > 0) specs[`options.${name}`] = normalizedValues.join(',');
  });
  const bundle = product.bundle && typeof product.bundle === 'object' ? product.bundle : null;
  if (bundle?.enabled) {
    specs['bundle.enabled'] = 'true';
    if (bundle.title) specs['bundle.title'] = String(bundle.title);
    if (bundle.price) specs['bundle.price'] = String(bundle.price);
    if (Array.isArray(bundle.items) && bundle.items.length > 0) specs['bundle.items'] = JSON.stringify(bundle.items);
  }
  return specs;
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
  } catch (error) {
    reportNonBlockingError('ProductManagement.parseBundleItems', error);
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

const optionalString = (value: unknown) => {
  const text = String(value || '').trim();
  return text || undefined;
};

const parseVariantOptions = (variant: ProductVariantSource | ProductVariantFormRow | unknown): Record<string, string> => {
  const source = isRecord(variant) ? variant : {};
  if (isRecord(source.options)) {
    return Object.entries(source.options).reduce((result: Record<string, string>, [key, value]) => {
      const normalizedKey = String(key || '').trim();
      const normalizedValue = String(value || '').trim();
      if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
      return result;
    }, {});
  }

  return String(source.optionText || '')
    .split(',')
    .reduce((result: Record<string, string>, item) => {
      const [rawKey, ...rawValue] = item.split('=');
      const key = String(rawKey || '').trim();
      const value = rawValue.join('=').trim();
      if (key && value) result[key] = value;
      return result;
    }, {});
};

const formatVariantOptionText = (variant: ProductVariantSource | ProductVariantFormRow | unknown) =>
  Object.entries(parseVariantOptions(variant)).map(([key, value]) => `${key}=${value}`).join(', ');

const productDetailContentBlockFromUnknown = (block: unknown): ProductDetailContentBlock | null => {
  if (!isRecord(block)) return null;
  const rawType = String(block.type || 'text');
  const type: ProductDetailContentBlock['type'] = rawType === 'image' || rawType === 'video' ? rawType : 'text';
  return {
    type,
    content: optionalString(block.content),
    url: optionalString(block.url),
    caption: optionalString(block.caption),
  };
};

const createSkuFromOptions = (options: Record<string, string>, index: number) => {
  const suffix = Object.values(options)
    .map((value) => String(value || '').trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())
    .filter(Boolean)
    .join('-');
  return suffix ? `SKU-${suffix}` : `SKU-${index + 1}`;
};

const importJsonValue = (value: unknown) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};
const isCsvImportFile = (file: File) => {
  const name = String(file.name || '').trim().toLowerCase();
  const type = String(file.type || '').trim().toLowerCase();
  return name.endsWith('.csv') && (!type || ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(type));
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const formatImportMoneyValue = (value: unknown) => {
  if (value == null || value === '') return '';
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : String(value);
};

const productImportStatusColor = (status?: string) => {
  switch (status) {
    case 'APPLIED':
    case 'PREVIEW_READY':
      return 'green';
    case 'PREVIEW_BLOCKED':
      return 'orange';
    case 'REJECTED':
      return 'red';
    default:
      return 'default';
  }
};

const formatImportFieldLabel = (field?: string, labels: Record<string, string> = {}) => {
  const key = String(field || '').trim();
  return key ? labels[key] || key : '';
};

type ImportErrorCopy = {
  file: string;
  row: (rowNumber: number) => string;
};

type ImportErrorReportCopy = {
  importId: string;
  filename: string;
  sizeBytes: string;
  fileSha256: string;
  status: string;
  applied: string;
  rowNumber: string;
  field: string;
  fieldLabel: string;
  message: string;
  trueValue: string;
  falseValue: string;
};

type ProductImportFileMetadata = ProductImportResult & {
  filename?: string;
  sizeBytes?: number;
};

type ImportErrorTableRow = {
  key: string;
  rowLabel: string;
  fieldKey: string;
  fieldLabel: string;
  message: string;
};

const productImportFilename = (result: ProductImportResult) =>
  String((result as ProductImportFileMetadata).filename || '').trim();

const productImportSizeBytes = (result: ProductImportResult) => {
  const value = Number((result as ProductImportFileMetadata).sizeBytes || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const importErrorRows = (
  result: { rowErrors?: Array<{ rowNumber: number; field?: string; message: string }>; errors?: string[] },
  labels: Record<string, string> = {},
  copy: ImportErrorCopy = { file: 'File', row: (rowNumber) => `Row ${rowNumber}` },
) => {
  if (Array.isArray(result.rowErrors) && result.rowErrors.length > 0) {
    return result.rowErrors.map((rowError, index) => {
      const fieldLabel = formatImportFieldLabel(rowError.field, labels);
      return {
        key: `${rowError.rowNumber}-${rowError.field || 'row'}-${index}`,
        rowLabel: rowError.rowNumber > 0 ? copy.row(rowError.rowNumber) : copy.file,
        fieldKey: rowError.field || '',
        fieldLabel,
        message: rowError.message,
      };
    });
  }
  return (result.errors || []).map((errorText, index) => ({
    key: `file-${index}`,
    rowLabel: copy.file,
    fieldKey: '',
    fieldLabel: '',
    message: errorText,
  }));
};

const renderImportErrorTable = (
  result: { rowErrors?: Array<{ rowNumber: number; field?: string; message: string }>; errors?: string[] },
  labels: Record<string, string> = {},
  copy: ImportErrorCopy = { file: 'File', row: (rowNumber) => `Row ${rowNumber}` },
  reportCopy: Pick<ImportErrorReportCopy, 'rowNumber' | 'fieldLabel' | 'message'> = {
    rowNumber: 'Row',
    fieldLabel: 'Field',
    message: 'Message',
  },
) => {
  const rows = importErrorRows(result, labels, copy);
  if (rows.length === 0) {
    return null;
  }
  return (
    <Table<ImportErrorTableRow>
      className="product-import-result__errorTable"
      size="small"
      rowKey="key"
      dataSource={rows}
      pagination={rows.length > 8 ? { pageSize: 8, size: 'small', showSizeChanger: false } : false}
      scroll={{ y: 260 }}
      columns={[
        {
          title: reportCopy.rowNumber,
          dataIndex: 'rowLabel',
          key: 'rowLabel',
          width: 112,
          render: (value: string) => <Text strong>{value}</Text>,
        },
        {
          title: reportCopy.fieldLabel,
          dataIndex: 'fieldLabel',
          key: 'fieldLabel',
          width: 160,
          render: (_value: string, row: ImportErrorTableRow) => {
            if (!row.fieldLabel) return <Text type="secondary">-</Text>;
            const tag = <Tag>{row.fieldLabel}</Tag>;
            return row.fieldKey && row.fieldLabel !== row.fieldKey ? <Tooltip title={row.fieldKey}>{tag}</Tooltip> : tag;
          },
        },
        {
          title: reportCopy.message,
          dataIndex: 'message',
          key: 'message',
          render: (value: string) => <span className="product-import-result__errorMessage">{value}</span>,
        },
      ]}
    />
  );
};

const downloadImportErrorReport = (
  result: ProductImportResult,
  labels: Record<string, string> = {},
  copy: ImportErrorReportCopy = {
    importId: 'importId',
    filename: 'filename',
    sizeBytes: 'sizeBytes',
    fileSha256: 'fileSha256',
    status: 'status',
    applied: 'applied',
    rowNumber: 'rowNumber',
    field: 'field',
    fieldLabel: 'fieldLabel',
    message: 'message',
    trueValue: 'true',
    falseValue: 'false',
  },
) => {
  const rowErrors = Array.isArray(result.rowErrors) && result.rowErrors.length > 0
    ? result.rowErrors
    : (result.errors || []).map((errorText) => ({ rowNumber: 0, field: '', message: errorText }));
  const rows = [
    [copy.importId, result.importId || ''],
    [copy.filename, productImportFilename(result)],
    [copy.sizeBytes, productImportSizeBytes(result) || ''],
    [copy.fileSha256, result.fileSha256 || ''],
    [copy.status, result.status || ''],
    [copy.applied, result.applied ? copy.trueValue : copy.falseValue],
    [],
    [copy.rowNumber, copy.field, copy.fieldLabel, copy.message],
    ...rowErrors.map((rowError) => [
      rowError.rowNumber || '',
      rowError.field || '',
      formatImportFieldLabel(rowError.field, labels),
      rowError.message || '',
    ]),
  ];
  const csv = rows.map(csvRow).join('\r\n');
  const blob = new Blob(['\uFEFF', `${csv}\r\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `product-import-errors-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const isProductImportResultPayload = (value: unknown): value is ProductImportResultPayload => {
  if (!isRecord(value)) {
    return false;
  }
  const status = typeof value.status === 'string' ? value.status : '';
  return ['PREVIEW_READY', 'PREVIEW_BLOCKED', 'APPLIED', 'REJECTED'].includes(status)
    || typeof value.readyToImport === 'boolean'
    || typeof value.applied === 'boolean'
    || Array.isArray(value.rowErrors);
};

const productImportResultFromError = (error: unknown): ProductImportResult | null => {
  const data = getErrorResponseData(error);
  if (!isProductImportResultPayload(data)) {
    return null;
  }
  return {
    ...data,
    totalRows: Number(data.totalRows || 0),
    created: Number(data.created || 0),
    updated: Number(data.updated || 0),
    failed: Number(data.failed || 0),
    errors: stringListFromUnknown(data.errors),
    rowErrors: productImportRowErrorsFromUnknown(data.rowErrors),
  };
};

const importErrorMessageFromError = (error: unknown, fallback: string, language: ReturnType<typeof useLanguage>['language']) => {
  const data = getErrorResponseData(error);
  if (isRecord(data)) {
    const errors = stringListFromUnknown(data.errors);
    if (errors.length > 0) {
      return errors.join('\n');
    }
  }
  return getApiErrorMessage(error, fallback, language);
};

const productImportTranslationParams = (result: Pick<ProductImportResult, 'totalRows' | 'created' | 'updated' | 'failed'>): Record<string, string | number> => ({
  totalRows: Number(result.totalRows || 0),
  created: Number(result.created || 0),
  updated: Number(result.updated || 0),
  failed: Number(result.failed || 0),
});

const productCreateDefaults = () => ({
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

type ListingQualityIssue = 'image' | 'content' | 'stock' | 'localized' | 'commercialHook';
type ListingQualityFilter = ListingQualityIssue | 'ready';
type ProductImportHistoryDisplayEntry = ProductImportHistoryEntry & {
  sourceHost?: string;
  confidenceScore?: number;
  imageCount?: number;
  blockedImageCount?: number;
  warningCount?: number;
};

const hasMeaningfulText = (value: unknown, minLength = 12) =>
  typeof value === 'string' && value.trim().length >= minLength;

const hasProductImage = (product: Product) => {
  const gallery = parseJsonArray(product.images);
  return Boolean(product.imageUrl || gallery.some((image) => typeof image === 'string' && image.trim()));
};

const hasRichProductContent = (product: Product) => {
  const detailBlocks = parseJsonArray(product.detailContent);
  const hasDetailBlock = detailBlocks.some((block) => {
    if (!isRecord(block)) return false;
    return hasMeaningfulText(block.content, 24) || hasMeaningfulText(block.url, 8);
  });
  return hasMeaningfulText(product.description, 36) || hasDetailBlock;
};

const hasLocalizedContent = (product: Product) => {
  const specs = getProductAdminSpecs(product);
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

const formatImportUpdateFields = (fields?: string[], labels: Record<string, string> = {}) => {
  const normalized = Array.isArray(fields)
    ? fields.map((field) => String(field || '').trim()).filter(Boolean)
    : [];
  if (normalized.length === 0) return '';
  const visibleFields = normalized.slice(0, 6).map((field) => labels[field] || field).join(', ');
  return normalized.length > 6 ? `${visibleFields} +${normalized.length - 6}` : visibleFields;
};

const ProductManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryOptionsTruncated, setCategoryOptionsTruncated] = useState(false);
  const [brandOptionsTruncated, setBrandOptionsTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [productSnapshotLoaded, setProductSnapshotLoaded] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [urlImportVisible, setUrlImportVisible] = useState(false);
  const [urlImportSubmitting, setUrlImportSubmitting] = useState(false);
  const [urlImportPreview, setUrlImportPreview] = useState<ProductUrlImportPreview | null>(null);
  const [importHistory, setImportHistory] = useState<ProductImportHistoryEntry[]>([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [batchStatusUpdating, setBatchStatusUpdating] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm<ProductFormValues>();
  const [urlImportForm] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [listingQualityFilter, setListingQualityFilter] = useState<ListingQualityFilter | undefined>(
    () => searchParams.get('stock') === 'low' ? 'stock' : undefined,
  );
  const [selectedProductIds, setSelectedProductIds] = useState<React.Key[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const { t, language } = useLanguage();
  const [productPage, setProductPage] = useState(1);
  const resetProductPageForSearch = useCallback(() => setProductPage(1), []);
  const debouncedSearchKeyword = useDebounce(searchKeyword.trim(), PRODUCT_SEARCH_DEBOUNCE_MS, resetProductPageForSearch);
  const [productPageSize, setProductPageSize] = useState(DEFAULT_ADMIN_PRODUCT_PAGE_SIZE);
  const [productTotal, setProductTotal] = useState(0);
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
  const canWriteProducts = hasAdminPermission(adminPermissions, currentRole, PRODUCTS_WRITE_PERMISSION);
  const canDeleteProducts = hasAdminPermission(adminPermissions, currentRole, PRODUCTS_DELETE_PERMISSION);
  const canChangeProductStatus = hasAdminPermission(adminPermissions, currentRole, PRODUCTS_STATUS_PERMISSION);
  const canImportProducts = hasAdminPermission(adminPermissions, currentRole, PRODUCTS_IMPORT_PERMISSION);
  const productActionDisabled = loading || Boolean(productLoadError) || !productSnapshotLoaded;
  const productActionUnavailableMessage = productLoadError || (loading ? t('common.loading') : t('pages.productAdmin.fetchProductsFailed'));
  const formatListingIssue = useCallback((issue: string) => (
    t(`pages.productAdmin.listingIssue.${issue}`, { defaultValue: issue })
  ), [t]);
  const formatUrlImportWarning = useCallback((warning: string) => (
    t(`pages.productAdmin.urlImportWarning.${warning}`, { defaultValue: warning })
  ), [t]);

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
  const importUpdateFieldLabels = useMemo(() => ({
    name: t('pages.productAdmin.importUpdateField.name'),
    description: t('pages.productAdmin.importUpdateField.description'),
    price: t('pages.productAdmin.importUpdateField.price'),
    stock: t('pages.productAdmin.importUpdateField.stock'),
    categoryId: t('pages.productAdmin.importUpdateField.categoryId'),
    imageUrl: t('pages.productAdmin.importUpdateField.imageUrl'),
    isFeatured: t('pages.productAdmin.importUpdateField.isFeatured'),
    brand: t('pages.productAdmin.importUpdateField.brand'),
    originalPrice: t('pages.productAdmin.importUpdateField.originalPrice'),
    discount: t('pages.productAdmin.importUpdateField.discount'),
    limitedTimePrice: t('pages.productAdmin.importUpdateField.limitedTimePrice'),
    limitedTimeStartAt: t('pages.productAdmin.importUpdateField.limitedTimeStartAt'),
    limitedTimeEndAt: t('pages.productAdmin.importUpdateField.limitedTimeEndAt'),
    tag: t('pages.productAdmin.importUpdateField.tag'),
    status: t('pages.productAdmin.importUpdateField.status'),
    images: t('pages.productAdmin.importUpdateField.images'),
    specifications: t('pages.productAdmin.importUpdateField.specifications'),
    detailContent: t('pages.productAdmin.importUpdateField.detailContent'),
    variants: t('pages.productAdmin.importUpdateField.variants'),
    warranty: t('pages.productAdmin.importUpdateField.warranty'),
    shipping: t('pages.productAdmin.importUpdateField.shipping'),
    freeShipping: t('pages.productAdmin.importUpdateField.freeShipping'),
    freeShippingThreshold: t('pages.productAdmin.importUpdateField.freeShippingThreshold'),
  }), [t]);
  const importErrorCopy = useMemo<ImportErrorCopy>(() => ({
    file: t('pages.productAdmin.importErrorFile'),
    row: (rowNumber) => t('pages.productAdmin.importErrorRow', { row: rowNumber }),
  }), [t]);
  const importErrorReportCopy = useMemo<ImportErrorReportCopy>(() => ({
    importId: t('pages.productAdmin.importErrorReport.importId'),
    filename: t('pages.productAdmin.importErrorReport.filename'),
    sizeBytes: t('pages.productAdmin.importErrorReport.sizeBytes'),
    fileSha256: t('pages.productAdmin.importErrorReport.fileSha256'),
    status: t('pages.productAdmin.importErrorReport.status'),
    applied: t('pages.productAdmin.importErrorReport.applied'),
    rowNumber: t('pages.productAdmin.importErrorReport.rowNumber'),
    field: t('pages.productAdmin.importErrorReport.field'),
    fieldLabel: t('pages.productAdmin.importErrorReport.fieldLabel'),
    message: t('pages.productAdmin.importErrorReport.message'),
    trueValue: t('pages.productAdmin.importErrorReport.trueValue'),
    falseValue: t('pages.productAdmin.importErrorReport.falseValue'),
  }), [t]);
  const variantSummary = useMemo(() => {
    const rows: ProductVariantFormRow[] = Array.isArray(previewVariants) ? previewVariants : [];
    const validRows = rows.filter((row) => String(row?.optionText || '').trim());
    const totalStock = validRows.reduce((sum: number, row) => sum + toSafeNumber(row?.stock), 0);
    const prices = validRows
      .map((row) => toSafeNumber(row?.price))
      .filter((price) => price > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    return { count: validRows.length, totalStock, minPrice, maxPrice };
  }, [previewVariants]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const categoryOptions = useMemo(() => toTreeOptions(categoryTree, undefined, language), [categoryTree, language]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminApi.getProducts({
        keyword: debouncedSearchKeyword || undefined,
        categoryId: filterCategory,
        status: filterStatus,
        page: Math.max(0, productPage - 1),
        size: productPageSize,
        sort: listingQualityFilter === 'stock' ? 'lowstock' : ADMIN_PRODUCT_DEFAULT_SORT,
      });
      const productPageData = response.data;
      setProducts(productPageData.items);
      setProductTotal(productPageData.total);
      setProductLoadError(null);
      setProductSnapshotLoaded(true);
      const nextPage = productPageData.totalPages > 0
        ? Math.min(productPageData.page + 1, productPageData.totalPages)
        : 1;
      if (nextPage !== productPage) {
        setProductPage(nextPage);
      }
      if (productPageData.size !== productPageSize) {
        setProductPageSize(productPageData.size);
      }
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.productAdmin.fetchProductsFailed'), language);
      setProductLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchKeyword, filterCategory, filterStatus, language, listingQualityFilter, productPage, productPageSize, t]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await adminApi.getProductCategories();
      setCategories(response.data);
      setCategoryOptionsTruncated(String(response.headers?.['x-admin-list-truncated'] || '').toLowerCase() === 'true');
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.productAdmin.fetchCategoriesFailed'), language));
    }
  }, [language, t]);

  const fetchBrands = useCallback(async () => {
    try {
      const response = await adminApi.getProductBrands({ activeOnly: false });
      setBrands(response.data);
      setBrandOptionsTruncated(String(response.headers?.['x-admin-list-truncated'] || '').toLowerCase() === 'true');
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.productAdmin.fetchBrandsFailed'), language));
    }
  }, [language, t]);

  const fetchImportHistory = useCallback(async () => {
    try {
      setImportHistoryLoading(true);
      const response = await adminApi.getProductImportHistory(6);
      setImportHistory(response.data);
    } catch (error) {
      setImportHistory([]);
    } finally {
      setImportHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
    fetchBrands();
    fetchImportHistory();
  }, [fetchCategories, fetchBrands, fetchImportHistory]);

  useEffect(() => {
    const stockRiskRoute = searchParams.get('stock') === 'low';
    setListingQualityFilter((current) => {
      if (stockRiskRoute) return current === 'stock' ? current : 'stock';
      return current === 'stock' ? undefined : current;
    });
  }, [searchParams]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch((error) => {
        if (disposed) return;
        reportNonBlockingError('ProductManagement.loadPermissions', error);
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const baseFilteredProducts = useMemo(() => {
    return products;
  }, [products]);

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

  const applyListingQualityFilter = (nextFilter?: ListingQualityFilter) => {
    setListingQualityFilter(nextFilter);
    setProductPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === 'stock') {
      nextParams.set('stock', 'low');
    } else {
      nextParams.delete('stock');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const visibleProductIdSet = useMemo(() => new Set(
    filteredProducts
      .map((product) => Number(product.id))
      .filter((id) => Number.isFinite(id))
  ), [filteredProducts]);

  const selectedVisibleProductKeys = useMemo(() => (
    selectedProductIds.filter((id) => visibleProductIdSet.has(Number(id)))
  ), [selectedProductIds, visibleProductIdSet]);

  const selectedVisibleProductIds = useMemo(() => (
    selectedVisibleProductKeys
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  ), [selectedVisibleProductKeys]);

  useEffect(() => {
    setSelectedProductIds((currentSelectedProductIds) => {
      if (currentSelectedProductIds.length === 0) return currentSelectedProductIds;
      const visibleSelectedProductIds = currentSelectedProductIds.filter((id) => visibleProductIdSet.has(Number(id)));
      return visibleSelectedProductIds.length === currentSelectedProductIds.length
        ? currentSelectedProductIds
        : visibleSelectedProductIds;
    });
  }, [visibleProductIdSet]);

  const handleAdd = () => {
    if (!canWriteProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue(productCreateDefaults());
    setImagePreviewUrl('');
    setModalVisible(true);
  };

  const closeProductModal = () => {
    if (productSubmitting) return;
    setModalVisible(false);
    setEditingProduct(null);
    setImagePreviewUrl('');
    form.resetFields();
  };

  const closeUrlImportModal = () => {
    if (urlImportSubmitting) return;
    setUrlImportVisible(false);
    setUrlImportPreview(null);
    urlImportForm.resetFields();
  };

  const applyUrlImportPreview = (preview: ProductUrlImportPreview) => {
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    const uniqueImages = normalizeProductImageList(preview.imageUrl, preview.images);
    const mainImage = uniqueImages[0] || '';
    const specs = [
      { key: 'source.url', value: preview.sourceUrl },
      { key: 'source.host', value: preview.sourceHost },
      { key: 'source.currency', value: preview.currency },
      { key: 'source.confidence', value: preview.confidenceScore == null ? undefined : String(preview.confidenceScore) },
    ].filter((item): item is { key: string; value: string } => typeof item.value === 'string' && item.value.trim().length > 0)
      .map((item) => ({ key: item.key, value: item.value.trim() }));

    setEditingProduct(null);
    form.resetFields();
    const importedDetailContent: ProductDetailContentBlock[] = [];
    if (preview.description) {
      importedDetailContent.push({ type: 'text', content: preview.description });
    }
    importedDetailContent.push(
      ...uniqueImages.slice(0, 6).map((image): ProductDetailContentBlock => ({ type: 'image', url: image, caption: preview.name || '' })),
    );

    form.setFieldsValue({
      ...productCreateDefaults(),
      name: preview.name,
      description: preview.description || preview.name || '',
      price: preview.price ?? 0,
      originalPrice: preview.originalPrice,
      stock: 0,
      brand: preview.brand,
      imageUrl: mainImage,
      images: uniqueImages,
      specifications: specs.length > 0 ? specs : [{}],
      detailContent: importedDetailContent.length > 0 ? importedDetailContent : [emptyDetailBlock],
      status: 'PENDING_REVIEW',
    });
    setImagePreviewUrl(mainImage);
    setUrlImportVisible(false);
    setUrlImportPreview(null);
    setModalVisible(true);
    message.success(t('pages.productAdmin.urlImportSuccess'));
  };

  const handleImportProductFromUrl = async () => {
    if (!canImportProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    if (urlImportPreview) {
      applyUrlImportPreview(urlImportPreview);
      return;
    }
    try {
      const values = await urlImportForm.validateFields();
      setUrlImportSubmitting(true);
      const response = await adminApi.importProductFromUrl(values.importUrl);
      setUrlImportPreview(response.data || null);
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('pages.productAdmin.urlImportFailed'), language));
    } finally {
      setUrlImportSubmitting(false);
    }
  };

  const urlImportPreviewImages = useMemo(() => {
    if (!urlImportPreview) return [];
    const ordered = [urlImportPreview.imageUrl, ...(Array.isArray(urlImportPreview.images) ? urlImportPreview.images : [])]
      .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
      .map((image) => image.trim());
    return Array.from(new Set(ordered)).slice(0, 10);
  }, [urlImportPreview]);

  const urlImportPreviewMainImage = urlImportPreview?.imageUrl || urlImportPreviewImages[0] || '';

  const handleEdit = (record: Product) => {
    if (!canWriteProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    setEditingProduct(record);
    const images = parseJsonArray(record.images).filter((image): image is string => typeof image === 'string');
    const specsObj = getProductAdminSpecs(record);
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
    const detailContent = parseJsonArray(record.detailContent)
      .map(productDetailContentBlockFromUnknown)
      .filter((block): block is ProductDetailContentBlock => Boolean(block));
    const variants = parseJsonArray(record.variants).map((variant): ProductVariantFormRow => {
      const source = isRecord(variant) ? variant : {};
      return {
        sku: optionalString(source.sku),
        optionText: formatVariantOptionText(variant),
        price: toSafeNumber(source.price),
        stock: toSafeNumber(source.stock),
        imageUrl: optionalString(source.imageUrl),
      };
    }).filter((variant) => variant.optionText);
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
    if (!canDeleteProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    try {
      await adminApi.deleteProduct(id);
      message.success(t('pages.productAdmin.deleted'));
      fetchProducts();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('messages.deleteFailed'), language));
    }
  };

  const handleToggleFeatured = async (record: Product) => {
    if (!canWriteProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    try {
      await adminApi.updateProduct(record.id, { ...record, isFeatured: !record.isFeatured });
      message.success(record.isFeatured ? t('pages.productAdmin.unfeatured') : t('pages.productAdmin.featured'));
      fetchProducts();
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    }
  };

  const handleProductStatus = async (record: Product, status: string) => {
    if (!canChangeProductStatus) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    try {
      await adminApi.updateProductStatus(record.id, status);
      message.success(t('messages.updateSuccess'));
      fetchProducts();
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    }
  };

  const handleBatchProductStatus = async (status: string) => {
    if (!canChangeProductStatus) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    if (selectedVisibleProductIds.length === 0) {
      message.error(t('pages.productAdmin.selectProductsFirst'));
      return;
    }
    try {
      setBatchStatusUpdating(status);
      const res = await adminApi.batchUpdateProductStatus(selectedVisibleProductIds, status);
      message.success(t('pages.productAdmin.batchUpdateResult', res.data));
      setSelectedProductIds([]);
      fetchProducts();
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      setBatchStatusUpdating(null);
    }
  };

  const handleDuplicate = (record: Product) => {
    if (!canWriteProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
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
    const optionGroupRows = (form.getFieldValue('optionGroups') as ProductOptionGroupFormRow[] | undefined) || [];
    const optionGroups: Array<{ name: string; values: string[] }> = optionGroupRows
      .map((group: ProductOptionGroupFormRow) => ({
        name: String(group?.name || '').trim(),
        values: String(group?.values || '').split(',').map((item: string) => item.trim()).filter(Boolean),
      }))
      .filter((group) => group.name && group.values.length > 0);
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
      ((form.getFieldValue('variants') as ProductVariantFormRow[] | undefined) || [])
        .map((row): [string, ProductVariantFormRow] => [normalizeVariantOptionText(String(row?.optionText || '')), row])
        .filter(([optionText]) => optionText)
    );
    form.setFieldValue('variants', combinations.map((options, index) => {
      const optionText = Object.entries(options).map(([key, value]) => `${key}=${value}`).join(', ');
      const existing = existingRows.get(normalizeVariantOptionText(optionText));
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
    const rows = ((form.getFieldValue('variants') as ProductVariantFormRow[] | undefined) || [])
      .filter((row) => String(row?.optionText || '').trim());
    const totalStock = rows.reduce((sum, row) => sum + toSafeNumber(row?.stock), 0);
    form.setFieldValue('stock', totalStock);
    message.success(t('pages.productAdmin.stockSyncedFromVariants', { count: rows.length, stock: totalStock }));
  };

  const handleSubmit = async () => {
    if (!canWriteProducts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    try {
      const values = await form.validateFields();
      setProductSubmitting(true);
      // Convert specifications from array of {key, value} to object
      const specs: Record<string, string> = {};
      if (values.specifications) {
        values.specifications.forEach((item) => {
          const key = String(item?.key || '').trim();
          const value = String(item?.value || '').trim();
          if (key && value) specs[key] = value;
        });
      }
      // Filter out empty image URLs
      const rawMainImage = String(values.imageUrl || '').trim();
      const imageList = normalizeProductImageList(rawMainImage, values.images);
      const mainImage = isHttpMediaUrl(rawMainImage) ? rawMainImage : imageList[0] || '';
      const detailContent = (values.detailContent || [])
        .map((block): ProductDetailContentBlock => {
          const rawType = String(block?.type || 'text');
          const type: ProductDetailContentBlock['type'] = rawType === 'image' || rawType === 'video' ? rawType : 'text';
          return {
            type,
            content: String(block?.content || '').trim() || undefined,
            url: String(block?.url || '').trim() || undefined,
            caption: String(block?.caption || '').trim() || undefined,
          };
        })
        .filter((block) => block.type === 'text' ? !!block.content : !!block.url && isHttpMediaUrl(block.url));
      const localizedContent = values.localizedContent || {};
      ['es', 'zh'].forEach((locale) => {
        ['name', 'description', 'brand'].forEach((field) => {
          const text = localizedContent?.[locale]?.[field];
          if (typeof text === 'string' && text.trim()) {
            specs[`i18n.${locale}.${field}`] = text.trim();
          }
        });
      });
      (values.optionGroups || []).forEach((group) => {
        const name = String(group?.name || '').trim();
        const valuesText = String(group?.values || '').trim();
        if (name && valuesText) {
          const options = valuesText.split(',').map((item: string) => item.trim()).filter(Boolean);
          if (options.length) specs[`options.${name}`] = options.join(',');
        }
      });
      if (values.bundleEnabled) {
        const bundleItems = (values.bundleItems || [])
          .map((item) => ({
            name: String(item?.name || '').trim(),
            quantity: Number(item?.quantity || 1),
          }))
          .filter((item) => item.name && item.quantity > 0);
        if (bundleItems.length > 0 && Number(values.bundlePrice || 0) > 0) {
          specs['bundle.enabled'] = 'true';
          specs['bundle.title'] = String(values.bundleTitle || values.name || '').trim();
          specs['bundle.price'] = String(Number(values.bundlePrice).toFixed(2));
          specs['bundle.items'] = JSON.stringify(bundleItems);
        }
      }
      const variants = (values.variants || [])
        .map((variant) => {
          const optionText = String(variant?.optionText || '').trim();
          const options = parseVariantOptions({ optionText });
          const price = toSafeNumber(variant?.price);
          const stock = toSafeNumber(variant?.stock, NaN);
          return {
            sku: String(variant?.sku || '').trim() || undefined,
            options,
            price,
            stock: Number.isFinite(stock) ? stock : undefined,
            imageUrl: String(variant?.imageUrl || '').trim() || undefined,
          };
        })
        .filter((variant) => Object.keys(variant.options).length > 0 && Number.isFinite(variant.price) && variant.price > 0);
      const variantStockTotal = variants.reduce((sum, variant) => sum + toSafeNumber(variant.stock), 0);
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
      const payload: ProductMutationPayload = {
        ...rest,
        imageUrl: mainImage,
        stock: variants.length > 0 ? variantStockTotal : rest.stock,
        specifications: Object.keys(specs).length > 0 ? specs : null,
        images: imageList.length > 0 ? imageList : null,
        detailContent: detailContent.length > 0 ? detailContent : null,
        variants: variants.length > 0 ? variants : null,
        limitedTimeStartAt: limitedTimeRange?.[0] ? limitedTimeRange[0].format('YYYY-MM-DDTHH:mm:ss') : null,
        limitedTimeEndAt: limitedTimeRange?.[1] ? limitedTimeRange[1].format('YYYY-MM-DDTHH:mm:ss') : null,
      };
      if (editingProduct) {
        payload.updatedAt = editingProduct.updatedAt;
        await adminApi.updateProduct(editingProduct.id, payload);
        message.success(t('pages.productAdmin.updated'));
      } else {
        await adminApi.createProduct(payload);
        message.success(t('pages.productAdmin.created'));
      }
      setModalVisible(false);
      setEditingProduct(null);
      setImagePreviewUrl('');
      form.resetFields();
      fetchProducts();
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
    } finally {
      setProductSubmitting(false);
    }
  };

  const downloadImportTemplate = () => {
    const templateCategory = flatCategories[0];
    const templateCategoryName = templateCategory
      ? getCategoryPath(flatCategories, templateCategory.id).replace(/\s*\/\s*/g, ' > ')
      : 'Dog > Harnesses';
    const headers = [
      'id', 'name', 'description', 'price', 'stock', 'categoryId', 'categoryName', 'imageUrl', 'isFeatured',
      'brand', 'originalPrice', 'discount', 'limitedTimePrice', 'limitedTimeStartAt',
      'limitedTimeEndAt', 'tag', 'images', 'specifications', 'detailContent', 'warranty', 'shipping', 'status', 'freeShipping', 'freeShippingThreshold', 'variants',
    ];
    const primaryImage = 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80';
    const galleryImage = 'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80';
    const detailImage = 'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80';
    const templateRow = [
      '', 'Smart pet feeder with stainless bowl', 'Programmable feeder for cats and small dogs with sealed dry-food storage.', '99.90', '100', '', templateCategoryName,
      primaryImage, 'false', 'PawPilot', '129.90', '20', '', '', '',
      'new', `["${galleryImage}"]`, '{"material":"BPA-free ABS","capacity":"4 L"}',
      `[{"type":"text","content":"Keeps feeding routines consistent while the sealed hopper protects dry food."},{"type":"image","url":"${detailImage}","caption":"Portion control and removable bowl"}]`,
      '1 year limited warranty', 'Free shipping over the store threshold', 'ACTIVE', 'false', '',
      `[{"sku":"FEEDER-S-WHT","options":{"Size":"Small","Color":"White"},"price":99.90,"stock":50,"imageUrl":"${primaryImage}"}]`,
    ];
    const csv = `${csvRow(headers)}\r\n${csvRow(templateRow)}\r\n`;
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('pages.productAdmin.importTemplateDownloaded'));
  };

  const downloadPriceStockUpdateTemplate = () => {
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    const selectedIdSet = new Set(selectedVisibleProductIds);
    const sourceProducts = selectedIdSet.size > 0
      ? products.filter((product) => selectedIdSet.has(Number(product.id)))
      : filteredProducts;
    if (sourceProducts.length === 0) {
      message.warning(t('pages.productAdmin.exportEmpty'));
      return;
    }
    const headers = ['id', 'price', 'stock'];
    const rows = sourceProducts.map((product) => [
      product.id,
      formatImportMoneyValue(product.price),
      product.stock,
    ]);
    const csv = [
      csvRow(headers),
      ...rows.map(csvRow),
    ].join('\r\n');
    const blob = new Blob(['\uFEFF', `${csv}\r\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `product-price-stock-update-${dayjs().format('YYYYMMDD-HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(t('pages.productAdmin.importUpdateTemplateDownloaded', { count: sourceProducts.length }));
  };

  const exportFilteredProducts = () => {
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return;
    }
    if (filteredProducts.length === 0) {
      message.warning(t('pages.productAdmin.exportEmpty'));
      return;
    }
    const headers = [
      'id', 'name', 'description', 'price', 'stock', 'categoryId', 'categoryName', 'imageUrl',
      'isFeatured', 'brand', 'originalPrice', 'discount', 'limitedTimePrice', 'limitedTimeStartAt',
      'limitedTimeEndAt', 'tag', 'images', 'specifications', 'detailContent', 'warranty', 'shipping',
      'status', 'freeShipping', 'freeShippingThreshold', 'variants',
    ];
    const rows = filteredProducts.map((product) => {
      return [
        product.id,
        product.name,
        product.description,
        formatImportMoneyValue(product.price),
        product.stock,
        product.categoryId,
        product.categoryName,
        product.imageUrl,
        product.isFeatured ? 'true' : 'false',
        product.brand,
        formatImportMoneyValue(product.originalPrice),
        product.discount,
        formatImportMoneyValue(product.limitedTimePrice),
        product.limitedTimeStartAt,
        product.limitedTimeEndAt,
        product.tag,
        importJsonValue(product.images),
        importJsonValue(product.specifications),
        importJsonValue(product.detailContent),
        product.warranty,
        product.shipping,
        product.status || 'ACTIVE',
        product.freeShipping ? 'true' : 'false',
        formatImportMoneyValue(product.freeShippingThreshold),
        importJsonValue(product.variants),
      ];
    });
    const csv = [
      csvRow(headers),
      ...rows.map(csvRow),
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

  const copyImportTraceValue = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      message.success(t('pages.productAdmin.importTraceCopied'));
    } catch (error) {
      message.warning(t('pages.productAdmin.importTraceCopyFailed'));
    }
  };

  const handleImportTraceCopyKeyDown = (event: React.KeyboardEvent<HTMLElement>, value?: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    copyImportTraceValue(value);
  };

  const renderImportTrace = (result: ProductImportResult) => {
    if (!result.importId && !result.fileSha256 && !result.status) {
      return null;
    }
    const updateFields = formatImportUpdateFields(result.updateFields, importUpdateFieldLabels);
    const filename = productImportFilename(result);
    const sizeBytes = productImportSizeBytes(result);
    return (
      <Space wrap className="product-import-result__trace">
        {result.status ? (
          <Tag color={productImportStatusColor(result.status)}>
            {t(`pages.productAdmin.importStatus.${result.status}`, { defaultValue: result.status })}
          </Tag>
        ) : null}
        {typeof result.applied === 'boolean' ? (
          <Tag color={result.applied ? 'green' : 'default'}>
            {result.applied ? t('pages.productAdmin.importApplied') : t('pages.productAdmin.importNotApplied')}
          </Tag>
        ) : null}
        {result.importId ? (
          <Tag
            icon={<CopyOutlined />}
            role="button"
            tabIndex={0}
            aria-label={`${t('pages.productAdmin.importId')}: ${result.importId}`}
            title={`${t('pages.productAdmin.importId')}: ${result.importId}`}
            onClick={() => copyImportTraceValue(result.importId)}
            onKeyDown={(event) => handleImportTraceCopyKeyDown(event, result.importId)}
          >
            {t('pages.productAdmin.importId')}: {result.importId}
          </Tag>
        ) : null}
        {filename ? (
          <Tooltip title={filename}>
            <Tag>{t('pages.productAdmin.importFilename')}: {filename}</Tag>
          </Tooltip>
        ) : null}
        {sizeBytes ? (
          <Tag>{t('pages.productAdmin.importFileSize')}: {formatBytes(sizeBytes)}</Tag>
        ) : null}
        {result.fileSha256 ? (
          <Tooltip title={result.fileSha256}>
            <Tag
              icon={<CopyOutlined />}
              role="button"
              tabIndex={0}
              aria-label={`${t('pages.productAdmin.importFileFingerprint')}: ${result.fileSha256}`}
              title={`${t('pages.productAdmin.importFileFingerprint')}: ${result.fileSha256}`}
              onClick={() => copyImportTraceValue(result.fileSha256)}
              onKeyDown={(event) => handleImportTraceCopyKeyDown(event, result.fileSha256)}
            >
              {t('pages.productAdmin.importFileFingerprint')}: {result.fileSha256.slice(0, 12)}
            </Tag>
          </Tooltip>
        ) : null}
        {updateFields ? (
          <Tooltip title={result.updateFields?.join(', ')}>
            <Tag>{t('pages.productAdmin.importUpdateFields', { fields: updateFields })}</Tag>
          </Tooltip>
        ) : null}
      </Space>
    );
  };

  const findDuplicateSuccessfulImport = useCallback((fileSha256?: string) => {
    if (!fileSha256) return undefined;
    return importHistory.find((log) => {
      return log.action === 'PRODUCT_IMPORT_APPLY'
        && log.result === 'SUCCESS'
        && log.fileSha256 === fileSha256;
    });
  }, [importHistory]);

  const renderDuplicateImportWarning = (duplicateImport?: ProductImportHistoryEntry) => {
    if (!duplicateImport) return null;
    return (
      <Alert
        type="warning"
        showIcon
        message={t('pages.productAdmin.importDuplicateWarningTitle')}
        description={t('pages.productAdmin.importDuplicateWarningDescription', {
          date: dayjs(duplicateImport.createdAt).format('YYYY-MM-DD HH:mm'),
          filename: duplicateImport.filename || '-',
        })}
      />
    );
  };

  const renderImportProblemContent = (
    result: ProductImportResult,
    notice: string,
    duplicateImport?: ProductImportHistoryEntry,
  ) => (
    <div className="product-import-result">
      <Alert type="warning" showIcon message={notice} />
      <p>{t('pages.productAdmin.importSummary', productImportTranslationParams(result))}</p>
      {(result.maxRows || result.maxFileSizeBytes) && (
        <Space wrap className="product-import-result__limits">
          {result.maxRows ? <Tag>{t('pages.productAdmin.importMaxRows', { count: result.maxRows })}</Tag> : null}
          {result.maxFileSizeBytes ? <Tag>{t('pages.productAdmin.importMaxFileSize', { size: formatBytes(result.maxFileSizeBytes) })}</Tag> : null}
        </Space>
      )}
      {renderImportTrace(result)}
      {renderDuplicateImportWarning(duplicateImport)}
      {renderImportErrorTable(result, importUpdateFieldLabels, importErrorCopy, importErrorReportCopy)}
      {result.truncatedErrors ? <Text type="secondary">{t('pages.productAdmin.importErrorsTruncated')}</Text> : null}
      {(result.errors?.length || result.rowErrors?.length) ? (
        <Button icon={<DownloadOutlined />} onClick={() => downloadImportErrorReport(result, importUpdateFieldLabels, importErrorReportCopy)}>
          {t('pages.productAdmin.importDownloadErrors')}
        </Button>
      ) : null}
    </div>
  );

  const showImportProblemModal = (
    result: ProductImportResult,
    title: string,
    notice: string,
    duplicateImport?: ProductImportHistoryEntry,
  ) => {
    Modal.warning({
      title,
      content: renderImportProblemContent(result, notice, duplicateImport),
      width: 720,
      className: 'profile-mobile-safe-modal product-management-page__importProblemModal',
    });
  };

  const handleImportProducts = async (file: File) => {
    if (!canImportProducts) {
      message.error(t('adminLayout.noPermission'));
      return false;
    }
    if (productActionDisabled) {
      message.error(productActionUnavailableMessage);
      return false;
    }
    if (importSubmitting) {
      return false;
    }
    if (!isCsvImportFile(file)) {
      message.error(t('pages.productAdmin.importInvalidType'));
      return false;
    }
    try {
      setImportSubmitting(true);
      setLoading(true);
      const previewRes = await adminApi.previewImportProducts(file);
      const preview = previewRes.data;
      const duplicateImport = findDuplicateSuccessfulImport(preview.fileSha256);
      setLoading(false);
      if (preview.failed > 0 || !preview.readyToImport) {
        showImportProblemModal(
          preview,
          t('pages.productAdmin.importPreviewBlockedTitle'),
          t('pages.productAdmin.importPreviewBlockedNotice'),
          duplicateImport,
        );
        fetchImportHistory();
        return false;
      }
      const importTargetLabel = `${t('pages.productAdmin.importConfirmApply')}: ${file.name}, ${t('pages.productAdmin.importPreviewMessage', productImportTranslationParams(preview))}`;
      Modal.confirm({
        title: t('pages.productAdmin.importPreviewTitle'),
        content: (
          <div className="product-import-result">
            <Alert type="success" showIcon message={t('pages.productAdmin.importPreviewReadyNotice')} />
            <p>{t('pages.productAdmin.importPreviewMessage', productImportTranslationParams(preview))}</p>
            <Space wrap className="product-import-result__limits">
              {preview.maxRows ? <Tag>{t('pages.productAdmin.importMaxRows', { count: preview.maxRows })}</Tag> : null}
              {preview.maxFileSizeBytes ? <Tag>{t('pages.productAdmin.importMaxFileSize', { size: formatBytes(preview.maxFileSizeBytes) })}</Tag> : null}
            </Space>
            {renderImportTrace(preview)}
            {renderDuplicateImportWarning(duplicateImport)}
          </div>
        ),
        okText: t('pages.productAdmin.importConfirmApply'),
        cancelText: t('common.cancel'),
        okButtonProps: { disabled: productActionDisabled, 'aria-label': importTargetLabel, title: importTargetLabel },
        cancelButtonProps: { 'aria-label': `${t('common.cancel')}: ${importTargetLabel}`, title: `${t('common.cancel')}: ${importTargetLabel}` },
        width: 640,
        className: 'profile-mobile-safe-modal product-management-page__importConfirmModal',
        onOk: async () => {
          setImportSubmitting(true);
          setLoading(true);
          try {
            const res = await adminApi.importProducts(file);
            const result = res.data;
            if (!result.applied) {
              showImportProblemModal(
                result,
                t('pages.productAdmin.importRejectedTitle'),
                t('pages.productAdmin.importRejectedNoWrite'),
              );
            } else {
              Modal.success({
                title: t('pages.productAdmin.importSuccessTitle'),
                content: (
                  <div className="product-import-result">
                    <Alert type="success" showIcon message={t('pages.productAdmin.importAppliedNotice')} />
                    <p>{t('pages.productAdmin.importSuccess', productImportTranslationParams(result))}</p>
                    {renderImportTrace(result)}
                  </div>
                ),
                width: 640,
                className: 'profile-mobile-safe-modal product-management-page__importSuccessModal',
              });
              fetchImportHistory();
            }
            fetchProducts();
          } catch (error: unknown) {
            const result = productImportResultFromError(error);
            if (result) {
              showImportProblemModal(
                result,
                t('pages.productAdmin.importRejectedTitle'),
                t('pages.productAdmin.importRejectedNoWrite'),
              );
            } else {
              message.error(importErrorMessageFromError(error, t('pages.productAdmin.importFailed'), language));
            }
          } finally {
            setImportSubmitting(false);
            setLoading(false);
            fetchImportHistory();
          }
        },
      });
    } catch (error: unknown) {
      const result = productImportResultFromError(error);
      if (result) {
        showImportProblemModal(
          result,
          t('pages.productAdmin.importPreviewBlockedTitle'),
          t('pages.productAdmin.importPreviewBlockedNotice'),
          findDuplicateSuccessfulImport(result.fileSha256),
        );
        fetchImportHistory();
      } else {
        message.error(importErrorMessageFromError(error, t('pages.productAdmin.importFailed'), language));
      }
    } finally {
      setImportSubmitting(false);
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
        <span className="commerce-money" style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(displayPrice)}</span>
        {record.activeLimitedTimeDiscount ? <Tag color="red" style={{ marginLeft: 4 }}>{t('pages.productAdmin.limitedTimeActive')}</Tag> : null}
        {hasDiscount && (
          <>
            <br />
            <Text delete type="secondary" className="commerce-money" style={{ fontSize: 12 }}>{formatMoney(record.originalPrice!)}</Text>
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
              <span className="commerce-money">{price > 0 ? formatMoney(price) : formatMoney(0)}</span>
              {hasOriginalPrice ? <Text delete type="secondary" className="commerce-money">{formatMoney(originalPrice)}</Text> : null}
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
      onCell: () => productAdminTableCell(t('common.image')),
      render: (url: string, record: Product) => (
        <Image src={resolveProductAdminImage(url)} alt={record.name || t('pages.productAdmin.productTitlePreview')} width={50} height={50} style={{ objectFit: 'cover', borderRadius: 6 }} fallback={productAdminImageFallback} />
      ),
    },
    {
      title: t('pages.productAdmin.productName'),
      dataIndex: 'name',
      key: 'name',
      width: 180,
      onCell: () => productAdminTableCell(t('pages.productAdmin.productName')),
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
      onCell: () => productAdminTableCell(t('common.category')),
      render: (id: number) => getCategoryPath(flatCategories, id, language) || id,
    },
    {
      title: t('pages.productAdmin.price'),
      key: 'price',
      width: 140,
      onCell: () => productAdminTableCell(t('pages.productAdmin.price')),
      render: (_: unknown, record: Product) => renderPrice(record),
    },
    {
      title: t('pages.productAdmin.stock'),
      dataIndex: 'stock',
      key: 'stock',
      width: 70,
      onCell: () => productAdminTableCell(t('pages.productAdmin.stock')),
      render: (stock: number) => stock <= 0 ? <Tag color="red">{t('pages.productAdmin.outOfStock')}</Tag> : stock < 10 ? <Tag color="orange">{stock}</Tag> : stock,
    },
    {
      title: t('pages.productAdmin.shipping'),
      key: 'shippingRule',
      width: 150,
      onCell: () => productAdminTableCell(t('pages.productAdmin.shipping')),
      render: (_: unknown, record: Product) => (
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
      onCell: () => productAdminTableCell(t('pages.productAdmin.tag')),
      render: (tag: string) => tag ? <Tag color={tagColorMap[tag]}>{tagLabelMap[tag] || tag}</Tag> : '-',
    },
    {
      title: t('pages.productAdmin.reviewStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      onCell: () => productAdminTableCell(t('pages.productAdmin.reviewStatus')),
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
      onCell: () => productAdminTableCell(t('pages.productAdmin.featuredColumn')),
      render: (v: boolean) => v ? <Tag color="gold" icon={<StarFilled />}>{t('pages.productAdmin.featuredYes')}</Tag> : <Tag icon={<StarOutlined />}>{t('pages.productAdmin.featuredNo')}</Tag>,
    },
    {
      title: t('pages.productAdmin.listingQualityColumn'),
      key: 'listingQuality',
      width: 180,
      onCell: () => productAdminTableCell(t('pages.productAdmin.listingQualityColumn')),
      render: (_: unknown, record: Product) => {
        const issues = getListingQualityIssues(record);
        if (issues.length === 0) {
          return <Tag color="green">{t('pages.productAdmin.listingReady')}</Tag>;
        }
        return (
          <Space size={[0, 4]} wrap>
            {issues.slice(0, 2).map((issue) => (
              <Tag key={issue} color="orange">{formatListingIssue(issue)}</Tag>
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
      onCell: () => productAdminTableCell(t('common.actions')),
      render: (_: unknown, record: Product) => {
        const productName = record.name || `#${record.id}`;
        const featureActionText = record.isFeatured ? t('pages.productAdmin.unsetFeatured') : t('pages.productAdmin.setFeatured');
        const featureActionLabel = `${featureActionText}: ${productName}`;
        const editActionLabel = `${t('common.edit')}: ${productName}`;
        const duplicateActionLabel = `${t('pages.productAdmin.duplicateProduct')}: ${productName}`;
        const approveActionLabel = `${t('pages.productAdmin.approve')}: ${productName}`;
        const rejectActionLabel = `${t('pages.productAdmin.reject')}: ${productName}`;
        const reviewActionLabel = `${t('pages.productAdmin.review')}: ${productName}`;
        const deleteActionLabel = `${t('common.delete')}: ${productName}`;
        return (
          <Space size="small" wrap className="product-action-space">
	            <Tooltip title={featureActionLabel}>
	              {canWriteProducts ? (
		                <Popconfirm
		                  classNames={mobilePopconfirmClassNames}
		                  title={featureActionLabel}
	                  description={productName}
	                  onConfirm={() => handleToggleFeatured(record)}
	                  okText={t('common.confirm')}
	                  cancelText={t('common.cancel')}
	                  disabled={productActionDisabled}
	                  okButtonProps={{ danger: Boolean(record.isFeatured), disabled: productActionDisabled, 'aria-label': featureActionLabel, title: featureActionLabel }}
	                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${featureActionLabel}`, title: `${t('common.cancel')}: ${featureActionLabel}` }}
	                >
	                  <Button
	                    className={record.isFeatured ? 'product-feature-button product-feature-button--active' : 'product-feature-button'}
	                    icon={record.isFeatured ? <StarFilled /> : <StarOutlined />}
	                    aria-pressed={Boolean(record.isFeatured)}
	                    aria-label={featureActionLabel}
	                    title={featureActionLabel}
	                    disabled={productActionDisabled}
	                    size="small"
	                  />
	                </Popconfirm>
	              ) : <span />}
	            </Tooltip>
            {canWriteProducts ? <Button type="primary" icon={<EditOutlined />} aria-label={editActionLabel} title={editActionLabel} disabled={productActionDisabled} onClick={() => handleEdit(record)} size="small">{t('common.edit')}</Button> : null}
            {canWriteProducts ? (
              <Tooltip title={duplicateActionLabel}>
                <Button
                  icon={<CopyOutlined />}
                  aria-label={duplicateActionLabel}
                  title={duplicateActionLabel}
                  disabled={productActionDisabled}
                  onClick={() => handleDuplicate(record)}
                  size="small"
                />
              </Tooltip>
            ) : null}
            {canChangeProductStatus && (record.status || 'ACTIVE') !== 'ACTIVE' && (
	              <Popconfirm
	                classNames={mobilePopconfirmClassNames}
	                title={t('pages.productAdmin.approveConfirm', { name: productName })}
                onConfirm={() => handleProductStatus(record, 'ACTIVE')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                disabled={productActionDisabled}
                okButtonProps={{ disabled: productActionDisabled, 'aria-label': approveActionLabel, title: approveActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${approveActionLabel}`, title: `${t('common.cancel')}: ${approveActionLabel}` }}
              >
                <Button size="small" disabled={productActionDisabled} aria-label={approveActionLabel} title={approveActionLabel}>{t('pages.productAdmin.approve')}</Button>
              </Popconfirm>
            )}
            {canChangeProductStatus && (record.status || 'ACTIVE') !== 'REJECTED' && (
	              <Popconfirm
	                classNames={mobilePopconfirmClassNames}
	                title={t('pages.productAdmin.rejectConfirm', { name: productName })}
                onConfirm={() => handleProductStatus(record, 'REJECTED')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                disabled={productActionDisabled}
                okButtonProps={{ danger: true, disabled: productActionDisabled, 'aria-label': rejectActionLabel, title: rejectActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${rejectActionLabel}`, title: `${t('common.cancel')}: ${rejectActionLabel}` }}
              >
                <Button size="small" danger disabled={productActionDisabled} aria-label={rejectActionLabel} title={rejectActionLabel}>{t('pages.productAdmin.reject')}</Button>
              </Popconfirm>
            )}
            {canChangeProductStatus && (record.status || 'ACTIVE') !== 'PENDING_REVIEW' && (
	              <Popconfirm
	                classNames={mobilePopconfirmClassNames}
	                title={t('pages.productAdmin.reviewConfirm', { name: productName })}
                onConfirm={() => handleProductStatus(record, 'PENDING_REVIEW')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                disabled={productActionDisabled}
                okButtonProps={{ disabled: productActionDisabled, 'aria-label': reviewActionLabel, title: reviewActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${reviewActionLabel}`, title: `${t('common.cancel')}: ${reviewActionLabel}` }}
              >
                <Button size="small" disabled={productActionDisabled} aria-label={reviewActionLabel} title={reviewActionLabel}>{t('pages.productAdmin.review')}</Button>
              </Popconfirm>
            )}
            {canDeleteProducts ? (
	              <Popconfirm
	                classNames={mobilePopconfirmClassNames}
	                title={`${t('pages.productAdmin.deleteConfirm')}: ${productName}`}
                onConfirm={() => handleDelete(record.id)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                disabled={productActionDisabled}
                okButtonProps={{ danger: true, disabled: productActionDisabled, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
              >
                <Button danger icon={<DeleteOutlined />} size="small" disabled={productActionDisabled} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  const pageLabel = t('pages.productAdmin.title');
  const productEditorLabel = editingProduct?.name || (editingProduct ? `#${editingProduct.id}` : t('pages.productAdmin.addProduct'));
  const urlImportActionLabel = `${pageLabel}: ${t('pages.productAdmin.importFromUrl')}`;
  const searchLabel = `${pageLabel}: ${t('pages.productAdmin.searchPlaceholder')}`;
  const categoryFilterLabel = `${pageLabel}: ${t('pages.productAdmin.filterCategory')}`;
  const statusFilterLabel = `${pageLabel}: ${t('pages.productAdmin.reviewStatus')}`;
  const batchApproveActionLabel = `${t('pages.productAdmin.batchApprove')}: ${selectedVisibleProductIds.length}`;
  const batchRejectActionLabel = `${t('pages.productAdmin.batchReject')}: ${selectedVisibleProductIds.length}`;
  const selectAllVisibleProductsLabel = t('pages.productAdmin.selectAllVisibleProducts');
  const downloadTemplateActionLabel = `${pageLabel}: ${t('pages.productAdmin.downloadTemplate')}`;
  const downloadUpdateTemplateActionLabel = `${pageLabel}: ${t('pages.productAdmin.downloadUpdateTemplate')} (${selectedVisibleProductIds.length || filteredProducts.length})`;
  const exportProductsActionLabel = `${pageLabel}: ${t('pages.productAdmin.exportProducts')} (${filteredProducts.length})`;
  const importProductsActionLabel = `${pageLabel}: ${t('pages.productAdmin.importProducts')}`;
  const addProductActionLabel = `${pageLabel}: ${t('pages.productAdmin.addProduct')}`;
  const refreshImportHistoryLabel = `${pageLabel}: ${t('common.refresh')}`;
  const productPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${pageLabel}`,
    `${t('common.nextPage')}: ${pageLabel}`,
    `${t('common.previousPages')}: ${pageLabel}`,
    `${t('common.nextPages')}: ${pageLabel}`,
  ), [pageLabel, t]);
  const saveProductActionLabel = `${t('common.save')}: ${productEditorLabel}`;
  const cancelProductActionLabel = `${t('common.cancel')}: ${productEditorLabel}`;
  const bundleEnabledSwitchLabel = `${productEditorLabel}: ${t('bundle.bundleDeal')}`;
  const bundleTitleInputLabel = `${productEditorLabel}: ${t('bundle.bundleTitle')}`;
  const bundlePriceInputLabel = `${productEditorLabel}: ${t('bundle.bundlePrice')}`;
  const compareAtPriceInputLabel = `${productEditorLabel}: ${t('pages.productAdmin.compareAtPrice')}`;
  const discountInputLabel = `${productEditorLabel}: ${t('pages.productAdmin.discount')}`;
  const inventoryTrackedSwitchLabel = `${productEditorLabel}: ${t('pages.productAdmin.inventoryTracked')}`;
  const stockInputLabel = `${productEditorLabel}: ${t('pages.productAdmin.inventory')}`;
  const productEditorRowLabel = (section: string, index: number) => `${productEditorLabel}: ${section} ${index + 1}`;
  const productEditorFieldLabel = (section: string, field: string, index: number) => `${productEditorRowLabel(section, index)}: ${field}`;
  const productEditorRemoveRowLabel = (action: string, section: string, index: number) => `${action}: ${productEditorRowLabel(section, index)}`;
  const freeShippingSwitchLabel = `${productEditorLabel}: ${t('pages.productAdmin.freeShipping')}`;
  const bestSellerSwitchLabel = `${productEditorLabel}: ${t('pages.productAdmin.bestSeller')}`;
  const previewUrlImportLabel = `${urlImportPreview ? t('pages.productAdmin.urlImportApply') : t('pages.productAdmin.urlImportAction')}: ${t('pages.productAdmin.urlImportField')}`;
  const cancelUrlImportLabel = `${t('common.cancel')}: ${t('pages.productAdmin.urlImportTitle')}`;
  const showInitialProductLoading = loading && !productSnapshotLoaded;
  const productSnapshotUnavailable = Boolean(productLoadError) && !productSnapshotLoaded;
  const canRenderProductSnapshot = !showInitialProductLoading && !productSnapshotUnavailable;

  return (
    <div className="product-management-page">
      <Title level={3} style={{ marginBottom: 0 }}>{t('pages.productAdmin.title')}</Title>
      {(categoryOptionsTruncated || brandOptionsTruncated) ? (
        <Alert type="warning" showIcon message={t('pages.productAdmin.optionListTruncated')} />
      ) : null}
      <Divider />

      {productLoadError ? (
        <Alert
          className="product-management-page__alert"
          type="warning"
          showIcon
          message={productLoadError}
          description={productSnapshotLoaded ? t('pages.productAdmin.staleDataWarning') : undefined}
          action={(
            <Button size="small" loading={loading} onClick={fetchProducts}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      {showInitialProductLoading ? (
        <Card className="product-management-page__loadingState" loading />
      ) : null}

      {canRenderProductSnapshot ? (
        <>
      <div className="product-management-page__toolbar">
        <Space className="product-management-page__filters">
          <Input
            placeholder={t('pages.productAdmin.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            className="product-management-page__filterSearch"
            aria-label={searchLabel}
            title={searchLabel}
            disabled={productActionDisabled}
            allowClear
          />
          <TreeSelect
            placeholder={t('pages.productAdmin.filterCategory')}
            allowClear
            treeDefaultExpandAll
            className="product-management-page__filterCategory"
            aria-label={categoryFilterLabel}
            title={categoryFilterLabel}
            value={filterCategory}
            disabled={productActionDisabled}
            onChange={(v) => {
              setFilterCategory(v);
              setProductPage(1);
            }}
            treeData={categoryOptions}
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
          />
          <Select
            placeholder={t('pages.productAdmin.reviewStatus')}
            allowClear
            className="product-management-page__filterStatus"
            aria-label={statusFilterLabel}
            title={statusFilterLabel}
            value={filterStatus}
            disabled={productActionDisabled}
            onChange={(value) => {
              setFilterStatus(value);
              setProductPage(1);
            }}
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            options={[
              { value: 'ACTIVE', label: t('pages.productAdmin.approved') },
              { value: 'PENDING_REVIEW', label: t('pages.productAdmin.pending') },
              { value: 'REJECTED', label: t('pages.productAdmin.rejected') },
              { value: 'INACTIVE', label: t('status.INACTIVE') },
            ]}
          />
        </Space>
        <Space wrap className="product-management-page__actions">
          {canChangeProductStatus ? (
	            <Popconfirm
	              classNames={mobilePopconfirmClassNames}
	              title={t('pages.productAdmin.batchApproveConfirm', { count: selectedVisibleProductIds.length })}
              onConfirm={() => handleBatchProductStatus('ACTIVE')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              disabled={productActionDisabled || selectedVisibleProductIds.length === 0 || !!batchStatusUpdating}
              okButtonProps={{ disabled: productActionDisabled, 'aria-label': batchApproveActionLabel, title: batchApproveActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchApproveActionLabel}`, title: `${t('common.cancel')}: ${batchApproveActionLabel}` }}
            >
              <Button disabled={productActionDisabled || selectedVisibleProductIds.length === 0 || !!batchStatusUpdating} loading={batchStatusUpdating === 'ACTIVE'} aria-label={batchApproveActionLabel} title={batchApproveActionLabel}>
                {t('pages.productAdmin.batchApprove')}
              </Button>
            </Popconfirm>
          ) : null}
          {canChangeProductStatus ? (
	            <Popconfirm
	              classNames={mobilePopconfirmClassNames}
	              title={t('pages.productAdmin.batchRejectConfirm', { count: selectedVisibleProductIds.length })}
              onConfirm={() => handleBatchProductStatus('REJECTED')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              disabled={productActionDisabled || selectedVisibleProductIds.length === 0 || !!batchStatusUpdating}
              okButtonProps={{ danger: true, disabled: productActionDisabled, 'aria-label': batchRejectActionLabel, title: batchRejectActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchRejectActionLabel}`, title: `${t('common.cancel')}: ${batchRejectActionLabel}` }}
            >
              <Button disabled={productActionDisabled || selectedVisibleProductIds.length === 0 || !!batchStatusUpdating} loading={batchStatusUpdating === 'REJECTED'} danger aria-label={batchRejectActionLabel} title={batchRejectActionLabel}>
                {t('pages.productAdmin.batchReject')}
              </Button>
            </Popconfirm>
          ) : null}
          <Button icon={<DownloadOutlined />} onClick={downloadImportTemplate} aria-label={downloadTemplateActionLabel} title={downloadTemplateActionLabel}>
            {t('pages.productAdmin.downloadTemplate')}
          </Button>
          <Tooltip title={t('pages.productAdmin.importUpdateTemplateHint')} overlayClassName="product-management-page__importTooltip">
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadPriceStockUpdateTemplate}
              disabled={productActionDisabled || (selectedVisibleProductIds.length === 0 && filteredProducts.length === 0)}
              aria-label={downloadUpdateTemplateActionLabel}
              title={downloadUpdateTemplateActionLabel}
            >
              {t('pages.productAdmin.downloadUpdateTemplate')}
            </Button>
          </Tooltip>
          <Button icon={<DownloadOutlined />} onClick={exportFilteredProducts} disabled={productActionDisabled || filteredProducts.length === 0} aria-label={exportProductsActionLabel} title={exportProductsActionLabel}>
            {t('pages.productAdmin.exportProducts')}
          </Button>
          {canImportProducts ? (
            <Upload className="product-management-page__uploadAction" accept=".csv,text/csv" showUploadList={false} beforeUpload={handleImportProducts} disabled={productActionDisabled || importSubmitting}>
              <Tooltip title={t('pages.productAdmin.importCsvHint')} overlayClassName="product-management-page__importTooltip">
                <Button icon={<UploadOutlined />} loading={importSubmitting} disabled={productActionDisabled || importSubmitting} aria-label={importProductsActionLabel} title={importProductsActionLabel}>{t('pages.productAdmin.importProducts')}</Button>
              </Tooltip>
            </Upload>
          ) : null}
          {canImportProducts ? (
            <Button icon={<LinkOutlined />} disabled={productActionDisabled || urlImportSubmitting} aria-label={urlImportActionLabel} title={urlImportActionLabel} onClick={() => { urlImportForm.resetFields(); setUrlImportPreview(null); setUrlImportVisible(true); }}>
              {t('pages.productAdmin.importFromUrl')}
            </Button>
          ) : null}
          {canWriteProducts ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={productActionDisabled} aria-label={addProductActionLabel} title={addProductActionLabel}>
              {t('pages.productAdmin.addProduct')}
            </Button>
          ) : null}
        </Space>
      </div>
        </>
      ) : null}

      <section className="product-import-history">
        <div className="product-import-history__header">
          <div>
            <Text type="secondary">{t('pages.productAdmin.importHistoryEyebrow')}</Text>
            <h3>{t('pages.productAdmin.importHistoryTitle')}</h3>
          </div>
          <Button size="small" icon={<SyncOutlined />} loading={importHistoryLoading} onClick={fetchImportHistory} aria-label={refreshImportHistoryLabel} title={refreshImportHistoryLabel}>
            {t('common.refresh')}
          </Button>
        </div>
        {importHistory.length > 0 ? (
          <div className="product-import-history__list">
            {importHistory.map((log) => {
              const historyLog = log as ProductImportHistoryDisplayEntry;
              const importId = historyLog.importId || '';
              const fingerprint = historyLog.fileSha256 || '';
              const status = historyLog.status || (historyLog.result === 'SUCCESS' ? 'APPLIED' : 'REJECTED');
              const applied = typeof historyLog.applied === 'boolean' ? historyLog.applied : status === 'APPLIED';
              const urlImport = historyLog.action === 'PRODUCT_URL_IMPORT';
              return (
                <div className="product-import-history__item" key={historyLog.auditLogId}>
                  <div className="product-import-history__main">
                    <Tag color={productImportStatusColor(status)}>
                      {t(`pages.productAdmin.importStatus.${status}`, { defaultValue: status })}
                    </Tag>
                    <strong>{t(`pages.productAdmin.importHistoryAction.${historyLog.action}`, { defaultValue: historyLog.action })}</strong>
                    <Text type="secondary">{dayjs(historyLog.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                    {historyLog.filename ? <Text type="secondary">{historyLog.filename}</Text> : null}
                  </div>
                  <div className="product-import-history__meta">
                    {urlImport ? (
                      <>
                        {historyLog.sourceHost ? <span>{historyLog.sourceHost}</span> : null}
                        {typeof historyLog.confidenceScore === 'number' ? <span>{t('pages.productAdmin.urlImportConfidence', { score: historyLog.confidenceScore })}</span> : null}
                        <span>{t('pages.productAdmin.urlImportImageCount', { count: historyLog.imageCount || 0 })}</span>
                        {historyLog.blockedImageCount ? <span>{t('pages.productAdmin.urlImportBlockedImages', { count: historyLog.blockedImageCount })}</span> : null}
                        {historyLog.warningCount ? <span>{t('pages.productAdmin.importHistoryWarnings', { count: historyLog.warningCount })}</span> : null}
                      </>
                    ) : (
                      <>
                        <span>{t('pages.productAdmin.importHistoryRows', { count: historyLog.totalRows || 0 })}</span>
                        <span>{t('pages.productAdmin.importHistoryCreated', { count: historyLog.created || 0 })}</span>
                        <span>{t('pages.productAdmin.importHistoryUpdated', { count: historyLog.updated || 0 })}</span>
                        <span>{t('pages.productAdmin.importHistoryFailed', { count: historyLog.failed || 0 })}</span>
                        {formatImportUpdateFields(historyLog.updateFields, importUpdateFieldLabels) ? <span>{t('pages.productAdmin.importUpdateFields', { fields: formatImportUpdateFields(historyLog.updateFields, importUpdateFieldLabels) })}</span> : null}
                        <span>{applied ? t('pages.productAdmin.importApplied') : t('pages.productAdmin.importNotApplied')}</span>
                      </>
                    )}
                    {importId ? (
                      <button type="button" onClick={() => copyImportTraceValue(importId)}>
                        {t('pages.productAdmin.importId')}: {importId.slice(0, 8)}
                      </button>
                    ) : null}
                    {fingerprint ? (
                      <button type="button" onClick={() => copyImportTraceValue(fingerprint)}>
                        {t('pages.productAdmin.importFileFingerprint')}: {fingerprint.slice(0, 12)}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Text type="secondary">{importHistoryLoading ? t('pages.productAdmin.importHistoryLoading') : t('pages.productAdmin.importHistoryEmpty')}</Text>
        )}
      </section>

      {canRenderProductSnapshot ? (
        <>
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
            aria-pressed={!listingQualityFilter}
            aria-label={`${t('pages.productAdmin.allListings')}: ${listingQualityStats.total}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter(undefined)}
          >
            <span>{listingQualityStats.total}</span>
            {t('pages.productAdmin.allListings')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'ready' ? 'is-active' : ''}
            aria-pressed={listingQualityFilter === 'ready'}
            aria-label={`${t('pages.productAdmin.listingReady')}: ${listingQualityStats.ready}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter('ready')}
          >
            <span>{listingQualityStats.ready}</span>
            {t('pages.productAdmin.listingReady')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'image' ? 'is-active' : ''}
            aria-pressed={listingQualityFilter === 'image'}
            aria-label={`${t('pages.productAdmin.missingImages')}: ${listingQualityStats.image}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter('image')}
          >
            <span>{listingQualityStats.image}</span>
            {t('pages.productAdmin.missingImages')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'content' ? 'is-active' : ''}
            aria-pressed={listingQualityFilter === 'content'}
            aria-label={`${t('pages.productAdmin.weakContent')}: ${listingQualityStats.content}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter('content')}
          >
            <span>{listingQualityStats.content}</span>
            {t('pages.productAdmin.weakContent')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'stock' ? 'is-active' : ''}
            aria-pressed={listingQualityFilter === 'stock'}
            aria-label={`${t('pages.productAdmin.stockRisk')}: ${listingQualityStats.stock}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter('stock')}
          >
            <span>{listingQualityStats.stock}</span>
            {t('pages.productAdmin.stockRisk')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'localized' ? 'is-active' : ''}
            aria-pressed={listingQualityFilter === 'localized'}
            aria-label={`${t('pages.productAdmin.localizationGaps')}: ${listingQualityStats.localized}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter('localized')}
          >
            <span>{listingQualityStats.localized}</span>
            {t('pages.productAdmin.localizationGaps')}
          </button>
          <button
            type="button"
            className={listingQualityFilter === 'commercialHook' ? 'is-active' : ''}
            aria-pressed={listingQualityFilter === 'commercialHook'}
            aria-label={`${t('pages.productAdmin.missingCommercialHook')}: ${listingQualityStats.commercialHook}`}
            disabled={productActionDisabled}
            onClick={() => applyListingQualityFilter('commercialHook')}
          >
            <span>{listingQualityStats.commercialHook}</span>
            {t('pages.productAdmin.missingCommercialHook')}
          </button>
        </div>
        <div className="product-listing-quality__footer">
          <span>{t('pages.productAdmin.activeListings', { count: listingQualityStats.active })}</span>
          <span>{t('pages.productAdmin.featuredListings', { count: listingQualityStats.featured })}</span>
          {listingQualityFilter ? (
            <Button size="small" disabled={productActionDisabled} onClick={() => applyListingQualityFilter(undefined)}>
              {t('pages.productAdmin.clearQualityFilter')}
            </Button>
          ) : null}
        </div>
      </section>

      <Table
        className="shop-admin-selection-table product-management-page__mobileCardTable"
        columns={columns}
        dataSource={filteredProducts}
        rowKey="id"
        rowSelection={{
          columnWidth: 56,
          columnTitle: (checkboxNode) => labelTableSelectionCheckbox(checkboxNode, selectAllVisibleProductsLabel),
          selectedRowKeys: selectedVisibleProductKeys,
          onChange: setSelectedProductIds,
          getCheckboxProps: (record) => {
            const selectionLabel = t('pages.productAdmin.selectProductRow', { product: productDisplayLabel(record) });
            return {
              disabled: productActionDisabled,
              'aria-label': selectionLabel,
              title: selectionLabel,
            };
          },
        }}
        loading={loading}
        pagination={{
          current: listingQualityFilter ? 1 : productPage,
          pageSize: productPageSize,
          total: listingQualityFilter ? filteredProducts.length : productTotal,
          showSizeChanger: !listingQualityFilter,
          pageSizeOptions: ['10', '20', '50', '100', '200'],
          showTotal: (total) => t('pages.productAdmin.tableTotal', { count: total }),
          itemRender: productPaginationItemRender,
        }}
        onChange={(pagination) => {
          if (productActionDisabled) return;
          if (listingQualityFilter) return;
          const nextPage = Number(pagination.current || 1);
          const nextSize = Number(pagination.pageSize || productPageSize);
          setProductPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1);
          setProductPageSize(Number.isFinite(nextSize) && nextSize > 0 ? nextSize : DEFAULT_ADMIN_PRODUCT_PAGE_SIZE);
        }}
        bordered
        size="middle"
        scroll={{ x: 1240 }}
      />
        </>
      ) : null}

      <Modal
        title={editingProduct ? t('pages.productAdmin.editTitle') : t('pages.productAdmin.addTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeProductModal}
        width="min(1280px, 96vw)"
        destroyOnHidden
        className="profile-mobile-safe-modal shopify-product-modal"
        okText={editingProduct ? t('pages.productAdmin.saveProduct') : t('pages.productAdmin.addProduct')}
        confirmLoading={productSubmitting}
        okButtonProps={{ disabled: productActionDisabled, 'aria-label': saveProductActionLabel, title: saveProductActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelProductActionLabel, title: cancelProductActionLabel }}
      >
        <Form form={form} layout="vertical" initialValues={{ images: [], specifications: [{}], optionGroups: [{ name: 'Size', values: '' }, { name: 'Color', values: '' }], detailContent: [emptyDetailBlock], bundleEnabled: false, bundleItems: [{ name: '', quantity: 1 }], freeShipping: false }}>
          <div className="shopify-product-editor">
            <div className="shopify-product-editor__main">
              <section className="shopify-card">
                <Form.Item
                  name="name"
                  label={t('pages.productAdmin.titleField')}
                  rules={[
                    { required: true, message: t('pages.productAdmin.nameRequired') },
                    { max: PRODUCT_NAME_MAX_LENGTH, message: t('pages.productAdmin.nameMaxLength', { count: PRODUCT_NAME_MAX_LENGTH }) },
                  ]}
                >
                  <Input className="shopify-input" maxLength={PRODUCT_NAME_MAX_LENGTH} showCount placeholder={t('pages.productAdmin.namePlaceholder')} />
                </Form.Item>

                <Form.Item
                  name="description"
                  label={t('pages.productAdmin.description')}
                  rules={[
                    { required: true, message: t('pages.productAdmin.descriptionRequired') },
                    { max: PRODUCT_DESCRIPTION_MAX_LENGTH, message: t('pages.productAdmin.descriptionMaxLength', { count: PRODUCT_DESCRIPTION_MAX_LENGTH }) },
                  ]}
                >
                  <TextArea
                    className="shopify-rich-text"
                    rows={7}
                    maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
                    showCount
                    placeholder={t('pages.productAdmin.descriptionRichPlaceholder')}
                  />
                </Form.Item>

                <Divider>{t('pages.productAdmin.languageSettings')}</Divider>
                <Tabs
                  className="shopify-localized-tabs"
                  tabBarGutter={8}
                  items={[
                    {
                      key: 'es',
                      label: <span className="shopify-localized-tabs__label">{t('pages.productAdmin.spanish')}</span>,
                      children: (
                        <div className="shopify-two-col">
                          {spanishNamePreview ? (
                            <Text type="secondary" className="shopify-localized-preview">
                              {t('pages.productAdmin.spanishTitle')}: {spanishNamePreview}
                            </Text>
                          ) : null}
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
                      label: <span className="shopify-localized-tabs__label">{t('pages.productAdmin.chinese')}</span>,
                      children: (
                        <div className="shopify-two-col">
                          {chineseNamePreview ? (
                            <Text type="secondary" className="shopify-localized-preview">
                              {t('pages.productAdmin.chineseTitle')}: {chineseNamePreview}
                            </Text>
                          ) : null}
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
                      <Image src={resolveProductAdminImage(imagePreviewUrl)} alt={previewName || t('pages.productAdmin.mediaPreview')} width="100%" height="100%" style={{ objectFit: 'cover' }} fallback={productAdminImageFallback} />
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
                              <Input
                                placeholder={t('pages.productAdmin.imageUrl', { index: index + 1 })}
                                aria-label={productEditorFieldLabel(t('pages.productAdmin.media'), t('pages.productAdmin.imageUrl', { index: index + 1 }), index)}
                                title={productEditorFieldLabel(t('pages.productAdmin.media'), t('pages.productAdmin.imageUrl', { index: index + 1 }), index)}
                              />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              aria-label={productEditorRemoveRowLabel(t('pages.productAdmin.removeImage'), t('pages.productAdmin.media'), index)}
                              title={productEditorRemoveRowLabel(t('pages.productAdmin.removeImage'), t('pages.productAdmin.media'), index)}
                              onClick={() => remove(name)}
                            />
                          </div>
                        ))}
                        <button type="button" className="shopify-media-add" aria-label={`${productEditorLabel}: ${t('pages.productAdmin.addMedia')}`} title={`${productEditorLabel}: ${t('pages.productAdmin.addMedia')}`} onClick={() => add()}>
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
                    aria-label={`${productEditorLabel}: ${t('common.category')}`}
                    title={`${productEditorLabel}: ${t('common.category')}`}
                    classNames={productEditorPopupClassNames}
                    getPopupContainer={() => document.body}
                    placement="bottomLeft"
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
	                    <InputNumber min={0} precision={2} prefix={t('pages.productAdmin.compareAt')} placeholder={t('pages.productAdmin.compareAtPrice')} aria-label={compareAtPriceInputLabel} title={compareAtPriceInputLabel} />
	                  </Form.Item>
	                  <Form.Item name="discount" label={null}>
	                    <InputNumber min={0} max={100} suffix="%" placeholder={t('pages.productAdmin.discount')} aria-label={discountInputLabel} title={discountInputLabel} />
	                  </Form.Item>
	                </div>
              </section>

              <section className="shopify-card">
                <div className="shopify-card__header">
	                  <h3>{t('bundle.bundleDeal')}</h3>
	                  <Form.Item name="bundleEnabled" valuePropName="checked" style={{ marginBottom: 0 }}>
	                    <Switch checkedChildren={t('pages.productAdmin.on')} unCheckedChildren={t('pages.productAdmin.off')} aria-label={bundleEnabledSwitchLabel} title={bundleEnabledSwitchLabel} />
	                  </Form.Item>
	                </div>
	                <div className="shopify-two-col">
	                  <Form.Item name="bundleTitle" label={t('bundle.bundleTitle')}>
	                    <Input placeholder={t('pages.productAdmin.bundleTitlePlaceholder')} aria-label={bundleTitleInputLabel} title={bundleTitleInputLabel} />
	                  </Form.Item>
	                  <Form.Item name="bundlePrice" label={t('bundle.bundlePrice')}>
	                    <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder="0.00" aria-label={bundlePriceInputLabel} title={bundlePriceInputLabel} />
	                  </Form.Item>
                </div>
                <Form.List name="bundleItems">
                  {(fields, { add, remove }) => (
                    <div className="shopify-option-list">
		                      {fields.map(({ key, name, ...restField }, index) => (
		                        <div key={key} className="shopify-option-row">
		                          <Form.Item {...restField} name={[name, 'name']} style={{ marginBottom: 0 }}>
		                            <Input placeholder={t('bundle.bundleItemName')} aria-label={productEditorFieldLabel(t('bundle.bundleDeal'), t('bundle.bundleItemName'), index)} title={productEditorFieldLabel(t('bundle.bundleDeal'), t('bundle.bundleItemName'), index)} />
		                          </Form.Item>
		                          <Form.Item {...restField} name={[name, 'quantity']} style={{ marginBottom: 0 }}>
		                            <InputNumber min={1} placeholder={t('common.quantity')} aria-label={productEditorFieldLabel(t('bundle.bundleDeal'), t('common.quantity'), index)} title={productEditorFieldLabel(t('bundle.bundleDeal'), t('common.quantity'), index)} />
		                          </Form.Item>
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined />}
                            aria-label={productEditorRemoveRowLabel(t('bundle.removeBundleItem'), t('bundle.bundleDeal'), index)}
                            title={productEditorRemoveRowLabel(t('bundle.removeBundleItem'), t('bundle.bundleDeal'), index)}
                            onClick={() => remove(name)}
                          />
                        </div>
                      ))}
                      <button type="button" className="shopify-link-button" aria-label={`${productEditorLabel}: ${t('bundle.addBundleItem')}`} title={`${productEditorLabel}: ${t('bundle.addBundleItem')}`} onClick={() => add({ quantity: 1 })}>
                        <PlusOutlined /> {t('bundle.addBundleItem')}
                      </button>
                    </div>
                  )}
                </Form.List>
              </section>

	              <section className="shopify-card">
	                <div className="shopify-card__header">
	                  <h3>{t('pages.productAdmin.inventory')}</h3>
		                  <Space><Text type="secondary">{t('pages.productAdmin.inventoryTracked')}</Text><Switch checked disabled aria-label={inventoryTrackedSwitchLabel} title={inventoryTrackedSwitchLabel} /></Space>
	                </div>
	                <div className="shopify-inventory-box">
	                  <span>{t('pages.productAdmin.shopLocation')}</span>
	                  <Form.Item name="stock" rules={[{ required: true, message: t('pages.productAdmin.stockRequired') }]} style={{ marginBottom: 0 }}>
	                    <InputNumber min={0} placeholder="0" aria-label={stockInputLabel} title={stockInputLabel} />
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
	                    <Switch checkedChildren={t('pages.productAdmin.free')} unCheckedChildren={t('pages.productAdmin.standardShipping')} aria-label={freeShippingSwitchLabel} title={freeShippingSwitchLabel} />
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
                  <span>{t('pages.productAdmin.price')}: <b className="commerce-money">{variantSummary.minPrice && variantSummary.maxPrice ? `${formatMoney(variantSummary.minPrice)} - ${formatMoney(variantSummary.maxPrice)}` : formatMoney(0)}</b></span>
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
	                      {fields.map(({ key, name, ...restField }, index) => (
	                        <div key={key} className="shopify-option-row">
	                          <Form.Item {...restField} name={[name, 'name']} style={{ marginBottom: 0 }}>
	                            <Input placeholder={t('pages.productAdmin.optionName')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variants'), t('pages.productAdmin.optionName'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variants'), t('pages.productAdmin.optionName'), index)} />
	                          </Form.Item>
	                          <Form.Item {...restField} name={[name, 'values']} style={{ marginBottom: 0 }}>
	                            <Input placeholder={t('pages.productAdmin.optionValues')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variants'), t('pages.productAdmin.optionValues'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variants'), t('pages.productAdmin.optionValues'), index)} />
	                          </Form.Item>
	                          <Button
	                            type="text"
	                            danger
	                            icon={<MinusCircleOutlined />}
	                            aria-label={productEditorRemoveRowLabel(t('pages.productAdmin.removeOptionGroup'), t('pages.productAdmin.variants'), index)}
	                            title={productEditorRemoveRowLabel(t('pages.productAdmin.removeOptionGroup'), t('pages.productAdmin.variants'), index)}
	                            onClick={() => remove(name)}
	                          />
	                        </div>
	                      ))}
	                      <button type="button" className="shopify-link-button" aria-label={`${productEditorLabel}: ${t('pages.productAdmin.addOptions')}`} title={`${productEditorLabel}: ${t('pages.productAdmin.addOptions')}`} onClick={() => add()}>
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
	                      {fields.map(({ key, name, ...restField }, index) => (
	                        <div key={key} className="shopify-variant-row">
	                          <Form.Item {...restField} name={[name, 'sku']} style={{ marginBottom: 0 }}>
	                            <Input placeholder={t('pages.productAdmin.variantSku')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.variantSku'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.variantSku'), index)} />
	                          </Form.Item>
	                          <Form.Item {...restField} name={[name, 'optionText']} style={{ marginBottom: 0 }} rules={[{ required: true, message: t('pages.productAdmin.variantOptionsRequired') }]}>
	                            <Input placeholder={t('pages.productAdmin.variantOptionText')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.variantOptionText'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.variantOptionText'), index)} />
	                          </Form.Item>
	                          <Form.Item {...restField} name={[name, 'price']} style={{ marginBottom: 0 }} rules={[{ required: true, message: t('pages.productAdmin.priceRequired') }]}>
	                            <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder={t('pages.productAdmin.salePrice')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.salePrice'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.salePrice'), index)} />
	                          </Form.Item>
	                          <Form.Item {...restField} name={[name, 'stock']} style={{ marginBottom: 0 }}>
	                            <InputNumber min={0} placeholder={t('pages.productAdmin.stock')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.stock'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.stock'), index)} />
	                          </Form.Item>
	                          <Form.Item {...restField} name={[name, 'imageUrl']} style={{ marginBottom: 0 }}>
	                            <Input placeholder={t('pages.productAdmin.variantImage')} aria-label={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.variantImage'), index)} title={productEditorFieldLabel(t('pages.productAdmin.variantCombinations'), t('pages.productAdmin.variantImage'), index)} />
	                          </Form.Item>
	                          <Button
	                            type="text"
	                            danger
	                            icon={<MinusCircleOutlined />}
	                            aria-label={productEditorRemoveRowLabel(t('pages.productAdmin.removeVariant'), t('pages.productAdmin.variantCombinations'), index)}
	                            title={productEditorRemoveRowLabel(t('pages.productAdmin.removeVariant'), t('pages.productAdmin.variantCombinations'), index)}
	                            onClick={() => remove(name)}
	                          />
	                        </div>
	                      ))}
	                      <button type="button" className="shopify-link-button" aria-label={`${productEditorLabel}: ${t('pages.productAdmin.addVariant')}`} title={`${productEditorLabel}: ${t('pages.productAdmin.addVariant')}`} onClick={() => add({ price: form.getFieldValue('price') || 0, stock: form.getFieldValue('stock') || 0 })}>
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
	                        {fields.map(({ key, name, ...restField }, index) => (
	                          <div key={key} className="shopify-metafield-row">
	                            <Form.Item {...restField} name={[name, 'key']} style={{ marginBottom: 0 }}>
	                              <Input placeholder={t('pages.productAdmin.specKey')} aria-label={productEditorFieldLabel(t('pages.productAdmin.specs'), t('pages.productAdmin.specKey'), index)} title={productEditorFieldLabel(t('pages.productAdmin.specs'), t('pages.productAdmin.specKey'), index)} />
	                            </Form.Item>
	                            <Form.Item {...restField} name={[name, 'value']} style={{ marginBottom: 0 }}>
	                              <Input placeholder={t('pages.productAdmin.specValue')} aria-label={productEditorFieldLabel(t('pages.productAdmin.specs'), t('pages.productAdmin.specValue'), index)} title={productEditorFieldLabel(t('pages.productAdmin.specs'), t('pages.productAdmin.specValue'), index)} />
	                            </Form.Item>
	                            <Button
	                              type="text"
	                              danger
	                              icon={<MinusCircleOutlined />}
	                              aria-label={productEditorRemoveRowLabel(t('pages.productAdmin.removeSpec'), t('pages.productAdmin.specs'), index)}
	                              title={productEditorRemoveRowLabel(t('pages.productAdmin.removeSpec'), t('pages.productAdmin.specs'), index)}
	                              onClick={() => remove(name)}
	                            />
	                          </div>
	                        ))}
	                        <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} aria-label={`${productEditorLabel}: ${t('pages.productAdmin.addMetafield')}`} title={`${productEditorLabel}: ${t('pages.productAdmin.addMetafield')}`}>
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
                  <Text type="secondary" className="commerce-money">{formatMoney(form.getFieldValue('price'))}</Text>
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
                  <ProductRichDetail
                    detailContent={detailContentPreview}
                    fallback={descriptionPreview}
                    emptyText={t('pages.productAdmin.richPreviewEmpty')}
                    labels={{
                      imageAlt: t('pages.productDetail.richImageAlt'),
                      videoTitle: (index) => t('pages.productDetail.richVideoTitle', { index }),
                      openVideo: t('pages.productDetail.openRichVideo'),
                      unsupported: t('pages.productDetail.unsupportedRichContent'),
                    }}
                  />
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
                    aria-label={`${productEditorLabel}: ${t('common.status')}`}
                    title={`${productEditorLabel}: ${t('common.status')}`}
                    classNames={productEditorPopupClassNames}
                    getPopupContainer={() => document.body}
                    placement="bottomLeft"
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
                  <span>{t('pages.productAdmin.shopChannel')}</span>
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
                    aria-label={`${productEditorLabel}: ${t('pages.productAdmin.vendor')}`}
                    title={`${productEditorLabel}: ${t('pages.productAdmin.vendor')}`}
                    classNames={productEditorPopupClassNames}
                    getPopupContainer={() => document.body}
                    placement="bottomLeft"
                    options={brands.map((brand) => ({ value: brand.name, label: brand.name }))}
                  />
                </Form.Item>
                <Form.Item name="tag" label={t('pages.productAdmin.tags')}>
                  <Select
                    mode="tags"
                    className="shopify-input"
                    placeholder={t('pages.productAdmin.selectTag')}
                    aria-label={`${productEditorLabel}: ${t('pages.productAdmin.tags')}`}
                    title={`${productEditorLabel}: ${t('pages.productAdmin.tags')}`}
                    classNames={productEditorPopupClassNames}
                    getPopupContainer={() => document.body}
                    placement="bottomLeft"
                    options={tagOptions.map(option => ({ value: option.value, label: option.label }))}
                  />
                </Form.Item>
	                <Form.Item name="isFeatured" label={t('pages.productAdmin.bestSeller')} valuePropName="checked">
	                  <Switch checkedChildren={t('pages.productAdmin.on')} unCheckedChildren={t('pages.productAdmin.off')} aria-label={bestSellerSwitchLabel} title={bestSellerSwitchLabel} />
	                </Form.Item>
              </section>

              <section className="shopify-card">
                <h3>{t('pages.productAdmin.themeTemplate')}</h3>
                <Select
                  className="shopify-input"
                  value="default-product"
                  disabled
                  aria-label={`${productEditorLabel}: ${t('pages.productAdmin.themeTemplate')}`}
                  title={`${productEditorLabel}: ${t('pages.productAdmin.themeTemplate')}`}
                  classNames={productEditorPopupClassNames}
                  getPopupContainer={() => document.body}
                  placement="bottomLeft"
                  options={[{ value: 'default-product', label: t('pages.productAdmin.defaultProduct') }]}
                />
              </section>

              <section className="shopify-card shopify-card--muted">
                <h3>{t('pages.productAdmin.limitedTimeDiscount')}</h3>
                <Form.Item name="limitedTimePrice" label={t('pages.productAdmin.limitedTimePrice')}>
                  <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} placeholder={t('pages.productAdmin.limitedTimePricePlaceholder')} />
                </Form.Item>
                <Form.Item name="limitedTimeRange" label={t('pages.productAdmin.limitedTimeRange')}>
                  <DatePicker.RangePicker
                    showTime
                    className="shopify-range-picker"
                    classNames={productEditorPopupClassNames}
                    getPopupContainer={() => document.body}
                    placement="bottomLeft"
                    id={{ start: 'product-limited-time-start', end: 'product-limited-time-end' }}
                    placeholder={[t('common.start'), t('common.end')]}
                    aria-label={`${productEditorLabel}: ${t('pages.productAdmin.limitedTimeRange')}`}
                    title={`${productEditorLabel}: ${t('pages.productAdmin.limitedTimeRange')}`}
                  />
                </Form.Item>
              </section>
            </aside>
          </div>
        </Form>
      </Modal>

      <Modal
        title={t('pages.productAdmin.urlImportTitle')}
        open={urlImportVisible}
        onOk={handleImportProductFromUrl}
        onCancel={closeUrlImportModal}
        okText={urlImportPreview ? t('pages.productAdmin.urlImportApply') : t('pages.productAdmin.urlImportAction')}
        confirmLoading={urlImportSubmitting}
        okButtonProps={{ disabled: productActionDisabled, 'aria-label': previewUrlImportLabel, title: previewUrlImportLabel }}
        cancelButtonProps={{ 'aria-label': cancelUrlImportLabel, title: cancelUrlImportLabel }}
        destroyOnHidden
        width={720}
        className="profile-mobile-safe-modal product-management-page__urlImportModal"
      >
        <Form form={urlImportForm} layout="vertical" onValuesChange={() => setUrlImportPreview(null)}>
          <Form.Item
            name="importUrl"
            label={t('pages.productAdmin.urlImportField')}
            rules={[
              { required: true, message: t('pages.productAdmin.urlImportRequired') },
              { type: 'url', message: t('pages.productAdmin.urlImportInvalid') },
            ]}
          >
            <Input placeholder={t('pages.productAdmin.urlImportPlaceholder')} disabled={productActionDisabled} allowClear aria-label={`${t('pages.productAdmin.urlImportTitle')}: ${t('pages.productAdmin.urlImportField')}`} title={`${t('pages.productAdmin.urlImportTitle')}: ${t('pages.productAdmin.urlImportField')}`} />
          </Form.Item>
          <Text type="secondary">{t('pages.productAdmin.urlImportHint')}</Text>
          <Alert
            className="product-url-import-preview__alert"
            type="info"
            showIcon
            message={t('pages.productAdmin.urlImportVisibilityNotice')}
          />
        </Form>
        {urlImportPreview && (
          <div className="product-url-import-preview">
            <div className="product-url-import-preview__media">
              {urlImportPreviewMainImage ? (
                <Image src={resolveProductAdminImage(urlImportPreviewMainImage)} alt={urlImportPreview.name || t('pages.productAdmin.mediaPreview')} width={88} height={88} style={{ objectFit: 'cover', borderRadius: 6 }} fallback={productAdminImageFallback} />
              ) : (
                <div className="product-url-import-preview__placeholder">{t('pages.productAdmin.urlImportNoImage')}</div>
              )}
              {urlImportPreviewImages.length > 1 && (
                <div className="product-url-import-preview__thumbs" aria-label={t('pages.productAdmin.urlImportImageCount', { count: urlImportPreviewImages.length })}>
                  {urlImportPreviewImages.map((image, index) => (
                    <Image
                      key={`${image}-${index}`}
                      src={resolveProductAdminImage(image)}
                      width={38}
                      height={38}
                      alt={urlImportPreview.name ? `${urlImportPreview.name} #${index + 1}` : `${t('pages.productAdmin.mediaPreview')} #${index + 1}`}
                      preview={false}
                      fallback={productAdminImageFallback}
                      className="product-url-import-preview__thumb"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="product-url-import-preview__body">
              <div className="product-url-import-preview__score">
                <Tag color={(urlImportPreview.confidenceScore || 0) >= 75 ? 'green' : (urlImportPreview.confidenceScore || 0) >= 45 ? 'orange' : 'red'}>
                  {t('pages.productAdmin.urlImportConfidence', { score: urlImportPreview.confidenceScore || 0 })}
                </Tag>
                {urlImportPreview.sourceHost && <Text type="secondary">{urlImportPreview.sourceHost}</Text>}
              </div>
              <h4>{urlImportPreview.name || t('pages.productAdmin.urlImportMissingName')}</h4>
              <p>{urlImportPreview.description || t('pages.productAdmin.urlImportMissingDescription')}</p>
              <Space wrap>
                <Tag><span className="commerce-money">{urlImportPreview.price != null ? formatMoney(Number(urlImportPreview.price)) : t('pages.productAdmin.urlImportMissingPrice')}</span></Tag>
                {urlImportPreview.originalPrice != null && <Tag color="volcano"><span className="commerce-money">{t('pages.productAdmin.urlImportOriginalPrice', { price: formatMoney(Number(urlImportPreview.originalPrice)) })}</span></Tag>}
                {urlImportPreview.brand && <Tag>{urlImportPreview.brand}</Tag>}
                <Tag>{t('pages.productAdmin.urlImportImageCount', { count: urlImportPreviewImages.length })}</Tag>
              </Space>
              {urlImportPreview.warnings && urlImportPreview.warnings.length > 0 && (
                <div className="product-url-import-preview__warnings">
                  {urlImportPreview.warnings.map((warning) => (
                    <Tag color="gold" key={warning}>{formatUrlImportWarning(warning)}</Tag>
                  ))}
                </div>
              )}
              {urlImportPreview.blockedImages && urlImportPreview.blockedImages.length > 0 && (
                <Alert
                  className="product-url-import-preview__alert"
                  type="warning"
                  showIcon
                  message={t('pages.productAdmin.urlImportBlockedImages', { count: urlImportPreview.blockedImages.length })}
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProductManagement;
