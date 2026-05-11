import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { brandApi } from '../api';
import type { Brand } from '../types';
import { useLanguage } from '../i18n';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusColors: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
};

const BrandManagement: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [form] = Form.useForm();
  const { t } = useLanguage();

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const response = await brandApi.getAll();
      setBrands(response.data);
    } catch {
      message.error(t('pages.brandAdmin.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const openModal = (brand?: Brand) => {
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
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        logoUrl: values.logoUrl?.trim() || null,
        websiteUrl: values.websiteUrl?.trim() || null,
        status: values.status || 'ACTIVE',
        sortOrder: values.sortOrder ?? 0,
      };
      if (editingBrand) {
        await brandApi.update(editingBrand.id, payload);
        message.success(t('pages.brandAdmin.updated'));
      } else {
        await brandApi.create(payload);
        message.success(t('pages.brandAdmin.created'));
      }
      setModalVisible(false);
      fetchBrands();
    } catch (error: any) {
      const detail = error?.response?.data?.error;
      message.error(detail || t('pages.brandAdmin.saveFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await brandApi.delete(id);
      message.success(t('pages.brandAdmin.deleted'));
      fetchBrands();
    } catch {
      message.error(t('pages.brandAdmin.deleteFailed'));
    }
  };

  const columns = [
    {
      title: t('pages.brandAdmin.logo'),
      dataIndex: 'logoUrl',
      key: 'logoUrl',
      width: 88,
      render: (url?: string) =>
        url ? (
          <Image src={url} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 6, background: '#f2f3f5' }} />
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
      render: (status = 'ACTIVE') => <Tag color={statusColors[status]}>{t(`status.${status}`)}</Tag>,
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
      render: (_: unknown, record: Brand) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => openModal(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm title={t('pages.brandAdmin.deleteConfirm')} onConfirm={() => handleDelete(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
            <Button icon={<DeleteOutlined />} danger size="small">
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 24px' }}>
      <Title level={3} style={{ marginBottom: 0 }}>{t('pages.brandAdmin.title')}</Title>
      <Divider />

      <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ marginBottom: 16 }}>
        {t('pages.brandAdmin.addBrand')}
      </Button>

      <Table columns={columns} dataSource={brands} rowKey="id" loading={loading} bordered size="middle" />

      <Modal
        title={editingBrand ? t('pages.brandAdmin.editTitle') : t('pages.brandAdmin.addTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.brandAdmin.brandName')} rules={[{ required: true, message: t('pages.brandAdmin.nameRequired') }]}>
            <Input placeholder="PawPilot" />
          </Form.Item>

          <Form.Item name="logoUrl" label={t('pages.brandAdmin.logoUrl')}>
            <Input placeholder="https://..." onChange={(event) => setLogoPreviewUrl(event.target.value)} />
          </Form.Item>

          {logoPreviewUrl ? (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <Image src={logoPreviewUrl} width={180} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} />
            </div>
          ) : null}

          <Form.Item name="websiteUrl" label={t('pages.brandAdmin.websiteUrl')}>
            <Input placeholder="https://brand.example.com" />
          </Form.Item>

          <Form.Item name="description" label={t('pages.brandAdmin.description')}>
            <TextArea rows={3} placeholder={t('pages.brandAdmin.descriptionPlaceholder')} />
          </Form.Item>

          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="status" label={t('common.status')} style={{ minWidth: 180 }}>
              <Select
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
