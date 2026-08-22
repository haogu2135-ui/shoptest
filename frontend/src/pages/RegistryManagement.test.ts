import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'RegistryManagement.tsx'), 'utf8');

describe('RegistryManagement source guards', () => {
  it('keeps registry status API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.registryAdmin.loadFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });
});

describe('RegistryManagement async state guards', () => {
  it('guards registry status setState calls against unmount and stale responses', () => {
    expect(pageSource).toContain('const mountedRef = useRef(true);');
    expect(pageSource).toContain('const statusFetchSeqRef = useRef(0);');
    expect(pageSource).toContain('const requestSeq = statusFetchSeqRef.current + 1;');
    expect(pageSource).toMatch(/const isCurrentRequest = \(\) => mountedRef\.current\s*&& statusFetchSeqRef\.current === requestSeq\s*&& !abortController\.signal\.aborted;/);
    expect(pageSource).toContain('mountedRef.current = false;');
    expect(pageSource).toContain('statusFetchSeqRef.current += 1;');

    // In-flight registry requests are aborted rather than left running after
    // unmount or after a newer refresh supersedes them.
    expect(pageSource).toContain('const statusAbortRef = useRef<AbortController | null>(null);');
    expect(pageSource).toContain('const abortController = createApiAbortController();');
    expect(pageSource).toContain('adminApi.getRegistryStatus({ signal: abortController.signal })');
    expect(pageSource).toMatch(/statusFetchSeqRef\.current \+= 1;\s*statusAbortRef\.current\?\.abort\(\);/);

    const loadBody = pageSource.slice(
      pageSource.indexOf('const loadStatus = useCallback'),
      pageSource.indexOf('}, [language, t]);'),
    );
    expect(loadBody).toContain('if (!isCurrentRequest()) return;\n      setStatus(response.data);');
    expect(loadBody).toMatch(/if \(isCurrentRequest\(\)\) \{\s*setLoading\(false\);/);
    expect(loadBody).not.toMatch(/\}\s*catch \(error: unknown\) \{\s*const errorMessage/);
  });
});
