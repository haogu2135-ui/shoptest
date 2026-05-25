import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Divider, Input, message, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, MessageOutlined, QuestionCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { ProductQuestion, ProductQuestionAdminSummary } from '../types';
import { useLanguage } from '../i18n';
import './ProductQuestionManagement.css';

const { Title, Paragraph } = Typography;

type QuestionStatus = 'UNANSWERED' | 'ANSWERED' | 'ALL';

const ProductQuestionManagement: React.FC = () => {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [summary, setSummary] = useState<ProductQuestionAdminSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuestionStatus>('UNANSWERED');
  const [loading, setLoading] = useState(false);
  const [answerTarget, setAnswerTarget] = useState<ProductQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answering, setAnswering] = useState(false);
  const { t, language } = useLanguage();

  const locale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

  const normalizeStatus = useCallback(
    (status: QuestionStatus) => (status === 'ALL' ? undefined : status),
    [],
  );

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const summaryRes = await adminApi.getQuestionSummary();
      const limit = summaryRes.data.maxAdminRows || 200;
      const questionsRes = await adminApi.getQuestions({ status: normalizeStatus(statusFilter), limit });
      setSummary(summaryRes.data);
      setQuestions(questionsRes.data);
    } catch {
      message.error(t('pages.adminQuestions.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [normalizeStatus, statusFilter, t]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const visibleQuestions = useMemo(() => questions, [questions]);

  const answeredCount = summary?.answeredQuestions ?? visibleQuestions.filter((item) => String(item.answer || '').trim()).length;
  const unansweredCount = summary?.unansweredQuestions ?? visibleQuestions.filter((item) => !String(item.answer || '').trim()).length;
  const responseScore = summary?.responseScore ?? Math.max(0, 100 - unansweredCount * 8);
  const staleHours = summary?.staleHours ?? 24;
  const staleCount = summary?.staleUnansweredQuestions ?? 0;

  const openAnswer = (question: ProductQuestion) => {
    setAnswerTarget(question);
    setAnswerText(question.answer || '');
  };

  const handleAnswer = async () => {
    if (!answerTarget) return;
    try {
      setAnswering(true);
      await adminApi.answerQuestion(answerTarget.id, answerText);
      message.success(t('pages.adminQuestions.answerSuccess'));
      setAnswerTarget(null);
      setAnswerText('');
      loadQuestions();
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.adminQuestions.answerFailed'));
    } finally {
      setAnswering(false);
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
          <strong>{record.productName || record.product?.name || '-'}</strong>
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
      width: 140,
      render: (_: unknown, record: ProductQuestion) => (
        <Button size="small" icon={<MessageOutlined />} onClick={() => openAnswer(record)}>
          {t('pages.adminQuestions.answerAction')}
        </Button>
      ),
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
        <Select
          className="product-question-management-page__statusFilter"
          value={statusFilter}
          onChange={setStatusFilter}
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
        className="product-question-management-page__answerModal"
        open={!!answerTarget}
        onCancel={() => setAnswerTarget(null)}
        onOk={handleAnswer}
        confirmLoading={answering}
        title={t('pages.adminQuestions.answerAction')}
      >
        <Input.TextArea
          rows={6}
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          placeholder={t('pages.adminQuestions.answerPlaceholder')}
          maxLength={2000}
          showCount
        />
      </Modal>
    </div>
  );
};

export default ProductQuestionManagement;
