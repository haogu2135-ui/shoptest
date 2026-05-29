import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Input, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { ApiOutlined, CloudServerOutlined, LinkOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi, apiBaseUrl } from '../api';
import { apiGatewayEnabled, apiGatewayPrefix } from '../utils/apiDispatcher';
import type { AdminRegistryInstance, AdminRegistryServiceSummary, AdminRegistryStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import './RegistryManagement.css';

const { Title, Text } = Typography;

const boolTag = (value?: boolean) => (
  <Tag color={value ? 'green' : 'red'}>{String(Boolean(value))}</Tag>
);

const RegistryManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<AdminRegistryStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceKeyword, setServiceKeyword] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getRegistryStatus();
      setStatus(response.data);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.registryAdmin.loadFailed'), language));
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

  return (
    <div className="registry-management">
      <div className="registry-management__hero">
        <div>
          <Text className="registry-management__eyebrow">Nacos Discovery</Text>
          <Title level={2}>{t('pages.registryAdmin.title')}</Title>
          <Text type="secondary">{t('pages.registryAdmin.description')}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      <Spin spinning={loading && !status}>
        <div className="registry-management__stats">
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
        </div>

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
                  <Descriptions.Item label="Namespace">{status.namespace || 'public'}</Descriptions.Item>
                  <Descriptions.Item label="Group">{status.group || 'DEFAULT_GROUP'}</Descriptions.Item>
                  <Descriptions.Item label="Discovery Enabled">{boolTag(status.discoveryEnabled)}</Descriptions.Item>
                  <Descriptions.Item label="Register Enabled">{boolTag(status.registerEnabled)}</Descriptions.Item>
                  <Descriptions.Item label="Ephemeral">{boolTag(status.ephemeral)}</Descriptions.Item>
                  <Descriptions.Item label="Weight">{status.weight || '1'}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title={t('pages.registryAdmin.currentInstanceConfig')} className="registry-management__card">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label={t('pages.registryAdmin.applicationPort')}>{status.serverPort || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.registryIp')}>{status.configuredIp || 'auto'}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.registryAdmin.registryPort')}>{status.configuredPort || status.serverPort || '-'}</Descriptions.Item>
                  <Descriptions.Item label="DiscoveryClient">{status.discoveryClientDescription || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Profiles">
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
                  <Text type="secondary">API Base URL</Text>
                  <Text copyable strong>{apiBaseUrl}</Text>
                </div>
                <div>
                  <Text type="secondary">Gateway Prefix</Text>
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
                      title: 'Service ID',
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
                  { title: 'Service ID', dataIndex: 'serviceId', width: 180 },
                  { title: 'Host', dataIndex: 'host', width: 160 },
                  { title: 'Port', dataIndex: 'port', width: 100 },
                  {
                    title: 'URI',
                    dataIndex: 'uri',
                    render: (value: string) => <Text copyable><LinkOutlined /> {value}</Text>,
                  },
                  {
                    title: 'Metadata',
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
        ) : (
          <Empty description={t('pages.registryAdmin.noStatus')} />
        )}
      </Spin>
    </div>
  );
};

export default RegistryManagement;
