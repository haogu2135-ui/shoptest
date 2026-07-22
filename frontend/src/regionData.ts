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

const warmChinaRegionInBackground = () => {
  if (cachedChinaRegion || chinaRegionPromise) return;
  void loadChinaRegionOption().catch(() => {
    // Background warm is best-effort; next explicit zh load can retry.
  });
};

export const loadRegionData = async (language?: string): Promise<RegionOption[]> => {
  const normalizedLanguage = normalizeRegionLanguage(language);
  const cachedLocalizedData = cachedLocalizedRegionData[normalizedLanguage];
  if (cachedLocalizedData) {
    return cachedLocalizedData;
  }

  // Mexico-first commercial market: Spanish/English checkout waits only on MX municipalities (~44KB),
  // not the China level catalog (~250KB). Chinese UI still loads both so CN addresses keep working.
  const mexico = await loadMexicoRegionOption();
  let regions: RegionOption[];
  if (normalizedLanguage === 'zh') {
    const china = await loadChinaRegionOption();
    regions = [mexico, china];
  } else {
    regions = cachedChinaRegion ? [mexico, cachedChinaRegion] : [mexico];
    // Warm China after first MX open so bilingual shoppers get it on a later address edit without
    // blocking the primary Spanish/English conversion path.
    warmChinaRegionInBackground();
  }

  const localizedData = localizeRegionData(regions, normalizedLanguage);
  cachedLocalizedRegionData[normalizedLanguage] = localizedData;
  return localizedData;
};

export const findRegionPath = (address: string, regions: RegionOption[] = assembledRegionData()): { region: string[]; detail: string } => {
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
