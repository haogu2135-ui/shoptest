export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export const normalizeRole = (role?: string | null) => (role || '').trim().toUpperCase();

export const getEffectiveRole = (role?: string | null, roleCode?: string | null) => {
  const normalizedRole = normalizeRole(role);
  const normalizedRoleCode = normalizeRole(roleCode);
  if (normalizedRoleCode === SUPER_ADMIN_ROLE || normalizedRole === SUPER_ADMIN_ROLE) return SUPER_ADMIN_ROLE;
  if (normalizedRole === 'ADMIN') return 'ADMIN';
  return normalizedRole || normalizedRoleCode;
};

export const isAdminRole = (role?: string | null) =>
  ADMIN_ROLES.includes(normalizeRole(role) as typeof ADMIN_ROLES[number]);

export const isSuperAdminRole = (role?: string | null) =>
  normalizeRole(role) === SUPER_ADMIN_ROLE;

const ROLE_LABEL_KEYS: Record<string, 'USER' | 'ADMIN' | 'SUPER_ADMIN'> = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  [SUPER_ADMIN_ROLE]: 'SUPER_ADMIN',
};

export const roleLabelKey = (role?: string | null) => {
  const normalized = normalizeRole(role);
  return `pages.adminUsers.roleValues.${ROLE_LABEL_KEYS[normalized] || 'UNKNOWN'}`;
};

export const roleColor = (role?: string | null) => {
  const normalized = normalizeRole(role);
  if (normalized === SUPER_ADMIN_ROLE) return 'gold';
  if (normalized === 'ADMIN') return 'volcano';
  if (normalized === 'USER') return 'blue';
  return 'default';
};

