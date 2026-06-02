import type { CategoryPublic } from '../types';
import type { Language } from '../i18n';

export type CategoryTreeNode<T extends CategoryPublic = CategoryPublic> = T & {
  children?: CategoryTreeNode<T>[];
};

export interface CategoryTreeOption {
  value: number;
  label: string;
  title: string;
  key: number;
  disabled?: boolean;
  children?: CategoryTreeOption[];
}

export const buildCategoryTree = <T extends CategoryPublic>(categories: T[]): CategoryTreeNode<T>[] => {
  const nodeMap = new Map<number, CategoryTreeNode<T>>();
  const roots: CategoryTreeNode<T>[] = [];

  categories.forEach((category) => {
    nodeMap.set(category.id, { ...category, children: [] });
  });

  nodeMap.forEach((category) => {
    if (category.parentId && nodeMap.has(category.parentId)) {
      nodeMap.get(category.parentId)!.children!.push(category);
      return;
    }
    roots.push(category);
  });

  const sortTree = (nodes: CategoryTreeNode<T>[]) => {
    nodes.sort((left, right) => left.id - right.id);
    nodes.forEach((node) => sortTree(node.children || []));
  };

  sortTree(roots);
  return roots;
};

export const flattenCategoryTree = <T extends CategoryPublic>(categories: CategoryTreeNode<T>[]): CategoryTreeNode<T>[] => {
  const result: CategoryTreeNode<T>[] = [];
  const visit = (nodes: CategoryTreeNode<T>[]) => {
    nodes.forEach((node) => {
      result.push(node);
      visit(node.children || []);
    });
  };

  visit(categories);
  return result;
};

export const getDisplayCategoryRoots = <T extends CategoryPublic>(categories: T[]): CategoryTreeNode<T>[] => {
  const tree = buildCategoryTree(categories);
  const onlyRoot = tree.length === 1 ? tree[0] : undefined;
  return onlyRoot?.children?.length ? onlyRoot.children : tree;
};

const categoryNameFallbacks: Record<string, Partial<Record<Language, string>>> = {
  'pet supplies': { es: 'Artículos para mascotas', zh: '宠物用品' },
  'pet food': { es: 'Alimento para mascotas', zh: '宠物食品' },
  dog: { es: 'Perro', zh: '狗狗' },
  dogs: { es: 'Perros', zh: '狗狗' },
  cat: { es: 'Gato', zh: '猫咪' },
  cats: { es: 'Gatos', zh: '猫咪' },
  'small pets': { es: 'Mascotas pequeñas', zh: '小宠' },
  'bowls, feeders & waterers': { es: 'Platos, comederos y bebederos', zh: '食盆、喂食器和饮水器' },
  'beds & furniture': { es: 'Camas y muebles', zh: '宠物床和家具' },
  'toys & enrichment': { es: 'Juguetes y enriquecimiento', zh: '玩具和益智用品' },
  'walking gear': { es: 'Equipo de paseo', zh: '遛弯装备' },
  'leashes and harnesses': { es: 'Correas y arneses', zh: '牵引绳和胸背' },
  'grooming': { es: 'Cuidado e higiene', zh: '美容清洁' },
  'smart devices': { es: 'Dispositivos inteligentes', zh: '智能设备' },
};

const getCategoryNameFallback = (name: string | undefined, language: Language) => {
  if (language === 'en' || !name) return '';
  return categoryNameFallbacks[name.trim().toLowerCase()]?.[language] || '';
};

export const getLocalizedCategoryValue = (
  category: CategoryPublic,
  language: Language,
  field: 'name' | 'description',
) => category.localizedContent?.[language]?.[field]
  || (field === 'name' ? getCategoryNameFallback(category.name, language) : '')
  || category.localizedContent?.en?.[field]
  || category[field]
  || '';

export const getCategoryPath = (categories: CategoryTreeNode<CategoryPublic>[], categoryId?: number, language?: Language) => {
  if (!categoryId) return '';

  const byId = new Map(categories.map((category) => [category.id, category]));
  const names: string[] = [];
  let current = byId.get(categoryId);

  while (current) {
    names.unshift(language ? getLocalizedCategoryValue(current, language, 'name') : current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return names.join(' / ');
};

export const toTreeOptions = <T extends CategoryPublic>(
  categories: CategoryTreeNode<T>[],
  disabledPredicate?: (category: CategoryTreeNode<T>) => boolean,
  language?: Language,
): CategoryTreeOption[] =>
  categories.map((category) => {
    const label = language ? getLocalizedCategoryValue(category, language, 'name') : category.name;
    return {
      value: category.id,
      label,
      title: label,
      key: category.id,
      disabled: disabledPredicate?.(category),
      children: category.children?.length ? toTreeOptions(category.children, disabledPredicate, language) : undefined,
    };
  });

export const descendantIdSet = (category: CategoryTreeNode<CategoryPublic>): Set<number> => {
  const ids = new Set<number>([category.id]);
  const visit = (nodes: CategoryTreeNode<CategoryPublic>[]) => {
    nodes.forEach((node) => {
      ids.add(node.id);
      visit(node.children || []);
    });
  };

  visit(category.children || []);
  return ids;
};
