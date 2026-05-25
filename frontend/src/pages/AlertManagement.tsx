import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, Popconfirm, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertOutlined, CheckCircleOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { SystemAlert, SystemAlertSummary } from '../types';
import './AlertManagement.css';

const { Text, Title } = Typography;

const severityColor = (severity: string) => {
  if (severity === 'CRITICAL') return 'magenta';
  if (severity === 'ERROR') return 'red';
  if (severity === 'WARNING') return 'gold';
  return 'blue';
};

const statusColor = (status: string) => {
  if (status === 'OPEN') return 'red';
  if (status === 'ACKNOWLEDGED') return 'gold';
  return 'green';
};

const formatTime = (value?: string) => value ? new Date(value).toLocaleString() : '-';

const AlertManagement: React.FC = () => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [summary, setSummary] = useState<SystemAlertSummary | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [severity, setSeverity] = useState('ALL');
  const [category, setCategory] = useState('');
  const [selectedAlertIds, setSelectedAlertIds] = useState<number[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertResponse, summaryResponse] = await Promise.all([
        adminApi.getAlerts({
          status: status === 'ALL' ? undefined : status,
          severity: severity === 'ALL' ? undefined : severity,
          category: category.trim() || undefined,
          limit: 300,
        }),
        adminApi.getAlertSummary(),
      ]);
      setAlerts(alertResponse.data);
      setSummary(summaryResponse.data);
      setSelectedAlertIds((ids) => ids.filter((id) => alertResponse.data.some((alert) => alert.id === id)));
    } catch {
      message.error('告警数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, severity, status]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runSelfCheck = async () => {
    setActing('self-check');
    try {
      await adminApi.runAlertSelfCheck();
      message.success('自检已执行');
      await loadData();
    } catch {
      message.error('自检执行失败');
    } finally {
      setActing(null);
    }
  };

  const acknowledge = useCallback(async (alert: SystemAlert) => {
    setActing(`ack-${alert.id}`);
    try {
      const response = await adminApi.acknowledgeAlert(alert.id);
      setAlerts((items) => items.map((item) => item.id === alert.id ? response.data : item));
      message.success('告警已确认');
      loadData();
    } catch {
      message.error('确认失败');
    } finally {
      setActing(null);
    }
  }, [loadData]);

  const resolve = useCallback(async (alert: SystemAlert) => {
    setActing(`resolve-${alert.id}`);
    try {
      const response = await adminApi.resolveAlert(alert.id);
      setAlerts((items) => items.map((item) => item.id === alert.id ? response.data : item));
      message.success('告警已解决');
      loadData();
    } catch {
      message.error('解决失败');
    } finally {
      setActing(null);
    }
  }, [loadData]);

  const selectedAlerts = useMemo(
    () => alerts.filter((alert) => selectedAlertIds.includes(alert.id)),
    [alerts, selectedAlertIds]
  );
  const selectedOpenIds = useMemo(
    () => selectedAlerts.filter((alert) => alert.status === 'OPEN').map((alert) => alert.id),
    [selectedAlerts]
  );
  const selectedUnresolvedIds = useMemo(
    () => selectedAlerts.filter((alert) => alert.status !== 'RESOLVED').map((alert) => alert.id),
    [selectedAlerts]
  );

  const batchAcknowledge = async () => {
    if (!selectedOpenIds.length) {
      message.warning('请选择未处理告警');
      return;
    }
    setActing('batch-ack');
    try {
      const response = await adminApi.acknowledgeAlerts(selectedOpenIds, 'Batch acknowledged from alert center');
      message.success(`已确认 ${response.data.updatedCount} 条告警`);
      setSelectedAlertIds([]);
      await loadData();
    } catch {
      message.error('批量确认失败');
    } finally {
      setActing(null);
    }
  };

  const batchResolve = async () => {
    if (!selectedUnresolvedIds.length) {
      message.warning('请选择未解决告警');
      return;
    }
    setActing('batch-resolve');
    try {
      const response = await adminApi.resolveAlerts(selectedUnresolvedIds, 'Batch resolved from alert center');
      message.success(`已解决 ${response.data.updatedCount} 条告警`);
      setSelectedAlertIds([]);
      await loadData();
    } catch {
      message.error('批量解决失败');
    } finally {
      setActing(null);
    }
  };

  const purgeResolved = async () => {
    setActing('purge-resolved');
    try {
      const response = await adminApi.purgeResolvedAlerts(retentionDays);
      message.success(`已清理 ${response.data.deletedCount} 条已解决告警`);
      await loadData();
    } catch {
      message.error('清理已解决告警失败');
    } finally {
      setActing(null);
    }
  };

  const columns: ColumnsType<SystemAlert> = useMemo(() => [
    {
      title: '告警',
      dataIndex: 'title',
      key: 'title',
      render: (_, record) => (
        <div className="alert-management__titleCell">
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.message || record.fingerprint}</Text>
        </div>
      ),
    },
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (value: string) => <Tag color={severityColor(value)}>{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '次数',
      dataIndex: 'occurrenceCount',
      key: 'occurrenceCount',
      width: 80,
    },
    {
      title: '最近出现',
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      width: 190,
      render: formatTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space wrap>
          {record.status === 'OPEN' ? (
            <Button size="small" loading={acting === `ack-${record.id}`} onClick={() => acknowledge(record)}>
              确认
            </Button>
          ) : null}
          {record.status !== 'RESOLVED' ? (
            <Button size="small" type="primary" loading={acting === `resolve-${record.id}`} onClick={() => resolve(record)}>
              解决
            </Button>
          ) : null}
        </Space>
      ),
    },
  ], [acknowledge, acting, resolve]);

  return (
    <div className="alert-management">
      <div className="alert-management__hero">
        <div>
          <Text className="alert-management__eyebrow">Alerts</Text>
          <Title level={2}>告警中心</Title>
          <Text type="secondary">自动检测常见异常、基础设施状态和流量风险，统一确认与处理。</Text>
        </div>
        <Space className="alert-management__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            刷新
          </Button>
          <Button type="primary" icon={<ToolOutlined />} loading={acting === 'self-check'} onClick={runSelfCheck}>
            立即自检
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && alerts.length === 0}>
        <div className="alert-management__stats">
          <Card>
            <Statistic title="未处理" value={summary?.openCount || 0} prefix={<AlertOutlined />} valueStyle={{ color: (summary?.openCount || 0) > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card>
            <Statistic title="已确认" value={summary?.acknowledgedCount || 0} />
          </Card>
          <Card>
            <Statistic title="已解决" value={summary?.resolvedCount || 0} prefix={<CheckCircleOutlined />} />
          </Card>
          <Card>
            <Statistic title="严重/错误" value={(summary?.openBySeverity?.CRITICAL || 0) + (summary?.openBySeverity?.ERROR || 0)} />
          </Card>
        </div>

        <Alert
          className="alert-management__alert"
          type="info"
          showIcon
          message="告警会按 fingerprint 自动合并重复事件；异常上报和自检阈值可通过 alerts.* 配置实时调整。"
        />

        <Card className="alert-management__card">
          <Space className="alert-management__filters" wrap>
            <Select
              value={status}
              onChange={setStatus}
              options={['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map((value) => ({ value, label: value }))}
            />
            <Select
              value={severity}
              onChange={setSeverity}
              options={['ALL', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((value) => ({ value, label: value }))}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              onPressEnter={loadData}
              placeholder="分类"
            />
            <Button onClick={loadData}>筛选</Button>
          </Space>

          <div className="alert-management__bulkBar">
            <Space wrap>
              <Text type="secondary">
                已选 {selectedAlertIds.length} 条，未处理 {selectedOpenIds.length} 条，未解决 {selectedUnresolvedIds.length} 条
              </Text>
              <Button
                disabled={!selectedOpenIds.length}
                loading={acting === 'batch-ack'}
                onClick={batchAcknowledge}
              >
                批量确认
              </Button>
              <Button
                type="primary"
                disabled={!selectedUnresolvedIds.length}
                loading={acting === 'batch-resolve'}
                onClick={batchResolve}
              >
                批量解决
              </Button>
            </Space>
            <Space wrap className="alert-management__purge">
              <Text type="secondary">清理已解决保留</Text>
              <InputNumber
                min={1}
                max={3650}
                precision={0}
                value={retentionDays}
                onChange={(value) => setRetentionDays(Number(value || 30))}
                addonAfter="天"
              />
              <Popconfirm
                title="清理过期已解决告警？"
                description={`将删除 ${retentionDays} 天前已解决的告警。`}
                onConfirm={purgeResolved}
              >
                <Button icon={<DeleteOutlined />} loading={acting === 'purge-resolved'}>
                  清理
                </Button>
              </Popconfirm>
            </Space>
          </div>

          {alerts.length ? (
            <Table<SystemAlert>
              rowKey="id"
              columns={columns}
              dataSource={alerts}
              rowSelection={{
                selectedRowKeys: selectedAlertIds,
                onChange: (keys) => setSelectedAlertIds(keys.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)),
                getCheckboxProps: (record) => ({ disabled: record.status === 'RESOLVED' }),
              }}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 980 }}
              expandable={{
                expandedRowRender: (record) => (
                  <div className="alert-management__expanded">
                    <span>来源：{record.source}</span>
                    <span>首次出现：{formatTime(record.firstSeenAt)}</span>
                    <span>确认人：{record.acknowledgedBy || '-'}</span>
                    <span>解决人：{record.resolvedBy || '-'}</span>
                    <span>指纹：{record.fingerprint}</span>
                    <span>元数据：{record.metadata || '-'}</span>
                  </div>
                ),
              }}
            />
          ) : (
            <Empty description="暂无匹配告警" />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default AlertManagement;
