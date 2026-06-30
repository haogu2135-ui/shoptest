import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ConfigCenter.tsx'), 'utf8');

describe('ConfigCenter type-safety guards', () => {
  it('keeps config center API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.configCenter.loadFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.configCenter.publishFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.configCenter.runtimeApplyFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('error?.errorFields');
  });

  it('keeps config center first-load failures from masquerading as neutral config data', () => {
    expect(pageSource).toContain('const [loadError, setLoadError] = useState<string | null>(null);');
    expect(pageSource).toContain('const actionDisabled = !snapshot || loading || Boolean(loadError);');
    expect(pageSource).toContain("description={snapshot ? t('pages.configCenter.staleDataWarning') : undefined}");
    expect(pageSource).toContain('{loadError && !snapshot ? null : <div className="config-center__stats">');
    expect(pageSource).toContain("{loadError && !snapshot ? null : <Form<FormValues>");
    expect(pageSource).toContain('{loadError && !snapshot ? null : <Card title={t(\'pages.configCenter.parseResult\')}');
    expect(pageSource).toContain('{loadError && !snapshot ? null : <Card title={t(\'pages.configCenter.effectiveRuntimeValues\')}');
    expect(pageSource).toContain('<Button size="small" onClick={() => loadSnapshot()} loading={loading}>');
  });
});
