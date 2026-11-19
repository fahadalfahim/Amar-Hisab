import type { Account, Debt, LedgerEntry, Transaction } from './types';

export const toPaisa = (taka: number): number => {
  if (!Number.isFinite(taka)) throw new Error('Amount must be a valid number');
  // Reject hidden fractions of a poisha instead of silently rounding money.
  const scaled = taka * 100;
  const paisa = Math.round(scaled);
  if (!Number.isSafeInteger(paisa) || Math.abs(paisa) > 9_000_000_000_000) throw new Error('Amount is too large');
  if (Math.abs(scaled - paisa) > 0.000001) throw new Error('Use at most two decimal places');
  return paisa;
};

export const fromPaisa = (paisa: number): number => paisa / 100;

export function formatMoney(paisa: number, language: 'bn' | 'en' = 'bn'): string {
  const value = fromPaisa(paisa);
  return new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en-BD', {
    style: 'currency', currency: 'BDT', maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

export function accountBalance(account: Account, ledger: LedgerEntry[]): number {
  if (Number.isSafeInteger(account.balance_paisa)) return account.balance_paisa;
  return account.opening_balance_paisa + ledger.reduce((total, entry) => {
    return entry.account_id === account.id ? total + entry.amount_paisa : total;
  }, 0);
}

export function totalAvailable(accounts: Account[], ledger: LedgerEntry[]): number {
  return accounts.reduce((sum, account) => sum + accountBalance(account, ledger), 0);
}

export function dhakaYearMonth(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'numeric' }).formatToParts(date);
  return { year: Number(parts.find(p => p.type === 'year')?.value), month: Number(parts.find(p => p.type === 'month')?.value) - 1 };
}

export function summarizeMonth(transactions: Transaction[], year: number, month: number) {
  const monthItems = transactions.filter((tx) => {
    const parts = dhakaYearMonth(new Date(tx.occurred_at));
    return parts.year === year && parts.month === month;
  });
  const income = monthItems.filter((tx) => tx.kind === 'income').reduce((s, tx) => s + tx.amount_paisa, 0);
  const expenses = monthItems.filter((tx) => tx.kind === 'expense').reduce((s, tx) => s + tx.amount_paisa, 0);
  return { income, expenses, net: income - expenses, count: monthItems.length, items: monthItems };
}

export function debtTotals(debts: Debt[]) {
  return debts.reduce((totals, debt) => {
    if (debt.direction === 'i_owe') totals.payable += debt.remaining_paisa;
    else totals.receivable += debt.remaining_paisa;
    return totals;
  }, { payable: 0, receivable: 0 });
}

export function calculateNetWorth(accounts: Account[], ledger: LedgerEntry[], debts: Debt[]): number {
  const balance = totalAvailable(accounts, ledger);
  const { payable, receivable } = debtTotals(debts);
  return balance + receivable - payable;
}

export function paymentProgress(debt: Debt): number {
  if (debt.principal_paisa <= 0) return 0;
  return Math.min(100, Math.max(0, (debt.paid_paisa / debt.principal_paisa) * 100));
}

export function validatePayment(amountPaisa: number, remainingPaisa: number): void {
  if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0) throw new Error('Payment must be a positive amount');
  if (amountPaisa > remainingPaisa) throw new Error('Payment cannot exceed the outstanding balance');
}

export function currentMonthRange(date = new Date()) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
  };
}
