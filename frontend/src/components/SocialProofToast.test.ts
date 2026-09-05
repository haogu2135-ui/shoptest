import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'SocialProofToast.tsx'), 'utf8');

describe('SocialProofToast conversion trust contract', () => {
  it('keeps social proof limited to verified events with a disabled-state escape hatch', () => {
    expect(source).toContain('conversionConfig.socialProof.events.filter((event) => event.verified === true)');
    expect(source).toContain('if (!conversionConfig.socialProof.enabled || events.length === 0) return null;');
    expect(source).toContain('events.length <= 1 || !documentVisible');
  });

  it('keeps rotation lifecycle-bound and announcement copy localized', () => {
    expect(source).toContain('window.setTimeout');
    expect(source).toContain('conversionConfig.socialProof.rotateMs');
    expect(source).toContain('return () => window.clearTimeout(timer);');
    expect(source).toContain('useDocumentVisibility');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("t('home.socialProofTitle')");
    expect(source).toContain("t('home.socialProofMessage'");
    expect(source).toContain('city: t(event.cityKey)');
    expect(source).toContain('product: t(event.productKey)');
  });
});
