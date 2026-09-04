import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'TrafficControl.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'TrafficControl.css'), 'utf8');

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
    expect(pageSource).toContain('const actionDisabled = !status || loading || Boolean(loadError) || actionPending;');
    expect(pageSource).toContain("{loadError && status ? (");
    expect(pageSource).toContain("description={t('pages.trafficControl.staleDataWarning')}");
    expect(pageSource).toContain('data-admin-traffic-stale-recovery');
    expect(pageSource).toContain('{loadError && !status ? null : <div className="traffic-control__stats">');
    expect(pageSource).toContain('{loadError && !status ? null : <div className="traffic-control__grid">');
    expect(pageSource).toContain("{loadError && !status ? null : <ShopCard title={<span><ThunderboltOutlined /> {t('pages.trafficControl.circuitBreakers')}</span>}");
    expect(pageSource).toContain('<ShopButton size="small" type="primary" onClick={loadStatus} loading={loading}>');
  });

  it('keeps traffic-control mobile admin controls on commercial touch targets', () => {
    const marker = 'Commercial mobile/App traffic-control touch-target guard';
    const guardStart = cssSource.indexOf(marker);
    const touchTargetGuard = cssSource.slice(guardStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(touchTargetGuard).toMatch(/@media \(max-width:\s*720px\)/);
    expect(touchTargetGuard).toMatch(/\.traffic-control \.ant-btn,[^}]*\.traffic-control \.ant-input,[^}]*\.traffic-control \.ant-input-affix-wrapper,[^}]*\.traffic-control \.ant-select-selector\s*\{[^}]*min-height:\s*44px/);
    expect(touchTargetGuard).not.toMatch(/min-height:\s*(?:3[0-9]|4[0-3])px/);
  });

  it('latches traffic-control writes and suppresses post-unmount feedback and refreshes', () => {
    expect(pageSource).toContain('const actionRef = useRef(false);');
    expect(pageSource).toContain('const [actionPending, setActionPending] = useState(false);');
    expect(pageSource).toContain('const actionDisabled = !status || loading || Boolean(loadError) || actionPending;');
    expect(pageSource).toContain('if (!mountedRef.current || actionRef.current) return;');
    expect(pageSource).toContain('actionRef.current = true;');
    expect(pageSource).toContain('if (!mountedRef.current) return;');
    expect(pageSource).toContain('actionRef.current = false;');
    expect(pageSource).toContain('disabled={actionPending}');
    expect(pageSource).toContain('disabled: actionDisabled');
    expect(pageSource).toContain('if (mountedRef.current) {\n        setActing(null);\n        setActionPending(false);\n      }');
  });
});
