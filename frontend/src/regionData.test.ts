import fs from 'fs';
import path from 'path';
import { findRegionPath, type RegionOption } from './regionData';

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
    expect(source).toContain('cachedRegionData');
    expect(source).toContain('regionDataPromise');
    expect(source).toContain('buildMexicoRegionData(mexicoMunicipalitiesModule.default)');
    expect(source).toContain('buildChinaRegionData(chinaLevelModule.default)');
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
