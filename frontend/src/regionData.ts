import chinaLevelData from 'province-city-china/dist/level.min.json';
import chinaTownData from 'province-city-china/dist/town.min.json';
import mexicoMunicipalitiesData from './mexicoMunicipalities.json';

export interface RegionOption {
  value: string;
  label: string;
  children?: RegionOption[];
}

type ChinaLevelItem = {
  c: string;
  n: string;
  d?: ChinaLevelItem[];
};

type ChinaTownItem = {
  c: string;
  n: string;
};

type MexicoMunicipalities = Record<string, string[]>;

const option = (name: string, children?: RegionOption[]): RegionOption => ({
  value: name,
  label: name,
  ...(children && children.length > 0 ? { children } : {}),
});

const townsByAreaCode = (chinaTownData as ChinaTownItem[]).reduce<Record<string, RegionOption[]>>((acc, town) => {
  if (!acc[town.c]) acc[town.c] = [];
  acc[town.c].push(option(town.n));
  return acc;
}, {});

const buildChinaRegionData = (): RegionOption => {
  const provinces = (chinaLevelData as ChinaLevelItem[]).map((province) =>
    option(
      province.n,
      (province.d || []).map((city) =>
        option(
          city.n,
          (city.d || []).map((area) => option(area.n, townsByAreaCode[area.c] || [])),
        ),
      ),
    ),
  );

  return option('中国', provinces);
};

const streets = (names: string[]): RegionOption[] => names.map((name) => option(name));

const mexicoLocalityFallback = ['Centro', 'Colonia', 'Fraccionamiento', 'Localidad'];

const buildMexicoRegionData = (): RegionOption => {
  const states = Object.entries(mexicoMunicipalitiesData as MexicoMunicipalities)
    .sort(([stateA], [stateB]) => stateA.localeCompare(stateB, 'es-MX'))
    .map(([state, municipalities]) =>
      option(
        state,
        municipalities
          .slice()
          .sort((a, b) => a.localeCompare(b, 'es-MX'))
          .map((municipality) => option(municipality, streets(mexicoLocalityFallback))),
      ),
    );

  return option('墨西哥', states);
};

export const regionData: RegionOption[] = [
  buildChinaRegionData(),
  buildMexicoRegionData(),
];

export const findRegionPath = (address: string): { region: string[]; detail: string } => {
  const parts = address.split(' ').filter(Boolean);

  for (let end = Math.min(parts.length, 5); end >= 3; end -= 1) {
    const candidate = parts.slice(0, end);
    let current = regionData;
    let matched = true;

    for (const part of candidate) {
      const item = current.find((region) => region.value === part);
      if (!item) {
        matched = false;
        break;
      }
      current = item.children || [];
    }

    if (matched) {
      return { region: candidate, detail: parts.slice(end).join(' ') };
    }
  }

  return { region: [], detail: address };
};
