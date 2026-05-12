import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
      <Table
        rowKey="id"
        loading={loading}
        dataSource={carriers}
        bordered
        scroll={{ x: 640 }}
        columns={[
          { title: t('pages.logisticsCarriers.name'), dataIndex: 'name', key: 'name' },
          { title: '17TRACK Code', dataIndex: 'trackingCode', key: 'trackingCode', width: 180 },
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
          <Form.Item name="trackingCode" label="17TRACK Code" rules={[{ required: true, message: t('pages.logisticsCarriers.codeRequired') }]}>
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
