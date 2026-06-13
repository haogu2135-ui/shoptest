import {
  ORDER_STATUS_PERMISSION,
  adminPermissionLabelKey,
  getEffectiveRole,
  isAdminRole,
  isSuperAdminRole,
  normalizeRole,
} from './roles';

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
});
