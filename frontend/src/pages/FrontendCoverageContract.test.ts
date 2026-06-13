import fs from 'fs';
import path from 'path';

const pagesDir = __dirname;
const componentsDir = path.resolve(__dirname, '../components');

const sourceNames = (dir: string) => fs.readdirSync(dir)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !file.includes('.test.'))
  .filter((file) => !file.endsWith('TypeSafety.test.tsx'))
  .map((file) => file.replace(/\.tsx$/, ''))
  .sort();

const testNames = (dir: string) => fs.readdirSync(dir)
  .filter((file) => /\.test\.tsx?$/.test(file))
  .map((file) => file.replace(/(?:TypeSafety)?\.test\.tsx?$/, ''))
  .sort();

const coveredBy = (source: string, tests: string[]) =>
  tests.some((test) => test === source || test.startsWith(source));

describe('frontend source coverage inventory', () => {
  it('keeps every page component covered by at least one page test contract', () => {
    const helperFiles = new Set(['productDetailHelpers']);
    const pages = sourceNames(pagesDir).filter((name) => !helperFiles.has(name));
    const tests = testNames(pagesDir);
    const uncovered = pages.filter((page) => !coveredBy(page, tests));

    expect(uncovered).toEqual([]);
  });

  it('keeps every shared TSX component covered by at least one component test contract', () => {
    const components = sourceNames(componentsDir);
    const tests = testNames(componentsDir);
    const uncovered = components.filter((component) => !coveredBy(component, tests));

    expect(uncovered).toEqual([]);
  });
});
