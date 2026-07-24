import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { questionApi, reviewApi } from '../api';
import type { Language } from '../i18n';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { hasStoredValue } from '../utils/safeStorage';
import {
  normalizeQuestionText,
  type PendingProductQuestion,
} from '../pages/productDetailHelpers';

type UseProductDetailCommunityActionsParams = {
  fetchQuestions: (requestSeq: number) => void | Promise<void>;
  fetchReviewableOrders: (requestSeq: number) => void | Promise<void>;
  fetchReviews: (requestSeq: number) => void | Promise<void>;
  id: string | undefined;
  isCurrentNonCriticalRequest: (requestSeq: number) => boolean;
  language: Language;
  navigate: NavigateFunction;
  nonCriticalRequestSeqRef: MutableRefObject<number>;
  questionText: string;
  setPendingQuestions: Dispatch<SetStateAction<PendingProductQuestion[]>>;
  setQuestionSubmitting: Dispatch<SetStateAction<boolean>>;
  setQuestionText: Dispatch<SetStateAction<string>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial product-detail community actions:
 * review submit and Q&A ask flow with stale-request guards.
 */
export const useProductDetailCommunityActions = ({
  fetchQuestions,
  fetchReviewableOrders,
  fetchReviews,
  id,
  isCurrentNonCriticalRequest,
  language,
  navigate,
  nonCriticalRequestSeqRef,
  questionText,
  setPendingQuestions,
  setQuestionSubmitting,
  setQuestionText,
  t,
}: UseProductDetailCommunityActionsParams) => {
  const handleAddReview = async (orderId: number, rating: number, comment: string, imageUrls: string[] = []) => {
    const requestSeq = nonCriticalRequestSeqRef.current;
    await reviewApi.create(Number(id), orderId, rating, comment, imageUrls);
    if (!isCurrentNonCriticalRequest(requestSeq)) return;
    await fetchReviews(requestSeq);
    const token = hasStoredValue('token');
    if (token) {
      await fetchReviewableOrders(requestSeq);
    }
  };

  const handleAskQuestion = async () => {
    if (!hasStoredValue('token')) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    if (!normalizeQuestionText(questionText)) {
      announceAccessibleMessage(t('pages.ask.emptyQuestion'), 'warning');
      return;
    }
    const requestSeq = nonCriticalRequestSeqRef.current;
    try {
      setQuestionSubmitting(true);
      const submittedQuestion = normalizeQuestionText(questionText);
      await questionApi.ask(Number(id), submittedQuestion);
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      setPendingQuestions((current) => [
        {
          id: `${Date.now()}`,
          question: submittedQuestion,
          createdAt: new Date().toISOString(),
        },
        ...current.filter((pendingQuestion) => normalizeQuestionText(pendingQuestion.question) !== submittedQuestion).slice(0, 4),
      ]);
      setQuestionText('');
      await fetchQuestions(requestSeq);
      announceAccessibleMessage(t('pages.ask.pendingTitle'), 'success');
    } catch (err: unknown) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.ask.askFailed'), language), 'error');
    } finally {
      if (isCurrentNonCriticalRequest(requestSeq)) {
        setQuestionSubmitting(false);
      }
    }
  };

  return {
    handleAddReview,
    handleAskQuestion,
  };
};
