import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Descriptions, Empty, Form, Input, Popconfirm, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloudSyncOutlined, CodeOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminConfigCenterSnapshot } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import {
  CONFIG_CENTER_APPLY_PERMISSION,
  CONFIG_CENTER_PUBLISH_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
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
  const { t, language } = useLanguage();
  const [form] = Form.useForm<FormValues>();
  const watchedDataId = Form.useWatch('dataId', form);
  const watchedGroup = Form.useWatch('group', form);
  const watchedNamespace = Form.useWatch('namespace', form);
  const [snapshot, setSnapshot] = useState<AdminConfigCenterSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const canApplyConfig = hasAdminPermission(adminPermissions, currentRole, CONFIG_CENTER_APPLY_PERMISSION);
  const canPublishConfig = hasAdminPermission(adminPermissions, currentRole, CONFIG_CENTER_PUBLISH_PERMISSION);

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
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.configCenter.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [form, language, t]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const handlePublish = async () => {
    if (!canPublishConfig) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setPublishing(true);
      const response = await adminApi.publishConfigCenter({
        dataId: values.dataId,
        group: values.group,
        namespace: values.namespace || '',
        content: values.content,
        applyRuntime: canApplyConfig && values.applyRuntime,
      });
      setSnapshot(response.data);
      form.setFieldsValue({
        content: response.data.content,
        dataId: response.data.dataId,
        group: response.data.group,
        namespace: response.data.namespace || '',
      });
      if (response.data.errors?.length) {
        message.warning(t('pages.configCenter.publishedWithErrors'));
      } else {
        message.success(response.data.runtimeApplied ? t('pages.configCenter.publishedAndApplied') : t('pages.configCenter.published'));
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, t('pages.configCenter.publishFailed'), language));
    } finally {
      setPublishing(false);
    }
  };

  const handleApplyRuntime = async () => {
    if (!canApplyConfig) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setApplying(true);
      const response = await adminApi.applyConfigCenter({
        dataId: values.dataId,
        group: values.group,
        namespace: values.namespace || '',
        content: values.content,
        applyRuntime: true,
      });
      setSnapshot(response.data);
      if (response.data.errors?.length) {
        message.warning(t('pages.configCenter.applyWithErrors'));
      } else {
        message.success(t('pages.configCenter.runtimeApplied'));
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, t('pages.configCenter.runtimeApplyFailed'), language));
    } finally {
      setApplying(false);
    }
  };

  const propertyRows = useMemo(() => rowsFromRecord(snapshot?.properties), [snapshot]);
  const effectiveRows = useMemo(() => rowsFromRecord(snapshot?.effectiveProperties), [snapshot]);
  const configTargetDataId = String(watchedDataId || snapshot?.dataId || 'shop-backend.properties');
  const configTargetGroup = String(watchedGroup || snapshot?.group || 'DEFAULT_GROUP');
  const configTargetNamespace = String(watchedNamespace || snapshot?.namespace || '').trim();
  const configTargetLabel = `${t('pages.configCenter.dataId')} ${configTargetDataId}, ${t('pages.configCenter.group')} ${configTargetGroup}`;
  const configTargetLabelWithNamespace = configTargetNamespace
    ? `${configTargetLabel}, ${t('pages.configCenter.namespace')} ${configTargetNamespace}`
    : configTargetLabel;
  const applyRuntimeActionLabel = `${t('pages.configCenter.applyOnly')}: ${configTargetLabelWithNamespace}`;
  const refreshConfigActionLabel = `${t('common.refresh')}: ${configTargetLabelWithNamespace}`;
  const publishConfigActionLabel = `${t('pages.configCenter.publishSync')}: ${configTargetLabelWithNamespace}`;
  const configContentEditorLabel = `${t('pages.configCenter.propertiesContent')}: ${configTargetLabelWithNamespace}`;
  const dataIdInputLabel = `${t('pages.configCenter.dataId')}: ${configTargetLabelWithNamespace}`;
  const groupInputLabel = `${t('pages.configCenter.group')}: ${configTargetLabelWithNamespace}`;
  const namespaceInputLabel = `${t('pages.configCenter.namespace')}: ${configTargetLabelWithNamespace}`;
  const applyRuntimeCheckboxLabel = `${t('pages.configCenter.applyAfterPublish')}: ${configTargetLabelWithNamespace}`;
  const renderConfigActionConfirmDescription = (description: string) => (
    <Space direction="vertical" size={4}>
      <Text>{description}</Text>
      <Text type="secondary">{configTargetLabelWithNamespace}</Text>
    </Space>
  );

  return (
    <div className="config-center">
      <div className="config-center__hero">
        <div>
          <Text className="config-center__eyebrow">{t('pages.configCenter.eyebrow')}</Text>
          <Title level={2}>{t('pages.configCenter.title')}</Title>
          <Text type="secondary">{t('pages.configCenter.description')}</Text>
        </div>
        <Space className="config-center__actions" wrap>
          {canApplyConfig ? (
            <Popconfirm
              title={`${t('pages.configCenter.applyOnly')}?`}
              description={renderConfigActionConfirmDescription(t('pages.configCenter.applyOnlyConfirmDescription'))}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              classNames={{ root: 'shop-mobile-popup-layer' }}
              okButtonProps={{ 'aria-label': applyRuntimeActionLabel, title: applyRuntimeActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${applyRuntimeActionLabel}`, title: `${t('common.cancel')}: ${applyRuntimeActionLabel}` }}
              onConfirm={handleApplyRuntime}
            >
              <Button icon={<CheckCircleOutlined />} loading={applying} aria-label={applyRuntimeActionLabel} title={applyRuntimeActionLabel}>
                {t('pages.configCenter.applyOnly')}
              </Button>
            </Popconfirm>
          ) : null}
          <Button icon={<ReloadOutlined />} aria-label={refreshConfigActionLabel} title={refreshConfigActionLabel} onClick={() => loadSnapshot()} loading={loading}>
            {t('common.refresh')}
          </Button>
          {canPublishConfig ? (
            <Popconfirm
              title={`${t('pages.configCenter.publishSync')}?`}
              description={renderConfigActionConfirmDescription(t('pages.configCenter.publishSyncConfirmDescription'))}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              classNames={{ root: 'shop-mobile-popup-layer' }}
              okButtonProps={{ 'aria-label': publishConfigActionLabel, title: publishConfigActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${publishConfigActionLabel}`, title: `${t('common.cancel')}: ${publishConfigActionLabel}` }}
              onConfirm={handlePublish}
            >
              <Button type="primary" icon={<SendOutlined />} loading={publishing} aria-label={publishConfigActionLabel} title={publishConfigActionLabel}>
                {t('pages.configCenter.publishSync')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      </div>

      <Spin spinning={loading && !snapshot}>
        {(snapshot?.sensitiveKeys || []).length > 0 ? (
          <Alert
            className="config-center__alert"
            type="info"
            showIcon
            message={t('pages.configCenter.sensitiveKeysMasked', { keys: (snapshot?.sensitiveKeys || []).join(', ') })}
          />
        ) : null}

        <div className="config-center__stats">
          <Card>
            <Statistic title={t('pages.configCenter.nacosAddress')} value={snapshot?.nacosServerAddr || '-'} prefix={<CloudSyncOutlined />} />
          </Card>
          <Card>
            <Statistic title={t('pages.configCenter.properties')} value={snapshot?.propertyCount || 0} prefix={<CodeOutlined />} />
          </Card>
          <Card>
            <Statistic
              title={t('pages.configCenter.runtimeApply')}
              value={snapshot?.runtimeApplied ? t('pages.configCenter.applied') : t('pages.configCenter.notApplied')}
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
          <Card title={t('pages.configCenter.publishTarget')} className="config-center__card">
            <div className="config-center__form">
              <Form.Item name="dataId" label={t('pages.configCenter.dataId')} rules={[{ required: true, message: t('pages.configCenter.dataIdRequired') }]}>
                <Input placeholder="shop-backend.properties" aria-label={dataIdInputLabel} title={dataIdInputLabel} />
              </Form.Item>
              <Form.Item name="group" label={t('pages.configCenter.group')} rules={[{ required: true, message: t('pages.configCenter.groupRequired') }]}>
                <Input placeholder="DEFAULT_GROUP" aria-label={groupInputLabel} title={groupInputLabel} />
              </Form.Item>
              <Form.Item name="namespace" label={t('pages.configCenter.namespace')}>
                <Input placeholder={t('pages.configCenter.namespacePlaceholder')} aria-label={namespaceInputLabel} title={namespaceInputLabel} />
              </Form.Item>
              {canApplyConfig ? (
                <Form.Item name="applyRuntime" valuePropName="checked">
                  <Checkbox aria-label={applyRuntimeCheckboxLabel} title={applyRuntimeCheckboxLabel}>{t('pages.configCenter.applyAfterPublish')}</Checkbox>
                </Form.Item>
              ) : null}
            </div>
            <Descriptions column={1} size="small" bordered className="config-center__meta">
              <Descriptions.Item label={t('pages.configCenter.lastSynced')}>{snapshot?.lastSyncedAt || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.configCenter.publishStatus')}>
                <Tag color={snapshot?.nacosPublished ? 'green' : 'default'}>
                  {snapshot?.nacosPublished ? t('pages.configCenter.publishedStatus') : t('pages.configCenter.pendingReadOrPublish')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.configCenter.appliedKeys')}>
                {(snapshot?.appliedKeys || []).length ? t('pages.configCenter.keyCount', { count: snapshot?.appliedKeys.length || 0 }) : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={t('pages.configCenter.propertiesContent')} className="config-center__card config-center__editorCard">
            <Form.Item
              name="content"
              rules={[{ required: true, message: t('pages.configCenter.contentRequired') }]}
              className="config-center__contentItem"
            >
              <TextArea spellCheck={false} className="config-center__editor" aria-label={configContentEditorLabel} title={configContentEditorLabel} />
            </Form.Item>
          </Card>
        </Form>

        <Card title={t('pages.configCenter.parseResult')} className="config-center__card">
          {propertyRows.length ? (
            <Table
              rowKey="key"
              dataSource={propertyRows}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              scroll={{ x: 620 }}
              columns={[
                { title: t('pages.configCenter.key'), dataIndex: 'name', width: 260, render: (value: string) => <Text copyable>{value}</Text> },
                { title: t('pages.configCenter.value'), dataIndex: 'value', render: (value: string) => <Text>{value}</Text> },
              ]}
            />
          ) : (
            <Empty description={t('pages.configCenter.noParsedConfig')} />
          )}
        </Card>

        <Card title={t('pages.configCenter.effectiveRuntimeValues')} className="config-center__card">
          {effectiveRows.length ? (
            <Table
              rowKey="key"
              dataSource={effectiveRows}
              pagination={false}
              scroll={{ x: 620 }}
              columns={[
                { title: t('pages.configCenter.key'), dataIndex: 'name', width: 260, render: (value: string) => <Tag color="blue">{value}</Tag> },
                { title: t('pages.configCenter.effectiveValue'), dataIndex: 'value', render: (value: string) => <Text>{value || '-'}</Text> },
              ]}
            />
          ) : (
            <Empty description={t('pages.configCenter.noEffectiveValues')} />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default ConfigCenter;
