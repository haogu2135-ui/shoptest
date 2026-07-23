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

  it('announces the dashboard spinner loading state as a busy status region', () => {
    const loadingMarkupStart = source.indexOf('className="admin-dashboard__loading"');
    const loadingSource = source.slice(Math.max(0, loadingMarkupStart - 120), loadingMarkupStart + 420);

    expect(loadingMarkupStart).toBeGreaterThan(-1);
    expect(loadingSource).toContain('if (loading)');
    expect(loadingSource).toContain('className="admin-dashboard__loading"');
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingSource).toContain('aria-busy="true"');
    expect(loadingSource).toContain("aria-label={`${t('pages.adminDashboard.title')}: ${t('common.loading')}`}");
    expect(loadingSource).toContain('<ShopSpin size="large" />');
  });

  it('keeps dashboard charts exposed with accessible image labels', () => {
    expect(source).toContain('role="img"');
    expect(source).toContain('aria-label={labels.salesTrendChart}');
    expect(source).toContain('aria-label={labels.orderStatusChart}');
    expect(source).toContain("salesTrendChart: t('pages.adminDashboard.salesTrendChart')");
    expect(source).toContain("orderStatusChart: t('pages.adminDashboard.orderStatusChart')");
    expect(source).not.toContain('AdminUserGrowthChart');
    expect(source).not.toContain('AdminRevenueChart');
  });

  it('keeps a page-level admin guard before dashboard API reads', () => {
    const effectStart = source.indexOf('const fetchStats = async () => {');
    const apiCall = source.indexOf('const res = await adminApi.getDashboard();', effectStart);
    const guard = source.indexOf('if (!token || !isAdminRole(user?.role)) {', effectStart);

    expect(source).toContain("import { useAuth } from '../hooks/useAuth';");
    expect(source).toContain("import { isAdminRole } from '../utils/roles';");
    expect(effectStart).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(effectStart);
    expect(apiCall).toBeGreaterThan(guard);
    expect(source).toContain("setLoadError(t('adminLayout.noPermission'));");
    expect(source).toContain("navigate('/', { replace: true });");
  });
});
