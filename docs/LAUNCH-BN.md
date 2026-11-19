# Amar Hisab — Public Beta Launch Guide (বাংলা)

**এই ZIP-এ কোড দেওয়া আছে, কিন্তু তোমার Supabase/Google/Cloudflare অ্যাকাউন্টে কোনো সেটআপ করা হয়নি।** Private GitHub Repo-তে কোড আপলোডের আগে পুরো গাইড পড়ে নাও। এটি টাকা লেনদেন করায় না; ব্যক্তিগত হিসাব সংরক্ষণ করে।

## ১. Login / Signup behaviour

- Website visit → Supabase URL/Key সঠিক থাকলে **Login Page**।
- Google Login → প্রথমবার নতুন User ID + Private Profile + Default Category তৈরি। **কোনো sample Cash, Income, Expense বা Loan থাকবে না**।
- নতুন User → **Add your first account** Banner → Cash/Bank/bKash ইত্যাদি যোগ করবে।
- Existing User → নিজের Cloud Data; অন্য User-এর Data দেখতে পারবে না (RLS-এ নিশ্চিত করতে হবে)।
- Login না করলে Dashboard, Transactions বা Report নয়।
- Supabase key অনুপস্থিত/ভুল Placeholder → Setup-required Screen, Demo নয়।
- Google Sign-in-এর জন্য Google Cloud OAuth Setup করতেই হবে।
- Email registration এবং Phone OTP-এর UI প্রস্তুত, কিন্তু provider/configuration ছাড়া কাজ করবে না।

## ২. GitHub-এ প্রজেক্ট আপলোড

1. ZIP Extract করে `amar-hisab/` খুলবে।
2. Node.js 22 ও Git ইনস্টল করবে।
3. `.env.example` কপি করে `.env.local` তৈরি করবে। **Real credentials GitHub-এ আপলোড করবে না।**
4. Terminal:

```bash
npm install
npm run typecheck
npm run test:smoke
npm test
npm run build
```

5. সব Check সবুজ হলে Private GitHub Repo `amar-hisab` তৈরি করো।

```bash
git init
git add .
git commit -m "Amar Hisab v1.4 public beta"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/amar-hisab.git
git push -u origin main
```

## ৩. Supabase Database ও Auth

1. https://supabase.com/dashboard → New project (Free)।
2. SQL Editor-এ **ক্রম অনুযায়ী** তিনটি Migration চালাও: `202611180001`, `202611190002`, `202611190003`। Existing Project-এ পুরোনো মাইগ্রেশন আবার চালাবে না।
3. Authentication → Providers → Email Enabled রাখবে (ইমেইল Login-এর জন্য)।
4. Authentication → Providers → Google Enabled করো (নিচের সেটআপ)।
5. Database SQL Scripts চালানোর পরে Row Level Security Enabled আছে কিনা দেখবে।
6. Project URL এবং `sb_publishable_...` Key সংগ্রহ করো। **Secret/Service Role Key Frontend-এ যাবে না।**
7. Supabase → Authentication → URL Configuration: Site URL হিসেবে আসল `https://YOUR-PROJECT.pages.dev` বসাও; Redirect URLs-এ ঠিক সেই URL এবং `http://localhost:5173/**` দাও।

## ৪. Google OAuth (সবচেয়ে সহজ Free Public Registration)

1. https://console.cloud.google.com/ → Project তৈরি।
2. Google Auth Platform → Branding: App name, Support Email; Audience **External**; app Testing না রেখে Public Launch-এর উপযোগী Publish Status-এ নিতে হবে।
3. Google Auth Platform → Clients → Create OAuth Client → Web Application।
4. Authorized JavaScript Origins-এ `https://YOUR-PROJECT.pages.dev`।
5. **Authorized Redirect URI**: Supabase Dashboard → Auth → Google Provider-এ প্রদর্শিত URL, সাধারণত `https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback`। Cloudflare URL এখানে বসাবে না।
6. Google Client ID ও Secret → Supabase Google Provider-এ বসাও। Secret কখনো `VITE_`-তে নয়।
7. Google Consent Screen-এর Testing/Verification নিয়ম মেনে Publish করো; প্রথমে নিজের Google Account দিয়ে পরীক্ষা করো।

Reference: https://supabase.com/docs/guides/auth/social-login/auth-google

## ৫. Email/Password Registration

**Public email registration একদম free `pages.dev` দিয়ে ডিফল্ট Supabase Mailer-এ নির্ভরযোগ্য নয়।** Production-এ Custom SMTP ও Verified Sender Domain প্রয়োজন। Supabase-এর Default SMTP কেবল Testing-এর জন্য সীমাবদ্ধ।

- SMTP Provider configure করো; sending domain verify করো।
- Supabase → Authentication → SMTP Settings-এ Provider details দাও।
- Registration confirmation ও Password Reset Email ঠিকমতো deliver হয় কি না পরীক্ষা করো।
- তারপর Cloudflare Environment Variables-এ `VITE_ENABLE_EMAIL_SIGNUP=true` সেট করে Redeploy করো।
- এর আগে Google Sign-in দিয়েই নতুন account তৈরি হবে। Existing email account থাকলে Email Login কাজ করতে পারে।

