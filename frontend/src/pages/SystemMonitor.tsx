import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Progress, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { CloudServerOutlined, DatabaseOutlined, HddOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined } from '@ant-design/icons';
import { adminApi, apiBaseUrl } from '../api';
import type { AdminSystemStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import './SystemMonitor.css';

const { Title, Text } = Typography;

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
  return <Tag color={colorMap[value] || 'default'}>{labels[value] || value}</Tag>;
};

const readyTag = (ready: boolean | undefined, labels: { ready: string; blocked: string }) => (
  <Tag color={ready ? 'green' : 'red'}>{ready ? labels.ready : labels.blocked}</Tag>
);

const booleanTag = (enabled: boolean | undefined, labels: { on: string; off: string }) => (
  <Tag color={enabled ? 'green' : 'default'}>{enabled ? labels.on : labels.off}</Tag>
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
        <Button icon={<ReloadOutlined />} aria-label={refreshSystemStatusActionLabel} title={refreshSystemStatusActionLabel} onClick={loadStatus} loading={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      {loadError ? (
        <Alert
          className="system-monitor__alert"
          type="warning"
          showIcon
          message={loadError}
          description={status ? t('pages.systemMonitor.staleDataWarning') : undefined}
          action={(
            <Button size="small" onClick={loadStatus} loading={loading}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      <div
        role="status"
        aria-live="polite"
        aria-busy={loading && !status}
        aria-label={t('common.loading')}
      >
        <Spin
          spinning={loading && !status}
        >
        {loadError && !status ? null : status ? (
          <>
            <div className="system-monitor__stats">
              <Card>
                <Statistic title={t('pages.systemMonitor.overallStatus')} value={healthText} valueStyle={{ color: dependencyRisk ? '#cf1322' : (memoryRisk || diskRisk || optionalHealthRisk ? '#c46a14' : '#1f8a4c') }} prefix={<SettingOutlined />} />
              </Card>
              <Card>
                <Statistic title={t('pages.systemMonitor.applicationName')} value={applicationStatus.name} prefix={<CloudServerOutlined />} />
              </Card>
              <Card>
                <Statistic title={t('pages.systemMonitor.uptime')} value={formatDuration(runtimeStatus.uptimeMs, durationLabels)} />
              </Card>
              <Card>
                <Statistic title={t('pages.systemMonitor.cpuCores')} value={runtimeStatus.processors} />
              </Card>
            </div>

            <Alert
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
              <Card title={t('pages.systemMonitor.jvmMemory')} className="system-monitor__card">
                <Progress
                  type="dashboard"
                  percent={Math.round(Number(memoryStatus.usedPercent || 0))}
                  status={memoryRisk ? 'exception' : 'normal'}
                />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('pages.systemMonitor.used')}>{formatBytes(memoryStatus.usedBytes)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.max')}>{formatBytes(memoryStatus.maxBytes)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.free')}>{formatBytes(memoryStatus.freeBytes)}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title={t('pages.systemMonitor.diskSpace')} className="system-monitor__card">
                <Progress
                  type="dashboard"
                  percent={Math.round(Number(diskStatus.usedPercent || 0))}
                  status={diskRisk ? 'exception' : 'normal'}
                />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('pages.systemMonitor.path')}>{diskStatus.path}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.used')}>{formatBytes(diskStatus.usedBytes)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.total')}>{formatBytes(diskStatus.totalBytes)}</Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Card title={t('pages.systemMonitor.runtimeEnvironment')} className="system-monitor__card">
              <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
                <Descriptions.Item label={t('pages.systemMonitor.backendStatus')}>
                  <Space size={6}>{statusTag(status.status, status.ready, statusLabels)}{readyTag(status.ready, readyLabels)}</Space>
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.systemMonitor.apiAddress')}>{apiBaseUrl}</Descriptions.Item>
                <Descriptions.Item label={t('pages.systemMonitor.port')}>{applicationStatus.serverPort}</Descriptions.Item>
                <Descriptions.Item label={t('pages.systemMonitor.mode')}>{applicationStatus.runtimeMode}</Descriptions.Item>
                <Descriptions.Item label={t('pages.systemMonitor.profile')}>
                  {applicationStatus.profiles?.length ? applicationStatus.profiles.map((profile) => <Tag key={profile}>{profile}</Tag>) : <Tag>default</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Java">{runtimeStatus.javaVersion}</Descriptions.Item>
                <Descriptions.Item label={t('pages.systemMonitor.system')}>{runtimeStatus.osName} {runtimeStatus.osVersion}</Descriptions.Item>
              </Descriptions>
            </Card>

            {productionConfig ? (
              <Card
                title={<Space className="system-monitor__statusTitle">{t('pages.systemMonitor.productionConfig')} {statusTag(productionConfig.status, productionConfig.ready, statusLabels)}</Space>}
                className="system-monitor__card"
              >
                <div className="system-monitor__productionConfig">
                  <SafetyCertificateOutlined className="system-monitor__largeIcon" />
                  <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
                    <Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(productionConfig.ready, readyLabels)}</Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.required')}>{booleanTag(productionConfig.required, booleanLabels)}</Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.mode')}>{productionConfig.runtimeMode || applicationStatus.runtimeMode}</Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.mailAccounts')}>
                      {productionConfig.checks?.mail?.configuredAccountCount ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.paymentChannels')}>
                      {(productionConfig.checks?.paymentChannels?.availableCheckoutChannelCount ?? '-')}/{(productionConfig.checks?.paymentChannels?.enabledChannelCount ?? '-')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.corsOrigins')}>
                      {productionConfig.checks?.cors?.corsOriginCount ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.blockers')} span={3}>
                      {renderMessages(productionConfigIssues, 'error')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.warnings')} span={3}>
                      {renderMessages(productionConfigWarnings, 'warning')}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              </Card>
            ) : null}

            <div className="system-monitor__resourceGrid">
              <Card
                title={<Space className="system-monitor__statusTitle">{t('pages.systemMonitor.database')} {statusTag(databaseStatus.status, databaseStatus.ready, statusLabels)}</Space>}
                className="system-monitor__card"
              >
                <Space direction="vertical" className="system-monitor__databaseInfo">
                  <DatabaseOutlined className="system-monitor__largeIcon" />
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(databaseStatus.ready, readyLabels)}</Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.latency')}>{formatLatency(databaseStatus.latencyMs)}</Descriptions.Item>
                    <Descriptions.Item label="URL"><Text>{maskDatabaseUrl(databaseStatus.url)}</Text></Descriptions.Item>
                    <Descriptions.Item label={t('pages.systemMonitor.driver')}>{databaseStatus.driver || '-'}</Descriptions.Item>
                    {databaseStatus.error ? (
                      <Descriptions.Item label={t('pages.systemMonitor.error')}>{databaseStatus.error}</Descriptions.Item>
                    ) : null}
                  </Descriptions>
                </Space>
              </Card>

              <Card
                title={<Space className="system-monitor__statusTitle">Redis {statusTag(redisStatus.status, redisStatus.ready, statusLabels)}</Space>}
                className="system-monitor__card"
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(redisStatus.ready, readyLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.required')}>{booleanTag(redisStatus.required, booleanLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.address')}>{redisStatus.host || '-'}:{redisStatus.port || '-'}</Descriptions.Item>
                  <Descriptions.Item label="DB">{redisStatus.database || '0'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.latency')}>{formatLatency(redisStatus.latencyMs)}</Descriptions.Item>
                  <Descriptions.Item label="PING">{redisStatus.ping || '-'}</Descriptions.Item>
                  {redisStatus.error ? (
                    <Descriptions.Item label={t('pages.systemMonitor.error')}>{redisStatus.error}</Descriptions.Item>
                  ) : null}
                </Descriptions>
              </Card>

              <Card
                title={<Space className="system-monitor__statusTitle">{t('pages.systemMonitor.nacosDiscovery')} {statusTag(nacosStatus.status, nacosStatus.ready, statusLabels)}</Space>}
                className="system-monitor__card"
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(nacosStatus.ready, readyLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.address')}>{nacosStatus.serverAddr || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.namespace')}>{nacosStatus.namespace || 'public'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.group')}>{nacosStatus.group || 'DEFAULT_GROUP'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.config')}>{booleanTag(nacosStatus.configEnabled, booleanLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.discovery')}>
                    {booleanTag(nacosStatus.discoveryEnabled, booleanLabels)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.register')}>
                    {booleanTag(nacosStatus.registerEnabled, booleanLabels)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.serviceStatus')}>{nacosStatus.serverStatus || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Data ID">{nacosStatus.dataId || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.latency')}>{formatLatency(nacosStatus.latencyMs)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.warnings')}>{renderMessages(nacosStatus.warnings, 'warning')}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.systemMonitor.error')}>
                    {nacosStatus.error || renderMessages(nacosStatus.errors, 'error')}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Card title={t('pages.systemMonitor.opsTips')} className="system-monitor__card">
              <Space direction="vertical">
                <Text><HddOutlined /> {t('pages.systemMonitor.diskTip')}</Text>
                <Text><CloudServerOutlined /> {t('pages.systemMonitor.nacosTip')}</Text>
                <Text><DatabaseOutlined /> {t('pages.systemMonitor.databaseTip')}</Text>
              </Space>
            </Card>
          </>
        ) : (
          <Card className="system-monitor__card">
            <Text type="secondary">{t('pages.systemMonitor.noStatus')}</Text>
          </Card>
        )}
        </Spin>
      </div>
    </div>
  );
};

export default SystemMonitor;
