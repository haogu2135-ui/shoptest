import fs from 'fs';
import path from 'path';

const readPageSource = (fileName: string) =>
  fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

describe('frontend page module state guards', () => {
  it('keeps cart and product quantity state out of module-level mutable maps', () => {
    const cartSource = readPageSource('Cart.tsx');
    const productListSource = readPageSource('ProductList.tsx');
    const profileSource = readPageSource('Profile.tsx');

    expect(cartSource).not.toMatch(/\b(?:let|const|var)\s+maxQuantity\s*:\s*Record<number,\s*number>/);
    expect(cartSource).not.toContain('const maxQuantity = { 1: 99, 2: 99, 3: 99 }');

    expect(productListSource).not.toMatch(/\b(?:let|const|var)\s+productQuantities\s*:\s*Record<number,\s*number>/);
    expect(productListSource).not.toMatch(/\b(?:let|const|var)\s+productMaxQuantities\s*:\s*Record<number,\s*number>/);

    expect(profileSource).not.toMatch(/\b(?:let|const|var)\s+productQuantities\s*:\s*Record<number,\s*number>/);
    expect(profileSource).not.toContain('const productQuantities =');
  });
});
