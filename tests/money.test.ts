import { describe, expect, it } from 'vitest';
import { calculateNetWorth, debtTotals, paymentProgress, summarizeMonth, toPaisa, validatePayment, totalAvailable } from '../src/lib/money';
import type { Account, Debt, LedgerEntry, Transaction } from '../src/lib/types';

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', account_type: 'cash', opening_balance_paisa: 1_000_000, balance_paisa: 1_200_000 },
  { id: 'wallet', name: 'Wallet', account_type: 'mobile_wallet', opening_balance_paisa: 0, balance_paisa: 100_000 }
];
const ledger: LedgerEntry[] = [
  { id: 'l1', transaction_id: 't1', account_id: 'cash', amount_paisa: 500_000, effective_at: '2026-11-02T12:00:00Z' },
  { id: 'l2', transaction_id: 't2', account_id: 'cash', amount_paisa: -200_000, effective_at: '2026-11-03T12:00:00Z' },
  { id: 'l3', transaction_id: 't3', account_id: 'wallet', amount_paisa: 100_000, effective_at: '2026-11-04T12:00:00Z' },
  { id: 'l4', transaction_id: 't4', account_id: 'cash', amount_paisa: -100_000, effective_at: '2026-11-04T12:00:00Z' },
];
const tx: Transaction[] = [
  { id: 't1', kind: 'income', amount_paisa: 500_000, account_id: 'cash', occurred_at: '2026-11-02T12:00:00Z', description: 'Salary' },
  { id: 't2', kind: 'expense', amount_paisa: 200_000, account_id: 'cash', occurred_at: '2026-11-03T12:00:00Z', description: 'Food' },
  { id: 't3', kind: 'transfer', amount_paisa: 100_000, account_id: 'wallet', occurred_at: '2026-11-04T12:00:00Z', description: 'Transfer in' },
];
const debts: Debt[] = [
  { id: 'd1', contact_id: 'p1', contact_name: 'Rahim', direction: 'they_owe', principal_paisa: 500_000, paid_paisa: 200_000, remaining_paisa: 300_000, opened_at: '2026-11-01', status: 'partial' },
  { id: 'd2', contact_id: 'p2', contact_name: 'Karim', direction: 'i_owe', principal_paisa: 300_000, paid_paisa: 100_000, remaining_paisa: 200_000, opened_at: '2026-11-01', status: 'partial' },
];

describe('Amar Hisab money engine', () => {
  it('converts taka to integer paisa safely', () => {
    expect(toPaisa(100)).toBe(10_000);
    expect(toPaisa(100.25)).toBe(10_025);
    expect(toPaisa(0.1 + 0.2)).toBe(30);
    expect(toPaisa(0.01)).toBe(1);
  });

  it('rejects invalid money values', () => {
    expect(() => toPaisa(Number.NaN)).toThrow();
    expect(() => toPaisa(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => toPaisa(1.005)).toThrow();
    expect(() => toPaisa(0.001)).toThrow();
  });

  it('calculates account balances from ledger entries including transfers', () => {
    expect(totalAvailable(accounts, ledger)).toBe(1_300_000);
  });

  it('counts only normal income and expenses in monthly summaries', () => {
    const summary = summarizeMonth(tx, 2026, 10);
    expect(summary.income).toBe(500_000);
    expect(summary.expenses).toBe(200_000);
    expect(summary.net).toBe(300_000);
  });

  it('separates receivables and payables', () => {
    expect(debtTotals(debts)).toEqual({ receivable: 300_000, payable: 200_000 });
  });

  it('calculates net worth as balances plus receivables minus payables', () => {
    expect(calculateNetWorth(accounts, ledger, debts)).toBe(1_400_000);
  });

  it('calculates payment progress and caps it at 100%', () => {
    expect(paymentProgress(debts[0])).toBe(40);
    expect(paymentProgress({ ...debts[0], paid_paisa: 600_000 })).toBe(100);
  });

  it('rejects zero, negative, fractional-paisa and overpayments', () => {
    expect(() => validatePayment(0, 100)).toThrow();
    expect(() => validatePayment(-1, 100)).toThrow();
    expect(() => validatePayment(101, 100)).toThrow();
    expect(() => validatePayment(50, 100)).not.toThrow();
  });
});
