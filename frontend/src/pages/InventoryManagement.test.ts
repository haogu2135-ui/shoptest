import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, 'InventoryManagement.tsx'), 'utf8');

describe('InventoryManagement commercial inventory contracts', () => {
  it('uses the catalog-wide backend aggregate instead of presenting one page as global health', () => {
    expect(source).toContain('adminApi.getInventorySummary()');
    expect(source).toContain('setHealth(normalizeInventorySummary(summaryResponse.data));');
    expect(source).not.toContain('deriveInventoryHealth(products)');
    expect(source).toContain('updatedAt: adjustTarget.updatedAt');
  });
});
