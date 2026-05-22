import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { ApiOutlined, CloudServerOutlined, LinkOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { adminApi, apiBaseUrl } from '../api';
import { apiGatewayEnabled, apiGatewayPrefix } from '../utils/apiDispatcher';
import type { AdminRegistryInstance, AdminRegistryServiceSummary, AdminRegistryStatus } from '../types';
import './RegistryManagement.css';

const { Title, Text } = Typography;

const boolTag = (value?: boolean) => (
  <Tag color={value ? 'green' : 'red'}>{String(Boolean(value))}</Tag>
);

const RegistryManagement: React.FC = () => {
  const [status, setStatus] = useState<AdminRegistryStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getRegistryStatus();
      setStatus(response.data);
    } catch {
      message.error('服务注册状态加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const registryReady = Boolean(status?.healthy);
  const knownServices = useMemo(() => status?.knownServices || [], [status]);
  const serviceSummaries = useMemo(() => status?.serviceSummaries || [], [status]);
  const frontendGatewayReady = apiGatewayEnabled && apiBaseUrl.includes(':8080');

  return (
    <div className="registry-management">
      <div className="registry-management__hero">
        <div>
          <Text className="registry-management__eyebrow">Nacos Discovery</Text>
          <Title level={2}>服务注册中心</Title>
          <Text type="secondary">集中查看后端注册状态、Nacos 配置、已发现服务，以及前台是否正在走网关。</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading && !status}>
        <div className="registry-management__stats">
          <Card>
            <Statistic title="服务名" value={status?.applicationName || '-'} prefix={<ApiOutlined />} />
          </Card>
          <Card>
            <Statistic
              title="注册状态"
              value={registryReady ? '已注册' : '未就绪'}
              valueStyle={{ color: registryReady ? '#1f8a4c' : '#c46a14' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
          <Card>
            <Statistic title="发现服务数" value={knownServices.length} />
          </Card>
          <Card>
            <Statistic title="当前实例数" value={status?.instanceCount || status?.instances?.length || 0} prefix={<CloudServerOutlined />} />
          </Card>
        </div>

        {status ? (
          <>
            <Alert
              className="registry-management__alert"
              type={registryReady ? 'success' : 'warning'}
              showIcon
              message={registryReady ? '当前后端已被注册中心发现' : '当前后端注册状态未就绪'}
              description={registryReady
                ? '网关和后续拆分出的微服务可以通过服务名调用当前后端。'
                : '请确认 Nacos Server 已启动，NACOS_SERVER_ADDR / namespace / group 与网关一致，并且 NACOS_REGISTER_ENABLED=true。'}
            />

            <div className="registry-management__grid">
              <Card title="注册配置" className="registry-management__card">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Nacos 地址">{status.nacosServerAddr || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Namespace">{status.namespace || 'public'}</Descriptions.Item>
                  <Descriptions.Item label="Group">{status.group || 'DEFAULT_GROUP'}</Descriptions.Item>
                  <Descriptions.Item label="Discovery Enabled">{boolTag(status.discoveryEnabled)}</Descriptions.Item>
                  <Descriptions.Item label="Register Enabled">{boolTag(status.registerEnabled)}</Descriptions.Item>
                  <Descriptions.Item label="Ephemeral">{boolTag(status.ephemeral)}</Descriptions.Item>
                  <Descriptions.Item label="Weight">{status.weight || '1'}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="当前实例参数" className="registry-management__card">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="应用端口">{status.serverPort || '-'}</Descriptions.Item>
                  <Descriptions.Item label="注册 IP">{status.configuredIp || 'auto'}</Descriptions.Item>
                  <Descriptions.Item label="注册端口">{status.configuredPort || status.serverPort || '-'}</Descriptions.Item>
                  <Descriptions.Item label="DiscoveryClient">{status.discoveryClientDescription || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Profiles">
                    {(status.profiles || []).length
                      ? status.profiles?.map((profile) => <Tag key={profile}>{profile}</Tag>)
                      : <Tag>default</Tag>}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Card title="前台网关适配" className="registry-management__card">
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
                  {apiGatewayEnabled ? '前台请求会按服务域分发' : '前台网关分发已关闭'}
                </Tag>
                <Tag color={frontendGatewayReady ? 'green' : 'orange'}>
                  {frontendGatewayReady ? '默认指向网关 8080' : '请确认 API Base URL 是否指向网关'}
                </Tag>
              </div>
            </Card>

            <Card title="已发现服务" className="registry-management__card">
              {serviceSummaries.length ? (
                <Table<AdminRegistryServiceSummary>
                  rowKey="serviceId"
                  dataSource={serviceSummaries}
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
                    { title: '实例数', dataIndex: 'instanceCount', width: 100 },
                    {
                      title: '实例',
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
                <Empty description="暂无服务" />
              )}
            </Card>

            <Card title="当前服务实例详情" className="registry-management__card">
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
          <Empty description="暂无注册中心状态" />
        )}
      </Spin>
    </div>
  );
};

export default RegistryManagement;
