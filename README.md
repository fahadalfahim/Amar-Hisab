# Amar Hisab v1.4 — Cloud-only Public Beta

**Bangla deployment guide:** [docs/LAUNCH-BN.md](docs/LAUNCH-BN.md)

Multi-user BDT personal-finance PWA, preserving the Clay + selective Liquid Glass design. Frontend is **React 18 + Vite + TypeScript**, hosting target **Cloudflare Pages**, database/auth target **Supabase PostgreSQL**. No separate backend server is needed for the existing app flows: financial writes use authenticated, atomic Postgres RPCs.

## v1.4 changes

- **No demo mode** in public builds. Missing Supabase URL or publishable key shows a safe configuration screen. No sample financial records are included.
- A logged-out visitor sees a **login screen**. Google OAuth, email/password login, optional email signup, password reset, and optional SMS OTP are implemented.
- Registration via Google creates a private user account. Database trigger seeds **empty accounts, zero transactions, zero loans**, plus income/expense category labels.
- Distinct users' data is isolated by **user_id + PostgreSQL Row-Level Security** and additional composite foreign keys.
- All finance writes refuse to proceed without a session and cannot silently create browser-local records.
- Cloud refresh uses full pagination and rejects a stale former user's response after sign-out/account switch.
- If cloud data fails to load, the app does **not** show a misleading zero-balance dashboard; it presents an error/retry screen.
- A new migration restricts account and notification updates and blocks non-zero account archival at DB level.
- Responsive premium UI, light/dark and bn/en toggles, install prompt and PWA icons remain.

## Authentication capabilities / costs

| Sign-in method | Code status | Before use |
|---|---|---|
| Google | Implemented | Set up Google OAuth consent + client in Google Cloud; enable Google provider in Supabase |
| Email/password login | Implemented | Enable Email provider in Supabase; existing verified accounts only |
| Email/password registration | Implemented, **disabled by default** | Configure a **production SMTP service**, verify sending identity/domain, set `VITE_ENABLE_EMAIL_SIGNUP=true` |
| Password recovery email | Implemented | Configure production SMTP service; otherwise delivery cannot be relied upon |
| Phone SMS OTP | Implemented, **disabled by default** | Configure Phone Auth and an **SMS provider** in Supabase; set `VITE_ENABLE_PHONE_AUTH=true` (SMS not inherently free) |

**Free hosting does not include free unlimited SMS or production SMTP.** A `pages.dev` subdomain is fine for Google OAuth and PWA but normally does not give you a domain you can verify to use as an email sender. Do not switch on email signup or phone OTP until providers are operational.

## Prerequisites

- Node.js 22, npm, Git
- GitHub, Cloudflare and Supabase accounts
- Google Cloud OAuth consent screen for Google sign-in
- A real backup policy before storing important money records

## Local run

```bash
npm install
cp .env.example .env.local
# Edit .env.local to insert your own Supabase project URL and publishable key
npm run typecheck
npm run test:smoke
npm test
npm run build
npm run dev
```

`npm run build` produces `dist/` for Cloudflare Pages. Never commit `.env.local`, a Supabase secret/service-role key, database password, or OAuth secret.

## Database setup (new project)

Apply SQL migrations **in filename order** using Supabase SQL Editor (one by one) or Supabase CLI `supabase db push`:

1. `supabase/migrations/202611180001_initial_schema.sql`
2. `supabase/migrations/202611190002_account_security.sql`
3. `supabase/migrations/202611190003_public_launch_hardening.sql`

If already running the v1.3 database, **only apply new migrations you have not applied**. Do not reset/erase production data. Test migrations in a disposable project first.

Create two test users; confirm one cannot select/mutate the other's account, transactions, loans, payments or contacts. RLS and DB triggers, not the UI, must enforce ownership.

## Cloudflare Pages

GitHub repo `amar-hisab` → Cloudflare Dashboard → Workers & Pages → Pages → Connect Git.

- Framework preset: **Vite**
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_ENABLE_EMAIL_SIGNUP=false`
  - `VITE_ENABLE_PHONE_AUTH=false`

After deployment, note the actual URL, typically `https://your-project.pages.dev`. Configure Supabase → Auth → URL Configuration → **Site URL** to that exact URL and include it as an allowed redirect URL, alongside `http://localhost:5173/**` for local development. Google OAuth's **Authorized redirect URI is the Supabase callback URL**, not your Cloudflare URL. Put Google OAuth Client ID/Secret in the **Supabase provider settings only**, not Vite.

## Testing / QA status

Local source syntax, CSS parsing, UI wiring, PWA assets and money calculation smoke tests run with `npm run test:smoke`. Vitest tests are included and run with `npm test` once dependencies are installed. GitHub Actions CI runs checks on every push/PR.

**Not verified in this environment:** full Vite production build, authenticated Supabase queries, third-party OAuth/SMTP/SMS, cross-user database tests and an installed real-phone PWA. External provider settings and credentials are unavailable here. **This is a public-beta candidate, NOT a certification that it is error-free or safe for important real-money records.** Follow [launch checklist](docs/LAUNCH-BN.md) before opening registration to the public.

## Privacy and operational notes

- Static/PWA shell files may be cached; financial API responses are not configured for runtime caching.
- User records should be exported regularly from Settings; app JSON export is **not a full Supabase database/auth backup**.
- Supabase Free can pause after low activity and does not include managed database backups. Set up encrypted off-site dumps and practice restoring them, or choose a paid backup plan.
- App currently records cash movements, loan principal and repayments; it is **not** a bank and does not link to live financial institutions.
- Transaction editing/voiding, automated push notifications, user account self-deletion, a full SQL-backed privacy audit and scheduled backup orchestration are **not included** in this build. Do not promise them to end users.
