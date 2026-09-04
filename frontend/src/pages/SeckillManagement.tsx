import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { ClockCircleOutlined, EditOutlined, FireOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { createApiAbortController } from '../api';
import { adminApi } from '../api/admin';
import type { Product, SeckillCampaign, SeckillCampaignWritePayload, SeckillItemWritePayload } from '../types';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopCard from '../components/ShopCard';
import ShopDatePicker from '../components/ShopDatePicker';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopInputNumber from '../components/ShopInputNumber';
import ShopModal from '../components/ShopModal';
import ShopSelect from '../components/ShopSelect';
import ShopSpace from '../components/ShopSpace';
import ShopSpin from '../components/ShopSpin';
import ShopTag from '../components/ShopTag';
import ShopTypography from '../components/ShopTypography';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import message from '../components/ShopMessage';
import './SeckillManagement.css';

const Title = ShopTypography.Title;
const Text = ShopTypography.Text;

type CampaignFormValues = {
  title: string;
  subtitle?: string;
  bannerUrl?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED';
  startAt: Dayjs | null;
  endAt: Dayjs | null;
};

type ItemDraft = SeckillItemWritePayload & { id: string };

const emptyItem = (): ItemDraft => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  productId: 0,
  seckillPrice: 0,
  quota: 1,
  limitPerUser: 1,
});

const parseDate = (value?: string) => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

const normalizeDate = (value?: Dayjs | null) => value?.isValid() ? value.format('YYYY-MM-DDTHH:mm:ss') : '';

const isValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const SeckillManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [form] = Form.useForm<CampaignFormValues>();
  const [campaigns, setCampaigns] = useState<SeckillCampaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SeckillCampaign | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const dataAbortRef = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const statusUpdatingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!mountedRef.current) return;
    dataAbortRef.current?.abort();
    const abortController = createApiAbortController();
    dataAbortRef.current = abortController;
    const isCurrentRequest = () => mountedRef.current
      && dataAbortRef.current === abortController
      && !abortController.signal.aborted;
    setLoading(true);
    setProductsLoading(true);
    try {
      const [campaignResponse, productResponse] = await Promise.all([
        adminApi.getSeckillCampaigns({ signal: abortController.signal }),
        adminApi.getProducts({ page: 1, size: 500 }, { signal: abortController.signal }),
      ]);
      if (!isCurrentRequest()) return;
      setCampaigns(Array.isArray(campaignResponse.data) ? campaignResponse.data : []);
      setProducts(productResponse.data.items || []);
      setError('');
    } catch (requestError: unknown) {
      if (!isCurrentRequest()) return;
      setError(getApiErrorMessage(requestError, t('pages.adminSeckill.loadFailed'), language));
    } finally {
      const shouldUpdateLoading = isCurrentRequest();
      if (dataAbortRef.current === abortController) dataAbortRef.current = null;
      if (shouldUpdateLoading) {
        setLoading(false);
        setProductsLoading(false);
      }
    }
  }, [language, t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      dataAbortRef.current?.abort();
      dataAbortRef.current = null;
      savingRef.current = false;
      statusUpdatingRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const productOptions = useMemo(
    () => products.map((product) => ({
      value: String(product.id),
      label: `${product.name} · ${product.price.toFixed(2)}`,
      disabled: product.status != null && product.status.toUpperCase() !== 'ACTIVE',
    })),
    [products],
  );
  const liveCount = campaigns.filter((campaign) => campaign.state === 'ONGOING').length;
  const scheduledCount = campaigns.filter((campaign) => campaign.state === 'UPCOMING').length;
  const soldUnits = campaigns.reduce((total, campaign) => total + campaign.items.reduce((sum, item) => sum + item.sold, 0), 0);

  const statusLabel = (campaign: SeckillCampaign) => {
    if (campaign.state === 'ONGOING') return t('pages.adminSeckill.ongoing');
    if (campaign.state === 'UPCOMING') return t('pages.adminSeckill.upcoming');
    if (campaign.state === 'ENDED') return t('pages.adminSeckill.ended');
    if (campaign.status === 'PAUSED') return t('pages.adminSeckill.paused');
    if (campaign.status === 'PUBLISHED') return t('pages.adminSeckill.published');
    return t('pages.adminSeckill.draft');
  };

  const statusColor = (campaign: SeckillCampaign) => {
    if (campaign.state === 'ONGOING') return 'success';
    if (campaign.state === 'UPCOMING') return 'warning';
    if (campaign.status === 'PUBLISHED') return 'processing';
    return 'default';
  };

  const openEditor = (campaign?: SeckillCampaign) => {
    setEditing(campaign || null);
    form.setFieldsValue({
      title: campaign?.title || '',
      subtitle: campaign?.subtitle || '',
      bannerUrl: campaign?.bannerUrl || '',
      status: (campaign?.status as CampaignFormValues['status']) || 'DRAFT',
      startAt: parseDate(campaign?.startAt) || dayjs().add(1, 'hour'),
      endAt: parseDate(campaign?.endAt) || dayjs().add(1, 'day'),
    });
    setItems(campaign?.items.map((item) => ({
      id: `existing-${item.id}`,
      productId: item.productId,
      seckillPrice: Number(item.seckillPrice),
      quota: item.quota,
      limitPerUser: item.limitPerUser,
    })) || [emptyItem()]);
    setModalOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setItems([]);
    form.resetFields();
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const validateItems = () => {
    if (items.length === 0) return t('pages.adminSeckill.itemRequired');
    const productIds = new Set<number>();
    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) return t('pages.adminSeckill.productRequired');
      if (product.status && product.status.toUpperCase() !== 'ACTIVE') return t('pages.adminSeckill.productInactive');
      if (productIds.has(item.productId)) return t('pages.adminSeckill.productDuplicate');
      productIds.add(item.productId);
      if (!Number.isFinite(item.seckillPrice) || item.seckillPrice <= 0) return t('pages.adminSeckill.priceRequired');
      if (item.seckillPrice > product.price) return t('pages.adminSeckill.priceTooHigh');
      if (!Number.isInteger(item.quota) || item.quota < 1) return t('pages.adminSeckill.quotaRequired');
      if (!Number.isInteger(item.limitPerUser) || item.limitPerUser < 1) return t('pages.adminSeckill.limitRequired');
    }
    return '';
  };

  const handleSave = async () => {
    if (!mountedRef.current || savingRef.current || statusUpdatingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const values = await form.validateFields();
      if (!mountedRef.current) return;
      const itemError = validateItems();
      if (!values.startAt || !values.endAt || !values.endAt.isAfter(values.startAt)) {
        message.error(t('pages.adminSeckill.timeInvalid'));
        return;
      }
      if (itemError) {
        message.error(itemError);
        return;
      }
      const payload: SeckillCampaignWritePayload = {
        title: values.title.trim(),
        subtitle: values.subtitle?.trim() || undefined,
        bannerUrl: values.bannerUrl?.trim() || undefined,
        status: values.status,
        startAt: normalizeDate(values.startAt),
        endAt: normalizeDate(values.endAt),
        items: items.map(({ id: _id, ...item }) => item),
      };
      if (!mountedRef.current) return;
      if (editing?.id) {
        await adminApi.updateSeckillCampaign(editing.id, payload);
      } else {
        await adminApi.createSeckillCampaign(payload);
      }
      if (!mountedRef.current) return;
      message.success(t('pages.adminSeckill.saved'));
      closeEditor();
      if (mountedRef.current) await loadData();
    } catch (requestError) {
      if (!mountedRef.current) return;
      if (!isValidationError(requestError)) {
        message.error(getApiErrorMessage(requestError, t('pages.adminSeckill.saveFailed'), language));
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const updateStatus = async (campaign: SeckillCampaign, status: CampaignFormValues['status']) => {
    if (!mountedRef.current || !campaign.id || savingRef.current || statusUpdatingRef.current) return;
    statusUpdatingRef.current = true;
    setStatusUpdatingId(campaign.id);
    try {
      await adminApi.updateSeckillStatus(campaign.id, status);
      if (!mountedRef.current) return;
      message.success(t('pages.adminSeckill.statusUpdated'));
      if (mountedRef.current) await loadData();
    } catch (requestError) {
      if (!mountedRef.current) return;
      message.error(getApiErrorMessage(requestError, t('pages.adminSeckill.statusFailed'), language));
    } finally {
      statusUpdatingRef.current = false;
      if (mountedRef.current) setStatusUpdatingId(null);
    }
  };

  const formatWindow = (value?: string) => value ? new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : '-';
  const actionLabel = (action: string, campaign: SeckillCampaign) => `${action}: ${campaign.title}`;

  return (
    <div className="admin-seckill">
      <section className="admin-seckill__hero">
        <div>
          <Text className="admin-seckill__eyebrow"><ThunderboltOutlined /> {t('pages.adminSeckill.eyebrow')}</Text>
          <Title level={2}>{t('pages.adminSeckill.title')}</Title>
          <Text type="secondary">{t('pages.adminSeckill.description')}</Text>
        </div>
        <ShopButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor()} aria-label={t('pages.adminSeckill.add')} title={t('pages.adminSeckill.add')}>
          {t('pages.adminSeckill.add')}
        </ShopButton>
      </section>

      <section className="admin-seckill__stats" aria-label={t('pages.adminSeckill.statsLabel')}>
        <div><FireOutlined /><strong>{liveCount}</strong><span>{t('pages.adminSeckill.live')}</span></div>
        <div><ClockCircleOutlined /><strong>{scheduledCount}</strong><span>{t('pages.adminSeckill.scheduled')}</span></div>
        <div><ThunderboltOutlined /><strong>{soldUnits}</strong><span>{t('pages.adminSeckill.soldUnits')}</span></div>
      </section>

      {error ? <ShopAlert type="warning" showIcon message={error} action={<ShopButton size="small" onClick={() => { void loadData(); }}>{t('common.retry')}</ShopButton>} /> : null}
      {loading ? (
        <div className="admin-seckill__loading"><ShopSpin size="large" tip={t('common.loading')} /></div>
      ) : campaigns.length === 0 ? (
        <ShopCard className="admin-seckill__empty">
          <ThunderboltOutlined />
          <Title level={4}>{t('pages.adminSeckill.emptyTitle')}</Title>
          <Text type="secondary">{t('pages.adminSeckill.emptyText')}</Text>
        </ShopCard>
      ) : (
        <div className="admin-seckill__list">
          {campaigns.map((campaign) => (
            <ShopCard key={campaign.id} className="admin-seckill__campaign">
              <div className="admin-seckill__campaignHeader">
                <div>
                  <ShopTag color={statusColor(campaign)} icon={campaign.state === 'ONGOING' ? <FireOutlined /> : <ClockCircleOutlined />}>{statusLabel(campaign)}</ShopTag>
                  <Title level={4}>{campaign.title}</Title>
                  {campaign.subtitle ? <Text type="secondary">{campaign.subtitle}</Text> : null}
                </div>
                <div className="admin-seckill__window">
                  <span>{t('pages.adminSeckill.startAt')}</span><strong>{formatWindow(campaign.startAt)}</strong>
                  <span>{t('pages.adminSeckill.endAt')}</span><strong>{formatWindow(campaign.endAt)}</strong>
                </div>
              </div>
              <div className="admin-seckill__items">
                {campaign.items.map((item) => {
                  const soldPercent = item.quota > 0 ? Math.min(100, Math.round((item.sold / item.quota) * 100)) : 0;
                  return (
                    <article className="admin-seckill__item" key={item.id}>
                      <div className="admin-seckill__itemMedia">
                        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <ThunderboltOutlined />}
                      </div>
                      <div className="admin-seckill__itemBody">
                        <strong>{item.productName || `${t('pages.adminSeckill.product')} #${item.productId}`}</strong>
                        <span className="admin-seckill__price">{item.seckillPrice.toFixed(2)} <del>{item.originalPrice ? item.originalPrice.toFixed(2) : ''}</del></span>
                        <div className="admin-seckill__progress"><span style={{ width: `${soldPercent}%` }} /></div>
                        <span className="admin-seckill__itemMeta">{t('pages.adminSeckill.soldAndQuota', { sold: item.sold, quota: item.quota })} · {t('pages.adminSeckill.perUser', { count: item.limitPerUser })}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
              <ShopSpace className="admin-seckill__actions" wrap>
                <ShopButton size="small" icon={<EditOutlined />} onClick={() => openEditor(campaign)} aria-label={actionLabel(t('common.edit'), campaign)} title={actionLabel(t('common.edit'), campaign)}>{t('common.edit')}</ShopButton>
                {campaign.status === 'PUBLISHED' ? (
                  <ShopButton size="small" loading={statusUpdatingId === campaign.id} onClick={() => { void updateStatus(campaign, 'PAUSED'); }} aria-label={actionLabel(t('pages.adminSeckill.pause'), campaign)} title={actionLabel(t('pages.adminSeckill.pause'), campaign)}>{t('pages.adminSeckill.pause')}</ShopButton>
                ) : (
                  <ShopButton type="primary" size="small" loading={statusUpdatingId === campaign.id} onClick={() => { void updateStatus(campaign, 'PUBLISHED'); }} aria-label={actionLabel(t('pages.adminSeckill.publish'), campaign)} title={actionLabel(t('pages.adminSeckill.publish'), campaign)}>{t('pages.adminSeckill.publish')}</ShopButton>
                )}
              </ShopSpace>
            </ShopCard>
          ))}
        </div>
      )}

      <ShopModal
        open={modalOpen}
        onClose={closeEditor}
        title={editing ? t('pages.adminSeckill.editTitle') : t('pages.adminSeckill.addTitle')}
        onOk={() => { void handleSave(); }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        width={780}
        className="admin-seckill__editor"
        rootClassName="admin-seckill__modal"
        okButtonProps={{ 'aria-label': t('common.save'), title: t('common.save') }}
        cancelButtonProps={{ 'aria-label': t('common.cancel'), title: t('common.cancel') }}
      >
        <Form form={form} layout="vertical">
          <div className="admin-seckill__formGrid">
            <Form.Item name="title" label={t('pages.adminSeckill.titleField')} rules={[{ required: true, message: t('pages.adminSeckill.titleRequired') }, { max: 160, message: t('pages.adminSeckill.titleTooLong') }]}>
              <ShopInput maxLength={160} showCount aria-label={t('pages.adminSeckill.titleField')} />
            </Form.Item>
            <Form.Item name="status" label={t('common.status')} rules={[{ required: true }]}>
              <ShopSelect options={[
                { value: 'DRAFT', label: t('pages.adminSeckill.draft') },
                { value: 'PUBLISHED', label: t('pages.adminSeckill.published') },
                { value: 'PAUSED', label: t('pages.adminSeckill.paused') },
              ]} popupClassName="shop-mobile-popup-layer" ariaLabel={t('common.status')} />
            </Form.Item>
          </div>
          <Form.Item name="subtitle" label={t('pages.adminSeckill.subtitle')}>
            <ShopTextArea rows={2} maxLength={500} showCount aria-label={t('pages.adminSeckill.subtitle')} />
          </Form.Item>
          <Form.Item name="bannerUrl" label={t('pages.adminSeckill.bannerUrl')}>
            <ShopInput maxLength={2000} aria-label={t('pages.adminSeckill.bannerUrl')} />
          </Form.Item>
          <div className="admin-seckill__formGrid">
            <Form.Item name="startAt" label={t('pages.adminSeckill.startAt')} rules={[{ required: true, message: t('pages.adminSeckill.startRequired') }]}>
              <ShopDatePicker showTime ariaLabel={t('pages.adminSeckill.startAt')} />
            </Form.Item>
            <Form.Item name="endAt" label={t('pages.adminSeckill.endAt')} rules={[{ required: true, message: t('pages.adminSeckill.endRequired') }]}>
              <ShopDatePicker showTime ariaLabel={t('pages.adminSeckill.endAt')} />
            </Form.Item>
          </div>

          <div className="admin-seckill__itemsHeader">
            <div><strong>{t('pages.adminSeckill.items')}</strong><Text type="secondary">{t('pages.adminSeckill.itemsHint')}</Text></div>
            <ShopButton size="small" icon={<PlusOutlined />} onClick={() => setItems((current) => [...current, emptyItem()])}>{t('pages.adminSeckill.addItem')}</ShopButton>
          </div>
          {productsLoading ? <ShopSpin tip={t('pages.adminSeckill.loadingProducts')} /> : null}
          <div className="admin-seckill__draftItems">
            {items.map((item, index) => {
              const product = productById.get(item.productId);
              return (
                <div className="admin-seckill__draftItem" key={item.id}>
                  <ShopSelect
                    value={item.productId ? String(item.productId) : undefined}
                    options={productOptions}
                    onChange={(value) => updateItem(index, { productId: Number(value) || 0 })}
                    showSearch
                    searchPlaceholder={t('common.search')}
                    popupClassName="shop-mobile-popup-layer"
                    loading={productsLoading}
                    placeholder={t('pages.adminSeckill.chooseProduct')}
                    ariaLabel={t('pages.adminSeckill.chooseProduct')}
                  />
                  <div className="admin-seckill__draftNumbers">
                    <label>{t('pages.adminSeckill.price')}<ShopInputNumber value={item.seckillPrice} min={0.01} precision={2} onChange={(value) => updateItem(index, { seckillPrice: value || 0 })} aria-label={t('pages.adminSeckill.price')} /></label>
                    <label>{t('pages.adminSeckill.quota')}<ShopInputNumber value={item.quota} min={1} precision={0} onChange={(value) => updateItem(index, { quota: value || 0 })} aria-label={t('pages.adminSeckill.quota')} /></label>
                    <label>{t('pages.adminSeckill.limit')}<ShopInputNumber value={item.limitPerUser} min={1} precision={0} onChange={(value) => updateItem(index, { limitPerUser: value || 0 })} aria-label={t('pages.adminSeckill.limit')} /></label>
                  </div>
                  <div className="admin-seckill__draftItemFooter">
                    <Text type="secondary">{product ? `${product.name} · ${t('pages.adminSeckill.stock')}: ${product.stock}` : t('pages.adminSeckill.productRequired')}</Text>
                    <ShopButton type="text" danger disabled={items.length <= 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={t('pages.adminSeckill.removeItem')} title={t('pages.adminSeckill.removeItem')}>{t('pages.adminSeckill.removeItem')}</ShopButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Form>
      </ShopModal>
    </div>
  );
};

export default SeckillManagement;
