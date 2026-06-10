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
});
