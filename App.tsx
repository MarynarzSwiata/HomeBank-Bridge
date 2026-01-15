import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ApiError, accountsService, systemService } from "./src/api";
import { useAuth } from "./src/hooks/useAuth";
import { AuthScreen } from "./src/components/Auth/AuthScreen";
import type {
  Account,
  Category,
  CategoryType,
  Payee,
  Transaction,
  ExportLog,
} from "./src/types";

import { useDataBootstrap } from "./src/hooks";
import {
  TransactionsView,
  TransactionSaveData,
} from "./src/components/transactions";
import { AccountsView } from "./src/components/accounts/AccountsView";
import { CategoriesView } from "./src/components/categories/CategoriesView";
import { PayeesView } from "./src/components/payees/PayeesView";
import { ExportHistoryView } from "./src/components/export/ExportHistoryView";
import {
  PAYMENT_LEXICON,
  PAYMENT_OPTIONS,
  TRANSACTION_TYPES,
  FLOW_TYPE_OPTIONS,
  DATE_FORMATS,
} from "./src/constants";
import SearchableSelect from "./src/components/shared/SearchableSelect";

const INITIAL_CURRENCIES = ["EUR", "USD", "PLN", "GBP", "CHF", "JPY"];

// --- Types & Interfaces ---
// Local types removed (imported from src/types)

// Constants moved to src/constants.ts

// --- Security Utilities ---
/**
 * Sanitizes a string value for CSV export to prevent formula injection (CSV injection).
 * Prefixes cells starting with dangerous characters with a single quote.
 */
// sanitizeCSVField removed

/**
 * Validates and sanitizes amount input to prevent injection and ensure valid numbers.
 */
// sanitizeAmountInput removed (unused in App)

// --- Helper Utilities ---
const parseDateForComparison = (dateStr: string) => {
  if (dateStr && dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts[0].length === 4) return dateStr;
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr || "";
};

// --- Shared UI Components ---

const AnimatedLogo = () => (
  <div className="relative flex items-center justify-center w-10 h-10 group shrink-0">
    <div className="absolute inset-0 bg-indigo-600 rounded-xl rotate-3 group-hover:rotate-12 transition-transform duration-500 shadow-xl shadow-indigo-500/20"></div>
    <div className="absolute inset-0 bg-slate-900 rounded-xl -rotate-3 group-hover:rotate-0 transition-transform duration-500 border border-indigo-500/30 flex items-center justify-center text-white">
      <div className="flex gap-[1px]">
        <span className="text-[8px] font-black animate-hbb-pulse-1">H</span>
        <span className="text-[8px] font-black text-indigo-400 animate-hbb-pulse-2">
          B
        </span>
        <span className="text-[8px] font-black animate-hbb-pulse-3">B</span>
      </div>
    </div>
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-[2px] bg-indigo-400 rounded-full animate-bridge-glow"></div>
  </div>
);

// SearchableSelect moved to src/components/shared/SearchableSelect.tsx

