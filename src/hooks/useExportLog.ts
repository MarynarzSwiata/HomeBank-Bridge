import { useState, useCallback } from 'react';
import { exportLogService, ApiError } from '../api';
import { adaptExportLog } from '../api/adapters';
import type { ExportLog } from '../types';

export interface UseExportLogResult {
  exportLogs: ExportLog[];
  isLoading: boolean;
  isDeleting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteLog: (id: number) => Promise<boolean>;
  clearAllLogs: () => Promise<boolean>;
}

export function useExportLog(): UseExportLogResult {
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await exportLogService.getAll();
      setExportLogs(data.map(adaptExportLog));
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to load export logs';
      setError(message);
      throw err; // Propagate for useDataBootstrap
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteLog = useCallback(async (id: number) => {
    try {
      setIsDeleting(true);
      await exportLogService.deleteLog(id);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete log');
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [refresh]);

  const clearAllLogs = useCallback(async () => {
    try {
      setIsDeleting(true);
      await exportLogService.clearAllLogs();
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs');
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [refresh]);

  return {
    exportLogs,
    isLoading,
    isDeleting,
    error,
    refresh,
    deleteLog,
    clearAllLogs,
  };
}
