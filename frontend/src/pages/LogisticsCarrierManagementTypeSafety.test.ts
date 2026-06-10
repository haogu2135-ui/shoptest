import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'LogisticsCarrierManagement.tsx'), 'utf8');

describe('LogisticsCarrierManagement type-safety guards', () => {
  it('keeps carrier API and form error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('Form.useForm<LogisticsCarrierFormValues>()');
    expect(pageSource).toContain('if (isFormValidationError(err)) return;');
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.logisticsCarriers.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.logisticsCarriers.saveFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.logisticsCarriers.deleteFailed'), language)");
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('err?.errorFields');
  });
});
