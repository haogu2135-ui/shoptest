import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useState } from 'react';

import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import ShopRangePicker from '../components/ShopRangePicker';
import ShopSwitch from '../components/ShopSwitch';
import { BugOutlined, ClockCircleOutlined, DownloadOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { adminApi } from '../api/admin';
import type { AdminLogManagementStatus } from '../types';
import { useLanguage } from '../i18n';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { LOGS_DEBUG_PERMISSION, LOGS_DOWNLOAD_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './LogManagement.css';
import ShopButton from '../components/ShopButton';
import ShopSpin from '../components/ShopSpin';
import ShopEmpty from '../components/ShopEmpty';
import ShopStatistic from '../components/ShopStatistic';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import ShopSpace from '../components/ShopSpace';
import ShopTypography from '../components/ShopTypography';
import ShopCard from '../components/ShopCard';
import ShopDescriptions from '../components/ShopDescriptions';
import message from '../components/ShopMessage';
const Text = ShopTypography.Text;
const Title = ShopTypography.Title;

const DEFAULT_LOGGER = 'com.example.shop';

const LogManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<AdminLogManagementStatus | null>(null);
  const [loggerName, setLoggerName] = useState(DEFAULT_LOGGER);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(1, 'hour'), dayjs()]);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const canToggleDebug = hasAdminPermission(adminPermissions, currentRole, LOGS_DEBUG_PERMISSION);
  const canDownloadLogs = hasAdminPermission(adminPermissions, currentRole, LOGS_DOWNLOAD_PERMISSION);

  const loadStatus = useCallback(async (nextLogger: string) => {
    const requestedLogger = nextLogger.trim() || DEFAULT_LOGGER;
    setLoading(true);
    try {
      setLoadError(null);
      const response = await adminApi.getLogManagementStatus({ loggerName: requestedLogger });
      setStatus(response.data);
      setLoggerName(response.data.loggerName);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.logAdmin.loadFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    loadStatus(DEFAULT_LOGGER);
  }, [loadStatus]);

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

  const toggleDebug = async (enabled: boolean) => {
    if (!canToggleDebug) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (loadError || !status) {
      message.warning(loadError || t('pages.logAdmin.loadFailed'));
      return;
    }
    setSwitching(true);
    try {
      const response = await adminApi.setDebugLogging({ loggerName, enabled });
      setLoadError(null);
      setStatus(response.data);
      message.success(enabled ? t('pages.logAdmin.debugEnabled') : t('pages.logAdmin.debugDisabled'));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.logAdmin.levelToggleFailed'), language));
    } finally {
      setSwitching(false);
    }
  };

  const downloadLogs = async () => {
    if (!canDownloadLogs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (loadError || !status) {
      message.warning(loadError || t('pages.logAdmin.loadFailed'));
      return;
    }
    if (!range[0] || !range[1]) {
      message.warning(t('pages.logAdmin.rangeRequired'));
      return;
    }
    setDownloading(true);
    try {
      const response = await adminApi.downloadLogs({
        start: range[0].toISOString(),
        end: range[1].toISOString(),
        keyword: keyword.trim() || undefined,
        level: level === 'ALL' ? undefined : level,
      });
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shop-logs-${range[0].format('YYYYMMDD-HHmm')}-${range[1].format('YYYYMMDD-HHmm')}.log`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(t('pages.logAdmin.downloadStarted'));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.logAdmin.downloadFailed'), language));
    } finally {
      setDownloading(false);
    }
  };
  const activeLoggerName = loggerName.trim() || DEFAULT_LOGGER;
  const logDownloadContext = `${t('pages.logAdmin.loggerName')} ${activeLoggerName}, ${t('pages.logAdmin.currentLevel')} ${level}${keyword.trim() ? `, ${keyword.trim()}` : ''}`;
  const refreshLogsActionLabel = `${t('common.refresh')}: ${t('pages.logAdmin.loggerName')} ${activeLoggerName}`;
  const downloadLogsActionLabel = `${t('pages.logAdmin.downloadLogs')}: ${logDownloadContext}`;
  const loggerNameInputLabel = `${t('pages.logAdmin.loggerName')}: ${t('pages.logAdmin.loadLogger')}`;
  const debugSwitchActionLabel = `${t('pages.logAdmin.debugLogs')}: ${activeLoggerName}`;
  const loadLoggerActionLabel = `${t('pages.logAdmin.loadLogger')}: ${activeLoggerName}`;
  const logRangePickerLabel = `${t('pages.logAdmin.rangeDownload')}: ${range[0].format('YYYY-MM-DD HH:mm')} - ${range[1].format('YYYY-MM-DD HH:mm')}`;
  const logLevelSelectLabel = `${t('pages.logAdmin.currentLevel')}: ${t('pages.logAdmin.rangeDownload')}`;
  const logKeywordInputLabel = `${t('pages.logAdmin.keywordPlaceholder')}: ${t('pages.logAdmin.rangeDownload')}`;
  const downloadSelectedRangeActionLabel = `${t('pages.logAdmin.downloadSelectedRange')}: ${logDownloadContext}`;
  const logActionDisabled = loading || Boolean(loadError) || !status;
  const nextDebugEnabled = !Boolean(status?.debugEnabled);
  const debugTargetStatusLabel = nextDebugEnabled ? t('pages.logAdmin.debugEnabled') : t('pages.logAdmin.debugDisabled');
  const debugConfirmActionLabel = `${debugTargetStatusLabel}: ${activeLoggerName}`;

  return (
    <div className="log-management">
      <div className="log-management__hero">
        <div>
          <Text className="log-management__eyebrow">{t('pages.logAdmin.eyebrow')}</Text>
          <Title level={2}>{t('pages.logAdmin.title')}</Title>
          <Text type="secondary">{t('pages.logAdmin.description')}</Text>
        </div>
        <ShopSpace className="log-management__actions" wrap>
          <ShopButton icon={<ReloadOutlined />} loading={loading} aria-label={refreshLogsActionLabel} title={refreshLogsActionLabel} onClick={() => loadStatus(loggerName)}>
            {t('common.refresh')}
          </ShopButton>
          {canDownloadLogs ? (
            <ShopButton type="primary" icon={<DownloadOutlined />} loading={downloading} disabled={logActionDisabled} aria-label={downloadLogsActionLabel} title={downloadLogsActionLabel} onClick={downloadLogs}>
              {t('pages.logAdmin.downloadLogs')}
            </ShopButton>
          ) : null}
        </ShopSpace>
      </div>

      {loadError && status ? (
        <ShopAlert
          className="log-management__alert"
          type="warning"
          showIcon
          message={loadError}
          description={t('pages.logAdmin.staleDataWarning')}
          action={(
            <ShopSpace wrap data-admin-logs-stale-recovery="true">
              <ShopButton size="small" type="primary" onClick={() => loadStatus(loggerName)} loading={loading}>
                {t('common.retry')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin/system')}>{t('pages.adminDashboard.paymentReturnOps.providerReadinessAction')}</ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin/orders')}>{t('pages.adminDashboard.orders')}</ShopButton>
            </ShopSpace>
          )}
        />
      ) : null}

      {loadError && !status ? (
        <div className="log-management__error" data-admin-logs-load-recovery="true">
          <PageError
            title={t('pages.logAdmin.loadFailed')}
            description={loadError}
            actions={[
              { key: 'retry', label: t('common.retry'), onClick: () => { void loadStatus(loggerName); }, type: 'primary' },
              { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
              { key: 'system', label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'), onClick: () => navigate('/admin/system'), type: 'default' },
              { key: 'orders', label: t('pages.adminDashboard.orders'), onClick: () => navigate('/admin/orders'), type: 'default' },
            ]}
          />
        </div>
      ) : null}

      <div
        role="status"
        aria-live="polite"
        aria-busy={loading && !status}
        aria-label={t('common.loading')}
      >
        <ShopSpin
          spinning={loading && !status}
        >
        {loadError && !status ? null : (
          <>
            <div className="log-management__stats">
              <ShopCard>
                <ShopStatistic title={t('pages.logAdmin.loggerMetric')} value={status?.loggerName || loggerName} prefix={<FileTextOutlined />} />
              </ShopCard>
              <ShopCard>
                <ShopStatistic
                  title={t('pages.logAdmin.currentLevel')}
                  value={status?.effectiveLevel || '-'}
                  valueStyle={{ color: status?.debugEnabled ? '#c2410c' : '#1f8a4c' }}
                  prefix={<BugOutlined />}
                />
              </ShopCard>
              <ShopCard>
                <ShopStatistic title={t('pages.logAdmin.logFileCount')} value={status?.availableFiles?.length || 0} prefix={<ClockCircleOutlined />} />
              </ShopCard>
            </div>

            <ShopAlert
              className="log-management__alert"
              type="info"
              showIcon
              message={t('pages.logAdmin.debugHint')}
            />

            <div className="log-management__grid">
              <ShopCard title={t('pages.logAdmin.debugControl')} className="log-management__card">
                <div className="log-management__control">
                  <label>
                    <span>{t('pages.logAdmin.loggerName')}</span>
                    <ShopInput
                      value={loggerName}
                      onChange={(event) => setLoggerName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); loadStatus(loggerName); } }}
                      placeholder={DEFAULT_LOGGER}
                      aria-label={loggerNameInputLabel}
                      title={loggerNameInputLabel}
                    />
                  </label>
                  {canToggleDebug ? (
                    <div className="log-management__switchRow" role="group" aria-label={debugSwitchActionLabel} title={debugSwitchActionLabel}>
                      <div>
                        <Text strong>{t('pages.logAdmin.debugLogs')}</Text>
                        <Text type="secondary">{t('pages.logAdmin.runtimeOnly')}</Text>
                      </div>
                      <ShopPopconfirm
                        title={`${debugTargetStatusLabel}?`}
                        description={t('pages.logAdmin.debugHint')}
                        disabled={switching || logActionDisabled}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')} rootClassName="shop-mobile-popup-layer"
                        okButtonProps={{ 'aria-label': debugConfirmActionLabel, title: debugConfirmActionLabel }}
                        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${debugConfirmActionLabel}`, title: `${t('common.cancel')}: ${debugConfirmActionLabel}` }}
                        onConfirm={() => toggleDebug(nextDebugEnabled)}
                      >
                        <ShopSwitch
                          checked={Boolean(status?.debugEnabled)}
                          loading={switching}
                          disabled={switching || logActionDisabled}
                          aria-label={debugConfirmActionLabel}
                          title={debugConfirmActionLabel}
                          checkedChildren={t('pages.logAdmin.on')}
                          unCheckedChildren={t('pages.logAdmin.off')}
                        />
                      </ShopPopconfirm>
                    </div>
                  ) : null}
                  <ShopButton onClick={() => loadStatus(loggerName)} icon={<ReloadOutlined />} aria-label={loadLoggerActionLabel} title={loadLoggerActionLabel}>
                    {t('pages.logAdmin.loadLogger')}
                  </ShopButton>
                </div>
              </ShopCard>

              <ShopCard title={t('pages.logAdmin.rangeDownload')} className="log-management__card">
                <div className="log-management__download">
                  <ShopRangePicker
                    showTime
                    allowClear={false}
                    value={range}
                    onChange={(values) => {
                      if (values?.[0] && values?.[1]) {
                        setRange([values[0], values[1]]);
                      }
                    }}
                    ariaLabel={logRangePickerLabel}
                    title={logRangePickerLabel}
                    startAriaLabel={`${logRangePickerLabel} - start`}
                    endAriaLabel={`${logRangePickerLabel} - end`}
                  />
                  <div role="group" aria-label={logLevelSelectLabel} title={logLevelSelectLabel}>
                    <ShopSpace.Compact block>
                      <ShopSelect
                        value={level}
                        onChange={(value) => setLevel(value || 'ALL')} popupClassName="shop-mobile-popup-layer"
                        options={['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].map((value) => ({ value, label: value }))}
                      />
                      <ShopInput
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder={t('pages.logAdmin.keywordPlaceholder')}
                        aria-label={logKeywordInputLabel}
                        title={logKeywordInputLabel}
                      />
                    </ShopSpace.Compact>
                  </div>
                  {canDownloadLogs ? (
                    <ShopButton type="primary" icon={<DownloadOutlined />} loading={downloading} disabled={logActionDisabled} aria-label={downloadSelectedRangeActionLabel} title={downloadSelectedRangeActionLabel} onClick={downloadLogs}>
                      {t('pages.logAdmin.downloadSelectedRange')}
                    </ShopButton>
                  ) : null}
                </div>
                <ShopDescriptions column={1} size="small" bordered className="log-management__meta">
                  <ShopDescriptions.Item label={t('pages.logAdmin.logDirectory')}>{status?.logDirectory || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.logAdmin.currentFile')}>{status?.logFileName || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.logAdmin.configuredLevel')}>
                    <ShopTag color={status?.configuredLevel === 'INHERITED' ? 'default' : 'blue'}>{status?.configuredLevel || '-'}</ShopTag>
                  </ShopDescriptions.Item>
                </ShopDescriptions>
              </ShopCard>
            </div>

            <ShopCard title={t('pages.logAdmin.availableLogFiles')} className="log-management__card">
              {(status?.availableFiles || []).length ? (
                <ShopSpace wrap size={[8, 8]}>
                  {status?.availableFiles.map((file) => <ShopTag key={file}>{file}</ShopTag>)}
                </ShopSpace>
              ) : (
                <ShopEmpty description={t('pages.logAdmin.noLogFiles')} />
              )}
            </ShopCard>
          </>
        )}
        </ShopSpin>
      </div>
    </div>
  );
};

export default LogManagement;
