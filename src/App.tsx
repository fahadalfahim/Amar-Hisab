import React, { useMemo, useState, useEffect } from 'react';
import {
  Activity, ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowUpRight, Bell, BookOpen,
  BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  CreditCard, Download, FileText, Filter, Globe2, HandCoins, Home, Languages, LayoutDashboard,
  LogOut, Menu, Moon, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Sun,
  TrendingDown, TrendingUp, UserRound, Users, Wallet, X, PieChart as PieIcon, Receipt,
  Utensils, Car, ShoppingBag, HeartPulse, Banknote, Smartphone, CircleDollarSign, Copy, Edit3, Archive, RotateCcw, ListFilter,
  CheckCircle2, Trash2, PartyPopper, AlertCircle
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, BarChart, Bar, Legend
} from 'recharts';
import { AppProvider, useApp } from './context/AppContext';
import { isSupabaseConfigured } from './lib/supabase';
import { calculateNetWorth, debtTotals, dhakaYearMonth, formatMoney, paymentProgress, summarizeMonth, totalAvailable } from './lib/money';
import { t } from './lib/i18n';
import type { Account, Contact, Debt, Language, Transaction } from './lib/types';
import './styles.css';

type Page = 'dashboard' | 'transactions' | 'accounts' | 'loans' | 'people' | 'reports' | 'settings';

