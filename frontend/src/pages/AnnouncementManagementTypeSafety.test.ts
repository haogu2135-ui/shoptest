import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'AnnouncementManagement.tsx'), 'utf8');

describe('AnnouncementManagement type-safety guards', () => {
  it('keeps announcement admin API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('type AnnouncementFormValues =');
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('const [form] = Form.useForm<AnnouncementFormValues>();');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.announcementAdmin.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.announcementAdmin.saveFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.announcementAdmin.statusUpdateFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.announcementAdmin.deleteFailed'), language)");
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('error?.errorFields');
  });
});
