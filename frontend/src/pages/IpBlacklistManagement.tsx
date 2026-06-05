import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SearchOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { IpBlacklistEntry, IpBlacklistStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import { labelTableSelectionCheckbox } from '../utils/tableSelectionAccessibility';
import {
  IP_BLACKLIST_BLOCK_PERMISSION,
  IP_BLACKLIST_RELEASE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import './IpBlacklistManagement.css';

const { Text, Title } = Typography;
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };

const statusColor = (status: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'BLOCKED') return 'red';
  if (normalized === 'MONITORING') return 'gold';
  if (normalized === 'RELEASED') return 'green';
  return 'default';
};

const sourceColor = (source: string) => {
  const normalized = String(source || '').trim().toUpperCase();
  if (normalized === 'LOGIN') return 'blue';
  if (normalized === 'PAYMENT') return 'volcano';
  if (normalized === 'MANUAL') return 'purple';
  return 'default';
};

const STATUS_OPTIONS = ['ALL', 'BLOCKED', 'MONITORING', 'RELEASED'];
const SOURCE_OPTIONS = ['ALL', 'LOGIN', 'PAYMENT', 'MANUAL'];

const readEntryArray = (value: unknown): IpBlacklistEntry[] | null => {
  if (Array.isArray(value)) return value as IpBlacklistEntry[];
  if (value && typeof value === 'object') {
    const wrapped = value as { data?: unknown; items?: unknown; content?: unknown; records?: unknown; list?: unknown };
    return readEntryArray(wrapped.items)
      || readEntryArray(wrapped.content)
      || readEntryArray(wrapped.records)
      || readEntryArray(wrapped.list)
      || readEntryArray(wrapped.data);
  }
  return null;
};

const normalizeEntryList = (payload: unknown): IpBlacklistEntry[] => {
  return readEntryArray(payload) || [];
};

const normalizeStatusInfo = (payload: unknown): IpBlacklistStatus | null => {
  if (!payload || typeof payload !== 'object') return null;
  const wrapped = payload as { data?: unknown };
  return (wrapped.data && typeof wrapped.data === 'object' ? wrapped.data : payload) as IpBlacklistStatus;
};

const IpBlacklistManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [entries, setEntries] = useState<IpBlacklistEntry[]>([]);
  const [statusInfo, setStatusInfo] = useState<IpBlacklistStatus | null>(null);
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [ipAddress, setIpAddress] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [listLoadError, setListLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [batchActing, setBatchActing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm();
  const canBlockIp = hasAdminPermission(adminPermissions, currentRole, IP_BLACKLIST_BLOCK_PERMISSION);
  const canReleaseIp = hasAdminPermission(adminPermissions, currentRole, IP_BLACKLIST_RELEASE_PERMISSION);
  const formatTime = useCallback((value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(dateLocale) : '-';
  }, [dateLocale]);
  const hasActiveFilters = status !== 'ALL' || source !== 'ALL' || Boolean(ipAddress.trim());
  const getStatusLabel = useCallback((value: string) => {
    const rawValue = String(value || '').trim();
    const normalized = rawValue.toUpperCase();
    if (!normalized) return t('common.unknown');
    if (STATUS_OPTIONS.includes(normalized)) {
      return t(`pages.ipBlacklistAdmin.status.${normalized}`);
    }
    return rawValue;
  }, [t]);
  const getSourceLabel = useCallback((value: string) => {
    const rawValue = String(value || '').trim();
    const normalized = rawValue.toUpperCase();
    if (!normalized) return t('common.unknown');
    if (SOURCE_OPTIONS.includes(normalized)) {
      return t(`pages.ipBlacklistAdmin.sources.${normalized}`);
    }
    return rawValue;
  }, [t]);
  const blacklistEntryDisplayLabel = useCallback((entry: Pick<IpBlacklistEntry, 'id' | 'ipAddress'>) => (
    String(entry.ipAddress || '').trim() || `#${entry.id}`
  ), []);
  const entryStatusCounts = useMemo(() => ({
    blocked: entries.filter((entry) => entry.status === 'BLOCKED').length,
    monitoring: entries.filter((entry) => entry.status === 'MONITORING').length,
    released: entries.filter((entry) => entry.status === 'RELEASED').length,
    total: entries.length,
  }), [entries]);
  const blockedCount = Math.max(statusInfo?.blockedCount ?? 0, entryStatusCounts.blocked);
  const monitoringCount = Math.max(statusInfo?.monitoringCount ?? 0, entryStatusCounts.monitoring);
  const releasedCount = Math.max(statusInfo?.releasedCount ?? 0, entryStatusCounts.released);
  const totalCount = Math.max(statusInfo?.totalCount ?? 0, entryStatusCounts.total);
  const activeFilterLabel = `${t('common.status')} ${getStatusLabel(status)}, ${t('pages.ipBlacklistAdmin.source')} ${getSourceLabel(source)}${ipAddress.trim() ? `, IP ${ipAddress.trim()}` : ''}`;
  const refreshBlacklistActionLabel = `${t('common.refresh')}: ${t('pages.ipBlacklistAdmin.title')}, ${activeFilterLabel}`;
  const manualBlockActionLabel = `${t('pages.ipBlacklistAdmin.manualBlock')}: ${t('pages.ipBlacklistAdmin.title')}`;
  const manualBlockSubmitActionLabel = `${t('pages.ipBlacklistAdmin.block')}: ${t('pages.ipBlacklistAdmin.title')}`;
  const statusFilterLabel = `${t('common.status')}: ${t('pages.ipBlacklistAdmin.title')}`;
  const sourceFilterLabel = `${t('pages.ipBlacklistAdmin.source')}: ${t('pages.ipBlacklistAdmin.title')}`;
  const ipAddressFilterLabel = `${t('pages.ipBlacklistAdmin.ipAddress')}: ${t('pages.ipBlacklistAdmin.title')}`;
  const applyFilterActionLabel = `${t('pages.ipBlacklistAdmin.filter')}: ${activeFilterLabel}`;
  const resetFilterActionLabel = `${t('common.reset')}: ${activeFilterLabel}`;
  const showAllRecordsActionLabel = `${t('pages.ipBlacklistAdmin.showAllRecords')}: ${activeFilterLabel}`;
  const selectAllVisibleBlacklistEntriesLabel = t('pages.ipBlacklistAdmin.selectAllVisibleEntries');

  const fetchData = useCallback(async (nextStatus: string, nextSource: string, nextIpAddress: string) => {
    setLoading(true);
    try {
      let listError: any = null;
      let statusError: any = null;
      const [listLoaded] = await Promise.all([
        adminApi.getIpBlacklist({
          status: nextStatus === 'ALL' ? undefined : nextStatus,
          source: nextSource === 'ALL' ? undefined : nextSource,
          ipAddress: nextIpAddress.trim() || undefined,
          limit: 300,
        }).then((listResponse) => {
          const nextEntries = normalizeEntryList(listResponse.data);
          setEntries(nextEntries);
          setSelectedEntryIds((ids) => ids.filter((id) => nextEntries.some((entry) => entry.id === id)));
          setListLoadError(null);
          return true;
        }).catch((error) => {
          listError = error;
          setSelectedEntryIds([]);
          return false;
        }),
        adminApi.getIpBlacklistStatus().then((statusResponse) => {
          const nextStatusInfo = normalizeStatusInfo(statusResponse.data);
          if (nextStatusInfo) setStatusInfo(nextStatusInfo);
          return true;
        }).catch((error) => {
          statusError = error;
          return false;
        }),
      ]);
      if (!listLoaded) {
        const errorMessage = getApiErrorMessage(listError, t('pages.ipBlacklistAdmin.loadFailed'), language);
        setListLoadError(errorMessage);
        message.error(errorMessage);
      } else if (statusError) {
        message.warning(getApiErrorMessage(statusError, t('pages.ipBlacklistAdmin.statusLoadFailed'), language));
      }
    } catch (error: any) {
      const errorMessage = getApiErrorMessage(error, t('pages.ipBlacklistAdmin.loadFailed'), language);
      setListLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  const loadData = useCallback(async (overrides?: { status?: string; source?: string; ipAddress?: string }) => {
    await fetchData(overrides?.status ?? status, overrides?.source ?? source, overrides?.ipAddress ?? ipAddress);
  }, [fetchData, ipAddress, source, status]);

  useEffect(() => {
    fetchData('ALL', 'ALL', '');
  }, [fetchData]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const blockIp = async () => {
    if (!canBlockIp) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setBlocking(true);
      await adminApi.blockIpAddress(values);
      message.success(t('pages.ipBlacklistAdmin.blocked'));
      setModalOpen(false);
      form.resetFields();
      setStatus('ALL');
      setSource('ALL');
      setIpAddress('');
      await loadData({ status: 'ALL', source: 'ALL', ipAddress: '' });
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.blockFailed'), language));
    } finally {
      setBlocking(false);
    }
  };

  const openBlockModal = () => {
    if (!canBlockIp) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    form.resetFields();
    form.setFieldsValue({ blockMinutes: statusInfo?.blockMinutes || 60 });
    setModalOpen(true);
  };

  const applyStatusFilter = (value: string) => {
    setStatus(value);
    loadData({ status: value });
  };

  const applySourceFilter = (value: string) => {
    setSource(value);
    loadData({ source: value });
  };

  const refreshData = () => {
    loadData();
  };

  const resetFilters = () => {
    setStatus('ALL');
    setSource('ALL');
    setIpAddress('');
    loadData({ status: 'ALL', source: 'ALL', ipAddress: '' });
  };

  const closeBlockModal = () => {
    if (blocking) return;
    setModalOpen(false);
    form.resetFields();
  };

  const releaseEntry = useCallback(async (entry: IpBlacklistEntry) => {
    if (!canReleaseIp) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setActing(entry.id);
    try {
      await adminApi.releaseIpBlacklistEntry(entry.id);
      message.success(t('pages.ipBlacklistAdmin.released'));
      await loadData();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.releaseFailed'), language));
    } finally {
      setActing(null);
    }
  }, [canReleaseIp, language, loadData, t]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.includes(entry.id)),
    [entries, selectedEntryIds]
  );

  const selectedReleasableIds = useMemo(
    () => selectedEntries.filter((entry) => entry.status !== 'RELEASED').map((entry) => entry.id),
    [selectedEntries]
  );
  const batchReleaseActionLabel = `${t('pages.ipBlacklistAdmin.batchRelease')}: ${t('pages.ipBlacklistAdmin.selectedSummary', { selected: selectedEntryIds.length, releasable: selectedReleasableIds.length })}`;

  const releaseSelectedEntries = async () => {
    if (!canReleaseIp) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (!selectedReleasableIds.length) {
      message.warning(t('pages.ipBlacklistAdmin.selectReleasableFirst'));
      return;
    }
    setBatchActing(true);
    try {
      const response = await adminApi.releaseIpBlacklistEntries(selectedReleasableIds, t('pages.ipBlacklistAdmin.batchReleaseReason'));
      message.success(t('pages.ipBlacklistAdmin.batchReleaseDone', { count: response.data.releasedCount }));
      setSelectedEntryIds([]);
      await loadData();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.batchReleaseFailed'), language));
    } finally {
      setBatchActing(false);
    }
  };

  const columns: ColumnsType<IpBlacklistEntry> = useMemo(() => {
    const baseColumns: ColumnsType<IpBlacklistEntry> = [
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
        render: (value: string) => <Tag color={statusColor(value)}>{getStatusLabel(value)}</Tag>,
      },
      {
        title: t('pages.ipBlacklistAdmin.source'),
        dataIndex: 'source',
        key: 'source',
        width: 110,
        render: (value: string, record) => (
          <Space size={4} wrap>
            <Tag color={sourceColor(value)}>{getSourceLabel(value)}</Tag>
            {record.legacyOnly ? <Tag color="cyan">{t('pages.ipBlacklistAdmin.legacyLogin')}</Tag> : null}
          </Space>
        ),
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
    ];

    if (canReleaseIp) {
      baseColumns.push({
        title: t('common.actions'),
        key: 'actions',
        width: 120,
        render: (_, record) => {
          if (record.status === 'RELEASED') return null;
          const entryLabel = record.ipAddress || `#${record.id}`;
          const releaseActionLabel = `${t('pages.ipBlacklistAdmin.release')}: ${entryLabel}`;
          return (
            <Popconfirm
              classNames={mobilePopconfirmClassNames}
              title={t('pages.ipBlacklistAdmin.releaseConfirm', { ip: entryLabel })}
              description={t('pages.ipBlacklistAdmin.releaseDescription', { source: getSourceLabel(record.source) })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ 'aria-label': releaseActionLabel, title: releaseActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${releaseActionLabel}`, title: `${t('common.cancel')}: ${releaseActionLabel}` }}
              onConfirm={() => releaseEntry(record)}
            >
              <Button size="small" icon={<UnlockOutlined />} aria-label={releaseActionLabel} title={releaseActionLabel} loading={acting === record.id}>
                {t('pages.ipBlacklistAdmin.release')}
              </Button>
            </Popconfirm>
          );
        },
      });
    }

    return baseColumns;
  }, [acting, canReleaseIp, formatTime, getSourceLabel, getStatusLabel, releaseEntry, t]);

  return (
    <div className="ip-blacklist">
      <div className="ip-blacklist__hero">
        <div>
          <Text className="ip-blacklist__eyebrow">{t('pages.ipBlacklistAdmin.eyebrow')}</Text>
          <Title level={2}>{t('pages.ipBlacklistAdmin.title')}</Title>
          <Text type="secondary">{t('pages.ipBlacklistAdmin.description')}</Text>
        </div>
        <Space className="ip-blacklist__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} aria-label={refreshBlacklistActionLabel} title={refreshBlacklistActionLabel} onClick={refreshData}>
            {t('common.refresh')}
          </Button>
          {canBlockIp ? (
            <Button type="primary" icon={<PlusOutlined />} aria-label={manualBlockActionLabel} title={manualBlockActionLabel} onClick={openBlockModal}>
              {t('pages.ipBlacklistAdmin.manualBlock')}
            </Button>
          ) : null}
        </Space>
      </div>

      <Spin spinning={loading && entries.length === 0}>
        <div className="ip-blacklist__stats">
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.featureStatus')} value={statusInfo ? (statusInfo.enabled ? t('pages.ipBlacklistAdmin.enabledStatus') : t('pages.ipBlacklistAdmin.disabledStatus')) : t('common.unknown')} prefix={<StopOutlined />} />
          </Card>
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.blockedStat')} value={blockedCount} valueStyle={{ color: blockedCount > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.monitoringStat')} value={monitoringCount} />
          </Card>
          <Card>
            <Statistic title={t('pages.ipBlacklistAdmin.totalStat')} value={totalCount} />
          </Card>
        </div>

        <Card className="ip-blacklist__card">
          <Alert
            type={blockedCount > 0 ? 'warning' : 'info'}
            showIcon
            className="ip-blacklist__notice"
            message={blockedCount > 0
              ? t('pages.ipBlacklistAdmin.activeNotice', { count: blockedCount })
              : totalCount > 0
                ? t('pages.ipBlacklistAdmin.historyNotice', {
                  total: totalCount,
                  monitoring: monitoringCount,
                  released: releasedCount,
                })
                : t('pages.ipBlacklistAdmin.emptyNotice')}
          />
          {listLoadError ? (
            <Alert
              type="error"
              showIcon
              className="ip-blacklist__notice"
              message={t('pages.ipBlacklistAdmin.listUnavailable')}
              description={listLoadError}
            />
          ) : null}
          <Space className="ip-blacklist__filters" wrap>
            <div role="group" aria-label={statusFilterLabel} title={statusFilterLabel}>
              <Select
                value={status}
                onChange={applyStatusFilter}
                classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                getPopupContainer={() => document.body}
                options={STATUS_OPTIONS.map((value) => ({ value, label: getStatusLabel(value) }))}
              />
            </div>
            <div role="group" aria-label={sourceFilterLabel} title={sourceFilterLabel}>
              <Select
                value={source}
                onChange={applySourceFilter}
                classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                getPopupContainer={() => document.body}
                options={SOURCE_OPTIONS.map((value) => ({ value, label: getSourceLabel(value) }))}
              />
            </div>
            <Input
              allowClear
              value={ipAddress}
              onChange={(event) => setIpAddress(event.target.value)}
              onPressEnter={refreshData}
              placeholder={t('pages.ipBlacklistAdmin.ipAddress')}
              aria-label={ipAddressFilterLabel}
              title={ipAddressFilterLabel}
            />
            <Button icon={<SearchOutlined />} aria-label={applyFilterActionLabel} title={applyFilterActionLabel} onClick={refreshData}>{t('pages.ipBlacklistAdmin.filter')}</Button>
            <Button disabled={!hasActiveFilters} aria-label={resetFilterActionLabel} title={resetFilterActionLabel} onClick={resetFilters}>{t('common.reset')}</Button>
          </Space>

          {canReleaseIp ? (
            <div className="ip-blacklist__bulkBar">
              <Text type="secondary">
                {t('pages.ipBlacklistAdmin.selectedSummary', { selected: selectedEntryIds.length, releasable: selectedReleasableIds.length })}
              </Text>
              <Popconfirm
                classNames={mobilePopconfirmClassNames}
                title={t('pages.ipBlacklistAdmin.batchReleaseConfirm')}
                description={t('pages.ipBlacklistAdmin.batchReleaseDescription', { count: selectedReleasableIds.length })}
                disabled={!selectedReleasableIds.length}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ 'aria-label': batchReleaseActionLabel, title: batchReleaseActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchReleaseActionLabel}`, title: `${t('common.cancel')}: ${batchReleaseActionLabel}` }}
                onConfirm={releaseSelectedEntries}
              >
                <Button
                  icon={<UnlockOutlined />}
                  loading={batchActing}
                  disabled={!selectedReleasableIds.length}
                  aria-label={batchReleaseActionLabel}
                  title={batchReleaseActionLabel}
                >
                  {t('pages.ipBlacklistAdmin.batchRelease')}
                </Button>
              </Popconfirm>
            </div>
          ) : null}

          <Table<IpBlacklistEntry>
            className="shop-admin-selection-table"
            rowKey="id"
            columns={columns}
            dataSource={entries}
            rowSelection={canReleaseIp ? {
              columnWidth: 56,
              columnTitle: (checkboxNode) => labelTableSelectionCheckbox(checkboxNode, selectAllVisibleBlacklistEntriesLabel),
              selectedRowKeys: selectedEntryIds,
              onChange: (keys) => setSelectedEntryIds(keys.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)),
              getCheckboxProps: (record) => {
                const selectionLabel = t('pages.ipBlacklistAdmin.selectEntryRow', { entry: blacklistEntryDisplayLabel(record) });
                return {
                  disabled: record.status === 'RELEASED',
                  'aria-label': selectionLabel,
                  title: selectionLabel,
                };
              },
            } : undefined}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1100 }}
            locale={{
              emptyText: (
                <Empty description={hasActiveFilters ? t('pages.ipBlacklistAdmin.noFilteredRecords') : t('pages.ipBlacklistAdmin.noRecords')}>
                  <Space wrap className="ip-blacklist__emptyActions">
                    {canBlockIp ? (
                      <Button type="primary" icon={<PlusOutlined />} aria-label={manualBlockActionLabel} title={manualBlockActionLabel} onClick={openBlockModal}>
                        {t('pages.ipBlacklistAdmin.manualBlock')}
                      </Button>
                    ) : null}
                    {hasActiveFilters ? <Button aria-label={showAllRecordsActionLabel} title={showAllRecordsActionLabel} onClick={resetFilters}>{t('pages.ipBlacklistAdmin.showAllRecords')}</Button> : null}
                  </Space>
                </Empty>
              ),
            }}
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
        okButtonProps={{ 'aria-label': manualBlockSubmitActionLabel, title: manualBlockSubmitActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${manualBlockActionLabel}`, title: `${t('common.cancel')}: ${manualBlockActionLabel}` }}
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
