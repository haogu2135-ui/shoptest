import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'TrafficControl.tsx'), 'utf8');

describe('TrafficControl source guards', () => {
  it('keeps traffic-control API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.trafficControl.loadFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.trafficControl.circuitResetFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.trafficControl.rateLimitClearFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });

  it('keeps traffic-control first-load failures from masquerading as healthy zero data', () => {
    expect(pageSource).toContain('const [loadError, setLoadError] = useState<string | null>(null);');
    expect(pageSource).toContain('const actionDisabled = !status || loading || Boolean(loadError);');
    expect(pageSource).toContain("description={status ? t('pages.trafficControl.staleDataWarning') : undefined}");
    expect(pageSource).toContain('{loadError && !status ? null : <div className="traffic-control__stats">');
    expect(pageSource).toContain('{loadError && !status ? null : <div className="traffic-control__grid">');
    expect(pageSource).toContain("{loadError && !status ? null : <Card title={<span><ThunderboltOutlined /> {t('pages.trafficControl.circuitBreakers')}</span>}");
    expect(pageSource).toContain('<Button size="small" onClick={loadStatus} loading={loading}>');
  });
});
