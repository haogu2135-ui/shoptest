const readAdminLayoutSource = () => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'AdminLayout.tsx'), 'utf8') as string
);

export {};

describe('AdminLayout type-safety guard', () => {
  it('keeps admin menu filtering typed without broad assertions', () => {
    const source = readAdminLayoutSource();

    expect(source).not.toContain('filter(Boolean) as any[]');
    expect(source).not.toMatch(/\bas any\b/);
    expect(source).toContain('type AdminMenuItem = {');
    expect(source).toContain('const isAdminMenuItem = (item: AdminMenuItem | null): item is AdminMenuItem => item !== null;');
    expect(source).toContain('const menuItems = useMemo<AdminMenuItem[]>(() => {');
    expect(source).toContain('return items.filter(isAdminMenuItem);');
    expect(source).toContain('const defaultAdminPath = menuItems[0]?.key;');
  });
});
