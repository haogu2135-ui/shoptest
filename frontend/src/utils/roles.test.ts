import fs from 'fs';
import path from 'path';
import {
  ORDER_STATUS_PERMISSION,
  adminPermissionLabelKey,
  getEffectiveRole,
  isAdminRole,
  isSuperAdminRole,
  normalizeRole,
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

  it('keeps role utilities free of unsafe dynamic role display fallback maps', () => {
    expect(rolesSource).not.toContain('ROLE_DISPLAY_NAMES');
    expect(rolesSource).not.toContain('ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY]');
    expect(rolesSource).toContain("|| 'UNKNOWN'");
  });
});
