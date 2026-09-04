import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'ProductReview.tsx'), 'utf8');

describe('ProductReview type-safety guards', () => {
  it('keeps review submit error handling typed without broad any usage', () => {
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('pages.review.failed'), language)");
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain(': any');
    expect(source).not.toContain('as any');
  });

  it('keeps review request cancellation scoped to the component lifecycle', () => {
    expect(source).toContain('uploadAbortRef.current?.abort();');
    expect(source).toContain('submitAbortRef.current?.abort();');
    expect(source).toContain('mountedRef.current = false;');
    expect(source).toContain('uploadingRef.current = false;');
    expect(source).toContain('submittingRef.current = false;');
  });
});
