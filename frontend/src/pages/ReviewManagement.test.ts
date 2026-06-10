import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ReviewManagement.tsx'), 'utf8');

describe('ReviewManagement source guards', () => {
  it('uses typed nested review product and user fields without broad assertions', () => {
    expect(pageSource).not.toMatch(/\bas any\b|\bany\b/);
    expect(pageSource).toContain('record.product?.id');
    expect(pageSource).toContain('record.product?.imageUrl');
    expect(pageSource).toContain('record.user?.username');
    expect(pageSource).toContain('} catch (err: unknown) {');
  });
});
