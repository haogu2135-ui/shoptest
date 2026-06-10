import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'StockAlerts.tsx'), 'utf8');

describe('StockAlerts type-safety guards', () => {
  it('keeps stock alert API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.stockAlerts.loadFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('messages.addFailed'), language)");
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });
});
