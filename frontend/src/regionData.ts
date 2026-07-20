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

const streets = (names: string[]): RegionOption[] => names.map((name) => option(name));

// Keep leaf locality options lightweight so checkout never pulls multi-MB district catalogs.
const localityFallback = ['Centro', 'Colonia', 'Fraccionamiento', 'Localidad'];

/**
 * Commercial performance: China district-level data is enough for checkout cascader
 * leaves. Street-level detail stays free-text in the address form instead of shipping
 * the multi-megabyte province-city-china street catalog to every shopper.
 */
const buildChinaRegionData = (chinaLevelData: ChinaLevelItem[]): RegionOption => {
  const provinces = chinaLevelData.map((province) =>
    option(
      province.n,
      (province.d || []).map((cityOrArea) => {
        const childAreas = cityOrArea.d || [];
        if (childAreas.length === 0) {
          return option(cityOrArea.n, streets(localityFallback));
        }
        return option(
          cityOrArea.n,
          childAreas.map((area) => option(area.n, streets(localityFallback))),
        );
      }),
    ),
  );

  return option('\u4e2d\u56fd', provinces);
};

const buildMexicoRegionData = (mexicoMunicipalitiesData: MexicoMunicipalities): RegionOption => {
  const states = Object.entries(mexicoMunicipalitiesData)
    .sort(([stateA], [stateB]) => stateA.localeCompare(stateB, 'es-MX'))
    .map(([state, municipalities]) =>
      option(
        state,
        municipalities
          .slice()
          .sort((a, b) => a.localeCompare(b, 'es-MX'))
          .map((municipality) => option(municipality, streets(localityFallback))),
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
  const cachedLocalizedData = cachedLocalizedRegionData[normalizedLanguage];
  if (cachedLocalizedData) {
    return cachedLocalizedData;
  }
  if (cachedRegionData) {
    const localizedData = localizeRegionData(cachedRegionData, normalizedLanguage);
    cachedLocalizedRegionData[normalizedLanguage] = localizedData;
    return localizedData;
  }
  if (!regionDataPromise) {
    // Mexico-first commercial market: load MX municipalities + compact CN level data only.
    // Never import the multi-megabyte province-city-china street catalog into the client graph.
    regionDataPromise = Promise.all([
      import(/* webpackChunkName: "region-china-level" */ 'province-city-china/dist/level.min.json') as Promise<{ default: ChinaLevelItem[] }>,
      import(/* webpackChunkName: "region-mexico-municipalities" */ './mexicoMunicipalities.json') as Promise<{ default: MexicoMunicipalities }>,
    ]).then(([chinaLevelModule, mexicoMunicipalitiesModule]) => {
      const data = [
        buildMexicoRegionData(mexicoMunicipalitiesModule.default),
        buildChinaRegionData(chinaLevelModule.default),
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
