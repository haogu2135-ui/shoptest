import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Progress, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { CloudServerOutlined, DatabaseOutlined, HddOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { adminApi, apiBaseUrl } from '../api';
import type { AdminSystemStatus } from '../types';
import './SystemMonitor.css';

const { Title, Text } = Typography;

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDuration = (ms?: number) => {
  const totalSeconds = Math.floor(Number(ms || 0) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
};

const statusColor = (value: boolean) => value ? 'green' : 'red';

const SystemMonitor: React.FC = () => {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getSystemStatus();
      setStatus(response.data);
    } catch {
      message.error('系统监控状态加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const memoryRisk = Number(status?.memory.usedPercent || 0) >= 85;
  const diskRisk = Number(status?.disk.usedPercent || 0) >= 85;
  const healthText = useMemo(() => {
    if (!status) return '未知';
    if (memoryRisk || diskRisk) return '需要关注';
    return '运行正常';
  }, [diskRisk, memoryRisk, status]);

  return (
    <div className="system-monitor">
      <div className="system-monitor__hero">
        <div>
          <Text className="system-monitor__eyebrow">Operations Console</Text>
          <Title level={2}>系统监控</Title>
          <Text type="secondary">集中查看后台服务运行状态、资源占用、数据库连接摘要和 Nacos 配置。</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadStatus} loading={loading}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading && !status}>
        {status ? (
          <>
            <div className="system-monitor__stats">
              <Card>
                <Statistic title="整体状态" value={healthText} valueStyle={{ color: memoryRisk || diskRisk ? '#c46a14' : '#1f8a4c' }} prefix={<SettingOutlined />} />
              </Card>
              <Card>
                <Statistic title="应用名称" value={status.application.name} prefix={<CloudServerOutlined />} />
              </Card>
              <Card>
                <Statistic title="运行时间" value={formatDuration(status.runtime.uptimeMs)} />
              </Card>
              <Card>
                <Statistic title="CPU 核心" value={status.runtime.processors} />
              </Card>
            </div>

            {(memoryRisk || diskRisk) ? (
              <Alert
                className="system-monitor__alert"
                type="warning"
                showIcon
                message="资源使用率偏高"
                description="建议检查 JVM 内存、磁盘空间或日志/上传文件占用，避免影响订单和支付流程。"
              />
            ) : (
              <Alert
                className="system-monitor__alert"
                type="success"
                showIcon
                message="后台服务运行正常"
                description="当前内存和磁盘占用处于可接受范围。"
              />
            )}

            <div className="system-monitor__resourceGrid">
              <Card title="JVM 内存" className="system-monitor__card">
                <Progress
                  type="dashboard"
                  percent={Math.round(Number(status.memory.usedPercent || 0))}
                  status={memoryRisk ? 'exception' : 'normal'}
                />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="已用">{formatBytes(status.memory.usedBytes)}</Descriptions.Item>
                  <Descriptions.Item label="可用上限">{formatBytes(status.memory.maxBytes)}</Descriptions.Item>
                  <Descriptions.Item label="空闲">{formatBytes(status.memory.freeBytes)}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="磁盘空间" className="system-monitor__card">
                <Progress
                  type="dashboard"
                  percent={Math.round(Number(status.disk.usedPercent || 0))}
                  status={diskRisk ? 'exception' : 'normal'}
                />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="路径">{status.disk.path}</Descriptions.Item>
                  <Descriptions.Item label="已用">{formatBytes(status.disk.usedBytes)}</Descriptions.Item>
                  <Descriptions.Item label="总量">{formatBytes(status.disk.totalBytes)}</Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Card title="运行环境" className="system-monitor__card">
              <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
                <Descriptions.Item label="API 地址">{apiBaseUrl}</Descriptions.Item>
                <Descriptions.Item label="端口">{status.application.serverPort}</Descriptions.Item>
                <Descriptions.Item label="模式">{status.application.runtimeMode}</Descriptions.Item>
                <Descriptions.Item label="Profile">
                  {status.application.profiles.length ? status.application.profiles.map((profile) => <Tag key={profile}>{profile}</Tag>) : <Tag>default</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Java">{status.runtime.javaVersion}</Descriptions.Item>
                <Descriptions.Item label="系统">{status.runtime.osName} {status.runtime.osVersion}</Descriptions.Item>
              </Descriptions>
            </Card>

            <div className="system-monitor__resourceGrid">
              <Card title="数据库" className="system-monitor__card">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <DatabaseOutlined className="system-monitor__largeIcon" />
                  <Text copyable>{status.database.url || '-'}</Text>
                  <Text type="secondary">{status.database.driver || '-'}</Text>
                </Space>
              </Card>

              <Card title="Nacos 注册发现" className="system-monitor__card">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="地址">{status.nacos.serverAddr || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Namespace">{status.nacos.namespace || 'public'}</Descriptions.Item>
                  <Descriptions.Item label="Group">{status.nacos.group || 'DEFAULT_GROUP'}</Descriptions.Item>
                  <Descriptions.Item label="Discovery">
                    <Tag color={statusColor(status.nacos.discoveryEnabled)}>{String(status.nacos.discoveryEnabled)}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Register">
                    <Tag color={statusColor(status.nacos.registerEnabled)}>{String(status.nacos.registerEnabled)}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>

            <Card title="运维提示" className="system-monitor__card">
              <Space direction="vertical">
                <Text><HddOutlined /> 磁盘超过 85% 时，优先检查 `logs`、`uploads` 和历史导出文件。</Text>
                <Text><CloudServerOutlined /> Nacos 注册异常时，确认 `NACOS_SERVER_ADDR`、namespace 和 group 与网关一致。</Text>
                <Text><DatabaseOutlined /> 数据库 URL 已隐藏密码，但仍不建议把该页面开放给非管理员角色。</Text>
              </Space>
            </Card>
          </>
        ) : (
          <Card className="system-monitor__card">
            <Text type="secondary">暂无系统状态。</Text>
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default SystemMonitor;
