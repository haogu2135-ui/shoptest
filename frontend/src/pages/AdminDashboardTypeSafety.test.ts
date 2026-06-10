import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'AdminDashboard.tsx'), 'utf8');

describe('AdminDashboard type-safety guards', () => {
  it('keeps dashboard loading and top-product table rows typed without broad any usage', () => {
    expect(source).toContain("type TopDashboardProduct = NonNullable<DashboardStats['topProducts']>[number];");
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('pages.adminDashboard.loadFailed'), language)");
    expect(source).toContain('row: TopDashboardProduct');
    expect(source).toContain('dashboardProductName(row)');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('row: any');
    expect(source).not.toContain('as any');
  });
});
