import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ProductQuestionManagement.tsx'), 'utf8');

describe('ProductQuestionManagement source guards', () => {
  it('keeps admin question API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (err: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.adminQuestions.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.adminQuestions.answerFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('messages.deleteFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('catch (error: any)');
  });
});
