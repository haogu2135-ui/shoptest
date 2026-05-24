import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Descriptions, Empty, Form, Input, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloudSyncOutlined, CodeOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminConfigCenterSnapshot } from '../types';
import './ConfigCenter.css';

const { Text, Title } = Typography;
const { TextArea } = Input;

type FormValues = {
  dataId: string;
  group: string;
  namespace?: string;
  content: string;
  applyRuntime: boolean;
};

const rowsFromRecord = (record?: Record<string, string>) =>
  Object.entries(record || {}).map(([key, value]) => ({ key, name: key, value }));

const ConfigCenter: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [snapshot, setSnapshot] = useState<AdminConfigCenterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [applying, setApplying] = useState(false);

  const loadSnapshot = useCallback(async (params?: Partial<FormValues>) => {
    setLoading(true);
    try {
      const response = await adminApi.getConfigCenter({
        dataId: params?.dataId || form.getFieldValue('dataId'),
        group: params?.group || form.getFieldValue('group'),
        namespace: params?.namespace ?? form.getFieldValue('namespace'),
      });
      setSnapshot(response.data);
      form.setFieldsValue({
        dataId: response.data.dataId,
        group: response.data.group,
        namespace: response.data.namespace || '',
        content: response.data.content,
        applyRuntime: true,
      });
    } catch {
      message.error('配置中心加载失败，请检查 Nacos 是否可访问');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handlePublish = async () => {
    const values = await form.validateFields();
    setPublishing(true);
    try {
      const response = await adminApi.publishConfigCenter({
        dataId: values.dataId,
        group: values.group,
        namespace: values.namespace || '',
        content: values.content,
        applyRuntime: values.applyRuntime,
      });
      setSnapshot(response.data);
      form.setFieldsValue({
        content: response.data.content,
        dataId: response.data.dataId,
        group: response.data.group,
        namespace: response.data.namespace || '',
      });
      if (response.data.errors?.length) {
        message.warning('配置已提交但存在错误，请查看下方提示');
      } else {
        message.success(response.data.runtimeApplied ? '已同步到 Nacos，并应用到当前后台' : '已同步到 Nacos');
      }
    } catch {
      message.error('发布失败，请稍后重试');
    } finally {
      setPublishing(false);
    }
  };

  const handleApplyRuntime = async () => {
    const values = await form.validateFields();
    setApplying(true);
    try {
      const response = await adminApi.applyConfigCenter({
        dataId: values.dataId,
        group: values.group,
        namespace: values.namespace || '',
        content: values.content,
        applyRuntime: true,
      });
      setSnapshot(response.data);
      if (response.data.errors?.length) {
        message.warning('Runtime apply finished with errors');
      } else {
        message.success('Runtime config applied');
      }
    } catch {
      message.error('Runtime apply failed');
    } finally {
      setApplying(false);
    }
  };

  const propertyRows = useMemo(() => rowsFromRecord(snapshot?.properties), [snapshot]);
  const effectiveRows = useMemo(() => rowsFromRecord(snapshot?.effectiveProperties), [snapshot]);

  return (
    <div className="config-center">
      <div className="config-center__hero">
        <div>
          <Text className="config-center__eyebrow">Nacos Config</Text>
          <Title level={2}>配置中心</Title>
          <Text type="secondary">实时编辑后台 properties，发布到 Nacos，并注入当前运行环境。</Text>
        </div>
        <Space className="config-center__actions" wrap>
          <Button icon={<CheckCircleOutlined />} onClick={handleApplyRuntime} loading={applying}>
            Apply only
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadSnapshot()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={handlePublish} loading={publishing}>
            发布同步
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && !snapshot}>
        {(snapshot?.sensitiveKeys || []).length > 0 ? (
          <Alert
            className="config-center__alert"
            type="info"
            showIcon
            message={`Sensitive keys are masked: ${snapshot?.sensitiveKeys.join(', ')}`}
          />
        ) : null}

        <div className="config-center__stats">
          <Card>
            <Statistic title="Nacos 地址" value={snapshot?.nacosServerAddr || '-'} prefix={<CloudSyncOutlined />} />
          </Card>
          <Card>
            <Statistic title="Properties" value={snapshot?.propertyCount || 0} prefix={<CodeOutlined />} />
          </Card>
          <Card>
            <Statistic
              title="运行时应用"
              value={snapshot?.runtimeApplied ? '已应用' : '未应用'}
              valueStyle={{ color: snapshot?.runtimeApplied ? '#1f8a4c' : '#8c6b20' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </div>

        {(snapshot?.errors || []).map((error) => (
          <Alert key={error} className="config-center__alert" type="error" showIcon message={error} />
        ))}
        {(snapshot?.warnings || []).map((warning) => (
          <Alert key={warning} className="config-center__alert" type="warning" showIcon message={warning} />
        ))}

        <Form<FormValues>
          form={form}
          layout="vertical"
          initialValues={{ applyRuntime: true }}
          className="config-center__grid"
        >
          <Card title="发布目标" className="config-center__card">
            <div className="config-center__form">
              <Form.Item name="dataId" label="Data ID" rules={[{ required: true, message: '请输入 Data ID' }]}>
                <Input placeholder="shop-backend.properties" />
              </Form.Item>
              <Form.Item name="group" label="Group" rules={[{ required: true, message: '请输入 Group' }]}>
                <Input placeholder="DEFAULT_GROUP" />
              </Form.Item>
              <Form.Item name="namespace" label="Namespace">
                <Input placeholder="public 留空即可" />
              </Form.Item>
              <Form.Item name="applyRuntime" valuePropName="checked">
                <Checkbox>发布后立即应用到当前后台进程</Checkbox>
              </Form.Item>
            </div>
            <Descriptions column={1} size="small" bordered className="config-center__meta">
              <Descriptions.Item label="最后同步">{snapshot?.lastSyncedAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="发布状态">
                <Tag color={snapshot?.nacosPublished ? 'green' : 'default'}>
                  {snapshot?.nacosPublished ? '已发布' : '待读取或发布'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="已应用键">
                {(snapshot?.appliedKeys || []).length ? `${snapshot?.appliedKeys.length} 个` : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Properties 内容" className="config-center__card config-center__editorCard">
            <Form.Item
              name="content"
              rules={[{ required: true, message: '请输入 properties 内容' }]}
              className="config-center__contentItem"
            >
              <TextArea spellCheck={false} className="config-center__editor" />
            </Form.Item>
          </Card>
        </Form>

        <Card title="解析结果" className="config-center__card">
          {propertyRows.length ? (
            <Table
              rowKey="key"
              dataSource={propertyRows}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              scroll={{ x: 620 }}
              columns={[
                { title: 'Key', dataIndex: 'name', width: 260, render: (value: string) => <Text copyable>{value}</Text> },
                { title: 'Value', dataIndex: 'value', render: (value: string) => <Text>{value}</Text> },
              ]}
            />
          ) : (
            <Empty description="暂无可解析配置" />
          )}
        </Card>

        <Card title="当前后台生效值" className="config-center__card">
          {effectiveRows.length ? (
            <Table
              rowKey="key"
              dataSource={effectiveRows}
              pagination={false}
              scroll={{ x: 620 }}
              columns={[
                { title: 'Key', dataIndex: 'name', width: 260, render: (value: string) => <Tag color="blue">{value}</Tag> },
                { title: 'Effective Value', dataIndex: 'value', render: (value: string) => <Text>{value || '-'}</Text> },
              ]}
            />
          ) : (
            <Empty description="发布或刷新后显示生效值" />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default ConfigCenter;
