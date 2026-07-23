import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import { ApiOutlined, CloudServerOutlined, LinkOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { apiBaseUrl } from '../api';
import { adminApi } from '../api/admin';
import { apiGatewayEnabled, apiGatewayPrefix } from '../utils/apiDispatcher';
import type { AdminRegistryInstance, AdminRegistryServiceSummary, AdminRegistryStatus } from '../types';
import { useLanguage } from '../i18n';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import './RegistryManagement.css';
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
const Title = ShopTypography.Title;
const Text = ShopTypography.Text;

const boolTag = (value: boolean | undefined, labels: { enabled: string; disabled: string }) => (
  <ShopTag color={value ? 'green' : 'red'}>{value ? labels.enabled : labels.disabled}</ShopTag>
);

const RegistryManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<AdminRegistryStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serviceKeyword, setServiceKeyword] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const response = await adminApi.getRegistryStatus();
      setStatus(response.data);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.registryAdmin.loadFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const registryReady = Boolean(status?.healthy);
  const knownServices = useMemo(() => status?.knownServices || [], [status]);
  const serviceSummaries = useMemo(() => status?.serviceSummaries || [], [status]);
  const filteredServiceSummaries = useMemo(() => {
    const text = serviceKeyword.trim().toLowerCase();
    if (!text) return serviceSummaries;
    return serviceSummaries.filter((service) => {
      const haystack = [
        service.serviceId,
        ...(service.instances || []).flatMap((instance) => [instance.host, instance.port, instance.uri]),
      ].join(' ').toLowerCase();
      return haystack.includes(text);
    });
  }, [serviceKeyword, serviceSummaries]);
  const frontendGatewayReady = apiGatewayEnabled || apiBaseUrl === '/api' || apiBaseUrl.endsWith('/api');
  const boolLabels = {
    enabled: t('pages.registryAdmin.enabledStatus'),
    disabled: t('pages.registryAdmin.disabledStatus'),
  };
  const refreshRegistryStatusActionLabel = `${t('common.refresh')}: ${t('pages.registryAdmin.title')}`;
  const serviceSearchInputLabel = `${t('common.search')}: ${t('pages.registryAdmin.discoveredServiceList')}`;

  return (
    <div className="registry-management">
      <div className="registry-management__hero">
        <div>
          <Text className="registry-management__eyebrow">{t('pages.registryAdmin.eyebrow')}</Text>
          <Title level={2}>{t('pages.registryAdmin.title')}</Title>
          <Text type="secondary">{t('pages.registryAdmin.description')}</Text>
        </div>
        <ShopButton icon={<ReloadOutlined />} aria-label={refreshRegistryStatusActionLabel} title={refreshRegistryStatusActionLabel} onClick={loadStatus} loading={loading}>
          {t('common.refresh')}
        </ShopButton>
      </div>

      {loadError && status ? (
        <ShopAlert
          className="registry-management__alert"
          type="warning"
          showIcon
          message={loadError}
          description={t('pages.registryAdmin.staleDataWarning')}
          action={(
            <ShopSpace wrap data-admin-registry-stale-recovery="true">
              <ShopButton size="small" type="primary" onClick={loadStatus} loading={loading}>
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
        <div className="registry-management__error" data-admin-registry-load-recovery="true">
          <PageError
            title={t('pages.registryAdmin.loadFailed')}
            description={loadError}
            actions={[
              { key: 'retry', label: t('common.retry'), onClick: () => { void loadStatus(); }, type: 'primary' },
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
        {loadError && !status ? null : <div className="registry-management__stats">
          <ShopCard>
            <ShopStatistic title={t('pages.registryAdmin.serviceName')} value={status?.applicationName || '-'} prefix={<ApiOutlined />} />
          </ShopCard>
          <ShopCard>
            <ShopStatistic
              title={t('pages.registryAdmin.registrationStatus')}
              value={registryReady ? t('pages.registryAdmin.registered') : t('pages.registryAdmin.notReady')}
              valueStyle={{ color: registryReady ? '#1f8a4c' : '#c46a14' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </ShopCard>
          <ShopCard>
            <ShopStatistic title={t('pages.registryAdmin.discoveredServices')} value={knownServices.length} />
          </ShopCard>
          <ShopCard>
            <ShopStatistic title={t('pages.registryAdmin.currentInstances')} value={status?.instanceCount || status?.instances?.length || 0} prefix={<CloudServerOutlined />} />
          </ShopCard>
        </div>}

        {status ? (
          <>
            <ShopAlert
              className="registry-management__alert"
              type={registryReady ? 'success' : 'warning'}
              showIcon
              message={registryReady ? t('pages.registryAdmin.readyMessage') : t('pages.registryAdmin.notReadyMessage')}
              description={registryReady
                ? t('pages.registryAdmin.readyDescription')
                : t('pages.registryAdmin.notReadyDescription')}
            />

            <div className="registry-management__grid">
              <ShopCard title={t('pages.registryAdmin.registryConfig')} className="registry-management__card">
                <ShopDescriptions column={1} bordered size="small">
                  <ShopDescriptions.Item label={t('pages.registryAdmin.nacosAddress')}>{status.nacosServerAddr || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.namespace')}>{status.namespace || 'public'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.group')}>{status.group || 'DEFAULT_GROUP'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.discoveryEnabled')}>{boolTag(status.discoveryEnabled, boolLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.registerEnabled')}>{boolTag(status.registerEnabled, boolLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.ephemeral')}>{boolTag(status.ephemeral, boolLabels)}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.weight')}>{status.weight || '1'}</ShopDescriptions.Item>
                </ShopDescriptions>
              </ShopCard>

              <ShopCard title={t('pages.registryAdmin.currentInstanceConfig')} className="registry-management__card">
                <ShopDescriptions column={1} bordered size="small">
                  <ShopDescriptions.Item label={t('pages.registryAdmin.applicationPort')}>{status.serverPort || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.registryIp')}>{status.configuredIp || 'auto'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.registryPort')}>{status.configuredPort || status.serverPort || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label="DiscoveryClient">{status.discoveryClientDescription || '-'}</ShopDescriptions.Item>
                  <ShopDescriptions.Item label={t('pages.registryAdmin.profiles')}>
                    {(status.profiles || []).length
                      ? status.profiles?.map((profile) => <ShopTag key={profile}>{profile}</ShopTag>)
                      : <ShopTag>default</ShopTag>}
                  </ShopDescriptions.Item>
                </ShopDescriptions>
              </ShopCard>
            </div>

            <ShopCard title={t('pages.registryAdmin.frontendGateway')} className="registry-management__card">
              <div className="registry-management__gateway">
                <div>
                  <Text type="secondary">{t('pages.registryAdmin.apiBaseUrl')}</Text>
                  <Text copyable strong>{apiBaseUrl}</Text>
                </div>
                <div>
                  <Text type="secondary">{t('pages.registryAdmin.gatewayPrefix')}</Text>
                  <Text copyable strong>{apiGatewayPrefix}</Text>
                </div>
                <ShopTag color={apiGatewayEnabled ? 'green' : 'red'}>
                  {apiGatewayEnabled ? t('pages.registryAdmin.gatewayDispatchEnabled') : t('pages.registryAdmin.gatewayDispatchDisabled')}
                </ShopTag>
                <ShopTag color={frontendGatewayReady ? 'green' : 'orange'}>
                  {frontendGatewayReady ? t('pages.registryAdmin.frontendProxyReady') : t('pages.registryAdmin.frontendProxyWarning')}
                </ShopTag>
              </div>
            </ShopCard>

            <ShopCard
              title={t('pages.registryAdmin.discoveredServiceList')}
              className="registry-management__card"
              extra={(
                <ShopInput
                  allowClear
                  prefix={<SearchOutlined />}
                  value={serviceKeyword}
                  onChange={(event) => setServiceKeyword(event.target.value)}
                  placeholder={t('common.search')}
                  aria-label={serviceSearchInputLabel}
                  title={serviceSearchInputLabel}
                />
              )}
            >
              {filteredServiceSummaries.length ? (
                <Table<AdminRegistryServiceSummary>
                  rowKey="serviceId"
                  dataSource={filteredServiceSummaries}
                  pagination={false}
                  scroll={{ x: 720 }}
                  columns={[
                    {
                      title: t('pages.registryAdmin.serviceId'),
                      dataIndex: 'serviceId',
                      render: (value: string) => (
                        <ShopTag color={value === status.applicationName ? 'green' : 'blue'}>{value}</ShopTag>
                      ),
                    },
                    { title: t('pages.registryAdmin.instanceCount'), dataIndex: 'instanceCount', width: 100 },
                    {
                      title: t('pages.registryAdmin.instances'),
                      dataIndex: 'instances',
                      render: (instances: AdminRegistryInstance[]) => (
                        <ShopSpace wrap size={[6, 6]}>
                          {instances.map((instance) => (
                            <ShopTag key={`${instance.host}:${instance.port}`}>
                              {instance.host}:{instance.port}
                            </ShopTag>
                          ))}
                        </ShopSpace>
                      ),
                    },
                  ]}
                />
              ) : (
                <ShopEmpty description={t('pages.registryAdmin.noServices')} />
              )}
            </ShopCard>

            <ShopCard title={t('pages.registryAdmin.currentInstanceDetails')} className="registry-management__card">
              <Table<AdminRegistryInstance>
                rowKey={(record) => `${record.host}:${record.port}`}
                dataSource={status.instances || []}
                pagination={false}
                scroll={{ x: 980 }}
                columns={[
                  { title: t('pages.registryAdmin.serviceId'), dataIndex: 'serviceId', width: 180 },
                  { title: t('pages.registryAdmin.host'), dataIndex: 'host', width: 160 },
                  { title: t('pages.registryAdmin.port'), dataIndex: 'port', width: 100 },
                  {
                    title: t('pages.registryAdmin.uri'),
                    dataIndex: 'uri',
                    render: (value: string) => <Text copyable><LinkOutlined /> {value}</Text>,
                  },
                  {
                    title: t('pages.registryAdmin.metadata'),
                    dataIndex: 'metadata',
                    render: (metadata?: Record<string, string>) => (
                      <ShopSpace wrap size={[4, 4]}>
                        {Object.entries(metadata || {}).map(([key, value]) => (
                          <ShopTag key={key}>{key}: {value}</ShopTag>
                        ))}
                      </ShopSpace>
                    ),
                  },
                ]}
              />
            </ShopCard>
          </>
        ) : loadError ? null : (
          <ShopEmpty description={t('pages.registryAdmin.noStatus')} />
        )}
        </ShopSpin>
      </div>
    </div>
  );
};

export default RegistryManagement;
