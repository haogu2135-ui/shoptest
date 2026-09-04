const readProductReviewSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'ProductReview.tsx'), 'utf8') as string;

export {};

describe('ProductReview source contracts', () => {
  it('keeps review comments aligned to the backend limit', () => {
    const source = readProductReviewSource();
    const textareaStart = source.indexOf('className="product-review__textarea"');
    const textareaSource = source.slice(textareaStart, source.indexOf('/>', textareaStart));

    expect(source).toContain('const MAX_REVIEW_COMMENT_LENGTH = 1000;');
    expect(source).toContain('comment.trim().length > MAX_REVIEW_COMMENT_LENGTH');
    expect(source).toContain("t('pages.review.commentTooLong', { count: MAX_REVIEW_COMMENT_LENGTH })");
    expect(textareaSource).toContain('maxLength={MAX_REVIEW_COMMENT_LENGTH}');
    expect(textareaSource).toContain('showCount');
  });

  it('keeps no-order and auth-gate review composers on multipath commercial recovery exits', () => {
    const source = readProductReviewSource();
    expect(source).toContain('data-review-no-order-recovery');
    expect(source).toContain('data-review-auth-gate');
    expect(source).toContain('pages.review.noReviewableOrderHint');
    expect(source).toContain("navigate('/profile?tab=orders')");
    expect(source).toContain("navigate('/products')");
    expect(source).toContain("navigate('/coupons')");
    expect(source).toContain("navigate('/track-order')");
    expect(source).toContain('getCurrentRelativeUrl');
    expect(source).toContain('/register?redirect=');
    expect(source).toContain('buildLoginUrlFromWindow');
  });

  it('latches review uploads and submits while suppressing post-unmount effects', () => {
    const source = readProductReviewSource();
    expect(source).toContain('const mountedRef = useRef(true);');
    expect(source).toContain('const uploadingRef = useRef(false);');
    expect(source).toContain('const submittingRef = useRef(false);');
    expect(source).toContain('const uploadAbortRef = useRef<AbortController | null>(null);');
    expect(source).toContain('const submitAbortRef = useRef<AbortController | null>(null);');
    expect(source).toContain('if (!mountedRef.current || uploadingRef.current || submittingRef.current) return ShopUpload.LIST_IGNORE;');
    expect(source).toContain('if (!mountedRef.current || submittingRef.current || uploadingRef.current) return;');
    expect(source).toContain('reviewApi.uploadImage(file, { signal: abortController.signal })');
    expect(source).toContain('onAddReview(orderId, rating, comment.trim(), safeImageUrls, { signal: abortController.signal })');
    expect(source).toContain('if (!mountedRef.current || abortController.signal.aborted) return ShopUpload.LIST_IGNORE;');
    expect(source).toContain('if (!mountedRef.current || abortController.signal.aborted) return;');
    expect(source).toContain('if (mountedRef.current) setUploadingImage(false);');
    expect(source).toContain('if (mountedRef.current) setSubmitting(false);');
  });
});
