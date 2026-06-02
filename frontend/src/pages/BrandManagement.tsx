import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, GlobalOutlined, PictureOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { Brand } from '../types';
import { useLanguage } from '../i18n';
import { imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { getApiErrorMessage } from '../utils/apiError';
import { BRANDS_DELETE_PERMISSION, BRANDS_WRITE_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './BrandManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const brandImageFallback = imageFallbacks.brand;
const resolveBrandImage = (imageUrl?: string) => resolveApiAssetUrl(imageUrl, brandImageFallback);

const statusColors: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
};

const BrandManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm();
  const { t, language } = useLanguage();
  const canWriteBrands = hasAdminPermission(adminPermissions, currentRole, BRANDS_WRITE_PERMISSION);
  const canDeleteBrands = hasAdminPermission(adminPermissions, currentRole, BRANDS_DELETE_PERMISSION);
  const formatBrandStatus = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = (rawStatus || 'ACTIVE').toUpperCase();
    if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'INACTIVE') {
      return t(`status.${normalizedStatus}`);
    }
    return rawStatus || '-';
  }, [t]);

  const brandHealth = useMemo(() => {
    const active = brands.filter((brand) => (brand.status || 'ACTIVE') === 'ACTIVE').length;
    const missingLogo = brands.filter((brand) => !brand.logoUrl?.trim()).length;
    const missingWebsite = brands.filter((brand) => !brand.websiteUrl?.trim()).length;
    const weakDescription = brands.filter((brand) => (brand.description?.trim().length || 0) < 24).length;
    const duplicateSortKeys = brands.reduce<Record<string, number>>((acc, brand) => {
      const key = String(brand.sortOrder ?? 0);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const sortConflicts = Object.values(duplicateSortKeys).filter((count) => count > 1).length;
    const score = Math.max(0, 100 - missingLogo * 18 - missingWebsite * 12 - weakDescription * 10 - sortConflicts * 8);

    return {
      active,
      missingLogo,
      missingWebsite,
      weakDescription,
      score,
    };
  }, [brands]);

  const getBrandReadiness = (brand: Brand) => [
    brand.name?.trim(),
    brand.logoUrl?.trim(),
    brand.websiteUrl?.trim(),
    (brand.description?.trim().length || 0) >= 24,
    (brand.status || 'ACTIVE') === 'ACTIVE',
  ].filter(Boolean).length;

  const filteredBrands = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return brands.filter((brand) => {
      const status = brand.status || 'ACTIVE';
      if (statusFilter && status !== statusFilter) return false;
      if (!text) return true;
      return [brand.name, brand.description, brand.logoUrl, brand.websiteUrl, status, brand.sortOrder]
        .some((value) => String(value || '').toLowerCase().includes(text));
    });
  }, [brands, keyword, statusFilter]);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getBrands();
      setBrands(response.data);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.brandAdmin.fetchFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  useEffect(() => {
    adminApi.getMyPermissions()
      .then((response) => {
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch(() => {
        setCurrentRole('');
        setAdminPermissions([]);
      });
  }, []);

  const openModal = (brand?: Brand) => {
    if (!canWriteBrands) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setEditingBrand(brand || null);
    setLogoPreviewUrl(brand?.logoUrl || '');
    form.resetFields();
    form.setFieldsValue({
      name: brand?.name,
      description: brand?.description,
      logoUrl: brand?.logoUrl,
      websiteUrl: brand?.websiteUrl,
      status: brand?.status || 'ACTIVE',
      sortOrder: brand?.sortOrder || 0,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!canWriteBrands) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        logoUrl: values.logoUrl?.trim() || null,
        websiteUrl: values.websiteUrl?.trim() || null,
        status: values.status || 'ACTIVE',
        sortOrder: values.sortOrder ?? 0,
      };
      if (editingBrand) {
        await adminApi.updateBrand(editingBrand.id, payload);
        message.success(t('pages.brandAdmin.updated'));
      } else {
        await adminApi.createBrand(payload);
        message.success(t('pages.brandAdmin.created'));
      }
      setModalVisible(false);
      setEditingBrand(null);
      setLogoPreviewUrl('');
      form.resetFields();
      fetchBrands();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, t('pages.brandAdmin.saveFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingBrand(null);
    setLogoPreviewUrl('');
    form.resetFields();
  };

  const handleDelete = async (id: number) => {
    if (!canDeleteBrands) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.deleteBrand(id);
      message.success(t('pages.brandAdmin.deleted'));
      fetchBrands();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.brandAdmin.deleteFailed'), language));
    }
  };

  const columns = [
    {
      title: t('pages.brandAdmin.logo'),
      dataIndex: 'logoUrl',
      key: 'logoUrl',
      width: 88,
      render: (url?: string, record?: Brand) =>
        url ? (
          <Image src={resolveBrandImage(url)} alt={record?.name || t('pages.brandAdmin.logo')} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} fallback={brandImageFallback} />
        ) : (
          <div className="brand-management-page__imagePlaceholder" />
        ),
    },
    {
      title: t('pages.brandAdmin.brand'),
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, record: Brand) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.websiteUrl ? <Text type="secondary" style={{ fontSize: 12 }}>{record.websiteUrl}</Text> : null}
        </Space>
      ),
    },
    {
      title: t('pages.brandAdmin.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status = 'ACTIVE') => {
        const normalizedStatus = String(status || 'ACTIVE').trim().toUpperCase();
        return <Tag color={statusColors[normalizedStatus] || 'default'}>{formatBrandStatus(status)}</Tag>;
      },
    },
    {
      title: t('pages.brandAdmin.readiness'),
      key: 'readiness',
      width: 140,
      render: (_: unknown, record: Brand) => {
        const readySignals = getBrandReadiness(record);
        return (
          <Tag color={readySignals >= 5 ? 'green' : readySignals >= 3 ? 'orange' : 'red'}>
            {t('pages.brandAdmin.readySignals', { count: readySignals })}
          </Tag>
        );
      },
    },
    {
      title: t('pages.brandAdmin.sortOrder'),
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 90,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 180,
      render: (_: unknown, record: Brand) => {
        const brandName = record.name || `#${record.id}`;
        const editActionLabel = `${t('common.edit')}: ${brandName}`;
        const deleteActionLabel = `${t('common.delete')}: ${brandName}`;
        return (
          <Space size="small">
            {canWriteBrands ? <Button icon={<EditOutlined />} size="small" aria-label={editActionLabel} title={editActionLabel} onClick={() => openModal(record)}>
              {t('common.edit')}
            </Button> : null}
            {canDeleteBrands ? (
              <Popconfirm title={t('pages.brandAdmin.deleteConfirm')} onConfirm={() => handleDelete(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                <Button icon={<DeleteOutlined />} danger size="small" aria-label={deleteActionLabel} title={deleteActionLabel}>
                  {t('common.delete')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <div className={`brand-management-page brand-management-page--${language}`}>
      <Title level={3} className="brand-management-page__title">{t('pages.brandAdmin.title')}</Title>
      <Divider />

      <Card className="brand-management-page__toolbar">
        <Space wrap>
          <Text type="secondary">{t('pages.brandAdmin.healthSubtitle')}</Text>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('common.search')}
            className="brand-management-page__keywordInput"
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={t('common.status')}
            className="brand-management-page__statusFilterSelect"
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
            options={[
              { value: 'ACTIVE', label: t('status.ACTIVE') },
              { value: 'INACTIVE', label: t('status.INACTIVE') },
            ]}
          />
          {canWriteBrands ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              {t('pages.brandAdmin.addBrand')}
            </Button>
          ) : null}
        </Space>
      </Card>

      <section className="brand-management-page__health" aria-label={t('pages.brandAdmin.healthTitle')}>
        <div className="brand-management-page__healthCopy">
          <Text className="brand-management-page__eyebrow">{t('pages.brandAdmin.healthEyebrow')}</Text>
          <Title level={5}>{t('pages.brandAdmin.healthTitle')}</Title>
          <Text type="secondary">{t('pages.brandAdmin.healthDescription')}</Text>
        </div>
        <div className="brand-management-page__score">
          <Progress
            type="circle"
            percent={brandHealth.score}
            width={86}
            strokeColor={brandHealth.score >= 80 ? '#2f855a' : brandHealth.score >= 60 ? '#d97706' : '#dc2626'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.brandAdmin.healthScore')}</Text>
        </div>
        <div className="brand-management-page__healthGrid">
          <div className="brand-management-page__healthItem is-ok">
            <CheckCircleOutlined />
            <strong>{brandHealth.active}</strong>
            <span>{t('pages.brandAdmin.activeBrands')}</span>
          </div>
          <div className={`brand-management-page__healthItem ${brandHealth.missingLogo ? 'is-risk' : 'is-ok'}`}>
            <PictureOutlined />
            <strong>{brandHealth.missingLogo}</strong>
            <span>{t('pages.brandAdmin.missingLogo')}</span>
          </div>
          <div className={`brand-management-page__healthItem ${brandHealth.missingWebsite ? 'is-risk' : 'is-ok'}`}>
            <GlobalOutlined />
            <strong>{brandHealth.missingWebsite}</strong>
            <span>{t('pages.brandAdmin.missingWebsite')}</span>
          </div>
          <div className={`brand-management-page__healthItem ${brandHealth.weakDescription ? 'is-risk' : 'is-ok'}`}>
            <EditOutlined />
            <strong>{brandHealth.weakDescription}</strong>
            <span>{t('pages.brandAdmin.weakDescription')}</span>
          </div>
        </div>
      </section>

      <Table columns={columns} dataSource={filteredBrands} rowKey="id" loading={loading} bordered size="middle" scroll={{ x: 860 }} />

      <Modal
        className="profile-mobile-safe-modal brand-management-page__editorModal"
        title={editingBrand ? t('pages.brandAdmin.editTitle') : t('pages.brandAdmin.addTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.brandAdmin.brandName')} rules={[{ required: true, message: t('pages.brandAdmin.nameRequired') }]}>
            <Input placeholder="PawPilot" />
          </Form.Item>

          <Form.Item name="logoUrl" label={t('pages.brandAdmin.logoUrl')}>
            <Input placeholder="https://..." onChange={(event) => setLogoPreviewUrl(event.target.value)} />
          </Form.Item>

          {logoPreviewUrl ? (
            <div className="brand-management-page__preview">
              <Image src={resolveBrandImage(logoPreviewUrl)} alt={editingBrand?.name || t('pages.brandAdmin.logo')} width={180} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} fallback={brandImageFallback} />
            </div>
          ) : null}

          <Form.Item name="websiteUrl" label={t('pages.brandAdmin.websiteUrl')}>
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="description" label={t('pages.brandAdmin.description')}>
            <TextArea rows={3} placeholder={t('pages.brandAdmin.descriptionPlaceholder')} />
          </Form.Item>

          <Space className="brand-management-page__formRow" align="start">
            <Form.Item name="status" label={t('common.status')} className="brand-management-page__statusField">
              <Select
                popupClassName="shop-mobile-popup-layer"
                getPopupContainer={() => document.body}
                options={[
                  { value: 'ACTIVE', label: t('status.ACTIVE') },
                  { value: 'INACTIVE', label: t('status.INACTIVE') },
                ]}
              />
            </Form.Item>
            <Form.Item name="sortOrder" label={t('pages.brandAdmin.sortOrder')}>
              <InputNumber min={0} precision={0} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default BrandManagement;
