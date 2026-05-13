export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export const normalizeRole = (role?: string | null) => (role || '').trim().toUpperCase();

export const getEffectiveRole = (role?: string | null, roleCode?: string | null) => {
  const normalizedRoleCode = normalizeRole(roleCode);
  return normalizedRoleCode || normalizeRole(role);
};

export const isAdminRole = (role?: string | null) =>
  Boolean(normalizeRole(role)) && normalizeRole(role) !== 'USER';

export const isSuperAdminRole = (role?: string | null) =>
  normalizeRole(role) === SUPER_ADMIN_ROLE;

export const roleColor = (role?: string | null) => {
  const normalized = normalizeRole(role);
  if (normalized === SUPER_ADMIN_ROLE) return 'gold';
  if (normalized === 'ADMIN') return 'volcano';
  return 'blue';
};

export const ADMIN_PAGE_PERMISSIONS = [
  'dashboard',
  'products',
  'brands',
  'categories',
  'orders',
  'logistics-carriers',
  'users',
  'permissions',
  'reviews',
  'coupons',
  'notifications',
  'audit-logs',
  'support',
];
