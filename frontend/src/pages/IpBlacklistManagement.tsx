import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { IpBlacklistEntry, IpBlacklistStatus } from '../types';
import './IpBlacklistManagement.css';

const { Text, Title } = Typography;

const statusColor = (status: string) => {
  if (status === 'BLOCKED') return 'red';
  if (status === 'MONITORING') return 'gold';
  return 'green';
};

const sourceColor = (source: string) => {
  if (source === 'LOGIN') return 'blue';
  if (source === 'PAYMENT') return 'volcano';
  return 'purple';
};

const formatTime = (value?: string) => value ? new Date(value).toLocaleString() : '-';

const IpBlacklistManagement: React.FC = () => {
  const [entries, setEntries] = useState<IpBlacklistEntry[]>([]);
  const [statusInfo, setStatusInfo] = useState<IpBlacklistStatus | null>(null);
  const [status, setStatus] = useState('BLOCKED');
  const [source, setSource] = useState('ALL');
  const [ipAddress, setIpAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listResponse, statusResponse] = await Promise.all([
        adminApi.getIpBlacklist({
          status: status === 'ALL' ? undefined : status,
          source: source === 'ALL' ? undefined : source,
          ipAddress: ipAddress.trim() || undefined,
          limit: 300,
        }),
        adminApi.getIpBlacklistStatus(),
      ]);
      setEntries(listResponse.data);
      setStatusInfo(statusResponse.data);
    } catch {
      message.error('IP黑名单加载失败');
    } finally {
      setLoading(false);
    }
  }, [ipAddress, source, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const blockIp = async () => {
    const values = await form.validateFields();
    try {
      await adminApi.blockIpAddress(values);
      message.success('IP已加入黑名单');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('加入黑名单失败');
    }
  };

  const releaseEntry = useCallback(async (entry: IpBlacklistEntry) => {
    setActing(entry.id);
    try {
      await adminApi.releaseIpBlacklistEntry(entry.id);
      message.success('已解除黑名单');
      loadData();
    } catch {
      message.error('解除失败');
    } finally {
      setActing(null);
    }
  }, [loadData]);

  const columns: ColumnsType<IpBlacklistEntry> = useMemo(() => [
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (value: string) => <Tag color={sourceColor(value)}>{value}</Tag>,
    },
    {
      title: '失败次数',
      dataIndex: 'failureCount',
      key: 'failureCount',
      width: 100,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (value?: string) => value || '-',
    },
    {
      title: '封禁至',
      dataIndex: 'blockedUntil',
      key: 'blockedUntil',
      width: 190,
      render: formatTime,
    },
    {
      title: '最近出现',
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      width: 190,
      render: formatTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => record.status !== 'RELEASED' ? (
        <Button size="small" icon={<UnlockOutlined />} loading={acting === record.id} onClick={() => releaseEntry(record)}>
          解除
        </Button>
      ) : null,
    },
  ], [acting, releaseEntry]);

  return (
    <div className="ip-blacklist">
      <div className="ip-blacklist__hero">
        <div>
          <Text className="ip-blacklist__eyebrow">IP Defense</Text>
          <Title level={2}>IP黑名单</Title>
          <Text type="secondary">对多次登录失败或支付失败的来源 IP 自动封禁，并支持人工维护。</Text>
        </div>
        <Space className="ip-blacklist__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            手动拉黑
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && entries.length === 0}>
        <div className="ip-blacklist__stats">
          <Card>
            <Statistic title="功能状态" value={statusInfo?.enabled ? 'ON' : 'OFF'} prefix={<StopOutlined />} />
          </Card>
          <Card>
            <Statistic title="封禁中" value={statusInfo?.blockedCount || 0} valueStyle={{ color: (statusInfo?.blockedCount || 0) > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card>
            <Statistic title="观察中" value={statusInfo?.monitoringCount || 0} />
          </Card>
          <Card>
            <Statistic title="登录/支付阈值" value={`${statusInfo?.loginFailureThreshold || '-'} / ${statusInfo?.paymentFailureThreshold || '-'}`} />
          </Card>
        </div>

        <Card className="ip-blacklist__card">
          <Space className="ip-blacklist__filters" wrap>
            <Select
              value={status}
              onChange={setStatus}
              options={['BLOCKED', 'MONITORING', 'RELEASED', 'ALL'].map((value) => ({ value, label: value }))}
            />
            <Select
              value={source}
              onChange={setSource}
              options={['ALL', 'LOGIN', 'PAYMENT', 'MANUAL'].map((value) => ({ value, label: value }))}
            />
            <Input
              allowClear
              value={ipAddress}
              onChange={(event) => setIpAddress(event.target.value)}
              onPressEnter={loadData}
              placeholder="IP地址"
            />
            <Button onClick={loadData}>筛选</Button>
          </Space>

          <Table<IpBlacklistEntry>
            rowKey="id"
            columns={columns}
            dataSource={entries}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1100 }}
          />
        </Card>
      </Spin>

      <Modal
        title="手动拉黑IP"
        open={modalOpen}
        onOk={blockIp}
        onCancel={() => setModalOpen(false)}
        okText="拉黑"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ blockMinutes: statusInfo?.blockMinutes || 60 }}>
          <Form.Item name="ipAddress" label="IP地址" rules={[{ required: true, message: '请输入IP地址' }]}>
            <Input placeholder="例如 203.0.113.10" />
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item name="blockMinutes" label="封禁分钟数">
            <InputNumber min={1} max={43200} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IpBlacklistManagement;
