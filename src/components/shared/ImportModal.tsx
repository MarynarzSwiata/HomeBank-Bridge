import React, { useState, useRef, useEffect } from "react";
import type { Account } from "../../types";
import { transactionsService, payeesService } from "../../api/services";
import { Button, Alert, Spinner } from "../common";
import SearchableSelect from "./SearchableSelect";

type ImportType = "transactions" | "categories" | "payees";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ImportType;
  onImport: (
    csvContent: string,
    accountId?: number,
    skipDuplicates?: boolean,
    dateFormat?: string
  ) => Promise<{ count: number; message: string }>;
  accounts?: Account[];
  dateFormat?: string;
}

interface ImportPreviewData {
  rows: any[];
  filename: string;
  rawContent: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  type,
  onImport,
  accounts,
  dateFormat,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Advanced Import State
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPreview(null);
      setError(null);
      setSuccessMsg(null);
      setSelectedAccountId(
        accounts && accounts.length > 0 ? accounts[0].id : null
      );
      setDuplicates([]);
      setIgnoreDuplicates(false);
    }
  }, [isOpen, accounts]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      parseCSV(text, file.name);
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const parseCSV = async (text: string, filename: string) => {
    try {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      let rows: any[] = [];

      if (type === "categories") {
        rows = lines
          .filter((l) => /^[12];/.test(l))
          .map((l) => {
            const [lvl, t, name] = l.split(";").map((s) => s.trim());
            return { level: parseInt(lvl), type: t, name };
          });
      } else if (type === "transactions") {
        const candidates: any[] = [];
        rows = lines
          .filter((l) => {
            const low = l.toLowerCase();
            return (
              !low.startsWith("date") &&
              !low.startsWith("data") &&
              !low.startsWith("trans")
            );
          })
          .map((l) => {
            const parts = l.split(";");
            if (parts.length < 6) return null;
            const [date, payType, num, payee, memo, amount, catName] =
              parts.map((s) => s.trim());
            const amountVal = parseFloat(amount.replace(",", "."));
            candidates.push({ date, payee, amount: amountVal });
            return { date, payType, payee, memo, amount, catName };
          })
          .filter(Boolean);

        // Check duplicates if transactions
        if (candidates.length > 0) {
          setIsCheckingDuplicates(true);
          try {
            const dups = await transactionsService.checkDuplicates(candidates);
            setDuplicates(dups);
          } catch (e) {
            console.error("Duplicate check failed", e);
          } finally {
            setIsCheckingDuplicates(false);
          }
        }
      } else if (type === "payees") {
        const candidates: any[] = [];
        rows = lines
          .filter((l) => {
            const low = l.toLowerCase();
            return (
              !low.startsWith("payee") &&
              !low.startsWith("name") &&
              !low.startsWith("kontrahent")
            );
          })
          .map((l) => {
            const parts = l.split(";");
            if (parts.length < 2) return null;
            const [name, catName, payModeName] = parts.map((s) => s.trim());
            candidates.push({ name });
            return { name, catName, payModeName };
          })
          .filter(Boolean);

        // Check duplicates if payees
        if (candidates.length > 0) {
          setIsCheckingDuplicates(true);
          try {
            const dups = await payeesService.checkDuplicates(candidates);
            setDuplicates(dups);
          } catch (e) {
            console.error("Duplicate check failed", e);
          } finally {
            setIsCheckingDuplicates(false);
          }
        }
      }

      if (rows.length === 0) {
        setError("No valid rows found in CSV.");
        return;
      }

      setPreview({ rows, filename, rawContent: text });
    } catch (err) {
      setError("Failed to parse CSV file.");
      console.error(err);
    }
  };

  const executeImport = async () => {
    if (!preview?.rawContent) return;
    if (type === "transactions" && !selectedAccountId) {
      setError("Please select a target account.");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const result = await onImport(
        preview.rawContent,
        selectedAccountId || undefined,
        !ignoreDuplicates,
        dateFormat
      );
      setSuccessMsg(`Successfully imported ${result.count} items.`);
      setPreview(null);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const visibleRows =
    preview?.rows.filter((row) => {
      if (ignoreDuplicates) return true;
      if (type === "transactions") {
        return !duplicates.some(
          (d) =>
            d.date === row.date &&
            d.payee === row.payee &&
            Math.abs(parseFloat(row.amount.replace(",", ".")) - d.amount) <
              0.001
        );
      }
      if (type === "payees") {
        return !duplicates.some((d) => d.name === row.name);
      }
      return true;
    }) || [];

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-2 md:p-4 pt-[2vh] md:pt-[5vh] backdrop-blur-md bg-slate-950/80 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[92vh] md:max-h-[85vh] flex flex-col space-y-4 md:space-y-6 relative overflow-hidden">
        <div className="flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
              Import {type}
            </h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              CSV Format
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 md:p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-all"
          >
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <Alert
            variant="error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {successMsg && <Alert variant="success" message={successMsg} />}

        {!preview ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl p-8 md:p-12 gap-4 hover:border-indigo-500/50 transition-colors bg-slate-950/50 min-h-[300px]">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              icon={
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
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              }
            >
              Select CSV File
            </Button>
            <p className="text-slate-500 text-[10px] text-center max-w-xs uppercase font-bold tracking-wider">
              Select a CSV file formatted for {type}.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 md:gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 bg-slate-800/30 p-4 rounded-2xl border border-slate-800/50">
              {type === "transactions" && (
                <div className="space-y-1.5 overflow-visible">
                  <SearchableSelect
                    label="Target Account"
                    placeholder="Select Account..."
                    value={selectedAccountId ? String(selectedAccountId) : ""}
                    onChange={(val) => setSelectedAccountId(parseInt(val))}
                    options={
                      accounts?.map((acc) => ({
                        id: String(acc.id),
                        name: `${acc.name} (${acc.currency})`,
                      })) || []
                    }
                    className="z-50"
                  />
                </div>
              )}
              <div
                className={`space-y-1.5 ${
                  type !== "transactions" ? "md:col-span-2" : ""
                }`}
              >
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Duplicate Check
                </label>
                {isCheckingDuplicates ? (
                  <div className="text-[10px] md:text-xs text-indigo-400 font-bold flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="animate-pulse">Checking records...</span>
                  </div>
                ) : duplicates.length > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] md:text-xs text-rose-400 font-bold uppercase">
                      {duplicates.length} Found
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={ignoreDuplicates}
                        onChange={(e) => setIgnoreDuplicates(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[9px] font-black text-slate-400 group-hover:text-white transition-colors uppercase tracking-tight">
                        Import anyway?
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="text-[10px] md:text-xs text-emerald-400 font-bold uppercase">
                    No duplicates detected
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Preview: {visibleRows.length} items
              </span>
              <button
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-[10px] text-slate-500 hover:text-white underline font-bold uppercase"
              >
                Change File
              </button>
            </div>

            {/* Mobile-only warning */}
            <div className="md:hidden px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
              <svg
                className="w-4 h-4 text-amber-500 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-[9px] font-bold text-amber-200/70 uppercase leading-snug">
                Preview mode. Consider a larger screen for full details.
              </p>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950 no-scrollbar relative min-h-[120px]">
              <table className="w-full text-left text-[10px] md:text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-500 font-black uppercase tracking-wider z-10 shadow-sm">
                  <tr className="divide-x divide-slate-800/30">
                    {type === "categories" && (
                      <>
                        <th className="p-2 md:p-3 w-12 text-center">Lvl</th>
                        <th className="p-2 md:p-3 w-12 text-center">T</th>
                        <th className="p-2 md:p-3">Name</th>
                      </>
                    )}
                    {type === "transactions" && (
                      <>
                        <th className="p-2 md:p-3 w-20 md:w-28">Date</th>
                        <th className="p-2 md:p-3">Payee</th>
                        <th className="p-2 md:p-3 w-16 md:w-24 text-right">
                          Amt
                        </th>
                        <th className="p-2 md:p-3 hidden sm:table-cell">Cat</th>
                      </>
                    )}
                    {type === "payees" && (
                      <>
                        <th className="p-2 md:p-3">Name</th>
                        <th className="p-2 md:p-3">Cat</th>
                        <th className="p-2 md:p-3 hidden sm:table-cell">
                          Mode
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {visibleRows.slice(0, 100).map((row, i) => {
                    let isDup = false;
                    if (type === "transactions") {
                      isDup = duplicates.some(
                        (d) =>
                          d.date === row.date &&
                          d.payee === row.payee &&
                          Math.abs(
                            parseFloat(row.amount.replace(",", ".")) - d.amount
                          ) < 0.001
                      );
                    } else if (type === "payees") {
                      isDup = duplicates.some((d) => d.name === row.name);
                    }
                    return (
                      <tr
                        key={i}
                        className={`hover:bg-slate-800/50 divide-x divide-slate-800/30 ${
                          isDup ? "bg-rose-500/5" : ""
                        }`}
                      >
                        {type === "categories" && (
                          <>
                            <td className="p-2 md:p-3 text-center">
                              {row.level}
                            </td>
                            <td className="p-2 md:p-3 text-indigo-400 font-bold text-center">
                              {row.type}
                            </td>
                            <td className="p-2 md:p-3 truncate">{row.name}</td>
                          </>
                        )}
                        {type === "transactions" && (
                          <>
                            <td className="p-2 md:p-3 opacity-70 flex items-center gap-2 truncate">
                              {isDup && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"
                                  title="Duplicate Found"
                                ></span>
                              )}
                              {row.date}
                            </td>
                            <td className="p-2 md:p-3 font-bold truncate">
                              {row.payee}
                            </td>
                            <td
                              className={`p-2 md:p-3 font-bold text-right ${
                                parseFloat(row.amount?.replace(",", ".") || 0) >
                                0
                                  ? "text-emerald-400"
                                  : "text-slate-300"
                              } truncate`}
                            >
                              {row.amount}
                            </td>
                            <td className="p-2 md:p-3 opacity-70 truncate hidden sm:table-cell">
                              {row.catName}
                            </td>
                          </>
                        )}
                        {type === "payees" && (
                          <>
                            <td className="p-2 md:p-3 font-bold truncate">
                              {row.name}
                            </td>
                            <td className="p-2 md:p-3 opacity-70 truncate">
                              {row.catName}
                            </td>
                            <td className="p-2 md:p-3 opacity-70 truncate hidden sm:table-cell">
                              {row.payModeName}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleRows.length > 100 && (
                <div className="p-3 text-center text-xs text-slate-500 italic border-t border-slate-800 uppercase font-black tracking-widest">
                  ... {visibleRows.length - 100} more ...
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1 shrink-0">
              <Button
                variant="primary"
                onClick={executeImport}
                isLoading={isImporting}
                disabled={
                  (type === "transactions" && !selectedAccountId) ||
                  (type === "transactions" &&
                    duplicates.length > 0 &&
                    !ignoreDuplicates &&
                    visibleRows.length === 0)
                }
                className="flex-1 h-12 md:h-10 text-[10px] md:text-sm"
              >
                Commit & Import
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  onClose();
                }}
                disabled={isImporting}
                className="h-12 md:h-10 text-[10px] md:text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
