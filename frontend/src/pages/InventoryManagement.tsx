import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Table } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { adminApi } from '../api/admin';
import { createApiAbortController } from '../api';
import type { Product } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { useDebounce } from '../hooks/useDebounce';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import { getEffectiveRole, hasAdminPermission, PRODUCTS_WRITE_PERMISSION } from '../utils/roles';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopCard from '../components/ShopCard';
import ShopInput from '../components/ShopInput';
import ShopInputNumber from '../components/ShopInputNumber';
import ShopModal from '../components/ShopModal';
import ShopProgress from '../components/ShopProgress';
import ShopSegmented from '../components/ShopSegmented';
import ShopSelect from '../components/ShopSelect';
import ShopSpace from '../components/ShopSpace';
import ShopTag from '../components/ShopTag';
import ShopTypography from '../components/ShopTypography';
import message from '../components/ShopMessage';
import {
  EMPTY_INVENTORY_HEALTH,
  LOW_STOCK_THRESHOLD,
  getStockLevel,
  normalizeInventorySummary,
  resolveAdjustedStock,
} from './inventoryManagementHelpers';
import type { InventoryHealth, StockAdjustMode, StockLevel } from './inventoryManagementHelpers';
import './InventoryManagement.css';

const Title = ShopTypography.Title;
const Text = ShopTypography.Text;

const INVENTORY_PAGE_SIZE = 20;

type StockAdjustFormValues = {
  mode: StockAdjustMode;
  amount: number;
};

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const inventoryTableCell = (label: string): React.TdHTMLAttributes<HTMLElement> & Record<'data-label', string> => ({
  'data-label': label,
});

const InventoryManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [health, setHealth] = useState<InventoryHealth>(EMPTY_INVENTORY_HEALTH);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INVENTORY_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [levelFilter, setLevelFilter] = useState<StockLevel | 'all'>('all');
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm<StockAdjustFormValues>();
  const inventoryRequestSeqRef = useRef(0);
  const inventoryAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const adjustMode = Form.useWatch('mode', form);
  const adjustAmount = Form.useWatch('amount', form);
  const debouncedKeyword = useDebounce(keyword);

  const canAdjustStock = hasAdminPermission(adminPermissions, currentRole, PRODUCTS_WRITE_PERMISSION);
  const actionsDisabled = loading || Boolean(loadError) || !snapshotLoaded;
  const actionUnavailableMessage = loadError || (loading ? t('common.loading') : t('pages.inventoryAdmin.fetchFailed'));

  const pageLabel = t('pages.inventoryAdmin.title');
  const searchInputLabel = `${t('common.search')}: ${pageLabel}`;
  const categoryFilterLabel = `${t('pages.inventoryAdmin.category')}: ${pageLabel}`;
  const levelFilterLabel = `${t('pages.inventoryAdmin.stockLevel')}: ${pageLabel}`;
  const refreshActionLabel = `${t('common.refresh')}: ${pageLabel}`;

  const fetchInventory = useCallback(async () => {
    const requestSeq = inventoryRequestSeqRef.current + 1;
    inventoryRequestSeqRef.current = requestSeq;
    inventoryAbortRef.current?.abort();
    const abortController = createApiAbortController();
    inventoryAbortRef.current = abortController;
    setLoading(true);
    try {
      const [productsResponse, summaryResponse] = await Promise.all([
        adminApi.getProducts({
          keyword: debouncedKeyword || undefined,
          categoryId,
          page: Math.max(0, page - 1),
          size: pageSize,
          sort: 'lowstock',
        }, { signal: abortController.signal }),
        adminApi.getInventorySummary({ signal: abortController.signal }),
      ]);
      if (!mountedRef.current || abortController.signal.aborted || inventoryRequestSeqRef.current !== requestSeq) return;
      setProducts(productsResponse.data.items);
      setTotal(productsResponse.data.total);
      setHealth(normalizeInventorySummary(summaryResponse.data));
      setLoadError(null);
      setSnapshotLoaded(true);
    } catch (error: unknown) {
      if (!mountedRef.current || abortController.signal.aborted || inventoryRequestSeqRef.current !== requestSeq) return;
      setLoadError(getApiErrorMessage(error, t('pages.inventoryAdmin.fetchFailed'), language));
    } finally {
      if (inventoryAbortRef.current === abortController) inventoryAbortRef.current = null;
      if (mountedRef.current && inventoryRequestSeqRef.current === requestSeq) setLoading(false);
    }
  }, [categoryId, debouncedKeyword, language, page, pageSize, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
    mountedRef.current = false;
    inventoryRequestSeqRef.current += 1;
    inventoryAbortRef.current?.abort();
    inventoryAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    let disposed = false;
    const abortController = createApiAbortController();
    adminApi.getMyPermissions({ signal: abortController.signal })
      .then((response) => {
        if (disposed || abortController.signal.aborted) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch(() => {
        if (disposed || abortController.signal.aborted) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const abortController = createApiAbortController();
    adminApi.getProductCategories({ signal: abortController.signal })
      .then((response) => {
        if (disposed || abortController.signal.aborted) return;
        setCategories(response.data.map((category) => ({
          value: String(category.id),
          label: String(category.name || '').trim() || `#${category.id}`,
        })));
      })
      .catch(() => {
        if (disposed || abortController.signal.aborted) return;
        setCategories([]);
      });
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, []);

  const visibleProducts = useMemo(
    () => (levelFilter === 'all' ? products : products.filter((product) => getStockLevel(product.stock) === levelFilter)),
    [levelFilter, products],
  );

  const stockLevelLabels = useMemo<Record<StockLevel, string>>(() => ({
    out: t('pages.inventoryAdmin.outOfStock'),
    critical: t('pages.inventoryAdmin.critical'),
    low: t('pages.inventoryAdmin.low'),
    healthy: t('pages.inventoryAdmin.healthy'),
  }), [t]);

  const stockLevelColors: Record<StockLevel, string> = {
    out: 'red',
    critical: 'volcano',
    low: 'orange',
    healthy: 'green',
  };

  const productLabel = useCallback((product?: Product | null) => {
    const name = String(product?.name || '').trim();
    if (name) return name;
    return product?.id ? `${t('pages.inventoryAdmin.product')} #${product.id}` : t('pages.inventoryAdmin.product');
  }, [t]);

  const openAdjustModal = (product: Product) => {
    if (!canAdjustStock) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (actionsDisabled) {
      message.warning(actionUnavailableMessage);
      return;
    }
    setAdjustTarget(product);
    form.resetFields();
    form.setFieldsValue({ mode: 'set', amount: Math.max(0, Math.trunc(Number(product.stock ?? 0) || 0)) });
  };

  const closeAdjustModal = () => {
    if (saving) return;
    setAdjustTarget(null);
    form.resetFields();
  };

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    if (!canAdjustStock) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (actionsDisabled) {
      message.warning(actionUnavailableMessage);
      return;
    }
    try {
      const values = await form.validateFields();
      const nextStock = resolveAdjustedStock(adjustTarget.stock, values.mode, values.amount);
      setSaving(true);
      await adminApi.updateProduct(adjustTarget.id, {
        stock: nextStock,
        updatedAt: adjustTarget.updatedAt,
      });
      message.success(t('pages.inventoryAdmin.adjusted', {
        name: productLabel(adjustTarget),
        stock: nextStock,
      }));
      setAdjustTarget(null);
      form.resetFields();
      await fetchInventory();
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('pages.inventoryAdmin.adjustFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const paginationItemRender = useMemo(
    () => buildPaginationItemRender(t('common.previousPage'), t('common.nextPage')),
    [t],
  );

  const previewStock = adjustTarget
    ? resolveAdjustedStock(adjustTarget.stock, adjustMode || 'set', adjustAmount)
    : 0;
  const adjustTargetName = productLabel(adjustTarget);
  const adjustTitle = `${t('pages.inventoryAdmin.adjustTitle')}: ${adjustTargetName}`;
  const saveAdjustLabel = `${t('common.save')}: ${adjustTitle}`;
  const cancelAdjustLabel = `${t('common.cancel')}: ${adjustTitle}`;

  const showInitialLoading = loading && !snapshotLoaded;
  const snapshotUnavailable = Boolean(loadError) && !snapshotLoaded;
  const canRenderSnapshot = !showInitialLoading && !snapshotUnavailable;

  return (
    <div className="inventory-page">
      <Title level={4}>{pageLabel}</Title>

      {loadError && snapshotLoaded ? (
        <ShopAlert
          className="inventory-page__alert"
          type="warning"
          showIcon
          message={loadError}
          description={t('pages.inventoryAdmin.staleDataWarning')}
          action={(
            <ShopSpace wrap data-admin-inventory-stale-recovery="true">
              <ShopButton size="small" type="primary" loading={loading} onClick={() => { void fetchInventory(); }}>
                {t('common.retry')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin/products')}>{t('pages.adminDashboard.products')}</ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</ShopButton>
            </ShopSpace>
          )}
        />
      ) : null}

      {snapshotUnavailable ? (
        <div className="inventory-page__error" data-admin-inventory-load-recovery="true">
          <PageError
            title={t('pages.inventoryAdmin.fetchFailed')}
            description={loadError || undefined}
            actions={[
              { key: 'retry', label: t('common.retry'), onClick: () => { void fetchInventory(); }, type: 'primary' },
              { key: 'products', label: t('pages.adminDashboard.products'), onClick: () => navigate('/admin/products'), type: 'default' },
              { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
            ]}
          />
        </div>
      ) : null}

      {showInitialLoading ? (
        <ShopCard
          className="inventory-page__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderSnapshot ? (
        <>
          <ShopCard className="inventory-page__intro">
            <ShopSpace wrap>
              <Text type="secondary">{t('pages.inventoryAdmin.description')}</Text>
              <ShopInput
                allowClear
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                disabled={actionsDisabled}
                placeholder={t('common.search')}
                className="inventory-page__keywordInput"
                aria-label={searchInputLabel}
                title={searchInputLabel}
              />
              <ShopSelect
                allowClear
                showSearch
                value={categoryId == null ? undefined : String(categoryId)}
                onChange={(value) => {
                  setCategoryId(value ? Number(value) : undefined);
                  setPage(1);
                }}
                disabled={actionsDisabled}
                placeholder={t('pages.inventoryAdmin.category')}
                className="inventory-page__categoryFilter"
                popupClassName="shop-mobile-popup-layer"
                ariaLabel={categoryFilterLabel}
                title={categoryFilterLabel}
                options={categories}
              />
              <ShopButton
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => { void fetchInventory(); }}
                aria-label={refreshActionLabel}
                title={refreshActionLabel}
              >
                {t('common.refresh')}
              </ShopButton>
            </ShopSpace>
          </ShopCard>

          <section className="inventory-page__health" aria-label={t('pages.inventoryAdmin.healthTitle')}>
            <div className="inventory-page__healthCopy">
              <Text className="inventory-page__eyebrow">{t('pages.inventoryAdmin.healthEyebrow')}</Text>
              <Title level={5}>{t('pages.inventoryAdmin.healthTitle')}</Title>
              <Text type="secondary">{t('pages.inventoryAdmin.healthSubtitle', { threshold: LOW_STOCK_THRESHOLD })}</Text>
            </div>
            <div className="inventory-page__score">
              <ShopProgress
                type="circle"
                percent={health.score}
                width={86}
                strokeColor={health.score >= 80 ? '#2f855a' : health.score >= 50 ? '#d97706' : '#c53030'}
                format={(value) => `${value || 0}`}
              />
              <Text type="secondary">{t('pages.inventoryAdmin.healthScore')}</Text>
            </div>
            <div className="inventory-page__healthGrid">
              <div className={`inventory-page__healthItem ${health.outOfStock ? 'is-risk' : 'is-ok'}`}>
                <StopOutlined />
                <strong>{health.outOfStock}</strong>
                <span>{t('pages.inventoryAdmin.outOfStock')}</span>
              </div>
              <div className={`inventory-page__healthItem ${health.critical ? 'is-risk' : 'is-ok'}`}>
                <WarningOutlined />
                <strong>{health.critical}</strong>
                <span>{t('pages.inventoryAdmin.critical')}</span>
              </div>
              <div className={`inventory-page__healthItem ${health.low ? 'is-warn' : 'is-ok'}`}>
                <AppstoreOutlined />
                <strong>{health.low}</strong>
                <span>{t('pages.inventoryAdmin.low')}</span>
              </div>
              <div className="inventory-page__healthItem is-ok">
                <CheckCircleOutlined />
                <strong>{health.healthy}</strong>
                <span>{t('pages.inventoryAdmin.healthy')}</span>
              </div>
              <div className="inventory-page__healthItem is-ok">
                <DatabaseOutlined />
                <strong>{health.totalUnits}</strong>
                <span>{t('pages.inventoryAdmin.totalUnits')}</span>
              </div>
            </div>
          </section>

          <ShopSegmented
            className="inventory-page__levelFilter"
            value={levelFilter}
            onChange={(value) => setLevelFilter(value as StockLevel | 'all')}
            ariaLabel={levelFilterLabel}
            title={levelFilterLabel}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'out', label: stockLevelLabels.out },
              { value: 'critical', label: stockLevelLabels.critical },
              { value: 'low', label: stockLevelLabels.low },
              { value: 'healthy', label: stockLevelLabels.healthy },
            ]}
          />

          <Table
            rowKey="id"
            loading={loading}
            dataSource={visibleProducts}
            bordered
            scroll={{ x: 720 }}
            className="inventory-page__table"
            columns={[
              {
                title: t('pages.inventoryAdmin.product'),
                dataIndex: 'name',
                key: 'name',
                onCell: () => inventoryTableCell(t('pages.inventoryAdmin.product')),
                render: (_: unknown, product: Product) => (
                  <div className="inventory-page__product">
                    <strong>{productLabel(product)}</strong>
                    <Text type="secondary">{product.categoryName || `#${product.categoryId}`}</Text>
                  </div>
                ),
              },
              {
                title: t('pages.inventoryAdmin.currentStock'),
                dataIndex: 'stock',
                key: 'stock',
                width: 130,
                align: 'right',
                onCell: () => inventoryTableCell(t('pages.inventoryAdmin.currentStock')),
                render: (stock: number) => <strong>{Math.max(0, Math.trunc(Number(stock ?? 0) || 0))}</strong>,
              },
              {
                title: t('pages.inventoryAdmin.stockLevel'),
                key: 'level',
                width: 140,
                onCell: () => inventoryTableCell(t('pages.inventoryAdmin.stockLevel')),
                render: (_: unknown, product: Product) => {
                  const level = getStockLevel(product.stock);
                  return <ShopTag color={stockLevelColors[level]}>{stockLevelLabels[level]}</ShopTag>;
                },
              },
              {
                title: t('pages.inventoryAdmin.stockValue'),
                key: 'value',
                width: 150,
                align: 'right',
                onCell: () => inventoryTableCell(t('pages.inventoryAdmin.stockValue')),
                render: (_: unknown, product: Product) => formatMoney(
                  Math.max(0, Math.trunc(Number(product.stock ?? 0) || 0)) * Number(product.price || 0),
                ),
              },
              {
                title: t('common.actions'),
                key: 'actions',
                width: 150,
                onCell: () => inventoryTableCell(t('common.actions')),
                render: (_: unknown, product: Product) => {
                  const adjustLabel = `${t('pages.inventoryAdmin.adjust')}: ${productLabel(product)}`;
                  if (!canAdjustStock) return <Text type="secondary">-</Text>;
                  return (
                    <ShopButton
                      size="small"
                      type="primary"
                      disabled={actionsDisabled}
                      aria-label={adjustLabel}
                      title={adjustLabel}
                      onClick={() => openAdjustModal(product)}
                    >
                      {t('pages.inventoryAdmin.adjust')}
                    </ShopButton>
                  );
                },
              },
            ]}
            pagination={{
              current: page,
              pageSize,
              total: levelFilter === 'all' ? total : visibleProducts.length,
              showSizeChanger: levelFilter === 'all',
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (count) => t('pages.inventoryAdmin.tableTotal', { count }),
              itemRender: paginationItemRender,
            }}
            onChange={(pagination) => {
              if (actionsDisabled) return;
              if (levelFilter !== 'all') return;
              const nextPage = Number(pagination.current || 1);
              const nextSize = Number(pagination.pageSize || pageSize);
              setPage(Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1);
              setPageSize(Number.isFinite(nextSize) && nextSize > 0 ? nextSize : INVENTORY_PAGE_SIZE);
            }}
          />
        </>
      ) : null}

      <ShopModal
        className="profile-mobile-safe-modal inventory-page__adjustModal"
        title={adjustTitle}
        open={Boolean(adjustTarget)}
        onOk={handleAdjust}
        confirmLoading={saving}
        onClose={closeAdjustModal}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: actionsDisabled, 'aria-label': saveAdjustLabel, title: saveAdjustLabel }}
        cancelButtonProps={{ 'aria-label': cancelAdjustLabel, title: cancelAdjustLabel }}
      >
        <Form form={form} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item
            name="mode"
            label={t('pages.inventoryAdmin.mode')}
            rules={[{ required: true }]}
          >
            <ShopSegmented
              block
              ariaLabel={`${adjustTitle} - ${t('pages.inventoryAdmin.mode')}`}
              title={`${adjustTitle} - ${t('pages.inventoryAdmin.mode')}`}
              options={[
                { value: 'set', label: t('pages.inventoryAdmin.modeSet') },
                { value: 'increase', label: t('pages.inventoryAdmin.modeIncrease') },
                { value: 'decrease', label: t('pages.inventoryAdmin.modeDecrease') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label={t('pages.inventoryAdmin.amount')}
            rules={[{ required: true, message: t('pages.inventoryAdmin.amountRequired') }]}
          >
            <ShopInputNumber
              min={0}
              precision={0}
              className="inventory-page__amountInput"
              aria-label={`${adjustTitle} - ${t('pages.inventoryAdmin.amount')}`}
              title={`${adjustTitle} - ${t('pages.inventoryAdmin.amount')}`}
            />
          </Form.Item>
          <div className="inventory-page__preview" role="status" aria-live="polite">
            <Text type="secondary">{t('pages.inventoryAdmin.currentStock')}</Text>
            <strong>{Math.max(0, Math.trunc(Number(adjustTarget?.stock ?? 0) || 0))}</strong>
            <Text type="secondary">{t('pages.inventoryAdmin.resultingStock')}</Text>
            <strong className="inventory-page__previewResult">{previewStock}</strong>
          </div>
          <Text type="secondary" className="inventory-page__auditHint">
            {t('pages.inventoryAdmin.auditHint')}
          </Text>
        </Form>
      </ShopModal>
    </div>
  );
};

export default InventoryManagement;
