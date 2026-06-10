const readSupportManagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'SupportManagement.tsx'), 'utf8')
);

export {};

describe('SupportManagement type-safety guard', () => {
  it('keeps admin support failures and legacy audio access typed without broad any escapes', () => {
    const source = readSupportManagementSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|window as any\b|any\[\]/);
    expect(source).toContain('type LegacyAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };');
    expect(source).toContain('const audioWindow = window as LegacyAudioWindow;');
    expect(source).toContain('const AudioCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('pages.adminSupport.loadFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('pages.adminSupport.reissueBirthdayCouponFailed'), language)");
  });
});