Reference: https://supabase.com/docs/guides/auth/auth-smtp

## ৬. Phone OTP Login

কোডে SMS OTP Request এবং 6-digit Code Verification Flow আছে, কিন্তু **কোনো SMS Provider বা Unlimited Free SMS অন্তর্ভুক্ত নয়**।

1. Supabase → Authentication → Phone Auth Enable।
2. Supabase-সমর্থিত SMS Provider (যেমন Twilio) Connect করো; Bangladesh Delivery, Regulatory Requirements এবং খরচ যাচাই করো।
3. নিজের নম্বরে বাস্তব SMS Test করো।
4. তারপরে `VITE_ENABLE_PHONE_AUTH=true` করে Redeploy করো।
5. UI-তে Phone Tab দেখা যাবে। Input format `+8801XXXXXXXXX`।

Reference: https://supabase.com/docs/guides/auth/phone-login

## ৭. Cloudflare Pages Deploy

1. https://dash.cloudflare.com/ → Workers & Pages → Create → **Pages** → Connect Git।
2. Private GitHub Repo Authorize।
3. Build Settings:
   - Framework: **Vite**
   - Production Branch: `main`
   - Command: `npm run build`
   - Output: `dist`
4. Environment Variables (Production):

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
VITE_ENABLE_EMAIL_SIGNUP=false
VITE_ENABLE_PHONE_AUTH=false
```

5. Deploy → Site URL note করো; Supabase Site URL/redirect updated করো।
6. Deploy Failure হলে Cloudflare Build Logs খুলে Error দেখো। `npm run build` Local Pass না হলে Launch করবে না।

Reference: https://developers.cloudflare.com/pages/get-started/git-integration/

## ৮. PWA Install

- Android Chrome: Site HTTPS-এ খুলবে → Install Amar Hisab Prompt অথবা Browser Menu → Install App।
- iPhone Safari: Share → Add to Home Screen। iOS-এ সব Browser-এ automatic `beforeinstallprompt` সমর্থিত নয়; App নির্দেশনা দেখায়।
- Installed PWA-এ Light/Dark, বাংলা/English, Bottom Glass Dock, Login Flow পরীক্ষা করো।

## ৯. Public Launch QA (বাস্তব Supabase দিয়ে)

- [ ] Build: `npm install`, `npm run typecheck`, `npm test`, `npm run build` পাস।
- [ ] Supabase তিনটি SQL Migration সফল।
- [ ] Google Sign-in নতুন User A → ফাঁকা Dashboard, 0 টাকা, Category; Add Account।
- [ ] নতুন Google User B → **User A-এর কোনো Account/Loan/Transaction দেখা যায় না**।
- [ ] REST API দিয়েও User A-এর Token দিয়ে User B-এর Rows Read/Write আটকায়। শুধু UI লুকানো যথেষ্ট নয়।
- [ ] Income: ৳5,000; Expense: ৳2,000; Loan Received: ৳3,000; Money Lent: ৳1,000; Debt Repaid: ৳500; Receivable Collected: ৳200; Opening Balance: ৳10,000 → Balance **৳14,700**।
- [ ] Outstanding Payable ৳2,500; Receivable ৳800; Net Worth **৳13,000**।
- [ ] Transfer ৳1,000 Cash → bKash: Total Balance বদলায় না; Income/Expense বদলায় না।
- [ ] Partial Payment, Full Settlement, Overpayment Error, Duplicate Request Test।
- [ ] 31 Oct/1 Nov Dhaka Month Boundary রিপোর্ট ঠিক।
- [ ] New User Sign-up, Google Redirect, Email Confirmation (SMTP থাকলে), Reset Password, Sign-out।
- [ ] Refresh Page, New Phone Login, App Install, Offline Error, Mobile Menu ও Light/Dark/BN/EN ঠিক।
- [ ] User JSON Export; Cloud DB আলাদাভাবে Encrypted Offsite Backup; **Restoration Successfully Tested**।
- [ ] Rate Limits, Bot Protection, Privacy Policy/Terms, Support Contact, Data Deletion Process (এখন App-এ নিজে Delete করার UI নেই)।

## ১০. Free Hosting-এর সীমা ও রিয়েলিস্টিক Launch Decision

Cloudflare Pages Hosting Free Tier-এ থাকতে পারে; Supabase Free Project Inactivity-তে Pause হতে পারে এবং Managed Backup থাকে না। **অর্থের গুরুত্বপূর্ণ হিসাবের জন্য শুধুমাত্র Free Cloud Database-এর ওপর নির্ভর না করার সুপারিশ**। নির্ভরযোগ্য Backup/Restore ছাড়া Public Beta-তে বাস্তব আর্থিক রেকর্ড রাখার প্রতিশ্রুতি দেবে না।

**এই কোডের বর্তমান QA সীমা:** Local Code Syntax, Offline Finance Logic, CSS, PWA Assets ও Migration Static Checks করা যায়। তোমার Live Supabase, SMS/SMTP, Google OAuth, Production URL এবং বাস্তব ফোনে End-to-End Test এখানে চালানো হয়নি। তাই এটিকে **Public Beta candidate** হিসেবে ধরো, Fully Certified Production Release নয়।
