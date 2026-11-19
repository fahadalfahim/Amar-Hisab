import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Account, AppData, Debt, DebtDirection, Language, Theme, Transaction } from '../lib/types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { toPaisa, validatePayment } from '../lib/money';
import { parseDhakaInput } from '../lib/dates';

type AddTransactionInput = { kind: 'income' | 'expense'; amount: number; accountId: string; categoryId: string; date: string; description: string; notes?: string; idempotencyKey: string };
type AddDebtInput = { contactName: string; phone?: string; direction: DebtDirection; amount: number; accountId: string; date: string; dueDate?: string; notes?: string; idempotencyKey: string };
type AddPaymentInput = { debtId: string; accountId: string; amount: number; date: string; note?: string; idempotencyKey: string };

interface AppContextValue {
  data: AppData;
  session: Session | null;
  loading: boolean;
  dataReady: boolean;
  recoveringPassword: boolean;
  phoneAuthEnabled: boolean;
  demoMode: boolean;
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  addAccount: (name: string, accountType: Account['account_type'], openingBalance: number) => Promise<void>;
  addTransaction: (input: AddTransactionInput) => Promise<void>;
  addTransfer: (fromAccountId: string, toAccountId: string, amount: number, date: string, description: string, idempotencyKey: string) => Promise<void>;
  addDebt: (input: AddDebtInput) => Promise<void>;
  recordPayment: (input: AddPaymentInput) => Promise<void>;
  addContact: (name: string, phone?: string) => Promise<void>;
  updateContact: (id:string,name:string,phone?:string)=>Promise<void>;
  updateAccount: (id:string,name:string)=>Promise<void>;
  toggleAccountArchived:(id:string,archive:boolean)=>Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const emptyData = (): AppData => ({accounts:[],categories:[],contacts:[],transactions:[],debts:[],payments:[],ledger:[]});
const safePaisa = (value: unknown): number => {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('A financial amount exceeded safe integer precision. Contact support.');
  return amount;
};
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const lastUserId = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [theme, setThemeState] = useState<Theme>((localStorage.getItem('ah-theme') as Theme) || 'light');
  const [language, setLanguageState] = useState<Language>((localStorage.getItem('ah-language') as Language) || 'bn');
  const [error, setError] = useState<string | null>(null);
  const demoMode = false; // Public builds never expose sample financial data.
  const phoneAuthEnabled = import.meta.env.VITE_ENABLE_PHONE_AUTH === 'true';
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  useEffect(() => { localStorage.removeItem('amar-hisab-demo-data'); }, []);

