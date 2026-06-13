import fs from 'fs';
import path from 'path';
import { findRegionPath, type RegionOption } from './regionData';

const readRegionDataSource = () => fs.readFileSync(path.resolve(__dirname, 'regionData.ts'), 'utf8');

describe('regionData lazy loading contract', () => {
  it('keeps the large China region datasets out of the initial bundle', () => {
    const source = readRegionDataSource();

    expect(source).not.toMatch(/^import .*province-city-china/m);
    expect(source).toContain("import(/* webpackChunkName: \"region-china-level\" */ 'province-city-china/dist/level.min.json')");
    expect(source).toContain("import(/* webpackChunkName: \"region-china-town\" */ 'province-city-china/dist/town.min.json')");
    expect(source).toContain('cachedRegionData');
    expect(source).toContain('regionDataPromise');
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
