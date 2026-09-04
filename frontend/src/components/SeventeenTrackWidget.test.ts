import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'SeventeenTrackWidget.tsx'), 'utf8');

describe('SeventeenTrackWidget type-safety guards', () => {
  it('keeps logistics tracking error handling typed without broad any usage', () => {
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain('getApiErrorDiagnosticText(err)');
    expect(source).toContain("getApiErrorMessage(err, t('pages.orderTracking.trackingFailed'), language)");
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('err?.response?.data');
  });

  it('cancels stale tracking requests and ignores unmounted results', () => {
    expect(source).toContain('const mountedRef = useRef(true);');
    expect(source).toContain('const trackAbortRef = useRef<AbortController | null>(null);');
    expect(source).toContain('if (!mountedRef.current) return;');
    expect(source).toContain('trackAbortRef.current?.abort();');
    expect(source).toContain('logisticsApi.track(num, carrierCode, orderId, guestEmail, orderNo, { signal: abortController.signal })');
    expect(source).toContain('const isCurrentRequest = () => mountedRef.current');
    expect(source).toContain('mountedRef.current = false;');
    expect(source).toContain('requestSeq.current += 1;');
    expect(source).toContain("if (!normalized) {");
    expect(source).toContain("setLoading(false);\n      return;");
  });
});
