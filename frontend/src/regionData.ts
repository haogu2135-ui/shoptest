export interface RegionOption {
  value: string;
  label: string;
  children?: RegionOption[];
}

type RegionLanguage = 'en' | 'zh' | 'es';

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

const normalizeRegionLanguage = (language?: string): RegionLanguage => {
  if (language === 'zh' || language === 'es') return language;
  return 'en';
};

const localizedCountryLabels: Record<string, Record<RegionLanguage, string>> = {
  '\u4e2d\u56fd': {
    en: 'China',
    zh: '\u4e2d\u56fd',
    es: 'China',
  },
  '\u58a8\u897f\u54e5': {
    en: 'Mexico',
    zh: '\u58a8\u897f\u54e5',
    es: 'M\u00e9xico',
  },
};

const option = (name: string, children?: RegionOption[]): RegionOption => ({
  value: name,
  label: name,
  ...(children && children.length > 0 ? { children } : {}),
});

const buildChinaRegionData = (chinaLevelData: ChinaLevelItem[], chinaTownData: ChinaTownItem[]): RegionOption => {
  const townsByAreaCode = chinaTownData.reduce<Record<string, RegionOption[]>>((acc, town) => {
    if (!acc[town.c]) acc[town.c] = [];
    acc[town.c].push(option(town.n));
    return acc;
  }, {});
  const provinces = chinaLevelData.map((province) =>
    option(
      province.n,
      (province.d || []).map((cityOrArea) => {
        const childAreas = cityOrArea.d || [];
        if (childAreas.length === 0) {
          return option(cityOrArea.n, townsByAreaCode[cityOrArea.c] || []);
        }
        return option(
          cityOrArea.n,
          childAreas.map((area) => option(area.n, townsByAreaCode[area.c] || [])),
        );
      }),
    ),
  );

  return option('\u4e2d\u56fd', provinces);
};

const streets = (names: string[]): RegionOption[] => names.map((name) => option(name));

const mexicoLocalityFallback = ['Centro', 'Colonia', 'Fraccionamiento', 'Localidad'];

const buildMexicoRegionData = (mexicoMunicipalitiesData: MexicoMunicipalities): RegionOption => {
  const states = Object.entries(mexicoMunicipalitiesData)
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

  return option('\u58a8\u897f\u54e5', states);
};

let cachedRegionData: RegionOption[] | null = null;
let regionDataPromise: Promise<RegionOption[]> | null = null;
let cachedLocalizedRegionData: Partial<Record<RegionLanguage, RegionOption[]>> = {};

const localizeRegionData = (regions: RegionOption[], language?: string): RegionOption[] => {
  const normalizedLanguage = normalizeRegionLanguage(language);
  return regions.map((region) => ({
    ...region,
    label: localizedCountryLabels[region.value]?.[normalizedLanguage] || region.label,
  }));
};

export const loadRegionData = async (language?: string): Promise<RegionOption[]> => {
  const normalizedLanguage = normalizeRegionLanguage(language);
  if (cachedLocalizedRegionData[normalizedLanguage]) {
    return cachedLocalizedRegionData[normalizedLanguage];
  }
  if (cachedRegionData) {
    const localizedData = localizeRegionData(cachedRegionData, normalizedLanguage);
    cachedLocalizedRegionData[normalizedLanguage] = localizedData;
    return localizedData;
  }
  if (!regionDataPromise) {
    regionDataPromise = Promise.all([
      import(/* webpackChunkName: "region-china-level" */ 'province-city-china/dist/level.min.json') as Promise<{ default: ChinaLevelItem[] }>,
      import(/* webpackChunkName: "region-china-town" */ 'province-city-china/dist/town.min.json') as Promise<{ default: ChinaTownItem[] }>,
      import(/* webpackChunkName: "region-mexico-municipalities" */ './mexicoMunicipalities.json') as Promise<{ default: MexicoMunicipalities }>,
    ]).then(([chinaLevelModule, chinaTownModule, mexicoMunicipalitiesModule]) => {
      const data = [
        buildChinaRegionData(chinaLevelModule.default, chinaTownModule.default),
        buildMexicoRegionData(mexicoMunicipalitiesModule.default),
      ];
      cachedRegionData = data;
      cachedLocalizedRegionData = {};
      return data;
    }).catch((error) => {
      regionDataPromise = null;
      throw error;
    });
  }
  const data = await regionDataPromise;
  const localizedData = localizeRegionData(data, normalizedLanguage);
  cachedLocalizedRegionData[normalizedLanguage] = localizedData;
  return localizedData;
};

export const findRegionPath = (address: string, regions: RegionOption[] = cachedRegionData || []): { region: string[]; detail: string } => {
  const parts = address.split(' ').filter(Boolean);

  for (let end = Math.min(parts.length, 5); end >= 3; end -= 1) {
    const candidate = parts.slice(0, end);
    let current = regions;
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
