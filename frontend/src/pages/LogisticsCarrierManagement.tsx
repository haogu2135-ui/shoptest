import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Progress, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, PlusOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi, logisticsCarrierApi } from '../api';
import type { LogisticsCarrier } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import {
  LOGISTICS_CARRIERS_DELETE_PERMISSION,
  LOGISTICS_CARRIERS_WRITE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import './LogisticsCarrierManagement.css';

const { Title, Text } = Typography;
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };

type LogisticsCarrierFormValues = Pick<LogisticsCarrier, 'name' | 'trackingCode' | 'status' | 'sortOrder'>;

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const LogisticsCarrierManagement: React.FC = () => {
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [editingCarrier, setEditingCarrier] = useState<LogisticsCarrier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm<LogisticsCarrierFormValues>();
  const { t, language } = useLanguage();
  const canWriteCarriers = hasAdminPermission(adminPermissions, currentRole, LOGISTICS_CARRIERS_WRITE_PERMISSION);
  const canDeleteCarriers = hasAdminPermission(adminPermissions, currentRole, LOGISTICS_CARRIERS_DELETE_PERMISSION);
  const formatCarrierStatus = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = rawStatus.toUpperCase();
    if (normalizedStatus === 'ACTIVE') return t('pages.logisticsCarriers.active');
    if (normalizedStatus === 'INACTIVE') return t('pages.logisticsCarriers.inactive');
    return rawStatus || '-';
  }, [t]);

  const carrierHealth = useMemo(() => {
    const active = carriers.filter((carrier) => carrier.status === 'ACTIVE').length;
    const inactive = carriers.length - active;
    const missingCodes = carriers.filter((carrier) => !carrier.trackingCode?.trim()).length;
    const duplicateCodeKeys = carriers.reduce<Record<string, number>>((acc, carrier) => {
      const key = carrier.trackingCode?.trim().toLowerCase();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const duplicateCodes = Object.values(duplicateCodeKeys).filter((count) => count > 1).length;
    const duplicateSortKeys = carriers.reduce<Record<string, number>>((acc, carrier) => {
      const key = String(carrier.sortOrder ?? 0);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const duplicateSortOrders = Object.values(duplicateSortKeys).filter((count) => count > 1).length;
    const ready = active > 0 && missingCodes === 0 && duplicateCodes === 0;
    const score = Math.max(0, 100 - inactive * 8 - missingCodes * 25 - duplicateCodes * 20 - duplicateSortOrders * 6);

    return {
      active,
      inactive,
      missingCodes,
      duplicateCodes,
      duplicateSortOrders,
      ready,
      score,
    };
  }, [carriers]);

  const getCarrierReadiness = (carrier: LogisticsCarrier) => {
    const signals = [
      carrier.name?.trim(),
      carrier.trackingCode?.trim(),
      carrier.status === 'ACTIVE',
      carrier.sortOrder !== undefined && carrier.sortOrder !== null,
    ];
    return signals.filter(Boolean).length;
  };

  const filteredCarriers = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return carriers.filter((carrier) => {
      if (statusFilter && carrier.status !== statusFilter) return false;
      if (!text) return true;
      return [carrier.name, carrier.trackingCode, carrier.status, carrier.sortOrder]
        .some((value) => String(value || '').toLowerCase().includes(text));
    });
  }, [carriers, keyword, statusFilter]);
  const carrierEditorLabel = editingCarrier?.name || editingCarrier?.trackingCode || t('pages.logisticsCarriers.addCarrier');
  const saveCarrierActionLabel = `${t('common.save')}: ${carrierEditorLabel}`;
  const cancelCarrierActionLabel = `${t('common.cancel')}: ${carrierEditorLabel}`;
  const activeCarrierStatusLabel = statusFilter ? formatCarrierStatus(statusFilter) : t('common.all');
  const carrierSearchInputLabel = `${t('common.search')}: ${t('pages.logisticsCarriers.title')}, ${keyword.trim() || t('common.all')}`;
  const carrierStatusFilterLabel = `${t('common.status')}: ${t('pages.logisticsCarriers.title')}, ${activeCarrierStatusLabel}`;
  const addCarrierActionLabel = `${t('pages.logisticsCarriers.addCarrier')}: ${t('pages.logisticsCarriers.title')}`;
  const carrierNameInputLabel = `${t('pages.logisticsCarriers.name')}: ${carrierEditorLabel}`;
  const carrierCodeInputLabel = `${t('pages.logisticsCarriers.trackingCode')}: ${carrierEditorLabel}`;
  const carrierModalStatusLabel = `${t('common.status')}: ${carrierEditorLabel}`;
  const carrierSortInputLabel = `${t('pages.logisticsCarriers.sortOrder')}: ${carrierEditorLabel}`;

  const fetchCarriers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logisticsCarrierApi.getAll(false);
      setCarriers(res.data || []);
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('pages.logisticsCarriers.fetchFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

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

  const openModal = (carrier?: LogisticsCarrier) => {
    if (!canWriteCarriers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setEditingCarrier(carrier || null);
    form.resetFields();
    form.setFieldsValue(carrier || { status: 'ACTIVE', sortOrder: 0 });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingCarrier(null);
    form.resetFields();
  };

  const handleSave = async () => {
    if (!canWriteCarriers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingCarrier) {
        await logisticsCarrierApi.update(editingCarrier.id, values);
      } else {
        await logisticsCarrierApi.create(values);
      }
      message.success(t('pages.logisticsCarriers.saved'));
      setModalOpen(false);
      setEditingCarrier(null);
      form.resetFields();
      fetchCarriers();
    } catch (err: unknown) {
      if (isFormValidationError(err)) return;
      message.error(getApiErrorMessage(err, t('pages.logisticsCarriers.saveFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDeleteCarriers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await logisticsCarrierApi.delete(id);
      message.success(t('pages.logisticsCarriers.deleted'));
      fetchCarriers();
    } catch (err: unknown) {
      message.error(getApiErrorMessage(err, t('pages.logisticsCarriers.deleteFailed'), language));
    }
  };

  return (
    <div className="logistics-carrier-page">
      <Title level={4}>{t('pages.logisticsCarriers.title')}</Title>
      <Card className="logistics-carrier-page__intro">
        <Space wrap>
          <Text type="secondary">{t('pages.logisticsCarriers.description')}</Text>
	          <Input
	            allowClear
	            prefix={<SearchOutlined />}
	            value={keyword}
	            onChange={(event) => setKeyword(event.target.value)}
	            placeholder={t('common.search')}
	            className="logistics-carrier-page__keywordInput"
	            aria-label={carrierSearchInputLabel}
	            title={carrierSearchInputLabel}
	          />
	          <Select
	            allowClear
	            value={statusFilter}
	            onChange={setStatusFilter}
	            placeholder={t('common.status')}
	            className="logistics-carrier-page__statusFilter"
	            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
	            getPopupContainer={() => document.body}
	            aria-label={carrierStatusFilterLabel}
	            title={carrierStatusFilterLabel}
	            options={[
	              { value: 'ACTIVE', label: t('pages.logisticsCarriers.active') },
	              { value: 'INACTIVE', label: t('pages.logisticsCarriers.inactive') },
	            ]}
	          />
	          {canWriteCarriers ? (
	            <Button type="primary" icon={<PlusOutlined />} aria-label={addCarrierActionLabel} title={addCarrierActionLabel} onClick={() => openModal()}>
	              {t('pages.logisticsCarriers.addCarrier')}
	            </Button>
          ) : null}
        </Space>
      </Card>
      <section className="logistics-carrier-page__health" aria-label={t('pages.logisticsCarriers.healthTitle')}>
        <div className="logistics-carrier-page__healthCopy">
          <Text className="logistics-carrier-page__eyebrow">{t('pages.logisticsCarriers.healthEyebrow')}</Text>
          <Title level={5}>{t('pages.logisticsCarriers.healthTitle')}</Title>
          <Text type="secondary">{t('pages.logisticsCarriers.healthSubtitle')}</Text>
        </div>
        <div className="logistics-carrier-page__score">
          <Progress
            type="circle"
            percent={carrierHealth.score}
            width={86}
            strokeColor={carrierHealth.ready ? '#2f855a' : '#d97706'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.logisticsCarriers.healthScore')}</Text>
        </div>
        <div className="logistics-carrier-page__healthGrid">
          <div className="logistics-carrier-page__healthItem is-ok">
            <CheckCircleOutlined />
            <strong>{carrierHealth.active}</strong>
            <span>{t('pages.logisticsCarriers.activeCarriers')}</span>
          </div>
          <div className={`logistics-carrier-page__healthItem ${carrierHealth.missingCodes ? 'is-risk' : 'is-ok'}`}>
            <WarningOutlined />
            <strong>{carrierHealth.missingCodes}</strong>
            <span>{t('pages.logisticsCarriers.missingCodes')}</span>
          </div>
          <div className={`logistics-carrier-page__healthItem ${carrierHealth.duplicateCodes ? 'is-risk' : 'is-ok'}`}>
            <WarningOutlined />
            <strong>{carrierHealth.duplicateCodes}</strong>
            <span>{t('pages.logisticsCarriers.duplicateCodes')}</span>
          </div>
          <div className={`logistics-carrier-page__healthItem ${carrierHealth.duplicateSortOrders ? 'is-risk' : 'is-ok'}`}>
            <WarningOutlined />
            <strong>{carrierHealth.duplicateSortOrders}</strong>
            <span>{t('pages.logisticsCarriers.sortConflicts')}</span>
          </div>
        </div>
      </section>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredCarriers}
        bordered
        scroll={{ x: 640 }}
        columns={[
          { title: t('pages.logisticsCarriers.name'), dataIndex: 'name', key: 'name' },
          { title: t('pages.logisticsCarriers.trackingCode'), dataIndex: 'trackingCode', key: 'trackingCode', width: 180 },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => (
              <Tag color={String(status || '').trim().toUpperCase() === 'ACTIVE' ? 'green' : 'default'}>
                {formatCarrierStatus(status)}
              </Tag>
            ),
          },
          {
            title: t('pages.logisticsCarriers.readiness'),
            key: 'readiness',
            width: 150,
            render: (_: unknown, carrier: LogisticsCarrier) => {
              const readySignals = getCarrierReadiness(carrier);
              return (
                <Tag color={readySignals >= 4 ? 'green' : readySignals >= 3 ? 'orange' : 'red'}>
                  {t('pages.logisticsCarriers.readySignals', { count: readySignals })}
                </Tag>
              );
            },
          },
          { title: t('pages.logisticsCarriers.sortOrder'), dataIndex: 'sortOrder', key: 'sortOrder', width: 100 },
          {
            title: t('common.actions'),
            key: 'actions',
            width: 180,
            render: (_: unknown, carrier: LogisticsCarrier) => {
              const carrierName = carrier.name || `#${carrier.id}`;
              const editActionLabel = `${t('common.edit')}: ${carrierName}`;
              const deleteActionLabel = `${t('common.delete')}: ${carrierName}`;
              return (
                <Space>
                  {canWriteCarriers ? <Button size="small" aria-label={editActionLabel} title={editActionLabel} onClick={() => openModal(carrier)}>{t('common.edit')}</Button> : null}
                  {canDeleteCarriers ? (
                    <Popconfirm
                      classNames={mobilePopconfirmClassNames}
                      title={t('pages.logisticsCarriers.deleteConfirm')}
                      description={carrierName}
                      onConfirm={() => handleDelete(carrier.id)}
                      okText={t('common.confirm')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                      cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                    >
                      <Button size="small" danger aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              );
            },
          },
        ]}
      />

      <Modal
        className="profile-mobile-safe-modal logistics-carrier-page__editorModal"
        title={editingCarrier ? t('pages.logisticsCarriers.editTitle') : t('pages.logisticsCarriers.addTitle')}
        open={modalOpen}
        onOk={handleSave}
        confirmLoading={saving}
        onCancel={closeModal}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': saveCarrierActionLabel, title: saveCarrierActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelCarrierActionLabel, title: cancelCarrierActionLabel }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
	          <Form.Item name="name" label={t('pages.logisticsCarriers.name')} rules={[{ required: true, message: t('pages.logisticsCarriers.nameRequired') }]}>
	            <Input placeholder="DHL Express" aria-label={carrierNameInputLabel} title={carrierNameInputLabel} />
	          </Form.Item>
	          <Form.Item name="trackingCode" label={t('pages.logisticsCarriers.trackingCode')} rules={[{ required: true, message: t('pages.logisticsCarriers.codeRequired') }]}>
	            <Input placeholder="100001" aria-label={carrierCodeInputLabel} title={carrierCodeInputLabel} />
	          </Form.Item>
	          <Form.Item name="status" label={t('common.status')} rules={[{ required: true }]}>
	            <Select
	              classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
	              getPopupContainer={() => document.body}
	              aria-label={carrierModalStatusLabel}
	              title={carrierModalStatusLabel}
	              options={[
	                { value: 'ACTIVE', label: t('pages.logisticsCarriers.active') },
	                { value: 'INACTIVE', label: t('pages.logisticsCarriers.inactive') },
	              ]}
	            />
	          </Form.Item>
	          <Form.Item name="sortOrder" label={t('pages.logisticsCarriers.sortOrder')}>
	            <InputNumber min={0} precision={0} className="logistics-carrier-page__sortInput" aria-label={carrierSortInputLabel} title={carrierSortInputLabel} />
	          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LogisticsCarrierManagement;
