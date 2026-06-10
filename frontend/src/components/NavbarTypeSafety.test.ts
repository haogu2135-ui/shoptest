import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'Navbar.tsx'), 'utf8');

describe('Navbar type-safety guards', () => {
  it('keeps authenticated cart badge counting typed without broad any usage', () => {
    expect(source).toContain("import type { CartItem, SiteAnnouncementPublic } from '../types';");
    expect(source).toContain('item: CartItem');
    expect(source).toContain('normalizeBadgeCount(item.quantity)');
    expect(source).not.toContain('item: any');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('as any');
  });
});
