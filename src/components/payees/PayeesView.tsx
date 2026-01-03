import React, { useState, useMemo, useCallback } from "react";
import { PayeeForm } from "./PayeeForm";
import {
  triggerDownload,
  sanitizeCSVField,
  getExportDateString,
} from "../../utils/exportUtils";
import { PAYMENT_LEXICON } from "../../constants";
import type { Payee, Category } from "../../types";
import { payeesService } from "../../api/services";
import { ImportModal } from "../shared/ImportModal";
import { Button, ActionBar, Card, ConfirmModal, Alert } from "../common";

interface PayeesViewProps {
  payees: Payee[];
  categories: Category[]; // Needed for Form
  createPayee: (data: {
    name: string;
    defaultCategoryId?: number | null;
    defaultPaymentType?: number | null;
  }) => Promise<number | null>;
  updatePayee: (
    id: number,
    data: {
      name?: string;
      defaultCategoryId?: number | null;
      defaultPaymentType?: number | null;
    }
  ) => Promise<boolean>;
  deletePayee: (id: number) => Promise<boolean>;
  isSaving: boolean;
  error: string | null;
  onRefresh: () => void;
  onExportLogged?: () => Promise<void>;
  isAnonymized: boolean;
  onToggleAnonymize: () => void;
}

type SortField = "name" | "category" | "amount" | "usage";
type SortOrder = "asc" | "desc";

