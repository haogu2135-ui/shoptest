const readAlertManagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'AlertManagement.tsx'), 'utf8')
);

export {};

describe('AlertManagement type-safety guard', () => {
  it('keeps recoverable admin alert failures typed as unknown', () => {
    const source = readAlertManagementSource();

    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('as any');
    expect(source).toContain('catch (error: unknown)');
    expect(source).toContain('getApiErrorMessage(error, t(\'pages.alertAdmin.loadFailed\'), language)');
    expect(source).toContain('getApiErrorMessage(error, t(\'pages.alertAdmin.purgeFailed\'), language)');
  });
});
