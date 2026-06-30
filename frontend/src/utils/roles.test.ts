import fs from 'fs';
import path from 'path';
import {
  ORDER_STATUS_PERMISSION,
  adminPermissionLabelKey,
  getEffectiveRole,
  isAdminRole,
  isSuperAdminRole,
  normalizeRole,
  roleColor,
  roleLabelKey,
} from './roles';

const rolesSource = fs.readFileSync(path.resolve(__dirname, 'roles.ts'), 'utf8');

describe('role utilities', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeRole(' admin ')).toBe('ADMIN');
    expect(normalizeRole(null)).toBe('');
  });

  it('keeps base admin users admin when they have a custom role code', () => {
    expect(getEffectiveRole('ADMIN', 'customer_service')).toBe('ADMIN');
    expect(isAdminRole(getEffectiveRole('ADMIN', 'customer_service'))).toBe(true);
  });

  it('does not promote arbitrary role codes into admin roles', () => {
    expect(getEffectiveRole('USER', 'manager')).toBe('USER');
    expect(isAdminRole(getEffectiveRole('USER', 'manager'))).toBe(false);
    expect(isAdminRole('manager')).toBe(false);
    expect(isAdminRole('ANONYMOUS')).toBe(false);
    expect(isAdminRole('MODERATOR')).toBe(false);
  });

  it('keeps admin role detection on the explicit whitelist without redundant normalization', () => {
    const start = rolesSource.indexOf('export const isAdminRole =');
    const end = rolesSource.indexOf('export const isSuperAdminRole =', start);
    const implementation = rolesSource.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(implementation).toContain('ADMIN_ROLES.includes(normalizeRole(role) as typeof ADMIN_ROLES[number])');
    expect(implementation).not.toContain("!== 'USER'");
    expect(implementation.match(/normalizeRole/g) || []).toHaveLength(1);
  });

  it('preserves super admin from either role source', () => {
    expect(getEffectiveRole('ADMIN', 'super_admin')).toBe('SUPER_ADMIN');
    expect(getEffectiveRole('super_admin', 'support')).toBe('SUPER_ADMIN');
    expect(isSuperAdminRole(getEffectiveRole('ADMIN', 'super_admin'))).toBe(true);
  });

  it('maps known page and action permissions to explicit admin layout labels', () => {
    expect(adminPermissionLabelKey('products')).toBe('adminLayout.products');
    expect(adminPermissionLabelKey(ORDER_STATUS_PERMISSION)).toBe('adminLayout.orderStatusActions');
  });

  it('uses a fixed label for unknown permissions', () => {
    expect(adminPermissionLabelKey('made-up-permission')).toBe('adminLayout.unknownPermission');
  });

  it('maps unknown role display names to a fixed localized fallback key', () => {
    expect(roleLabelKey('USER')).toBe('pages.adminUsers.roleValues.USER');
    expect(roleLabelKey(' super_admin ')).toBe('pages.adminUsers.roleValues.SUPER_ADMIN');
    expect(roleLabelKey('ROLE_SUPPORT')).toBe('pages.adminUsers.roleValues.UNKNOWN');
    expect(roleLabelKey(null)).toBe('pages.adminUsers.roleValues.UNKNOWN');
  });

  it('uses neutral color for unknown roles', () => {
    expect(roleColor('SUPER_ADMIN')).toBe('gold');
    expect(roleColor('ADMIN')).toBe('volcano');
    expect(roleColor('USER')).toBe('blue');
    expect(roleColor('MODERATOR')).toBe('default');
    expect(roleColor(null)).toBe('default');
  });

  it('keeps admin navigation page permissions backed by named constants', () => {
    const start = rolesSource.indexOf('export const ADMIN_NAV_PAGE_PERMISSIONS = [');
    const end = rolesSource.indexOf('];', start);
    const navPermissions = rolesSource.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(navPermissions).toContain('DASHBOARD_PAGE_PERMISSION');
    expect(navPermissions).toContain('BUGS_PAGE_PERMISSION');
    expect(navPermissions).toContain('SYSTEM_PAGE_PERMISSION');
    expect(navPermissions).not.toMatch(/'[^']+'/);
  });

  it('keeps role utilities free of unsafe dynamic role display fallback maps', () => {
    expect(rolesSource).not.toContain('ROLE_DISPLAY_NAMES');
    expect(rolesSource).not.toContain('ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY]');
    expect(rolesSource).toContain("|| 'UNKNOWN'");
  });
});
