import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Form,
  Image,
  Input,
  message,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tag,
  Tabs,
  TreeSelect,
  Typography,
} from 'antd';
import { BranchesOutlined, DeleteOutlined, EditOutlined, GlobalOutlined, PictureOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { Category } from '../types';
import {
  buildCategoryTree,
  descendantIdSet,
  flattenCategoryTree,
  getCategoryPath,
  toTreeOptions,
} from '../utils/categoryTree';
import { useLanguage } from '../i18n';
import { imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { getApiErrorMessage } from '../utils/apiError';
import { CATEGORIES_DELETE_PERMISSION, CATEGORIES_WRITE_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './CategoryManagement.css';

const { TextArea } = Input;
const { Title, Text } = Typography;
const categoryImageFallback = imageFallbacks.category;
const resolveCategoryImage = (imageUrl?: string) => resolveApiAssetUrl(imageUrl, categoryImageFallback);
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };
const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm();
  const { t, language } = useLanguage();
  const canWriteCategories = hasAdminPermission(adminPermissions, currentRole, CATEGORIES_WRITE_PERMISSION);
  const canDeleteCategories = hasAdminPermission(adminPermissions, currentRole, CATEGORIES_DELETE_PERMISSION);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const byId = useMemo(() => new Map(flatCategories.map((category) => [category.id, category])), [flatCategories]);
  const categoryHealth = useMemo(() => {
    const rootCategories = flatCategories.filter((category) => !category.parentId).length;
    const leafCategories = flatCategories.filter((category) => !category.children?.length).length;
    const missingImages = flatCategories.filter((category) => !category.imageUrl?.trim()).length;
    const missingEnglish = flatCategories.filter((category) => !category.localizedContent?.en?.name?.trim()).length;
    const missingSpanish = flatCategories.filter((category) => !category.localizedContent?.es?.name?.trim()).length;
    const shallowRoots = flatCategories.filter((category) => !category.parentId && !category.children?.length).length;
    const localizationGaps = missingEnglish + missingSpanish;
    const score = Math.max(0, 100 - missingImages * 10 - localizationGaps * 7 - shallowRoots * 14);

    return {
      rootCategories,
      leafCategories,
      missingImages,
      localizationGaps,
      score,
    };
  }, [flatCategories]);

  const parentOptions = useMemo(() => {
    const blockedIds = editingCategory ? descendantIdSet(editingCategory) : new Set<number>();
    return toTreeOptions(categoryTree, (category) => category.level === 3 || blockedIds.has(category.id), language);
  }, [categoryTree, editingCategory, language]);
  const categoryPageLabel = t('pages.categoryAdmin.title');
  const getCategoryLabel = useCallback((category?: Category | null) => {
    if (!category) return t('pages.categoryAdmin.addTitle');
    return category.localizedContent?.[language]?.name
      || category.localizedContent?.en?.name
      || category.name
      || `${t('pages.categoryAdmin.name')} #${category.id}`;
  }, [language, t]);
  const getCategoryPathLabel = useCallback((category?: Category | null) => {
    if (!category) return t('pages.categoryAdmin.root');
    return getCategoryPath(flatCategories, category.id, language) || getCategoryLabel(category);
  }, [flatCategories, getCategoryLabel, language, t]);
  const categoryEditorLabel = editingCategory
    ? `${t('pages.categoryAdmin.editTitle')}: ${getCategoryLabel(editingCategory)}`
    : t('pages.categoryAdmin.addTitle');
  const categorySearchLabel = `${t('common.search')}: ${categoryPageLabel}`;
  const addRootCategoryLabel = `${t('pages.categoryAdmin.addRoot')}: ${categoryPageLabel}`;
  const categoryHealthLabels = {
    score: `${t('pages.categoryAdmin.healthScore')}: ${categoryHealth.score}`,
    roots: `${categoryPageLabel}: ${t('pages.categoryAdmin.rootCount')} ${categoryHealth.rootCategories}`,
    leaves: `${categoryPageLabel}: ${t('pages.categoryAdmin.leafCount')} ${categoryHealth.leafCategories}`,
    missingImages: `${categoryPageLabel}: ${t('pages.categoryAdmin.missingImages')} ${categoryHealth.missingImages}`,
    localizationGaps: `${categoryPageLabel}: ${t('pages.categoryAdmin.localizationGaps')} ${categoryHealth.localizationGaps}`,
  };

  const getCategoryReadiness = (category: Category) => [
    category.name?.trim(),
    category.imageUrl?.trim(),
    category.localizedContent?.en?.name?.trim(),
    category.localizedContent?.es?.name?.trim(),
    category.description?.trim() || category.localizedContent?.en?.description?.trim(),
  ].filter(Boolean).length;

  const displayCategoryTree = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return categoryTree;

    const matches = (category: Category) => [
      category.name,
      category.description,
      category.localizedContent?.en?.name,
      category.localizedContent?.en?.description,
      category.localizedContent?.es?.name,
      category.localizedContent?.es?.description,
      category.localizedContent?.zh?.name,
      category.localizedContent?.zh?.description,
      category.imageUrl,
      getCategoryPath(flatCategories, category.id, language),
    ].some((value) => String(value || '').toLowerCase().includes(text));

    const filterTree = (items: Category[]): Category[] => items.reduce<Category[]>((result, category) => {
      const children = filterTree(category.children || []);
      if (matches(category) || children.length) {
        result.push({ ...category, children });
      }
      return result;
    }, []);

    return filterTree(categoryTree);
  }, [categoryTree, flatCategories, keyword, language]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCategories();
      setCategories(res.data);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.categoryAdmin.fetchFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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

  const openModal = (category?: Category | null, parent?: Category | null) => {
    if (!canWriteCategories) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
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
    if (!canDeleteCategories) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.deleteCategory(id);
      message.success(t('messages.deleteSuccess'));
      fetchCategories();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.categoryAdmin.deleteChildFirst'), language));
    }
  };

  const handleSubmit = async () => {
    if (!canWriteCategories) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
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
        await adminApi.updateCategory(editingCategory.id, payload);
        message.success(t('pages.categoryAdmin.updated'));
      } else {
        await adminApi.createCategory(payload);
        message.success(t('pages.categoryAdmin.created'));
      }
      setModalVisible(false);
      setEditingCategory(null);
      setImagePreviewUrl('');
      form.resetFields();
      fetchCategories();
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('pages.categoryAdmin.saveFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingCategory(null);
    setImagePreviewUrl('');
    form.resetFields();
  };

  const columns = [
    {
      title: t('common.image'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 88,
      render: (url?: string, record?: Category) => {
        const imageLabel = record ? `${t('common.image')}: ${getCategoryLabel(record)}` : t('common.image');
        return (
          url ? (
            <Image
              src={resolveCategoryImage(url)}
              alt={imageLabel}
              title={imageLabel}
              width={56}
              height={56}
              style={{ objectFit: 'cover', borderRadius: 6 }}
              fallback={categoryImageFallback}
            />
          ) : (
            <div className="category-management-page__imagePlaceholder" role="img" aria-label={`${t('pages.categoryAdmin.missingImages')}: ${record ? getCategoryLabel(record) : t('common.image')}`} title={`${t('pages.categoryAdmin.missingImages')}: ${record ? getCategoryLabel(record) : t('common.image')}`} />
          )
        );
      },
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
      title: t('pages.categoryAdmin.readiness'),
      key: 'readiness',
      width: 140,
      render: (_: unknown, record: Category) => {
        const readySignals = getCategoryReadiness(record);
        const readinessLabel = `${t('pages.categoryAdmin.readiness')}: ${getCategoryLabel(record)} ${t('pages.categoryAdmin.readySignals', { count: readySignals })}`;
        return (
          <Tag color={readySignals >= 5 ? 'green' : readySignals >= 3 ? 'orange' : 'red'} aria-label={readinessLabel} title={readinessLabel}>
            {t('pages.categoryAdmin.readySignals', { count: readySignals })}
          </Tag>
        );
      },
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 280,
      render: (_: unknown, record: Category) => {
        const categoryName = getCategoryLabel(record);
        const childActionLabel = `${t('pages.categoryAdmin.child')}: ${categoryName}`;
        const editActionLabel = `${t('common.edit')}: ${categoryName}`;
        const deleteActionLabel = `${t('common.delete')}: ${categoryName}`;
        return (
          <Space size="small">
            {canWriteCategories && (record.level || 1) < 3 ? (
              <Button icon={<PlusOutlined />} size="small" aria-label={childActionLabel} title={childActionLabel} onClick={() => openModal(null, record)}>
                {t('pages.categoryAdmin.child')}
              </Button>
            ) : null}
            {canWriteCategories ? <Button icon={<EditOutlined />} size="small" aria-label={editActionLabel} title={editActionLabel} onClick={() => openModal(record)}>
              {t('common.edit')}
            </Button> : null}
            {canDeleteCategories ? (
              <Popconfirm
                classNames={mobilePopconfirmClassNames}
                title={t('pages.categoryAdmin.deleteConfirm')}
                onConfirm={() => handleDelete(record.id)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${categoryName}`, title: `${t('common.cancel')}: ${categoryName}` }}
              >
                <Button icon={<DeleteOutlined />} danger size="small" aria-label={deleteActionLabel} title={deleteActionLabel}>
                  {t('common.delete')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <div className={`category-management-page category-management-page--${language}`}>
      <Title level={3} className="category-management-page__title">
        {t('pages.categoryAdmin.title')}
      </Title>
      <Divider />

      <Card className="category-management-page__toolbar">
        <Space wrap>
          <Text type="secondary">{t('pages.categoryAdmin.healthSubtitle')}</Text>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('common.search')}
            className="category-management-page__keywordInput"
            aria-label={categorySearchLabel}
            title={categorySearchLabel}
          />
          {canWriteCategories ? (
            <Button type="primary" icon={<PlusOutlined />} aria-label={addRootCategoryLabel} title={addRootCategoryLabel} onClick={() => openModal()}>
              {t('pages.categoryAdmin.addRoot')}
            </Button>
          ) : null}
        </Space>
      </Card>

      <section className="category-management-page__health" aria-label={t('pages.categoryAdmin.healthTitle')}>
        <div className="category-management-page__healthCopy">
          <Text className="category-management-page__eyebrow">{t('pages.categoryAdmin.healthEyebrow')}</Text>
          <Title level={5}>{t('pages.categoryAdmin.healthTitle')}</Title>
          <Text type="secondary">{t('pages.categoryAdmin.healthDescription')}</Text>
        </div>
        <div className="category-management-page__score" role="group" aria-label={categoryHealthLabels.score} title={categoryHealthLabels.score}>
          <Progress
            type="circle"
            percent={categoryHealth.score}
            width={86}
            strokeColor={categoryHealth.score >= 80 ? '#2f855a' : categoryHealth.score >= 60 ? '#d97706' : '#dc2626'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.categoryAdmin.healthScore')}</Text>
        </div>
        <div className="category-management-page__healthGrid">
          <div className="category-management-page__healthItem is-ok" role="group" aria-label={categoryHealthLabels.roots} title={categoryHealthLabels.roots}>
            <BranchesOutlined />
            <strong>{categoryHealth.rootCategories}</strong>
            <span>{t('pages.categoryAdmin.rootCount')}</span>
          </div>
          <div className="category-management-page__healthItem is-ok" role="group" aria-label={categoryHealthLabels.leaves} title={categoryHealthLabels.leaves}>
            <BranchesOutlined />
            <strong>{categoryHealth.leafCategories}</strong>
            <span>{t('pages.categoryAdmin.leafCount')}</span>
          </div>
          <div className={`category-management-page__healthItem ${categoryHealth.missingImages ? 'is-risk' : 'is-ok'}`} role="group" aria-label={categoryHealthLabels.missingImages} title={categoryHealthLabels.missingImages}>
            <PictureOutlined />
            <strong>{categoryHealth.missingImages}</strong>
            <span>{t('pages.categoryAdmin.missingImages')}</span>
          </div>
          <div className={`category-management-page__healthItem ${categoryHealth.localizationGaps ? 'is-risk' : 'is-ok'}`} role="group" aria-label={categoryHealthLabels.localizationGaps} title={categoryHealthLabels.localizationGaps}>
            <GlobalOutlined />
            <strong>{categoryHealth.localizationGaps}</strong>
            <span>{t('pages.categoryAdmin.localizationGaps')}</span>
          </div>
        </div>
      </section>

      <Table
        columns={columns}
        dataSource={displayCategoryTree}
        rowKey="id"
        loading={loading}
        bordered
        size="middle"
        pagination={false}
      />

      <Modal
        className="profile-mobile-safe-modal category-management-page__editorModal"
        title={editingCategory ? t('pages.categoryAdmin.editTitle') : t('pages.categoryAdmin.addTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={saving}
        destroyOnHidden
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': `${t('common.save')}: ${categoryEditorLabel}`, title: `${t('common.save')}: ${categoryEditorLabel}` }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${categoryEditorLabel}`, title: `${t('common.cancel')}: ${categoryEditorLabel}` }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.categoryAdmin.name')} rules={[{ required: true, message: t('pages.categoryAdmin.nameRequired') }]}>
            <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.name')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.name')}`} />
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
                      <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.englishName')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.englishName')}`} />
                    </Form.Item>
                    <Form.Item name={['localizedContent', 'en', 'description']} label={t('pages.categoryAdmin.englishDescription')}>
                      <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.englishDescription')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.englishDescription')}`} />
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
                      <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.spanishName')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.spanishName')}`} />
                    </Form.Item>
                    <Form.Item name={['localizedContent', 'es', 'description']} label={t('pages.categoryAdmin.spanishDescription')}>
                      <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.spanishDescription')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.spanishDescription')}`} />
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
                      <Input placeholder={t('pages.categoryAdmin.namePlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.chineseName')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.chineseName')}`} />
                    </Form.Item>
                    <Form.Item name={['localizedContent', 'zh', 'description']} label={t('pages.categoryAdmin.chineseDescription')}>
                      <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.chineseDescription')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.chineseDescription')}`} />
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
              classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
              getPopupContainer={() => document.body}
              aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.parent')}`}
              title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.parent')} ${editingCategory ? getCategoryPathLabel(editingCategory) : t('pages.categoryAdmin.root')}`}
            />
          </Form.Item>

          <Form.Item name="imageUrl" label={t('pages.categoryAdmin.imageUrl')}>
            <Input placeholder="https://..." onChange={(event) => setImagePreviewUrl(event.target.value)} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.imageUrl')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.imageUrl')}`} />
          </Form.Item>

          {imagePreviewUrl ? (
            <div className="category-management-page__preview">
              <Image
                src={resolveCategoryImage(imagePreviewUrl)}
                alt={`${t('common.image')}: ${editingCategory ? getCategoryLabel(editingCategory) : t('pages.categoryAdmin.addTitle')}`}
                title={`${t('common.image')}: ${editingCategory ? getCategoryLabel(editingCategory) : t('pages.categoryAdmin.addTitle')}`}
                width={180}
                height={120}
                style={{ objectFit: 'cover', borderRadius: 8 }}
                fallback={categoryImageFallback}
              />
            </div>
          ) : null}

          <Form.Item name="description" label={t('pages.categoryAdmin.description')}>
            <TextArea rows={3} placeholder={t('pages.categoryAdmin.descriptionPlaceholder')} aria-label={`${categoryEditorLabel}: ${t('pages.categoryAdmin.description')}`} title={`${categoryEditorLabel}: ${t('pages.categoryAdmin.description')}`} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
