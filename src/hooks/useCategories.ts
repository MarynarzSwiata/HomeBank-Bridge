import { useState, useCallback } from 'react';
import { categoriesService, ApiError } from '../api';
import { adaptCategory } from '../api/adapters';
import type { Category, CategoryType } from '../types';

interface UseCategoriesResult {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  refresh: () => Promise<void>;
  createCategory: (data: { name: string; type: CategoryType; parentId?: number | null }) => Promise<number | null>;
  updateCategory: (id: number, data: { name?: string; type?: CategoryType; parentId?: number | null }) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await categoriesService.getAll();
      setCategories(data.map(adaptCategory));
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      throw err; // Propagate for useDataBootstrap
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (data: { name: string; type: CategoryType; parentId?: number | null }): Promise<number | null> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      const result = await categoriesService.create(data);
      await refresh().catch(() => {});
      return result.id;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to create category';
      setError(message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const updateCategory = useCallback(async (id: number, data: { name?: string; type?: CategoryType; parentId?: number | null }): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await categoriesService.update(id, data);
      await refresh().catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to update category';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const deleteCategory = useCallback(async (id: number): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await categoriesService.delete(id);
      await refresh().catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to delete category';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  return {
    categories,
    isLoading,
    error,
    isSaving,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
