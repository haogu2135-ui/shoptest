import fs from 'fs';
import path from 'path';

const pagesDir = __dirname;
const componentsDir = path.resolve(__dirname, '../components');

const testSourceFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return testSourceFiles(entryPath);
    return /\.test\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });

const frontendTestSources = testSourceFiles(path.resolve(__dirname, '..'))
  .map((file) => fs.readFileSync(file, 'utf8'));

const sourceNames = (dir: string) => fs.readdirSync(dir)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !file.includes('.test.'))
  .filter((file) => !file.endsWith('TypeSafety.test.tsx'))
  .map((file) => file.replace(/\.tsx$/, ''))
  .sort();

const coveredBy = (source: string) => {
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sourceReference = new RegExp(`(^|[^A-Za-z0-9_$])${escapedSource}($|[^A-Za-z0-9_$])`);
  return frontendTestSources.some((testSource) => sourceReference.test(testSource));
};

describe('frontend source coverage inventory', () => {
  it('keeps every page component covered by at least one page test contract', () => {
    const helperFiles = new Set(['productDetailHelpers']);
    const pages = sourceNames(pagesDir).filter((name) => !helperFiles.has(name));
    const uncovered = pages.filter((page) => !coveredBy(page));

    expect(uncovered).toEqual([]);
  });

  it('keeps every shared TSX component covered by at least one component test contract', () => {
    const components = sourceNames(componentsDir);
    const uncovered = components.filter((component) => !coveredBy(component));

    expect(uncovered).toEqual([]);
  });
});
