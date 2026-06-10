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
});
