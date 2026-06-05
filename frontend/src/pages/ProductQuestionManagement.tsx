import React, { useCallback, useEffect, useState } from 'react';
import { Button, Divider, Input, message, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, MessageOutlined, QuestionCircleOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { ProductQuestion, ProductQuestionAdminSummary } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import {
  getEffectiveRole,
  hasAdminPermission,
  QUESTIONS_ANSWER_PERMISSION,
  QUESTIONS_DELETE_PERMISSION,
} from '../utils/roles';
import './ProductQuestionManagement.css';

const { Title, Paragraph } = Typography;
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };

type QuestionStatus = 'UNANSWERED' | 'ANSWERED' | 'ALL';

const ProductQuestionManagement: React.FC = () => {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [summary, setSummary] = useState<ProductQuestionAdminSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuestionStatus>('UNANSWERED');
  const [keyword, setKeyword] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [answerTarget, setAnswerTarget] = useState<ProductQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answering, setAnswering] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const { t, language } = useLanguage();
  const canAnswerQuestions = hasAdminPermission(adminPermissions, currentRole, QUESTIONS_ANSWER_PERMISSION);
  const canDeleteQuestions = hasAdminPermission(adminPermissions, currentRole, QUESTIONS_DELETE_PERMISSION);

  const locale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const adminQuestionProductName = (record: ProductQuestion) => (
    (record.productName || record.product?.name || '').trim()
      || t('pages.profile.productFallback', { id: record.productId || record.product?.id || record.id })
  );

  const normalizeStatus = useCallback(
    (status: QuestionStatus) => (status === 'ALL' ? undefined : status),
    [],
  );

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const normalizedStatus = normalizeStatus(statusFilter);
      const normalizedSearch = searchText.trim() || undefined;
      const summaryRes = await adminApi.getQuestionSummary({ status: normalizedStatus, search: normalizedSearch });
      const limit = summaryRes.data.maxAdminRows || 200;
      const questionsRes = await adminApi.getQuestions({ status: normalizedStatus, search: normalizedSearch, limit });
      setSummary(summaryRes.data);
      setQuestions(questionsRes.data);
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminQuestions.fetchFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, normalizeStatus, searchText, statusFilter, t]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((res) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
        setAdminPermissions(res.data.permissions || []);
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

  const visibleQuestions = questions;

  const answeredCount = summary?.answeredQuestions ?? visibleQuestions.filter((item) => String(item.answer || '').trim()).length;
  const unansweredCount = summary?.unansweredQuestions ?? visibleQuestions.filter((item) => !String(item.answer || '').trim()).length;
  const responseScore = summary?.responseScore ?? Math.max(0, 100 - unansweredCount * 8);
  const staleHours = summary?.staleHours ?? 24;
  const staleCount = summary?.staleUnansweredQuestions ?? 0;
  const currentQuestionStatusLabel = statusFilter === 'ALL'
    ? t('pages.adminQuestions.statusAll')
    : statusFilter === 'ANSWERED'
      ? t('pages.adminQuestions.statusAnswered')
      : t('pages.adminQuestions.statusUnanswered');
  const currentQuestionSearchLabel = keyword.trim() || searchText || t('common.search');
  const questionSearchInputLabel = `${t('pages.adminQuestions.title')} ${t('common.search')}: ${currentQuestionSearchLabel}`;
  const questionStatusFilterLabel = `${t('pages.adminQuestions.statusFilter')}: ${currentQuestionStatusLabel}`;
  const answerTargetLabel = answerTarget
    ? `${adminQuestionProductName(answerTarget)}: ${String(answerTarget.question || '').trim().replace(/\s+/g, ' ').slice(0, 60) || `#${answerTarget.id}`}`
    : t('pages.adminQuestions.title');
  const answerInputLabel = `${t('pages.adminQuestions.answerAction')}: ${answerTargetLabel}`;
  const answerSubmitActionLabel = `${t('pages.adminQuestions.answerAction')}: ${answerTargetLabel}`;

  const openAnswer = (question: ProductQuestion) => {
    if (!canAnswerQuestions) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setAnswerTarget(question);
    setAnswerText(question.answer || '');
  };

  const handleAnswer = async () => {
    if (!canAnswerQuestions) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (!answerTarget) return;
    if (!answerText.trim()) {
      message.warning(t('pages.adminQuestions.answerRequired'));
      return;
    }
    try {
      setAnswering(true);
      await adminApi.answerQuestion(answerTarget.id, answerText.trim());
      message.success(t('pages.adminQuestions.answerSuccess'));
      setAnswerTarget(null);
      setAnswerText('');
      loadQuestions();
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminQuestions.answerFailed'), language));
    } finally {
      setAnswering(false);
    }
  };

  const closeAnswerModal = () => {
    if (answering) return;
    setAnswerTarget(null);
    setAnswerText('');
  };

  const deleteQuestion = async (question: ProductQuestion) => {
    if (!canDeleteQuestions) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      setDeletingId(question.id);
      await adminApi.deleteQuestion(question.id);
      message.success(t('messages.deleteSuccess'));
      await loadQuestions();
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (value?: string) => (value ? new Date(value).toLocaleString(locale) : '-');

  const columns = [
    {
      title: t('pages.adminQuestions.product'),
      key: 'product',
      width: 180,
      render: (_: unknown, record: ProductQuestion) => (
        <Space direction="vertical" size={0}>
          <strong>{adminQuestionProductName(record)}</strong>
          <span className="product-question-management-page__muted">#{record.productId || record.product?.id || '-'}</span>
        </Space>
      ),
    },
    {
      title: t('pages.adminQuestions.user'),
      key: 'user',
      width: 130,
      render: (_: unknown, record: ProductQuestion) => record.username || record.userId || '-',
    },
    {
      title: t('pages.adminQuestions.question'),
      dataIndex: 'question',
      key: 'question',
      width: 280,
      render: (text: string) => <Paragraph ellipsis={{ rows: 3 }} style={{ margin: 0 }}>{text}</Paragraph>,
    },
    {
      title: t('pages.adminQuestions.answer'),
      dataIndex: 'answer',
      key: 'answer',
      width: 280,
      render: (text: string) => text
        ? <Paragraph ellipsis={{ rows: 3 }} style={{ margin: 0 }}>{text}</Paragraph>
        : <Tag icon={<ClockCircleOutlined />} color="orange">{t('pages.adminQuestions.noAnswer')}</Tag>,
    },
    {
      title: t('pages.adminQuestions.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: formatTime,
    },
    {
      title: t('pages.adminQuestions.answeredAt'),
      dataIndex: 'answeredAt',
      key: 'answeredAt',
      width: 170,
      render: formatTime,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 210,
      render: (_: unknown, record: ProductQuestion) => {
        const productName = adminQuestionProductName(record);
        const questionSnippet = String(record.question || '').trim().replace(/\s+/g, ' ').slice(0, 60) || `#${record.id}`;
        const questionLabel = `${productName}: ${questionSnippet}`;
        const answerActionLabel = `${t('pages.adminQuestions.answerAction')}: ${questionLabel}`;
        const deleteActionLabel = `${t('common.delete')}: ${questionLabel}`;
        const actions = [
          canAnswerQuestions ? (
          <Button key="answer" size="small" icon={<MessageOutlined />} aria-label={answerActionLabel} title={answerActionLabel} onClick={() => openAnswer(record)}>
            {t('pages.adminQuestions.answerAction')}
          </Button>
          ) : null,
          canDeleteQuestions ? (
	          <Popconfirm
	            classNames={mobilePopconfirmClassNames}
	            key="delete"
            title={t('pages.adminQuestions.deleteConfirm')}
            description={t('pages.adminQuestions.deleteConfirmDescription')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
            cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
            onConfirm={() => deleteQuestion(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel} loading={deletingId === record.id}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
          ) : null,
        ].filter(Boolean);
        return actions.length ? <Space wrap>{actions}</Space> : '-';
      },
    },
  ];

  return (
    <div className={`product-question-management-page product-question-management-page--${language}`}>
      <Title level={4}>{t('pages.adminQuestions.title')}</Title>
      <Divider />
      <section className="product-question-ops-panel">
        <div className="product-question-ops-panel__copy">
          <span>{t('pages.adminQuestions.opsEyebrow')}</span>
          <h2>{t('pages.adminQuestions.opsTitle')}</h2>
          <p>{t('pages.adminQuestions.opsSubtitle')}</p>
        </div>
        <div className="product-question-ops-panel__metrics">
          <div>
            <QuestionCircleOutlined />
            <strong>{summary?.totalQuestions ?? visibleQuestions.length}</strong>
            <span>{t('pages.adminQuestions.totalQuestions')}</span>
          </div>
          <div>
            <MessageOutlined />
            <strong>{unansweredCount}</strong>
            <span>{t('pages.adminQuestions.unansweredQuestions')}</span>
          </div>
          <div>
            <WarningOutlined />
            <strong>{staleCount}</strong>
            <span>{t('pages.adminQuestions.staleQuestions', { hours: staleHours })}</span>
          </div>
          <div>
            <CheckCircleOutlined />
            <strong>{responseScore}</strong>
            <span>{t('pages.adminQuestions.responseScore')}</span>
          </div>
        </div>
      </section>
      <Space className="product-question-management-page__toolbar" wrap>
        <Input.Search
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(event) => {
            const nextKeyword = event.target.value;
            setKeyword(nextKeyword);
            if (!nextKeyword.trim()) {
              setSearchText('');
            }
          }}
          onSearch={(value) => setSearchText(value.trim())}
          placeholder={t('common.search')}
          className="product-question-management-page__keywordInput"
          aria-label={questionSearchInputLabel}
          title={questionSearchInputLabel}
        />
        <Select
          className="product-question-management-page__statusFilter"
          value={statusFilter}
          onChange={setStatusFilter}
          classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
          getPopupContainer={() => document.body}
          aria-label={questionStatusFilterLabel}
          title={questionStatusFilterLabel}
          options={[
            { value: 'UNANSWERED', label: t('pages.adminQuestions.statusUnanswered') },
            { value: 'ANSWERED', label: t('pages.adminQuestions.statusAnswered') },
            { value: 'ALL', label: t('pages.adminQuestions.statusAll') },
          ]}
        />
        <Tag color={answeredCount > unansweredCount ? 'green' : 'orange'}>
          {t('pages.adminQuestions.answeredQuestions', { count: answeredCount })}
        </Tag>
      </Space>
      <Table
        columns={columns}
        dataSource={visibleQuestions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => t('pages.adminQuestions.total', { count: total }) }}
        bordered
        size="middle"
        scroll={{ x: 1370 }}
      />
      <Modal
        className="profile-mobile-safe-modal product-question-management-page__answerModal"
        open={!!answerTarget}
        onCancel={closeAnswerModal}
        onOk={handleAnswer}
        okText={t('pages.adminQuestions.answerAction')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !canAnswerQuestions, 'aria-label': answerSubmitActionLabel, title: answerSubmitActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${answerSubmitActionLabel}`, title: `${t('common.cancel')}: ${answerSubmitActionLabel}` }}
        confirmLoading={answering}
        title={t('pages.adminQuestions.answerAction')}
        destroyOnHidden
      >
        <Input.TextArea
          rows={6}
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          placeholder={t('pages.adminQuestions.answerPlaceholder')}
          maxLength={2000}
          showCount
          aria-label={answerInputLabel}
          title={answerInputLabel}
        />
      </Modal>
    </div>
  );
};

export default ProductQuestionManagement;
