import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ProductQuestionManagement.tsx'), 'utf8');

describe('ProductQuestionManagement source guards', () => {
  it('blocks answer/delete mutations while showing stale cached rows after a reload failure', () => {
    expect(pageSource).toContain('const hasQuestionSnapshot = questions.length > 0 || summary !== null;');
    expect(pageSource).toContain('const actionsDisabledByStaleData = Boolean(loadError);');
    expect(pageSource).toContain("message={t('pages.adminQuestions.loadErrorTitle')}");
    expect(pageSource).toContain('{loadError && visibleQuestions.length > 0 ? (');
    expect(pageSource).toContain("description={t('pages.adminQuestions.staleDataWarning')}");
    expect(pageSource).toContain('{loadError && visibleQuestions.length === 0 ? (');
    expect(pageSource).toContain('description={loadError}');
    expect(pageSource).toContain('onClick={loadQuestions}');
    expect(pageSource).toContain('disabled={actionsDisabledByStaleData}');
  });

  it('keeps admin question API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (err: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.adminQuestions.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.adminQuestions.answerFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('messages.deleteFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('catch (error: any)');
  });

  it('uses ShopSearchField/ShopTextArea instead of ant Input', () => {
    expect(pageSource).toContain('ShopSearchField');
    expect(pageSource).toContain('ShopTextArea');
    expect(pageSource).not.toMatch(/import \{[^}]*\bInput\b[^}]*\} from 'antd'/);
    expect(pageSource).not.toMatch(/<Input\b|Input\.Search|Input\.TextArea/);
  });
});
