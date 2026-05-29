import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, DatePicker, Descriptions, Empty, Input, Select, Space, Spin, Statistic, Switch, Tag, Typography, message } from 'antd';
import { BugOutlined, ClockCircleOutlined, DownloadOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { adminApi } from '../api';
import type { AdminLogManagementStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import './LogManagement.css';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

const DEFAULT_LOGGER = 'com.example.shop';

const LogManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<AdminLogManagementStatus | null>(null);
  const [loggerName, setLoggerName] = useState(DEFAULT_LOGGER);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(1, 'hour'), dayjs()]);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadStatus = useCallback(async (nextLogger: string) => {
    const requestedLogger = nextLogger.trim() || DEFAULT_LOGGER;
    setLoading(true);
    try {
      const response = await adminApi.getLogManagementStatus({ loggerName: requestedLogger });
      setStatus(response.data);
      setLoggerName(response.data.loggerName);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.logAdmin.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    loadStatus(DEFAULT_LOGGER);
  }, [loadStatus]);

  const toggleDebug = async (enabled: boolean) => {
    setSwitching(true);
    try {
      const response = await adminApi.setDebugLogging({ loggerName, enabled });
      setStatus(response.data);
      message.success(enabled ? t('pages.logAdmin.debugEnabled') : t('pages.logAdmin.debugDisabled'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.logAdmin.levelToggleFailed'), language));
    } finally {
      setSwitching(false);
    }
  };

  const downloadLogs = async () => {
    if (!range[0] || !range[1]) {
      message.warning(t('pages.logAdmin.rangeRequired'));
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
      message.success(t('pages.logAdmin.downloadStarted'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.logAdmin.downloadFailed'), language));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="log-management">
      <div className="log-management__hero">
        <div>
          <Text className="log-management__eyebrow">Runtime Logs</Text>
          <Title level={2}>{t('pages.logAdmin.title')}</Title>
          <Text type="secondary">{t('pages.logAdmin.description')}</Text>
        </div>
        <Space className="log-management__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadStatus(loggerName)}>
            {t('common.refresh')}
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} loading={downloading} onClick={downloadLogs}>
            {t('pages.logAdmin.downloadLogs')}
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
              title={t('pages.logAdmin.currentLevel')}
              value={status?.effectiveLevel || '-'}
              valueStyle={{ color: status?.debugEnabled ? '#c2410c' : '#1f8a4c' }}
              prefix={<BugOutlined />}
            />
          </Card>
          <Card>
            <Statistic title={t('pages.logAdmin.logFileCount')} value={status?.availableFiles?.length || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </div>

        <Alert
          className="log-management__alert"
          type="info"
          showIcon
          message={t('pages.logAdmin.debugHint')}
        />

        <div className="log-management__grid">
          <Card title={t('pages.logAdmin.debugControl')} className="log-management__card">
            <div className="log-management__control">
              <label>
                <span>{t('pages.logAdmin.loggerName')}</span>
                <Input
                  value={loggerName}
                  onChange={(event) => setLoggerName(event.target.value)}
                  onPressEnter={() => loadStatus(loggerName)}
                  placeholder={DEFAULT_LOGGER}
                />
              </label>
              <div className="log-management__switchRow">
                <div>
                  <Text strong>{t('pages.logAdmin.debugLogs')}</Text>
                  <Text type="secondary">{t('pages.logAdmin.runtimeOnly')}</Text>
                </div>
                <Switch
                  checked={Boolean(status?.debugEnabled)}
                  loading={switching}
                  onChange={toggleDebug}
                  checkedChildren={t('pages.logAdmin.on')}
                  unCheckedChildren={t('pages.logAdmin.off')}
                />
              </div>
              <Button onClick={() => loadStatus(loggerName)} icon={<ReloadOutlined />}>
                {t('pages.logAdmin.loadLogger')}
              </Button>
            </div>
          </Card>

          <Card title={t('pages.logAdmin.rangeDownload')} className="log-management__card">
            <div className="log-management__download">
              <RangePicker
                showTime
                allowClear={false}
                popupClassName="shop-mobile-popup-layer"
                getPopupContainer={() => document.body}
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
                  popupClassName="shop-mobile-popup-layer"
                  getPopupContainer={() => document.body}
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
                {t('pages.logAdmin.downloadSelectedRange')}
              </Button>
            </div>
            <Descriptions column={1} size="small" bordered className="log-management__meta">
              <Descriptions.Item label={t('pages.logAdmin.logDirectory')}>{status?.logDirectory || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.logAdmin.currentFile')}>{status?.logFileName || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.logAdmin.configuredLevel')}>
                <Tag color={status?.configuredLevel === 'INHERITED' ? 'default' : 'blue'}>{status?.configuredLevel || '-'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>

        <Card title={t('pages.logAdmin.availableLogFiles')} className="log-management__card">
          {(status?.availableFiles || []).length ? (
            <Space wrap size={[8, 8]}>
              {status?.availableFiles.map((file) => <Tag key={file}>{file}</Tag>)}
            </Space>
          ) : (
            <Empty description={t('pages.logAdmin.noLogFiles')} />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default LogManagement;
