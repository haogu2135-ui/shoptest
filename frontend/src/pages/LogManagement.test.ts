import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'LogManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'LogManagement.css'), 'utf8');

describe('LogManagement mobile RangePicker guards', () => {
  it('keeps log admin API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.logAdmin.loadFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.logAdmin.levelToggleFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.logAdmin.downloadFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });

  it('uses a scoped body-mounted popup layer for the log export RangePicker', () => {
    expect(pageSource).toContain("const logRangePickerClassNames = { popup: { root: 'shop-mobile-popup-layer log-management__rangePopup' } };");
    expect(pageSource).toContain('<RangePicker');
    expect(pageSource).toContain('placement="bottomLeft"');
    expect(pageSource).toContain('classNames={logRangePickerClassNames}');
    expect(pageSource).toContain('getPopupContainer={() => document.body}');
    expect(pageSource).toContain('showTime');
    expect(pageSource).toContain('allowClear={false}');
  });

  it('pins the mobile/tablet log export calendar inside the visible viewport', () => {
    const f3532Start = cssSource.indexOf('/* F3532');
    const f3532Css = cssSource.slice(f3532Start);

    expect(f3532Start).toBeGreaterThanOrEqual(0);
    expect(f3532Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{[\s\S]*?\.log-management__download > div\[role="group"\]:first-child\s*\{[\s\S]*?overflow-x:\s*visible;/);
    expect(f3532Css).toMatch(/\.log-management__download \.ant-picker-range\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3532Css).toMatch(/body \.log-management__rangePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?top:\s*max\(12px,\s*env\(safe-area-inset-top,\s*0px\)\)\s*!important;[\s\S]*?bottom:\s*auto\s*!important;[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;/);
    expect(f3532Css).toMatch(/body \.log-management__rangePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?max-width:\s*calc\(100vw - 16px\)\s*!important;[\s\S]*?max-height:\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?overflow:\s*auto\s*!important;[\s\S]*?z-index:\s*2200\s*!important;/);
    expect(f3532Css).toMatch(/body \.log-management__rangePopup\.shop-mobile-popup-layer \.ant-picker-panel-container,[\s\S]*?body \.log-management__rangePopup\.shop-mobile-popup-layer \.ant-picker-range-wrapper\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow:\s*auto\s*!important;/);
    expect(f3532Css).toMatch(/body \.log-management__rangePopup\.shop-mobile-popup-layer \.ant-picker-panels\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
  });
});