export const ALERTS_PURGE_PERMISSION = 'alerts:purge';
export const ALERTS_SELF_CHECK_PERMISSION = 'alerts:self-check';
export const ALERTS_ACKNOWLEDGE_PERMISSION = 'alerts:acknowledge';
export const ALERTS_RESOLVE_PERMISSION = 'alerts:resolve';
export const DASHBOARD_PAGE_PERMISSION = 'dashboard';
export const PRODUCTS_PAGE_PERMISSION = 'products';
export const BRANDS_PAGE_PERMISSION = 'brands';
export const CATEGORIES_PAGE_PERMISSION = 'categories';
export const ORDERS_PAGE_PERMISSION = 'orders';
export const LOGISTICS_CARRIERS_PAGE_PERMISSION = 'logistics-carriers';
export const USERS_PAGE_PERMISSION = 'users';
export const PERMISSIONS_PAGE_PERMISSION = 'permissions';
export const REVIEWS_PAGE_PERMISSION = 'reviews';
export const QUESTIONS_PAGE_PERMISSION = 'questions';
export const COUPONS_PAGE_PERMISSION = 'coupons';
export const NOTIFICATIONS_PAGE_PERMISSION = 'notifications';
export const ANNOUNCEMENTS_PAGE_PERMISSION = 'announcements';
export const AUDIT_LOGS_PAGE_PERMISSION = 'audit-logs';
export const ALERTS_PAGE_PERMISSION = 'alerts';
export const BUGS_PAGE_PERMISSION = 'bugs';
export const IP_BLACKLIST_PAGE_PERMISSION = 'ip-blacklist';
export const LOGS_PAGE_PERMISSION = 'logs';
export const SUPPORT_PAGE_PERMISSION = 'support';
export const PET_GALLERY_PAGE_PERMISSION = 'pet-gallery';
export const REGISTRY_PAGE_PERMISSION = 'registry';
export const CONFIG_CENTER_PAGE_PERMISSION = 'config-center';
export const TRAFFIC_CONTROL_PAGE_PERMISSION = 'traffic-control';
export const SYSTEM_PAGE_PERMISSION = 'system';
export const BUGS_READ_PERMISSION = 'bugs:read';
export const BUGS_WRITE_PERMISSION = 'bugs:write';
export const BUGS_STATUS_PERMISSION = 'bugs:status';
export const BUGS_SCAN_PERMISSION = 'bugs:scan';
export const BUGS_ACCESS_PERMISSIONS = [
  BUGS_PAGE_PERMISSION,
  BUGS_READ_PERMISSION,
  BUGS_WRITE_PERMISSION,
  BUGS_STATUS_PERMISSION,
  BUGS_SCAN_PERMISSION,
] as const;
export const NOTIFICATIONS_BROADCAST_PERMISSION = 'notifications:broadcast';
export const IP_BLACKLIST_BLOCK_PERMISSION = 'ip-blacklist:block';
export const IP_BLACKLIST_RELEASE_PERMISSION = 'ip-blacklist:release';
export const IP_BLACKLIST_RECORD_FAILURE_PERMISSION = 'ip-blacklist:record-failure';
export const LOGS_DEBUG_PERMISSION = 'logs:debug';
export const LOGS_DOWNLOAD_PERMISSION = 'logs:download';
export const AUDIT_LOGS_EXPORT_PERMISSION = 'audit-logs:export';
export const AUDIT_LOGS_PURGE_PERMISSION = 'audit-logs:purge';
export const TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION = 'traffic-control:rate-limit-clear';
export const TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION = 'traffic-control:circuit-reset';
export const CONFIG_CENTER_APPLY_PERMISSION = 'config-center:apply';
export const CONFIG_CENTER_PUBLISH_PERMISSION = 'config-center:publish';
export const ORDER_STATUS_PERMISSION = 'orders:status';
export const ORDER_FULFILLMENT_PERMISSION = 'orders:fulfillment';
export const ORDER_PAYMENT_PERMISSION = 'orders:payment';
export const ORDER_REFUND_PERMISSION = 'orders:refund';
export const ORDER_EXPORT_PERMISSION = 'orders:export';
export const PRODUCTS_WRITE_PERMISSION = 'products:write';
export const PRODUCTS_DELETE_PERMISSION = 'products:delete';
export const PRODUCTS_STATUS_PERMISSION = 'products:status';
export const PRODUCTS_IMPORT_PERMISSION = 'products:import';
export const BRANDS_WRITE_PERMISSION = 'brands:write';
export const BRANDS_DELETE_PERMISSION = 'brands:delete';
export const CATEGORIES_WRITE_PERMISSION = 'categories:write';
export const CATEGORIES_DELETE_PERMISSION = 'categories:delete';
export const LOGISTICS_CARRIERS_WRITE_PERMISSION = 'logistics-carriers:write';
export const LOGISTICS_CARRIERS_DELETE_PERMISSION = 'logistics-carriers:delete';
export const USERS_WRITE_PERMISSION = 'users:write';
export const USERS_STATUS_PERMISSION = 'users:status';
export const USERS_DELETE_PERMISSION = 'users:delete';
export const USERS_EXPORT_PERMISSION = 'users:export';
export const COUPONS_WRITE_PERMISSION = 'coupons:write';
export const COUPONS_DELETE_PERMISSION = 'coupons:delete';
export const COUPONS_GRANT_PERMISSION = 'coupons:grant';
export const COUPONS_BIRTHDAY_RUN_PERMISSION = 'coupons:birthday-run';
export const COUPONS_BIRTHDAY_CONFIG_PERMISSION = 'coupons:birthday-config';
export const COUPONS_BIRTHDAY_REISSUE_PERMISSION = 'coupons:birthday-reissue';
export const ANNOUNCEMENTS_WRITE_PERMISSION = 'announcements:write';
export const ANNOUNCEMENTS_DELETE_PERMISSION = 'announcements:delete';
export const PET_GALLERY_DELETE_PERMISSION = 'pet-gallery:delete';
export const SUPPORT_REPLY_PERMISSION = 'support:reply';
export const SUPPORT_ASSIGN_PERMISSION = 'support:assign';
export const SUPPORT_CLOSE_PERMISSION = 'support:close';
export const SUPPORT_REOPEN_PERMISSION = 'support:reopen';
export const SUPPORT_READ_STATE_PERMISSION = 'support:read-state';
export const REVIEWS_MODERATE_PERMISSION = 'reviews:moderate';
export const REVIEWS_REPLY_PERMISSION = 'reviews:reply';
export const REVIEWS_DELETE_PERMISSION = 'reviews:delete';
export const QUESTIONS_ANSWER_PERMISSION = 'questions:answer';
export const QUESTIONS_DELETE_PERMISSION = 'questions:delete';

