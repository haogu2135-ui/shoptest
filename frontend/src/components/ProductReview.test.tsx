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
});
