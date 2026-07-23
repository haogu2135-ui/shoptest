import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CloudServerOutlined, DatabaseOutlined, HddOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined } from '@ant-design/icons';
import { apiBaseUrl } from '../api';
import { adminApi } from '../api/admin';
import type { AdminSystemStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import './SystemMonitor.css';
import ShopButton from '../components/ShopButton';
import ShopSpin from '../components/ShopSpin';
import ShopProgress from '../components/ShopProgress';
import ShopStatistic from '../components/ShopStatistic';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import ShopSpace from '../components/ShopSpace';
import ShopTypography from '../components/ShopTypography';
import ShopCard from '../components/ShopCard';
import ShopDescriptions from '../components/ShopDescriptions';
import message from '../components/ShopMessage';
const Title = ShopTypography.Title;
const Text = ShopTypography.Text;

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDuration = (ms: number | undefined, labels: { day: string; hour: string; minute: string }) => {
  const totalSeconds = Math.floor(Number(ms || 0) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}${labels.day} ${hours}${labels.hour}`;
  if (hours > 0) return `${hours}${labels.hour} ${minutes}${labels.minute}`;
  return `${minutes}${labels.minute}`;
};

const formatLatency = (ms?: number) => {
  if (ms === undefined || ms === null) return '-';
  return `${Math.max(0, Math.round(Number(ms) || 0))} ms`;
};

const statusTag = (status: string | undefined, ready: boolean | undefined, labels: Record<string, string>) => {
  const value = (status || (ready ? 'UP' : 'UNKNOWN')).toUpperCase();
  const colorMap: Record<string, string> = {
    UP: 'green',
    DOWN: 'red',
    DEGRADED: 'orange',
    UNAVAILABLE: 'red',
    DISABLED: 'default',
    UNKNOWN: 'default',
  };
  return <ShopTag color={colorMap[value] || 'default'}>{labels[value] || value}</ShopTag>;
};

const readyTag = (ready: boolean | undefined, labels: { ready: string; blocked: string }) => (
  <ShopTag color={ready ? 'green' : 'red'}>{ready ? labels.ready : labels.blocked}</ShopTag>
);

const booleanTag = (enabled: boolean | undefined, labels: { on: string; off: string }) => (
  <ShopTag color={enabled ? 'green' : 'default'}>{enabled ? labels.on : labels.off}</ShopTag>
);

const maskDatabaseUrl = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return raw
    .replace(/\/\/([^:@/?#;]+):([^@/?#;]+)@/g, '//****:****@')
    .replace(/([?&;](?:user|username|password|pwd)=)[^;&]+/gi, '$1****');
};

const renderMessages = (messages?: string[], tone: 'warning' | 'error' = 'warning') => {
  const values = (messages || []).filter(Boolean);
  if (!values.length) return '-';
  return (
    <div className="system-monitor__messages">
      {values.map((item, index) => (
        <Text
          key={`${tone}-${index}-${item}`}
          className={`system-monitor__message system-monitor__message--${tone}`}
        >
          {item}
        </Text>
      ))}
    </div>
  );
};

const SystemMonitor: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const response = await adminApi.getSystemStatus();
      setStatus(response.data);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.systemMonitor.loadFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const applicationStatus = status?.application || {
    name: '-',
    runtimeMode: '-',
    serverPort: '-',
    profiles: [],
    time: '',
  };
  const runtimeStatus = status?.runtime || {
    javaVersion: '-',
    javaVendor: '-',
    osName: '-',
    osVersion: '-',
    processors: 0,
    uptimeMs: 0,
    startTimeMs: 0,
  };
  const memoryStatus = status?.memory || {
    maxBytes: 0,
    totalBytes: 0,
    freeBytes: 0,
    usedBytes: 0,
    usedPercent: 0,
  };
  const diskStatus = status?.disk || {
    path: '-',
    totalBytes: 0,
    freeBytes: 0,
    usedBytes: 0,
    usedPercent: 0,
  };
  const databaseStatus = status?.database || {
    url: '',
    driver: '',
    status: 'UNKNOWN',
    ready: false,
    required: true,
  };
  const nacosStatus = status?.nacos || {
    serverAddr: '',
    status: 'UNKNOWN',
    ready: false,
    configEnabled: false,
    discoveryEnabled: false,
    registerEnabled: false,
    namespace: '',
    group: 'DEFAULT_GROUP',
    warnings: [],
    errors: [],
  };
  const memoryRisk = Number(memoryStatus.usedPercent || 0) >= 85;
  const diskRisk = Number(diskStatus.usedPercent || 0) >= 85;
  const dependencyRisk = status?.ready === false;
  const optionalHealthRisk = status?.healthy === false && !dependencyRisk;
  const productionConfig = status?.productionConfig;
  const productionConfigIssues = productionConfig?.issues || [];
  const productionConfigWarnings = productionConfig?.warnings || [];
  const redisStatus = status?.redis || {
    host: '',
    port: '',
    database: '0',
    status: 'UNKNOWN',
    ready: false,
    required: false,
  };
  const healthText = useMemo(() => {
    if (!status) return t('pages.systemMonitor.unknown');
    if (dependencyRisk) return t('pages.systemMonitor.dependencyDown');
    if (optionalHealthRisk || memoryRisk || diskRisk) return t('pages.systemMonitor.needsAttention');
    return t('pages.systemMonitor.healthy');
  }, [dependencyRisk, diskRisk, memoryRisk, optionalHealthRisk, status, t]);
  const durationLabels = useMemo(() => ({
    day: t('pages.systemMonitor.day'),
    hour: t('pages.systemMonitor.hour'),
    minute: t('pages.systemMonitor.minute'),
  }), [t]);
  const statusLabels = useMemo(() => ({
    UP: t('pages.systemMonitor.statusValues.UP'),
    DOWN: t('pages.systemMonitor.statusValues.DOWN'),
    DEGRADED: t('pages.systemMonitor.statusValues.DEGRADED'),
    UNAVAILABLE: t('pages.systemMonitor.statusValues.UNAVAILABLE'),
    DISABLED: t('pages.systemMonitor.statusValues.DISABLED'),
    UNKNOWN: t('pages.systemMonitor.statusValues.UNKNOWN'),
  }), [t]);
  const readyLabels = useMemo(() => ({
    ready: t('pages.systemMonitor.readyStatus'),
    blocked: t('pages.systemMonitor.blockedStatus'),
  }), [t]);
  const booleanLabels = useMemo(() => ({
    on: t('pages.systemMonitor.onStatus'),
    off: t('pages.systemMonitor.offStatus'),
  }), [t]);
  const refreshSystemStatusActionLabel = `${t('common.refresh')}: ${t('pages.systemMonitor.title')}`;

  return (
    <div className="system-monitor">
      <div className="system-monitor__hero">
        <div>
          <Text className="system-monitor__eyebrow">{t('pages.systemMonitor.eyebrow')}</Text>
          <Title level={2}>{t('pages.systemMonitor.title')}</Title>
          <Text type="secondary">{t('pages.systemMonitor.description')}</Text>
        </div>
        <ShopButton icon={<ReloadOutlined />} aria-label={refreshSystemStatusActionLabel} title={refreshSystemStatusActionLabel} onClick={loadStatus} loading={loading}>
          {t('common.refresh')}
        </ShopButton>
      </div>

      {loadError && status ? (
        <ShopAlert
          className="system-monitor__alert"
          type="warning"
          showIcon
          message={loadError}
          description={t('pages.systemMonitor.staleDataWarning')}
          action={(
            <ShopSpace wrap data-system-monitor-stale-recovery="true">
              <ShopButton size="small" type="primary" onClick={loadStatus} loading={loading}>
                {t('common.retry')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin')}>
                {t('pages.adminDashboard.title')}
              </ShopButton>
              <ShopButton size="small" onClick={() => navigate('/admin/orders')}>
                {t('pages.adminDashboard.orders')}
              </ShopButton>
            </ShopSpace>
          )}
        />
      ) : null}

      {loadError && !status ? (
        <div className="system-monitor__error" data-system-monitor-load-recovery="true">
          <PageError
            title={t('pages.systemMonitor.loadFailed')}
            description={loadError}
            actions={[
              {
                key: 'retry',
                label: refreshSystemStatusActionLabel,
                onClick: () => { void loadStatus(); },
                type: 'primary',
              },
              {
                key: 'dashboard',
                label: t('pages.adminDashboard.title'),
                onClick: () => navigate('/admin'),
                type: 'default',
              },
              {
                key: 'orders',
                label: t('pages.adminDashboard.orders'),
                onClick: () => navigate('/admin/orders'),
                type: 'default',
              },
              {
                key: 'products',
                label: t('pages.adminDashboard.products'),
                onClick: () => navigate('/admin/products'),
                type: 'default',
              },
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
        {loadError && !status ? null : status ? (
          <>
            <div className="system-monitor__stats">
              <ShopCard>
                <ShopStatistic title={t('pages.systemMonitor.overallStatus')} value={healthText} valueStyle={{ color: dependencyRisk ? '#cf1322' : (memoryRisk || diskRisk || optionalHealthRisk ? '#c46a14' : '#1f8a4c') }} prefix={<SettingOutlined />} />
              </ShopCard>
              <ShopCard>
                <ShopStatistic title={t('pages.systemMonitor.applicationName')} value={applicationStatus.name} prefix={<CloudServerOutlined />} />
              </ShopCard>
              <ShopCard>
                <ShopStatistic title={t('pages.systemMonitor.uptime')} value={formatDuration(runtimeStatus.uptimeMs, durationLabels)} />
              </ShopCard>
              <ShopCard>
                <ShopStatistic title={t('pages.systemMonitor.cpuCores')} value={runtimeStatus.processors} />
              </ShopCard>
            </div>

            <ShopAlert
              className="system-monitor__alert"
              type={dependencyRisk ? 'error' : (memoryRisk || diskRisk || optionalHealthRisk ? 'warning' : 'success')}
              showIcon
              message={dependencyRisk ? t('pages.systemMonitor.dependencyUnavailable') : (memoryRisk || diskRisk || optionalHealthRisk ? t('pages.systemMonitor.backendNeedsAttention') : t('pages.systemMonitor.backendHealthy'))}
              description={dependencyRisk
                ? t('pages.systemMonitor.dependencyUnavailableDescription')
                : (memoryRisk || diskRisk
                  ? t('pages.systemMonitor.resourceRiskDescription')
                  : t('pages.systemMonitor.healthyDescription'))}
            />

            <div className="system-monitor__resourceGrid">
              <ShopCard title={t('pages.systemMonitor.jvmMemory')} className="system-monitor__card">
                <ShopProgress
                  type="dashboard"
                  percent={Math.round(Number(memoryStatus.usedPercent || 0))}
                  status={memoryRisk ? 'exception' : 'normal'}
                />
                <ShopDescriptions column={1} size="small">
                  <ShopDescriptions.Item label={t('pages.systemMonitor.used')}>{formatBytes(memoryStatus.usedBytes)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.max')}>{formatBytes(memoryStatus.maxBytes)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.free')}>{formatBytes(memoryStatus.freeBytes)}</ShopDescriptions.Item>
                </ShopDescriptions>
              </ShopCard>

              <ShopCard title={t('pages.systemMonitor.diskSpace')} className="system-monitor__card">
                <ShopProgress
                  type="dashboard"
                  percent={Math.round(Number(diskStatus.usedPercent || 0))}
                  status={diskRisk ? 'exception' : 'normal'}
                />
                <ShopDescriptions column={1} size="small">
                  <ShopDescriptions.Item label={t('pages.systemMonitor.path')}>{diskStatus.path}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.used')}>{formatBytes(diskStatus.usedBytes)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.total')}>{formatBytes(diskStatus.totalBytes)}</ShopDescriptions.Item>
                </ShopDescriptions>
              </ShopCard>
            </div>

            <ShopCard title={t('pages.systemMonitor.runtimeEnvironment')} className="system-monitor__card">
              <ShopDescriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
                <ShopDescriptions.Item label={t('pages.systemMonitor.backendStatus')}>
                  <ShopSpace size={6}>{statusTag(status.status, status.ready, statusLabels)}{readyTag(status.ready, readyLabels)}</ShopSpace>
                </ShopDescriptions.Item>
                <ShopDescriptions.Item label={t('pages.systemMonitor.apiAddress')}>{apiBaseUrl}</ShopDescriptions.Item>
                <ShopDescriptions.Item label={t('pages.systemMonitor.port')}>{applicationStatus.serverPort}</ShopDescriptions.Item>
                <ShopDescriptions.Item label={t('pages.systemMonitor.mode')}>{applicationStatus.runtimeMode}</ShopDescriptions.Item>
                <ShopDescriptions.Item label={t('pages.systemMonitor.profile')}>
                  {applicationStatus.profiles?.length ? applicationStatus.profiles.map((profile) => <ShopTag key={profile}>{profile}</ShopTag>) : <ShopTag>default</ShopTag>}
                </ShopDescriptions.Item>
                <ShopDescriptions.Item label="Java">{runtimeStatus.javaVersion}</ShopDescriptions.Item>
                <ShopDescriptions.Item label={t('pages.systemMonitor.system')}>{runtimeStatus.osName} {runtimeStatus.osVersion}</ShopDescriptions.Item>
              </ShopDescriptions>
            </ShopCard>

            {productionConfig ? (
              <ShopCard
                title={<ShopSpace className="system-monitor__statusTitle">{t('pages.systemMonitor.productionConfig')} {statusTag(productionConfig.status, productionConfig.ready, statusLabels)}</ShopSpace>}
                className="system-monitor__card"
              >
                <div className="system-monitor__productionConfig">
                  <SafetyCertificateOutlined className="system-monitor__largeIcon" />
                  <ShopDescriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                    <ShopDescriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(productionConfig.ready, readyLabels)}</ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.required')}>{booleanTag(productionConfig.required, booleanLabels)}</ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.mode')}>{productionConfig.runtimeMode || applicationStatus.runtimeMode}</ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.mailAccounts')}>
                      {productionConfig.checks?.mail?.configuredAccountCount ?? '-'}
                    </ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.paymentChannels')}>
                      {(productionConfig.checks?.paymentChannels?.availableCheckoutChannelCount ?? '-')}/{(productionConfig.checks?.paymentChannels?.enabledChannelCount ?? '-')}
                    </ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.paymentWebhooks')}>
                      {(productionConfig.checks?.paymentChannels?.webhookReadyChannelCount ?? '-')}/{(productionConfig.checks?.paymentChannels?.webhookRequiredChannelCount ?? '-')}
                    </ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.corsOrigins')}>
                      {productionConfig.checks?.cors?.corsOriginCount ?? '-'}
                    </ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.blockers')} span={3}>
                      {renderMessages(productionConfigIssues, 'error')}
                    </ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.warnings')} span={3}>
                      {renderMessages(productionConfigWarnings, 'warning')}
                    </ShopDescriptions.Item>
                  </ShopDescriptions>
                  {Array.isArray(productionConfig.checks?.paymentChannels?.channels) && (productionConfig.checks?.paymentChannels?.channels?.length || 0) > 0 ? (
                    <div className="system-monitor__paymentChannelChecklist" aria-label={t('pages.systemMonitor.paymentChannelChecklist')}>
                      <Text strong>{t('pages.systemMonitor.paymentChannelChecklist')}</Text>
                      <Text type="secondary">{t('pages.systemMonitor.paymentChannelChecklistHint')}</Text>
                      <div className="system-monitor__paymentChannelList">
                        {(productionConfig.checks?.paymentChannels?.channels || []).map((channel) => {
                          const code = channel.code || t('common.unknown');
                          const available = channel.available === true;
                          const webhookRequired = channel.webhookRequired === true;
                          const webhookReady = channel.webhookReady === true;
                          const webhookStatus = String(channel.webhookStatus || '').toUpperCase();
                          let webhookLabel = t('pages.systemMonitor.channelWebhookNotRequired');
                          let webhookColor: 'default' | 'green' | 'orange' | 'red' = 'default';
                          if (webhookRequired) {
                            if (webhookReady || webhookStatus === 'READY') {
                              webhookLabel = t('pages.systemMonitor.channelWebhookReady');
                              webhookColor = 'green';
                            } else if (webhookStatus === 'INVALID') {
                              webhookLabel = t('pages.systemMonitor.channelWebhookInvalid');
                              webhookColor = 'red';
                            } else {
                              webhookLabel = t('pages.systemMonitor.channelWebhookMissing');
                              webhookColor = 'orange';
                            }
                          }
                          return (
                            <div
                              key={`${code}-${channel.provider || 'provider'}`}
                              className={`system-monitor__paymentChannelItem system-monitor__paymentChannelItem--${available ? 'ready' : 'blocked'}`}
                              data-webhook-status={webhookStatus || (webhookRequired ? 'UNKNOWN' : 'NOT_APPLICABLE')}
                            >
                              <ShopSpace wrap size={[8, 4]}>
                                <ShopTag color={available ? 'green' : 'red'}>
                                  {available ? t('pages.systemMonitor.channelReady') : t('pages.systemMonitor.channelBlocked')}
                                </ShopTag>
                                <ShopTag color={webhookColor}>{webhookLabel}</ShopTag>
                                <Text strong>{code}</Text>
                                {channel.provider ? <Text type="secondary">{channel.provider}</Text> : null}
                                {channel.refundMode ? (
                                  <Text type="secondary">
                                    {t('pages.systemMonitor.channelRefundMode')}: {channel.refundMode}
                                  </Text>
                                ) : null}
                              </ShopSpace>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </ShopCard>
            ) : null}

            <div className="system-monitor__resourceGrid">
              <ShopCard
                title={<ShopSpace className="system-monitor__statusTitle">{t('pages.systemMonitor.database')} {statusTag(databaseStatus.status, databaseStatus.ready, statusLabels)}</ShopSpace>}
                className="system-monitor__card"
              >
                <ShopSpace direction="vertical" className="system-monitor__databaseInfo">
                  <DatabaseOutlined className="system-monitor__largeIcon" />
                  <ShopDescriptions column={1} size="small">
                    <ShopDescriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(databaseStatus.ready, readyLabels)}</ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.latency')}>{formatLatency(databaseStatus.latencyMs)}</ShopDescriptions.Item>
                    <ShopDescriptions.Item label="URL"><Text>{maskDatabaseUrl(databaseStatus.url)}</Text></ShopDescriptions.Item>
                    <ShopDescriptions.Item label={t('pages.systemMonitor.driver')}>{databaseStatus.driver || '-'}</ShopDescriptions.Item>
                    {databaseStatus.error ? (
                      <ShopDescriptions.Item label={t('pages.systemMonitor.error')}>{databaseStatus.error}</ShopDescriptions.Item>
                    ) : null}
                  </ShopDescriptions>
                </ShopSpace>
              </ShopCard>

              <ShopCard
                title={<ShopSpace className="system-monitor__statusTitle">Redis {statusTag(redisStatus.status, redisStatus.ready, statusLabels)}</ShopSpace>}
                className="system-monitor__card"
              >
                <ShopDescriptions column={1} size="small">
                  <ShopDescriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(redisStatus.ready, readyLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.required')}>{booleanTag(redisStatus.required, booleanLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.address')}>{redisStatus.host || '-'}:{redisStatus.port || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label="DB">{redisStatus.database || '0'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.latency')}>{formatLatency(redisStatus.latencyMs)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label="PING">{redisStatus.ping || '-'}</ShopDescriptions.Item>
                  {redisStatus.error ? (
                    <ShopDescriptions.Item label={t('pages.systemMonitor.error')}>{redisStatus.error}</ShopDescriptions.Item>
                  ) : null}
                </ShopDescriptions>
              </ShopCard>

              <ShopCard
                title={<ShopSpace className="system-monitor__statusTitle">{t('pages.systemMonitor.nacosDiscovery')} {statusTag(nacosStatus.status, nacosStatus.ready, statusLabels)}</ShopSpace>}
                className="system-monitor__card"
              >
                <ShopDescriptions column={1} size="small">
                  <ShopDescriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(nacosStatus.ready, readyLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.address')}>{nacosStatus.serverAddr || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.namespace')}>{nacosStatus.namespace || 'public'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.group')}>{nacosStatus.group || 'DEFAULT_GROUP'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.config')}>{booleanTag(nacosStatus.configEnabled, booleanLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.discovery')}>
                    {booleanTag(nacosStatus.discoveryEnabled, booleanLabels)}
                  </ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.register')}>
                    {booleanTag(nacosStatus.registerEnabled, booleanLabels)}
                  </ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.serviceStatus')}>{nacosStatus.serverStatus || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label="Data ID">{nacosStatus.dataId || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.latency')}>{formatLatency(nacosStatus.latencyMs)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.warnings')}>{renderMessages(nacosStatus.warnings, 'warning')}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.systemMonitor.error')}>
                    {nacosStatus.error || renderMessages(nacosStatus.errors, 'error')}
                  </ShopDescriptions.Item>
                </ShopDescriptions>
              </ShopCard>
            </div>

            <ShopCard title={t('pages.systemMonitor.opsTips')} className="system-monitor__card">
              <ShopSpace direction="vertical">
                <Text><HddOutlined /> {t('pages.systemMonitor.diskTip')}</Text>
                <Text><CloudServerOutlined /> {t('pages.systemMonitor.nacosTip')}</Text>
                <Text><DatabaseOutlined /> {t('pages.systemMonitor.databaseTip')}</Text>
              </ShopSpace>
            </ShopCard>
          </>
        ) : (
          <ShopCard className="system-monitor__card">
            <Text type="secondary">{t('pages.systemMonitor.noStatus')}</Text>
          </ShopCard>
        )}
        </ShopSpin>
      </div>
    </div>
  );
};

export default SystemMonitor;
