import { api, ApiError } from './client';
import type {
  ApiAccount,
  ApiCategory,
  ApiPayee,
  ApiTransaction,
  ApiExportLog,
  CreateTransactionRequest,
  CreateAccountRequest,
  CreateCategoryRequest,
  CreatePayeeRequest,
} from './types';

export const accountsService = {
  async getAll(): Promise<ApiAccount[]> {
    return api.get('/accounts');
  },

  async create(data: CreateAccountRequest): Promise<{ id: number }> {
    return api.post('/accounts', data);
  },

  async update(id: number, data: Partial<CreateAccountRequest>): Promise<{ message: string }> {
    return api.put(`/accounts/${id}`, data);
  },

  async delete(id: number): Promise<null> {
    return api.delete(`/accounts/${id}`);
  },
  
  async renameCurrency(oldCode: string, newCode: string): Promise<{ message: string }> {
    return api.post('/accounts/rename-currency', { oldCode, newCode });
  },
};

export const systemService = {
  async backup(): Promise<void> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/system/backup`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Backup failed: ${response.status} ${err.error || ''}`);
    }
    
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `database-backup.db`;
    if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(contentDisposition);
      if (matches != null && matches[1]) { 
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async reset(): Promise<{ message: string }> {
    return api.post('/system/reset', {});
  },

  async restore(file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('database', file);
    
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/system/restore`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Restore failed' }));
        throw new Error(err.error || 'Restore failed');
    }
    
    return response.json();
  },

  async getSettings(): Promise<Record<string, string>> {
    return api.get('/system/settings');
  },

  async updateSetting(key: string, value: string): Promise<{ key: string; value: string }> {
    return api.put(`/system/settings/${key}`, { value });
  },
};

export const categoriesService = {
  async getAll(): Promise<ApiCategory[]> {
    return api.get('/categories');
  },

  async create(data: CreateCategoryRequest): Promise<{ id: number }> {
    return api.post('/categories', data);
  },

  async update(id: number, data: Partial<CreateCategoryRequest>): Promise<{ message: string }> {
    return api.put(`/categories/${id}`, data);
  },

  async delete(id: number): Promise<null> {
    return api.delete(`/categories/${id}`);
  },

  async exportCSV(): Promise<void> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/categories/export`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new ApiError(response.status, error.error || 'Failed to export CSV', error.details);
    }
    
    const blob = await response.blob();
    const csv_content = await blob.text();
    // Backend doesn't send header for category exports
    const count = csv_content.split('\n').filter(l => l.trim()).length;
    const filename = `categories_${new Date().toISOString().split('T')[0]}.csv`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Create log entry
    await exportLogService.createLog({
        filename,
        count: count > 0 ? count : 0,
        csv_content
    }).catch(err => console.error('Failed to log category export', err));
  },

  async importCSV(csvContent: string): Promise<{ message: string; count: number }> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/categories/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csvContent,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new ApiError(response.status, error.error || 'Failed to import CSV', error.details);
    }
    
    return response.json();
  },
};

