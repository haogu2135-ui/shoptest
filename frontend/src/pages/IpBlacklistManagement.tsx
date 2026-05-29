import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { IpBlacklistEntry, IpBlacklistStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
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

const IpBlacklistManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [entries, setEntries] = useState<IpBlacklistEntry[]>([]);
  const [statusInfo, setStatusInfo] = useState<IpBlacklistStatus | null>(null);
  const [status, setStatus] = useState('BLOCKED');
  const [source, setSource] = useState('ALL');
  const [ipAddress, setIpAddress] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [batchActing, setBatchActing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const formatTime = useCallback((value?: string) => value ? new Date(value).toLocaleString(dateLocale) : '-', [dateLocale]);

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
      setSelectedEntryIds((ids) => ids.filter((id) => listResponse.data.some((entry) => entry.id === id)));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [ipAddress, language, source, status, t]);

  useEffect(() => {
    loadData();
  }, [language, loadData, t]);

  const blockIp = async () => {
    try {
      const values = await form.validateFields();
      setBlocking(true);
      await adminApi.blockIpAddress(values);
      message.success(t('pages.ipBlacklistAdmin.blocked'));
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.blockFailed'), language));
    } finally {
      setBlocking(false);
    }
  };

  const openBlockModal = () => {
    form.resetFields();
    form.setFieldsValue({ blockMinutes: statusInfo?.blockMinutes || 60 });
    setModalOpen(true);
  };

  const closeBlockModal = () => {
    if (blocking) return;
    setModalOpen(false);
    form.resetFields();
  };

  const releaseEntry = useCallback(async (entry: IpBlacklistEntry) => {
    setActing(entry.id);
    try {
      await adminApi.releaseIpBlacklistEntry(entry.id);
      message.success(t('pages.ipBlacklistAdmin.released'));
      loadData();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.releaseFailed'), language));
    } finally {
      setActing(null);
    }
  }, [loadData]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.includes(entry.id)),
    [entries, selectedEntryIds]
  );

  const selectedReleasableIds = useMemo(
    () => selectedEntries.filter((entry) => entry.status !== 'RELEASED').map((entry) => entry.id),
    [selectedEntries]
  );

  const releaseSelectedEntries = async () => {
    if (!selectedReleasableIds.length) {
      message.warning(t('pages.ipBlacklistAdmin.selectReleasableFirst'));
      return;
    }
    setBatchActing(true);
    try {
      const response = await adminApi.releaseIpBlacklistEntries(selectedReleasableIds, 'Batch released from IP blacklist center');
      message.success(t('pages.ipBlacklistAdmin.batchReleaseDone', { count: response.data.releasedCount }));
      setSelectedEntryIds([]);
      await loadData();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.batchReleaseFailed'), language));
    } finally {
      setBatchActing(false);
    }
  };

  const columns: ColumnsType<IpBlacklistEntry> = useMemo(() => [
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      title: t('pages.ipBlacklistAdmin.source'),
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (value: string) => <Tag color={sourceColor(value)}>{value}</Tag>,
    },
    {
      title: t('pages.ipBlacklistAdmin.failureCount'),
      dataIndex: 'failureCount',
      key: 'failureCount',
      width: 100,
    },
    {
      title: t('pages.ipBlacklistAdmin.reason'),
      dataIndex: 'reason',
      key: 'reason',
      render: (value?: string) => value || '-',
    },
    {
      title: t('pages.ipBlacklistAdmin.blockedUntil'),
      dataIndex: 'blockedUntil',
      key: 'blockedUntil',
      width: 190,
      render: formatTime,
    },
    {
      title: t('pages.ipBlacklistAdmin.lastSeen'),
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      width: 190,
      render: formatTime,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record) => record.status !== 'RELEASED' ? (
        <Button size="small" icon={<UnlockOutlined />} loading={acting === record.id} onClick={() => releaseEntry(record)}>
          {t('pages.ipBlacklistAdmin.release')}
        </Button>
      ) : null,
    },
  ], [acting, formatTime, releaseEntry, t]);

  return (
    <div className="ip-blacklist">
      <div className="ip-blacklist__hero">
        <div>
          <Text className="ip-blacklist__eyebrow">IP Defense</Text>
          <Title level={2}>{t('pages.ipBlacklistAdmin.title')}</Title>
          <Text type="secondary">{t('pages.ipBlacklistAdmin.description')}</Text>
        </div>
        <Space className="ip-blacklist__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            {t('common.refresh')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openBlockModal}>
            {t('pages.ipBlacklistAdmin.manualBlock')}
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && entries.length === 0}>
        <div className="ip-blacklist__stats">
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.featureStatus')} value={statusInfo?.enabled ? 'ON' : 'OFF'} prefix={<StopOutlined />} />
          </Card>
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.blockedStat')} value={statusInfo?.blockedCount || 0} valueStyle={{ color: (statusInfo?.blockedCount || 0) > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.monitoringStat')} value={statusInfo?.monitoringCount || 0} />
          </Card>
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.thresholds')} value={`${statusInfo?.loginFailureThreshold || '-'} / ${statusInfo?.paymentFailureThreshold || '-'}`} />
          </Card>
        </div>

        <Card className="ip-blacklist__card">
          <Space className="ip-blacklist__filters" wrap>
            <Select
              value={status}
              onChange={setStatus}
              popupClassName="shop-mobile-popup-layer"
              getPopupContainer={() => document.body}
              options={['BLOCKED', 'MONITORING', 'RELEASED', 'ALL'].map((value) => ({ value, label: value }))}
            />
            <Select
              value={source}
              onChange={setSource}
              popupClassName="shop-mobile-popup-layer"
              getPopupContainer={() => document.body}
              options={['ALL', 'LOGIN', 'PAYMENT', 'MANUAL'].map((value) => ({ value, label: value }))}
            />
            <Input
              allowClear
              value={ipAddress}
              onChange={(event) => setIpAddress(event.target.value)}
              onPressEnter={loadData}
              placeholder={t('pages.ipBlacklistAdmin.ipAddress')}
            />
            <Button onClick={loadData}>{t('pages.ipBlacklistAdmin.filter')}</Button>
          </Space>

          <div className="ip-blacklist__bulkBar">
            <Text type="secondary">
              {t('pages.ipBlacklistAdmin.selectedSummary', { selected: selectedEntryIds.length, releasable: selectedReleasableIds.length })}
            </Text>
            <Popconfirm
              title={t('pages.ipBlacklistAdmin.batchReleaseConfirm')}
              description={t('pages.ipBlacklistAdmin.batchReleaseDescription', { count: selectedReleasableIds.length })}
              disabled={!selectedReleasableIds.length}
              onConfirm={releaseSelectedEntries}
            >
              <Button
                icon={<UnlockOutlined />}
                loading={batchActing}
                disabled={!selectedReleasableIds.length}
              >
                {t('pages.ipBlacklistAdmin.batchRelease')}
              </Button>
            </Popconfirm>
          </div>

          <Table<IpBlacklistEntry>
            rowKey="id"
            columns={columns}
            dataSource={entries}
            rowSelection={{
              selectedRowKeys: selectedEntryIds,
              onChange: (keys) => setSelectedEntryIds(keys.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)),
              getCheckboxProps: (record) => ({ disabled: record.status === 'RELEASED' }),
            }}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1100 }}
          />
        </Card>
      </Spin>

      <Modal
        title={t('pages.ipBlacklistAdmin.manualBlockTitle')}
        open={modalOpen}
        onOk={blockIp}
        onCancel={closeBlockModal}
        okText={t('pages.ipBlacklistAdmin.block')}
        cancelText={t('common.cancel')}
        confirmLoading={blocking}
        className="profile-mobile-safe-modal ip-blacklist__manualBlockModal"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ blockMinutes: statusInfo?.blockMinutes || 60 }}>
          <Form.Item name="ipAddress" label={t('pages.ipBlacklistAdmin.ipAddress')} rules={[{ required: true, message: t('pages.ipBlacklistAdmin.ipRequired') }]}>
            <Input placeholder="203.0.113.10" />
          </Form.Item>
          <Form.Item name="reason" label={t('pages.ipBlacklistAdmin.reason')}>
            <Input.TextArea rows={3} placeholder={t('pages.ipBlacklistAdmin.optional')} />
          </Form.Item>
          <Form.Item name="blockMinutes" label={t('pages.ipBlacklistAdmin.blockMinutes')}>
            <InputNumber min={1} max={43200} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IpBlacklistManagement;
