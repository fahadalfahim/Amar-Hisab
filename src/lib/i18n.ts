import type { Language } from './types';

const translations = {
  en: {
    dashboard: 'Overview', transactions: 'Transactions', accounts: 'My accounts', loans: 'Loans & dues', people: 'People', reports: 'Reports', settings: 'Settings',
    welcome: 'Good evening', subtitle: 'Here is your financial snapshot.', totalBalance: 'Available balance', income: 'Income this month', expenses: 'Expenses this month', receivable: 'Owed to you', payable: 'You owe', netWorth: 'Net worth',
    cashFlow: 'Cash flow', spending: 'Spending by category', recent: 'Recent transactions', upcoming: 'Upcoming payments', seeAll: 'See all', addTransaction: 'Add transaction', addIncome: 'Add income', addExpense: 'Add expense', addAccount: 'Add account', addLoan: 'Add loan / due',
    search: 'Search anything...', all: 'All', date: 'Date', amount: 'Amount', category: 'Category', account: 'Account', description: 'Description', save: 'Save', cancel: 'Cancel', name: 'Name', type: 'Type', balance: 'Balance', status: 'Status', paid: 'Paid', remaining: 'Remaining', dueDate: 'Due date', recordPayment: 'Record payment',
    light: 'Light', dark: 'Dark', language: 'Language', english: 'English', bengali: 'বাংলা', logout: 'Log out', signIn: 'Sign in', email: 'Email', password: 'Password', signUp: 'Create account', google: 'Continue with Google',
    noData: 'Nothing here yet', demoNotice: 'Preview mode — connect Supabase to save your real data securely.', incomeLabel: 'Income', expenseLabel: 'Expense', transfer: 'Transfer', borrowed: 'Borrowed', lent: 'Lent', settled: 'Settled', overdue: 'Overdue', partial: 'Partially paid', pending: 'Pending',
    monthly: 'Monthly overview', totalTransactions: 'Transactions', quickActions: 'Quick actions', accountBreakdown: 'Account breakdown', loanOverview: 'Loan overview', profile: 'Profile', appearance: 'Appearance', preferences: 'Preferences', security: 'Security', export: 'Export data',
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড', transactions: 'লেনদেন', accounts: 'আমার অ্যাকাউন্ট', loans: 'ঋণ ও পাওনা', people: 'ব্যক্তিবর্গ', reports: 'রিপোর্ট', settings: 'সেটিংস',
    welcome: 'শুভ সন্ধ্যা', subtitle: 'আপনার আর্থিক অবস্থার সংক্ষিপ্ত চিত্র।', totalBalance: 'বর্তমান ব্যালেন্স', income: 'এই মাসের আয়', expenses: 'এই মাসের খরচ', receivable: 'আপনি পাবেন', payable: 'আপনার দেনা', netWorth: 'নিট সম্পদ',
    cashFlow: 'আয়-ব্যয়ের প্রবাহ', spending: 'খরচের বিভাগ', recent: 'সাম্প্রতিক লেনদেন', upcoming: 'আসন্ন পেমেন্ট', seeAll: 'সব দেখুন', addTransaction: 'লেনদেন যোগ করুন', addIncome: 'আয় যোগ করুন', addExpense: 'খরচ যোগ করুন', addAccount: 'অ্যাকাউন্ট যোগ করুন', addLoan: 'ঋণ / পাওনা যোগ করুন',
    search: 'খুঁজুন...', all: 'সব', date: 'তারিখ', amount: 'পরিমাণ', category: 'ক্যাটাগরি', account: 'অ্যাকাউন্ট', description: 'বিবরণ', save: 'সেভ করুন', cancel: 'বাতিল', name: 'নাম', type: 'ধরন', balance: 'ব্যালেন্স', status: 'অবস্থা', paid: 'পরিশোধিত', remaining: 'বাকি', dueDate: 'পরিশোধের তারিখ', recordPayment: 'পেমেন্ট যোগ করুন',
    light: 'লাইট', dark: 'ডার্ক', language: 'ভাষা', english: 'English', bengali: 'বাংলা', logout: 'লগ আউট', signIn: 'লগইন', email: 'ইমেইল', password: 'পাসওয়ার্ড', signUp: 'অ্যাকাউন্ট খুলুন', google: 'Google দিয়ে চালিয়ে যান',
    noData: 'এখনো কোনো তথ্য নেই', demoNotice: 'প্রিভিউ মোড — আসল ডেটা নিরাপদে সেভ করতে Supabase সংযুক্ত করুন।', incomeLabel: 'আয়', expenseLabel: 'খরচ', transfer: 'ট্রান্সফার', borrowed: 'ধার নিয়েছেন', lent: 'ধার দিয়েছেন', settled: 'সম্পূর্ণ পরিশোধ', overdue: 'সময় পেরিয়েছে', partial: 'আংশিক পরিশোধ', pending: 'বাকি',
    monthly: 'মাসিক সারসংক্ষেপ', totalTransactions: 'মোট লেনদেন', quickActions: 'দ্রুত কাজ', accountBreakdown: 'অ্যাকাউন্ট অনুযায়ী', loanOverview: 'ঋণের সারসংক্ষেপ', profile: 'প্রোফাইল', appearance: 'ডিজাইন', preferences: 'পছন্দসমূহ', security: 'নিরাপত্তা', export: 'ডেটা এক্সপোর্ট',
  }
} satisfies Record<Language, Record<string, string>>;

export function t(language: Language, key: keyof typeof translations.en): string {
  return translations[language][key] ?? translations.en[key] ?? key;
}