  const setTheme = (value: Theme) => { setThemeState(value); localStorage.setItem('ah-theme', value); };
  const setLanguage = (value: Language) => { setLanguageState(value); localStorage.setItem('ah-language', value); };
  const clearError = () => setError(null);

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client || !session?.user) return;
    const requestedUserId = session.user.id;
    const fetchPaged = async (makeQuery: () => any) => {
      const rows: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await makeQuery().range(from, from + 999);
        if (error) throw error;
        rows.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      return rows;
    };
    const [accountsRows, categoriesRows, contactsRows, transactionsRows, debtsRows, paymentsRows] = await Promise.all([
      fetchPaged(() => client.from('account_balances').select('*').order('created_at', { ascending: true }).order('id')),
      fetchPaged(() => client.from('categories').select('*').eq('is_active', true).order('name').order('id')),
      fetchPaged(() => client.from('contacts').select('*').order('name').order('id')),
      fetchPaged(() => client.from('transactions').select('*').is('voided_at', null).order('occurred_at', { ascending: false }).order('id')),
      fetchPaged(() => client.from('debt_balances').select('*').order('created_at', { ascending: false }).order('id')),
      fetchPaged(() => client.from('debt_payments').select('*').is('voided_at', null).order('paid_at', { ascending: false }).order('id'))
    ]);
    const accounts = accountsRows.map((a: any) => ({ ...a, opening_balance_paisa: safePaisa(a.opening_balance_paisa), balance_paisa: safePaisa(a.balance_paisa) }));
    const categories = categoriesRows as AppData['categories'];
    const contacts = contactsRows as AppData['contacts'];
    const transactions = transactionsRows.map((tx: any) => ({
      ...tx, amount_paisa: safePaisa(tx.amount_paisa),
      account_name: tx.kind === 'transfer' ? `${accounts.find(a => a.id === tx.from_account_id)?.name ?? 'Account'} → ${accounts.find(a => a.id === tx.to_account_id)?.name ?? 'Account'}` : accounts.find(a => a.id === tx.account_id)?.name,
      category_name: categories.find(c => c.id === tx.category_id)?.name,
      contact_name: contacts.find(c => c.id === tx.contact_id)?.name
    })) as Transaction[];
    const payments = paymentsRows.map((p: any) => ({ ...p, amount_paisa: safePaisa(p.amount_paisa) }));
    const debts = debtsRows.map((d: any) => ({
      ...d, contact_name: contacts.find(c => c.id === d.contact_id)?.name ?? 'Unknown',
      principal_paisa: safePaisa(d.principal_paisa), paid_paisa: safePaisa(d.paid_paisa),
      remaining_paisa: safePaisa(d.remaining_paisa), status: Number(d.remaining_paisa) === 0 ? 'settled' : (d.due_date && new Date(`${d.due_date}T23:59:59+06:00`) < new Date() ? 'overdue' : d.computed_status)
    })) as Debt[];
    // A slow request for the previous account must never replace the current user's data.
    if (lastUserId.current === requestedUserId) {
      setData({ accounts, categories, contacts, transactions, debts, payments, ledger: [] });
      setDataReady(true);
      setError(null);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let mounted = true;
    const applySession = (current: Session | null) => {
      if (!mounted) return;
      const userId = current?.user?.id ?? null;
      if (lastUserId.current !== userId) {
        // Never show a previous user's financial data while another user signs in.
        lastUserId.current = userId;
        setData(emptyData());
        setDataReady(false);
        setLoading(Boolean(userId));
      } else if (!userId) {
        setLoading(false);
      }
      setSession(current);
    };
    supabase.auth.getSession()
      .then(({ data: { session: current }, error: sessionError }) => {
        if (sessionError) throw sessionError;
        applySession(current);
      })
      .catch((e: Error) => { if(mounted){setError(e.message);setLoading(false)} });
    const { data: listener } = supabase.auth.onAuthStateChange((event, current) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true);
      applySession(current);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    setLoading(true);
    let active = true;
    refresh().catch((e: Error) => { if(active) setError(e.message); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [session?.user?.id, refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [theme, language]);


  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Cloud settings are missing. Contact the site administrator.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signUp = async (email: string, password: string, fullName: string): Promise<boolean> => {
    if (!supabase) throw new Error('Cloud settings are missing. Contact the site administrator.');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } } });
    if (error) throw error;
    return !data.session; // True when email verification is required.
  };
  const sendPasswordReset = async (email: string) => {
    if (!supabase) throw new Error('Cloud settings are missing.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  };
  const updatePassword = async (password: string) => {
    if (!supabase || !session) throw new Error('Recovery session expired. Request another link.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecoveringPassword(false);
  };
  const sendPhoneOtp = async (phone: string) => {
    if (!phoneAuthEnabled) throw new Error('Phone login has not been configured by the administrator.');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Use international number format, e.g. +8801XXXXXXXXX');
    if (!supabase) throw new Error('Cloud settings are missing.');
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  };
  const verifyPhoneOtp = async (phone: string, token: string) => {
    if (!phoneAuthEnabled || !supabase) throw new Error('Phone login is unavailable.');
    if (!/^\d{6}$/.test(token)) throw new Error('Enter the six-digit code.');
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
  };
  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Cloud settings are missing. Contact the site administrator.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) throw error;
  };
  const signOut = async () => {
    if (supabase) { const { error } = await supabase.auth.signOut(); if (error) throw error; }
    lastUserId.current = null; setSession(null); setData(emptyData()); setDataReady(false); setRecoveringPassword(false);
  };

  const addAccount = async (name: string, accountType: Account['account_type'], openingBalance: number) => {
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const paisa = toPaisa(openingBalance);
    if (paisa < 0) throw new Error('Opening balance cannot be negative');
    if (supabase && session) {
      const { error } = await supabase.from('accounts').insert({ name, account_type: accountType, opening_balance_paisa: paisa, currency_code: 'BDT' });
      if (error) throw error;
      await refresh();
    }
  };

  const addTransaction = async (input: AddTransactionInput) => {
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const amount = toPaisa(input.amount);
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    if (supabase && session) {
      const { error } = await supabase.rpc('create_money_transaction', {
        p_kind: input.kind, p_amount_paisa: amount, p_account_id: input.accountId,
        p_category_id: input.categoryId || null, p_occurred_at: parseDhakaInput(input.date),
        p_description: input.description, p_notes: input.notes ?? null, p_idempotency_key: input.idempotencyKey
      });
      if (error) throw error;
      await refresh();
    }
  };

  const addTransfer = async (fromAccountId: string, toAccountId: string, amountValue: number, date: string, description: string, idempotencyKey: string) => {
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const amount = toPaisa(amountValue);
    if (amount <= 0) throw new Error('Transfer amount must be greater than zero');
    if (fromAccountId === toAccountId) throw new Error('Choose two different accounts');
    if (supabase && session) {
      const { error } = await supabase.rpc('create_internal_transfer', {
        p_from_account_id: fromAccountId, p_to_account_id: toAccountId,
        p_amount_paisa: amount, p_occurred_at: parseDhakaInput(date),
        p_description: description || 'Account transfer', p_idempotency_key: idempotencyKey
      });
      if (error) throw error;
      await refresh();
    }
  };

  const addContact = async (name: string, phone?: string) => {
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    if(!name.trim())throw new Error('Contact name is required');
    if (supabase && session) {
      const { error } = await supabase.from('contacts').insert({ name, phone: phone || null });
      if (error) throw error;
      await refresh();
    }
  };

  const updateAccount=async(id:string,name:string)=>{
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const cleaned=name.trim();if(!cleaned||cleaned.length>80)throw new Error('Invalid account name');
    if(supabase&&session){const {error}=await supabase.from('accounts').update({name:cleaned}).eq('id',id);if(error)throw error;await refresh()}
  };
  const toggleAccountArchived=async(id:string,archive:boolean)=>{
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const account=data.accounts.find(a=>a.id===id);if(!account)throw new Error('Account not found');
    if(archive&&account.balance_paisa!==0)throw new Error('Only zero-balance accounts can be archived. Transfer the balance first.');
    if(supabase&&session){const {error}=await supabase.from('accounts').update({archived_at:archive?new Date().toISOString():null}).eq('id',id);if(error)throw error;await refresh()}
  };
  const updateContact=async(id:string,name:string,phone?:string)=>{
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const cleaned=name.trim();if(!cleaned||cleaned.length>100)throw new Error('Invalid contact name');
    if(supabase&&session){const {error}=await supabase.from('contacts').update({name:cleaned,phone:phone||null}).eq('id',id);if(error)throw error;await refresh()}
  };
  const addDebt = async (input: AddDebtInput) => {
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const amount = toPaisa(input.amount);
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    if (!input.contactName.trim()) throw new Error('Person name is required');
    if (supabase && session) {
      let contactId: string;
      const { data: existing } = await supabase.from('contacts').select('id').eq('name', input.contactName).limit(1).maybeSingle();
      if (existing?.id) contactId = existing.id;
      else {
        const { data: created, error: contactError } = await supabase.from('contacts').insert({ name: input.contactName, phone: input.phone || null }).select('id').single();
        if (contactError) throw contactError;
        contactId = created.id;
      }
      const { error } = await supabase.rpc('create_debt_record', {
        p_contact_id: contactId, p_direction: input.direction, p_principal_paisa: amount,
        p_account_id: input.accountId, p_opened_at: parseDhakaInput(input.date),
        p_due_date: input.dueDate || null, p_notes: input.notes || null, p_idempotency_key: input.idempotencyKey
      });
      if (error) throw error;
      await refresh();
    }
  };

  const recordPayment = async (input: AddPaymentInput) => {
    if (!supabase || !session) throw new Error('Please sign in again to save financial information.');
    const amount = toPaisa(input.amount);
    if (amount <= 0) throw new Error('Amount must be greater than zero');
    const debt = data.debts.find(d => d.id === input.debtId);
    if (!debt) throw new Error('Debt record not found');
    validatePayment(amount, debt.remaining_paisa);
    if (supabase && session) {
      const { error } = await supabase.rpc('record_debt_payment', {
        p_debt_id: input.debtId, p_account_id: input.accountId,
        p_amount_paisa: amount, p_paid_at: parseDhakaInput(input.date), p_note: input.note || null, p_idempotency_key: input.idempotencyKey
      });
      if (error) throw error;
      await refresh();
    }
  };

  const value: AppContextValue = { data, session, loading, dataReady, recoveringPassword, phoneAuthEnabled, demoMode, theme, language, setTheme, setLanguage, signIn, signUp, signInWithGoogle, sendPasswordReset, updatePassword, sendPhoneOtp, verifyPhoneOtp, signOut, refresh, addAccount, addTransaction, addTransfer, addDebt, recordPayment, addContact, updateAccount, updateContact, toggleAccountArchived, error, clearError };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
