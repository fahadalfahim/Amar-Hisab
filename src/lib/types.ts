export type Theme = 'light' | 'dark';
export type Language = 'bn' | 'en';
export type TransactionKind = 'income' | 'expense' | 'transfer' | 'loan_received' | 'loan_given' | 'debt_repayment' | 'receivable_collection';
export type DebtDirection = 'i_owe' | 'they_owe';
export type DebtStatus = 'open' | 'partial' | 'settled' | 'overdue';

export interface Account {
  id: string;
  name: string;
  account_type: 'cash' | 'bank' | 'mobile_wallet' | 'other';
  opening_balance_paisa: number;
  balance_paisa: number;
  currency_code?: string;
  archived_at?: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string | null;
  color?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  amount_paisa: number;
  account_id: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
  category_id?: string | null;
  contact_id?: string | null;
  occurred_at: string;
  description: string;
  notes?: string | null;
  account_name?: string;
  category_name?: string;
  contact_name?: string;
}

export interface Debt {
  id: string;
  contact_id: string;
  contact_name: string;
  direction: DebtDirection;
  principal_paisa: number;
  paid_paisa: number;
  remaining_paisa: number;
  opened_at: string;
  due_date?: string | null;
  status: DebtStatus;
  notes?: string | null;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  amount_paisa: number;
  effective_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount_paisa: number;
  paid_at: string;
  note?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface AppData {
  accounts: Account[];
  categories: Category[];
  contacts: Contact[];
  transactions: Transaction[];
  debts: Debt[];
  payments: DebtPayment[];
  ledger: LedgerEntry[];
}