export const payeesService = {
  async getAll(): Promise<ApiPayee[]> {
    return api.get('/payees');
  },

  async create(data: CreatePayeeRequest): Promise<{ id: number }> {
    return api.post('/payees', data);
  },

  async update(id: number, data: Partial<CreatePayeeRequest>): Promise<{ message: string }> {
    return api.put(`/payees/${id}`, data);
  },

  async delete(id: number): Promise<null> {
    return api.delete(`/payees/${id}`);
  },

  async exportCSV(): Promise<void> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/payees/export`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new ApiError(response.status, error.error || 'Failed to export CSV', error.details);
    }
    
    const blob = await response.blob();
    const csv_content = await blob.text();
    // Backend doesn't send header for payee exports
    const count = csv_content.split('\n').filter(l => l.trim()).length;
    const filename = `payees_${new Date().toISOString().split('T')[0]}.csv`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Create log entry
    await exportLogService.createLog({
        filename,
        count: count > 0 ? count : 0,
        csv_content
    }).catch(err => console.error('Failed to log payee export', err));
  },

  async importCSV(csvContent: string, skipDuplicates?: boolean): Promise<{ message: string; count: number }> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/payees/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData: csvContent, skipDuplicates }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new ApiError(response.status, error.error || 'Failed to import CSV', error.details);
    }
    
    return response.json();
  },

  async checkDuplicates(candidates: { name: string }[]): Promise<any[]> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/payees/import-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates }),
    });
    if (!response.ok) throw new Error('Failed to check duplicates');
    const data = await response.json();
    return data.duplicates;
  },
};

export const transactionsService = {
  async getAll(filters?: {
    accountId?: number;
    from?: string;
    to?: string;
  }): Promise<ApiTransaction[]> {
    const params = new URLSearchParams();
    if (filters?.accountId) params.append('accountId', String(filters.accountId));
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);

    const query = params.toString();
    return api.get(`/transactions${query ? `?${query}` : ''}`);
  },

  async create(data: CreateTransactionRequest): Promise<{ id?: number; message?: string; transferId?: string }> {
    return api.post('/transactions', data);
  },

  async update(
    id: number,
    data: Partial<Omit<CreateTransactionRequest, 'type'>>
  ): Promise<{ message: string }> {
    return api.put(`/transactions/${id}`, data);
  },

  async delete(id: number): Promise<null> {
    return api.delete(`/transactions/${id}`);
  },

  async checkDuplicates(candidates: { date: string; payee: string; amount: number }[], dateFormat?: string): Promise<any[]> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/transactions/import-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates, dateFormat }),
    });
    if (!response.ok) throw new Error('Failed to check duplicates');
    const data = await response.json();
    return data.duplicates;
  },

  async importCSV(csvContent: string, accountId?: number, skipDuplicates?: boolean, dateFormat?: string): Promise<{ message: string; count: number }> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/transactions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvData: csvContent, accountId, skipDuplicates, dateFormat }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new ApiError(response.status, error.error || 'Failed to import CSV', error.details);
    }
    
    return response.json();
  },

  async exportCSV(filters: {
    ids?: number[];
    accountId?: number;
    from?: string;
    to?: string;
    categoryId?: number;
    payee?: string;
    grouped?: boolean;
    dateFormat?: string;
    decimalSeparator?: string;
    filename?: string; // New: suggested filename
  }): Promise<void | Record<number, { name: string; csv: string; count: number }>> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/transactions/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new ApiError(response.status, error.error || 'Failed to export CSV', error.details);
    }

    if (filters.grouped) {
        const data = await response.json();
        return data as Record<number, { name: string; csv: string; count: number }>;
    }

    const blob = await response.blob();
    const csv_content = await blob.text();
    const count = csv_content.split('\n').filter(l => l.trim()).length;
    const finalFilename = filters.filename || `transactions_${new Date().toISOString().split('T')[0]}.csv`;

    // Trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    // Create log entry
    await exportLogService.createLog({
        filename: finalFilename,
        count,
        csv_content,
        transactionIds: filters.ids
    }).catch(err => console.error('Failed to log export', err));
  },
};

export const exportLogService = {
  async getAll(): Promise<ApiExportLog[]> {
    return api.get('/export-log');
  },

  async createLog(data: { filename: string; count: number; csv_content: string; transactionIds?: number[] }): Promise<{ id: number }> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/export-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create log');
    return response.json();
  },

  async downloadLog(id: number, filename?: string): Promise<void> {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${API_BASE}/export-log/${id}/download`);
    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async getPreview(id: number): Promise<string> {
    const res = await api.get<{ content: string }>(`/export-log/${id}/preview`);
    return res.content;
  },
  
  async deleteLog(id: number): Promise<{ success: boolean }> {
    return api.delete(`/export-log/${id}`);
  },

  async clearAllLogs(): Promise<{ success: boolean }> {
    return api.delete('/export-log');
  }
};
