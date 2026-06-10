import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'CustomerSupportWidget.tsx'), 'utf8');

describe('CustomerSupportWidget type-safety guards', () => {
  it('keeps support widget API and browser compatibility error handling typed', () => {
    expect(source).toContain('type LegacyAudioWindow = Window & {');
    expect(source).toContain('webkitAudioContext?: typeof AudioContext;');
    expect(source).toContain('const legacyWindow = window as LegacyAudioWindow;');
    expect(source).toContain('const AudioCtor = window.AudioContext || legacyWindow.webkitAudioContext;');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('pages.support.loadFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('pages.support.connectFailed'), language)");
    expect(source).not.toContain('window as any');
    expect(source).not.toContain('err: any');
    expect(source).not.toContain('as any');
  });
});
