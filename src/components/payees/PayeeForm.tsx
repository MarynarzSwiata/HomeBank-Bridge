import React, { useState, useEffect, useMemo } from "react";
import SearchableSelect from "../shared/SearchableSelect";
import { flattenCategories } from "../../utils/categoryUtils";
import { PAYMENT_OPTIONS } from "../../constants";
import type { Payee, Category } from "../../types";
import { Button, Alert } from "../common";

interface PayeeFormProps {
  isExpanded: boolean;
  onClose: () => void;
  editingPayee: Payee | null;
  onSuccess: () => void;

  // Data props
  categories: Category[];
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
  isSaving: boolean;
  error?: string | null;
  inlineMode?: boolean;
}

export const PayeeForm: React.FC<PayeeFormProps> = ({
  isExpanded,
  onClose,
  editingPayee,
  onSuccess,
  categories,
  createPayee,
  updatePayee,
  isSaving,
  error: hookError,
}) => {
  const [name, setName] = useState("");
  const [mainCategoryId, setMainCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [defaultPaymentType, setDefaultPaymentType] = useState<string>("");

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPayee) {
      setName(editingPayee.name);
      const catId = editingPayee.default_category_id;
      if (catId) {
        // Find category in the entire tree
        const findCat = (cats: Category[]): Category | undefined => {
          for (const c of cats) {
            if (c.id === catId) return c;
            if (c.children) {
              const found = findCat(c.children);
              if (found) return found;
            }
          }
        };

        const cat = findCat(categories);
        if (cat) {
          if (cat.parent_id) {
            setMainCategoryId(String(cat.parent_id));
            setSubCategoryId(String(cat.id));
          } else {
            setMainCategoryId(String(cat.id));
            setSubCategoryId("");
          }
        }
      } else {
        setMainCategoryId("");
        setSubCategoryId("");
      }
      setDefaultPaymentType(
        editingPayee.default_payment_type !== null
          ? String(editingPayee.default_payment_type)
          : ""
      );
    } else {
      setName("");
      setMainCategoryId("");
      setSubCategoryId("");
      setDefaultPaymentType("");
    }
    setLocalError(null);
  }, [editingPayee, isExpanded]);

  // Main category options
  const mainCategoryOptions = useMemo(
    () => categories.map((c) => ({ id: String(c.id), name: c.name })),
    [categories]
  );

  // Subcategory options based on main selection
  const subCategoryOptions = useMemo(() => {
    if (!mainCategoryId) return [];
    const main = categories.find((c) => String(c.id) === mainCategoryId);
    if (!main || !main.children) return [];
    return main.children.map((c) => ({ id: String(c.id), name: c.name }));
  }, [categories, mainCategoryId]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setLocalError("Name is required");
      return;
    }

    try {
      const finalCategoryId = subCategoryId
        ? parseInt(subCategoryId)
        : mainCategoryId
        ? parseInt(mainCategoryId)
        : null;

      const payload = {
        name: name.trim(),
        defaultCategoryId: finalCategoryId,
        defaultPaymentType: defaultPaymentType
          ? parseInt(defaultPaymentType)
          : null,
      };

      let success = false;
      if (editingPayee) {
        success = await updatePayee(editingPayee.id, payload);
      } else {
        const id = await createPayee(payload);
        success = !!id;
      }

      if (success) {
        onSuccess();
        if (!editingPayee) {
          setName("");
          setMainCategoryId("");
          setSubCategoryId("");
          setDefaultPaymentType("");
        }
      }
    } catch (err) {
      console.error(err);
      setLocalError("An unexpected error occurred.");
    }
  };

  const currentError = localError || hookError;

  return (
    <div
      className={`space-y-6 transition-all duration-500 ease-in-out ${
        isExpanded
          ? "opacity-100"
          : "opacity-0 pointer-events-none h-0 p-0 overflow-hidden"
      }`}
    >
      {currentError && (
        <Alert
          variant="error"
          message={currentError}
          onClose={() => setLocalError(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1.5 block">
            Payee Name
          </label>
          <input
            placeholder="e.g. Amazon, Landlord..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl px-8 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none text-white h-[60px] uppercase placeholder:lowercase"
          />
        </div>
        <div>
          <SearchableSelect
            label="Default Main Category"
            options={mainCategoryOptions}
            value={mainCategoryId}
            onChange={(val) => {
              setMainCategoryId(val);
              setSubCategoryId("");
            }}
            placeholder="Select Main Category"
            showAllOption={false}
          />
        </div>
        {mainCategoryId && subCategoryOptions.length > 0 && (
          <div className="animate-in slide-in-from-top-2">
            <SearchableSelect
              label="Default Subcategory"
              options={subCategoryOptions}
              value={subCategoryId}
              onChange={setSubCategoryId}
              placeholder="Select Subcategory"
              showAllOption={false}
            />
          </div>
        )}
        <div>
          <SearchableSelect
            label="Default Payment"
            options={PAYMENT_OPTIONS}
            value={defaultPaymentType}
            onChange={setDefaultPaymentType}
            placeholder="Select Payment"
            showAllOption={false}
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          }
        >
          {editingPayee ? "Commit Update" : "Establish Payee"}
        </Button>
        {editingPayee && (
          <Button
            variant="ghost"
            onClick={() => {
              onSuccess();
              onClose();
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
