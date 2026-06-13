import fs from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '..');
const productionSourceExtensions = new Set(['.ts', '.tsx']);

const collectProductionSourceFiles = (directory: string): string[] => {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__mocks__') return [];
      return collectProductionSourceFiles(entryPath);
    }

    const extension = path.extname(entry.name);
    if (!productionSourceExtensions.has(extension)) return [];
    if (entry.name.endsWith('.d.ts')) return [];
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) return [];
    return [entryPath];
  });
};

describe('frontend production source type-safety guard', () => {
  it('keeps production frontend code free of broad any escape hatches', () => {
    const offenders = collectProductionSourceFiles(sourceRoot).flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(sourceRoot, filePath);
      const broadAnyPatterns = [
        /\bas any\b/,
        /catch \([^)]*: any\)/,
        /\.catch\(\([^)]*: any\)/,
        /useRef<any>/,
        /\b[A-Za-z_$][\w$]*\??: any\b/,
        /any\[\]/,
      ];

      return broadAnyPatterns.some((pattern) => pattern.test(source)) ? [relativePath] : [];
    });

    expect(offenders).toEqual([]);
  });
});
