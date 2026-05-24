import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Select, Space, Spin, Statistic, Switch, Tag, Typography, message } from 'antd';
import { BugOutlined, ClockCircleOutlined, DownloadOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { adminApi } from '../api';
import type { AdminLogManagementStatus } from '../types';
import './LogManagement.css';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const DEFAULT_LOGGER = 'com.example.shop';

const LogManagement: React.FC = () => {
  const [status, setStatus] = useState<AdminLogManagementStatus | null>(null);
  const [loggerName, setLoggerName] = useState(DEFAULT_LOGGER);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(1, 'hour'), dayjs()]);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadStatus = useCallback(async (nextLogger = loggerName) => {
    setLoading(true);
    try {
      const response = await adminApi.getLogManagementStatus({ loggerName: nextLogger });
      setStatus(response.data);
      setLoggerName(response.data.loggerName);
    } catch {
      message.error('日志状态加载失败');
    } finally {
      setLoading(false);
    }
  }, [loggerName]);

  useEffect(() => {
    loadStatus(DEFAULT_LOGGER);
  }, [loadStatus]);

  const toggleDebug = async (enabled: boolean) => {
    setSwitching(true);
    try {
      const response = await adminApi.setDebugLogging({ loggerName, enabled });
      setStatus(response.data);
      message.success(enabled ? 'Debug 日志已开启' : 'Debug 日志已关闭');
    } catch {
      message.error('日志级别切换失败');
    } finally {
      setSwitching(false);
    }
  };

  const downloadLogs = async () => {
    if (!range[0] || !range[1]) {
      message.warning('请选择日志时间范围');
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
      message.success('日志已开始下载');
    } catch {
      message.error('日志下载失败，请确认服务端已生成日志文件');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="log-management">
      <div className="log-management__hero">
        <div>
          <Text className="log-management__eyebrow">Runtime Logs</Text>
          <Title level={2}>日志管理</Title>
          <Text type="secondary">运行时开启或关闭 debug，并按指定时间段下载后台日志。</Text>
        </div>
        <Space className="log-management__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadStatus()}>
            刷新
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} loading={downloading} onClick={downloadLogs}>
            下载日志
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && !status}>
        <div className="log-management__stats">
          <Card>
            <Statistic title="Logger" value={status?.loggerName || loggerName} prefix={<FileTextOutlined />} />
          </Card>
          <Card>
            <Statistic
              title="当前级别"
              value={status?.effectiveLevel || '-'}
              valueStyle={{ color: status?.debugEnabled ? '#c2410c' : '#1f8a4c' }}
              prefix={<BugOutlined />}
            />
          </Card>
          <Card>
            <Statistic title="日志文件数" value={status?.availableFiles?.length || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </div>

        <Alert
          className="log-management__alert"
          type="info"
          showIcon
          message="Debug 日志会增加输出量，排查完成后建议关闭。下载范围会按日志行开头时间筛选，异常堆栈会跟随上一条匹配日志一起导出。"
        />

        <div className="log-management__grid">
          <Card title="Debug 控制" className="log-management__card">
            <div className="log-management__control">
              <label>
                <span>Logger 名称</span>
                <Input
                  value={loggerName}
                  onChange={(event) => setLoggerName(event.target.value)}
                  onPressEnter={() => loadStatus(loggerName)}
                  placeholder={DEFAULT_LOGGER}
                />
              </label>
              <div className="log-management__switchRow">
                <div>
                  <Text strong>Debug 日志</Text>
                  <Text type="secondary">仅影响当前运行中的后台进程</Text>
                </div>
                <Switch
                  checked={Boolean(status?.debugEnabled)}
                  loading={switching}
                  onChange={toggleDebug}
                  checkedChildren="开"
                  unCheckedChildren="关"
                />
              </div>
              <Button onClick={() => loadStatus(loggerName)} icon={<ReloadOutlined />}>
                读取该 Logger
              </Button>
            </div>
          </Card>

          <Card title="时间段下载" className="log-management__card">
            <div className="log-management__download">
              <RangePicker
                showTime
                allowClear={false}
                value={range}
                onChange={(values) => {
                  if (values?.[0] && values?.[1]) {
                    setRange([values[0], values[1]]);
                  }
                }}
              />
              <Space.Compact block>
                <Select
                  value={level}
                  onChange={setLevel}
                  options={['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].map((value) => ({ value, label: value }))}
                  style={{ width: 110 }}
                />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Keyword"
                />
              </Space.Compact>
              <Button type="primary" icon={<DownloadOutlined />} loading={downloading} onClick={downloadLogs}>
                下载所选时间段
              </Button>
            </div>
            <Descriptions column={1} size="small" bordered className="log-management__meta">
              <Descriptions.Item label="日志目录">{status?.logDirectory || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前文件">{status?.logFileName || '-'}</Descriptions.Item>
              <Descriptions.Item label="配置级别">
                <Tag color={status?.configuredLevel === 'INHERITED' ? 'default' : 'blue'}>{status?.configuredLevel || '-'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>

        <Card title="可下载日志文件" className="log-management__card">
          {(status?.availableFiles || []).length ? (
            <Space wrap size={[8, 8]}>
              {status?.availableFiles.map((file) => <Tag key={file}>{file}</Tag>)}
            </Space>
          ) : (
            <Empty description="暂无日志文件，应用重启并产生日志后会显示" />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default LogManagement;
