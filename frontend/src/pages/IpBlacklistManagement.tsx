import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import ShopInputNumber from '../components/ShopInputNumber';
import ShopModal from '../components/ShopModal';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, SearchOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import { adminApi } from '../api/admin';
import type { IpBlacklistEntry, IpBlacklistStatus } from '../types';
import { useLanguage } from '../i18n';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import { labelTableSelectionCheckbox } from '../utils/tableSelectionAccessibility';
import {
  IP_BLACKLIST_BLOCK_PERMISSION,
  IP_BLACKLIST_RELEASE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import './IpBlacklistManagement.css';

const { Text, Title } = Typography;

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
const tableCellLabel = (label: string) => () => ({ 'data-label': label } as React.TdHTMLAttributes<HTMLElement>);
type FormValidationError = { errorFields: unknown[] };

const isFormValidationError = (error: unknown): error is FormValidationError => {
  if (!error || typeof error !== 'object') return false;
  return Array.isArray((error as { errorFields?: unknown }).errorFields);
};

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
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [entries, setEntries] = useState<IpBlacklistEntry[]>([]);
  const [statusInfo, setStatusInfo] = useState<IpBlacklistStatus | null>(null);
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [ipAddress, setIpAddress] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [listLoadError, setListLoadError] = useState<string | null>(null);
  const [listSnapshotLoaded, setListSnapshotLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [batchActing, setBatchActing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm();
  const canBlockIp = hasAdminPermission(adminPermissions, currentRole, IP_BLACKLIST_BLOCK_PERMISSION);
  const canReleaseIp = hasAdminPermission(adminPermissions, currentRole, IP_BLACKLIST_RELEASE_PERMISSION);
  const blacklistActionDisabled = loading || Boolean(listLoadError) || !listSnapshotLoaded;
  const blacklistActionUnavailableMessage = listLoadError || (loading ? t('common.loading') : t('pages.ipBlacklistAdmin.loadFailed'));
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
      let listError: unknown = null;
      let statusError: unknown = null;
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
          setListSnapshotLoaded(true);
          return true;
        }).catch((error: unknown) => {
          listError = error;
          setSelectedEntryIds([]);
          return false;
        }),
        adminApi.getIpBlacklistStatus().then((statusResponse) => {
          const nextStatusInfo = normalizeStatusInfo(statusResponse.data);
          if (nextStatusInfo) setStatusInfo(nextStatusInfo);
          return true;
        }).catch((error: unknown) => {
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
    } catch (error: unknown) {
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
    if (blacklistActionDisabled) {
      message.warning(blacklistActionUnavailableMessage);
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
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
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
    if (blacklistActionDisabled) {
      message.warning(blacklistActionUnavailableMessage);
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
    if (blacklistActionDisabled) {
      message.warning(blacklistActionUnavailableMessage);
      return;
    }
    setActing(entry.id);
    try {
      await adminApi.releaseIpBlacklistEntry(entry.id);
      message.success(t('pages.ipBlacklistAdmin.released'));
      await loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.ipBlacklistAdmin.releaseFailed'), language));
    } finally {
      setActing(null);
    }
  }, [blacklistActionDisabled, blacklistActionUnavailableMessage, canReleaseIp, language, loadData, t]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.includes(entry.id)),
    [entries, selectedEntryIds]
  );

  const selectedReleasableIds = useMemo(
    () => selectedEntries.filter((entry) => entry.status !== 'RELEASED').map((entry) => entry.id),
    [selectedEntries]
  );
  const batchReleaseActionLabel = `${t('pages.ipBlacklistAdmin.batchRelease')}: ${t('pages.ipBlacklistAdmin.selectedSummary', { selected: selectedEntryIds.length, releasable: selectedReleasableIds.length })}`;
  const blacklistPaginationItemRender = useMemo(
    () => buildPaginationItemRender(
      `${t('common.previousPage')}: ${t('pages.ipBlacklistAdmin.title')}`,
      `${t('common.nextPage')}: ${t('pages.ipBlacklistAdmin.title')}`,
      `${t('common.previousPages')}: ${t('pages.ipBlacklistAdmin.title')}`,
      `${t('common.nextPages')}: ${t('pages.ipBlacklistAdmin.title')}`
    ),
    [t]
  );

  const releaseSelectedEntries = async () => {
    if (!canReleaseIp) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (blacklistActionDisabled) {
      message.warning(blacklistActionUnavailableMessage);
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
    } catch (error: unknown) {
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
        width: 150,
        onCell: tableCellLabel('IP'),
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        key: 'status',
        width: 130,
        onCell: tableCellLabel(t('common.status')),
        render: (value: string) => <Tag color={statusColor(value)}>{getStatusLabel(value)}</Tag>,
      },
      {
        title: t('pages.ipBlacklistAdmin.source'),
        dataIndex: 'source',
        key: 'source',
        width: 110,
        onCell: tableCellLabel(t('pages.ipBlacklistAdmin.source')),
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
        onCell: tableCellLabel(t('pages.ipBlacklistAdmin.failureCount')),
        responsive: ['sm'],
      },
      {
        title: t('pages.ipBlacklistAdmin.reason'),
        dataIndex: 'reason',
        key: 'reason',
        onCell: tableCellLabel(t('pages.ipBlacklistAdmin.reason')),
        responsive: ['sm'],
        render: (value?: string) => value || '-',
      },
      {
        title: t('pages.ipBlacklistAdmin.blockedUntil'),
        dataIndex: 'blockedUntil',
        key: 'blockedUntil',
        width: 190,
        onCell: tableCellLabel(t('pages.ipBlacklistAdmin.blockedUntil')),
        responsive: ['sm'],
        render: formatTime,
      },
      {
        title: t('pages.ipBlacklistAdmin.lastSeen'),
        dataIndex: 'lastSeenAt',
        key: 'lastSeenAt',
        width: 190,
        onCell: tableCellLabel(t('pages.ipBlacklistAdmin.lastSeen')),
        responsive: ['sm'],
        render: formatTime,
      },
    ];

    if (canReleaseIp) {
      baseColumns.push({
        title: t('common.actions'),
        key: 'actions',
        width: 120,
        onCell: tableCellLabel(t('common.actions')),
        render: (_, record) => {
          if (record.status === 'RELEASED') return null;
          const entryLabel = record.ipAddress || `#${record.id}`;
          const releaseActionLabel = `${t('pages.ipBlacklistAdmin.release')}: ${entryLabel}`;
          return (
            <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
              title={t('pages.ipBlacklistAdmin.releaseConfirm', { ip: entryLabel })}
              description={t('pages.ipBlacklistAdmin.releaseDescription', { source: getSourceLabel(record.source) })}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              disabled={blacklistActionDisabled}
              okButtonProps={{ disabled: blacklistActionDisabled, 'aria-label': releaseActionLabel, title: releaseActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${releaseActionLabel}`, title: `${t('common.cancel')}: ${releaseActionLabel}` }}
              onConfirm={() => releaseEntry(record)}
            >
              <Button size="small" icon={<UnlockOutlined />} disabled={blacklistActionDisabled} aria-label={releaseActionLabel} title={releaseActionLabel} loading={acting === record.id}>
                {t('pages.ipBlacklistAdmin.release')}
              </Button>
            </ShopPopconfirm>
          );
        },
      });
    }

    return baseColumns;
  }, [acting, blacklistActionDisabled, canReleaseIp, formatTime, getSourceLabel, getStatusLabel, releaseEntry, t]);

  const showInitialBlacklistLoading = loading && !listSnapshotLoaded;
  const blacklistSnapshotUnavailable = Boolean(listLoadError) && !listSnapshotLoaded;
  const canRenderBlacklistSnapshot = !showInitialBlacklistLoading && !blacklistSnapshotUnavailable;
  const blacklistSnapshotLoading = loading && entries.length === 0;

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
            <Button type="primary" icon={<PlusOutlined />} disabled={blacklistActionDisabled} aria-label={manualBlockActionLabel} title={manualBlockActionLabel} onClick={openBlockModal}>
              {t('pages.ipBlacklistAdmin.manualBlock')}
            </Button>
          ) : null}
        </Space>
      </div>

      {listLoadError && listSnapshotLoaded ? (
        <Alert
          type="warning"
          showIcon
          className="ip-blacklist__notice"
          message={listLoadError}
          description={t('pages.ipBlacklistAdmin.staleDataWarning')}
          action={(
            <Space wrap data-admin-ip-blacklist-stale-recovery="true">
              <Button size="small" type="primary" loading={loading} onClick={refreshData}>
                {t('common.retry')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</Button>
              <Button size="small" onClick={() => navigate('/admin/system')}>{t('pages.adminDashboard.paymentReturnOps.providerReadinessAction')}</Button>
              <Button size="small" onClick={() => navigate('/admin/orders')}>{t('pages.adminDashboard.orders')}</Button>
            </Space>
          )}
        />
      ) : null}

      {listLoadError && !listSnapshotLoaded ? (
        <div className="ip-blacklist__error" data-admin-ip-blacklist-load-recovery="true">
          <PageError
            title={t('pages.ipBlacklistAdmin.loadFailed')}
            description={listLoadError}
            actions={[
              { key: 'retry', label: t('common.retry'), onClick: () => { void refreshData(); }, type: 'primary' },
              { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
              { key: 'system', label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'), onClick: () => navigate('/admin/system'), type: 'default' },
              { key: 'orders', label: t('pages.adminDashboard.orders'), onClick: () => navigate('/admin/orders'), type: 'default' },
            ]}
          />
        </div>
      ) : null}

      {showInitialBlacklistLoading ? (
        <Card
          className="ip-blacklist__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderBlacklistSnapshot ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy={blacklistSnapshotLoading}
          aria-label={blacklistSnapshotLoading ? t('common.loading') : undefined}
        >
          <Spin
            spinning={blacklistSnapshotLoading}
          >
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
          <Space className="ip-blacklist__filters" wrap>
            <div role="group" aria-label={statusFilterLabel} title={statusFilterLabel}>
              <ShopSelect
                value={status}
                onChange={(value) => { if (value) applyStatusFilter(value); }}
                disabled={blacklistActionDisabled} popupClassName="shop-mobile-popup-layer"
                options={STATUS_OPTIONS.map((value) => ({ value, label: getStatusLabel(value) }))}
              />
            </div>
            <div role="group" aria-label={sourceFilterLabel} title={sourceFilterLabel}>
              <ShopSelect
                value={source}
                onChange={(value) => { if (value) applySourceFilter(value); }}
                disabled={blacklistActionDisabled} popupClassName="shop-mobile-popup-layer"
                options={SOURCE_OPTIONS.map((value) => ({ value, label: getSourceLabel(value) }))}
              />
            </div>
            <ShopInput
              allowClear
              value={ipAddress}
              onChange={(event) => setIpAddress(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); refreshData(); } }}
              disabled={blacklistActionDisabled}
              placeholder={t('pages.ipBlacklistAdmin.ipAddress')}
              aria-label={ipAddressFilterLabel}
              title={ipAddressFilterLabel}
            />
            <Button icon={<SearchOutlined />} disabled={blacklistActionDisabled} aria-label={applyFilterActionLabel} title={applyFilterActionLabel} onClick={refreshData}>{t('pages.ipBlacklistAdmin.filter')}</Button>
            <Button disabled={blacklistActionDisabled || !hasActiveFilters} aria-label={resetFilterActionLabel} title={resetFilterActionLabel} onClick={resetFilters}>{t('common.reset')}</Button>
          </Space>

          {canReleaseIp ? (
            <div className="ip-blacklist__bulkBar">
              <Text type="secondary">
                {t('pages.ipBlacklistAdmin.selectedSummary', { selected: selectedEntryIds.length, releasable: selectedReleasableIds.length })}
              </Text>
              <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                title={t('pages.ipBlacklistAdmin.batchReleaseConfirm')}
                description={t('pages.ipBlacklistAdmin.batchReleaseDescription', { count: selectedReleasableIds.length })}
                disabled={blacklistActionDisabled || !selectedReleasableIds.length}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ disabled: blacklistActionDisabled, 'aria-label': batchReleaseActionLabel, title: batchReleaseActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchReleaseActionLabel}`, title: `${t('common.cancel')}: ${batchReleaseActionLabel}` }}
                onConfirm={releaseSelectedEntries}
              >
                <Button
                  icon={<UnlockOutlined />}
                  loading={batchActing}
                  disabled={blacklistActionDisabled || !selectedReleasableIds.length}
                  aria-label={batchReleaseActionLabel}
                  title={batchReleaseActionLabel}
                >
                  {t('pages.ipBlacklistAdmin.batchRelease')}
                </Button>
              </ShopPopconfirm>
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
                  disabled: blacklistActionDisabled || record.status === 'RELEASED',
                  'aria-label': selectionLabel,
                  title: selectionLabel,
                };
              },
            } : undefined}
            pagination={{ pageSize: 10, itemRender: blacklistPaginationItemRender }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty description={hasActiveFilters ? t('pages.ipBlacklistAdmin.noFilteredRecords') : t('pages.ipBlacklistAdmin.noRecords')}>
                  <Space wrap className="ip-blacklist__emptyActions">
                    {canBlockIp ? (
                      <Button type="primary" icon={<PlusOutlined />} disabled={blacklistActionDisabled} aria-label={manualBlockActionLabel} title={manualBlockActionLabel} onClick={openBlockModal}>
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
        </div>
      ) : null}

      <ShopModal
        title={t('pages.ipBlacklistAdmin.manualBlockTitle')}
        open={modalOpen}
        onOk={blockIp}
        onClose={closeBlockModal}
        okText={t('pages.ipBlacklistAdmin.block')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: blacklistActionDisabled, 'aria-label': manualBlockSubmitActionLabel, title: manualBlockSubmitActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${manualBlockActionLabel}`, title: `${t('common.cancel')}: ${manualBlockActionLabel}` }}
        confirmLoading={blocking}
        className="profile-mobile-safe-modal ip-blacklist__manualBlockModal"
      >
        <Form form={form} layout="vertical" initialValues={{ blockMinutes: statusInfo?.blockMinutes || 60 }}>
          <Form.Item name="ipAddress" label={t('pages.ipBlacklistAdmin.ipAddress')} rules={[{ required: true, message: t('pages.ipBlacklistAdmin.ipRequired') }]}>
            <ShopInput placeholder="203.0.113.10" />
          </Form.Item>
          <Form.Item name="reason" label={t('pages.ipBlacklistAdmin.reason')}>
            <ShopTextArea rows={3} placeholder={t('pages.ipBlacklistAdmin.optional')} />
          </Form.Item>
          <Form.Item name="blockMinutes" label={t('pages.ipBlacklistAdmin.blockMinutes')}>
            <ShopInputNumber min={1} max={43200} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </ShopModal>
    </div>
  );
};

export default IpBlacklistManagement;
