import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'CartDrawer.tsx'), 'utf8');

describe('CartDrawer type-safety guards', () => {
  it('keeps cart drawer API error handling typed without broad any usage', () => {
    expect(source).toContain("import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';");
    expect(source).not.toContain('const isAuthExpiredError = (error: unknown)');
    expect(source).not.toContain('status?: unknown');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('pages.cart.fetchFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('messages.deleteFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('messages.operationFailed'), language)");
    expect(source).not.toContain('error: any');
    expect(source).not.toContain('err: any');
    expect(source).not.toContain('as any');
  });
});
