import fs from 'fs';
import path from 'path';
import { findRegionPath, loadRegionData, type RegionOption } from './regionData';

let mockChinaCatalogLoads = 0;

jest.mock('province-city-china/dist/level.min.json', () => {
  mockChinaCatalogLoads += 1;
  return {
    __esModule: true,
    default: [{ c: '110000', n: '\u5317\u4eac\u5e02', d: [{ c: '110100', n: '\u5e02\u8f96\u533a' }] }],
  };
});

const readRegionDataSource = () => fs.readFileSync(path.resolve(__dirname, 'regionData.ts'), 'utf8');

describe('regionData lazy loading contract', () => {
  it('keeps large China datasets out of the initial bundle and never loads town catalog', () => {
    const source = readRegionDataSource();

    expect(source).not.toMatch(/^import .*province-city-china/m);
    expect(source).toContain("import(/* webpackChunkName: \"region-china-level\" */ 'province-city-china/dist/level.min.json')");
    expect(source).toContain("import(/* webpackChunkName: \"region-mexico-municipalities\" */ './mexicoMunicipalities.json')");
    expect(source).not.toContain('region-china-town');
    expect(source).not.toContain("province-city-china/dist/town");
    expect(source).not.toMatch(/webpackChunkName:\s*["']region-china-town["']/);
    expect(source).toContain('cachedMexicoRegion');
    expect(source).toContain('cachedChinaRegion');
    expect(source).toContain('loadMexicoRegionOption');
    expect(source).toContain('loadChinaRegionOption');
    expect(source).not.toContain('warmChinaRegionInBackground');
    expect(source).toContain("normalizedLanguage === 'zh'");
    expect(source).toContain('buildMexicoRegionData(mexicoMunicipalitiesModule.default)');
    expect(source).toContain('buildChinaRegionData(chinaLevelModule.default)');
  });

  it('loads China catalog only for the Chinese UI language', async () => {
    const source = readRegionDataSource();
    expect(source).toContain("normalizedLanguage === 'zh'");
    expect(source).toMatch(/const mexico = await loadMexicoRegionOption\(\);[\s\S]*if \(normalizedLanguage === 'zh'\)/);
    expect(source).toContain('regions = [mexico];');

    await expect(loadRegionData('es')).resolves.toHaveLength(1);
    expect(mockChinaCatalogLoads).toBe(0);

    await expect(loadRegionData('zh')).resolves.toHaveLength(2);
    expect(mockChinaCatalogLoads).toBe(1);
  });

  it('matches an address path against supplied region options without loading datasets', () => {
    const options: RegionOption[] = [{
      value: 'Mexico',
      label: 'Mexico',
      children: [{
        value: 'Jalisco',
        label: 'Jalisco',
        children: [{ value: 'Guadalajara', label: 'Guadalajara' }],
      }],
    }];

    expect(findRegionPath('Mexico Jalisco Guadalajara Av 123', options)).toEqual({
      region: ['Mexico', 'Jalisco', 'Guadalajara'],
      detail: 'Av 123',
    });
  });
});
