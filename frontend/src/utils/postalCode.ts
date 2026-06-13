const sanitizePostalControlChars = (value: string) =>
  Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('');

const normalizePostalText = (value: unknown, maxLength: number) =>
  sanitizePostalControlChars(String(value || '')).trim().replace(/\s+/g, ' ').slice(0, maxLength);

export const normalizeRegionalPostalCode = (value: unknown) =>
  normalizePostalText(value, 20).toUpperCase();

const normalizePostalRuleToken = (value: unknown) =>
  normalizePostalText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

type RegionalPostalRule = {
  countryCode: string;
  aliases: string[];
  regionHints: string[];
  pattern: RegExp;
  example: string;
};

const regionalPostalRules: RegionalPostalRule[] = [
  {
    countryCode: 'CN',
    aliases: ['cn', 'china', 'prc', 'zhongguo', '\u4e2d\u56fd'],
    regionHints: [
      'anhui', 'beijing', 'chongqing', 'fujian', 'gansu', 'guangdong', 'guangxi', 'guizhou', 'hainan', 'hebei',
      'heilongjiang', 'henan', 'hubei', 'hunan', 'jiangsu', 'jiangxi', 'jilin', 'liaoning', 'neimenggu', 'ningxia',
      'qinghai', 'shaanxi', 'shandong', 'shanghai', 'shanxi', 'sichuan', 'tianjin', 'xinjiang', 'xizang', 'yunnan',
      'zhejiang', '\u5317\u4eac', '\u4e0a\u6d77', '\u5929\u6d25', '\u91cd\u5e86',
    ],
    pattern: /^\d{6}$/,
    example: '100000',
  },
  {
    countryCode: 'MX',
    aliases: ['mx', 'mexico', '\u58a8\u897f\u54e5'],
    regionHints: [
      'aguascalientes', 'baja california', 'baja california sur', 'campeche', 'chiapas', 'chihuahua',
      'ciudad de mexico', 'coahuila', 'colima', 'durango', 'guanajuato', 'guerrero', 'hidalgo', 'jalisco',
      'mexico', 'michoacan', 'morelos', 'nayarit', 'nuevo leon', 'oaxaca', 'puebla', 'queretaro', 'quintana roo',
      'san luis potosi', 'sinaloa', 'sonora', 'tabasco', 'tamaulipas', 'tlaxcala', 'veracruz', 'yucatan',
      'zacatecas',
    ],
    pattern: /^\d{5}$/,
    example: '01000',
  },
  {
    countryCode: 'US',
    aliases: ['us', 'usa', 'united states', 'united states of america', 'america'],
    regionHints: [],
    pattern: /^\d{5}(?:-\d{4})?$/,
    example: '10001',
  },
  {
    countryCode: 'GB',
    aliases: ['gb', 'uk', 'united kingdom', 'great britain', 'england', 'scotland', 'wales'],
    regionHints: [],
    pattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
    example: 'SW1A 1AA',
  },
];

const fallbackRegionalPostalPattern = /^(?=.*\d)[A-Z0-9][A-Z0-9 -]{2,11}$/;

const getRegionalPostalRule = (regionPath?: unknown): RegionalPostalRule | null => {
  const regionTokens = (Array.isArray(regionPath) ? regionPath : [])
    .map(normalizePostalRuleToken)
    .filter(Boolean);
  if (regionTokens.length === 0) return null;
  const [countryToken] = regionTokens;
  return regionalPostalRules.find((rule) =>
    rule.aliases.includes(countryToken)
      || regionTokens.some((token) => rule.regionHints.includes(token)),
  ) || null;
};

export const isValidRegionalPostalCode = (postalCode: unknown, regionPath?: unknown) => {
  const normalizedPostalCode = normalizeRegionalPostalCode(postalCode);
  if (!normalizedPostalCode) return false;
  const rule = getRegionalPostalRule(regionPath);
  return rule ? rule.pattern.test(normalizedPostalCode) : fallbackRegionalPostalPattern.test(normalizedPostalCode);
};
