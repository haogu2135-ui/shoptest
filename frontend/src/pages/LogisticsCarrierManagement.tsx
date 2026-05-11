import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { logisticsCarrierApi } from '../api';
import type { LogisticsCarrier } from '../types';

const { Title, Text } = Typography;

const LogisticsCarrierManagement: React.FC = () => {
  const [carriers, setCarriers] = useState<LogisticsCarrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<LogisticsCarrier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchCarriers = async () => {
    setLoading(true);
    try {
      const res = await logisticsCarrierApi.getAll(false);
      setCarriers(res.data || []);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Failed to load carriers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

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
      message.success('Saved');
      setModalOpen(false);
      setEditingCarrier(null);
      form.resetFields();
      fetchCarriers();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await logisticsCarrierApi.delete(id);
      message.success('Deleted');
      fetchCarriers();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div>
      <Title level={4}>快递公司配置</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary">配置 17TRACK carrier code，订单发货时选择后会默认按该快递公司查询。</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新增快递公司
          </Button>
        </Space>
      </Card>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={carriers}
        bordered
        columns={[
          { title: '名称', dataIndex: 'name', key: 'name' },
          { title: '17TRACK Code', dataIndex: 'trackingCode', key: 'trackingCode', width: 180 },
          {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status}</Tag>,
          },
          { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 100 },
          {
            title: '操作',
            key: 'actions',
            width: 180,
            render: (_: unknown, carrier: LogisticsCarrier) => (
              <Space>
                <Button size="small" onClick={() => openModal(carrier)}>编辑</Button>
                <Popconfirm title="删除这个快递公司？" onConfirm={() => handleDelete(carrier.id)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingCarrier ? '编辑快递公司' : '新增快递公司'}
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
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入快递公司名称' }]}>
            <Input placeholder="DHL Express" />
          </Form.Item>
          <Form.Item name="trackingCode" label="17TRACK Code" rules={[{ required: true, message: '请输入 17TRACK carrier code' }]}>
            <Input placeholder="100001" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'INACTIVE', label: '停用' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LogisticsCarrierManagement;