export const PayeesView: React.FC<PayeesViewProps> = ({
  payees,
  categories,
  createPayee,
  updatePayee,
  deletePayee,
  isSaving,
  error,
  onRefresh,
  onExportLogged,
  isAnonymized,
  onToggleAnonymize,
}) => {
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Filter & Selection state
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [itemsToShow, setItemsToShow] = useState(25);

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    const traverse = (cats: Category[], path = "") => {
      cats.forEach((c) => {
        const fullPath = path ? `${path}:${c.name}` : c.name;
        map.set(c.id, fullPath);
        if (c.children) traverse(c.children, fullPath);
      });
    };
    traverse(categories);
    return map;
  }, [categories]);

  // Derived list
  const filteredPayees = useMemo(() => {
    let result = payees.filter((p) => {
      const catPath = p.default_category_id
        ? categoryMap.get(p.default_category_id)
        : "";
      return (
        p.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (catPath && catPath.toLowerCase().includes(filterSearch.toLowerCase()))
      );
    });

    // Apply Sorting
    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "name":
          valA = a.name;
          valB = b.name;
          break;
        case "category":
          valA = a.default_category_id
            ? categoryMap.get(a.default_category_id) || ""
            : "";
          valB = b.default_category_id
            ? categoryMap.get(b.default_category_id) || ""
            : "";
          break;
        case "amount":
          valA = a.total_amount || 0;
          valB = b.total_amount || 0;
          break;
        case "usage":
          valA = a.count || 0;
          valB = b.count || 0;
          break;
        default:
          valA = a.name;
          valB = b.name;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [payees, filterSearch, categoryMap, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortableHeader = ({
    field,
    label,
    colSpan,
  }: {
    field: SortField;
    label: string;
    colSpan: string;
  }) => (
    <div
      className={`${colSpan} flex items-center justify-center gap-1 cursor-pointer hover:text-white transition-colors group px-2`}
      onClick={() => handleSort(field)}
    >
      {label}
      <span
        className={`transition-opacity ${
          sortField === field
            ? "opacity-100 text-indigo-400"
            : "opacity-0 group-hover:opacity-50"
        }`}
      >
        {sortField === field && sortOrder === "asc" ? (
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M5 15l7-7 7 7"
            />
          </svg>
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </span>
    </div>
  );

  const handleExportCSV = async () => {
    try {
      await payeesService.exportCSV();
      if (onExportLogged) await onExportLogged();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleImport = async (
    csvContent: string,
    _accountId?: number,
    skipDuplicates?: boolean
  ) => {
    const result = await payeesService.importCSV(csvContent, skipDuplicates);
    if (result.count >= 0) {
      onRefresh();
    }
    return result;
  };

  const startEditing = (payee: Payee) => {
    setEditingPayee(payee);
    setIsFormExpanded(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingPayee(null);
    setIsFormExpanded(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.id === -1) {
      // Bulk delete
      setIsBulkDeleting(true);
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await deletePayee(id);
      }
      setSelectedIds(new Set());
      setConfirmDelete(null);
      setIsBulkDeleting(false);
      onRefresh();
    } else {
      const success = await deletePayee(confirmDelete.id);
      if (success) {
        setConfirmDelete(null);
        onRefresh();
      }
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const currentSlice = filteredPayees.slice(0, itemsToShow);
    if (currentSlice.every((p) => selectedIds.has(p.id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentSlice.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentSlice.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 max-w-5xl mx-auto">
      {/* Error Display */}
      {error && <Alert variant="error" message={error} />}

      {/* Actions & Form Section */}
      <div className="space-y-4">
        <ActionBar
          title={
            editingPayee
              ? "Edit Payee"
              : isFormExpanded
              ? "New Payee"
              : "Entity Management"
          }
          subtitle={
            editingPayee
              ? `Modifying ${editingPayee.name}`
              : "Manage your frequent payees"
          }
          isExpanded={isFormExpanded || !!editingPayee}
          onToggle={() => {
            if (editingPayee) resetForm();
            else setIsFormExpanded(!isFormExpanded);
          }}
          expandLabel="Add Payee"
          collapseLabel={editingPayee ? "Cancel Edit" : "Close"}
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
            editingPayee ? "border-indigo-500/50 bg-indigo-950/10" : ""
          }
        />

        {(isFormExpanded || editingPayee) && (
          <Card
            variant="default"
            className={
              editingPayee ? "border-indigo-500/50 bg-indigo-950/5" : ""
            }
          >
            <PayeeForm
              isExpanded={true}
              onClose={() => setIsFormExpanded(false)}
              editingPayee={editingPayee}
              onSuccess={resetForm}
              categories={categories}
              createPayee={createPayee}
              updatePayee={updatePayee}
              isSaving={isSaving}
              error={error}
              inlineMode={true}
            />
          </Card>
        )}
      </div>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="payees"
        onImport={handleImport}
      />

      {/* Global Filter Bar */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
        <div className="relative group">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-2">
            Refine Dictionary
          </label>
          <div className="relative">
            <input
              placeholder="Search by name or category..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none text-white h-[60px] transition-all"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 px-4 pb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
            Total: <span className="text-slate-400">{payees.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            Viewing:{" "}
            <span className="text-slate-400">{filteredPayees.length}</span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-indigo-400">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
              Selected: <span className="font-black">{selectedIds.size}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleAnonymize}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                isAnonymized
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
              title={isAnonymized ? "Reveal Values" : "Hide Values"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isAnonymized ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                  />
                ) : (
                  <>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </>
                )}
              </svg>
              <span className="font-black text-[10px] hidden sm:inline">
                {isAnonymized ? "HIDDEN" : "VISIBLE"}
              </span>
            </button>

            <button
              onClick={toggleAll}
              className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95"
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
                  strokeWidth="2.5"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <span className="font-black text-[10px]">SELECT ALL</span>
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              setConfirmDelete({ id: -1, name: `${selectedIds.size} entities` })
            }
            className="h-12 md:h-10 px-6 rounded-xl animate-in fade-in zoom-in-95 duration-300 w-full md:w-auto"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            }
          >
            Delete Selected
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Table Header (Desktop Only) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30 rounded-3xl border border-slate-800/50">
          <div className="col-span-1 flex items-center justify-center">
            <input
              type="checkbox"
              checked={
                filteredPayees.length > 0 &&
                filteredPayees
                  .slice(0, itemsToShow)
                  .every((p) => selectedIds.has(p.id))
              }
              onChange={toggleAll}
              className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900 transition-all cursor-pointer"
            />
          </div>
          <SortableHeader
            field="name"
            label="Payee Name"
            colSpan="col-span-3 !justify-start"
          />
          <SortableHeader
            field="category"
            label="Default Category"
            colSpan="col-span-2"
          />
          <div className="col-span-2 text-center">Payout Method</div>
          <SortableHeader
            field="amount"
            label="Total Spent"
            colSpan="col-span-1 font-black text-indigo-400/80"
          />
          <SortableHeader field="usage" label="Usage" colSpan="col-span-1" />
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* List */}
        {filteredPayees.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem]">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-slate-600"
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
            <p className="text-lg font-black uppercase tracking-widest text-slate-500">
              No Entities Found
            </p>
            <p className="text-xs font-bold text-slate-700 uppercase mt-2">
              Try refining your search terms
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPayees.slice(0, itemsToShow).map((payee) => {
              const isSelected = selectedIds.has(payee.id);
              const catPath = payee.default_category_id
                ? categoryMap.get(payee.default_category_id)
                : null;

              return (
                <div
                  key={payee.id}
                  className={`group grid grid-cols-12 gap-4 px-5 md:px-8 py-4 md:py-6 rounded-[2rem] md:rounded-[2.5rem] bg-slate-900/40 border transition-all items-center ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/20"
                      : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40"
                  }`}
                >
                  {/* Selection Checkbox (Col 1) */}
                  <div className="hidden md:flex col-span-1 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(payee.id)}
                      className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900 transition-all cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Payee Name & Mobile UI (Col 3) */}
                  <div className="col-span-12 md:col-span-3 flex items-center gap-4 min-w-0">
                    <div className="md:hidden">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(payee.id)}
                        className="w-6 h-6 rounded-lg border-slate-700 bg-slate-800"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-100 uppercase tracking-tight truncate">
                          {payee.name}
                        </span>
                        <span className="text-[10px] font-black text-slate-600 shrink-0">
                          ({payee.count || 0})
                        </span>
                      </div>
                      {/* Mobile subline */}
                      <div className="md:hidden flex flex-wrap gap-x-2 gap-y-1 mt-1">
                        {catPath && (
                          <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10">
                            {catPath.split(":").pop()}
                          </span>
                        )}
                        {payee.default_payment_type !== null && (
                          <span className="text-[9px] font-black uppercase text-slate-500">
                            {PAYMENT_LEXICON[payee.default_payment_type]?.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category (Col 2) */}
                  <div className="hidden md:flex col-span-2 flex-col items-center justify-center min-w-0">
                    {catPath ? (
                      <div className="flex flex-col gap-0.5 items-center">
                        {catPath.split(":").map((part, i, arr) => (
                          <span
                            key={i}
                            className={`text-[9px] font-black uppercase tracking-widest truncate max-w-full ${
                              i === arr.length - 1
                                ? "text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-md border border-indigo-500/10"
                                : "text-slate-600"
                            }`}
                          >
                            {part}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-700 text-[10px] font-black">
                        -
                      </span>
                    )}
                  </div>

                  {/* Payout Method (Col 2) */}
                  <div className="hidden md:flex col-span-2 items-center justify-center text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">
                    {payee.default_payment_type !== null ? (
                      PAYMENT_LEXICON[payee.default_payment_type]?.name
                    ) : (
                      <span className="text-slate-700">-</span>
                    )}
                  </div>

                  {/* Total Spent (Col 1) */}
                  <div
                    className={`hidden md:flex col-span-1 items-center justify-center text-xs font-black tracking-tight ${
                      (payee.total_amount || 0) < 0
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {isAnonymized
                      ? "XXXX"
                      : typeof payee.total_amount === "number"
                      ? payee.total_amount.toFixed(2)
                      : "0.00"}
                  </div>

                  {/* Usage (Col 1) */}
                  <div className="hidden md:flex col-span-1 items-center justify-center text-[10px] font-black text-slate-500">
                    {payee.count || 0}
                  </div>

                  {/* Actions (Col 2) */}
                  <div className="col-span-12 md:col-span-2 flex justify-end items-center gap-2">
                    <div className="md:hidden mr-auto flex flex-col items-start">
                      <div
                        className={`text-sm font-black ${
                          (payee.total_amount || 0) < 0
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {isAnonymized
                          ? "XXXX"
                          : (payee.total_amount || 0).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => startEditing(payee)}
                      className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center"
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
                          strokeWidth="2.5"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDelete({ id: payee.id, name: payee.name })
                      }
                      className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
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
                          strokeWidth="2.5"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredPayees.length > itemsToShow && (
              <div className="flex justify-center pt-8">
                <Button
                  variant="ghost"
                  onClick={() => setItemsToShow((prev) => prev + 25)}
                  className="w-full h-16 rounded-[2rem] border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5"
                >
                  Load more payees ({filteredPayees.length - itemsToShow}{" "}
                  remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title={confirmDelete?.id === -1 ? `Mass Deletion?` : `Delete Entity?`}
        message={
          <>
            Are you sure you want to delete{" "}
            <span className="text-white font-bold">{confirmDelete?.name}</span>?
            {confirmDelete?.id === -1
              ? "This action is permanent and will remove them from the dictionary."
              : "This action is permanent and will remove them from the dictionary."}
          </>
        }
        confirmLabel={
          confirmDelete?.id === -1
            ? `Burn ${selectedIds.size} Records`
            : "Confirm Erasure"
        }
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        isLoading={isSaving || isBulkDeleting}
        variant="danger"
      />
    </div>
  );
};
