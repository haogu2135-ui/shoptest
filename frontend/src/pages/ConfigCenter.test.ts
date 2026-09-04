import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ConfigCenter.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'ConfigCenter.css'), 'utf8');

describe('ConfigCenter mobile editor containment guards', () => {
  it('renders the properties editor inside the Config Center grid', () => {
    expect(pageSource).toContain('className="config-center__grid"');
    expect(pageSource).toContain('className="config-center__card config-center__editorCard"');
    expect(pageSource).toContain('className="config-center__contentItem"');
    expect(pageSource).toContain('className="config-center__editor"');
    expect(pageSource).toContain("t('pages.configCenter.propertiesContent')");
  });

  it('keeps the mobile editor card and textarea within the visible viewport width', () => {
    const f3520Start = cssSource.indexOf('/* F3520');
    const f3520Css = cssSource.slice(f3520Start);

    expect(f3520Start).toBeGreaterThanOrEqual(0);
    expect(f3520Css).toMatch(/@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.config-center__grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(f3520Css).toMatch(/\.config-center__grid\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
    expect(f3520Css).toMatch(/\.config-center__editorCard,[\s\S]*?\.config-center__contentItem[\s\S]*?(?:textarea\.config-center__editor|\.config-center__editor)\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
    expect(f3520Css).toMatch(/\.config-center__contentItem[\s\S]*?(?:textarea\.config-center__editor|\.shop-input__control--textarea)\s*\{[\s\S]*?font-size:\s*16px\s*!important;/);
    expect(f3520Css).toMatch(/\.config-center__contentItem[\s\S]*?(?:textarea\.config-center__editor|\.shop-input__control--textarea)\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?white-space:\s*pre-wrap;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(f3520Css).not.toMatch(/minmax\(4\d{2}px/);
    expect(f3520Css).not.toMatch(/width:\s*4\d{2}px/);
  });

  it('uses ShopInput/ShopTextArea instead of ant Input', () => {
    expect(pageSource).toContain('ShopInput');
    expect(pageSource).toContain('ShopTextArea');
    expect(pageSource).not.toMatch(/import \{[^}]*\bInput\b[^}]*\} from 'antd'/);
    expect(pageSource).not.toMatch(/const \{ TextArea \} = Input|<TextArea\b|<Input\b/);
  });

  it('cancels stale config and permission reads', () => {
    expect(pageSource).toContain('const snapshotAbortRef = useRef<AbortController | null>(null);');
    expect(pageSource).toContain('snapshotAbortRef.current?.abort();');
    expect(pageSource).toContain('adminApi.getConfigCenter({');
    expect(pageSource).toContain('}, { signal: abortController.signal });');
    expect(pageSource).toContain('adminApi.getMyPermissions({ signal: abortController.signal })');
    expect(pageSource).toContain('permissionsAbortRef.current?.abort();');
  });
});

describe('ConfigCenter action lifecycle guards', () => {
  it('latches publish and runtime-apply actions before async validation', () => {
    expect(pageSource).toContain('const publishingRef = useRef(false);');
    expect(pageSource).toContain('const applyingRef = useRef(false);');
    expect(pageSource).toContain('if (!mountedRef.current || publishingRef.current || applyingRef.current) return;');
    expect(pageSource).toContain('if (!mountedRef.current || applyingRef.current || publishingRef.current) return;');
    expect(pageSource).toContain('publishingRef.current = true;');
    expect(pageSource).toContain('applyingRef.current = true;');
  });

  it('suppresses config state, feedback, and loading cleanup after unmount', () => {
    expect(pageSource).toMatch(/const response = await adminApi\.publishConfigCenter\([\s\S]*?\);\s*if \(!mountedRef\.current\) return;\s*setLoadError\(null\);/);
    expect(pageSource).toMatch(/const response = await adminApi\.applyConfigCenter\([\s\S]*?\);\s*if \(!mountedRef\.current\) return;\s*setLoadError\(null\);/);
    expect(pageSource).toMatch(/catch \(error: unknown\) \{\s*if \(isFormValidationError\(error\)\) return;\s*if \(!mountedRef\.current\) return;/);
    expect(pageSource).toMatch(/publishingRef\.current = false;\s*if \(mountedRef\.current\) setPublishing\(false\);/);
    expect(pageSource).toMatch(/applyingRef\.current = false;\s*if \(mountedRef\.current\) setApplying\(false\);/);
  });
});