export const ADMIN_ACTION_PERMISSIONS = [
  ORDER_STATUS_PERMISSION,
  ORDER_FULFILLMENT_PERMISSION,
  ORDER_PAYMENT_PERMISSION,
  ORDER_REFUND_PERMISSION,
  ORDER_EXPORT_PERMISSION,
  SUPPORT_REPLY_PERMISSION,
  SUPPORT_ASSIGN_PERMISSION,
  SUPPORT_CLOSE_PERMISSION,
  SUPPORT_REOPEN_PERMISSION,
  SUPPORT_READ_STATE_PERMISSION,
  NOTIFICATIONS_BROADCAST_PERMISSION,
  ALERTS_PURGE_PERMISSION,
  ALERTS_SELF_CHECK_PERMISSION,
  ALERTS_ACKNOWLEDGE_PERMISSION,
  ALERTS_RESOLVE_PERMISSION,
  BUGS_READ_PERMISSION,
  BUGS_WRITE_PERMISSION,
  BUGS_STATUS_PERMISSION,
  BUGS_SCAN_PERMISSION,
  IP_BLACKLIST_BLOCK_PERMISSION,
  IP_BLACKLIST_RELEASE_PERMISSION,
  IP_BLACKLIST_RECORD_FAILURE_PERMISSION,
  LOGS_DEBUG_PERMISSION,
  LOGS_DOWNLOAD_PERMISSION,
  AUDIT_LOGS_EXPORT_PERMISSION,
  AUDIT_LOGS_PURGE_PERMISSION,
  TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION,
  TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION,
  CONFIG_CENTER_APPLY_PERMISSION,
  CONFIG_CENTER_PUBLISH_PERMISSION,
  PRODUCTS_WRITE_PERMISSION,
  PRODUCTS_DELETE_PERMISSION,
  PRODUCTS_STATUS_PERMISSION,
  PRODUCTS_IMPORT_PERMISSION,
  BRANDS_WRITE_PERMISSION,
  BRANDS_DELETE_PERMISSION,
  CATEGORIES_WRITE_PERMISSION,
  CATEGORIES_DELETE_PERMISSION,
  LOGISTICS_CARRIERS_WRITE_PERMISSION,
  LOGISTICS_CARRIERS_DELETE_PERMISSION,
  USERS_WRITE_PERMISSION,
  USERS_STATUS_PERMISSION,
  USERS_DELETE_PERMISSION,
  USERS_EXPORT_PERMISSION,
  COUPONS_WRITE_PERMISSION,
  COUPONS_DELETE_PERMISSION,
  COUPONS_GRANT_PERMISSION,
  COUPONS_BIRTHDAY_RUN_PERMISSION,
  COUPONS_BIRTHDAY_CONFIG_PERMISSION,
  COUPONS_BIRTHDAY_REISSUE_PERMISSION,
  ANNOUNCEMENTS_WRITE_PERMISSION,
  ANNOUNCEMENTS_DELETE_PERMISSION,
  PET_GALLERY_DELETE_PERMISSION,
  REVIEWS_MODERATE_PERMISSION,
  REVIEWS_REPLY_PERMISSION,
  REVIEWS_DELETE_PERMISSION,
  QUESTIONS_ANSWER_PERMISSION,
  QUESTIONS_DELETE_PERMISSION,
];