const navItems: { id: Page; icon: React.ElementType; key: 'dashboard'|'transactions'|'accounts'|'loans'|'people'|'reports'|'settings' }[] = [
  { id: 'dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { id: 'transactions', icon: ArrowLeftRight, key: 'transactions' },
  { id: 'accounts', icon: Wallet, key: 'accounts' },
  { id: 'loans', icon: HandCoins, key: 'loans' },
  { id: 'people', icon: Users, key: 'people' },
  { id: 'reports', icon: PieIcon, key: 'reports' },
  { id: 'settings', icon: Settings, key: 'settings' },
];

const categoryIcon: Record<string, React.ElementType> = {
  'Food & dining': Utensils, 'Transport': Car, 'Shopping': ShoppingBag, 'Bills': Receipt,
  'Health': HeartPulse, 'Salary': BriefcaseBusiness, 'Other income': Sparkles
};

function AppRoot() {
  const { session, loading, dataReady, recoveringPassword, language, refresh, signOut, error } = useApp();
  if (!isSupabaseConfigured) return <div className="configuration-screen"><img src="/pwa-192.png" alt="Amar Hisab"/><h1>Amar Hisab</h1><h2>{language === 'bn' ? 'ক্লাউড সেটআপ প্রয়োজন' : 'Cloud setup required'}</h2><p>{language === 'bn' ? 'Supabase কানেকশন দেওয়া হয়নি। নিরাপত্তার জন্য Demo বা স্থানীয় হিসাব দেখানো হচ্ছে না। সাইটের মালিকের সঙ্গে যোগাযোগ করুন।' : 'Supabase is not configured. No demo accounts or local financial records are available. Contact the site administrator.'}</p></div>;
  if (loading) return <div className="loading-screen"><img className="brand-logo loading-logo" src="/pwa-192.png" alt="Amar Hisab logo"/><div className="loader"/><span>{language==='bn'?'আপনার হিসাব লোড হচ্ছে…':'Loading your private workspace…'}</span></div>;
  if (session && !recoveringPassword && !dataReady) return <div className="configuration-screen" role="alert"><img src="/pwa-192.png" alt="Amar Hisab"/><h2>{language==='bn'?'হিসাব লোড করা যাচ্ছে না':'Unable to load your records'}</h2><p>{error || (language==='bn'?'ক্লাউডের সঙ্গে সংযোগ পরীক্ষা করুন।':'Check your cloud connection.')}</p><div className="recovery-actions"><button className="primary-btn" onClick={()=>{refresh().catch(()=>undefined)}}>{language==='bn'?'আবার চেষ্টা করুন':'Try again'}</button><button className="secondary-btn" onClick={()=>{Promise.resolve(signOut()).catch(e=>window.alert(e instanceof Error?e.message:'Sign out failed'))}}>{language==='bn'?'লগআউট':'Sign out'}</button></div></div>;
  return <>{recoveringPassword ? <PasswordRecoveryScreen/> : !session ? <AuthScreen/> : <MainApp/>}<InstallPrompt/></>;
}

type InstallEvent = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> };
function InstallPrompt() {
  const {language}=useApp();
  const [deferred,setDeferred]=useState<InstallEvent|null>(null);
  const [show,setShow]=useState(false);
  const [guide,setGuide]=useState(false);
  const [installed,setInstalled]=useState(false);
  const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  useEffect(()=>{
    const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
    if(standalone()){setInstalled(true);return;}
    const ready=(e:Event)=>{e.preventDefault();setDeferred(e as InstallEvent);if(sessionStorage.getItem('ah-dismiss-install')!=='1')setShow(true)};
    const didInstall=()=>{setInstalled(true);setShow(false)};
    const manual=()=>{setShow(true);setGuide(false)};
    window.addEventListener('beforeinstallprompt',ready);
    window.addEventListener('appinstalled',didInstall);
    window.addEventListener('ah-show-install',manual);
    const timer=window.setTimeout(()=>{if(!standalone()&&sessionStorage.getItem('ah-dismiss-install')!=='1')setShow(true)},3500);
    return ()=>{window.clearTimeout(timer);window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',didInstall);window.removeEventListener('ah-show-install',manual)};
  },[]);
  const install=async()=>{
    if(!deferred){setGuide(true);return;}
    try{await deferred.prompt();const choice=await deferred.userChoice;setDeferred(null);if(choice.outcome==='accepted')setShow(false);else setGuide(true)}catch{setGuide(true)}
  };
  if(installed||!show)return null;
  return <aside className="install-banner" role="region" aria-label="Install Amar Hisab"><img src="/pwa-192.png" alt="Amar Hisab"/><div className="install-copy"><strong>{language==='bn'?'Amar Hisab ইনস্টল করুন':'Install Amar Hisab'}</strong><span>{guide?(ios?'Safari → Share → Add to Home Screen':'Browser menu → Install app / Add to Home Screen'):(language==='bn'?'মোবাইলে অ্যাপের মতো ব্যবহার করুন।':'Keep your money tracker a tap away.')}</span></div><div className="install-actions"><button className="install-now" onClick={install}>{language==='bn'?'ইনস্টল':'Install'}</button><button className="install-close" title="Dismiss install suggestion" aria-label="Dismiss install suggestion" onClick={()=>{sessionStorage.setItem('ah-dismiss-install','1');setShow(false)}}><X size={16}/></button></div></aside>;
}

type ActionOption={label:string;icon:React.ElementType;onClick:()=>void;disabled?:boolean;danger?:boolean};
function ActionMenu({label,options}:{label:string;options:ActionOption[]}) {
  return <details className="action-menu" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false}}><summary className="icon-btn subtle" aria-label={label} title={label}><MoreHorizontal size={18}/></summary><div className="action-menu-panel">{options.map(opt=>{const Icon=opt.icon;return <button type="button" key={opt.label} disabled={opt.disabled} className={opt.danger?'danger-menu-item':''} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');opt.onClick()}}><Icon size={15}/>{opt.label}</button>})}</div></details>;
}
function dhakaInputNow(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T')}

function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset, sendPhoneOtp, verifyPhoneOtp,
    phoneAuthEnabled, error, clearError, language, setLanguage, theme, setTheme } = useApp();
  const [mode,setMode] = useState<'login'|'signup'|'forgot'|'phone'>('login');
  const emailSignupEnabled=import.meta.env.VITE_ENABLE_EMAIL_SIGNUP==='true';
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('+880');
  const [token,setToken] = useState('');
  const [otpSent,setOtpSent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const L=(bn:string,en:string)=> language==='bn'?bn:en;
  const switchMode=(next:typeof mode)=>{if(next==='signup'&&!emailSignupEnabled)return;setMode(next);setMessage('');clearError();setOtpSent(false);setToken('');};
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();clearError();setMessage('');setBusy(true);
    try {
      if (mode==='login') await signIn(email.trim(),password);
      else if (mode==='signup') {
        if(!emailSignupEnabled) throw new Error('Email sign-up requires configured SMTP.');
        const checkEmail=await signUp(email.trim(),password,name.trim());
        setMessage(checkEmail?L('ইমেইল চেক করে অ্যাকাউন্ট নিশ্চিত করুন। তারপর লগইন করুন।','Check your email to verify the account, then sign in.'):L('অ্যাকাউন্ট তৈরি হয়েছে।','Your account has been created.'));
      } else if (mode==='forgot') {
        await sendPasswordReset(email.trim());
        setMessage(L('এই ইমেইলটি নিবন্ধিত থাকলে Password Reset Link পাঠানো হবে।','If this address is registered, a password reset link will be sent.'));
      } else if (!otpSent) {
        await sendPhoneOtp(phone.trim());setOtpSent(true);
        setMessage(L('আপনার ফোনে পাঠানো ছয় সংখ্যার কোড লিখুন।','Enter the six-digit SMS code.'));
      } else {
        await verifyPhoneOtp(phone.trim(),token.trim());
      }
    } catch(err) {setMessage(err instanceof Error?err.message:L('অনুরোধটি সম্পন্ন হয়নি।','Could not complete the request.'));}
    finally {setBusy(false);}
  };
  return <div className="auth-layout">
    <div className="auth-art">
      <div className="auth-brand"><img className="brand-logo" src="/pwa-192.png" alt="Amar Hisab logo"/><span>Amar <b>Hisab</b></span></div>
      <div className="auth-copy"><span className="eyebrow">YOUR MONEY, IN CLARITY</span><h1>Make every taka<br/><em>tell a story.</em></h1><p>One calm, private place for your income, expenses, savings and loans.</p>
        <div className="auth-preview-card"><div className="preview-top"><span><ShieldCheck size={17}/> PRIVATE BY DESIGN</span><Sparkles size={17}/></div><strong>{L('নিজের হিসাব, নিজের নিয়ন্ত্রণ','Your money. Your control.')}</strong><div className="preview-bottom"><span><Check size={15}/> {L('নিরাপদ ক্লাউড অ্যাকাউন্ট','Private cloud account')}</span><span>Amar Hisab</span></div></div>
      </div>
      <div className="auth-foot">Cloud sync · Private records · Made for everyday life</div>
    </div>
    <div className="auth-panel"><div className="auth-form-wrap">
      <div className="mobile-auth-brand"><img className="brand-logo" src="/pwa-192.png" alt="Amar Hisab logo"/><b>Amar Hisab</b></div>
      <div className="auth-preferences"><button type="button" aria-label="Change language" onClick={()=>setLanguage(language==='bn'?'en':'bn')}><Languages size={15}/> {language==='bn'?'English':'বাংলা'}</button><button type="button" aria-label="Toggle theme" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={16}/>:<Sun size={16}/>}</button></div>
      <span className="eyebrow">WELCOME TO AMAR HISAB</span>
      <h2>{mode==='login'?L('আবার স্বাগতম','Welcome back'):mode==='signup'?L('অ্যাকাউন্ট তৈরি করুন','Create your account'):mode==='forgot'?L('পাসওয়ার্ড রিসেট','Reset password'):L('ফোন দিয়ে লগইন','Phone sign in')}</h2>
      <p className="muted">{mode==='login'?L('নিজের হিসাব দেখতে লগইন করুন।','Sign in to your private financial space.'):mode==='signup'?L('আপনার নতুন হিসাব শূন্য থেকে শুরু হবে।','Your new account starts with no financial records.'):mode==='forgot'?L('রিসেট লিংক পেতে ইমেইল লিখুন।','Enter your email to receive a reset link.'):L('আন্তর্জাতিক নম্বর ব্যবহার করুন, যেমন +8801XXXXXXXXX','Use international format, e.g. +8801XXXXXXXXX')}</p>
      {(mode==='login'||mode==='signup')&&<><button type="button" className="google-btn" disabled={busy} onClick={async()=>{clearError();setBusy(true);setMessage('');try{await signInWithGoogle()}catch(e){setMessage(e instanceof Error?e.message:'Google sign in failed')}finally{setBusy(false)}}}><GoogleGlyph/> {L('Google দিয়ে চালিয়ে যান','Continue with Google')}</button><div className="or-divider"><span>{L('অথবা ইমেইল দিয়ে','or continue with email')}</span></div></>}
      <form onSubmit={submit} className="form-stack">
        {mode==='signup'&&<label>{L('পুরো নাম','Full name')}<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" placeholder={L('আপনার নাম','Your name')}/></label>}
        {mode!=='phone'&&<label>{L('ইমেইল ঠিকানা','Email address')}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@example.com"/></label>}
        {(mode==='login'||mode==='signup')&&<label>{L('পাসওয়ার্ড','Password')}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={L('কমপক্ষে ৮ অক্ষর','At least 8 characters')}/></label>}
        {mode==='phone'&&<><label>{L('ফোন নম্বর','Phone number')}<input type="tel" inputMode="tel" value={phone} disabled={otpSent} onChange={e=>setPhone(e.target.value)} required placeholder="+8801XXXXXXXXX"/></label>{otpSent&&<label>{L('৬ সংখ্যার কোড','6-digit code')}<input value={token} onChange={e=>setToken(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required placeholder="123456"/></label>}</>}
        {message&&<div className="inline-message" role="status">{message}</div>}
        {error&&<div className="inline-message error" role="alert">{error}</div>}
        <button type="submit" className="primary-btn full-btn" disabled={busy}>{busy?L('অনুগ্রহ করে অপেক্ষা করুন…','Please wait…'):mode==='login'?L('লগইন','Sign in'):mode==='signup'?L('অ্যাকাউন্ট খুলুন','Create account'):mode==='forgot'?L('রিসেট লিংক পাঠান','Send reset link'):otpSent?L('কোড যাচাই করুন','Verify code'):L('SMS কোড পাঠান','Send SMS code')} <ArrowUpRight size={17}/></button>
      </form>
      {mode==='login'&&<><div className="auth-links"><button type="button" onClick={()=>switchMode('forgot')}>{L('পাসওয়ার্ড ভুলে গেছেন?','Forgot password?')}</button>{phoneAuthEnabled&&<button type="button" onClick={()=>switchMode('phone')}>{L('ফোন দিয়ে লগইন','Phone sign in')}</button>}</div><p className="auth-switch">{L('নতুন ব্যবহারকারী?','New to Amar Hisab?')} {emailSignupEnabled?<button type="button" onClick={()=>switchMode('signup')}>{L('ইমেইলে অ্যাকাউন্ট খুলুন','Create email account')}</button>:<span>{L('Google দিয়ে নতুন অ্যাকাউন্ট খুলতে পারবেন।','Create a new account with Google.')}</span>}</p></>}
      {mode==='signup'&&<p className="auth-switch">{L('আগেই অ্যাকাউন্ট আছে?','Already have an account?')} <button type="button" onClick={()=>switchMode('login')}>{L('লগইন করুন','Sign in')}</button></p>}
      {(mode==='forgot'||mode==='phone')&&<p className="auth-switch"><button type="button" onClick={()=>switchMode('login')}>{L('লগইন পেজে ফিরে যান','Back to sign in')}</button>{mode==='phone'&&otpSent&&<button type="button" onClick={()=>{setOtpSent(false);setToken('');setMessage('')}}>{L('নম্বর পরিবর্তন','Change number')}</button>}</p>}
      {!emailSignupEnabled&&<p className="auth-phone-note">{L('ইমেইলে নতুন অ্যাকাউন্ট খোলার জন্য সাইটের মালিককে SMTP সেটআপ করতে হবে।','Email account registration is enabled after the administrator configures SMTP.')}</p>}
      {!phoneAuthEnabled&&<p className="auth-phone-note">{L('ফোন OTP লগইন চালু করতে SMS সার্ভিস সেটআপ প্রয়োজন।','Phone OTP sign-in requires an SMS provider; it is not included in free hosting.')}</p>}
      <div className="auth-security"><ShieldCheck size={15}/>{L('আপনার হিসাব শুধু আপনার অ্যাকাউন্টেই থাকবে।','Your financial records belong only to your account.')}</div>
    </div></div>
  </div>;
}

function PasswordRecoveryScreen(){
  const {updatePassword,language}=useApp();
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setMessage('');if(password!==confirm){setMessage(language==='bn'?'পাসওয়ার্ড দুটি একই হতে হবে।':'Passwords do not match.');return;}setBusy(true);try{await updatePassword(password);setMessage('Password changed successfully.')}catch(err){setMessage(err instanceof Error?err.message:'Password reset failed')}finally{setBusy(false)}};
  return <div className="auth-layout recovery-layout"><div className="auth-panel"><div className="auth-form-wrap"><img className="brand-logo" src="/pwa-192.png" alt="Amar Hisab"/><h2>{language==='bn'?'নতুন পাসওয়ার্ড দিন':'Choose a new password'}</h2><p className="muted">{language==='bn'?'আপনার অ্যাকাউন্টের নতুন পাসওয়ার্ড সেট করুন।':'Set a new password for your account.'}</p><form className="form-stack" onSubmit={submit}><label>{language==='bn'?'নতুন পাসওয়ার্ড':'New password'}<input type="password" minLength={8} maxLength={128} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>{language==='bn'?'পাসওয়ার্ড নিশ্চিত করুন':'Confirm password'}<input type="password" minLength={8} maxLength={128} autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{message&&<div className="inline-message" role="status">{message}</div>}<button className="primary-btn full-btn" disabled={busy}>{busy?'Please wait…':'Update password'}</button></form></div></div></div>;
}

function GoogleGlyph() { return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/><path fill="#4A90E2" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12z"/></svg>; }

function MainApp() {
  const { data, theme, language, setTheme, setLanguage, demoMode, signOut, error, clearError, toggleAccountArchived, deleteDebt } = useApp();
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<'transaction'|'account'|'contact'|'debt'|'payment'|null>(null);
  const [selectedAccount,setSelectedAccount]=useState<Account|null>(null);
  const [selectedContact,setSelectedContact]=useState<Contact|null>(null);
  const [transactionDefault,setTransactionDefault]=useState<{kind:'income'|'expense'|'transfer';accountId:string}|null>(null);
  const [contactDefault,setContactDefault]=useState('');
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [hiddenDebtIds, setHiddenDebtIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('amar_hisab_hidden_debts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [celebrationDebt, setCelebrationDebt] = useState<Debt | null>(null);

  const hideDebt = (debtId: string) => {
    setHiddenDebtIds(prev => {
      const next = prev.includes(debtId) ? prev : [...prev, debtId];
      try { localStorage.setItem('amar_hisab_hidden_debts', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const unhideDebt = (debtId: string) => {
    setHiddenDebtIds(prev => {
      const next = prev.filter(id => id !== debtId);
      try { localStorage.setItem('amar_hisab_hidden_debts', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const restoreAllDebts = () => {
    setHiddenDebtIds([]);
    try { localStorage.removeItem('amar_hisab_hidden_debts'); } catch {}
    notify(language === 'bn' ? 'সব লুকানো রেকর্ড ফিরিয়ে আনা হয়েছে' : 'All hidden records restored');
  };
  const handleDeleteDebt = async (debt: Debt) => {
    hideDebt(debt.id);
    try {
      await deleteDebt(debt.id);
    } catch (e) {
      console.warn('Backend delete debt deferred:', e);
    }
    notify(language === 'bn' ? '✓ কার্ডটি সফলভাবে তালিকা থেকে সরানো হয়েছে' : 'Card removed from list');
  };

  const monthSummary = useMemo(() => { const current = dhakaYearMonth(); return summarizeMonth(data.transactions, current.year, current.month); }, [data.transactions]);
  const balance = totalAvailable(data.accounts, data.ledger);
  const debtSummary = debtTotals(data.debts);
  const netWorth = calculateNetWorth(data.accounts, data.ledger, data.debts);
  const notify = (message: string) => { setToast(message); window.setTimeout(()=>setToast(''), 3200); };
  const openPayment = (debt: Debt) => { setSelectedDebt(debt); setModal('payment'); };
  const navigate=(next:Page)=>{setPage(next);if(next!=='transactions')setSearch('');setMobileMenu(false);setNotificationsOpen(false)};
  const viewTransactions=(query:string)=>{setSearch(query);setPage('transactions');setMobileMenu(false)};
  const createTransaction=(kind:'income'|'expense'|'transfer'='expense',accountId='')=>{setTransactionDefault({kind,accountId});setModal('transaction')};
  const copyPhone=async(value:string)=>{try{await navigator.clipboard.writeText(value);notify('Copied to clipboard')}catch{window.prompt('Copy number:',value)}};
  const archive=async(a:Account)=>{if(!window.confirm(a.archived_at?'Restore account?':'Archive account? Your records will be preserved.'))return;try{await toggleAccountArchived(a.id,!a.archived_at);notify(a.archived_at?'Account restored':'Account archived')}catch(e){notify(e instanceof Error?e.message:'Could not update account')}};
  const dueAlerts=data.debts.filter(d=>d.remaining_paisa>0&&d.due_date&&d.due_date.slice(0,10)<=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+7*86400000))).slice(0,6);
  const pageTitle = t(language, navItems.find(n=>n.id===page)?.key ?? 'dashboard');

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?'sidebar-open':''}`}>
      <div className="sidebar-brand"><img className="brand-logo" src="/pwa-192.png" alt="Amar Hisab logo"/><div><b>Amar Hisab</b><small>PERSONAL FINANCE</small></div><button className="icon-btn sidebar-close" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div>
      <button className="workspace-pill" title="Workspace settings" onClick={()=>navigate('settings')}><div className="workspace-avatar">AH</div><div><b>My workspace</b><small>Personal account</small></div><ArrowUpRight size={15}/></button>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav">{navItems.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-link ${page===item.id?'active':''}`} onClick={()=>navigate(item.id)}><Icon size={18}/><span>{t(language,item.key)}</span>{item.id==='loans' && data.debts.some(d=>d.status==='overdue') && <i className="nav-dot"/>}</button>})}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Sparkles size={16}/></div><b>Small steps, big clarity.</b><p>Keep your money story up to date.</p><button onClick={()=>navigate('reports')}>View insights <ArrowUpRight size={14}/></button></div><button className="nav-link logout-link" onClick={()=>{signOut().catch(e=>notify(e instanceof Error?e.message:'Sign out failed'))}}><LogOut size={18}/><span>{t(language,'logout')}</span></button><button className="sidebar-user" title="Settings" onClick={()=>navigate('settings')}><div className="user-avatar">A</div><div><b>My account</b><small>Private cloud workspace</small></div><MoreHorizontal size={18}/></button></div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={()=>setMobileMenu(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu-btn" onClick={()=>setMobileMenu(true)}><Menu size={21}/></button><div><div className="breadcrumb">MY WORKSPACE <ChevronRight size={12}/> <b>{pageTitle.toUpperCase()}</b></div><h1>{pageTitle}</h1></div></div><div className="topbar-actions"><div className="top-search"><Search size={16}/><input aria-label="Search transactions" value={search} onFocus={()=>setPage('transactions')} onChange={e=>{setSearch(e.target.value);setPage('transactions')}} placeholder={t(language,'search')}/><kbd>⌘ K</kbd></div><button className="icon-btn" title="Toggle theme" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-btn language-btn" title="Change language" onClick={()=>setLanguage(language==='bn'?'en':'bn')}><Languages size={18}/><span>{language==='bn'?'EN':'বাং'}</span></button><button className="icon-btn notification-btn" title="Notifications" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(v=>!v)}><Bell size={18}/>{dueAlerts.length>0&&<i/>}</button><button className="top-avatar" title="Settings" onClick={()=>navigate('settings')}>A</button></div></header>
      {notificationsOpen&&<div className="notification-popover panel"><div className="popover-heading"><b>{language==='bn'?'পেমেন্ট রিমাইন্ডার':'Payment reminders'}</b><button className="icon-btn" onClick={()=>setNotificationsOpen(false)} aria-label="Close notifications"><X size={16}/></button></div>{dueAlerts.length?dueAlerts.map(d=><button key={d.id} className="notification-row" onClick={()=>navigate('loans')}><CalendarDays size={18}/><span><b>{d.contact_name}</b><small>{d.due_date?.slice(0,10)} · {formatMoney(d.remaining_paisa,language)}</small></span></button>):<p className="muted">{language==='bn'?'পরবর্তী ৭ দিনে কোনো পেমেন্ট নেই।':'No payments due in the next 7 days.'}</p>}</div>}
      {error && <div className="error-banner"><span>{error}</span><button onClick={clearError}><X size={15}/></button></div>}
      <div className="page-content">
        {!data.accounts.length && <div className="onboarding-banner" role="status"><div><span className="eyebrow">YOUR FIRST STEP</span><h3>{language==='bn'?'নিজের প্রথম অ্যাকাউন্ট যোগ করুন':'Add your first money account'}</h3><p>{language==='bn'?'আপনার সব হিসাব শূন্য থেকে শুরু হয়েছে। Cash, Bank বা bKash যোগ করে সত্যিকারের লেনদেন শুরু করুন।':'Your workspace is empty and private. Create a Cash, Bank or Wallet account to start recording real transactions.'}</p></div><button className="primary-btn" onClick={()=>{setSelectedAccount(null);setModal('account')}}><Plus size={16}/>{language==='bn'?'অ্যাকাউন্ট যোগ করুন':'Add account'}</button></div>}
        {page==='dashboard' && <Dashboard data={data} balance={balance} income={monthSummary.income} expenses={monthSummary.expenses} payable={debtSummary.payable} receivable={debtSummary.receivable} netWorth={netWorth} language={language} onNavigate={navigate} onAdd={()=>createTransaction()} onPayment={openPayment}/>}
        {page==='transactions' && <TransactionsPage data={data} language={language} search={search} onAdd={()=>createTransaction()}/>}
        {page==='accounts' && <AccountsPage data={data} language={language} onAdd={()=>{setSelectedAccount(null);setModal('account')}} onEdit={a=>{setSelectedAccount(a);setModal('account')}} onArchive={archive} onView={a=>viewTransactions(a.name)} onTransfer={a=>createTransaction('transfer',a.id)} onAddExpense={accId=>createTransaction('expense',accId)} onAddIncome={accId=>createTransaction('income',accId)}/>}
        {page==='loans' && <LoansPage data={data} language={language} search={search} hiddenDebtIds={hiddenDebtIds} onDelete={handleDeleteDebt} onUnhide={unhideDebt} onRestoreAll={restoreAllDebts} onAdd={()=>{setContactDefault('');setModal('debt')}} onPayment={openPayment}/>}
        {page==='people' && <PeoplePage data={data} language={language} onAdd={()=>{setSelectedContact(null);setModal('contact')}} onEdit={c=>{setSelectedContact(c);setModal('contact')}} onHistory={viewTransactions} onLoans={name=>{setSearch(name);setPage('loans');setMobileMenu(false)}} onCopy={copyPhone} onNewLoan={name=>{setContactDefault(name);setModal('debt')}}/>}
        {page==='reports' && <ReportsPage data={data} language={language}/>}
        {page==='settings' && <SettingsPage data={data} language={language} theme={theme} setLanguage={setLanguage} setTheme={setTheme} signOut={signOut} demoMode={demoMode}/>}
      </div>
      <footer className="app-footer"><span>© {new Date().getFullYear()} Amar Hisab</span><span><ShieldCheck size={13}/> Your financial space, kept private</span><span>Made for clarity <Sparkles size={12}/></span></footer>
    </main>
    <nav className="mobile-bottom-nav" aria-label={language==='bn'?'প্রধান নেভিগেশন':'Main navigation'}>{navItems.filter(item=>item.id==='dashboard'||item.id==='transactions').map(item=>{const Icon=item.icon;return <button key={item.id} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} onClick={()=>navigate(item.id)}><Icon size={19}/><span>{t(language,item.key)}</span></button>})}<button className="mobile-quick-add" aria-label={language==='bn'?'নতুন লেনদেন যোগ করুন':'Add transaction'} onClick={()=>createTransaction()}><span className="quick-add-orb"><Plus size={24}/></span><span>{language==='bn'?'যোগ করুন':'Add'}</span></button>{navItems.filter(item=>item.id==='loans').map(item=>{const Icon=item.icon;return <button key={item.id} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} onClick={()=>navigate(item.id)}><Icon size={19}/><span>{t(language,item.key)}</span></button>})}<button aria-label="Open all navigation options" onClick={()=>setMobileMenu(true)}><MoreHorizontal size={19}/><span>{language==='bn'?'আরও':'More'}</span></button></nav>
    {modal==='transaction' && <TransactionModal defaults={transactionDefault} data={data} language={language} onClose={()=>setModal(null)} onDone={notify} onAddAccount={()=>{setSelectedAccount(null);setModal('account')}}/>}
    {modal==='account' && <AccountModal account={selectedAccount} language={language} onClose={()=>setModal(null)} onDone={notify}/>}
    {modal==='debt' && <DebtModal defaultContact={contactDefault} data={data} language={language} onClose={()=>setModal(null)} onDone={notify} onAddAccount={()=>{setSelectedAccount(null);setModal('account')}}/>}
    {modal==='contact'&&<ContactModal contact={selectedContact} language={language} onClose={()=>setModal(null)} onDone={notify}/>}
    {modal==='payment' && selectedDebt && <PaymentModal data={data} debt={selectedDebt} language={language} onClose={()=>setModal(null)} onDone={notify} onSettled={debt=>setCelebrationDebt(debt)}/>}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    {celebrationDebt && (
      <>
        <CelebrationConfetti onComplete={() => {}} />
        <SettledCelebrationModal
          debt={celebrationDebt}
          language={language}
          onClose={() => setCelebrationDebt(null)}
          onRemove={() => {
            const d = celebrationDebt;
            setCelebrationDebt(null);
            handleDeleteDebt(d);
          }}
        />
      </>
    )}
  </div>;
}

function SectionHeading({title,subtitle,action,actionLabel}:{title:string;subtitle?:string;action?:()=>void;actionLabel?:string}) {
  return <div className="section-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action&&<button className="secondary-btn" onClick={action}><Plus size={16}/>{actionLabel||'Add new'}</button>}</div>;
}

function StatCard({label,value,icon:Icon,tone,change,small}:{label:string;value:string;icon:React.ElementType;tone:string;change?:string;small?:string}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={18}/></div></div><strong>{value}</strong><div className="stat-foot">{change&&<span className="stat-change"><TrendingUp size={13}/>{change}</span>}<span>{small}</span></div></div>;
}

function Dashboard({data,balance,income,expenses,payable,receivable,netWorth,language,onNavigate,onAdd,onPayment}:{data:any;balance:number;income:number;expenses:number;payable:number;receivable:number;netWorth:number;language:Language;onNavigate:(p:Page)=>void;onAdd:()=>void;onPayment:(d:Debt)=>void}) {
  const month = new Intl.DateTimeFormat(language==='bn'?'bn-BD':'en-BD',{month:'long',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date());
  const chartData = useMemo(()=>{ const current=dhakaYearMonth(); return Array.from({length:6},(_,i)=>{
    const d = new Date(Date.UTC(current.year,current.month-5+i,15,12));
    const parts=dhakaYearMonth(d);
    const s = summarizeMonth(data.transactions,parts.year,parts.month);
    return { month:new Intl.DateTimeFormat(language==='bn'?'bn-BD':'en-US',{month:'short',timeZone:'Asia/Dhaka'}).format(d), income:s.income/100, expense:s.expenses/100 };
  }); },[data.transactions,language]);
  const expenseByCategory = useMemo(()=>{
    const map = new Map<string,number>();
    data.transactions.filter((tx:Transaction)=>tx.kind==='expense'&&(()=>{const dt=dhakaYearMonth(new Date(tx.occurred_at));const n=dhakaYearMonth();return dt.year===n.year&&dt.month===n.month})()).forEach((tx:Transaction)=>map.set(tx.category_name||'Other',(map.get(tx.category_name||'Other')||0)+tx.amount_paisa));
    return [...map.entries()].map(([name,value],i)=>({name,value:value/100,color:['#7668f6','#26b58e','#f1ad56','#ee718c','#4c9de8','#9c7be8'][i%6]}));
  },[data.transactions]);
  const recent = data.transactions.slice(0,5) as Transaction[];
  const upcoming = data.debts.filter((d:Debt)=>d.remaining_paisa>0).sort((a:Debt,b:Debt)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0,3) as Debt[];
  return <div className="dashboard-page">
    <div className="welcome-row"><div><div className="welcome-date"><CalendarDays size={14}/>{month}</div><h2>{t(language,'welcome')}, <span>there.</span> <span className="wave">✦</span></h2><p>{t(language,'subtitle')}</p></div><button className="primary-btn" onClick={onAdd}><Plus size={17}/>{t(language,'addTransaction')}</button></div>
    <div className="hero-balance-card"><div className="hero-glow glow-one"/><div className="hero-glow glow-two"/><div className="hero-balance-content"><div className="clay-hero-kicker"><Sparkles size={13}/> {language==='bn'?'আমার ফাইন্যান্স হাব':'MY FINANCE HUB'}</div><div className="hero-label"><span className="hero-dot"/> {t(language,'totalBalance')} <span className="hero-all">· All accounts</span></div><div className="hero-amount">{formatMoney(balance,language)}</div><div className="hero-meta"><span><ShieldCheck size={14}/> Updated just now</span><span className="hero-net">{t(language,'netWorth')}: {formatMoney(netWorth,language)}</span></div></div><div className="hero-art"><div className="hero-orbit orbit-a"/><div className="hero-orbit orbit-b"/><div className="hero-coin hero-coin-one">৳</div><div className="hero-coin hero-coin-two">✦</div><div className="hero-wallet"><Wallet size={36}/><div className="wallet-chip"/><div className="wallet-line"/></div><Sparkles className="hero-spark" size={22}/></div><div className="hero-bottom"><div><span>MONTHLY CASH FLOW</span><b>{formatMoney(income-expenses,language)}</b></div><div className="hero-mini-bar"><i style={{width:`${income+expenses===0?0:Math.min(100,income/(income+expenses)*100)}%`}}/></div><span className="hero-caption">{income>=expenses?'You are earning more than spending':'Your spending is higher this month'}</span></div></div>
    <div className="stats-grid"><StatCard label={t(language,'income')} value={formatMoney(income,language)} icon={ArrowDownLeft} tone="green" change="Income" small="Received this month"/><StatCard label={t(language,'expenses')} value={formatMoney(expenses,language)} icon={ArrowUpRight} tone="rose" small="Spent this month"/><StatCard label={t(language,'receivable')} value={formatMoney(receivable,language)} icon={HandCoins} tone="blue" small="Outstanding amount"/><StatCard label={t(language,'payable')} value={formatMoney(payable,language)} icon={CreditCard} tone="amber" small="Outstanding amount"/></div>
    <div className="dashboard-grid"><div className="panel cashflow-panel"><div className="panel-heading"><div><h3>{t(language,'cashFlow')}</h3><p>Income and expenses over the last 6 months</p></div><span className="period-pill">Last 6 months <ChevronDown size={13}/></span></div><div className="chart-legend"><span><i className="legend-dot income-dot"/>Income</span><span><i className="legend-dot expense-dot"/>Expenses</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:8,left:-18,bottom:0}}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#28b98d" stopOpacity={.2}/><stop offset="100%" stopColor="#28b98d" stopOpacity={0}/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef7892" stopOpacity={.18}/><stop offset="100%" stopColor="#ef7892" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)"/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:10}} tickFormatter={v=>`${v/1000}k`}/><Tooltip formatter={(v:any)=>formatMoney(Number(v)*100,language)} contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:12,color:'var(--text)'}}/><Area type="monotone" dataKey="income" name="Income" stroke="#28b98d" strokeWidth={2.5} fill="url(#incomeFill)"/><Area type="monotone" dataKey="expense" name="Expenses" stroke="#ef7892" strokeWidth={2.5} fill="url(#expenseFill)"/></AreaChart></ResponsiveContainer></div></div>
      <div className="panel spending-panel"><div className="panel-heading"><div><h3>{t(language,'spending')}</h3><p>Where your money goes</p></div><ActionMenu label="Spending chart menu" options={[{label:"View transactions",icon:ListFilter,onClick:()=>onNavigate('transactions')},{label:"View reports",icon:PieIcon,onClick:()=>onNavigate('reports')}]}/></div>{expenseByCategory.length? <><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none">{expenseByCategory.map((entry:any,index:number)=><Cell key={index} fill={entry.color}/>)}</Pie><Tooltip formatter={(v:any)=>formatMoney(Number(v)*100,language)} contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:12}}/></PieChart></ResponsiveContainer><div className="donut-center"><b>{formatMoney(expenses,language)}</b><span>Total spent</span></div></div><div className="category-legend">{expenseByCategory.slice(0,4).map((c:any)=><div key={c.name}><span><i style={{background:c.color}}/>{c.name}</span><b>{formatMoney(c.value*100,language)}</b></div>)}</div></>:<EmptyState text={t(language,'noData')}/>}</div></div>
    <div className="dashboard-grid lower-grid"><div className="panel recent-panel"><div className="panel-heading"><div><h3>{t(language,'recent')}</h3><p>Your latest money movements</p></div><button className="text-link" onClick={()=>onNavigate('transactions')}>{t(language,'seeAll')} <ArrowUpRight size={14}/></button></div><TransactionTable transactions={recent} language={language}/></div><div className="panel upcoming-panel"><div className="panel-heading"><div><h3>{t(language,'upcoming')}</h3><p>Keep your commitments on track</p></div><button className="icon-btn subtle" title="Open due payments" onClick={()=>onNavigate('loans')}><CalendarDays size={17}/></button></div>{upcoming.length?upcoming.map((d:Debt)=><div className="upcoming-item" key={d.id}><div className="upcoming-date"><b>{d.due_date?new Date(`${d.due_date?.slice(0,10)}T12:00:00+06:00`).getUTCDate():'—'}</b><span>{d.due_date?new Date(`${d.due_date?.slice(0,10)}T12:00:00+06:00`).toLocaleDateString(language==='bn'?'bn-BD':'en-US',{month:'short'}):'No date'}</span></div><div className="upcoming-info"><b>{d.contact_name}</b><span>{d.direction==='i_owe'?'You need to pay':'Expected from them'}</span></div><div className="upcoming-amount"><b>{formatMoney(d.remaining_paisa,language)}</b><button onClick={()=>onPayment(d)}>Update</button></div></div>):<EmptyState text="No upcoming payments"/>}</div></div>
  </div>;
}

function TransactionTable({transactions,language}:{transactions:Transaction[];language:Language}) {
  const {data}=useApp();
  if (!transactions.length) return <EmptyState text={t(language,'noData')}/>;
  return <div className="transaction-list">{transactions.map(tx=>{const isTransfer=tx.kind==='transfer';const isIncome=tx.kind==='income'||tx.kind==='loan_received'||tx.kind==='receivable_collection';const cat=data.categories.find(c=>c.id===tx.category_id);const Icon=categoryIcon[tx.category_name||cat?.name||'']||CircleDollarSign;return <div className="transaction-row" key={tx.id}><div className={`tx-icon ${isIncome?'tx-income':'tx-expense'}`}><Icon size={17}/></div><div className="tx-main"><b>{tx.description}</b><span>{tx.category_name||tx.kind.replace('_',' ')} · {tx.account_name||data.accounts.find(a=>a.id===tx.account_id)?.name||'Account'}</span></div><div className="tx-right"><b className={isTransfer?'amount-neutral':isIncome?'amount-positive':'amount-negative'}>{isTransfer?'↔':isIncome?'+':'−'}{formatMoney(tx.amount_paisa,language)}</b><span>{new Date(tx.occurred_at).toLocaleDateString(language==='bn'?'bn-BD':'en-GB',{day:'2-digit',month:'short'})}</span></div></div>})}</div>;
}

function TransactionsPage({data,language,search,onAdd}:{data:any;language:Language;search:string;onAdd:()=>void}) {
  const [filter,setFilter]=useState('all');const [filtersOpen,setFiltersOpen]=useState(false);const [accountFilter,setAccountFilter]=useState('all');const [dateFilter,setDateFilter]=useState('all');
  const filtered=(data.transactions as Transaction[]).filter(tx=>{
    const kindOk=filter==='all'||tx.kind===filter||(filter==='loans'&&['loan_given','loan_received','debt_repayment','receivable_collection'].includes(tx.kind));
    const q=search.trim().toLowerCase();const text=`${tx.description} ${tx.account_name||''} ${tx.category_name||''} ${tx.contact_name||''}`.toLowerCase();
    const accountOk=accountFilter==='all'||[tx.account_id,tx.from_account_id,tx.to_account_id].includes(accountFilter);
    const date=dhakaYearMonth(new Date(tx.occurred_at));const now=dhakaYearMonth();
    const dateOk=dateFilter==='all'||(dateFilter==='month'&&date.year===now.year&&date.month===now.month)||(dateFilter==='year'&&date.year===now.year)||(dateFilter==='last'&&(date.year*12+date.month===now.year*12+now.month-1));
    return kindOk&&accountOk&&dateOk&&(!q||text.includes(q));
  });
  return <><SectionHeading title={t(language,'transactions')} subtitle="A complete timeline of money in and money out." action={onAdd} actionLabel={t(language,'addTransaction')}/><div className="filter-toolbar"><div className="filter-tabs">{[{id:'all',name:t(language,'all')},{id:'income',name:t(language,'incomeLabel')},{id:'expense',name:t(language,'expenseLabel')},{id:'transfer',name:'Transfer'},{id:'loans',name:'Loans'}].map(f=><button key={f.id} className={filter===f.id?'selected':''} onClick={()=>setFilter(f.id)}>{f.name}</button>)}</div><button type="button" className="secondary-btn small filter-label" onClick={()=>setFiltersOpen(x=>!x)} aria-expanded={filtersOpen}><Filter size={15}/>{language==='bn'?'ফিল্টার':'Filters'}</button><span className="result-count">{filtered.length} records</span></div>{filtersOpen&&<div className="panel extended-filters"><label>Account<select value={accountFilter} onChange={e=>setAccountFilter(e.target.value)}><option value="all">All accounts</option>{data.accounts.filter((a:Account)=>!a.archived_at).map((a:Account)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Period<select value={dateFilter} onChange={e=>setDateFilter(e.target.value)}><option value="all">All dates</option><option value="month">This month</option><option value="last">Last month</option><option value="year">This year</option></select></label><button className="secondary-btn small" onClick={()=>{setFilter('all');setAccountFilter('all');setDateFilter('all')}}>Reset filters</button></div>}<div className="panel table-panel"><div className="table-header"><span>TRANSACTION</span><span>CATEGORY</span><span>ACCOUNT</span><span>DATE</span><span className="align-right">AMOUNT</span></div>{filtered.length?filtered.map(tx=><div className="table-row" key={tx.id}><div className="table-transaction"><div className={`tx-icon ${tx.kind==='income'?'tx-income':'tx-expense'}`}><CircleDollarSign size={16}/></div><div><b>{tx.description}</b><small>{tx.kind.replace('_',' ')}</small></div></div><span>{tx.category_name||'—'}</span><span>{tx.account_name||data.accounts.find((a:Account)=>a.id===tx.account_id)?.name||'—'}</span><span>{new Date(tx.occurred_at).toLocaleDateString(language==='bn'?'bn-BD':'en-GB',{timeZone:'Asia/Dhaka'})}</span><b className={`align-right ${tx.kind==='transfer'?'amount-neutral':(['income','loan_received','receivable_collection'].includes(tx.kind)?'amount-positive':'amount-negative')}`}>{tx.kind==='transfer'?'↔':(['income','loan_received','receivable_collection'].includes(tx.kind)?'+':'−')}{formatMoney(tx.amount_paisa,language)}</b></div>):<EmptyState text={t(language,'noData')}/>}</div></>;
}

function AccountsPage({data,language,onAdd,onEdit,onArchive,onView,onTransfer,onAddExpense,onAddIncome}:{data:any;language:Language;onAdd:()=>void;onEdit:(a:Account)=>void;onArchive:(a:Account)=>void;onView:(a:Account)=>void;onTransfer:(a:Account)=>void;onAddExpense?:(accId:string)=>void;onAddIncome?:(accId:string)=>void}){
  return <><SectionHeading title={t(language,'accounts')} subtitle={language==='bn'?'আপনার সকল ক্যাশ, ব্যাংক ও বিকাশ এক জায়গায়।':'All your money, organized in one place.'} action={onAdd} actionLabel={t(language,'addAccount')}/><div className="account-grid">{data.accounts.map((a:Account,i:number)=>{const value=a.balance_paisa;const Icon=a.account_type==='cash'?Banknote:a.account_type==='mobile_wallet'?Smartphone:CreditCard;return <div className={`account-card account-card-${i%3} ${a.archived_at?'is-archived':''}`} key={a.id}><div className="account-card-top"><div className="account-icon"><Icon size={21}/></div><ActionMenu label={`Actions for ${a.name}`} options={[{label:'View transactions',icon:ListFilter,onClick:()=>onView(a)},{label:'Transfer funds',icon:ArrowLeftRight,disabled:!!a.archived_at,onClick:()=>onTransfer(a)},{label:'Rename account',icon:Edit3,disabled:!!a.archived_at,onClick:()=>onEdit(a)},{label:a.archived_at?'Restore account':'Archive account',icon:a.archived_at?RotateCcw:Archive,danger:!a.archived_at,onClick:()=>onArchive(a)}]}/></div><span>{a.account_type.replace('_',' ').toUpperCase()}</span><h3>{a.name}</h3><strong>{formatMoney(value,language)}</strong><div className="account-card-bottom"><span>{language==='bn'?'বর্তমান ব্যালেন্স':'Available balance'}</span><span><Activity size={13}/>{a.archived_at?'Archived':'Active'}</span></div>{!a.archived_at&&onAddExpense&&onAddIncome&&<div style={{display:'flex',gap:8,marginTop:14}}><button type="button" className="secondary-btn small" style={{flex:1,justifyContent:'center',fontWeight:700}} onClick={(e)=>{e.stopPropagation();onAddExpense(a.id)}}>− {language==='bn'?'খরচ লিখুন':'Expense'}</button><button type="button" className="secondary-btn small" style={{flex:1,justifyContent:'center',fontWeight:700}} onClick={(e)=>{e.stopPropagation();onAddIncome(a.id)}}>+ {language==='bn'?'আয় যোগ করুন':'Income'}</button></div>}</div>})}<button className="add-account-card" onClick={onAdd}><div><Plus size={22}/></div><b>{language==='bn'?'আরেকটি অ্যাকাউন্ট যোগ করুন':'Add another account'}</b><span>{language==='bn'?'ক্যাশ, ব্যাংক বা মোবাইল ওয়ালেট (বিকাশ)':'Cash, bank or mobile wallet'}</span></button></div><div className="panel account-note"><div className="note-icon"><ShieldCheck size={19}/></div><div><b>{language==='bn'?'অ্যাকাউন্টগুলো স্বয়ংক্রিয়ভাবে সিঙ্ক থাকে':'Your accounts stay in sync'}</b><p>{language==='bn'?'নিজের এক অ্যাকাউন্ট থেকে অন্য অ্যাকাউন্টে ট্রান্সফার করলে মূল মোট ব্যালেন্স অপরিবর্তিত থাকে।':'Transfers between your own accounts move money without counting as income or expense.'}</p></div></div></>;
}

function LoansPage({data,language,search,hiddenDebtIds=[],onDelete,onUnhide,onRestoreAll,onAdd,onPayment}:{data:any;language:Language;search:string;hiddenDebtIds?:string[];onDelete?:(d:Debt)=>void;onUnhide?:(id:string)=>void;onRestoreAll?:()=>void;onAdd:()=>void;onPayment:(d:Debt)=>void}) {
  const [tab,setTab]=useState<'active'|'settled'|'they_owe'|'i_owe'|'all'>('active');
  const allDebts=(data.debts as Debt[]).filter(d=>!hiddenDebtIds.includes(d.id));
  const filtered=allDebts.filter(d=>{
    if(tab==='active'&&(d.status==='settled'||d.remaining_paisa===0))return false;
    if(tab==='settled'&&d.status!=='settled'&&d.remaining_paisa>0)return false;
    if(tab==='i_owe'&&d.direction!=='i_owe')return false;
    if(tab==='they_owe'&&d.direction!=='they_owe')return false;
    if(search.trim())return `${d.contact_name} ${d.notes||''}`.toLowerCase().includes(search.trim().toLowerCase());
    return true;
  });
  const totals=debtTotals(data.debts);
  const activeCount=allDebts.filter(d=>d.remaining_paisa>0).length;
  const settledCount=allDebts.filter(d=>d.status==='settled'||d.remaining_paisa===0).length;

  return <><SectionHeading title={t(language,'loans')} subtitle={language==='bn'?'কারো থেকে ধার নিলে বা দিলে তারিখ অনুযায়ী প্রতিটি কিস্তির হিসাব রাখুন।':'Track borrowed money, lending and every repayment.'} action={onAdd} actionLabel={t(language,'addLoan')}/><div className="debt-summary-grid"><div className="debt-summary-card owed"><span>{language==='bn'?'আপনি পাবেন (পাওনা)':'OWED TO YOU'}</span><strong>{formatMoney(totals.receivable,language)}</strong><small>{language==='bn'?'ধার দিয়েছেন, ফেরত পাবেন':'Money expected back'}</small><HandCoins size={23}/></div><div className="debt-summary-card owe"><span>{language==='bn'?'আপনার দেনা (পরিশোধ করতে হবে)':'YOU OWE'}</span><strong>{formatMoney(totals.payable,language)}</strong><small>{language==='bn'?'ধার নিয়েছেন, শোধ করবেন':'Your outstanding repayments'}</small><CreditCard size={23}/></div></div><div className="filter-toolbar"><div className="filter-tabs">{[{id:'active',label:language==='bn'?`চলমান দেনা-পাওনা (${activeCount})`:`Active (${activeCount})`},{id:'settled',label:language==='bn'?`পরিশোধিত / ক্লিয়ার (${settledCount})`:`Settled (${settledCount})`},{id:'they_owe',label:language==='bn'?'আমার পাওনা':'Owed to me'},{id:'i_owe',label:language==='bn'?'আমার দেনা':'I owe'},{id:'all',label:language==='bn'?'সব রেকর্ড':'All'}].map((x:any)=><button key={x.id} className={tab===x.id?'selected':''} onClick={()=>setTab(x.id)}>{x.label}</button>)}</div><span className="result-count">{filtered.length} {language==='bn'?'টি রেকর্ড':'records'}</span></div><div className="debt-grid">{filtered.map(debt=><DebtCard key={debt.id} debt={debt} payments={data.payments.filter((p:any)=>p.debt_id===debt.id)} language={language} onPayment={()=>onPayment(debt)} onDelete={()=>onDelete?.(debt)}/>)}</div>{!filtered.length&&<div className="panel empty-panel"><EmptyState text={tab==='settled'?(language==='bn'?'কোনো পরিশোধিত ঋণ পাওয়া যায়নি।':'No settled loans found.'):tab==='active'?(language==='bn'?'🎉 চমৎকার! কোনো বাকি দেনা বা পাওনা নেই। সব হিসাব ক্লিয়ার!':'All caught up! No active debts or dues.'):(language==='bn'?'এখনও কোনো ঋণের হিসাব নেই। উপরে "ঋণ / পাওনা যোগ করুন" বাটনে ক্লিক করে শুরু করুন।':'No loan records yet. Add a loan or a receivable to get started.')}/></div>}{hiddenDebtIds.length>0&&onRestoreAll&&<div className="hidden-debts-bar"><span>💡 {language==='bn'?`আপনি ${hiddenDebtIds.length} টি পরিশোধিত/পুরনো কার্ড সরিয়ে রেখেছেন`:`You have ${hiddenDebtIds.length} hidden loan records`}</span><button type="button" className="restore-btn" onClick={onRestoreAll}><RotateCcw size={12}/> {language==='bn'?'সব কার্ড ফিরিয়ে আনুন':'Restore all'}</button></div>}</>;
}

function DebtCard({debt,payments,language,onPayment,onDelete}:{debt:Debt;payments:any[];language:Language;onPayment:()=>void;onDelete?:()=>void}) {
  const progress=paymentProgress(debt);
  const isSettled=debt.status==='settled'||debt.remaining_paisa===0;
  const isDueOwing=debt.direction==='i_owe'&&debt.remaining_paisa>0;

  return <div className={`panel debt-card ${isSettled?'debt-settled':''} ${isDueOwing?'debt-due-owing':''}`}>{isSettled&&<div className="settled-banner"><span style={{display:'flex',alignItems:'center',gap:'6px'}}><CheckCircle2 size={15} color="#10b981"/>{language==='bn'?'সম্পূর্ণ পরিশোধিত · হিসাব ক্লিয়ার!':'Fully Settled · Balance Cleared!'}</span><span className="status-pill settled">{language==='bn'?'✓ ক্লিয়ার':'✓ Settled'}</span></div>}<div className="debt-card-top"><div className="person-avatar">{debt.contact_name.slice(0,1)}</div><div className="debt-person"><b>{debt.contact_name}</b><span>{debt.direction==='i_owe'?(language==='bn'?'আপনি ধার নিয়েছেন (দেনা)':'You borrowed'):(language==='bn'?'আপনি ধার দিয়েছেন (পাওনা)':'You lent')}</span>{isDueOwing&&<div className="due-warning-tag"><AlertCircle size={11}/> {language==='bn'?'বাকি দেনা · পরিশোধ করতে হবে':'Outstanding due'}</div>}</div>{!isSettled&&<span className={`status-pill ${debt.status}`}>{debt.status==='overdue'?t(language,'overdue'):debt.status==='partial'?(language==='bn'?'আংশিক পরিশোধ':t(language,'partial')):(language==='bn'?'বাকি আছে':t(language,'pending'))}</span>}</div><div className="debt-amounts"><div><span>{language==='bn'?'মূল ঋণের পরিমাণ':'ORIGINAL AMOUNT'}</span><b>{formatMoney(debt.principal_paisa,language)}</b></div><div><span>{language==='bn'?'বাকি দেনা':'REMAINING'}</span><b className={`debt-remaining ${isSettled?'settled-green':'due-red'}`}>{isSettled?(language==='bn'?'✓ ৳ ০ (পরিশোধিত)':'✓ BDT 0 (Settled)'):formatMoney(debt.remaining_paisa,language)}</b></div></div><div className="progress-label"><span>{formatMoney(debt.paid_paisa,language)} {language==='bn'?'পরিশোধ হয়েছে':'paid'}</span><b>{Math.round(progress)}%</b></div><div className={`progress-track ${isSettled?'settled':''}`}><i style={{width:`${progress}%`}}/></div>{payments.length>0?<div className="debt-payment-history"><span>{language==='bn'?'কিস্তি ও পরিশোধের তালিকা:':'PAYMENT HISTORY:'}</span>{payments.map((p:any)=><div key={p.id}><span>📅 {new Date(p.paid_at).toLocaleDateString(language==='bn'?'bn-BD':'en-GB',{day:'2-digit',month:'short',year:'numeric'})}{p.note?` (${p.note})`:''}</span><b>− {formatMoney(p.amount_paisa,language)}</b></div>)}</div>:<div className="debt-payment-history" style={{paddingTop:6}}><span style={{fontSize:'11px',color:'var(--muted)'}}>{language==='bn'?'এখনও কোনো কিস্তি পরিশোধ করা হয়নি':'No repayments recorded yet'}</span></div>}<div className="debt-card-bottom" style={{marginTop:12}}><span><CalendarDays size={13}/> {debt.due_date?new Date(`${debt.due_date?.slice(0,10)}T12:00:00+06:00`).toLocaleDateString(language==='bn'?'bn-BD':'en-GB'):language==='bn'?'কোনো নির্দিষ্ট তারিখ নেই':'No due date'}</span>{isSettled?<button type="button" className="secondary-btn small delete-debt-btn" onClick={onDelete} title={language==='bn'?'কার্ডটি সরান':'Remove card'}><Trash2 size={14}/> {language==='bn'?'কার্ডটি সরান':'Remove card'}</button>:<button className="primary-btn small" onClick={onPayment}><Plus size={14}/>{debt.direction==='i_owe'?(language==='bn'?'টাকা / কিস্তি পরিশোধ করুন':'Repay'):(language==='bn'?'টাকা গ্রহণ করুন':'Add payment')}</button>}</div></div>;
}

function PeoplePage({data,language,onAdd,onEdit,onHistory,onLoans,onCopy,onNewLoan}:{data:any;language:Language;onAdd:()=>void;onEdit:(c:Contact)=>void;onHistory:(name:string)=>void;onLoans:(name:string)=>void;onCopy:(phone:string)=>void;onNewLoan:(name:string)=>void}){
  return <><SectionHeading title={t(language,'people')} subtitle="People connected to your financial activity." action={onAdd} actionLabel={language==='bn'?'ব্যক্তি যোগ করুন':'Add contact'}/><div className="people-grid">{data.contacts.map((c:Contact)=>{const debts=(data.debts as Debt[]).filter(d=>d.contact_id===c.id);const owed=debts.filter(d=>d.direction==='they_owe').reduce((n,d)=>n+d.remaining_paisa,0);const owe=debts.filter(d=>d.direction==='i_owe').reduce((n,d)=>n+d.remaining_paisa,0);return <div className="panel person-card" key={c.id}><div className="person-card-top"><div className="person-avatar large">{c.name.slice(0,1)}</div><div><b>{c.name}</b><span>{c.phone||'No phone number'}</span></div><ActionMenu label={`Actions for ${c.name}`} options={[{label:'View loans',icon:HandCoins,onClick:()=>onLoans(c.name)},{label:'View transactions',icon:ListFilter,onClick:()=>onHistory(c.name)},{label:'Add loan',icon:Plus,onClick:()=>onNewLoan(c.name)},{label:'Edit contact',icon:Edit3,onClick:()=>onEdit(c)},{label:'Copy phone',icon:Copy,disabled:!c.phone,onClick:()=>onCopy(c.phone||'')}]}/></div><div className="person-finances"><div><span>OWED TO YOU</span><b className="amount-positive">{formatMoney(owed,language)}</b></div><div><span>YOU OWE</span><b className="amount-negative">{formatMoney(owe,language)}</b></div></div><div className="person-card-foot"><span>{debts.length} financial records</span><span><ShieldCheck size={13}/> Contact saved</span></div></div>})}</div>{!data.contacts.length&&<EmptyState text={t(language,'noData')}/>}</>;
}

function ReportsPage({data,language}:{data:any;language:Language}) {
  const year=dhakaYearMonth().year;
  const months=Array.from({length:12},(_,m)=>{const s=summarizeMonth(data.transactions,year,m);return {month:new Date(year,m,1).toLocaleDateString(language==='bn'?'bn-BD':'en-US',{month:'short'}),income:s.income/100,expense:s.expenses/100}});
  const totalIncome=data.transactions.filter((x:Transaction)=>x.kind==='income').reduce((s:number,x:Transaction)=>s+x.amount_paisa,0);
  const totalExpense=data.transactions.filter((x:Transaction)=>x.kind==='expense').reduce((s:number,x:Transaction)=>s+x.amount_paisa,0);
  return <><SectionHeading title={t(language,'reports')} subtitle="Understand your patterns and make confident decisions."/><div className="stats-grid report-stats"><StatCard label="Total income" value={formatMoney(totalIncome,language)} icon={TrendingUp} tone="green" small="All recorded time"/><StatCard label="Total expenses" value={formatMoney(totalExpense,language)} icon={TrendingDown} tone="rose" small="All recorded time"/><StatCard label="Net cash flow" value={formatMoney(totalIncome-totalExpense,language)} icon={Activity} tone="blue" small="Income minus expenses"/></div><div className="panel report-chart-panel"><div className="panel-heading"><div><h3>Yearly cash flow</h3><p>Monthly comparison for {year}</p></div><span className="period-pill">{year}</span></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{top:12,right:8,left:-16,bottom:0}}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)"/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:10}} tickFormatter={v=>`${v/1000}k`}/><Tooltip formatter={(v:any)=>formatMoney(Number(v)*100,language)} contentStyle={{background:'var(--panel)',border:'1px solid var(--line)',borderRadius:12}}/><Legend/><Bar dataKey="income" name="Income" fill="#27b88c" radius={[5,5,0,0]}/><Bar dataKey="expense" name="Expenses" fill="#ed7890" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div><div className="panel report-note"><FileText size={20}/><div><b>Keep your reports reliable</b><p>Borrowed principal, lent principal, repayments and internal transfers are excluded from income and expense totals.</p></div></div></>;
}

function SettingsPage({data,language,theme,setLanguage,setTheme,signOut,demoMode}:{data:any;language:Language;theme:'light'|'dark';setLanguage:(l:Language)=>void;setTheme:(t:'light'|'dark')=>void;signOut:()=>void;demoMode:boolean}) {
  const exportData = () => {
    const payload = { exported_at: new Date().toISOString(), application: 'Amar Hisab', currency: 'BDT', data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `amar-hisab-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  return <><SectionHeading title={t(language,'settings')} subtitle="Make Amar Hisab feel like yours."/><div className="settings-layout"><div className="panel settings-card"><div className="settings-title"><div className="settings-icon"><UserRound size={18}/></div><div><b>Profile & account</b><span>Manage your personal workspace</span></div></div><div className="settings-row"><div><b>Workspace</b><span>Private cloud workspace</span></div><span className="status-pill open">Active</span></div><div className="settings-row"><div><b>Currency</b><span>Bangladeshi Taka (BDT)</span></div><b>৳ BDT</b></div><div className="settings-row"><div><b>Timezone</b><span>All reports use Bangladesh time</span></div><b>Asia/Dhaka</b></div></div><div className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Sun size={18}/></div><div><b>{t(language,'appearance')}</b><span>Choose how your workspace looks</span></div></div><div className="choice-row"><button className={theme==='light'?'choice active':'choice'} onClick={()=>setTheme('light')}><Sun size={17}/> Light</button><button className={theme==='dark'?'choice active':'choice'} onClick={()=>setTheme('dark')}><Moon size={17}/> Dark</button></div></div><div className="panel settings-card"><div className="settings-title"><div className="settings-icon"><Globe2 size={18}/></div><div><b>{t(language,'language')}</b><span>Choose your preferred language</span></div></div><div className="choice-row"><button className={language==='bn'?'choice active':''} onClick={()=>setLanguage('bn')}>বাংলা</button><button className={language==='en'?'choice active':''} onClick={()=>setLanguage('en')}>English</button></div></div><div className="panel settings-card"><div className="settings-title"><div className="settings-icon"><ShieldCheck size={18}/></div><div><b>Privacy & security</b><span>Your records are private to your account</span></div></div><p className="settings-description">Use a strong unique password, enable two-factor authentication on your identity provider, and export your data regularly. Cloud mode requires Supabase Row Level Security and database backup configuration.</p><div className="settings-tools"><button className="secondary-btn small" onClick={exportData}><Download size={15}/> Export my data (JSON)</button><button className="secondary-btn small" onClick={()=>window.dispatchEvent(new Event('ah-show-install'))}><Smartphone size={15}/> Install mobile app</button></div></div><div className="settings-signout"><button className="danger-btn" onClick={()=>{Promise.resolve(signOut()).catch(e=>window.alert(e instanceof Error?e.message:'Sign out failed'))}}><LogOut size={16}/> {t(language,'logout')}</button></div></div></>;
}

function TransactionModal({data,language,defaults,onClose,onDone,onAddAccount}:{data:any;language:Language;defaults:{kind:'income'|'expense'|'transfer';accountId:string}|null;onClose:()=>void;onDone:(m:string)=>void;onAddAccount?:()=>void}) {
  const {addTransaction,addTransfer}=useApp();
  const [kind,setKind]=useState<'income'|'expense'|'transfer'>(defaults?.kind||'expense');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [toAccountId,setToAccountId]=useState(data.accounts.find((a:Account)=>!a.archived_at&&a.id!==defaults?.accountId)?.id||'');
  const [amount,setAmount]=useState('');const [accountId,setAccountId]=useState(defaults?.accountId||data.accounts.find((a:Account)=>!a.archived_at)?.id||'');const [categoryId,setCategoryId]=useState('');const [date,setDate]=useState(dhakaInputNow());const [description,setDescription]=useState('');const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const categories=kind==='transfer'?[]:data.categories.filter((c:any)=>c.type===kind);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('');try{if(kind==='transfer'){await addTransfer(accountId,toAccountId,Number(amount),date,description,idempotencyKey)}else{await addTransaction({kind,amount:Number(amount),accountId,categoryId,date,description,notes,idempotencyKey})}onDone(language==='bn'?'লেনদেন সফলভাবে যোগ হয়েছে':'Transaction added successfully');onClose()}catch(error){setErr(error instanceof Error?error.message:'Unable to save transaction')}finally{setBusy(false)}};
  return <Modal title={t(language,'addTransaction')} subtitle={language==='bn'?'কয়েক সেকেন্ডে আয় বা খরচের হিসাব লিখে রাখুন।':'Record a money movement in a few seconds.'} onClose={onClose}><form className="form-stack" onSubmit={submit}><div className="segmented-control three"><button type="button" className={kind==='expense'?'selected expense-selected':''} onClick={()=>{setKind('expense');setCategoryId('')}}><ArrowUpRight size={16}/> {t(language,'expenseLabel')}</button><button type="button" className={kind==='income'?'selected income-selected':''} onClick={()=>{setKind('income');setCategoryId('')}}><ArrowDownLeft size={16}/> {t(language,'incomeLabel')}</button><button type="button" className={kind==='transfer'?'selected':''} onClick={()=>{setKind('transfer');setCategoryId('')}}><ArrowLeftRight size={15}/> Transfer</button></div><label>{language==='bn'?'টাকার পরিমাণ (৳)':'Amount (৳)'}<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" autoFocus/></label>{kind==='transfer'?<div className="form-two"><label>{language==='bn'?'যে অ্যাকাউন্ট থেকে দেবেন':'From account'}<select required value={accountId} onChange={e=>setAccountId(e.target.value)}>{data.accounts.filter((a:Account)=>!a.archived_at).map((a:Account)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>{language==='bn'?'যে অ্যাকাউন্টে জমা হবে':'To account'}<select required value={toAccountId} onChange={e=>setToAccountId(e.target.value)}>{data.accounts.filter((a:Account)=>!a.archived_at).map((a:Account)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>:<div className="form-two"><label>{language==='bn'?'ক্যাটাগরি (ঐচ্ছিক)':'Category'}<select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">{language==='bn'?'সাধারণ / যেকোনো খাত (ঐচ্ছিক)':'General / Optional'}</option>{categories.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>{language==='bn'?'অ্যাকাউন্ট (ক্যাশ/বিকাশ/ব্যাংক)':'Account (Cash/Bank)'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{cursor:'pointer'}}><option value="">{language==='bn'?(data.accounts.length?`স্বয়ংক্রিয় (${data.accounts[0]?.name})`:'স্বয়ংক্রিয় অ্যাকাউন্ট'):'Auto / Default'}</option>{data.accounts.filter((a:Account)=>!a.archived_at).map((a:Account)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>}<label>{language==='bn'?'বিবরণ (কিসের খরচ বা আয়)':'Description'}<input required value={description} onChange={e=>setDescription(e.target.value)} placeholder={language==='bn'?'যেমন: কারেন্ট বিল, বাজার, ইত্যাদি':'What was this for?'}/></label><label>{language==='bn'?'তারিখ ও সময়':'Date & time'}<input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>{language==='bn'?'নোট':'Notes'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder={language==='bn'?'অতিরিক্ত তথ্য (ঐচ্ছিক)…':'Add a little context…'}/></label>{!data.accounts.length&&<div className="inline-message error" style={{display:'flex',flexDirection:'column',gap:8}}><span>{language==='bn'?'⚠️ কোনো অ্যাকাউন্ট নেই। হিসাব রাখতে আগে একটি অ্যাকাউন্ট যোগ করুন।':'⚠️ You need an account first.'}</span>{onAddAccount&&<button type="button" className="secondary-btn small" onClick={onAddAccount}>+ {language==='bn'?'অ্যাকাউন্ট যোগ করুন (ক্যাশ/বিকাশ)':'Add account'}</button>}</div>}{err&&<div className="inline-message error">{err}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>{t(language,'cancel')}</button><button className="primary-btn" disabled={busy||!data.accounts.length}>{busy?'Saving…':(language==='bn'?'সংরক্ষণ করুন':'Save')} <Check size={16}/></button></div></form></Modal>;
}

function AccountModal({account,language,onClose,onDone}:{account:Account|null;language:Language;onClose:()=>void;onDone:(m:string)=>void}){
  const {addAccount,updateAccount}=useApp();const [name,setName]=useState(account?.name||'');const [type,setType]=useState<Account['account_type']>(account?.account_type||'cash');const [balance,setBalance]=useState('0');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('');try{if(account)await updateAccount(account.id,name);else await addAccount(name,type,Number(balance));onDone(account?'Account updated':'Account added');onClose()}catch(e){setErr(e instanceof Error?e.message:'Could not save account')}finally{setBusy(false)}};
  return <Modal title={account?'Rename account':t(language,'addAccount')} onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Account name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>{!account&&<><label>Account type<select value={type} onChange={e=>setType(e.target.value as Account['account_type'])}><option value="cash">Cash</option><option value="bank">Bank account</option><option value="mobile_wallet">Mobile wallet</option><option value="other">Other</option></select></label><label>Opening balance (৳)<input type="number" step="0.01" min="0" value={balance} onChange={e=>setBalance(e.target.value)}/></label></>}{account&&<p className="muted">Opening balances cannot be altered here to protect your financial history.</p>}{err&&<div className="inline-message error">{err}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>{t(language,'cancel')}</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':t(language,'save')} <Check size={16}/></button></div></form></Modal>;
}
function ContactModal({contact,language,onClose,onDone}:{contact:Contact|null;language:Language;onClose:()=>void;onDone:(m:string)=>void}){
  const {addContact,updateContact}=useApp();const [name,setName]=useState(contact?.name||'');const [phone,setPhone]=useState(contact?.phone||'');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('');try{if(contact)await updateContact(contact.id,name,phone);else await addContact(name,phone);onDone('Contact saved');onClose()}catch(e){setErr(e instanceof Error?e.message:'Could not save contact')}finally{setBusy(false)}};
  return <Modal title={contact?'Edit contact':language==='bn'?'ব্যক্তি যোগ করুন':'Add contact'} onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Name<input required value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label><label>Phone<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>{err&&<div className="inline-message error">{err}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>{t(language,'cancel')}</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':t(language,'save')} <Check size={16}/></button></div></form></Modal>;
}

function DebtModal({data,language,defaultContact,onClose,onDone,onAddAccount}:{data:any;language:Language;defaultContact?:string;onClose:()=>void;onDone:(m:string)=>void;onAddAccount?:()=>void}) {
  const {addDebt}=useApp();const [idempotencyKey] = useState(() => crypto.randomUUID());const [direction,setDirection]=useState<'they_owe'|'i_owe'>('they_owe');const [contactName,setContactName]=useState(defaultContact||'');const [phone,setPhone]=useState('');const [amount,setAmount]=useState('');const [accountId,setAccountId]=useState('');const [date,setDate]=useState(dhakaInputNow());const [dueDate,setDueDate]=useState('');const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await addDebt({contactName,phone,direction,amount:Number(amount),accountId:accountId||undefined,date,dueDate,notes,idempotencyKey});onDone(language==='bn'?'ঋণের হিসাব যোগ হয়েছে':'Loan record added');onClose()}catch(e){setErr(e instanceof Error?e.message:'Could not save loan')}finally{setBusy(false)}};
  return <Modal title={t(language,'addLoan')} subtitle={language==='bn'?'ধার নেওয়া বা দেওয়ার হিসাব সংরক্ষণ করুন।':'Keep the original amount and due date on record.'} onClose={onClose}><form className="form-stack" onSubmit={submit}><div className="segmented-control"><button type="button" className={direction==='they_owe'?'selected income-selected':''} onClick={()=>setDirection('they_owe')}><ArrowDownLeft size={16}/> {language==='bn'?'আমি দিয়েছি (পাওনা - ফেরত পাব)':'They owe me'}</button><button type="button" className={direction==='i_owe'?'selected expense-selected':''} onClick={()=>setDirection('i_owe')}><ArrowUpRight size={16}/> {language==='bn'?'আমি নিয়েছি (দেনা - শোধ করব)':'I borrowed'}</button></div><label>{language==='bn'?'ব্যক্তির নাম':'Person name'}<input required value={contactName} onChange={e=>setContactName(e.target.value)} placeholder={language==='bn'?'কার সাথে লেনদেন? (যেমন: রহিম ভাই)':'Full name'}/></label><label>{language==='bn'?'ফোন নম্বর':'Phone'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label><label>{language==='bn'?'টাকার পরিমাণ (৳)':'Amount (৳)'}<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>{language==='bn'?(direction==='i_owe'?'যে অ্যাকাউন্টে টাকা জমা হবে (ঐচ্ছিক)':'যে অ্যাকাউন্ট থেকে টাকা দিয়েছেন (ঐচ্ছিক)'):'Account (Optional)'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{cursor:'pointer'}}><option value="">{language==='bn'?'অ্যাকাউন্ট ছাড়া / ঐচ্ছিক (হাতে হাতে লেনদেন)':'No account / Optional (Cash in hand)'}</option>{data.accounts.filter((a:Account)=>!a.archived_at).map((a:Account)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{accountId?(<div style={{fontSize:'12px',color:'#554fe0',background:'#f0eeff',padding:'6px 10px',borderRadius:'8px',marginTop:'-4px',marginBottom:'4px',display:'flex',alignItems:'center',gap:'6px'}}><Check size={14}/><span>{language==='bn'?`বাছাইকৃত অ্যাকাউন্ট: ${data.accounts.find((a:Account)=>a.id===accountId)?.name}`:`Selected: ${data.accounts.find((a:Account)=>a.id===accountId)?.name}`}</span></div>):(<div style={{fontSize:'12px',color:'var(--muted)',background:'var(--panel-soft)',padding:'6px 10px',borderRadius:'8px',marginTop:'-4px',marginBottom:'4px',display:'flex',alignItems:'center',gap:'6px'}}><span>💡 {language==='bn'?'অ্যাকাউন্ট বাছাই না করলেও চলবে, হিসাব স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।':'Account is optional — this will be saved smoothly.'}</span></div>)}<div className="form-two"><label>{language==='bn'?'লেনদেনের তারিখ':'Start date'}<input type="date" required value={date.slice(0,10)} onChange={e=>setDate(`${e.target.value}T12:00`)}/></label><label>{language==='bn'?'পরিশোধের শেষ তারিখ':'Due date'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div><label>{language==='bn'?'নোট':'Notes'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={language==='bn'?'চুক্তি বা কারণ (ঐচ্ছিক)…':'Reason or agreement details'}/></label>{!data.accounts.length&&<div className="inline-message" style={{display:'flex',flexDirection:'column',gap:8}}><span>{language==='bn'?'💡 আপনার কোনো অ্যাকাউন্ট যোগ করা নেই। আপনি চাইলে অ্যাকাউন্ট ছাড়াই সরাসরি হিসাব রাখতে পারেন, অথবা অ্যাকাউন্ট যোগ করে নিতে পারেন।':'💡 You can record loans without an account, or add one below.'}</span>{onAddAccount&&<button type="button" className="secondary-btn small" onClick={onAddAccount}>+ {language==='bn'?'অ্যাকাউন্ট যোগ করুন (ক্যাশ/বিকাশ)':'Add account'}</button>}</div>}{err&&<div className="inline-message error">{err}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>{t(language,'cancel')}</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':(language==='bn'?'সংরক্ষণ করুন':'Save')} <Check size={16}/></button></div></form></Modal>;
}

function PaymentModal({data,debt,language,onClose,onDone,onSettled}:{data:any;debt:Debt;language:Language;onClose:()=>void;onDone:(m:string)=>void;onSettled?:(debt:Debt)=>void}) {
  const {recordPayment}=useApp();const [idempotencyKey] = useState(() => crypto.randomUUID());const [amount,setAmount]=useState('');const [accountId,setAccountId]=useState(data.accounts[0]?.id||'');const [date,setDate]=useState(dhakaInputNow());const [note,setNote]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{const paymentPaisa=Math.round(Number(amount)*100);await recordPayment({debtId:debt.id,accountId,amount:Number(amount),date,note,idempotencyKey});const full=paymentPaisa>=debt.remaining_paisa;if(full){onDone(language==='bn'?'অভিনন্দন! সম্পূর্ণ টাকা পরিশোধ হয়েছে 🎉':'Fully settled — congratulations! 🎉');onSettled?.(debt);}else{onDone(language==='bn'?'পেমেন্ট সফলভাবে যোগ হয়েছে':'Payment recorded');}onClose()}catch(e){setErr(e instanceof Error?e.message:'Could not record payment')}finally{setBusy(false)}};
  return <Modal title={language==='bn'?'টাকা / কিস্তি পরিশোধ':'Record a payment'} subtitle={`${debt.contact_name} · ${language==='bn'?'বাকি আছে':'Remaining'} ${formatMoney(debt.remaining_paisa,language)}`} onClose={onClose}><form className="form-stack" onSubmit={submit}><div className="payment-callout"><div><span>{language==='bn'?'বাকি টাকা':'REMAINING BALANCE'}</span><b style={{color:'#dc2626'}}>{formatMoney(debt.remaining_paisa,language)}</b></div><div className="payment-callout-icon"><HandCoins size={22}/></div></div><label>{language==='bn'?'আজ কত টাকা পরিশোধ করছেন? (৳)':'Payment amount (৳)'}<input required type="number" min="0.01" max={(debt.remaining_paisa/100).toFixed(2)} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" autoFocus/></label><label>{language==='bn'?(debt.direction==='i_owe'?'টাকা প্রদানের অ্যাকাউন্ট (ঐচ্ছিক)':'টাকা জমার অ্যাকাউন্ট (ঐচ্ছিক)'):'Account (Optional)'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><select value={accountId} onChange={e=>setAccountId(e.target.value)} style={{cursor:'pointer'}}><option value="">{language==='bn'?(data.accounts.length?`স্বয়ংক্রিয় (${data.accounts[0]?.name})`:'স্বয়ংক্রিয় অ্যাকাউন্ট'):'Auto / Default'}</option>{data.accounts.filter((a:Account)=>!a.archived_at).map((a:Account)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>{language==='bn'?'পরিশোধের তারিখ ও সময়':'Payment date'}<input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>{language==='bn'?'নোট বা রেফারেন্স (ঐচ্ছিক)':'Note'} <span className="optional">{language==='bn'?'ঐচ্ছিক':'Optional'}</span><textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder={language==='bn'?'যেমন: ১ম কিস্তি বা বিশেষ নোট…':'Payment reference…'}/></label>{err&&<div className="inline-message error">{err}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>{t(language,'cancel')}</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':(language==='bn'?'পরিশোধ নিশ্চিত করুন':'Save payment')} <Check size={16}/></button></div></form></Modal>;
}

function CelebrationConfetti({onComplete}:{onComplete?:()=>void}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    const colors = ['#10b981', '#059669', '#34d399', '#6366f1', '#ec4899', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6'];
    const particles: Array<{
      x: number; y: number; vx: number; vy: number; w: number; h: number;
      rotation: number; rotationSpeed: number; color: string; shape: 'rect'|'circle'; opacity: number;
    }> = [];
    const total = 95;
    for (let i = 0; i < total; i++) {
      particles.push({
        x: width * 0.5 + (Math.random() - 0.5) * 220,
        y: height * 0.38 + (Math.random() - 0.5) * 120,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 4,
        w: Math.random() * 9 + 6,
        h: Math.random() * 12 + 8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.3 ? 'rect' : 'circle',
        opacity: 1
      });
    }
    let animationId: number;
    const startTime = Date.now();
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const elapsed = Date.now() - startTime;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.vx *= 0.985;
        p.rotation += p.rotationSpeed;
        if (elapsed > 2500) {
          p.opacity = Math.max(0, p.opacity - 0.015);
        }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (elapsed < 4500) {
        animationId = requestAnimationFrame(render);
      } else {
        onComplete?.();
      }
    };
    animationId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
    };
  }, [onComplete]);
  return <canvas ref={canvasRef} className="celebration-canvas" />;
}

function SettledCelebrationModal({debt,language,onClose,onRemove}:{debt:Debt;language:Language;onClose:()=>void;onRemove:()=>void}) {
  return (
    <div className="celebration-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="celebration-modal-card">
        <div className="celebration-badge-pulse">
          <PartyPopper size={36}/>
        </div>
        <h2 className="celebration-title">
          {language==='bn'?'🎉 অভিনন্দন! দেনা সম্পূর্ণ পরিশোধিত!':'🎉 Congratulations! Loan Settled!'}
        </h2>
        <p className="celebration-subtitle">
          {language==='bn'
            ?'আলহামদুলিল্লাহ! এই হিসাবটি ১০০% পরিশোধ হয়ে ক্লিয়ার হয়েছে। দেনামুক্ত থাকা বড় প্রশান্তির।'
            :'This loan balance is now zero. You can remove the completed card or keep it in history.'}
        </p>
        <div className="celebration-details">
          <div className="celebration-details-row">
            <span>{language==='bn'?'ব্যক্তির নাম':'Person'}</span>
            <b>{debt.contact_name}</b>
          </div>
          <div className="celebration-details-row">
            <span>{language==='bn'?'মূল ঋণের পরিমাণ':'Original amount'}</span>
            <b>{formatMoney(debt.principal_paisa,language)}</b>
          </div>
          <div className="celebration-details-row">
            <span>{language==='bn'?'বর্তমান অবস্থা':'Current status'}</span>
            <b style={{color:'#059669'}}>✓ {language==='bn'?'৳ ০ (সম্পূর্ণ ক্লিয়ার)':'BDT 0 (100% Settled)'}</b>
          </div>
        </div>
        <div className="celebration-actions">
          <button type="button" className="celebration-remove-btn" onClick={onRemove}>
            <Trash2 size={16}/> {language==='bn'?'তালিকা থেকে কার্ডটি সরান':'Remove card from list'}
          </button>
          <button type="button" className="celebration-done-btn" onClick={onClose}>
            <CheckCircle2 size={16}/> {language==='bn'?'পরিশোধিত তালিকায় রাখুন':'Keep in settled list'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({title,subtitle,onClose,children}:{title:string;subtitle?:string;onClose:()=>void;children:React.ReactNode}) {
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-card"><div className="modal-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div>;
}

function EmptyState({text}:{text:string}) { return <div className="empty-state"><div><BookOpen size={21}/></div><span>{text}</span></div>; }

export default function App() {
  return <AppProvider><AppRoot/></AppProvider>;
}
