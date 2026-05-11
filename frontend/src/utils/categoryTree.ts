import type { Category } from '../types';
import type { Language } from '../i18n';

export interface CategoryTreeOption {
  value: number;
  label: string;
  title: string;
  key: number;
  disabled?: boolean;
  children?: CategoryTreeOption[];
}

export const buildCategoryTree = (categories: Category[]): Category[] => {
  const nodeMap = new Map<number, Category>();
  const roots: Category[] = [];

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

  const sortTree = (nodes: Category[]) => {
    nodes.sort((left, right) => left.id - right.id);
    nodes.forEach((node) => sortTree(node.children || []));
  };

  sortTree(roots);
  return roots;
};

export const flattenCategoryTree = (categories: Category[]): Category[] => {
  const result: Category[] = [];
  const visit = (nodes: Category[]) => {
    nodes.forEach((node) => {
      result.push(node);
      visit(node.children || []);
    });
  };

  visit(categories);
  return result;
};

export const getLocalizedCategoryValue = (
  category: Category,
  language: Language,
  field: 'name' | 'description',
) => category.localizedContent?.[language]?.[field]
  || category.localizedContent?.en?.[field]
  || category[field]
  || '';

export const getCategoryPath = (categories: Category[], categoryId?: number, language?: Language) => {
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

export const toTreeOptions = (
  categories: Category[],
  disabledPredicate?: (category: Category) => boolean,
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

export const descendantIdSet = (category: Category): Set<number> => {
  const ids = new Set<number>([category.id]);
  const visit = (nodes: Category[]) => {
    nodes.forEach((node) => {
      ids.add(node.id);
      visit(node.children || []);
    });
  };

  visit(category.children || []);
  return ids;
};
