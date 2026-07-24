import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { productApi, questionApi, reviewApi } from '../api';
import type { Language } from '../i18n';
import type { ProductPublic as Product, ProductQuestionPublic, PublicReview, ReviewableOrder } from '../types';
import { getLocalStorageItem } from '../utils/safeStorage';
import { localizeProduct } from '../utils/localizedProduct';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import {
  cacheProductRecommendations,
  getCachedProductRecommendations,
  normalizeQuestionText,
  type PendingProductQuestion,
} from '../pages/productDetailHelpers';

type UseProductDetailNonCriticalContentParams = {
  id: string | undefined;
  language: Language;
  setAverageRating: Dispatch<SetStateAction<number>>;
  setPendingQuestions: Dispatch<SetStateAction<PendingProductQuestion[]>>;
  setQuestions: Dispatch<SetStateAction<ProductQuestionPublic[]>>;
  setRecommendations: Dispatch<SetStateAction<Product[]>>;
  setRecommendationsLoadFailed: Dispatch<SetStateAction<boolean>>;
  setRecommendationsLoading: Dispatch<SetStateAction<boolean>>;
  setReviewableOrders: Dispatch<SetStateAction<ReviewableOrder[]>>;
  setReviews: Dispatch<SetStateAction<PublicReview[]>>;
};

export const useProductDetailNonCriticalContent = ({
  id,
  language,
  setAverageRating,
  setPendingQuestions,
  setQuestions,
  setRecommendations,
  setRecommendationsLoadFailed,
  setRecommendationsLoading,
  setReviewableOrders,
  setReviews,
}: UseProductDetailNonCriticalContentParams) => {
  const nonCriticalRequestSeqRef = useRef(0);
  const nonCriticalLoadedRef = useRef(false);

  const isCurrentNonCriticalRequest = useCallback((requestSeq: number) => (
    nonCriticalRequestSeqRef.current === requestSeq
  ), []);

  const fetchReviews = useCallback(async (requestSeq: number) => {
    try {
      const res = await reviewApi.getAll(Number(id));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      setReviews(res.data.reviews || []);
      setAverageRating(Number(res.data.averageRating || 0));
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchReviews', error);
    }
  }, [id, isCurrentNonCriticalRequest, setAverageRating, setReviews]);

  const fetchRecommendations = useCallback(async (requestSeq: number) => {
    if (!isCurrentNonCriticalRequest(requestSeq)) return;
    setRecommendationsLoading(true);
    setRecommendationsLoadFailed(false);
    try {
      const cacheKey = `${language}|${id}`;
      const cached = getCachedProductRecommendations(cacheKey);
      if (cached) {
        if (!isCurrentNonCriticalRequest(requestSeq)) return;
        setRecommendations(cached);
        setRecommendationsLoadFailed(false);
        return;
      }
      const res = await productApi.getRecommendations(Number(id));
      const items = res.data.map((item: Product) => localizeProduct(item, language));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      cacheProductRecommendations(cacheKey, items);
      setRecommendations(items);
      setRecommendationsLoadFailed(false);
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchRecommendations', error);
      setRecommendations([]);
      setRecommendationsLoadFailed(true);
    } finally {
      if (isCurrentNonCriticalRequest(requestSeq)) {
        setRecommendationsLoading(false);
      }
    }
  }, [id, isCurrentNonCriticalRequest, language, setRecommendations, setRecommendationsLoadFailed, setRecommendationsLoading]);

  const fetchQuestions = useCallback(async (requestSeq: number) => {
    try {
      const res = await questionApi.getByProduct(Number(id));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      const answeredQuestions = res.data || [];
      setQuestions(answeredQuestions);
      setPendingQuestions((current) => current.filter((pendingQuestion) => (
        !answeredQuestions.some((question) => normalizeQuestionText(question.question) === normalizeQuestionText(pendingQuestion.question))
      )));
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchQuestions', error);
      setQuestions([]);
    }
  }, [id, isCurrentNonCriticalRequest, setPendingQuestions, setQuestions]);

  const fetchReviewableOrders = useCallback(async (requestSeq: number) => {
    try {
      const ordersRes = await reviewApi.getReviewableOrders(Number(id));
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      setReviewableOrders(ordersRes.data || []);
    } catch (error) {
      if (!isCurrentNonCriticalRequest(requestSeq)) return;
      reportNonBlockingError('ProductDetail.fetchReviewableOrders', error);
      setReviewableOrders([]);
    }
  }, [id, isCurrentNonCriticalRequest, setReviewableOrders]);

  const warmNonCriticalContent = useCallback((requestSeq: number) => {
    if (!isCurrentNonCriticalRequest(requestSeq)) return;
    if (nonCriticalLoadedRef.current) return;
    nonCriticalLoadedRef.current = true;
    const token = getLocalStorageItem('token');
    fetchReviews(requestSeq);
    fetchQuestions(requestSeq);
    fetchRecommendations(requestSeq);
    if (token) {
      fetchReviewableOrders(requestSeq);
    }
  }, [fetchQuestions, fetchRecommendations, fetchReviewableOrders, fetchReviews, isCurrentNonCriticalRequest]);

  return {
    fetchQuestions,
    fetchReviewableOrders,
    fetchReviews,
    isCurrentNonCriticalRequest,
    nonCriticalLoadedRef,
    nonCriticalRequestSeqRef,
    warmNonCriticalContent,
  };
};
