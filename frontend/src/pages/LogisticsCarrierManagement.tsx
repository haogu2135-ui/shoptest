import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Progress, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { logisticsCarrierApi } from '../api';
import type { LogisticsCarrier } from '../types';
import { useLanguage } from '../i18n';
import './LogisticsCarrierManagement.css';

const { Title, Text } = Typography;

const LogisticsCarrierManagement: React.FC = () => {
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<LogisticsCarrier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { t } = useLanguage();

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

  const fetchCarriers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logisticsCarrierApi.getAll(false);
      setCarriers(res.data || []);
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.logisticsCarriers.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  const openModal = (carrier?: LogisticsCarrier) => {
    setEditingCarrier(carrier || null);
    form.setFieldsValue(carrier || { status: 'ACTIVE', sortOrder: 0 });
    setModalOpen(true);
  };

  const handleSave = async () => {
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
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || t('pages.logisticsCarriers.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await logisticsCarrierApi.delete(id);
      message.success(t('pages.logisticsCarriers.deleted'));
      fetchCarriers();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.logisticsCarriers.deleteFailed'));
    }
  };

  return (
    <div className="logistics-carrier-page">
      <Title level={4}>{t('pages.logisticsCarriers.title')}</Title>
      <Card className="logistics-carrier-page__intro">
        <Space wrap>
          <Text type="secondary">{t('pages.logisticsCarriers.description')}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            {t('pages.logisticsCarriers.addCarrier')}
          </Button>
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
        dataSource={carriers}
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
              <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                {status === 'ACTIVE' ? t('pages.logisticsCarriers.active') : t('pages.logisticsCarriers.inactive')}
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
            render: (_: unknown, carrier: LogisticsCarrier) => (
              <Space>
                <Button size="small" onClick={() => openModal(carrier)}>{t('common.edit')}</Button>
                <Popconfirm title={t('pages.logisticsCarriers.deleteConfirm')} onConfirm={() => handleDelete(carrier.id)}>
                  <Button size="small" danger>{t('common.delete')}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingCarrier ? t('pages.logisticsCarriers.editTitle') : t('pages.logisticsCarriers.addTitle')}
        open={modalOpen}
        onOk={handleSave}
        confirmLoading={saving}
        onCancel={() => {
          setModalOpen(false);
          setEditingCarrier(null);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.logisticsCarriers.name')} rules={[{ required: true, message: t('pages.logisticsCarriers.nameRequired') }]}>
            <Input placeholder="DHL Express" />
          </Form.Item>
          <Form.Item name="trackingCode" label={t('pages.logisticsCarriers.trackingCode')} rules={[{ required: true, message: t('pages.logisticsCarriers.codeRequired') }]}>
            <Input placeholder="100001" />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ACTIVE', label: t('pages.logisticsCarriers.active') },
                { value: 'INACTIVE', label: t('pages.logisticsCarriers.inactive') },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label={t('pages.logisticsCarriers.sortOrder')}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LogisticsCarrierManagement;
