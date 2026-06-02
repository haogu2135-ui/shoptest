import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, InputNumber, Popconfirm, Progress, Select, Space, Table, Tag, Typography, message } from 'antd';
import { AlertOutlined, DeleteOutlined, DownloadOutlined, KeyOutlined, MailOutlined, SafetyCertificateOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api';
import type { SecurityAuditLog, SecurityAuditSummary } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import { AUDIT_LOGS_EXPORT_PERMISSION, AUDIT_LOGS_PURGE_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './SecurityAuditLogManagement.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const actionColors: Record<string, string> = {
  LOGIN: 'blue',
  LOGOUT: 'default',
  ADMIN_BOOTSTRAP: 'red',
  EMAIL_LOGIN: 'blue',
  TOKEN_REFRESH: 'cyan',
  USER_PROFILE_UPDATE: 'blue',
  USER_PROFILE_EMAIL_CODE: 'cyan',
  USER_PASSWORD_UPDATE: 'red',
  USER_UPDATE: 'blue',
  USER_STATUS_UPDATE: 'gold',
  USER_ROLE_UPDATE: 'red',
  USER_ROLE_ASSIGN: 'red',
  USER_EXPORT: 'volcano',
  USER_DELETE: 'red',
  ADMIN_ROLE_SAVE: 'purple',
  PAYMENT_CREATE: 'cyan',
  PAYMENT_CALLBACK: 'green',
  PAYMENT_SYNC: 'geekblue',
  PAYMENT_SIMULATE_PAID: 'orange',
  PAYMENT_SIMULATE_CALLBACK: 'orange',
  STRIPE_WEBHOOK: 'green',
  ORDER_CANCEL: 'red',
  ORDER_BATCH_SHIP: 'geekblue',
  RETURN_REQUEST: 'gold',
  RETURN_SHIPMENT_SUBMIT: 'gold',
  REFUND_COMPLETE: 'purple',
  CONFIG_PUBLISH: 'cyan',
  CONFIG_APPLY_RUNTIME: 'cyan',
  LOG_DEBUG_TOGGLE: 'orange',
  LOG_PREVIEW: 'orange',
  LOG_DOWNLOAD: 'volcano',
  AUDIT_LOG_PURGE: 'red',
  AUDIT_LOG_EXPORT: 'volcano',
  ALERT_SELF_CHECK: 'magenta',
  ALERT_ACKNOWLEDGE: 'gold',
  ALERT_RESOLVE: 'green',
  ALERT_BATCH_ACKNOWLEDGE: 'gold',
  ALERT_BATCH_RESOLVE: 'green',
  ALERT_PURGE_RESOLVED: 'red',
  IP_BLACKLIST_BLOCK: 'red',
  IP_BLACKLIST_RELEASE: 'green',
  IP_BLACKLIST_BATCH_RELEASE: 'green',
  TRAFFIC_RATE_LIMIT_CLEAR: 'blue',
  TRAFFIC_CIRCUIT_RESET: 'purple',
  PRODUCT_CREATE: 'green',
  PRODUCT_UPDATE: 'blue',
  PRODUCT_DELETE: 'red',
  PRODUCT_STATUS_UPDATE: 'gold',
  PRODUCT_BATCH_STATUS_UPDATE: 'gold',
  BRAND_CREATE: 'green',
  BRAND_UPDATE: 'blue',
  BRAND_DELETE: 'red',
  CATEGORY_CREATE: 'green',
  CATEGORY_UPDATE: 'blue',
  CATEGORY_DELETE: 'red',
  LOGISTICS_CARRIER_CREATE: 'green',
  LOGISTICS_CARRIER_UPDATE: 'blue',
  LOGISTICS_CARRIER_DELETE: 'red',
  PRODUCT_QUESTION_ANSWER: 'green',
  REVIEW_REPLY: 'green',
  REVIEW_STATUS_UPDATE: 'gold',
  REVIEW_DELETE: 'red',
  SUPPORT_MESSAGE_SEND: 'green',
  SUPPORT_SESSION_CLOSE: 'gold',
  SUPPORT_SESSION_ASSIGN: 'blue',
  SUPPORT_SESSION_REOPEN: 'cyan',
  SUPPORT_BIRTHDAY_COUPON_REISSUE: 'magenta',
  NOTIFICATION_BROADCAST: 'purple',
  ANNOUNCEMENT_CREATE: 'green',
  ANNOUNCEMENT_UPDATE: 'blue',
  ANNOUNCEMENT_DELETE: 'red',
  PRODUCT_IMPORT_PREVIEW: 'cyan',
  PRODUCT_IMPORT_APPLY: 'green',
  PRODUCT_URL_IMPORT: 'geekblue',
  COUPON_CREATE: 'green',
  COUPON_UPDATE: 'blue',
  COUPON_DELETE: 'red',
  COUPON_GRANT: 'purple',
  PET_BIRTHDAY_COUPON_RUN: 'magenta',
  PET_BIRTHDAY_COUPON_CONFIG_UPDATE: 'magenta',
  PET_BIRTHDAY_COUPON_REISSUE: 'magenta',
  PET_GALLERY_PHOTO_DELETE: 'red',
};

export const auditActionOptions = [
  'LOGIN',
  'LOGOUT',
  'ADMIN_BOOTSTRAP',
  'EMAIL_LOGIN',
  'TOKEN_REFRESH',
  'USER_PROFILE_UPDATE',
  'USER_PROFILE_EMAIL_CODE',
  'USER_PASSWORD_UPDATE',
  'USER_UPDATE',
  'USER_STATUS_UPDATE',
  'USER_ROLE_UPDATE',
  'USER_ROLE_ASSIGN',
  'USER_EXPORT',
  'USER_DELETE',
  'ADMIN_ROLE_SAVE',
  'PAYMENT_CREATE',
  'PAYMENT_CALLBACK',
  'PAYMENT_SYNC',
  'PAYMENT_SIMULATE_PAID',
  'PAYMENT_SIMULATE_CALLBACK',
  'STRIPE_WEBHOOK',
  'ORDER_CANCEL',
  'RETURN_REQUEST',
  'RETURN_APPROVE',
  'RETURN_REJECT',
  'RETURN_SHIPMENT_SUBMIT',
  'REFUND_COMPLETE',
  'ORDER_STATUS_UPDATE',
  'ORDER_BATCH_SHIP',
  'ORDER_EXPORT',
  'CONFIG_PUBLISH',
  'CONFIG_APPLY_RUNTIME',
  'LOG_DEBUG_TOGGLE',
  'LOG_PREVIEW',
  'LOG_DOWNLOAD',
  'AUDIT_LOG_PURGE',
  'AUDIT_LOG_EXPORT',
  'ALERT_SELF_CHECK',
  'ALERT_ACKNOWLEDGE',
  'ALERT_RESOLVE',
  'ALERT_BATCH_ACKNOWLEDGE',
  'ALERT_BATCH_RESOLVE',
  'ALERT_PURGE_RESOLVED',
  'IP_BLACKLIST_BLOCK',
  'IP_BLACKLIST_RELEASE',
  'IP_BLACKLIST_BATCH_RELEASE',
  'TRAFFIC_RATE_LIMIT_CLEAR',
  'TRAFFIC_CIRCUIT_RESET',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_DELETE',
  'PRODUCT_STATUS_UPDATE',
  'PRODUCT_BATCH_STATUS_UPDATE',
  'BRAND_CREATE',
  'BRAND_UPDATE',
  'BRAND_DELETE',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'CATEGORY_DELETE',
  'LOGISTICS_CARRIER_CREATE',
  'LOGISTICS_CARRIER_UPDATE',
  'LOGISTICS_CARRIER_DELETE',
  'PRODUCT_QUESTION_ANSWER',
  'REVIEW_REPLY',
  'REVIEW_STATUS_UPDATE',
  'REVIEW_DELETE',
  'SUPPORT_MESSAGE_SEND',
  'SUPPORT_SESSION_CLOSE',
  'SUPPORT_SESSION_ASSIGN',
  'SUPPORT_SESSION_REOPEN',
  'SUPPORT_BIRTHDAY_COUPON_REISSUE',
  'NOTIFICATION_BROADCAST',
  'ANNOUNCEMENT_CREATE',
  'ANNOUNCEMENT_UPDATE',
  'ANNOUNCEMENT_DELETE',
  'PRODUCT_IMPORT_PREVIEW',
  'PRODUCT_IMPORT_APPLY',
  'PRODUCT_URL_IMPORT',
  'COUPON_CREATE',
  'COUPON_UPDATE',
  'COUPON_DELETE',
  'COUPON_GRANT',
  'PET_BIRTHDAY_COUPON_RUN',
  'PET_BIRTHDAY_COUPON_CONFIG_UPDATE',
  'PET_BIRTHDAY_COUPON_REISSUE',
  'PET_GALLERY_PHOTO_DELETE',
];

const highRiskActions = new Set([
  'AUDIT_LOG_EXPORT',
  'ADMIN_BOOTSTRAP',
  'USER_PASSWORD_UPDATE',
  'USER_PROFILE_EMAIL_CODE',
  'USER_ROLE_UPDATE',
  'USER_ROLE_ASSIGN',
  'USER_EXPORT',
  'USER_DELETE',
  'ADMIN_ROLE_SAVE',
  'ORDER_EXPORT',
  'CONFIG_PUBLISH',
  'CONFIG_APPLY_RUNTIME',
  'LOG_DEBUG_TOGGLE',
  'LOG_PREVIEW',
  'LOG_DOWNLOAD',
  'AUDIT_LOG_PURGE',
  'ORDER_BATCH_SHIP',
  'REFUND_COMPLETE',
  'STRIPE_WEBHOOK',
  'PAYMENT_SIMULATE_CALLBACK',
  'PAYMENT_SIMULATE_PAID',
  'ALERT_PURGE_RESOLVED',
  'IP_BLACKLIST_BLOCK',
  'TRAFFIC_RATE_LIMIT_CLEAR',
  'TRAFFIC_CIRCUIT_RESET',
  'PRODUCT_DELETE',
  'PRODUCT_STATUS_UPDATE',
  'PRODUCT_BATCH_STATUS_UPDATE',
  'BRAND_DELETE',
  'CATEGORY_DELETE',
  'LOGISTICS_CARRIER_DELETE',
  'REVIEW_DELETE',
  'SUPPORT_SESSION_CLOSE',
  'SUPPORT_BIRTHDAY_COUPON_REISSUE',
  'NOTIFICATION_BROADCAST',
  'ANNOUNCEMENT_DELETE',
  'COUPON_DELETE',
  'PET_BIRTHDAY_COUPON_CONFIG_UPDATE',
  'PET_GALLERY_PHOTO_DELETE',
]);

const paymentOpsActions = new Set([
  'PAYMENT_CREATE',
  'PAYMENT_CALLBACK',
  'STRIPE_WEBHOOK',
  'REFUND_COMPLETE',
]);

const accountSecurityActions = new Set([
  'LOGIN',
  'EMAIL_LOGIN',
  'TOKEN_REFRESH',
  'ADMIN_BOOTSTRAP',
  'USER_PROFILE_UPDATE',
  'USER_PROFILE_EMAIL_CODE',
  'USER_PASSWORD_UPDATE',
  'USER_ROLE_UPDATE',
  'USER_ROLE_ASSIGN',
  'USER_EXPORT',
]);

const auditResourceTypeOptions = [
  'USER',
  'ADMIN_ROLE',
  'ORDER',
  'PAYMENT',
  'PRODUCT',
  'BRAND',
  'CATEGORY',
  'LOGISTICS_CARRIER',
  'PRODUCT_QUESTION',
  'REVIEW',
  'SUPPORT_SESSION',
  'NOTIFICATION',
  'SITE_ANNOUNCEMENT',
  'SECURITY_AUDIT_LOG',
  'CONFIG_CENTER',
  'LOGGING',
  'SYSTEM_ALERT',
  'IP_BLACKLIST',
  'TRAFFIC_CONTROL',
  'PRODUCT_IMPORT',
  'COUPON',
  'COUPON_CONFIG',
  'PET_GALLERY',
];

export const auditActionLabels: Record<string, Record<string, string>> = {
  en: {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    ADMIN_BOOTSTRAP: 'Bootstrap admin',
    EMAIL_LOGIN: 'Email login',
    TOKEN_REFRESH: 'Refresh token',
    USER_PROFILE_UPDATE: 'Update own profile',
    USER_PROFILE_EMAIL_CODE: 'Send profile email code',
    USER_PASSWORD_UPDATE: 'Update own password',
    USER_UPDATE: 'Update user profile',
    USER_STATUS_UPDATE: 'Update user status',
    USER_ROLE_UPDATE: 'Update user role',
    USER_ROLE_ASSIGN: 'Assign user role',
    USER_EXPORT: 'Export users',
    USER_DELETE: 'Delete user',
    ADMIN_ROLE_SAVE: 'Save admin role',
    PAYMENT_CREATE: 'Create payment',
    PAYMENT_CALLBACK: 'Payment callback',
    PAYMENT_SYNC: 'Sync payment',
    PAYMENT_SIMULATE_PAID: 'Simulate paid',
    PAYMENT_SIMULATE_CALLBACK: 'Simulate callback',
    STRIPE_WEBHOOK: 'Stripe webhook',
    ORDER_CANCEL: 'Cancel order',
    RETURN_REQUEST: 'Return request',
    RETURN_APPROVE: 'Approve return',
    RETURN_REJECT: 'Reject return',
    RETURN_SHIPMENT_SUBMIT: 'Return shipment submitted',
    REFUND_COMPLETE: 'Refund completed',
    ORDER_STATUS_UPDATE: 'Order status update',
    ORDER_BATCH_SHIP: 'Batch shipment',
    ORDER_EXPORT: 'Order export',
    CONFIG_PUBLISH: 'Publish config',
    CONFIG_APPLY_RUNTIME: 'Apply runtime config',
    LOG_DEBUG_TOGGLE: 'Toggle debug logs',
    LOG_PREVIEW: 'Preview logs',
    LOG_DOWNLOAD: 'Download runtime logs',
    AUDIT_LOG_PURGE: 'Purge audit logs',
    AUDIT_LOG_EXPORT: 'Audit log export',
    ALERT_SELF_CHECK: 'Run alert self-check',
    ALERT_ACKNOWLEDGE: 'Acknowledge alert',
    ALERT_RESOLVE: 'Resolve alert',
    ALERT_BATCH_ACKNOWLEDGE: 'Batch acknowledge alerts',
    ALERT_BATCH_RESOLVE: 'Batch resolve alerts',
    ALERT_PURGE_RESOLVED: 'Purge resolved alerts',
    IP_BLACKLIST_BLOCK: 'Block IP',
    IP_BLACKLIST_RELEASE: 'Release IP block',
    IP_BLACKLIST_BATCH_RELEASE: 'Batch release IP blocks',
    TRAFFIC_RATE_LIMIT_CLEAR: 'Clear rate-limit counters',
    TRAFFIC_CIRCUIT_RESET: 'Reset circuit breaker',
    PRODUCT_CREATE: 'Create product',
    PRODUCT_UPDATE: 'Update product',
    PRODUCT_DELETE: 'Delete product',
    PRODUCT_STATUS_UPDATE: 'Update product status',
    PRODUCT_BATCH_STATUS_UPDATE: 'Batch update product status',
    BRAND_CREATE: 'Create brand',
    BRAND_UPDATE: 'Update brand',
    BRAND_DELETE: 'Delete brand',
    CATEGORY_CREATE: 'Create category',
    CATEGORY_UPDATE: 'Update category',
    CATEGORY_DELETE: 'Delete category',
    LOGISTICS_CARRIER_CREATE: 'Create carrier',
    LOGISTICS_CARRIER_UPDATE: 'Update carrier',
    LOGISTICS_CARRIER_DELETE: 'Delete carrier',
    PRODUCT_QUESTION_ANSWER: 'Answer product question',
    REVIEW_REPLY: 'Reply review',
    REVIEW_STATUS_UPDATE: 'Update review status',
    REVIEW_DELETE: 'Delete review',
    SUPPORT_MESSAGE_SEND: 'Send support message',
    SUPPORT_SESSION_CLOSE: 'Close support session',
    SUPPORT_SESSION_ASSIGN: 'Assign support session',
    SUPPORT_SESSION_REOPEN: 'Reopen support session',
    SUPPORT_BIRTHDAY_COUPON_REISSUE: 'Reissue birthday coupon from support',
    NOTIFICATION_BROADCAST: 'Broadcast notification',
    ANNOUNCEMENT_CREATE: 'Create announcement',
    ANNOUNCEMENT_UPDATE: 'Update announcement',
    ANNOUNCEMENT_DELETE: 'Delete announcement',
    PRODUCT_IMPORT_PREVIEW: 'Preview product import',
    PRODUCT_IMPORT_APPLY: 'Apply product import',
    PRODUCT_URL_IMPORT: 'Import product from URL',
    COUPON_CREATE: 'Create coupon',
    COUPON_UPDATE: 'Update coupon',
    COUPON_DELETE: 'Delete coupon',
    COUPON_GRANT: 'Grant coupon',
    PET_BIRTHDAY_COUPON_RUN: 'Run pet birthday coupons',
    PET_BIRTHDAY_COUPON_CONFIG_UPDATE: 'Update birthday coupon config',
    PET_BIRTHDAY_COUPON_REISSUE: 'Reissue birthday coupon',
    PET_GALLERY_PHOTO_DELETE: 'Delete pet gallery photo',
  },
  es: {
    LOGIN: 'Inicio de sesión',
    LOGOUT: 'Cerrar sesión',
    ADMIN_BOOTSTRAP: 'Inicializar admin',
    EMAIL_LOGIN: 'Inicio por email',
    TOKEN_REFRESH: 'Refrescar token',
    USER_PROFILE_UPDATE: 'Actualizar perfil propio',
    USER_PROFILE_EMAIL_CODE: 'Enviar código de email',
    USER_PASSWORD_UPDATE: 'Actualizar contraseña propia',
    USER_UPDATE: 'Actualizar perfil de usuario',
    USER_STATUS_UPDATE: 'Actualizar estado de usuario',
    USER_ROLE_UPDATE: 'Actualizar rol de usuario',
    USER_ROLE_ASSIGN: 'Asignar rol de usuario',
    USER_EXPORT: 'Exportar usuarios',
    USER_DELETE: 'Eliminar usuario',
    ADMIN_ROLE_SAVE: 'Guardar rol admin',
    PAYMENT_CREATE: 'Crear pago',
    PAYMENT_CALLBACK: 'Callback de pago',
    PAYMENT_SYNC: 'Sincronizar pago',
    PAYMENT_SIMULATE_PAID: 'Simular pago',
    PAYMENT_SIMULATE_CALLBACK: 'Simular callback',
    STRIPE_WEBHOOK: 'Webhook de Stripe',
    ORDER_CANCEL: 'Cancelar pedido',
    RETURN_REQUEST: 'Solicitud de devolución',
    RETURN_APPROVE: 'Aprobar devolución',
    RETURN_REJECT: 'Rechazar devolución',
    RETURN_SHIPMENT_SUBMIT: 'Envío de devolución',
    REFUND_COMPLETE: 'Reembolso completado',
    ORDER_STATUS_UPDATE: 'Actualizar estado',
    ORDER_BATCH_SHIP: 'Envío por lote',
    ORDER_EXPORT: 'Exportar pedidos',
    CONFIG_PUBLISH: 'Publicar configuración',
    CONFIG_APPLY_RUNTIME: 'Aplicar configuración runtime',
    LOG_DEBUG_TOGGLE: 'Cambiar logs debug',
    LOG_PREVIEW: 'Vista previa de logs',
    LOG_DOWNLOAD: 'Descargar logs runtime',
    AUDIT_LOG_PURGE: 'Limpiar auditoría',
    AUDIT_LOG_EXPORT: 'Exportar auditoría',
    ALERT_SELF_CHECK: 'Revisión de alertas',
    ALERT_ACKNOWLEDGE: 'Confirmar alerta',
    ALERT_RESOLVE: 'Resolver alerta',
    ALERT_BATCH_ACKNOWLEDGE: 'Confirmar alertas por lote',
    ALERT_BATCH_RESOLVE: 'Resolver alertas por lote',
    ALERT_PURGE_RESOLVED: 'Limpiar alertas resueltas',
    IP_BLACKLIST_BLOCK: 'Bloquear IP',
    IP_BLACKLIST_RELEASE: 'Liberar bloqueo IP',
    IP_BLACKLIST_BATCH_RELEASE: 'Liberar IPs por lote',
    TRAFFIC_RATE_LIMIT_CLEAR: 'Limpiar límite de tráfico',
    TRAFFIC_CIRCUIT_RESET: 'Reiniciar circuit breaker',
    PRODUCT_CREATE: 'Crear producto',
    PRODUCT_UPDATE: 'Actualizar producto',
    PRODUCT_DELETE: 'Eliminar producto',
    PRODUCT_STATUS_UPDATE: 'Actualizar estado de producto',
    PRODUCT_BATCH_STATUS_UPDATE: 'Actualizar productos por lote',
    BRAND_CREATE: 'Crear marca',
    BRAND_UPDATE: 'Actualizar marca',
    BRAND_DELETE: 'Eliminar marca',
    CATEGORY_CREATE: 'Crear categoría',
    CATEGORY_UPDATE: 'Actualizar categoría',
    CATEGORY_DELETE: 'Eliminar categoría',
    LOGISTICS_CARRIER_CREATE: 'Crear paquetería',
    LOGISTICS_CARRIER_UPDATE: 'Actualizar paquetería',
    LOGISTICS_CARRIER_DELETE: 'Eliminar paquetería',
    PRODUCT_QUESTION_ANSWER: 'Responder pregunta de producto',
    REVIEW_REPLY: 'Responder reseña',
    REVIEW_STATUS_UPDATE: 'Actualizar estado de reseña',
    REVIEW_DELETE: 'Eliminar reseña',
    SUPPORT_MESSAGE_SEND: 'Enviar mensaje de soporte',
    SUPPORT_SESSION_CLOSE: 'Cerrar conversación de soporte',
    SUPPORT_SESSION_ASSIGN: 'Asignar conversación de soporte',
    SUPPORT_SESSION_REOPEN: 'Reabrir conversación de soporte',
    SUPPORT_BIRTHDAY_COUPON_REISSUE: 'Reemitir cupón desde soporte',
    NOTIFICATION_BROADCAST: 'Enviar notificación masiva',
    ANNOUNCEMENT_CREATE: 'Crear anuncio',
    ANNOUNCEMENT_UPDATE: 'Actualizar anuncio',
    ANNOUNCEMENT_DELETE: 'Eliminar anuncio',
    PRODUCT_IMPORT_PREVIEW: 'Previsualizar importación',
    PRODUCT_IMPORT_APPLY: 'Aplicar importación',
    PRODUCT_URL_IMPORT: 'Importar producto desde URL',
    COUPON_CREATE: 'Crear cupón',
    COUPON_UPDATE: 'Actualizar cupón',
    COUPON_DELETE: 'Eliminar cupón',
    COUPON_GRANT: 'Otorgar cupón',
    PET_BIRTHDAY_COUPON_RUN: 'Ejecutar cupones de cumpleaños',
    PET_BIRTHDAY_COUPON_CONFIG_UPDATE: 'Actualizar configuración de cumpleaños',
    PET_BIRTHDAY_COUPON_REISSUE: 'Reemitir cupón de cumpleaños',
    PET_GALLERY_PHOTO_DELETE: 'Eliminar foto de galería',
  },
  zh: {
    LOGIN: '登录',
    LOGOUT: '退出登录',
    ADMIN_BOOTSTRAP: '初始化管理员',
    EMAIL_LOGIN: '邮箱登录',
    TOKEN_REFRESH: '刷新令牌',
    USER_PROFILE_UPDATE: '更新本人资料',
    USER_PROFILE_EMAIL_CODE: '发送资料邮箱验证码',
    USER_PASSWORD_UPDATE: '修改本人密码',
    USER_UPDATE: '更新用户资料',
    USER_STATUS_UPDATE: '更新用户状态',
    USER_ROLE_UPDATE: '更新用户角色',
    USER_ROLE_ASSIGN: '分配用户角色',
    USER_EXPORT: '导出用户',
    USER_DELETE: '删除用户',
    ADMIN_ROLE_SAVE: '保存管理员角色',
    PAYMENT_CREATE: '创建支付',
    PAYMENT_CALLBACK: '支付回调',
    PAYMENT_SYNC: '同步支付',
    PAYMENT_SIMULATE_PAID: '模拟已支付',
    PAYMENT_SIMULATE_CALLBACK: '模拟支付回调',
    STRIPE_WEBHOOK: 'Stripe 回调',
    ORDER_CANCEL: '取消订单',
    RETURN_REQUEST: '申请退货',
    RETURN_APPROVE: '同意退货',
    RETURN_REJECT: '拒绝退货',
    RETURN_SHIPMENT_SUBMIT: '提交退货物流',
    REFUND_COMPLETE: '完成退款',
    ORDER_STATUS_UPDATE: '更新订单状态',
    ORDER_BATCH_SHIP: '批量发货',
    ORDER_EXPORT: '导出订单',
    CONFIG_PUBLISH: '发布配置',
    CONFIG_APPLY_RUNTIME: '应用运行时配置',
    LOG_DEBUG_TOGGLE: '切换 Debug 日志',
    LOG_PREVIEW: '预览日志',
    LOG_DOWNLOAD: '下载运行日志',
    AUDIT_LOG_PURGE: '清理审计日志',
    AUDIT_LOG_EXPORT: '导出审计日志',
    ALERT_SELF_CHECK: '执行告警自检',
    ALERT_ACKNOWLEDGE: '确认告警',
    ALERT_RESOLVE: '解决告警',
    ALERT_BATCH_ACKNOWLEDGE: '批量确认告警',
    ALERT_BATCH_RESOLVE: '批量解决告警',
    ALERT_PURGE_RESOLVED: '清理已解决告警',
    IP_BLACKLIST_BLOCK: '拉黑 IP',
    IP_BLACKLIST_RELEASE: '解除 IP 黑名单',
    IP_BLACKLIST_BATCH_RELEASE: '批量解除 IP 黑名单',
    TRAFFIC_RATE_LIMIT_CLEAR: '清空限流计数',
    TRAFFIC_CIRCUIT_RESET: '重置熔断器',
    PRODUCT_CREATE: '创建商品',
    PRODUCT_UPDATE: '更新商品',
    PRODUCT_DELETE: '删除商品',
    PRODUCT_STATUS_UPDATE: '更新商品状态',
    PRODUCT_BATCH_STATUS_UPDATE: '批量更新商品状态',
    BRAND_CREATE: '创建品牌',
    BRAND_UPDATE: '更新品牌',
    BRAND_DELETE: '删除品牌',
    CATEGORY_CREATE: '创建分类',
    CATEGORY_UPDATE: '更新分类',
    CATEGORY_DELETE: '删除分类',
    LOGISTICS_CARRIER_CREATE: '创建快递公司',
    LOGISTICS_CARRIER_UPDATE: '更新快递公司',
    LOGISTICS_CARRIER_DELETE: '删除快递公司',
    PRODUCT_QUESTION_ANSWER: '回复商品问答',
    REVIEW_REPLY: '回复评价',
    REVIEW_STATUS_UPDATE: '更新评价状态',
    REVIEW_DELETE: '删除评价',
    SUPPORT_MESSAGE_SEND: '发送客服消息',
    SUPPORT_SESSION_CLOSE: '关闭客服会话',
    SUPPORT_SESSION_ASSIGN: '分配客服会话',
    SUPPORT_SESSION_REOPEN: '重开客服会话',
    SUPPORT_BIRTHDAY_COUPON_REISSUE: '客服补发生日券',
    NOTIFICATION_BROADCAST: '群发通知',
    ANNOUNCEMENT_CREATE: '创建公告',
    ANNOUNCEMENT_UPDATE: '更新公告',
    ANNOUNCEMENT_DELETE: '删除公告',
    PRODUCT_IMPORT_PREVIEW: '预览商品导入',
    PRODUCT_IMPORT_APPLY: '应用商品导入',
    PRODUCT_URL_IMPORT: '从网址导入商品',
    COUPON_CREATE: '创建优惠券',
    COUPON_UPDATE: '更新优惠券',
    COUPON_DELETE: '删除优惠券',
    COUPON_GRANT: '发放优惠券',
    PET_BIRTHDAY_COUPON_RUN: '执行宠物生日券',
    PET_BIRTHDAY_COUPON_CONFIG_UPDATE: '更新生日券配置',
    PET_BIRTHDAY_COUPON_REISSUE: '补发生日券',
    PET_GALLERY_PHOTO_DELETE: '删除宠物图库照片',
  },
};

export const resourceTypeLabels: Record<string, Record<string, string>> = {
  en: {
    USER: 'User',
    ADMIN_ROLE: 'Admin role',
    ORDER: 'Order',
    PAYMENT: 'Payment',
    PRODUCT: 'Product',
    BRAND: 'Brand',
    CATEGORY: 'Category',
    LOGISTICS_CARRIER: 'Logistics carrier',
    PRODUCT_QUESTION: 'Product question',
    REVIEW: 'Review',
    SUPPORT_SESSION: 'Support session',
    NOTIFICATION: 'Notification',
    SITE_ANNOUNCEMENT: 'Site announcement',
    SECURITY_AUDIT_LOG: 'Security audit log',
    CONFIG_CENTER: 'Config center',
    LOGGING: 'Logging',
    SYSTEM_ALERT: 'System alert',
    IP_BLACKLIST: 'IP blacklist',
    TRAFFIC_CONTROL: 'Traffic control',
    PRODUCT_IMPORT: 'Product import',
    COUPON: 'Coupon',
    COUPON_CONFIG: 'Coupon config',
    PET_GALLERY: 'Pet gallery',
  },
  es: {
    USER: 'Usuario',
    ADMIN_ROLE: 'Rol admin',
    ORDER: 'Pedido',
    PAYMENT: 'Pago',
    PRODUCT: 'Producto',
    BRAND: 'Marca',
    CATEGORY: 'Categoría',
    LOGISTICS_CARRIER: 'Paquetería',
    PRODUCT_QUESTION: 'Pregunta de producto',
    REVIEW: 'Reseña',
    SUPPORT_SESSION: 'Conversación de soporte',
    NOTIFICATION: 'Notificación',
    SITE_ANNOUNCEMENT: 'Anuncio del sitio',
    SECURITY_AUDIT_LOG: 'Log de seguridad',
    CONFIG_CENTER: 'Centro de configuración',
    LOGGING: 'Logs',
    SYSTEM_ALERT: 'Alerta del sistema',
    IP_BLACKLIST: 'Lista negra IP',
    TRAFFIC_CONTROL: 'Control de tráfico',
    PRODUCT_IMPORT: 'Importación de producto',
    COUPON: 'Cupón',
    COUPON_CONFIG: 'Config cupón',
    PET_GALLERY: 'Galería de mascotas',
  },
  zh: {
    USER: '用户',
    ADMIN_ROLE: '管理员角色',
    ORDER: '订单',
    PAYMENT: '支付',
    PRODUCT: '商品',
    BRAND: '品牌',
    CATEGORY: '分类',
    LOGISTICS_CARRIER: '快递公司',
    PRODUCT_QUESTION: '商品问答',
    REVIEW: '评价',
    SUPPORT_SESSION: '客服会话',
    NOTIFICATION: '通知',
    SITE_ANNOUNCEMENT: '站点公告',
    SECURITY_AUDIT_LOG: '安全审计日志',
    CONFIG_CENTER: '配置中心',
    LOGGING: '日志',
    SYSTEM_ALERT: '系统告警',
    IP_BLACKLIST: 'IP 黑名单',
    TRAFFIC_CONTROL: '流量控制',
    PRODUCT_IMPORT: '商品导入',
    COUPON: '优惠券',
    COUPON_CONFIG: '优惠券配置',
    PET_GALLERY: '宠物图库',
  },
};

export const auditMessageLabels: Record<string, Record<string, string>> = {
  en: {
    'User logout': 'User logout',
    'User profile updated': 'User profile updated',
    'Profile email verification code sent': 'Profile email verification code sent',
    'Profile email already verified': 'Profile email already verified',
    'User password updated': 'User password updated',
    'User status updated': 'User status updated',
    'User role updated': 'User role updated',
    'User role assigned': 'User role assigned',
    'Users exported': 'Users exported',
    'User deleted': 'User deleted',
    'Admin role saved': 'Admin role saved',
    'Payment created': 'Payment created',
    'Payment simulated as paid': 'Payment simulated as paid',
    'Payment callback simulated': 'Payment callback simulated',
    'Payment callback accepted': 'Payment callback accepted',
    'Payment synced': 'Payment synced',
    'Stripe webhook accepted': 'Stripe webhook accepted',
    'Order cancelled': 'Order cancelled',
    'Return requested': 'Return requested',
    'Return shipment submitted': 'Return shipment submitted',
    'Order status updated': 'Order status updated',
    'Order refunded': 'Order refunded',
    'Batch ship completed': 'Batch shipment completed',
    'Orders exported': 'Orders exported',
    'Security audit logs exported': 'Security audit logs exported',
    'Config center published': 'Config center published',
    'Runtime config applied': 'Runtime config applied',
    'Debug logging updated': 'Debug logging updated',
    'Logs downloaded': 'Logs downloaded',
    'Alert self-check completed': 'Alert self-check completed',
    'Alert acknowledged': 'Alert acknowledged',
    'Alert resolved': 'Alert resolved',
    'Batch acknowledge completed': 'Batch acknowledge completed',
    'Batch resolve completed': 'Batch resolve completed',
    'Resolved alerts purged': 'Resolved alerts purged',
    'IP manually blocked': 'IP manually blocked',
    'IP blacklist entry released': 'IP blacklist entry released',
    'IP blacklist batch release completed': 'IP blacklist batch release completed',
    'Rate limit counters cleared': 'Rate limit counters cleared',
    'Circuit breaker reset': 'Circuit breaker reset',
    'Product created': 'Product created',
    'Product updated': 'Product updated',
    'Product deleted': 'Product deleted',
    'Product status updated': 'Product status updated',
    'Product batch status updated': 'Product batch status updated',
    'Brand created': 'Brand created',
    'Brand updated': 'Brand updated',
    'Brand deleted': 'Brand deleted',
    'Category created': 'Category created',
    'Category updated': 'Category updated',
    'Category deleted': 'Category deleted',
    'Logistics carrier created': 'Logistics carrier created',
    'Logistics carrier updated': 'Logistics carrier updated',
    'Logistics carrier deleted': 'Logistics carrier deleted',
    'Product question answered': 'Product question answered',
    'Review replied': 'Review replied',
    'Review status updated': 'Review status updated',
    'Review deleted': 'Review deleted',
    'Support message sent': 'Support message sent',
    'Support session closed': 'Support session closed',
    'Support session assigned': 'Support session assigned',
    'Support session reopened': 'Support session reopened',
    'Support birthday coupon reissued': 'Support birthday coupon reissued',
    'Notification broadcast sent': 'Notification broadcast sent',
    'Announcement created': 'Announcement created',
    'Announcement updated': 'Announcement updated',
    'Announcement deleted': 'Announcement deleted',
    'Product import preview completed': 'Product import preview completed',
    'Product import applied': 'Product import applied',
    'Product URL import preview generated': 'Product URL import preview generated',
    'Coupon created': 'Coupon created',
    'Coupon updated': 'Coupon updated',
    'Coupon deleted': 'Coupon deleted',
    'Coupon granted': 'Coupon granted',
    'Pet birthday coupons issued': 'Pet birthday coupons issued',
    'Pet birthday coupon config updated': 'Pet birthday coupon config updated',
    'Pet gallery photo deleted': 'Pet gallery photo deleted',
  },
  es: {
    'User logout': 'Cierre de sesión',
    'User profile updated': 'Perfil de usuario actualizado',
    'Profile email verification code sent': 'Código de verificación enviado',
    'Profile email already verified': 'Email de perfil ya verificado',
    'User password updated': 'Contraseña actualizada',
    'User status updated': 'Estado de usuario actualizado',
    'User role updated': 'Rol de usuario actualizado',
    'User role assigned': 'Rol de usuario asignado',
    'Users exported': 'Usuarios exportados',
    'User deleted': 'Usuario eliminado',
    'Admin role saved': 'Rol admin guardado',
    'Payment created': 'Pago creado',
    'Payment simulated as paid': 'Pago simulado como pagado',
    'Payment callback simulated': 'Callback de pago simulado',
    'Payment callback accepted': 'Callback de pago aceptado',
    'Payment synced': 'Pago sincronizado',
    'Stripe webhook accepted': 'Webhook de Stripe aceptado',
    'Order cancelled': 'Pedido cancelado',
    'Return requested': 'Devolución solicitada',
    'Return shipment submitted': 'Envío de devolución enviado',
    'Order status updated': 'Estado del pedido actualizado',
    'Order refunded': 'Pedido reembolsado',
    'Batch ship completed': 'Envío por lote completado',
    'Orders exported': 'Pedidos exportados',
    'Security audit logs exported': 'Logs de seguridad exportados',
    'Config center published': 'Centro de configuración publicado',
    'Runtime config applied': 'Configuración runtime aplicada',
    'Debug logging updated': 'Logs debug actualizados',
    'Logs downloaded': 'Logs descargados',
    'Alert self-check completed': 'Revisión de alertas completada',
    'Alert acknowledged': 'Alerta confirmada',
    'Alert resolved': 'Alerta resuelta',
    'Batch acknowledge completed': 'Confirmación por lote completada',
    'Batch resolve completed': 'Resolución por lote completada',
    'Resolved alerts purged': 'Alertas resueltas limpiadas',
    'IP manually blocked': 'IP bloqueada manualmente',
    'IP blacklist entry released': 'Registro IP liberado',
    'IP blacklist batch release completed': 'Liberación IP por lote completada',
    'Rate limit counters cleared': 'Contadores de límite limpiados',
    'Circuit breaker reset': 'Circuit breaker reiniciado',
    'Product created': 'Producto creado',
    'Product updated': 'Producto actualizado',
    'Product deleted': 'Producto eliminado',
    'Product status updated': 'Estado de producto actualizado',
    'Product batch status updated': 'Estado de productos actualizado por lote',
    'Brand created': 'Marca creada',
    'Brand updated': 'Marca actualizada',
    'Brand deleted': 'Marca eliminada',
    'Category created': 'Categoría creada',
    'Category updated': 'Categoría actualizada',
    'Category deleted': 'Categoría eliminada',
    'Logistics carrier created': 'Paquetería creada',
    'Logistics carrier updated': 'Paquetería actualizada',
    'Logistics carrier deleted': 'Paquetería eliminada',
    'Product question answered': 'Pregunta de producto respondida',
    'Review replied': 'Reseña respondida',
    'Review status updated': 'Estado de reseña actualizado',
    'Review deleted': 'Reseña eliminada',
    'Support message sent': 'Mensaje de soporte enviado',
    'Support session closed': 'Conversación de soporte cerrada',
    'Support session assigned': 'Conversación de soporte asignada',
    'Support session reopened': 'Conversación de soporte reabierta',
    'Support birthday coupon reissued': 'Cupón de cumpleaños reemitido desde soporte',
    'Notification broadcast sent': 'Notificación masiva enviada',
    'Announcement created': 'Anuncio creado',
    'Announcement updated': 'Anuncio actualizado',
    'Announcement deleted': 'Anuncio eliminado',
    'Product import preview completed': 'Vista previa de importación completada',
    'Product import applied': 'Importación aplicada',
    'Product URL import preview generated': 'Vista previa desde URL generada',
    'Coupon created': 'Cupón creado',
    'Coupon updated': 'Cupón actualizado',
    'Coupon deleted': 'Cupón eliminado',
    'Coupon granted': 'Cupón otorgado',
    'Pet birthday coupons issued': 'Cupones de cumpleaños emitidos',
    'Pet birthday coupon config updated': 'Config de cumpleaños actualizada',
    'Pet gallery photo deleted': 'Foto de galería eliminada',
  },
  zh: {
    'User logout': '用户退出登录',
    'User profile updated': '用户资料已更新',
    'Profile email verification code sent': '资料邮箱验证码已发送',
    'Profile email already verified': '资料邮箱已验证',
    'User password updated': '用户密码已更新',
    'User status updated': '用户状态已更新',
    'User role updated': '用户角色已更新',
    'User role assigned': '用户角色已分配',
    'User deleted': '用户已删除',
    'Users exported': '用户已导出',
    'Admin role saved': '管理员角色已保存',
    'Payment created': '支付单已创建',
    'Payment simulated as paid': '支付已模拟为成功',
    'Payment callback simulated': '支付回调已模拟',
    'Payment callback accepted': '支付回调已接收',
    'Payment synced': '支付已同步',
    'Stripe webhook accepted': 'Stripe 回调已接收',
    'Order cancelled': '订单已取消',
    'Return requested': '用户已申请退货',
    'Return shipment submitted': '用户已提交退货物流',
    'Order status updated': '订单状态已更新',
    'Order refunded': '订单已退款',
    'Batch ship completed': '批量发货已完成',
    'Orders exported': '订单已导出',
    'Security audit logs exported': '安全审计日志已导出',
    'Config center published': '配置中心已发布',
    'Runtime config applied': '运行时配置已应用',
    'Debug logging updated': 'Debug 日志已更新',
    'Logs downloaded': '日志已下载',
    'Alert self-check completed': '告警自检已完成',
    'Alert acknowledged': '告警已确认',
    'Alert resolved': '告警已解决',
    'Batch acknowledge completed': '批量确认已完成',
    'Batch resolve completed': '批量解决已完成',
    'Resolved alerts purged': '已解决告警已清理',
    'IP manually blocked': 'IP 已手动拉黑',
    'IP blacklist entry released': 'IP 黑名单已解除',
    'IP blacklist batch release completed': 'IP 黑名单批量解除完成',
    'Rate limit counters cleared': '限流计数已清空',
    'Circuit breaker reset': '熔断器已重置',
    'Product created': '商品已创建',
    'Product updated': '商品已更新',
    'Product deleted': '商品已删除',
    'Product status updated': '商品状态已更新',
    'Product batch status updated': '商品状态已批量更新',
    'Brand created': '品牌已创建',
    'Brand updated': '品牌已更新',
    'Brand deleted': '品牌已删除',
    'Category created': '分类已创建',
    'Category updated': '分类已更新',
    'Category deleted': '分类已删除',
    'Logistics carrier created': '快递公司已创建',
    'Logistics carrier updated': '快递公司已更新',
    'Logistics carrier deleted': '快递公司已删除',
    'Product question answered': '商品问答已回复',
    'Review replied': '评价已回复',
    'Review status updated': '评价状态已更新',
    'Review deleted': '评价已删除',
    'Support message sent': '客服消息已发送',
    'Support session closed': '客服会话已关闭',
    'Support session assigned': '客服会话已分配',
    'Support session reopened': '客服会话已重开',
    'Support birthday coupon reissued': '客服生日券已补发',
    'Notification broadcast sent': '通知已群发',
    'Announcement created': '公告已创建',
    'Announcement updated': '公告已更新',
    'Announcement deleted': '公告已删除',
    'Product import preview completed': '商品导入预览已完成',
    'Product import applied': '商品导入已应用',
    'Product URL import preview generated': '网址导入预览已生成',
    'Coupon created': '优惠券已创建',
    'Coupon updated': '优惠券已更新',
    'Coupon deleted': '优惠券已删除',
    'Coupon granted': '优惠券已发放',
    'Pet birthday coupons issued': '宠物生日券已发放',
    'Pet birthday coupon config updated': '生日券配置已更新',
    'Pet gallery photo deleted': '宠物图库照片已删除',
  },
};

export const auditOpsCopy: Record<string, {
  title: string;
  subtitle: string;
  paymentFailures: string;
  refundEvents: string;
  callbackEvents: string;
  highRiskEvents: string;
  accountFailures: string;
  passwordChanges: string;
  emailCodeEvents: string;
  accountEvents: string;
  showPaymentFailures: string;
  showRefunds: string;
  showCallbacks: string;
  showAccountFailures: string;
  showPasswordChanges: string;
  showEmailCodes: string;
  showAccountEvents: string;
  clear: string;
  guideTitle: string;
  guideText: string;
  accountGuideTitle: string;
  accountGuideText: string;
}> = {
  en: {
    title: 'Payment and refund queue',
    subtitle: 'Review payment failures, callbacks, and refund events in one operations view.',
    paymentFailures: 'Payment failures',
    refundEvents: 'Refund events',
    callbackEvents: 'Callback events',
    highRiskEvents: 'Sensitive actions',
    accountFailures: 'Account failures',
    passwordChanges: 'Password changes',
    emailCodeEvents: 'Email code events',
    accountEvents: 'Account events',
    showPaymentFailures: 'Show failures',
    showRefunds: 'Show refunds',
    showCallbacks: 'Show callbacks',
    showAccountFailures: 'Show account failures',
    showPasswordChanges: 'Show password changes',
    showEmailCodes: 'Show email codes',
    showAccountEvents: 'Show account events',
    clear: 'Clear filters',
    guideTitle: 'Review order',
    guideText: 'Start with failed payments, then callbacks and refunds, then return to the related order.',
    accountGuideTitle: 'Account review',
    accountGuideText: 'Check failed logins, password changes, and profile email-code requests together.',
  },
  es: {
    title: 'Cola de pagos y reembolsos',
    subtitle: 'Agrupa fallos de pago, callbacks y reembolsos para revisar pasarelas y acciones manuales.',
    paymentFailures: 'Fallos de pago',
    refundEvents: 'Reembolsos',
    callbackEvents: 'Callbacks',
    highRiskEvents: 'Acciones sensibles',
    accountFailures: 'Fallos de cuenta',
    passwordChanges: 'Cambios de clave',
    emailCodeEvents: 'Códigos de email',
    accountEvents: 'Eventos de cuenta',
    showPaymentFailures: 'Ver fallos',
    showRefunds: 'Ver reembolsos',
    showCallbacks: 'Ver callbacks',
    showAccountFailures: 'Ver fallos de cuenta',
    showPasswordChanges: 'Ver cambios de clave',
    showEmailCodes: 'Ver códigos',
    showAccountEvents: 'Ver cuentas',
    clear: 'Limpiar filtros',
    guideTitle: 'Orden de revisión',
    guideText: 'Primero pagos fallidos, luego callbacks y reembolsos, y después vuelve al pedido relacionado.',
    accountGuideTitle: 'Revisión de cuenta',
    accountGuideText: 'Revisa inicios fallidos, cambios de clave y códigos de email del perfil juntos.',
  },
  zh: {
    title: '支付与退款异常队列',
    subtitle: '把支付失败、网关回调和退款动作集中到同一个运营视角，方便排查支付网关和人工操作问题。',
    paymentFailures: '支付失败',
    refundEvents: '退款动作',
    callbackEvents: '回调记录',
    highRiskEvents: '敏感动作',
    accountFailures: '账号失败',
    passwordChanges: '密码修改',
    emailCodeEvents: '邮箱验证码',
    accountEvents: '账号事件',
    showPaymentFailures: '查看支付失败',
    showRefunds: '查看退款动作',
    showCallbacks: '查看支付回调',
    showAccountFailures: '查看账号失败',
    showPasswordChanges: '查看密码修改',
    showEmailCodes: '查看邮箱验证码',
    showAccountEvents: '查看账号事件',
    clear: '重置筛选',
    guideTitle: '排查顺序',
    guideText: '先看失败支付，再核对回调与退款动作，最后按订单号回到后台订单处理。',
    accountGuideTitle: '账号排查',
    accountGuideText: '把登录失败、密码修改、资料邮箱验证码放在一起看，方便发现异常账号行为。',
  },
};

export const auditAdminCopy: Record<string, {
  summaryTitle: string;
  total: string;
  success: string;
  failure: string;
  range: string;
  topActions: string;
  topActors: string;
  topIps: string;
  retentionTitle: string;
  retentionHint: string;
  days: string;
  purge: string;
  purgeConfirm: string;
  purgeSuccess: string;
  purgeFailed: string;
}> = {
  en: {
    summaryTitle: 'Server audit summary',
    total: 'Total events',
    success: 'Success',
    failure: 'Failures',
    range: 'Range',
    topActions: 'Top actions',
    topActors: 'Top actors',
    topIps: 'Top IPs',
    retentionTitle: 'Audit retention',
    retentionHint: 'Remove audit rows older than the selected retention window.',
    days: 'days',
    purge: 'Purge old logs',
    purgeConfirm: 'Purge audit logs outside the retention window?',
    purgeSuccess: 'Purged {count} audit logs',
    purgeFailed: 'Failed to purge audit logs',
  },
  es: {
    summaryTitle: 'Resumen de auditoria',
    total: 'Eventos',
    success: 'Exitos',
    failure: 'Fallos',
    range: 'Rango',
    topActions: 'Acciones',
    topActors: 'Operadores',
    topIps: 'IPs',
    retentionTitle: 'Retencion',
    retentionHint: 'Elimina registros fuera de la ventana seleccionada.',
    days: 'dias',
    purge: 'Limpiar logs',
    purgeConfirm: 'Eliminar logs fuera de la ventana de retencion?',
    purgeSuccess: 'Eliminados {count} logs',
    purgeFailed: 'No se pudieron limpiar los logs',
  },
  zh: {
    summaryTitle: '服务端审计概览',
    total: '事件总数',
    success: '成功',
    failure: '失败',
    range: '时间窗',
    topActions: '高频动作',
    topActors: '高频操作者',
    topIps: '高频 IP',
    retentionTitle: '审计保留',
    retentionHint: '清理超过保留窗口的旧审计记录。',
    days: '天',
    purge: '清理旧日志',
    purgeConfirm: '确认清理保留窗口之外的审计日志？',
    purgeSuccess: '已清理 {count} 条审计日志',
    purgeFailed: '清理审计日志失败',
  },
};

export const localizedMapValue = (map: Record<string, Record<string, string>>, language: string, value?: string) => {
  if (!value) return '-';
  return map[language]?.[value] || map.en[value] || value;
};

const SecurityAuditLogManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [summary, setSummary] = useState<SecurityAuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [action, setAction] = useState<string | undefined>(searchParams.get('action') || undefined);
  const [result, setResult] = useState<string | undefined>(searchParams.get('result') || undefined);
  const [resourceType, setResourceType] = useState<string | undefined>(searchParams.get('resourceType') || undefined);
  const [actorUsername, setActorUsername] = useState('');
  const [range, setRange] = useState<any>(null);
  const [retentionDays, setRetentionDays] = useState(180);
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const canExportAuditLogs = hasAdminPermission(adminPermissions, currentRole, AUDIT_LOGS_EXPORT_PERMISSION);
  const canPurgeAuditLogs = hasAdminPermission(adminPermissions, currentRole, AUDIT_LOGS_PURGE_PERMISSION);

  const localizedOpsCopy = auditOpsCopy[language] || auditOpsCopy.en;
  const localizedAdminCopy = auditAdminCopy[language] || auditAdminCopy.en;
  const actionLabel = useCallback((value?: string) => localizedMapValue(auditActionLabels, language, value), [language]);
  const resourceLabel = useCallback((value?: string) => localizedMapValue(resourceTypeLabels, language, value), [language]);
  const messageLabel = useCallback((value?: string) => localizedMapValue(auditMessageLabels, language, value), [language]);

  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { limit: 300 };
    if (action) params.action = action;
    if (result) params.result = result;
    if (resourceType) params.resourceType = resourceType;
    if (actorUsername.trim()) params.actorUsername = actorUsername.trim();
    if (range?.[0]) params.startAt = range[0].format('YYYY-MM-DDTHH:mm:ss');
    if (range?.[1]) params.endAt = range[1].format('YYYY-MM-DDTHH:mm:ss');
    return params;
  }, [action, actorUsername, range, resourceType, result]);

  const auditInsights = useMemo(() => {
    const total = logs.length;
    const failures = logs.filter((log) => log.result === 'FAILURE').length;
    const failureRate = total ? Math.round((failures / total) * 100) : 0;
    const sensitiveActions = logs.filter((log) => highRiskActions.has(log.action)).length;
    const exports = logs.filter((log) => log.action.includes('EXPORT')).length;
    const paymentFailures = logs.filter((log) => (
      log.result === 'FAILURE' && (log.action.startsWith('PAYMENT') || log.action.includes('STRIPE'))
    )).length;
    const refundEvents = logs.filter((log) => log.action === 'REFUND_COMPLETE').length;
    const callbackEvents = logs.filter((log) => log.action === 'PAYMENT_CALLBACK' || log.action === 'STRIPE_WEBHOOK').length;
    const paymentOpsEvents = logs.filter((log) => paymentOpsActions.has(log.action)).length;
    const accountFailures = logs.filter((log) => log.result === 'FAILURE' && accountSecurityActions.has(log.action)).length;
    const passwordChanges = logs.filter((log) => log.action === 'USER_PASSWORD_UPDATE').length;
    const emailCodeEvents = logs.filter((log) => log.action === 'USER_PROFILE_EMAIL_CODE').length;
    const accountSecurityEvents = logs.filter((log) => accountSecurityActions.has(log.action)).length;

    const failedActorCounts = logs.reduce<Record<string, number>>((acc, log) => {
      if (log.result !== 'FAILURE') return acc;
      const key = log.actorUsername || log.ipAddress || (log.actorUserId ? String(log.actorUserId) : '');
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const repeatedFailures = Object.values(failedActorCounts).filter((count) => count >= 3).length;
    const healthScore = Math.max(0, 100 - failureRate - repeatedFailures * 12 - paymentFailures * 8 - Math.max(0, exports - 2) * 5);

    return {
      total,
      failures,
      failureRate,
      sensitiveActions,
      exports,
      paymentFailures,
      refundEvents,
      callbackEvents,
      paymentOpsEvents,
      accountFailures,
      passwordChanges,
      emailCodeEvents,
      accountSecurityEvents,
      repeatedFailures,
      healthScore,
    };
  }, [logs]);
  const summaryTotal = summary?.totalCount ?? auditInsights.total;
  const summarySuccess = summary?.successCount ?? Math.max(0, auditInsights.total - auditInsights.failures);
  const summaryFailures = summary?.failureCount ?? auditInsights.failures;
  const summaryFailureRate = summaryTotal ? Math.round((summaryFailures / summaryTotal) * 100) : auditInsights.failureRate;
  const summaryRangeHours = summary ? Math.max(1, Math.round((new Date(summary.endAt).getTime() - new Date(summary.startAt).getTime()) / 3600000)) : 0;

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'payment-failures') {
      setAction(undefined);
      setResult('FAILURE');
      setResourceType('PAYMENT');
      return;
    }
    if (view === 'refunds') {
      setAction('REFUND_COMPLETE');
      setResult(undefined);
      setResourceType(undefined);
      return;
    }
    if (view === 'callbacks') {
      setAction('PAYMENT_CALLBACK');
      setResult(undefined);
      setResourceType('PAYMENT');
      return;
    }
    if (view === 'payment-ops') {
      setAction(undefined);
      setResult(undefined);
      setResourceType(undefined);
      return;
    }
    if (view === 'account-failures') {
      setAction(undefined);
      setResult('FAILURE');
      setResourceType('USER');
      return;
    }
    if (view === 'password-changes') {
      setAction('USER_PASSWORD_UPDATE');
      setResult(undefined);
      setResourceType('USER');
      return;
    }
    if (view === 'email-codes') {
      setAction('USER_PROFILE_EMAIL_CODE');
      setResult(undefined);
      setResourceType('USER');
      return;
    }
    if (view === 'account-security') {
      setAction(undefined);
      setResult(undefined);
      setResourceType('USER');
      return;
    }
    setAction(searchParams.get('action') || undefined);
    setResult(searchParams.get('result') || undefined);
    setResourceType(searchParams.get('resourceType') || undefined);
  }, [searchParams]);

  const updateAuditFilters = useCallback((next: { action?: string; result?: string; resourceType?: string; view?: string }) => {
    const params = new URLSearchParams();
    if (next.view) params.set('view', next.view);
    if (next.action) params.set('action', next.action);
    if (next.result) params.set('result', next.result);
    if (next.resourceType) params.set('resourceType', next.resourceType);
    setSearchParams(params, { replace: true });
    setAction(next.action);
    setResult(next.result);
    setResourceType(next.resourceType);
  }, [setSearchParams]);

  const applyPaymentFailureFilter = () => {
    updateAuditFilters({ result: 'FAILURE', resourceType: 'PAYMENT', view: 'payment-failures' });
  };

  const applyRefundFilter = () => {
    updateAuditFilters({ action: 'REFUND_COMPLETE', view: 'refunds' });
  };

  const applyCallbackFilter = () => {
    updateAuditFilters({ action: 'PAYMENT_CALLBACK', resourceType: 'PAYMENT', view: 'callbacks' });
  };

  const applyPaymentOpsFilter = () => {
    updateAuditFilters({ view: 'payment-ops' });
  };

  const applyAccountFailureFilter = () => {
    updateAuditFilters({ result: 'FAILURE', resourceType: 'USER', view: 'account-failures' });
  };

  const applyPasswordChangeFilter = () => {
    updateAuditFilters({ action: 'USER_PASSWORD_UPDATE', resourceType: 'USER', view: 'password-changes' });
  };

  const applyEmailCodeFilter = () => {
    updateAuditFilters({ action: 'USER_PROFILE_EMAIL_CODE', resourceType: 'USER', view: 'email-codes' });
  };

  const applyAccountSecurityFilter = () => {
    updateAuditFilters({ resourceType: 'USER', view: 'account-security' });
  };

  const clearOpsFilters = () => {
    updateAuditFilters({});
    setActorUsername('');
    setRange(null);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [logResponse, summaryResponse] = await Promise.all([
        adminApi.getAuditLogs(queryParams),
        adminApi.getAuditLogSummary({ ...queryParams, topLimit: 6 }),
      ]);
      setLogs(logResponse.data || []);
      setSummary(summaryResponse.data || null);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.auditLogs.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, queryParams, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchLogs();
    }, 180);
    return () => window.clearTimeout(handle);
  }, [fetchLogs]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((res) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
        setAdminPermissions(res.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const exportLogs = async () => {
    if (!canExportAuditLogs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setExporting(true);
    try {
      const res = await adminApi.exportAuditLogs(queryParams);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'security-audit-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
      if (String(res.headers?.['x-export-truncated']) === 'true') {
        message.warning(t('pages.auditLogs.exportTruncated', {
          returned: res.headers?.['x-export-returned'] || '',
          total: res.headers?.['x-export-total'] || '',
        }));
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.auditLogs.exportFailed'), language));
    } finally {
      setExporting(false);
    }
  };

  const purgeOldLogs = async () => {
    if (!canPurgeAuditLogs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setPurging(true);
    try {
      const response = await adminApi.purgeAuditLogs(retentionDays);
      message.success(localizedAdminCopy.purgeSuccess.replace('{count}', String(response.data.deletedCount || 0)));
      await fetchLogs();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, localizedAdminCopy.purgeFailed, language));
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="audit-log-page">
      <Title level={4}>{t('pages.auditLogs.title')}</Title>
      <section className="audit-log-page__insights" aria-label={t('pages.auditLogs.insightTitle')}>
        <div className="audit-log-page__insightCopy">
          <Text className="audit-log-page__eyebrow">{t('pages.auditLogs.insightEyebrow')}</Text>
          <Title level={5}>{t('pages.auditLogs.insightTitle')}</Title>
          <Text type="secondary">{t('pages.auditLogs.insightSubtitle')}</Text>
          <Text type="secondary" className="audit-log-page__insightMeta">
            {t('pages.auditLogs.insightMeta', { total: summaryTotal, sensitive: auditInsights.sensitiveActions })}
          </Text>
        </div>
        <div className="audit-log-page__score">
          <Progress
            type="circle"
            percent={auditInsights.healthScore}
            width={92}
            strokeColor={auditInsights.healthScore >= 80 ? '#2f855a' : auditInsights.healthScore >= 60 ? '#d97706' : '#dc2626'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.auditLogs.securityScore')}</Text>
        </div>
        <div className="audit-log-page__signalGrid">
          <div className={`audit-log-page__signal ${summaryFailureRate > 12 ? 'is-risk' : 'is-ok'}`}>
            <AlertOutlined />
            <strong>{summaryFailureRate}%</strong>
            <span>{t('pages.auditLogs.failureRate')}</span>
          </div>
          <div className={`audit-log-page__signal ${auditInsights.repeatedFailures > 0 ? 'is-risk' : 'is-ok'}`}>
            <SafetyCertificateOutlined />
            <strong>{auditInsights.repeatedFailures}</strong>
            <span>{t('pages.auditLogs.repeatFailures')}</span>
          </div>
          <div className={`audit-log-page__signal ${auditInsights.paymentFailures > 0 ? 'is-risk' : 'is-ok'}`}>
            <AlertOutlined />
            <strong>{auditInsights.paymentFailures}</strong>
            <span>{t('pages.auditLogs.paymentFailures')}</span>
          </div>
          <div className={`audit-log-page__signal ${auditInsights.exports > 2 ? 'is-risk' : 'is-ok'}`}>
            <DownloadOutlined />
            <strong>{auditInsights.exports}</strong>
            <span>{t('pages.auditLogs.exportEvents')}</span>
          </div>
        </div>
      </section>
      <section className="audit-log-page__summaryPanel" aria-label={localizedAdminCopy.summaryTitle}>
        <div className="audit-log-page__summaryCards">
          <div>
            <span>{localizedAdminCopy.total}</span>
            <strong>{summaryTotal}</strong>
          </div>
          <div>
            <span>{localizedAdminCopy.success}</span>
            <strong>{summarySuccess}</strong>
          </div>
          <div className={summaryFailures > 0 ? 'is-risk' : ''}>
            <span>{localizedAdminCopy.failure}</span>
            <strong>{summaryFailures}</strong>
          </div>
          <div>
            <span>{localizedAdminCopy.range}</span>
            <strong>{summaryRangeHours ? `${summaryRangeHours}h` : '-'}</strong>
          </div>
        </div>
        <div className="audit-log-page__topGroups">
          {[
            { title: localizedAdminCopy.topActions, rows: summary?.topActions || [], formatter: actionLabel },
            { title: localizedAdminCopy.topActors, rows: summary?.topActors || [] },
            { title: localizedAdminCopy.topIps, rows: summary?.topIpAddresses || [] },
          ].map((group) => (
            <div key={group.title} className="audit-log-page__topGroup">
              <Text strong>{group.title}</Text>
              {(group.rows.length ? group.rows : [{ name: '-', count: 0 }]).slice(0, 4).map((row) => (
                <span key={`${group.title}-${row.name}`}>
                  <em>{group.formatter ? group.formatter(row.name) : row.name}</em>
                  <strong>{row.count}</strong>
                </span>
              ))}
            </div>
          ))}
        </div>
        {canPurgeAuditLogs ? (
          <div className="audit-log-page__retention">
            <div>
              <Text strong>{localizedAdminCopy.retentionTitle}</Text>
              <Text type="secondary">{localizedAdminCopy.retentionHint}</Text>
            </div>
            <Space wrap>
              <InputNumber
                min={7}
                max={3650}
                precision={0}
                value={retentionDays}
                onChange={(value) => setRetentionDays(Number(value || 180))}
                addonAfter={localizedAdminCopy.days}
              />
              <Popconfirm
                title={localizedAdminCopy.purgeConfirm}
                onConfirm={purgeOldLogs}
              >
                <Button danger icon={<DeleteOutlined />} loading={purging}>
                  {localizedAdminCopy.purge}
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ) : null}
      </section>
      <section className="audit-log-page__opsPanel" aria-label={localizedOpsCopy.title}>
        <div className="audit-log-page__opsIntro">
          <Text strong>{localizedOpsCopy.title}</Text>
          <Text type="secondary">{localizedOpsCopy.subtitle}</Text>
        </div>
        <div className="audit-log-page__opsMetrics">
          <button type="button" className={auditInsights.paymentFailures > 0 ? 'is-risk' : ''} onClick={applyPaymentFailureFilter}>
            <AlertOutlined />
            <strong>{auditInsights.paymentFailures}</strong>
            <span>{localizedOpsCopy.paymentFailures}</span>
          </button>
          <button type="button" onClick={applyRefundFilter}>
            <SafetyCertificateOutlined />
            <strong>{auditInsights.refundEvents}</strong>
            <span>{localizedOpsCopy.refundEvents}</span>
          </button>
          <button type="button" onClick={applyCallbackFilter}>
            <SearchOutlined />
            <strong>{auditInsights.callbackEvents}</strong>
            <span>{localizedOpsCopy.callbackEvents}</span>
          </button>
          <button type="button" className={auditInsights.sensitiveActions > 0 ? 'is-watch' : ''} onClick={applyPaymentOpsFilter}>
            <AlertOutlined />
            <strong>{auditInsights.paymentOpsEvents}</strong>
            <span>{localizedOpsCopy.highRiskEvents}</span>
          </button>
        </div>
        <div className="audit-log-page__opsActions">
          <div>
            <Text strong>{localizedOpsCopy.guideTitle}</Text>
            <Text type="secondary">{localizedOpsCopy.guideText}</Text>
          </div>
          <Space wrap>
            <Button size="small" onClick={applyPaymentFailureFilter}>{localizedOpsCopy.showPaymentFailures}</Button>
            <Button size="small" onClick={applyRefundFilter}>{localizedOpsCopy.showRefunds}</Button>
            <Button size="small" onClick={applyCallbackFilter}>{localizedOpsCopy.showCallbacks}</Button>
            <Button size="small" onClick={clearOpsFilters}>{localizedOpsCopy.clear}</Button>
          </Space>
        </div>
      </section>
      <section className="audit-log-page__opsPanel" aria-label={localizedOpsCopy.accountGuideTitle}>
        <div className="audit-log-page__opsIntro">
          <Text strong>{localizedOpsCopy.accountGuideTitle}</Text>
          <Text type="secondary">{localizedOpsCopy.accountGuideText}</Text>
        </div>
        <div className="audit-log-page__opsMetrics">
          <button type="button" className={auditInsights.accountFailures > 0 ? 'is-risk' : ''} onClick={applyAccountFailureFilter}>
            <AlertOutlined />
            <strong>{auditInsights.accountFailures}</strong>
            <span>{localizedOpsCopy.accountFailures}</span>
          </button>
          <button type="button" className={auditInsights.passwordChanges > 0 ? 'is-watch' : ''} onClick={applyPasswordChangeFilter}>
            <KeyOutlined />
            <strong>{auditInsights.passwordChanges}</strong>
            <span>{localizedOpsCopy.passwordChanges}</span>
          </button>
          <button type="button" onClick={applyEmailCodeFilter}>
            <MailOutlined />
            <strong>{auditInsights.emailCodeEvents}</strong>
            <span>{localizedOpsCopy.emailCodeEvents}</span>
          </button>
          <button type="button" onClick={applyAccountSecurityFilter}>
            <UserOutlined />
            <strong>{auditInsights.accountSecurityEvents}</strong>
            <span>{localizedOpsCopy.accountEvents}</span>
          </button>
        </div>
        <div className="audit-log-page__opsActions">
          <div>
            <Text strong>{localizedOpsCopy.accountGuideTitle}</Text>
            <Text type="secondary">{localizedOpsCopy.accountGuideText}</Text>
          </div>
          <Space wrap>
            <Button size="small" onClick={applyAccountFailureFilter}>{localizedOpsCopy.showAccountFailures}</Button>
            <Button size="small" onClick={applyPasswordChangeFilter}>{localizedOpsCopy.showPasswordChanges}</Button>
            <Button size="small" onClick={applyEmailCodeFilter}>{localizedOpsCopy.showEmailCodes}</Button>
            <Button size="small" onClick={applyAccountSecurityFilter}>{localizedOpsCopy.showAccountEvents}</Button>
            <Button size="small" onClick={clearOpsFilters}>{localizedOpsCopy.clear}</Button>
          </Space>
        </div>
      </section>
      <Card className="audit-log-page__toolbar">
        <Space wrap>
          <Select
            allowClear
            value={action}
            onChange={(value) => updateAuditFilters({ action: value, result, resourceType })}
            placeholder={t('pages.auditLogs.action')}
            className="audit-log-page__actionFilter"
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
            options={auditActionOptions.map((value) => ({ value, label: actionLabel(value) }))}
          />
          <Select
            allowClear
            value={result}
            onChange={(value) => updateAuditFilters({ action, result: value, resourceType })}
            placeholder={t('pages.auditLogs.result')}
            className="audit-log-page__resultFilter"
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
            options={[
              { value: 'SUCCESS', label: t('pages.auditLogs.success') },
              { value: 'FAILURE', label: t('pages.auditLogs.failure') },
            ]}
          />
          <Select
            allowClear
            value={resourceType}
            onChange={(value) => updateAuditFilters({ action, result, resourceType: value })}
            placeholder={t('pages.auditLogs.resource')}
            className="audit-log-page__resourceFilter"
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
            options={auditResourceTypeOptions.map((value) => ({ value, label: resourceLabel(value) }))}
          />
          <Input
            allowClear
            value={actorUsername}
            onChange={(event) => setActorUsername(event.target.value)}
            placeholder={t('pages.auditLogs.actor')}
            className="audit-log-page__actorInput"
          />
          <RangePicker showTime value={range} onChange={setRange} popupClassName="shop-mobile-popup-layer" getPopupContainer={() => document.body} />
          <Button icon={<SearchOutlined />} type="primary" onClick={fetchLogs}>
            {t('common.search')}
          </Button>
          {canExportAuditLogs ? (
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportLogs}>
              {t('pages.auditLogs.export')}
            </Button>
          ) : null}
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={logs}
          size="middle"
          scroll={{ x: 1180 }}
          pagination={{ pageSize: 12, showTotal: (total) => t('common.tableTotal', { count: total }) }}
          columns={[
            {
              title: t('common.time'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => value ? new Date(value).toLocaleString(dateLocale) : '-',
            },
            {
              title: t('pages.auditLogs.action'),
              dataIndex: 'action',
              width: 190,
              render: (value: string) => <Tag color={actionColors[value] || 'default'}>{actionLabel(value)}</Tag>,
            },
            {
              title: t('pages.auditLogs.result'),
              dataIndex: 'result',
              width: 100,
              render: (value: string) => (
                <Tag color={value === 'SUCCESS' ? 'green' : 'red'}>
                  {value === 'SUCCESS' ? t('pages.auditLogs.success') : value === 'FAILURE' ? t('pages.auditLogs.failure') : value}
                </Tag>
              ),
            },
            {
              title: t('pages.auditLogs.actor'),
              width: 150,
              render: (_: unknown, log: SecurityAuditLog) => log.actorUsername || log.actorUserId || '-',
            },
            {
              title: t('pages.auditLogs.resource'),
              width: 160,
              render: (_: unknown, log: SecurityAuditLog) => (
                log.resourceType ? `${resourceLabel(log.resourceType)}${log.resourceId ? ` #${log.resourceId}` : ''}` : '-'
              ),
            },
            { title: 'IP', dataIndex: 'ipAddress', width: 130 },
            {
              title: t('pages.auditLogs.message'),
              dataIndex: 'message',
              ellipsis: true,
              render: (value: string, log: SecurityAuditLog) => (
                <Space direction="vertical" size={0}>
                  <span>{messageLabel(value)}</span>
                  {log.metadata ? <Text type="secondary">{log.metadata}</Text> : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default SecurityAuditLogManagement;
