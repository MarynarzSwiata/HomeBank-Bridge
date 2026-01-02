import type { Category, CategoryType } from '../types';

export interface FlatCategory {
  id: number;
  name: string;
  type: CategoryType;
  level: number;
  parent_id: number | null;
  usage_count?: number;
}

/**
 * Flattens a category tree into a list for dropdowns and traversal.
 * @param categories The category tree
 * @param prefix The indentation prefix string
 * @returns A flat list of categories with indentation included in the name
 */
export const flattenCategories = (
  categories: Category[], 
  prefix: string = " » "
): FlatCategory[] => {
  const result: FlatCategory[] = [];

  const traverse = (cats: Category[], currentPrefix: string, level: number) => {
    cats.forEach((c) => {
      result.push({
        id: c.id,
        name: currentPrefix + c.name,
        type: c.type,
        level: level,
        parent_id: c.parent_id,
        usage_count: c.usage_count
      });
      if (c.children && c.children.length > 0) {
        traverse(c.children, currentPrefix + prefix, level + 1);
      }
    });
  };

  traverse(categories, "", 0);
  return result;
};
