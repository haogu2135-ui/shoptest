import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'IpBlacklistManagement.tsx'), 'utf8');

describe('IpBlacklistManagement type-safety contracts', () => {
  it('keeps async error handling typed without broad any usage', () => {
    expect(pageSource).toContain('let listError: unknown = null;');
    expect(pageSource).toContain('let statusError: unknown = null;');
    expect(pageSource).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('error?.errorFields');
    expect(pageSource).not.toContain('let listError: any');
    expect(pageSource).not.toContain('let statusError: any');
    expect(pageSource).not.toContain('catch (error: any)');
  });

  it('announces snapshot refresh loading as a conditional busy status region', () => {
    expect(pageSource).toContain('const blacklistSnapshotLoading = loading && entries.length === 0;');
    expect(pageSource).toContain('role="status"');
    expect(pageSource).toContain('aria-live="polite"');
    expect(pageSource).toContain('aria-busy={blacklistSnapshotLoading}');
    expect(pageSource).toContain("aria-label={blacklistSnapshotLoading ? t('common.loading') : undefined}");
    expect(pageSource).toContain('spinning={blacklistSnapshotLoading}');
  });

  it('cancels stale blacklist and status reads', () => {
    expect(pageSource).toContain('const dataAbortRef = useRef<AbortController | null>(null);');
    expect(pageSource).toContain('dataAbortRef.current?.abort();');
    expect(pageSource).toContain('}, { signal: abortController.signal }).then((listResponse) => {');
    expect(pageSource).toContain('adminApi.getIpBlacklistStatus({ signal: abortController.signal })');
    expect(pageSource).toContain('adminApi.getMyPermissions({ signal: abortController.signal })');
  });

  it('latches blacklist mutations and suppresses post-unmount feedback and refreshes', () => {
    expect(pageSource).toContain('const mutationRef = useRef(false);');
    expect(pageSource).toContain('const mutationAbortRef = useRef<AbortController | null>(null);');
    expect(pageSource).toContain('const [mutationPending, setMutationPending] = useState(false);');
    expect(pageSource).toContain('const blacklistActionDisabled = loading || Boolean(listLoadError) || !listSnapshotLoaded || mutationPending;');
    expect(pageSource).toContain('if (!mountedRef.current || mutationRef.current) return;');
    expect(pageSource).toContain('mutationAbortRef.current?.abort();');
    expect(pageSource).toContain('if (!mountedRef.current || abortController.signal.aborted) return;');
    expect(pageSource).toContain('mutationRef.current = false;');
    expect(pageSource).toContain('if (mountedRef.current) {\n        setBlocking(false);\n        setMutationPending(false);\n      }');
    expect(pageSource).toContain('if (mountedRef.current) {\n        setActing(null);\n        setMutationPending(false);\n      }');
    expect(pageSource).toContain('if (mountedRef.current) {\n        setBatchActing(false);\n        setMutationPending(false);\n      }');
    expect(pageSource).toContain('adminApi.blockIpAddress(values, { signal: abortController.signal })');
    expect(pageSource).toContain('adminApi.releaseIpBlacklistEntry(entry.id, { signal: abortController.signal })');
    expect(pageSource).toContain('{ signal: abortController.signal },\n      );');
  });
});
