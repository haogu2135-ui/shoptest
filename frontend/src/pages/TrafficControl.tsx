import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClearOutlined, DashboardOutlined, ReloadOutlined, ThunderboltOutlined, UndoOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminTrafficControlStatus } from '../types';
import './TrafficControl.css';

const { Text, Title } = Typography;

type CircuitRow = AdminTrafficControlStatus['circuits'][number];

const stateColor = (state: string) => {
  if (state === 'OPEN') return 'red';
  if (state === 'HALF_OPEN') return 'gold';
  return 'green';
};

const TrafficControl: React.FC = () => {
  const [status, setStatus] = useState<AdminTrafficControlStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getTrafficControlStatus();
      setStatus(response.data);
    } catch {
      message.error('流量控制状态加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const resetCircuit = async (name?: string) => {
    setActing(name || 'all');
    try {
      const response = await adminApi.resetCircuitBreaker(name);
      setStatus(response.data);
      message.success(name ? '熔断器已重置' : '全部熔断器已重置');
    } catch {
      message.error('熔断器重置失败');
    } finally {
      setActing(null);
    }
  };

  const clearRateLimit = async () => {
    setActing('rate-limit');
    try {
      const response = await adminApi.clearRateLimitCounters();
      setStatus(response.data);
      message.success('限流计数已清空');
    } catch {
      message.error('限流计数清空失败');
    } finally {
      setActing(null);
    }
  };

  const columns: ColumnsType<CircuitRow> = useMemo(() => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 120,
      render: (value: string) => <Tag color={stateColor(value)}>{value}</Tag>,
    },
    {
      title: '失败',
      dataIndex: 'failureCount',
      key: 'failureCount',
      width: 90,
    },
    {
      title: '恢复成功',
      dataIndex: 'halfOpenSuccessCount',
      key: 'halfOpenSuccessCount',
      width: 110,
    },
    {
      title: '打开至',
      dataIndex: 'openedUntil',
      key: 'openedUntil',
      render: (value?: string) => value ? new Date(value).toLocaleString() : '-',
    },
    {
      title: '最近失败',
      dataIndex: 'lastFailureMessage',
      key: 'lastFailureMessage',
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_, row) => (
        <Button
          size="small"
          icon={<UndoOutlined />}
          loading={acting === row.name}
          onClick={() => resetCircuit(row.name)}
        >
          重置
        </Button>
      ),
    },
  ], [acting]);

  const rateLimit = status?.rateLimit;
  const circuitConfig = status?.circuitBreakerConfig;

  return (
    <div className="traffic-control">
      <div className="traffic-control__hero">
        <div>
          <Text className="traffic-control__eyebrow">Traffic Control</Text>
          <Title level={2}>流量控制</Title>
          <Text type="secondary">运行时查看限流计数和外部依赖熔断状态，支持快速清空与重置。</Text>
        </div>
        <Space className="traffic-control__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadStatus}>
            刷新
          </Button>
          <Button icon={<ClearOutlined />} loading={acting === 'rate-limit'} onClick={clearRateLimit}>
            清空限流
          </Button>
          <Button type="primary" icon={<UndoOutlined />} loading={acting === 'all'} onClick={() => resetCircuit()}>
            重置全部熔断
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && !status}>
        <div className="traffic-control__stats">
          <Card>
            <Statistic title="限流状态" value={rateLimit?.enabled ? 'ON' : 'OFF'} prefix={<DashboardOutlined />} />
          </Card>
          <Card>
            <Statistic title="已放行" value={rateLimit?.acceptedRequests || 0} />
          </Card>
          <Card>
            <Statistic title="已拒绝" value={rateLimit?.rejectedRequests || 0} valueStyle={{ color: (rateLimit?.rejectedRequests || 0) > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card>
            <Statistic title="活跃窗口" value={rateLimit?.activeBuckets || 0} />
          </Card>
        </div>

        <div className="traffic-control__grid">
          <Card title="限流配置" className="traffic-control__card">
            <div className="traffic-control__configList">
              <span>游客每分钟 <strong>{rateLimit?.publicPerMinute ?? '-'}</strong></span>
              <span>登录用户每分钟 <strong>{rateLimit?.authenticatedPerMinute ?? '-'}</strong></span>
              <span>管理员每分钟 <strong>{rateLimit?.adminPerMinute ?? '-'}</strong></span>
              <span>窗口秒数 <strong>{rateLimit?.windowSeconds ?? '-'}</strong></span>
            </div>
          </Card>

          <Card title="熔断配置" className="traffic-control__card">
            <div className="traffic-control__configList">
              <span>熔断状态 <Tag color={circuitConfig?.enabled ? 'green' : 'default'}>{circuitConfig?.enabled ? 'ON' : 'OFF'}</Tag></span>
              <span>失败阈值 <strong>{circuitConfig?.failureThreshold ?? '-'}</strong></span>
              <span>打开秒数 <strong>{circuitConfig?.openSeconds ?? '-'}</strong></span>
              <span>半开成功阈值 <strong>{circuitConfig?.halfOpenSuccessThreshold ?? '-'}</strong></span>
            </div>
          </Card>
        </div>

        <Alert
          className="traffic-control__alert"
          type="info"
          showIcon
          message="这些参数可通过配置中心实时调整：traffic.rate-limit.* 和 traffic.circuit-breaker.*。"
        />

        <Card title={<span><ThunderboltOutlined /> 熔断器</span>} className="traffic-control__card">
          {status?.circuits?.length ? (
            <Table
              rowKey="name"
              columns={columns}
              dataSource={status.circuits}
              pagination={false}
              scroll={{ x: 860 }}
            />
          ) : (
            <Empty description="还没有外部依赖调用记录" />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default TrafficControl;
