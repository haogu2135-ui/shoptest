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

const streets = (names: string[]): RegionOption[] => {
  const result: RegionOption[] = [];
  for (const name of names) result.push(option(name));
  return result;
};

// Keep leaf locality options lightweight so checkout never pulls multi-MB district catalogs.
const localityFallback = ['Centro', 'Colonia', 'Fraccionamiento', 'Localidad'];

/**
 * Commercial performance: China district-level data is enough for checkout cascader
 * leaves. Street-level detail stays free-text in the address form instead of shipping
 * the multi-megabyte province-city-china street catalog to every shopper.
 */
const buildChinaRegionData = (chinaLevelData: ChinaLevelItem[]): RegionOption => {
  const provinces: RegionOption[] = [];
  for (const province of chinaLevelData) {
    const cities: RegionOption[] = [];
    for (const cityOrArea of province.d || []) {
      const childAreas = cityOrArea.d || [];
      if (childAreas.length === 0) {
        cities.push(option(cityOrArea.n, streets(localityFallback)));
        continue;
      }
      const areas: RegionOption[] = [];
      for (const area of childAreas) areas.push(option(area.n, streets(localityFallback)));
      cities.push(option(cityOrArea.n, areas));
    }
    provinces.push(option(province.n, cities));
  }

  return option('\u4e2d\u56fd', provinces);
};

const buildMexicoRegionData = (mexicoMunicipalitiesData: MexicoMunicipalities): RegionOption => {
  const stateEntries = Object.entries(mexicoMunicipalitiesData);
  stateEntries.sort(([stateA], [stateB]) => stateA.localeCompare(stateB, 'es-MX'));
  const states: RegionOption[] = [];
  for (const [state, municipalities] of stateEntries) {
    const sortedMunicipalities = [...municipalities].sort((a, b) => a.localeCompare(b, 'es-MX'));
    const municipalityOptions: RegionOption[] = [];
    for (const municipality of sortedMunicipalities) {
      municipalityOptions.push(option(municipality, streets(localityFallback)));
    }
    states.push(option(state, municipalityOptions));
  }

  return option('\u58a8\u897f\u54e5', states);
};

let cachedMexicoRegion: RegionOption | null = null;
let cachedChinaRegion: RegionOption | null = null;
let mexicoRegionPromise: Promise<RegionOption> | null = null;
let chinaRegionPromise: Promise<RegionOption> | null = null;
let cachedLocalizedRegionData: Partial<Record<RegionLanguage, RegionOption[]>> = {};

const assembledRegionData = (): RegionOption[] => {
  const regions: RegionOption[] = [];
  if (cachedMexicoRegion) regions.push(cachedMexicoRegion);
  if (cachedChinaRegion) regions.push(cachedChinaRegion);
  return regions;
};

const localizeRegionData = (regions: RegionOption[], language?: string): RegionOption[] => {
  const normalizedLanguage = normalizeRegionLanguage(language);
  return regions.map((region) => ({
    ...region,
    label: localizedCountryLabels[region.value]?.[normalizedLanguage] || region.label,
  }));
};

const loadMexicoRegionOption = async (): Promise<RegionOption> => {
  if (cachedMexicoRegion) return cachedMexicoRegion;
  if (!mexicoRegionPromise) {
    mexicoRegionPromise = (import(/* webpackChunkName: "region-mexico-municipalities" */ './mexicoMunicipalities.json') as Promise<{ default: MexicoMunicipalities }>)
      .then((mexicoMunicipalitiesModule) => {
        cachedMexicoRegion = buildMexicoRegionData(mexicoMunicipalitiesModule.default);
        cachedLocalizedRegionData = {};
        return cachedMexicoRegion;
      })
      .catch((error) => {
        mexicoRegionPromise = null;
        throw error;
      });
  }
  return mexicoRegionPromise;
};

const loadChinaRegionOption = async (): Promise<RegionOption> => {
  if (cachedChinaRegion) return cachedChinaRegion;
  if (!chinaRegionPromise) {
    // Compact China province/city/district level only — never the multi-MB town catalog.
    chinaRegionPromise = (import(/* webpackChunkName: "region-china-level" */ 'province-city-china/dist/level.min.json') as Promise<{ default: ChinaLevelItem[] }>)
      .then((chinaLevelModule) => {
        cachedChinaRegion = buildChinaRegionData(chinaLevelModule.default);
        cachedLocalizedRegionData = {};
        return cachedChinaRegion;
      })
      .catch((error) => {
        chinaRegionPromise = null;
        throw error;
      });
  }
  return chinaRegionPromise;
};

export const loadRegionData = async (language?: string): Promise<RegionOption[]> => {
  const normalizedLanguage = normalizeRegionLanguage(language);
  const cachedLocalizedData = cachedLocalizedRegionData[normalizedLanguage];
  if (cachedLocalizedData) {
    return cachedLocalizedData;
  }

  // Mexico is the commercial home market. Keep the China hierarchy off the non-Chinese
  // checkout path entirely: a region selector must not trigger a 250 KB background fetch.
  const mexico = await loadMexicoRegionOption();
  let regions: RegionOption[];
  if (normalizedLanguage === 'zh') {
    const china = await loadChinaRegionOption();
    regions = [mexico, china];
  } else {
    regions = [mexico];
  }

  const localizedData = localizeRegionData(regions, normalizedLanguage);
  cachedLocalizedRegionData[normalizedLanguage] = localizedData;
  return localizedData;
};

export const findRegionPath = (address: string, regions: RegionOption[] = assembledRegionData()): { region: string[]; detail: string } => {
  const rawParts = address.split(' ');
  const parts: string[] = [];
  for (const part of rawParts) {
    if (part) parts.push(part);
  }

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
