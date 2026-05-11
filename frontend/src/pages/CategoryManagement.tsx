import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Divider,
  Form,
  Image,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tabs,
  TreeSelect,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { categoryApi } from '../api';
import type { Category } from '../types';
import {
  buildCategoryTree,
  descendantIdSet,
  flattenCategoryTree,
  getCategoryPath,
  toTreeOptions,
} from '../utils/categoryTree';
import { useLanguage } from '../i18n';

const { TextArea } = Input;
const { Title, Text } = Typography;

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [form] = Form.useForm();
  const { t, language } = useLanguage();

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const byId = useMemo(() => new Map(flatCategories.map((category) => [category.id, category])), [flatCategories]);

  const parentOptions = useMemo(() => {
    const blockedIds = editingCategory ? descendantIdSet(editingCategory) : new Set<number>();
    return toTreeOptions(categoryTree, (category) => category.level === 3 || blockedIds.has(category.id), language);
  }, [categoryTree, editingCategory, language]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoryApi.getAll();
      setCategories(res.data);
    } catch {
      message.error(t('pages.categoryAdmin.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openModal = (category?: Category | null, parent?: Category | null) => {
    setEditingCategory(category || null);
    setImagePreviewUrl(category?.imageUrl || '');
    form.resetFields();
    form.setFieldsValue({
      name: category?.name,
      parentId: category ? category.parentId : parent?.id,
      imageUrl: category?.imageUrl,
      description: category?.description,
      localizedContent: {
        en: {
          name: category?.localizedContent?.en?.name || category?.name,
          description: category?.localizedContent?.en?.description || category?.description,
        },
        es: {
          name: category?.localizedContent?.es?.name,
          description: category?.localizedContent?.es?.description,
        },
        zh: {
          name: category?.localizedContent?.zh?.name,
          description: category?.localizedContent?.zh?.description,
        },
      },
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await categoryApi.delete(id);
      message.success(t('messages.deleteSuccess'));
      fetchCategories();
    } catch {
      message.error(t('pages.categoryAdmin.deleteChildFirst'));
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const localizedContent = ['en', 'es', 'zh'].reduce<Record<string, { name?: string; description?: string }>>((result, locale) => {
        const localized = values.localizedContent?.[locale] || {};
        const name = localized.name?.trim();
        const description = localized.description?.trim();
        if (name || description) {
          result[locale] = {
            ...(name ? { name } : {}),
            ...(description ? { description } : {}),
          };
        }
        return result;
      }, {});
      const payload = {
        name: values.name.trim(),
        parentId: values.parentId || null,
        imageUrl: values.imageUrl?.trim() || null,
        description: values.description?.trim() || null,
        localizedContent: Object.keys(localizedContent).length > 0 ? localizedContent : null,
      };

      if (editingCategory) {
        await categoryApi.update(editingCategory.id, payload);
        message.success(t('pages.categoryAdmin.updated'));
      } else {
        await categoryApi.create(payload);
        message.success(t('pages.categoryAdmin.created'));
      }
      setModalVisible(false);
      fetchCategories();
    } catch (error) {
      message.error(t('pages.categoryAdmin.saveFailed'));
    }
  };

  const columns = [
    {
      title: t('common.image'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 88,
      render: (url?: string) =>
        url ? (
          <Image src={url} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 6, background: '#f2f3f5' }} />
        ),
    },
    {
      title: t('pages.categoryAdmin.name'),
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, record: Category) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.localizedContent?.[language]?.name || record.localizedContent?.en?.name || name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getCategoryPath(flatCategories, record.id, language)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('pages.categoryAdmin.level'),
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: number) => <Tag color={level === 1 ? 'orange' : level === 2 ? 'blue' : 'green'}>{t('pages.categoryAdmin.levelValue', { level: level || 1 })}</Tag>,
    },
    {
      title: t('pages.categoryAdmin.parent'),
      dataIndex: 'parentId',
      key: 'parentId',
      width: 180,
      render: (parentId?: number | null) => {
        const parent = parentId ? byId.get(parentId) : null;
        return parent ? parent.localizedContent?.[language]?.name || parent.localizedContent?.en?.name || parent.name : t('pages.categoryAdmin.root');
      },
    },
    {
      title: t('pages.categoryAdmin.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description: string, record: Category) => record.localizedContent?.[language]?.description || record.localizedContent?.en?.description || description,
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 280,
      render: (_: unknown, record: Category) => (
        <Space size="small">
          {(record.level || 1) < 3 ? (
            <Button icon={<PlusOutlined />} size="small" onClick={() => openModal(null, record)}>
              {t('pages.categoryAdmin.child')}
            </Button>
          ) : null}
          <Button icon={<EditOutlined />} size="small" onClick={() => openModal(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm title={t('pages.categoryAdmin.deleteConfirm')} onConfirm={() => handleDelete(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
            <Button icon={<DeleteOutlined />} danger size="small">
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 24px' }}>
      <Title level={3} style={{ marginBottom: 0 }}>
        {t('pages.categoryAdmin.title')}
      </Title>
      <Divider />

      <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ marginBottom: 16 }}>
        {t('pages.categoryAdmin.addRoot')}
      </Button>

      <Table
        columns={columns}
        dataSource={categoryTree}
        rowKey="id"
        loading={loading}
        bordered
        size="middle"
        pagination={false}
      />

      <Modal
        title={editingCategory ? t('pages.categoryAdmin.editTitle') : t('pages.categoryAdmin.addTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.categoryAdmin.name')} rules={[{ required: true, message: t('pages.categoryAdmin.nameRequired') }]}>
            <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} />
          </Form.Item>

          <Divider>{t('pages.categoryAdmin.languageSettings')}</Divider>
          <Tabs
            items={[
              {
                key: 'en',
                label: t('pages.categoryAdmin.english'),
                children: (
                  <>
                    <Form.Item name={['localizedContent', 'en', 'name']} label={t('pages.categoryAdmin.englishName')}>
                      <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} />
                    </Form.Item>
                    <Form.Item name={['localizedContent', 'en', 'description']} label={t('pages.categoryAdmin.englishDescription')}>
                      <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'es',
                label: t('pages.categoryAdmin.spanish'),
                children: (
                  <>
                    <Form.Item name={['localizedContent', 'es', 'name']} label={t('pages.categoryAdmin.spanishName')}>
                      <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} />
                    </Form.Item>
                    <Form.Item name={['localizedContent', 'es', 'description']} label={t('pages.categoryAdmin.spanishDescription')}>
                      <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'zh',
                label: t('pages.categoryAdmin.chinese'),
                children: (
                  <>
                    <Form.Item name={['localizedContent', 'zh', 'name']} label={t('pages.categoryAdmin.chineseName')}>
                      <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} />
                    </Form.Item>
                    <Form.Item name={['localizedContent', 'zh', 'description']} label={t('pages.categoryAdmin.chineseDescription')}>
                      <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />

          <Form.Item name="parentId" label={t('pages.categoryAdmin.parent')}>
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              placeholder={t('pages.categoryAdmin.noParent')}
              treeData={parentOptions}
            />
          </Form.Item>

          <Form.Item name="imageUrl" label={t('pages.categoryAdmin.imageUrl')}>
            <Input placeholder="https://..." onChange={(event) => setImagePreviewUrl(event.target.value)} />
          </Form.Item>

          {imagePreviewUrl ? (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <Image src={imagePreviewUrl} width={180} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} />
            </div>
          ) : null}

          <Form.Item name="description" label={t('pages.categoryAdmin.description')}>
            <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
