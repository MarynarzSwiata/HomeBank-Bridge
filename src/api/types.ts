// Response types from backend API
export interface ApiAccount {
  id: number;
  name: string;
  currency: string;
  type: 'bank' | 'checking' | 'savings' | 'cash' | 'creditcard' | 'asset' | 'liability';
  closed: number;
  initial_balance: number;
  reconciled_balance: number;
  cleared_balance: number;
  today_balance: number;
  current_balance: number;
}

export interface ApiCategory {
  id: number;
  name: string;
  type: '+' | '-' | ' ';
  parent_id: number | null;
  usage_count?: number;
  total_amount?: number;
  children?: ApiCategory[];
}

export interface ApiPayee {
  id: number;
  name: string;
  default_category_id: number | null;
  category_name?: string;
  default_payment_type: number | null;
  usage_count?: number;
  total_amount?: number;
}

export interface ApiTransaction {
  id: number;
  date: string; // ISO format YYYY-MM-DD
  payee: string;
  amount: number;
  category_id: number | null;
  category_name: string;
  account_id: number;
  account_name: string;
  payment_type: number;
  memo: string;
  transfer_id?: string;
  status: 0 | 1 | 2;
  tags?: string;
  exported: number;
  export_log_id?: number | null;
}

export interface ApiExportLog {
  id: number;
  timestamp: string;
  filename: string;
  count: number;
}

// Request types
export interface CreateTransactionRequest {
  type: 'expense' | 'income' | 'transfer';
  accountId: number;
  amount: number;
  date: string; // ISO format
  payee?: string;
  memo?: string;
  categoryId?: number;
  paymentType?: number;
  targetAccountId?: number; // For transfers
  targetAmount?: number; // For mixed-currency transfers
  status?: 0 | 1 | 2;
  tags?: string;
}

export interface CreateAccountRequest {
  name: string;
  currency: string;
  initialBalance?: number;
  type?: ApiAccount['type'];
  closed?: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  type: '+' | '-' | ' ';
  parentId?: number | null;
}

export interface CreatePayeeRequest {
  name: string;
  defaultCategoryId?: number | null;
  defaultPaymentType?: number | null;
}
