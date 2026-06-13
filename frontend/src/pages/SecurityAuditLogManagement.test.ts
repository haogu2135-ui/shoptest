import fs from 'fs';
import path from 'path';
import { auditActionOptions } from './SecurityAuditLogManagement';

jest.mock('../api', () => ({
  adminApi: {},
}));

const pageSource = fs.readFileSync(path.join(__dirname, 'SecurityAuditLogManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'SecurityAuditLogManagement.css'), 'utf8');
type LocaleNode = string | number | boolean | null | LocaleNode[] | { [key: string]: LocaleNode };
type LocaleObject = { [key: string]: LocaleNode };

const readLocale = (filename: string): LocaleObject => (
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', filename), 'utf8')) as LocaleObject
);

const localeString = (locale: LocaleObject, pathParts: string[]): string => {
  const value = pathParts.reduce<LocaleNode | undefined>((current, part) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return current[part];
  }, locale);
  return typeof value === 'string' ? value : '';
};

const enLocale = readLocale('en.json');
const esLocale = readLocale('es.json');
const zhLocale = readLocale('zh.json');

describe('SecurityAuditLogManagement i18n labels', () => {
  it('centralizes audit labels in locale files while keeping query option values stable', () => {
    expect(auditActionOptions).toContain('PAYMENT_CALLBACK');
    expect(auditActionOptions).toContain('REFUND_COMPLETE');

    expect(localeString(zhLocale, ['pages', 'auditLogs', 'actionLabels', 'PAYMENT_CALLBACK'])).toBe('支付回调');
    expect(localeString(esLocale, ['pages', 'auditLogs', 'actionLabels', 'REFUND_COMPLETE'])).toBe('Reembolso completado');
    expect(localeString(zhLocale, ['pages', 'auditLogs', 'resourceTypeLabels', 'PAYMENT'])).toBe('支付');
    expect(localeString(zhLocale, ['pages', 'auditLogs', 'messageLabels', 'Payment created'])).toBe('支付单已创建');
    expect(localeString(enLocale, ['pages', 'auditLogs', 'ops', 'paymentFailures'])).toBe('Payment failures');
    expect(localeString(enLocale, ['pages', 'auditLogs', 'admin', 'purgeSuccess'])).toBe('Purged {count} audit logs');
  });

  it('uses locale lookup helpers instead of page-local dictionaries', () => {
    expect(pageSource).not.toContain('export const auditActionLabels');
    expect(pageSource).not.toContain('export const resourceTypeLabels');
    expect(pageSource).not.toContain('export const auditMessageLabels');
    expect(pageSource).not.toContain('export const auditOpsCopy');
    expect(pageSource).not.toContain('export const auditAdminCopy');
    expect(pageSource).not.toContain('localizedMapValue');
    expect(pageSource).toContain("auditLocaleValue(t, 'actionLabels', value)");
    expect(pageSource).toContain("auditLocaleValue(t, 'resourceTypeLabels', value)");
    expect(pageSource).toContain("auditLocaleValue(t, 'messageLabels', value)");
    expect(pageSource).toContain('defaultValue: value');
  });

  it('does not contain stale hardcoded audit trace or admin-description text', () => {
    expect(pageSource).not.toContain('Full link trace');
    expect(pageSource).not.toContain('Top 10 slow requests');
    expect(pageSource).not.toContain('完整链路追踪');
    expect(pageSource).not.toContain('前 10 个慢请求');
    expect(pageSource).not.toContain('Description: by Admin');
    expect(pageSource).toContain("const messageLabel = useCallback((value?: string) => auditLocaleValue(t, 'messageLabels', value), [t]);");
    expect(pageSource).toContain('<span>{messageLabel(value)}</span>');
  });
});

describe('SecurityAuditLogManagement mobile filter layout guards', () => {
  it('keeps the mobile filter card out of the sticky admin header stack', () => {
    const f3517Css = cssSource.slice(cssSource.indexOf('/* F3517'));

    expect(pageSource).toContain('className="audit-log-page__toolbar"');
    expect(f3517Css).toMatch(/\.audit-log-page__toolbar\s*\{[\s\S]*?position:\s*static\s*!important;/);
    expect(f3517Css).toMatch(/\.audit-log-page__toolbar\s*\{[\s\S]*?top:\s*auto\s*!important;/);
    expect(f3517Css).toMatch(/\.audit-log-page__toolbar\s*\{[\s\S]*?z-index:\s*auto\s*!important;/);
    expect(f3517Css).not.toMatch(/position:\s*sticky/);
    expect(f3517Css).not.toMatch(/top:\s*(?:58|64)px/);
  });

  it('keeps the audit date range popup in a constrained mobile body layer', () => {
    expect(pageSource).toContain("root: 'shop-mobile-popup-layer audit-log-page__rangePopup'");
    expect(pageSource).toContain('classNames={auditRangePickerClassNames}');
    expect(pageSource).toContain('getPopupContainer={() => document.body}');
    expect(cssSource).toMatch(/body\s+\.audit-log-page__rangePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?z-index:\s*1060\s*!important;/);
    expect(cssSource).toMatch(/body\s+\.audit-log-page__rangePopup\.shop-mobile-popup-layer\s+\.ant-picker-panel-container\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 24px\)\s*!important;/);
    expect(cssSource).toMatch(/body\s+\.audit-log-page__rangePopup\.shop-mobile-popup-layer\s+\.ant-picker-panels\s*\{[\s\S]*?flex-direction:\s*column;/);
  });
});
