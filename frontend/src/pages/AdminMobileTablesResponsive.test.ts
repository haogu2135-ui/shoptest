import fs from 'fs';
import path from 'path';

const readPageFile = (file: string) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tableContracts = [
  {
    source: 'ProductManagement.tsx',
    css: 'ProductManagement.css',
    tableClass: 'product-management-page__mobileCardTable',
    minLabels: 11,
    actionClass: 'product-action-space',
  },
  {
    source: 'OrderManagement.tsx',
    css: 'OrderManagement.css',
    tableClass: 'order-management-page__mobileCardTable',
    minLabels: 11,
    actionClass: 'order-management-page__actions',
  },
  {
    source: 'UserManagement.tsx',
    css: 'UserManagement.css',
    tableClass: 'user-management-page__mobileCardTable',
    minLabels: 10,
    actionClass: 'user-management-page__tableActions',
  },
  {
    source: 'BrandManagement.tsx',
    css: 'BrandManagement.css',
    tableClass: 'brand-management-page__mobileCardTable',
    minLabels: 7,
    actionClass: 'brand-management-page__tableActions',
  },
];

describe('Admin mobile data table responsive contracts', () => {
  it('keeps primary admin tables annotated with mobile row labels', () => {
    for (const contract of tableContracts) {
      const source = readPageFile(contract.source);
      const labelCount = source.match(/onCell:\s*\(\)\s*=>/g)?.length || 0;

      expect(source).toContain(contract.tableClass);
      expect(source).toContain("Record<'data-label', string>");
      expect(labelCount).toBeGreaterThanOrEqual(contract.minLabels);
      expect(source).toContain(contract.actionClass);
    }
  });

  it('turns primary admin tables into labelled cards at mobile, landscape, and tablet widths', () => {
    for (const contract of tableContracts) {
      const css = readPageFile(contract.css);
      const f2718Start = css.indexOf('/* F2718: mobile admin list rows');
      const f2718Css = css.slice(f2718Start);
      const tableClassPattern = escapeRegExp(`.${contract.tableClass}`);

      expect(f2718Start).toBeGreaterThanOrEqual(0);
      expect(f2718Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
      expect(f2718Css).toMatch(new RegExp(`${tableClassPattern} \\.ant-table-content > table\\s*\\{[\\s\\S]*?width:\\s*100%\\s*!important;[\\s\\S]*?min-width:\\s*0\\s*!important;`));
      expect(f2718Css).toMatch(new RegExp(`${tableClassPattern} \\.ant-table-thead\\s*\\{[\\s\\S]*?display:\\s*none;`));
      expect(f2718Css).toMatch(new RegExp(`${tableClassPattern} \\.ant-table-tbody > tr:not\\(\\.ant-table-placeholder\\) > td\\[data-label\\]\\s*\\{[\\s\\S]*?display:\\s*grid;[\\s\\S]*?grid-template-columns:\\s*minmax\\(104px,\\s*34%\\) minmax\\(0,\\s*1fr\\);`));
      expect(f2718Css).toContain('content: attr(data-label);');
      expect(f2718Css).toContain(`.${contract.actionClass}`);
      expect(f2718Css).toContain('min-height: 44px;');
      expect(f2718Css).toContain('grid-template-columns: minmax(0, 1fr);');
    }
  });

  it('keeps bug management on the existing mobile labelled-card path', () => {
    const source = readPageFile('BugManagement.tsx');
    const css = readPageFile('BugManagement.css');

    expect(source.match(/data-label/g)?.length || 0).toBeGreaterThanOrEqual(6);
    expect(source).toContain('bug-management__rowActions');
    expect(css).toContain('@media (max-width: 900px), (max-height: 640px)');
    expect(css).toContain('.bug-management__table .ant-table-thead');
    expect(css).toContain('content: attr(data-label);');
    expect(css).toContain('.bug-management__table .ant-table-tbody > tr:not(.ant-table-expanded-row)');
    expect(css).toContain('.bug-management__table .bug-management__rowActions');
  });
});
