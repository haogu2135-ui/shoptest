import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ProductQuestionManagement.tsx'), 'utf8');

describe('ProductQuestionManagement source guards', () => {
  it('blocks answer/delete mutations while showing stale cached rows after a reload failure', () => {
    expect(pageSource).toContain('const hasQuestionSnapshot = questions.length > 0 || summary !== null;');
    expect(pageSource).toContain('const actionsDisabledByStaleData = Boolean(loadError) || mutationPending;');
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

  it('cancels stale summary/list and permission reads', () => {
    expect(pageSource).toContain('const questionsAbortRef = useRef<AbortController | null>(null);');
    expect(pageSource).toContain('questionsAbortRef.current?.abort();');
    expect(pageSource).toContain('adminApi.getQuestionSummary({ status: normalizedStatus, search: normalizedSearch }, { signal: abortController.signal })');
    expect(pageSource).toContain('adminApi.getQuestions({ status: normalizedStatus, search: normalizedSearch, limit }, { signal: abortController.signal })');
    expect(pageSource).toContain('adminApi.getMyPermissions({ signal: abortController.signal })');
  });

  it('latches answer/delete mutations and suppresses post-unmount effects', () => {
    expect(pageSource).toContain('const mutationRef = useRef(false);');
    expect(pageSource).toContain('const [mutationPending, setMutationPending] = useState(false);');
    expect(pageSource).toContain('if (!mountedRef.current || mutationRef.current) return;');
    expect(pageSource).toContain('mutationRef.current = true;');
    expect(pageSource).toContain('mutationRef.current = false;');
    expect(pageSource).toContain('if (!mountedRef.current) return;');
    expect(pageSource).toContain('if (mountedRef.current) await loadQuestions();');
    expect(pageSource).toContain('setMutationPending(false);');
  });
});
