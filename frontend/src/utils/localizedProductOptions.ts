import type { Language } from '../i18n';

const PRODUCT_OPTION_LABELS: Partial<Record<Language, Record<string, string>>> = {
  es: {
    Size: 'Talla',
    Color: 'Color',
    Small: 'Pequeña',
    Medium: 'Mediana',
    Large: 'Grande',
    Orange: 'Naranja',
    Teal: 'Verde azulado',
    Graphite: 'Grafito',
    Black: 'Negro',
    Red: 'Rojo',
    Blue: 'Azul',
    White: 'Blanco',
    Green: 'Verde',
    Pink: 'Rosa',
    Cotton: 'Algodón',
    Nylon: 'Nailon',
    Silicone: 'Silicona',
    Wood: 'Madera',
  },
  zh: {
    Size: '尺码',
    Color: '颜色',
    Small: '小号',
    Medium: '中号',
    Large: '大号',
    Orange: '橙色',
    Teal: '蓝绿色',
    Graphite: '石墨色',
    Black: '黑色',
    Red: '红色',
    Blue: '蓝色',
    White: '白色',
    Green: '绿色',
    Pink: '粉色',
    Cotton: '棉',
    Nylon: '尼龙',
    Silicone: '硅胶',
    Wood: '木质',
  },
};

const normalizeOptionName = (value: string) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const SIZE_OPTION_ALIASES = new Set([
  'size',
  'sizes',
  'pet size',
  'talla',
  'tamaño',
  'taille',
  'größe',
  '尺码',
  '尺寸',
]);

export const getLocalizedOptionLabel = (value: string, language: Language | string) =>
  PRODUCT_OPTION_LABELS[language as Language]?.[value] || value;

export const isSizeOptionName = (value: string) => {
  const normalized = normalizeOptionName(value);
  if (!normalized) return false;
  if (SIZE_OPTION_ALIASES.has(normalized)) return true;
  return Object.values(PRODUCT_OPTION_LABELS)
    .some((labels) => normalizeOptionName(labels?.Size || '') === normalized);
};
