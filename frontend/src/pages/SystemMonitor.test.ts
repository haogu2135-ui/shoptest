import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'SystemMonitor.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'SystemMonitor.css'), 'utf8');
const localeData = ['en', 'zh', 'es'].map((locale) => ({
  locale,
  messages: JSON.parse(fs.readFileSync(path.join(__dirname, `../locales/${locale}.json`), 'utf8')),
}));

describe('SystemMonitor mobile diagnostics guards', () => {
  it('keeps system status API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.systemMonitor.loadFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });

  it('uses page-scoped resource translation keys for runtime metric labels', () => {
    expect(pageSource).not.toContain("t('common.loading')");
    expect(pageSource).not.toContain("t('system.cpu')");
    expect(pageSource).not.toContain("t('system.memory')");
    expect(pageSource).toContain("t('pages.systemMonitor.cpuCores')");
    expect(pageSource).toContain("t('pages.systemMonitor.jvmMemory')");
    expect(pageSource).toContain("t('pages.systemMonitor.used')");
    expect(pageSource).toContain("t('pages.systemMonitor.free')");

    for (const { messages } of localeData) {
      expect(messages.pages.systemMonitor.cpuCores).toBeTruthy();
      expect(messages.pages.systemMonitor.jvmMemory).toBeTruthy();
      expect(messages.pages.systemMonitor.used).toBeTruthy();
      expect(messages.pages.systemMonitor.free).toBeTruthy();
    }
  });

  it('renders long operational diagnostics through Ant Design Descriptions', () => {
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.path')}>{diskStatus.path}</Descriptions.Item>");
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.blockers')} span={3}>");
    expect(pageSource).toContain('<Descriptions.Item label="URL"><Text>{maskDatabaseUrl(databaseStatus.url)}</Text></Descriptions.Item>');
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.address')}>{redisStatus.host || '-'}:{redisStatus.port || '-'}</Descriptions.Item>");
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.namespace')}>{nacosStatus.namespace || 'public'}</Descriptions.Item>");
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.error')}>");
  });

  it('stacks diagnostic description labels and values as full-width mobile rows', () => {
    const f3533Start = cssSource.indexOf('/* F3533');
    const f3533Css = cssSource.slice(f3533Start);

    expect(f3533Start).toBeGreaterThanOrEqual(0);
    expect(f3533Css).toMatch(/@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.system-monitor \.ant-descriptions-view > table,[\s\S]*?\.system-monitor \.ant-descriptions-view > table > tbody,[\s\S]*?\.system-monitor \.ant-descriptions-view > table > tbody > tr,[\s\S]*?\.system-monitor \.ant-descriptions-item-label,[\s\S]*?\.system-monitor \.ant-descriptions-item-content\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?max-width:\s*100%\s*!important;/);
    expect(f3533Css).toMatch(/\.system-monitor \.ant-descriptions-view\s*\{[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f3533Css).toMatch(/\.system-monitor \.ant-descriptions-view > table\s*\{[\s\S]*?table-layout:\s*auto\s*!important;/);
    expect(f3533Css).toMatch(/\.system-monitor \.ant-descriptions-item-label\s*\{[\s\S]*?border-right:\s*0\s*!important;[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(f3533Css).toMatch(/\.system-monitor \.ant-descriptions-item-content\s*\{[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/);
    expect(f3533Css).toMatch(/\.system-monitor \.ant-descriptions-item-content > \*,[\s\S]*?\.system-monitor__messages,[\s\S]*?\.system-monitor__message\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(f3533Css).not.toMatch(/table-layout:\s*fixed/);
  });

  it('keeps mobile dependency status tags as horizontal readable pills', () => {
    const f3533Start = cssSource.indexOf('/* F3533');
    const f2717Start = cssSource.indexOf('/* F2717');
    const f2717Css = cssSource.slice(f2717Start);

    expect(pageSource).toContain("<Space size={6}>{statusTag(status.status, status.ready, statusLabels)}{readyTag(status.ready, readyLabels)}</Space>");
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(databaseStatus.ready, readyLabels)}</Descriptions.Item>");
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(redisStatus.ready, readyLabels)}</Descriptions.Item>");
    expect(pageSource).toContain("<Descriptions.Item label={t('pages.systemMonitor.ready')}>{readyTag(nacosStatus.ready, readyLabels)}</Descriptions.Item>");

    expect(f3533Start).toBeGreaterThanOrEqual(0);
    expect(f2717Start).toBeGreaterThan(f3533Start);
    expect(f2717Css).toMatch(/\.system-monitor \.ant-descriptions-item-content \.ant-space\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?gap:\s*6px\s*!important;/);
    expect(f2717Css).toMatch(/\.system-monitor \.ant-descriptions-item-content \.ant-tag,[\s\S]*?\.system-monitor__statusTitle \.ant-tag\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?white-space:\s*nowrap\s*!important;[\s\S]*?word-break:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*normal\s*!important;/);
  });
});