export const ADMIN_NAV_PAGE_PERMISSIONS = [
  DASHBOARD_PAGE_PERMISSION,
  PRODUCTS_PAGE_PERMISSION,
  BRANDS_PAGE_PERMISSION,
  CATEGORIES_PAGE_PERMISSION,
  ORDERS_PAGE_PERMISSION,
  LOGISTICS_CARRIERS_PAGE_PERMISSION,
  USERS_PAGE_PERMISSION,
  PERMISSIONS_PAGE_PERMISSION,
  REVIEWS_PAGE_PERMISSION,
  QUESTIONS_PAGE_PERMISSION,
  COUPONS_PAGE_PERMISSION,
  NOTIFICATIONS_PAGE_PERMISSION,
  ANNOUNCEMENTS_PAGE_PERMISSION,
  AUDIT_LOGS_PAGE_PERMISSION,
  ALERTS_PAGE_PERMISSION,
  BUGS_PAGE_PERMISSION,
  IP_BLACKLIST_PAGE_PERMISSION,
  LOGS_PAGE_PERMISSION,
  SUPPORT_PAGE_PERMISSION,
  PET_GALLERY_PAGE_PERMISSION,
  REGISTRY_PAGE_PERMISSION,
  CONFIG_CENTER_PAGE_PERMISSION,
  TRAFFIC_CONTROL_PAGE_PERMISSION,
  SYSTEM_PAGE_PERMISSION,
];

export const ADMIN_PAGE_PERMISSIONS = [
  ...ADMIN_NAV_PAGE_PERMISSIONS,
  ...ADMIN_ACTION_PERMISSIONS,
];

export const hasAdminPermission = (
  permissions: readonly string[] | undefined,
  role: string | null | undefined,
  permission: string,
) => isSuperAdminRole(role) || Boolean(permission && permissions?.includes(permission));

