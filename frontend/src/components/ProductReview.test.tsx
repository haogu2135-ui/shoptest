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
});
