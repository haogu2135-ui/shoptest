import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'UserManagement.tsx'), 'utf8');

describe('UserManagement type-safety guards', () => {
  it('keeps admin user error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('Form.useForm<UserProfileFormValues>()');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('render: (_: any, record: User)');
    expect(pageSource).not.toContain('error?.errorFields');
  });
});
