import React, { useState, useMemo } from "react";
import { CategoryForm } from "./CategoryForm";
import { flattenCategories } from "../../utils/categoryUtils";
import {
  triggerDownload,
  sanitizeCSVField,
  getExportDateString,
} from "../../utils/exportUtils";
import type { Category, CategoryType } from "../../types";

import { categoriesService } from "../../api/services";
import { ImportModal } from "../shared/ImportModal";
import { Button, ActionBar, Card, ConfirmModal, Alert } from "../common";

interface CategoriesViewProps {
  categories: Category[];
  createCategory: (data: {
    name: string;
    type: CategoryType;
    parentId?: number | null;
  }) => Promise<number | null>;
  updateCategory: (
    id: number,
    data: { name?: string; type?: CategoryType; parentId?: number | null }
  ) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
  isSaving: boolean;
  error: string | null;
  refresh?: () => Promise<void>;
  onExportLogged?: () => Promise<void>;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  createCategory,
  updateCategory,
  deleteCategory,
  isSaving,
  error,
  refresh,
  onExportLogged,
}) => {
  // UI State
  const [isCatFormExpanded, setIsCatFormExpanded] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Search & Sort State
  const [filterText, setFilterText] = useState("");
  const [sortField, setSortField] = useState<"name" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Calculate total usage (direct + children) for each category
  const categoryStats = useMemo(() => {
    const stats = new Map<number, { count: number; amount: number }>();
    const getStats = (c: Category): { count: number; amount: number } => {
      let count = c.usage_count || 0;
      let amount = c.total_amount || 0;
      if (c.children) {
        c.children.forEach((child) => {
          const childStats = getStats(child);
          count += childStats.count;
          amount += childStats.amount;
        });
      }
      stats.set(c.id, { count, amount });
      return { count, amount };
    };
    categories.forEach((c) => getStats(c));
    return stats;
  }, [categories]);

  // Flatten categories for search/sort
  const flatCategories = useMemo(() => {
    const flat = flattenCategories(categories, "");
    const catMap = new Map(flat.map((c) => [c.id, c]));

    return flat.map((c) => {
      let path = c.name;
      let current = c as any;
      while (current.parent_id) {
        const parent = catMap.get(current.parent_id);
        if (!parent) break;
        path = `${parent.name} : ${path}`;
        current = parent;
      }
      return { ...c, fullPath: path };
    });
  }, [categories]);

  // Filtered list (used when searching)
  const filteredResults = useMemo(() => {
    if (!filterText) return [];
    let filtered = flatCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(filterText.toLowerCase()) ||
        c.fullPath.toLowerCase().includes(filterText.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let comp = 0;
      if (sortField === "name") comp = a.name.localeCompare(b.name);
      else comp = a.type.localeCompare(b.type);
      return sortOrder === "asc" ? comp : -comp;
    });
  }, [flatCategories, filterText, sortField, sortOrder]);

  const handleSort = (field: "name" | "type") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Selection Handlers
  const toggleSelection = (id: number) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    setSelectedIds(newIds);
  };

  const toggleAll = () => {
    const currentList = filterText ? filteredResults : flatCategories;
    if (selectedIds.size === currentList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map((c) => c.id)));
    }
  };

  // Export Logic
  const handleExportCSV = async () => {
    try {
      await categoriesService.exportCSV();
      if (onExportLogged) await onExportLogged();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleImport = async (csvContent: string) => {
    const result = await categoriesService.importCSV(csvContent);
    if (result.count >= 0 && refresh) {
      await refresh();
    }
    return result;
  };

  const startEditingCat = (cat: Category | any) => {
    // Find full category object if it was from flat list
    const fullCat = flatCategories.find((c) => c.id === cat.id);
    setEditingCategory(fullCat as any);
    setIsCatFormExpanded(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingCategory(null);
    setIsCatFormExpanded(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.id === -1) {
      setIsBulkDeleting(true);
      for (const id of Array.from(selectedIds)) {
        await deleteCategory(id);
      }
      setSelectedIds(new Set());
      setIsBulkDeleting(false);
      setConfirmDelete(null);
    } else {
      const success = await deleteCategory(confirmDelete.id);
      if (success) {
        setConfirmDelete(null);
      }
    }
  };

  const requestDelete = (cat: Category | any) => {
    setConfirmDelete({ id: cat.id, name: cat.name });
  };

  const requestBulkDelete = () => {
    setConfirmDelete({ id: -1, name: `${selectedIds.size} categories` });
  };

  // Tree Row Component for hierarchy
  const CategoryRow = ({
    cat,
    isChild = false,
  }: {
    cat: Category;
    isChild?: boolean;
    key?: any;
  }) => {
    const isSelected = selectedIds.has(cat.id);
    const stats = categoryStats.get(cat.id) || { count: 0, amount: 0 };
    const usage = stats.count;
    const balance = stats.amount;

    return (
      <div className="space-y-1">
        <div
          className={`group grid grid-cols-12 md:grid-cols-12 gap-4 px-6 md:px-8 py-4 rounded-[2rem] md:rounded-[2.5rem] bg-slate-900/40 border transition-all items-center ${
            isSelected
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/60"
          } ${
            isChild ? "ml-4 md:ml-12 border-l-4 border-l-indigo-500/30" : ""
          }`}
        >
          {/* Combined Header for Mobile / Desktop Col 8 */}
          <div className="col-span-12 md:col-span-8 flex items-center gap-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelection(cat.id)}
              className="w-6 h-6 md:w-5 md:h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 focus:ring-offset-slate-950 transition-all cursor-pointer"
            />
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                cat.type === "+"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              {cat.type}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`text-sm md:text-sm font-black uppercase tracking-tight ${
                  isChild ? "text-slate-300" : "text-white"
                }`}
              >
                {cat.name}
              </span>
              <span
                className={`text-[10px] font-black tracking-widest ${
                  usage > 0 ? "text-indigo-400/80" : "text-slate-600"
                }`}
              >
                ({usage})
              </span>
              {usage > 0 && (
                <span
                  className={`text-[10px] font-black tracking-tight ${
                    balance < 0
                      ? "text-rose-400/80"
                      : balance > 0
                      ? "text-emerald-400/80"
                      : "text-slate-500"
                  }`}
                >
                  {balance.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Only Usage - hidden on mobile as it's now in parentheses */}
          <div className="hidden md:block col-span-2 text-right"></div>

          {/* Actions - Mobile Body / Desktop Col 2 */}
          <div className="col-span-6 md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all transform md:translate-x-1 md:group-hover:translate-x-0">
            <button
              onClick={() => startEditingCat(cat)}
              className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-slate-800 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
            <button
              onClick={() => requestDelete(cat)}
              className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
        {cat.children &&
          cat.children.length > 0 &&
          cat.children.map((sub) => (
            <CategoryRow key={sub.id} cat={sub} isChild={true} />
          ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Error Display */}
      {error && <Alert variant="error" message={error} />}

      {/* Actions & Form Section */}
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-4">
        <ActionBar
          title={
            editingCategory
              ? "Edit Category"
              : isCatFormExpanded
              ? "New Category"
              : "Category Dictionary"
          }
          subtitle={
            editingCategory
              ? `Modifying ${editingCategory.name}`
              : "Organize your financial taxonomy"
          }
          isExpanded={isCatFormExpanded || !!editingCategory}
          onToggle={() => {
            if (editingCategory) resetForm();
            else setIsCatFormExpanded(!isCatFormExpanded);
          }}
          expandLabel="Add Category"
          collapseLabel={editingCategory ? "Cancel Edit" : "Close"}
          actions={
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImportOpen(true)}
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                }
              >
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCSV}
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4H4"
                    />
                  </svg>
                }
              >
                Export
              </Button>
            </div>
          }
          className={
            editingCategory ? "border-indigo-500/50 bg-indigo-950/10" : ""
          }
        />

        {(isCatFormExpanded || editingCategory) && (
          <Card
            variant="default"
            className={
              editingCategory ? "border-indigo-500/50 bg-indigo-950/5" : ""
            }
          >
            <CategoryForm
              isExpanded={true}
              onClose={() => setIsCatFormExpanded(false)}
              editingCategory={editingCategory}
              onSuccess={resetForm}
              categories={categories}
              createCategory={createCategory}
              updateCategory={updateCategory}
              isSaving={isSaving}
              error={error}
            />
          </Card>
        )}
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="categories"
        onImport={handleImport}
      />

      {/* Filters & Stats */}
      <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">
            Search Taxonomy
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-3xl px-8 h-[60px] text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none text-white placeholder:text-slate-600"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl px-8 h-[60px] flex items-center justify-between sm:justify-start gap-4 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Total
              </span>
              <span className="text-sm font-black text-indigo-400">
                {flatCategories.length}
              </span>
            </div>
            <div className="w-[1px] h-8 bg-slate-800"></div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Selected
              </span>
              <span className="text-sm font-black text-white">
                {selectedIds.size}
              </span>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <Button
              variant="danger"
              className="h-[60px] rounded-3xl px-8 w-full sm:w-auto"
              onClick={requestBulkDelete}
            >
              Mass Erase
            </Button>
          )}
        </div>
        <div className="flex lg:hidden gap-3">
          <Button
            variant="ghost"
            className="flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-800"
            onClick={toggleAll}
          >
            {selectedIds.size > 0 ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-3">
        {/* Header (Desktop Only) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30 rounded-3xl border border-slate-800/50">
          <div className="col-span-1 flex items-center justify-center">
            <input
              type="checkbox"
              checked={
                selectedIds.size > 0 &&
                selectedIds.size ===
                  (filterText ? filteredResults : flatCategories).length
              }
              onChange={toggleAll}
            />
          </div>
          <div
            className={`col-span-1 flex items-center gap-2 ${
              filterText ? "cursor-pointer hover:text-white" : ""
            } transition-colors`}
            onClick={() => filterText && handleSort("type")}
          >
            Type
            {filterText && sortField === "type" && (
              <svg
                className={`w-3 h-3 text-indigo-400 ${
                  sortOrder === "desc" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </div>
          <div
            className={`col-span-6 flex items-center gap-2 ${
              filterText ? "cursor-pointer hover:text-white" : ""
            } transition-colors`}
            onClick={() => filterText && handleSort("name")}
          >
            {filterText ? "Search Result" : "Hierarchy"}
            {filterText && sortField === "name" && (
              <svg
                className={`w-3 h-3 text-indigo-400 ${
                  sortOrder === "desc" ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </div>
          <div className="col-span-2 text-right">Sum / Usage</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        {filterText ? (
          // Search Mode - Flat List
          <div className="space-y-3">
            {filteredResults.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem]">
                <p className="text-lg font-black uppercase tracking-widest text-slate-500">
                  Zero matches found
                </p>
              </div>
            ) : (
              filteredResults.map((cat) => {
                const isSelected = selectedIds.has(cat.id);
                const stats = categoryStats.get(cat.id) || {
                  count: 0,
                  amount: 0,
                };
                const usage = stats.count;
                const balance = stats.amount;
                return (
                  <div
                    key={cat.id}
                    className={`group grid grid-cols-12 gap-4 px-6 md:px-8 py-4 rounded-[2rem] md:rounded-[2.5rem] bg-slate-900/40 border transition-all items-center ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/5"
                        : "border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    {/* Checkbox, Icon, Name and Usage */}
                    <div className="col-span-12 md:col-span-10 flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(cat.id)}
                        className="w-6 h-6 md:w-5 md:h-5 rounded-lg border-slate-700"
                      />
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                          cat.type === "+"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {cat.type}
                      </span>
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-black text-white uppercase">
                            {cat.name}
                          </span>
                          <span className="text-[10px] font-black text-indigo-400/80">
                            ({usage})
                          </span>
                          {usage > 0 && (
                            <span
                              className={`text-[10px] font-black ${
                                balance < 0
                                  ? "text-rose-400/80"
                                  : balance > 0
                                  ? "text-emerald-400/80"
                                  : "text-slate-500"
                              }`}
                            >
                              {balance.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest truncate">
                          {cat.fullPath}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-6 md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => startEditingCat(cat)}
                        className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <svg
                          className="w-4 h-4 mx-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            strokeWidth="3"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {categories.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem]">
                <p className="text-lg font-black uppercase tracking-widest text-slate-500">
                  Empty Dictionary
                </p>
              </div>
            ) : (
              categories.map((cat) => <CategoryRow key={cat.id} cat={cat} />)
            )}
          </div>
        )}
      </div>

      {/* Modals outside main containers to avoid transform-induced fixed issues */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title={
          confirmDelete?.id === -1
            ? "Mass Erase Categories?"
            : "Delete Category?"
        }
        message={
          <>
            Are you sure you want to delete{" "}
            <span className="text-white font-bold">{confirmDelete?.name}</span>?
            {confirmDelete?.id === -1
              ? " All associated transaction links for these categories will be removed."
              : " All associated transaction tags and subcategories will be unlinked."}
            This action cannot be undone.
          </>
        }
        confirmLabel={
          confirmDelete?.id === -1 ? "Erase Selected" : "Confirm Erasure"
        }
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        isLoading={isSaving || isBulkDeleting}
        variant="danger"
      />
    </div>
  );
};
