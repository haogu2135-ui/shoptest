import fs from 'fs';
import path from 'path';

const productionSourceFiles = [
  ['Cart.tsx', 'Cart.tsx'],
  ['Profile.tsx', 'Profile.tsx'],
  ['BugManagement.tsx', 'BugManagement.tsx'],
  ['Home.tsx', 'Home.tsx'],
  ['ProductList.tsx', 'ProductList.tsx'],
  ['BrowsingHistory.tsx', 'BrowsingHistory.tsx'],
  ['ProductManagement.tsx', 'ProductManagement.tsx'],
  ['AdminDashboard.tsx', 'AdminDashboard.tsx'],
  ['ProductDetail.tsx', 'ProductDetail.tsx'],
  ['OrderManagement.tsx', 'OrderManagement.tsx'],
  ['ConfigCenter.tsx', 'ConfigCenter.tsx'],
  ['Navbar.tsx', '../components/Navbar.tsx'],
];

const staleI18nReportPageFiles = [
  'Product.tsx',
  'ProductImport.tsx',
  'ProductImportExport.tsx',
  'OrderDetail.tsx',
];

const staleChineseUiLiterals = [
  '宠物品种',
  '品种',
  '商品名称不能为空',
  '未知分类',
  '默认分类',
  '暂无浏览记录',
  '加载中...',
  '个商品',
  '暂无相关商品',
  '仅管理员可用',
  '流量统计',
  '添加商品',
  '编辑商品',
  '商品管理',
  '库存',
  '导出商品',
  '导出成功',
  '导出失败',
  '正在导出',
  '内容不能为空',
  '确认清除当前设备的IP封禁状态?',
  '已清除封禁',
  '操作',
  '添加',
  '新版本可用',
  '正在更新',
  '重新启动',
  '忽略此版本',
  '立即更新',
];

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

const readJson = (relativePath: string) =>
  JSON.parse(readSource(relativePath));

describe('frontend page i18n hardcoded string guards', () => {
  it('keeps stale i18n report page paths out of the active frontend source', () => {
    const appSource = readSource('../App.tsx');

    staleI18nReportPageFiles.forEach((filename) => {
      expect(fs.existsSync(path.join(__dirname, filename))).toBe(false);
    });
    expect(appSource).not.toMatch(/import\('\.\/pages\/(?:Product|ProductImport|ProductImportExport|OrderDetail)'\)/);
    expect(appSource).not.toMatch(/from ['"]\.\/pages\/(?:Product|ProductImport|ProductImportExport|OrderDetail)['"]/);
  });

  it('keeps stale Chinese UI literals out of production source files', () => {
    const pageSources = productionSourceFiles.map(([filename, relativePath]) => ({
      filename,
      source: readSource(relativePath),
    }));

    for (const { filename, source } of pageSources) {
      for (const literal of staleChineseUiLiterals) {
        expect(source).not.toContain(literal);
      }
      expect(source).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('keeps browsing history empty, loading, and count copy in locale data', () => {
    const source = readSource('BrowsingHistory.tsx');
    const locales = [
      readJson('../locales/en.json'),
      readJson('../locales/es.json'),
      readJson('../locales/zh.json'),
    ];

    expect(source).toContain("t('pages.browsingHistory.empty')");
    expect(source).toContain("t('pages.browsingHistory.subtitle'");
    expect(source).not.toContain('暂无浏览记录');
    expect(source).not.toContain('加载中...');
    expect(source).not.toContain('个商品');
    expect(source).not.toMatch(/[\u4e00-\u9fff]/);

    locales.forEach((locale) => {
      expect(locale.common.loading).toEqual(expect.any(String));
      expect(locale.common.itemsCount).toContain('{count}');
      expect(locale.pages.browsingHistory.empty).toEqual(expect.any(String));
      expect(locale.pages.browsingHistory.subtitle).toContain('{count}');
    });
  });

  it('keeps auth brand and trust statistics in locale data', () => {
    const loginSource = readSource('Login.tsx');
    const registerSource = readSource('Register.tsx');
    const locales = [
      readJson('../locales/en.json'),
      readJson('../locales/es.json'),
      readJson('../locales/zh.json'),
    ];

    expect(loginSource).toContain("{t('common.brand')}");
    expect(registerSource).toContain("{t('common.brand')}");
    expect(loginSource).toContain("t('pages.auth.loginStatTrackingValue')");
    expect(loginSource).toContain("t('pages.auth.loginStatSecureValue')");
    expect(registerSource).toContain("t('pages.auth.registerTrustSecure')");
    expect(registerSource).toContain("t('pages.auth.registerTrustPerks')");
    expect(registerSource).toContain("t('pages.auth.registerTrustTracking')");
    ['ShopMX', '24/7', 'SSL'].forEach((literal) => {
      expect(loginSource).not.toContain(`>${literal}<`);
      expect(registerSource).not.toContain(`>${literal}<`);
      expect(loginSource).not.toContain(`'${literal}'`);
      expect(registerSource).not.toContain(`'${literal}'`);
    });
    locales.forEach((locale) => {
      expect(locale.common.brand).toEqual(expect.any(String));
      expect(locale.pages.auth.loginStatTrackingValue).toEqual(expect.any(String));
      expect(locale.pages.auth.loginStatSecureValue).toEqual(expect.any(String));
      expect(locale.pages.auth.registerTrustSecure).toEqual(expect.any(String));
      expect(locale.pages.auth.registerTrustPerks).toEqual(expect.any(String));
      expect(locale.pages.auth.registerTrustTracking).toEqual(expect.any(String));
    });
  });
});