const ADMIN_PERMISSION_LABEL_KEYS: Record<string, string> = {
  dashboard: 'dashboard',
  products: 'products',
  brands: 'brands',
  categories: 'categories',
  orders: 'orders',
  'logistics-carriers': 'logisticsCarriers',
  users: 'users',
  permissions: 'permissions',
  reviews: 'reviews',
  questions: 'questions',
  coupons: 'coupons',
  notifications: 'notifications',
  announcements: 'announcements',
  'audit-logs': 'auditLogs',
  alerts: 'alerts',
  [BUGS_PAGE_PERMISSION]: 'bugs',
  'ip-blacklist': 'ipBlacklist',
  logs: 'logs',
  support: 'support',
  'pet-gallery': 'petGallery',
  registry: 'registry',
  'config-center': 'configCenter',
  'traffic-control': 'trafficControl',
  system: 'system',
  [ORDER_STATUS_PERMISSION]: 'orderStatusActions',
  [ORDER_FULFILLMENT_PERMISSION]: 'orderFulfillmentActions',
  [ORDER_PAYMENT_PERMISSION]: 'orderPaymentActions',
  [ORDER_REFUND_PERMISSION]: 'orderRefundActions',
  [NOTIFICATIONS_BROADCAST_PERMISSION]: 'notificationBroadcastActions',
  [ALERTS_PURGE_PERMISSION]: 'alertPurgeActions',
  [ALERTS_SELF_CHECK_PERMISSION]: 'alertSelfCheckActions',
  [ALERTS_ACKNOWLEDGE_PERMISSION]: 'alertAcknowledgeActions',
  [ALERTS_RESOLVE_PERMISSION]: 'alertResolveActions',
  [BUGS_READ_PERMISSION]: 'bugReadActions',
  [BUGS_WRITE_PERMISSION]: 'bugWriteActions',
  [BUGS_STATUS_PERMISSION]: 'bugStatusActions',
  [BUGS_SCAN_PERMISSION]: 'bugScanActions',
  [IP_BLACKLIST_BLOCK_PERMISSION]: 'ipBlacklistBlockActions',
  [IP_BLACKLIST_RELEASE_PERMISSION]: 'ipBlacklistReleaseActions',
  [IP_BLACKLIST_RECORD_FAILURE_PERMISSION]: 'ipBlacklistRecordFailureActions',
  [LOGS_DEBUG_PERMISSION]: 'logDebugActions',
  [LOGS_DOWNLOAD_PERMISSION]: 'logDownloadActions',
  [AUDIT_LOGS_EXPORT_PERMISSION]: 'auditLogExportActions',
  [AUDIT_LOGS_PURGE_PERMISSION]: 'auditLogPurgeActions',
  [TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION]: 'trafficControlRateLimitClearActions',
  [TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION]: 'trafficControlCircuitResetActions',
  [CONFIG_CENTER_APPLY_PERMISSION]: 'configCenterApplyActions',
  [CONFIG_CENTER_PUBLISH_PERMISSION]: 'configCenterPublishActions',
  [ORDER_EXPORT_PERMISSION]: 'orderExportActions',
  [SUPPORT_REPLY_PERMISSION]: 'supportReplyActions',
  [SUPPORT_ASSIGN_PERMISSION]: 'supportAssignActions',
  [SUPPORT_CLOSE_PERMISSION]: 'supportCloseActions',
  [SUPPORT_REOPEN_PERMISSION]: 'supportReopenActions',
  [SUPPORT_READ_STATE_PERMISSION]: 'supportReadStateActions',
  [PRODUCTS_WRITE_PERMISSION]: 'productWriteActions',
  [PRODUCTS_DELETE_PERMISSION]: 'productDeleteActions',
  [PRODUCTS_STATUS_PERMISSION]: 'productStatusActions',
  [PRODUCTS_IMPORT_PERMISSION]: 'productImportActions',
  [BRANDS_WRITE_PERMISSION]: 'brandWriteActions',
  [BRANDS_DELETE_PERMISSION]: 'brandDeleteActions',
  [CATEGORIES_WRITE_PERMISSION]: 'categoryWriteActions',
  [CATEGORIES_DELETE_PERMISSION]: 'categoryDeleteActions',
  [LOGISTICS_CARRIERS_WRITE_PERMISSION]: 'logisticsCarrierWriteActions',
  [LOGISTICS_CARRIERS_DELETE_PERMISSION]: 'logisticsCarrierDeleteActions',
  [USERS_WRITE_PERMISSION]: 'userWriteActions',
  [USERS_STATUS_PERMISSION]: 'userStatusActions',
  [USERS_DELETE_PERMISSION]: 'userDeleteActions',
  [USERS_EXPORT_PERMISSION]: 'userExportActions',
  [COUPONS_WRITE_PERMISSION]: 'couponWriteActions',
  [COUPONS_DELETE_PERMISSION]: 'couponDeleteActions',
  [COUPONS_GRANT_PERMISSION]: 'couponGrantActions',
  [COUPONS_BIRTHDAY_RUN_PERMISSION]: 'couponBirthdayRunActions',
  [COUPONS_BIRTHDAY_CONFIG_PERMISSION]: 'couponBirthdayConfigActions',
  [COUPONS_BIRTHDAY_REISSUE_PERMISSION]: 'couponBirthdayReissueActions',
  [ANNOUNCEMENTS_WRITE_PERMISSION]: 'announcementWriteActions',
  [ANNOUNCEMENTS_DELETE_PERMISSION]: 'announcementDeleteActions',
  [PET_GALLERY_DELETE_PERMISSION]: 'petGalleryDeleteActions',
  [REVIEWS_MODERATE_PERMISSION]: 'reviewModerateActions',
  [REVIEWS_REPLY_PERMISSION]: 'reviewReplyActions',
  [REVIEWS_DELETE_PERMISSION]: 'reviewDeleteActions',
  [QUESTIONS_ANSWER_PERMISSION]: 'questionAnswerActions',
  [QUESTIONS_DELETE_PERMISSION]: 'questionDeleteActions',
};

export const adminPermissionLabelKey = (permission: string) => {
  const normalizedPermission = String(permission || '').trim();
  return `adminLayout.${ADMIN_PERMISSION_LABEL_KEYS[normalizedPermission] || 'unknownPermission'}`;
};