const App: React.FC = () => {
  // Authentication
  const auth = useAuth();

  const [activeTab, setActiveTab] = useState<
    | "how_to_use"
    | "transactions"
    | "accounts"
    | "categories"
    | "payees"
    | "export_log"
    | "options"
    | "changelog"
  >("how_to_use");

  // Helpers
  const getTodayISO = () => new Date().toISOString().split("T")[0];

  // API Loading & Error States
  const [isSaving, setIsSaving] = useState(false);

  // --- New Hooks Integration ---
  const {
    isBootstrapping,
    bootstrapError,
    refreshAll,
    accounts: accountsHook,
    categories: categoriesHook,
    payees: payeesHook,
    transactions: transactionsHook,
    exportLog: exportLogHook,
  } = useDataBootstrap(auth.isAuthenticated);

  // --- Legacy State (kept for other tabs) ---

  // Currency State - derived from accounts only
  const availableCurrencies = useMemo(() => {
    const accountCurrencies = accountsHook.accounts.map((a) => a.currency);
    return [...new Set(accountCurrencies)].sort();
  }, [accountsHook.accounts]);

  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAnonymized, setIsAnonymized] = useState(true);
  const [isAccountListExpanded, setIsAccountListExpanded] = useState(false);
  const [isTotalValueExpanded, setIsTotalValueExpanded] = useState(false);
  const [isLast30DaysExpanded, setIsLast30DaysExpanded] = useState(false);
  const [dateFormat, setDateFormat] = useState("DD-MM-YYYY");
  const [decimalSeparator, setDecimalSeparator] = useState(",");

  // Options view state
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editCurrencyValue, setEditCurrencyValue] = useState("");
  const [isAddDefaultCurrenciesModalOpen, setIsAddDefaultCurrenciesModalOpen] =
    useState(false);

  // System Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  // Transactions filter state (for navigation from account view)
  const [transactionsAccountFilter, setTransactionsAccountFilter] =
    useState("");
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);

  // App Settings State
  const [appSettings, setAppSettings] = useState<Record<string, string>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Sync state with settings
  useEffect(() => {
    if (appSettings.privacy_mode !== undefined) {
      setIsAnonymized(appSettings.privacy_mode === "true");
    }
    if (appSettings.date_format !== undefined) {
      setDateFormat(appSettings.date_format);
    }
  }, [appSettings.privacy_mode, appSettings.date_format]);

  // Toast State
  const [toasts, setToasts] = useState<
    { id: string; message: string; type: "success" | "error" | "info" }[]
  >([]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  // Legacy form/deletion state removed (moved to View components)

  // --- Helpers ---
  // selectedAccountCurrency removed (legacy state)

  const currencyOptions = useMemo(() => {
    return availableCurrencies.map((c) => ({ id: c, name: c }));
  }, [availableCurrencies]);

  const currencyGroupedLiquidity = useMemo(() => {
    const totals: Record<string, number> = {};
    accountsHook.accounts.forEach((acc) => {
      totals[acc.currency] =
        (totals[acc.currency] || 0) + (acc.current_balance || 0);
    });
    return Object.entries(totals);
  }, [accountsHook.accounts]);

  const last30DaysStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thresholdISO = thirtyDaysAgo.toISOString().split("T")[0];

    const stats: Record<string, { income: number; expense: number }> = {};

    // Account currency mapping
    const accountMap = new Map<number, string>();
    accountsHook.accounts.forEach((a) => accountMap.set(a.id, a.currency));

    transactionsHook.transactions.forEach((t) => {
      const tCompDate = parseDateForComparison(t.date);
      if (tCompDate >= thresholdISO) {
        const cur = accountMap.get(t.account_id) || "???";
        if (!stats[cur]) stats[cur] = { income: 0, expense: 0 };

        if (t.amount > 0) {
          stats[cur].income += t.amount;
        } else if (t.amount < 0) {
          stats[cur].expense += Math.abs(t.amount);
        }
      }
    });

    return Object.entries(stats);
  }, [transactionsHook.transactions, accountsHook.accounts]);

  const formatDateForExport = (isoDate: string) => {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    switch (dateFormat) {
      case "DD-MM-YYYY":
        return `${d}-${m}-${y}`;
      case "MM-DD-YYYY":
        return `${m}-${d}-${y}`;
      case "YYYY-MM-DD":
        return isoDate;
      default:
        return `${d}-${m}-${y}`;
    }
  };

  // Load app settings on bootstrap
  useEffect(() => {
    if (auth.isAuthenticated) {
      setIsLoadingSettings(true);
      systemService
        .getSettings()
        .then((settings) => setAppSettings(settings))
        .catch((err) => console.error("Failed to load settings:", err))
        .finally(() => setIsLoadingSettings(false));
    }
  }, [auth.isAuthenticated]);

  // Toggle registration setting
  const toggleRegistration = useCallback(async () => {
    const newValue =
      appSettings.allow_registration === "true" ? "false" : "true";
    try {
      await systemService.updateSetting("allow_registration", newValue);
      setAppSettings((prev) => ({ ...prev, allow_registration: newValue }));
      showToast(
        newValue === "true" ? "Registration enabled" : "Registration disabled",
        "success"
      );
    } catch (err) {
      showToast("Failed to update setting", "error");
    }
  }, [appSettings.allow_registration, showToast]);

  const toggleAnonymize = useCallback(async () => {
    const newValue = !isAnonymized;
    setIsAnonymized(newValue); // Optimistic update
    try {
      await systemService.updateSetting("privacy_mode", String(newValue));
      setAppSettings((prev) => ({ ...prev, privacy_mode: String(newValue) }));
    } catch (err) {
      console.error("Failed to save privacy setting:", err);
      // Revert on error if needed, but usually minor enough to skip revert
    }
  }, [isAnonymized]);

  const updateDateFormat = useCallback(async (newFormat: string) => {
    setDateFormat(newFormat);
    try {
      await systemService.updateSetting("date_format", newFormat);
      setAppSettings((prev) => ({ ...prev, date_format: newFormat }));
    } catch (err) {
      console.error("Failed to save date format:", err);
    }
  }, []);

  const handleSaveTransaction = useCallback(
    async (data: TransactionSaveData): Promise<boolean> => {
      let result = false;
      if (data.editingId) {
        const success = await transactionsHook.updateTransaction(
          data.editingId,
          {
            accountId: data.accountId,
            amount: data.amount,
            date: data.date,
            payee: data.payee,
            memo: data.memo,
            categoryId: data.categoryId,
            paymentType: data.paymentType,
            targetAccountId: data.targetAccountId,
            targetAmount: data.targetAmount,
          }
        );
        if (success) {
          await Promise.all([
            accountsHook.refresh(),
            categoriesHook.refresh(),
            payeesHook.refresh(),
          ]).catch(() => {});
          showToast("Transaction updated successfully", "success");
        } else {
          showToast(transactionsHook.error || "Failed to update transaction", "error");
        }
        result = success;
      } else {
        const res = await transactionsHook.createTransaction({
          type: data.type,
          accountId: data.accountId,
          amount: data.amount,
          date: data.date,
          payee: data.payee,
          memo: data.memo,
          categoryId: data.categoryId,
          paymentType: data.paymentType,
          targetAccountId: data.targetAccountId,
          targetAmount: data.targetAmount,
        });
        if (res) {
          await Promise.all([
            accountsHook.refresh(),
            categoriesHook.refresh(),
            payeesHook.refresh(),
          ]).catch(() => {});
          showToast("Transaction created successfully", "success");
        } else {
          showToast(transactionsHook.error || "Failed to create transaction", "error");
        }
        result = res !== null;
      }
      return result;
    },
    [transactionsHook, accountsHook, categoriesHook, payeesHook, showToast]
  );

  const handleDeleteTransaction = useCallback(
    async (id: number): Promise<boolean> => {
      const success = await transactionsHook.deleteTransaction(id);
      if (success) {
        await Promise.all([
          accountsHook.refresh(),
          categoriesHook.refresh(),
          payeesHook.refresh(),
        ]).catch(() => {});
        showToast("Transaction deleted successfully", "success");
      } else {
        showToast(transactionsHook.error || "Failed to delete transaction", "error");
      }
      return success;
    },
    [transactionsHook, accountsHook, categoriesHook, payeesHook, showToast]
  );

  const handleCreateAccount = useCallback(async (data: { name: string; currency: string; initialBalance?: number }) => {
    const id = await accountsHook.createAccount(data);
    if (id) {
      showToast(`Account "${data.name}" created successfully`, "success");
    } else {
      showToast(accountsHook.error || "Failed to create account", "error");
    }
    return id;
  }, [accountsHook, showToast]);

  const handleUpdateAccount = useCallback(async (id: number, data: { name?: string; currency?: string; initialBalance?: number }) => {
    const success = await accountsHook.updateAccount(id, data);
    if (success) {
      showToast("Account updated successfully", "success");
    } else {
      showToast(accountsHook.error || "Failed to update account", "error");
    }
    return success;
  }, [accountsHook, showToast]);

  const handleDeleteAccount = useCallback(async (id: number) => {
    const success = await accountsHook.deleteAccount(id);
    if (success) {
      showToast("Account deleted successfully", "success");
    } else {
      showToast(accountsHook.error || "Failed to delete account", "error");
    }
    return success;
  }, [accountsHook, showToast]);

  const handleCreateCategory = useCallback(async (data: { name: string; type: CategoryType; parentId?: number | null }) => {
    const id = await categoriesHook.createCategory(data);
    if (id) {
      showToast(`Category "${data.name}" created successfully`, "success");
    } else {
      showToast(categoriesHook.error || "Failed to create category", "error");
    }
    return id;
  }, [categoriesHook, showToast]);

  const handleUpdateCategory = useCallback(async (id: number, data: { name?: string; type?: CategoryType; parentId?: number | null }) => {
    const success = await categoriesHook.updateCategory(id, data);
    if (success) {
      showToast("Category updated successfully", "success");
    } else {
      showToast(categoriesHook.error || "Failed to update category", "error");
    }
    return success;
  }, [categoriesHook, showToast]);

  const handleDeleteCategory = useCallback(async (id: number) => {
    const success = await categoriesHook.deleteCategory(id);
    if (success) {
      showToast("Category deleted successfully", "success");
    } else {
      showToast(categoriesHook.error || "Failed to delete category", "error");
    }
    return success;
  }, [categoriesHook, showToast]);

  const handleCreatePayee = useCallback(async (data: { name: string; categoryId?: number | null }) => {
    const id = await payeesHook.createPayee(data);
    if (id) {
      showToast(`Payee "${data.name}" created successfully`, "success");
    } else {
      showToast(payeesHook.error || "Failed to create payee", "error");
    }
    return id;
  }, [payeesHook, showToast]);

  const handleUpdatePayee = useCallback(async (id: number, data: { name?: string; categoryId?: number | null }) => {
    const success = await payeesHook.updatePayee(id, data);
    if (success) {
      showToast("Payee updated successfully", "success");
    } else {
      showToast(payeesHook.error || "Failed to update payee", "error");
    }
    return success;
  }, [payeesHook, showToast]);

  const handleDeletePayee = useCallback(async (id: number) => {
    const success = await payeesHook.deletePayee(id);
    if (success) {
      showToast("Payee deleted successfully", "success");
    } else {
      showToast(payeesHook.error || "Failed to delete payee", "error");
    }
    return success;
  }, [payeesHook, showToast]);

  const handleRefreshTransactions = useCallback(async () => {
    await Promise.all([
      transactionsHook.refresh(),
      accountsHook.refresh(),
      categoriesHook.refresh(),
      payeesHook.refresh(),
      exportLogHook.refresh(),
    ]).catch(() => {});
  }, [transactionsHook, accountsHook, categoriesHook, payeesHook, exportLogHook]);

  // Refresh effect removed (handled by useDataBootstrap)

  // flatCategories removed (moved to CategoriesView)

  // --- Logic Handlers ---

  const viewAccountHistory = (accId: number) => {
    // Set filter for TransactionsView instead of fetching filtered data from backend
    setTransactionsAccountFilter(String(accId));
    setActiveTab("transactions");
  };

  const startRenameCurrency = (cur: string) => {
    setEditingCurrency(cur);
    setEditCurrencyValue(cur);
  };

  const applyCurrencyRename = async (oldCur: string, newCur: string) => {
    const cleanNew = newCur.toUpperCase().trim();
    if (!cleanNew || cleanNew === oldCur) {
      setEditingCurrency(null);
      return;
    }

    try {
      setIsSaving(true);
      await accountsService.renameCurrency(oldCur, cleanNew);
      // Refresh data from backend to sync - this will update availableCurrencies via useMemo
      await refreshAll();
      showToast(`Successfully renamed ${oldCur} to ${cleanNew}`, "success");
    } catch (err) {
      console.error("Failed to rename currency:", err);
      showToast("Failed to rename currency. Please check console.", "error");
    } finally {
      setIsSaving(false);
      setEditingCurrency(null);
    }
  };

  const handleBackup = async () => {
    try {
      showToast("Preparing database snapshot...", "info");
      await systemService.backup();
      showToast("Backup successful!", "success");
    } catch (err) {
      showToast("Backup failed: " + err.message, "error");
    }
  };

  const handleReset = async (withBackup: boolean) => {
    if (withBackup) {
      await handleBackup();
    }

    try {
      setIsSaving(true);
      await systemService.reset();
      await refreshAll();
      setIsResetModalOpen(false);
      showToast("System successfully reset to factory defaults.", "success");
    } catch (err) {
      showToast("Reset failed: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;

    try {
      setIsSaving(true);
      await systemService.restore(restoreFile);
      await refreshAll();
      setIsRestoreModalOpen(false);
      setRestoreFile(null);
      showToast("Database restored successfully!", "success");
    } catch (err) {
      showToast("Restore failed: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Logic Handlers for Views moved to components

  // handleDeleteConfirmed removed (moved to View components)

  // --- Reset Forms ---
  // --- Reset Forms ---

  // Legacy form handlers removed (moved to View components)

  // --- Import Logic ---
  // handleFileImport removed (Import logic moved to Views/Phase 7)
  // handleFileImport fully removed

  // executeImport removed

  // --- CSV Downloads ---
  // local triggerDownload removed (imported from utils)

  // Export functions removed (moved to View components) but reDownloadManifest is kept for logs
  // Export functions removed (moved to View components)

  // --- Nav Helpers ---

  // --- Nav Helpers ---
  const NavItem = ({
    id,
    icon,
    label,
  }: {
    id: string;
    icon: string;
    label: string;
  }) => (
    <button
      onClick={() => setActiveTab(id as any)}
      className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
        activeTab === id
          ? "text-indigo-400 scale-110 font-black"
          : "text-slate-500"
      }`}
    >
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          d={icon}
        />
      </svg>
      <span className="text-[9px] font-black uppercase tracking-tighter">
        {label}
      </span>
    </button>
  );

  // parentCategoryOptions logic moved to CategoriesView

  // Auth loading state
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans">
        <div className="text-center space-y-8">
          <div className="flex justify-center scale-150 mb-10">
            <AnimatedLogo />
          </div>
          <h2 className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em] md:tracking-[0.8em] animate-pulse text-indigo-400">
            Checking Authentication...
          </h2>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Auth screen (not authenticated) - block access if not authenticated OR if authStatus is unavailable
  if (!auth.isAuthenticated) {
    // If authStatus is null (backend unavailable), show connection error
    if (!auth.authStatus) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans p-8">
          <div className="text-center space-y-8 max-w-lg">
            <div className="scale-150 mb-8">
              <AnimatedLogo />
            </div>
            <div className="bg-rose-500/10 border-2 border-rose-500/50 rounded-3xl p-8 space-y-4">
              <svg
                className="w-16 h-16 text-rose-500 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-xl font-black uppercase tracking-wide text-rose-400">
                Connection Failed
              </h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                {auth.error || "Unable to connect to authentication server"}
              </p>
            </div>
            <button
              onClick={() => auth.checkAuth()}
              className="mt-6 py-4 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }

    // Normal auth screen with login/register
    return (
      <AuthScreen
        hasUsers={auth.authStatus.hasUsers}
        registrationAllowed={auth.authStatus.registrationAllowed}
        onLogin={auth.login}
        onRegister={auth.register}
        isLoading={auth.isLoading}
        error={auth.error}
        onClearError={auth.clearError}
      />
    );
  }

  if (isBootstrapping)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans">
        <div className="text-center space-y-8">
          <div className="flex justify-center scale-150 mb-10">
            <AnimatedLogo />
          </div>
          <h2 className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em] md:tracking-[0.8em] animate-pulse text-indigo-400">
            Initializing System...
          </h2>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );

  if (bootstrapError)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white font-sans p-8">
        <div className="text-center space-y-8 max-w-lg">
          <div className="flex justify-center scale-150 mb-10">
            <AnimatedLogo />
          </div>
          <div className="bg-rose-500/10 border-2 border-rose-500/50 rounded-3xl p-8 space-y-4">
            <svg
              className="w-16 h-16 text-rose-500 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-black uppercase tracking-wide text-rose-400">
              Connection Failed
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              {bootstrapError}
            </p>
            <div className="pt-4 space-y-2">
              <p className="text-xs text-slate-500">check backend logs</p>
            </div>
            <button
              onClick={() => refreshAll()}
              className="mt-6 py-4 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      <aside
        className={`hidden md:flex flex-col transition-all duration-500 ease-in-out relative overflow-hidden shrink-0 bg-slate-900/40 backdrop-blur-3xl border-slate-800 ${
          isSidebarOpen ? "w-80 p-8 border-r" : "w-0 p-0 border-r-0"
        }`}
      >
        <div className="flex items-center justify-between gap-4 w-64 shrink-0 mb-8">
          <div className="flex items-center gap-4 group cursor-default">
            <AnimatedLogo />
            <h1 className="font-black tracking-[-0.05em] text-lg text-white uppercase truncate">
              HomeBank Bridge
            </h1>
          </div>
          <button
            onClick={() => auth.logout()}
            className="p-3 bg-slate-950/50 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/50 rounded-xl transition-all active:scale-90"
            title="Wyloguj"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-3 bg-slate-950/50 border border-slate-800 text-slate-500 hover:text-white hover:border-indigo-500/50 rounded-xl transition-all active:scale-90"
            title="Collapse Sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>

        {/* Financial Overview Module at the Top */}
        <div className="w-64 space-y-6 shrink-0 mb-8 pb-8 border-b border-slate-800/50">
          <div className="px-6 py-2 flex items-center justify-between group/anon">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Anonymize
            </span>
            <button
              onClick={toggleAnonymize}
              className={`w-11 h-6 rounded-full transition-all relative flex items-center shadow-inner ${
                isAnonymized ? "bg-indigo-600" : "bg-slate-800"
              }`}
            >
              <div
                className={`absolute w-4.5 h-4.5 bg-white rounded-full shadow-lg transition-all duration-300 ease-out ${
                  isAnonymized ? "translate-x-5.5" : "translate-x-1"
                }`}
              ></div>
            </button>
          </div>

          <div className="w-full">
            <button
              onClick={() => setIsTotalValueExpanded(!isTotalValueExpanded)}
              className="w-full px-6 py-2 flex items-center justify-between group/total"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/total:text-slate-300 transition-colors">
                Total Value
              </span>
              <svg
                className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${
                  isTotalValueExpanded ? "rotate-180 text-indigo-400" : ""
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
            </button>
            {isTotalValueExpanded && (
              <div className="mt-2 space-y-2 px-6 animate-in fade-in slide-in-from-top-1 duration-300">
                {currencyGroupedLiquidity.map(([cur, total]) => (
                  <div
                    key={cur}
                    className="flex justify-between items-baseline p-3 bg-slate-950/40 rounded-2xl border border-slate-800/50"
                  >
                    <span className="text-[8px] font-black text-indigo-500 uppercase">
                      {cur}
                    </span>
                    <span className="text-base font-black text-white tracking-tight">
                      {isAnonymized
                        ? "xxxx"
                        : total.toLocaleString("pl-PL", {
                            minimumFractionDigits: 2,
                          })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full">
            <button
              onClick={() => setIsAccountListExpanded(!isAccountListExpanded)}
              className="w-full px-6 py-2 flex items-center justify-between group/acc"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/acc:text-slate-300 transition-colors">
                Current Balances
              </span>
              <svg
                className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${
                  isAccountListExpanded ? "rotate-180 text-indigo-400" : ""
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
            </button>
            {isAccountListExpanded && (
              <div className="mt-2 space-y-1 px-4 animate-in fade-in slide-in-from-top-1 duration-300 max-h-40 overflow-y-auto no-scrollbar">
                {accountsHook.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="px-3 py-2 flex justify-between items-center hover:bg-white/5 rounded-xl transition-all"
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[100px]">
                      {acc.name}
                    </span>
                    <span className="text-[10px] font-black text-slate-200">
                      {isAnonymized
                        ? "xxxx"
                        : (acc.current_balance || 0).toLocaleString("pl-PL", {
                            minimumFractionDigits: 2,
                          })}
                      <span className="ml-1 text-[8px] text-indigo-500 font-bold tracking-tight">
                        {acc.currency}
                      </span>
                    </span>
                  </div>
                ))}
                {accountsHook.accounts.length === 0 && (
                  <p className="px-3 text-[9px] text-slate-600 italic">
                    No accounts
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Last 30 Days Summary Accordion */}
          <div className="w-full">
            <button
              onClick={() => setIsLast30DaysExpanded(!isLast30DaysExpanded)}
              className="w-full px-6 py-2 flex items-center justify-between group/last30"
            >
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/last30:text-slate-300 transition-colors">
                Last 30 Days
              </span>
              <svg
                className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${
                  isLast30DaysExpanded ? "rotate-180 text-indigo-400" : ""
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
            </button>
            {isLast30DaysExpanded && (
              <div className="mt-2 space-y-3 px-6 animate-in fade-in slide-in-from-top-1 duration-300">
                {last30DaysStats.length === 0 ? (
                  <p className="text-[9px] text-slate-600 italic px-2">
                    No data for last 30 days
                  </p>
                ) : (
                  last30DaysStats.map(([cur, s]) => (
                    <div
                      key={cur}
                      className="p-3 bg-slate-950/40 rounded-2xl border border-slate-800/50 space-y-2"
                    >
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-[8px] font-black text-indigo-500 uppercase">
                          {cur}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-500 uppercase tracking-tighter">
                          Income
                        </span>
                        <span className="text-emerald-400">
                          {isAnonymized
                            ? "xxxx"
                            : s.income.toLocaleString("pl-PL", {
                                minimumFractionDigits: 2,
                              })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-slate-500 uppercase tracking-tighter">
                          Expense
                        </span>
                        <span className="text-rose-400">
                          {isAnonymized
                            ? "xxxx"
                            : s.expense.toLocaleString("pl-PL", {
                                minimumFractionDigits: 2,
                              })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-3 w-64 overflow-y-auto no-scrollbar">
          {[
            {
              id: "how_to_use",
              icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              label: "How to use",
            },
            { id: "transactions", icon: "M12 4v16m8-8H4", label: "Entries" },
            {
              id: "accounts",
              icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
              label: "Accounts",
            },
            {
              id: "categories",
              icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
              label: "Taxonomy",
            },
            {
              id: "payees",
              icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m16-10a4 4 0 11-8 0 4 4 0 018 0z",
              label: "Payees",
            },
            {
              id: "export_log",
              icon: "M9 12h6m-6 4h6m2 5",
              label: "Export Logs",
            },
            {
              id: "options",
              icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
              label: "Options",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-5 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30 translate-x-1"
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
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
                  d={tab.icon}
                />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>

        <footer className="w-64 pt-8 mt-8 border-t border-slate-800/50 space-y-4 shrink-0 overflow-hidden transition-all duration-500">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setActiveTab("changelog")}
              className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-400 transition-colors text-left"
            >
              Version 1.0.3
            </button>
            <a
              href="https://github.com/MarynarzSwiata/HomeBank-Bridge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-400 transition-colors group"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
              GitHub Project
            </a>
            <button
              onClick={() => setIsDonateModalOpen(true)}
              className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-400 transition-colors group text-left"
            >
              <svg
                className="w-3.5 h-3.5 text-indigo-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.016.393 5.464 0 5.972 0h10.362c3.567 0 5.166 1.765 4.88 4.417-.168 1.551-.838 3.13-1.927 4.544-1.22 1.587-2.863 2.628-4.75 3.023l-.116.024c-.754.148-1.206.561-1.34 1.23l-1.35 6.757c-.085.424-.455.742-.887.742h-3.955l.82-4.102c.022-.112.12-.193.234-.193h2.32c.321 0 .58-.26.58-.582a.582.582 0 0 0-.012-.117l-.582-2.91a.583.583 0 0 0-.57-.468h-2.32c-.322 0-.58.26-.58.582a.58.58 0 0 0 .012.117l-.82 4.1z" />
              </svg>
              Donate via PayPal
            </button>
            <div className="space-y-0.5 pt-1">
              <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">
                © 2025 HomeBank Bridge contributors
              </p>
              <p className="text-[8px] font-bold text-slate-700 uppercase tracking-tighter">
                Licensed under MIT License
              </p>
            </div>
          </div>
        </footer>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Desktop Sidebar Toggle (Open) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="hidden md:flex absolute top-10 left-10 z-[150] p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 text-indigo-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-2xl active:scale-95 group animate-in fade-in slide-in-from-left-4"
          >
            <svg
              className="w-6 h-6 transition-transform group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        )}



        <header className="md:hidden flex justify-between items-center p-6 border-b border-slate-900 bg-slate-900/80 backdrop-blur-2xl sticky top-0 z-[100]">
          <div className="flex items-center gap-3">
            <AnimatedLogo />
            <div className="flex flex-col gap-0.5">
              <h1 className="font-black text-lg tracking-[-0.05em] uppercase text-white leading-none">
                HomeBank Bridge
              </h1>
              <button
                onClick={() => setActiveTab("changelog")}
                className="text-[9px] font-black uppercase tracking-widest text-indigo-400 self-start hover:text-white transition-colors animate-pulse"
              >
                Version 1.0.3
              </button>
            </div>
          </div>
          <button
            onClick={auth.logout}
            className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all active:scale-95"
            title="Logout"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-14 space-y-16 no-scrollbar pb-32 md:pb-14">
          {activeTab === "changelog" && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-16 max-w-4xl mx-auto py-10">
              <div className="space-y-6 text-center">
                <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter">
                  System Changelog
                </h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
                  Tracking the evolution of HomeBank Bridge.
                </p>
              </div>

              <div className="space-y-12">
                <div className="relative pl-12 border-l-2 border-indigo-500/30">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/40"></div>
                  <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-2xl font-black text-white uppercase italic">
                        Version 1.0.3
                      </h3>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-600/10 px-3 py-1 rounded-full">
                        UX & Persistence
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed font-bold uppercase tracking-widest pb-4 border-b border-slate-800">
                      Notifications, persistent settings, and critical bugfixes.
                    </p>
                    <ul className="space-y-4 text-sm text-slate-300">
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Toast Notifications:
                          </strong>{" "}
                          Visual feedback for every data change, including success confirmations and detailed error reporting.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Persistent State:
                          </strong>{" "}
                          Global settings (Privacy Mode, Date Format) are now saved to the backend, surviving refreshes and re-logins.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Validation Fix:
                          </strong>{" "}
                          Solved a major engine flaw that caused the app to crash during category creation due to strict parent-child validation.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Export Tracking:
                          </strong>{" "}
                          Visual indicators for transactions already included in a manifest log.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="relative pl-12 border-l-2 border-emerald-500/30">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"></div>
                  <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-2xl font-black text-white uppercase italic">
                        Version 1.0.2
                      </h3>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-600/10 px-3 py-1 rounded-full">
                        Security & Stability
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed font-bold uppercase tracking-widest pb-4 border-b border-slate-800">
                      Hardened registration enforcement and resolved IDE configuration issues.
                    </p>
                    <ul className="space-y-4 text-sm text-slate-300">
                      <li className="flex gap-4">
                        <span className="text-emerald-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Registration Shield:
                          </strong>{" "}
                          Strict backend enforcement of registration settings to prevent unauthorized account creation via API.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-emerald-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            TypeScript Guard:
                          </strong>{" "}
                          Resolved project-wide type definition errors for Node and Vite, ensuring a stable development environment.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-emerald-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Dependency Sync:
                          </strong>{" "}
                          Fixed missing package states in both root and backend ecosystems.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="relative pl-12 border-l-2 border-slate-800/50">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-slate-800 shadow-lg shadow-slate-800/40"></div>
                  <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-2xl font-black text-white uppercase italic">
                        Version 1.0.1
                      </h3>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800/40 px-3 py-1 rounded-full">
                        Performance & Stats Update
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed font-bold uppercase tracking-widest pb-4 border-b border-slate-800">
                      Optimized for scale and deeper insights into your
                      taxonomy.
                    </p>
                    <ul className="space-y-4 text-sm text-slate-300">
                      <li className="flex gap-4">
                        <span className="text-slate-500 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Taxonomy Balances:
                          </strong>{" "}
                          Real-time balance calculations for all categories,
                          with recursive summing for hierarchical parents.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-slate-500 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Import Engine XL:
                          </strong>{" "}
                          Fixed 500 errors and payload limits; optimized
                          duplicate detection with batch processing for massive
                          CSV files.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="relative pl-12 border-l-2 border-indigo-600/30">
                  <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-indigo-600 shadow-lg shadow-indigo-600/40"></div>
                  <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-2xl font-black text-white uppercase italic">
                        Version 1.0.0
                      </h3>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-600/10 px-3 py-1 rounded-full">
                        Initial Stable
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed font-bold uppercase tracking-widest pb-4 border-b border-slate-800">
                      The birth of the Bridge. A modern toolkit for minimalist
                      financial logging.
                    </p>
                    <ul className="space-y-4 text-sm text-slate-300">
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Smart Manifest:
                          </strong>{" "}
                          Intelligent payee prediction system based on
                          historical records.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Vault Management:
                          </strong>{" "}
                          Real-time liquidity tracking across multiple bank
                          accounts and currencies.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Taxonomy Leveling:
                          </strong>{" "}
                          Hierarchical category structures with parent/child
                          support.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">
                            Dual-Record Transfers:
                          </strong>{" "}
                          Linked atomic operations between accounts.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">Export Engine:</strong>{" "}
                          Native HomeBank CSV compatibility with transaction
                          bundling.
                        </span>
                      </li>
                      <li className="flex gap-4">
                        <span className="text-indigo-400 font-black">★</span>
                        <span>
                          <strong className="text-white">SQLite Core:</strong>{" "}
                          In-browser high-performance relational database.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setActiveTab("how_to_use")}
                  className="px-10 py-5 bg-slate-800 text-slate-300 hover:text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all"
                >
                  Return to Documentation
                </button>
              </div>
            </div>
          )}

          {activeTab === "how_to_use" && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-16 max-w-5xl mx-auto py-10">
              <div className="space-y-6 text-center">
                <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter">
                  Documentation & Guide
                </h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm max-w-2xl mx-auto">
                  Welcome to HomeBank Bridge. This tool is designed to bridge
                  the gap between your daily logging and the powerful HomeBank
                  analysis suite. Now featuring a fully responsive mobile-first
                  design.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                  <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase italic">
                    Smart Logging & Mobile
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    The{" "}
                    <span className="text-indigo-400 font-bold">Entries</span>{" "}
                    tab is your main hub, now fully optimized for mobile devices
                    with <span className="text-white font-bold">Card View</span>{" "}
                    and a bottom navigation bar.
                    <br />
                    <br />
                    <span className="text-white font-bold block mb-1">
                      Smart Autofill:
                    </span>{" "}
                    When you type a payee, the system predicts the category,
                    account, and payment mode based on your history.
                    <br />
                    <br />
                    <span className="text-white font-bold block mb-1">
                      Atomic Transfers:
                    </span>{" "}
                    Transfers automatically create two linked records
                    (Debit/Credit) that stay synchronized as one logical
                    operation.
                  </p>
                </div>

                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                  <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-400">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase italic">
                    Export & Archives
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Generate{" "}
                    <span className="text-emerald-400 font-bold">
                      HomeBank-compliant CSVs
                    </span>{" "}
                    perfectly formatted with custom date formats and separators
                    defined in Options.
                    <br />
                    <br />
                    <span className="text-white font-bold block mb-1">
                      Export Logs:
                    </span>{" "}
                    Every export is archived in the{" "}
                    <span className="text-emerald-400 font-bold">
                      Export Logs
                    </span>{" "}
                    tab. You can view past manifests or re-download them anytime
                    without re-generating data. The system automatically groups
                    multi-account exports into structured zipped bundles.
                  </p>
                </div>

                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                  <div className="w-12 h-12 bg-amber-600/10 rounded-2xl flex items-center justify-center text-amber-400">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase italic">
                    Vault & Advanced Import
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Manage multi-currency{" "}
                    <span className="text-amber-400 font-bold">Accounts</span>{" "}
                    and hierarchical Taxonomy. Real-time liquidity calculation
                    keeps you informed.
                    <br />
                    <br />
                    <span className="text-white font-bold block mb-1">
                      Smart CSV Import:
                    </span>{" "}
                    The Import Wizard features intelligent duplicate detection
                    (Date + Payee + Amount) and advanced header filtering. It
                    handles multiple date formats and automatically skips
                    existing records to prevent data pollution.
                  </p>
                </div>

                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
                  <div className="w-12 h-12 bg-rose-600/10 rounded-2xl flex items-center justify-center text-rose-400">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase italic">
                    Security & System
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Secured by a{" "}
                    <span className="text-rose-400 font-bold">
                      Single-Admin
                    </span>{" "}
                    system with encrypted sessions. Use the{" "}
                    <span className="text-white font-bold">Anonymize</span>{" "}
                    toggle in the sidebar to hide sensitive numbers in public.
                    <br />
                    <br />
                    <span className="text-white font-bold block mb-1">
                      System Options:
                    </span>{" "}
                    Access the Options tab to perform full database backups,
                    factory resets, or manage User Registration settings. The
                    system is container-ready for secure self-hosted deployment.
                  </p>
                </div>
              </div>

              {/* Mobile-only Links (Desktop has sidebar) */}
              <div className="md:hidden space-y-4 pt-4 border-t border-slate-800/50">
                <a
                  href="https://github.com/MarynarzSwiata/HomeBank-Bridge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-400 hover:bg-slate-800 transition-all active:scale-95 group"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  GitHub Project
                </a>
                <button
                  onClick={() => setIsDonateModalOpen(true)}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-400 hover:bg-slate-800 transition-all active:scale-95 group"
                >
                  <svg
                    className="w-4 h-4 text-indigo-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.016.393 5.464 0 5.972 0h10.362c3.567 0 5.166 1.765 4.88 4.417-.168 1.551-.838 3.13-1.927 4.544-1.22 1.587-2.863 2.628-4.75 3.023l-.116.024c-.754.148-1.206.561-1.34 1.23l-1.35 6.757c-.085.424-.455.742-.887.742h-3.955l.82-4.102c.022-.112.12-.193.234-.193h2.32c.321 0 .58-.26.58-.582a.582.582 0 0 0-.012-.117l-.582-2.91a.583.583 0 0 0-.57-.468h-2.32c-.322 0-.58.26-.58.582a.58.58 0 0 0 .012.117l-.82 4.1z" />
                  </svg>
                  Donate via PayPal
                </button>
              </div>

              <div className="bg-indigo-600/10 p-12 rounded-[4rem] border-2 border-indigo-500/20 text-center space-y-6">
                <p className="text-indigo-400 font-black uppercase tracking-widest text-xs">
                  Ready to start?
                </p>
                <button
                  onClick={() => setActiveTab("transactions")}
                  className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl shadow-indigo-600/40 hover:scale-105 transition-all active:scale-95"
                >
                  Go to Manifest
                </button>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              {isBootstrapping ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm font-bold">
                    Loading Transactions...
                  </p>
                </div>
              ) : bootstrapError &&
                transactionsHook.transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-red-500"
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
                  </div>
                  <p className="text-red-400 text-sm font-bold text-center max-w-md">
                    {bootstrapError}
                  </p>
                  <button
                    onClick={refreshAll}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : (
                <div className="relative z-20 max-w-7xl mx-auto pb-20 px-6">
                  <TransactionsView
                    transactions={transactionsHook.transactions}
                    accounts={accountsHook.accounts} // Using hook data for accurate latest state
                    categories={categoriesHook.categories}
                    payees={payeesHook.payees}
                    isLoading={transactionsHook.isLoading}
                    isSaving={transactionsHook.isSaving}
                    error={transactionsHook.error || bootstrapError}
                    dateFormat={dateFormat}
                    decimalSeparator={decimalSeparator}
                    isAnonymized={isAnonymized}
                    initialAccountFilter={transactionsAccountFilter}
                    onClearAccountFilter={() =>
                      setTransactionsAccountFilter("")
                    }
                    onSaveTransaction={handleSaveTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onRefresh={handleRefreshTransactions}
                    onClearError={() => {}} // Error cleared automatically on actions
                    onToggleAnonymize={toggleAnonymize}
                    onCategoryCreate={async (name, parentId) => {
                      return handleCreateCategory({
                        name,
                        type: "-",
                        parentId,
                      });
                    }}
                    onExportLogged={handleRefreshTransactions}
                  />

                  {/* Import Button (Temporary location until ImportView is refactored) */}
                </div>
              )}
            </div>
          )}

          {activeTab === "accounts" && (
            <AccountsView
              accounts={accountsHook.accounts}
              createAccount={handleCreateAccount}
              updateAccount={handleUpdateAccount}
              deleteAccount={handleDeleteAccount}
              isSaving={accountsHook.isSaving}
              error={accountsHook.error}
              isAnonymized={isAnonymized}
              viewAccountHistory={viewAccountHistory}
              currencies={availableCurrencies}
              dateFormat={dateFormat}
              decimalSeparator={decimalSeparator}
              onExportLogged={handleRefreshTransactions}
              onToggleAnonymize={toggleAnonymize}
            />
          )}

          {activeTab === "categories" && (
            <CategoriesView
              categories={categoriesHook.categories}
              createCategory={handleCreateCategory}
              updateCategory={handleUpdateCategory}
              deleteCategory={handleDeleteCategory}
              isSaving={categoriesHook.isSaving}
              error={categoriesHook.error}
              refresh={categoriesHook.refresh}
              onExportLogged={handleRefreshTransactions}
            />
          )}

          {activeTab === "payees" && (
            <PayeesView
              payees={payeesHook.payees}
              categories={categoriesHook.categories}
              createPayee={handleCreatePayee}
              updatePayee={handleUpdatePayee}
              deletePayee={handleDeletePayee}
              isSaving={payeesHook.isSaving}
              error={payeesHook.error}
              onRefresh={refreshAll}
              isAnonymized={isAnonymized}
              onToggleAnonymize={toggleAnonymize}
              onExportLogged={handleRefreshTransactions}
            />
          )}

          {/* ... Rest of the file content (export_log, options) ... */}
          {activeTab === "export_log" && (
            <ExportHistoryView exportLogHook={exportLogHook} />
          )}

          {activeTab === "options" && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-16 max-w-5xl mx-auto py-10">
              <div className="space-y-6 text-center">
                <h2 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter">
                  System Options
                </h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
                  Control center for application data and global preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Data Backup & Snapshots */}
                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-8 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase italic">
                      Database Management
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Download a complete replica of your application database
                      or restore from a previously saved snapshot. Snapshots are
                      named{" "}
                      <span className="text-indigo-400 font-bold">
                        database-data
                      </span>
                      .
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleBackup}
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] shadow-2xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
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
                          d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download data.db
                    </button>
                    <button
                      onClick={() => setIsRestoreModalOpen(true)}
                      className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
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
                          d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                        />
                      </svg>
                      Restore snapshot
                    </button>
                  </div>
                </div>

                {/* Localization Settings */}
                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-8 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase italic">
                      Localization & Formats
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Customize output formats for compatibility with your
                      regional settings or specific HomeBank import
                      requirements.
                    </p>

                    <div className="space-y-6">
                      <SearchableSelect
                        label="CSV Date Format"
                        placeholder="Select Date Format"
                        value={dateFormat}
                        onChange={updateDateFormat}
                        options={DATE_FORMATS.map((fmt) => ({
                          id: fmt.id,
                          name: fmt.name,
                        }))}
                        searchable={false}
                      />
                      <p className="text-[8px] text-slate-600 font-bold italic px-2 -mt-4">
                        Example Output: {formatDateForExport(getTodayISO())}
                      </p>

                      <SearchableSelect
                        label="CSV Decimal Separator"
                        placeholder="Select Separator"
                        value={decimalSeparator}
                        onChange={setDecimalSeparator}
                        options={[
                          { id: ",", name: 'Comma: "," (default)' },
                          { id: ".", name: 'Dot: "."' },
                        ]}
                        searchable={false}
                      />
                      <p className="text-[8px] text-slate-600 font-bold italic px-2 -mt-4">
                        Example Amount:{" "}
                        {(1234.56).toFixed(2).replace(".", decimalSeparator)}
                      </p>

                      <div className="flex justify-between items-center py-4 px-5 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <div className="space-y-1">
                          <span className="text-xs font-black text-white uppercase">
                            Privacy Mode (Anonymize)
                          </span>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {isAnonymized
                              ? "Hide sensitive financial values"
                              : "Show all financial values"}
                          </p>
                        </div>
                        <button
                          onClick={toggleAnonymize}
                          disabled={isLoadingSettings}
                          className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                            isAnonymized ? "bg-indigo-600" : "bg-slate-700"
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ${
                              isAnonymized ? "left-7" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Currency Management */}
                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-8 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase italic">
                      Currency Lexicon
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Manage available currency codes. Renaming an active code
                      will update all associated accounts globally.
                    </p>

                    <div className="max-h-48 overflow-y-auto no-scrollbar">
                      <table className="w-full">
                        <thead>
                          <tr className="text-[9px] font-black uppercase text-slate-500 border-b border-slate-800">
                            <th className="text-left py-2 px-2">Code</th>
                            <th className="text-left py-2 px-2">Accounts</th>
                            <th className="text-right py-2 px-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableCurrencies.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-8 text-center">
                                <p className="text-slate-500 text-sm">
                                  No currencies yet.
                                </p>
                                <p className="text-slate-600 text-xs mt-1">
                                  Create an account to add currencies.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            availableCurrencies.map((cur) => {
                              const accountCount = accountsHook.accounts.filter(
                                (a) => a.currency === cur
                              ).length;
                              const isEditing = editingCurrency === cur;

                              return (
                                <tr
                                  key={cur}
                                  className="border-b border-slate-800/50 hover:bg-slate-800/30"
                                >
                                  <td className="py-2 px-2">
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        value={editCurrencyValue}
                                        onChange={(e) =>
                                          setEditCurrencyValue(
                                            e.target.value.toUpperCase()
                                          )
                                        }
                                        onBlur={() =>
                                          applyCurrencyRename(
                                            cur,
                                            editCurrencyValue
                                          )
                                        }
                                        onKeyDown={(e) =>
                                          e.key === "Enter" &&
                                          applyCurrencyRename(
                                            cur,
                                            editCurrencyValue
                                          )
                                        }
                                        className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-black uppercase outline-none w-16"
                                      />
                                    ) : (
                                      <span className="text-[11px] font-black text-white uppercase">
                                        {cur}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    <span className="text-[9px] font-bold text-emerald-500 uppercase">
                                      {accountCount}{" "}
                                      {accountCount === 1
                                        ? "account"
                                        : "accounts"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                    {!isEditing && (
                                      <button
                                        onClick={() => startRenameCurrency(cur)}
                                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase"
                                      >
                                        Rename
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* System Diagnostics */}
                <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-8">
                  <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-400">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase italic">
                    Environment Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase">
                        Engine
                      </span>
                      <span className="text-[10px] font-black text-white uppercase">
                        REST API + SQLite
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase">
                        Records
                      </span>
                      <span className="text-[10px] font-black text-white uppercase">
                        {transactionsHook.transactions.length} Transactions
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-800">
                      <span className="text-[10px] font-black text-slate-500 uppercase">
                        Last Export
                      </span>
                      <span className="text-[10px] font-black text-white uppercase">
                        {exportLogHook.exportLogs[0]?.timestamp
                          ? new Date(
                              exportLogHook.exportLogs[0].timestamp
                            ).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Export Management Removed (Distributed to Views) */}

                {/* User Management (Admin only) */}
                {auth.user?.isAdmin && (
                  <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-8">
                    <div className="space-y-6">
                      <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-400">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-black text-white uppercase italic">
                        User Management
                      </h3>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Control user registration settings. When enabled, new
                        users can create accounts via the login screen.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-4 px-5 bg-slate-800/50 rounded-2xl border border-slate-700">
                        <div className="space-y-1">
                          <span className="text-xs font-black text-white uppercase">
                            Allow Registration
                          </span>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {appSettings.allow_registration === "true"
                              ? "New users can create accounts"
                              : "Registration is disabled"}
                          </p>
                        </div>
                        <button
                          onClick={toggleRegistration}
                          disabled={isLoadingSettings}
                          className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                            appSettings.allow_registration === "true"
                              ? "bg-purple-600"
                              : "bg-slate-700"
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ${
                              appSettings.allow_registration === "true"
                                ? "left-7"
                                : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reset System */}
                <div className="bg-rose-950/10 p-10 rounded-[3rem] border border-rose-500/20 space-y-8">
                  <div className="w-12 h-12 bg-rose-600/10 rounded-2xl flex items-center justify-center text-rose-500">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-rose-500 uppercase italic">
                    Danger Zone
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    This instance is connected to a persistent SQLite backend.
                    All changes are synchronized in real-time. This action will
                    permanently delete all your records.
                  </p>
                  <button
                    onClick={() => setIsResetModalOpen(true)}
                    className="w-full py-5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all active:scale-95"
                  >
                    Hard Reset Environment
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <nav className="md:hidden flex justify-around px-2 py-4 bg-slate-900/90 backdrop-blur-3xl border-t border-slate-800 fixed bottom-0 left-0 right-0 z-[100]">
          <NavItem
            id="how_to_use"
            icon="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            label="Guide"
          />
          <NavItem id="transactions" icon="M12 4v16m8-8H4" label="Log" />
          <NavItem
            id="accounts"
            icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            label="Vault"
          />
          <NavItem
            id="categories"
            icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            label="Taxonomy"
          />
          <NavItem
            id="payees"
            icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m16-10a4 4 0 11-8 0 4 4 0 018 0z"
            label="Entities"
          />
          <NavItem id="export_log" icon="M9 12h6m-6 4h6m2 5" label="Archives" />
          <NavItem
            id="options"
            icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            label="Opt"
          />
        </nav>

        {/* Modals removed (Import/Delete/Export handlers moved to Views) */}

        {/* --- System Modals --- */}

        {/* Reset Confirmation Modal */}
        {isResetModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-slate-900 border-2 border-rose-500/30 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl space-y-8">
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic">
                  Hard Reset?
                </h3>
                <p className="text-slate-400 text-sm">
                  This action is irreversible! All transactions, accounts, and
                  categories will be permanently deleted from the backend
                  database.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleReset(true)}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  Backup & Reset (Recommended)
                </button>
                <button
                  onClick={() => handleReset(false)}
                  className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-rose-600/20 active:scale-95 transition-all"
                >
                  Confirm Full Wipe
                </button>
                <button
                  onClick={() => setIsResetModalOpen(false)}
                  className="w-full py-5 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Confirmation Modal */}
        {isRestoreModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl space-y-8">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic">
                  Restore System?
                </h3>
                <p className="text-slate-400 text-sm">
                  Uploading a database file will completely replace your current
                  system state. Make sure you have a backup of your current
                  work.
                </p>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <input
                    type="file"
                    accept=".db"
                    onChange={(e) =>
                      setRestoreFile(e.target.files?.[0] || null)
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="bg-slate-950/50 border-2 border-dashed border-slate-700 group-hover:border-indigo-500 transition-colors p-6 rounded-2xl text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {restoreFile
                        ? restoreFile.name
                        : "Choose .db file to restore"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    disabled={!restoreFile || isSaving}
                    onClick={handleRestore}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 ${
                      !restoreFile || isSaving
                        ? "bg-slate-800 text-slate-600 grayscale cursor-not-allowed"
                        : "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20"
                    }`}
                  >
                    {isSaving ? "Restoring..." : "Restore Now"}
                  </button>
                  <button
                    onClick={() => {
                      setIsRestoreModalOpen(false);
                      setRestoreFile(null);
                    }}
                    className="w-full py-5 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Donate Modal */}
        {isDonateModalOpen && (
          <div
            className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={() => setIsDonateModalOpen(false)}
          >
            <div
              className="bg-slate-900 border-2 border-indigo-500/30 rounded-[3rem] p-10 max-w-md w-full shadow-2xl space-y-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsDonateModalOpen(false)}
                className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 mx-auto">
                  <svg
                    className="w-8 h-8"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.016.393 5.464 0 5.972 0h10.362c3.567 0 5.166 1.765 4.88 4.417-.168 1.551-.838 3.13-1.927 4.544-1.22 1.587-2.863 2.628-4.75 3.023l-.116.024c-.754.148-1.206.561-1.34 1.23l-1.35 6.757c-.085.424-.455.742-.887.742h-3.955l.82-4.102c.022-.112.12-.193.234-.193h2.32c.321 0 .58-.26.58-.582a.582.582 0 0 0-.012-.117l-.582-2.91a.583.583 0 0 0-.57-.468h-2.32c-.322 0-.58.26-.58.582a.58.58 0 0 0 .012.117l-.82 4.1z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-black text-white uppercase italic">
                  Support the Bridge
                </h3>
                <p className="text-slate-400 text-sm">
                  Scan the QR code below to donate via PayPal. Your support
                  helps keep the bridge strong!
                </p>
              </div>

              <div className="bg-white p-4 rounded-3xl mx-auto w-fit shadow-inner">
                <img
                  src="/donate-qr.png"
                  alt="Donate QR Code"
                  className="w-48 h-48 object-contain"
                />
              </div>

              <div className="text-center space-y-1">
                <a
                  href="https://paypal.me/newbes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest"
                >
                  paypal.me/newbes
                </a>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  Thank You!
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification System */}
      <div className="fixed bottom-28 md:bottom-10 md:right-10 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 z-[2000] flex flex-col gap-3 px-6 md:px-0 max-w-[90vw] md:max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-2xl border backdrop-blur-3xl animate-toast-in flex items-center gap-4 md:gap-5 pointer-events-auto ${
              toast.type === "success"
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                : toast.type === "error"
                ? "bg-rose-950/40 border-rose-500/30 text-rose-400"
                : "bg-indigo-950/40 border-indigo-500/30 text-indigo-400"
            }`}
          >
            <div
              className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-500/10"
                  : toast.type === "error"
                  ? "bg-rose-500/10"
                  : "bg-indigo-500/10"
              }`}
            >
              {toast.type === "success" ? (
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : toast.type === "error" ? (
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] leading-relaxed">
              {toast.message}
            </p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastIn { from { opacity: 0; transform: translateX(50px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        .animate-toast-in { animation: toastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes hbb-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } }
        .animate-hbb-pulse-1 { animation: hbb-pulse 2s infinite ease-in-out; }
        .animate-hbb-pulse-2 { animation: hbb-pulse 2s infinite ease-in-out 0.3s; }
        .animate-hbb-pulse-3 { animation: hbb-pulse 2s infinite ease-in-out 0.6s; }
        @keyframes bridge-glow { 0%, 100% { opacity: 0.2; width: 4px; } 50% { opacity: 1; width: 12px; } }
        .animate-bridge-glow { animation: bridge-glow 3s infinite ease-in-out; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input, select { background-color: rgba(2, 6, 23, 0.8); }
        option { background-color: #0f172a; color: #fff; }
        .color-scheme-dark { color-scheme: dark; }
      `}</style>
    </div>
  );
};

export default App;
