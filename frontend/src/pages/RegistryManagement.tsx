import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Input, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { ApiOutlined, CloudServerOutlined, LinkOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { apiBaseUrl } from '../api';
import { adminApi } from '../api/admin';
import { apiGatewayEnabled, apiGatewayPrefix } from '../utils/apiDispatcher';
import type { AdminRegistryInstance, AdminRegistryServiceSummary, AdminRegistryStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import './RegistryManagement.css';

const { Title, Text } = Typography;

const boolTag = (value: boolean | undefined, labels: { enabled: string; disabled: string }) => (
  <Tag color={value ? 'green' : 'red'}>{value ? labels.enabled : labels.disabled}</Tag>
);

const RegistryManagement: React.FC = () => {
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
        <Button icon={<ReloadOutlined />} aria-label={refreshRegistryStatusActionLabel} title={refreshRegistryStatusActionLabel} onClick={loadStatus} loading={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      {loadError ? (
        <Alert
          className="registry-management__alert"
          type="warning"
          showIcon
          message={loadError}
          description={status ? t('pages.registryAdmin.staleDataWarning') : undefined}
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
        {loadError && !status ? null : <div className="registry-management__stats">
          <Card>
            <Statistic title={t('pages.registryAdmin.serviceName')} value={status?.applicationName || '-'} prefix={<ApiOutlined />} />
          </Card>
          <Card>
            <Statistic
              title={t('pages.registryAdmin.registrationStatus')}
              value={registryReady ? t('pages.registryAdmin.registered') : t('pages.registryAdmin.notReady')}
              valueStyle={{ color: registryReady ? '#1f8a4c' : '#c46a14' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
          <Card>
            <Statistic title={t('pages.registryAdmin.discoveredServices')} value={knownServices.length} />
          </Card>
          <Card>
            <Statistic title={t('pages.registryAdmin.currentInstances')} value={status?.instanceCount || status?.instances?.length || 0} prefix={<CloudServerOutlined />} />
          </Card>
        </div>}

        {status ? (
          <>
            <Alert
              className="registry-management__alert"
              type={registryReady ? 'success' : 'warning'}
              showIcon
              message={registryReady ? t('pages.registryAdmin.readyMessage') : t('pages.registryAdmin.notReadyMessage')}
              description={registryReady
                ? t('pages.registryAdmin.readyDescription')
                : t('pages.registryAdmin.notReadyDescription')}
            />

            <div className="registry-management__grid">
              <Card title={t('pages.registryAdmin.registryConfig')} className="registry-management__card">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label={t('pages.registryAdmin.nacosAddress')}>{status.nacosServerAddr || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.namespace')}>{status.namespace || 'public'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.group')}>{status.group || 'DEFAULT_GROUP'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.discoveryEnabled')}>{boolTag(status.discoveryEnabled, boolLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.registerEnabled')}>{boolTag(status.registerEnabled, boolLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.ephemeral')}>{boolTag(status.ephemeral, boolLabels)}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.weight')}>{status.weight || '1'}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title={t('pages.registryAdmin.currentInstanceConfig')} className="registry-management__card">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label={t('pages.registryAdmin.applicationPort')}>{status.serverPort || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.registryIp')}>{status.configuredIp || 'auto'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.registryPort')}>{status.configuredPort || status.serverPort || '-'}</Descriptions.Item>
                  <Descriptions.Item label="DiscoveryClient">{status.discoveryClientDescription || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.profiles')}>
                    {(status.profiles || []).length
                      ? status.profiles?.map((profile) => <Tag key={profile}>{profile}</Tag>)
                      : <Tag>default</Tag>}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Card title={t('pages.registryAdmin.frontendGateway')} className="registry-management__card">
              <div className="registry-management__gateway">
                <div>
                  <Text type="secondary">{t('pages.registryAdmin.apiBaseUrl')}</Text>
                  <Text copyable strong>{apiBaseUrl}</Text>
                </div>
                <div>
                  <Text type="secondary">{t('pages.registryAdmin.gatewayPrefix')}</Text>
                  <Text copyable strong>{apiGatewayPrefix}</Text>
                </div>
                <Tag color={apiGatewayEnabled ? 'green' : 'red'}>
                  {apiGatewayEnabled ? t('pages.registryAdmin.gatewayDispatchEnabled') : t('pages.registryAdmin.gatewayDispatchDisabled')}
                </Tag>
                <Tag color={frontendGatewayReady ? 'green' : 'orange'}>
                  {frontendGatewayReady ? t('pages.registryAdmin.frontendProxyReady') : t('pages.registryAdmin.frontendProxyWarning')}
                </Tag>
              </div>
            </Card>

            <Card
              title={t('pages.registryAdmin.discoveredServiceList')}
              className="registry-management__card"
              extra={(
                <Input
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
                        <Tag color={value === status.applicationName ? 'green' : 'blue'}>{value}</Tag>
                      ),
                    },
                    { title: t('pages.registryAdmin.instanceCount'), dataIndex: 'instanceCount', width: 100 },
                    {
                      title: t('pages.registryAdmin.instances'),
                      dataIndex: 'instances',
                      render: (instances: AdminRegistryInstance[]) => (
                        <Space wrap size={[6, 6]}>
                          {instances.map((instance) => (
                            <Tag key={`${instance.host}:${instance.port}`}>
                              {instance.host}:{instance.port}
                            </Tag>
                          ))}
                        </Space>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty description={t('pages.registryAdmin.noServices')} />
              )}
            </Card>

            <Card title={t('pages.registryAdmin.currentInstanceDetails')} className="registry-management__card">
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
                      <Space wrap size={[4, 4]}>
                        {Object.entries(metadata || {}).map(([key, value]) => (
                          <Tag key={key}>{key}: {value}</Tag>
                        ))}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </>
        ) : loadError ? null : (
          <Empty description={t('pages.registryAdmin.noStatus')} />
        )}
        </Spin>
      </div>
    </div>
  );
};

export default RegistryManagement;
