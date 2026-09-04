import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, 'InventoryManagement.tsx'), 'utf8');

describe('InventoryManagement commercial inventory contracts', () => {
  it('uses the catalog-wide backend aggregate instead of presenting one page as global health', () => {
    expect(source).toContain('adminApi.getInventorySummary({ signal: abortController.signal })');
    expect(source).toContain('setHealth(normalizeInventorySummary(summaryResponse.data));');
    expect(source).not.toContain('deriveInventoryHealth(products)');
    expect(source).toContain('updatedAt: adjustTarget.updatedAt');
  });

  it('latches stock adjustments and suppresses post-unmount feedback and refreshes', () => {
    expect(source).toContain('const adjustRef = useRef(false);');
    expect(source).toContain('const [adjustPending, setAdjustPending] = useState(false);');
    expect(source).toContain('if (!mountedRef.current || adjustRef.current || !adjustTarget) return;');
    expect(source).toContain('adjustRef.current = true;');
    expect(source).toContain('if (!mountedRef.current) return;');
    expect(source).toContain('adjustRef.current = false;');
    expect(source).toContain('const actionsDisabled = loading || Boolean(loadError) || !snapshotLoaded || adjustPending;');
    expect(source).toContain('if (mountedRef.current) await fetchInventory();');
    expect(source).toContain('if (mountedRef.current) {\n        setSaving(false);\n        setAdjustPending(false);\n      }');
  });
});
