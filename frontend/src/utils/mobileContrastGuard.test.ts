import fs from 'fs';
import path from 'path';

const readSource = () => fs.readFileSync(path.resolve(__dirname, 'mobileContrastGuard.ts'), 'utf8');

describe('mobileContrastGuard source contract', () => {
  it('keeps scan scheduler state scoped to the installed guard element', () => {
    const source = readSource();

    expect(source).not.toMatch(/\nlet\s+(contrastScanTimer|contrastScanFrame|contrastMarkedElements|lastMobileInteractionAt)\b/);
    expect(source).toContain('type MobileContrastGuardState');
    expect(source).toContain('CONTRAST_GUARD_STATE_PROP');
    expect(source).toContain('getMobileContrastGuardState(style);');
    expect(source).toContain('readMobileContrastGuardState()');
    expect(source).toContain('state.scanTimer');
    expect(source).toContain('state.scanFrame');
    expect(source).toContain('state.markedElements');
    expect(source).toContain('state.lastInteractionAt');
  });

  it('keeps native home and catalog primary CTAs readable in the Android WebView', () => {
    const source = readSource();

    expect(source).toContain('.shopee-hero__actions .home-btn');
    expect(source).toContain('.shopee-hero__authActions .home-btn');
    expect(source).toContain('.product-list__actionButton.ant-btn-primary');
    expect(source).toContain('-webkit-text-fill-color: #ffffff !important;');
    expect(source).toContain('.product-list__actionButton.ant-btn-primary.ant-btn-disabled');
    expect(source).toContain('fill: currentColor !important;');
  });
});
