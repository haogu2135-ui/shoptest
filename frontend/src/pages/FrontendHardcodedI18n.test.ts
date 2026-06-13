import fs from 'fs';
import path from 'path';

const productionSourceFiles = [
  ['Profile.tsx', 'Profile.tsx'],
  ['ProductList.tsx', 'ProductList.tsx'],
  ['BrowsingHistory.tsx', 'BrowsingHistory.tsx'],
  ['ProductManagement.tsx', 'ProductManagement.tsx'],
  ['AdminDashboard.tsx', 'AdminDashboard.tsx'],
  ['ProductDetail.tsx', 'ProductDetail.tsx'],
  ['ConfigCenter.tsx', 'ConfigCenter.tsx'],
  ['Navbar.tsx', '../components/Navbar.tsx'],
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

describe('frontend page i18n hardcoded string guards', () => {
  it('keeps stale Chinese UI literals out of production source files', () => {
    const pageSources = productionSourceFiles.map(([filename, relativePath]) => ({
      filename,
      source: fs.readFileSync(path.join(__dirname, relativePath), 'utf8'),
    }));

    for (const { filename, source } of pageSources) {
      for (const literal of staleChineseUiLiterals) {
        expect(source).not.toContain(literal);
      }
      expect(source).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
});
