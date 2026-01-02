import React, { useState, useEffect, useMemo } from 'react';
import { flattenCategories } from '../../utils/categoryUtils';
import SearchableSelect from '../shared/SearchableSelect';
import type { Category, CategoryType } from '../../types';
import { 
  Button, 
  Alert 
} from '../common';

interface CategoryFormProps {
  isExpanded: boolean;
  onClose: () => void;
  editingCategory: Category | null;
  onSuccess: () => void;
  
  // Data/Actions from Hook
  categories: Category[];
  createCategory: (data: { name: string; type: CategoryType; parentId?: number | null }) => Promise<number | null>;
  updateCategory: (id: number, data: { name?: string; type?: CategoryType; parentId?: number | null }) => Promise<boolean>;
  isSaving: boolean;
  error?: string | null;
}

const FLOW_TYPE_OPTIONS = [
  { id: "-", name: "Expense (-)" },
  { id: "+", name: "Income (+)" },
];

export const CategoryForm: React.FC<CategoryFormProps> = ({
  isExpanded,
  onClose,
  editingCategory,
  onSuccess,
  categories,
  createCategory,
  updateCategory,
  isSaving,
  error: hookError
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('-');
  const [parentId, setParentId] = useState<string>('');
  
  // Local error state
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setType(editingCategory.type);
      setParentId(editingCategory.parent_id ? String(editingCategory.parent_id) : '');
    } else {
      setName('');
      setType('-');
      setParentId('');
    }
    setLocalError(null);
  }, [editingCategory, isExpanded]);

  const flatCategories = useMemo(() => {
    return flattenCategories(categories);
  }, [categories]);

  const parentCategoryOptions = useMemo(() => {
    return flatCategories
      .filter(c => !editingCategory || c.id !== editingCategory.id)
      .map(c => ({
        id: String(c.id),
        name: c.name
      }));
  }, [flatCategories, editingCategory]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setLocalError("Name is required");
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        type: type as CategoryType,
        parentId: parentId ? parseInt(parentId) : null
      };

      let success = false;
      if (editingCategory) {
        success = await updateCategory(editingCategory.id, payload);
      } else {
        const id = await createCategory(payload);
        success = !!id;
      }

      if (success) {
        onSuccess();
        if (!editingCategory) {
            // Reset if creating new
            setName('');
            setParentId('');
        }
      }
    } catch (err) {
      console.error(err);
      setLocalError("An unexpected error occurred.");
    }
  };

  const currentError = localError || hookError;

  return (
    <div className={`space-y-6 transition-all duration-500 ease-in-out ${isExpanded ? "opacity-100" : "opacity-0 pointer-events-none h-0 p-0 overflow-hidden"}`}>
         {currentError && (
             <Alert variant="error" message={currentError} onClose={() => setLocalError(null)} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1.5 block">
                Category Name
            </label>
            <input
                placeholder="e.g. Groceries, Hobby..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl px-8 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none text-white h-[60px] uppercase placeholder:lowercase"
            />
            </div>
            {/* Swapped Parent and Flow Type */}
            <div>
            <SearchableSelect
                label="Parent Category"
                options={parentCategoryOptions}
                value={parentId}
                onChange={setParentId}
                placeholder="Select Parent"
                showAllOption={true}
                allLabel="(None - Main Level)"
                searchable={true}
            />
            </div>
            <div>
            <SearchableSelect
                label="Flow Type"
                options={FLOW_TYPE_OPTIONS}
                value={type}
                onChange={setType}
                placeholder="Select Flow"
                searchable={false}
            />
            </div>
        </div>
        <div className="flex gap-4">
            <Button
                onClick={handleSubmit}
                disabled={!name}
                isLoading={isSaving}
                className="flex-1"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
            >
                {editingCategory ? "Commit Update" : "Forge Category"}
            </Button>
            {editingCategory && (
                <Button
                    variant="ghost"
                    onClick={() => {
                        onSuccess(); // Exit edit mode
                        onClose();   // Collapse
                    }}
                    disabled={isSaving}
                >
                    Cancel
                </Button>
            )}
        </div>
    </div>
  );
};
