# Amar Hisab v1.4 Public Beta — QA report

## Completed in this editing environment

- 32 offline regression/smoke tests passed (`npm run test:smoke`).
- Checked TS/TSX source parse syntax, relative imports, CSS parse and selective Clay/Glass overrides.
- Confirmed existing PWA icons/manifest and install-event handler are present.
- Verified source code no longer has a local demo-data initialization or mock transaction file.
- Verified auth views include Google, Email/Password, optional Email Registration, Password Recovery and gated Phone OTP.
- Verified cloud session requirement for all finance writes and stale-user refresh guard are present.
- Verified financial sample: balance 14,700 BDT, payable 2,500 BDT, receivable 800 BDT, net worth 13,000 BDT; transfer nets zero; overpayments fail in helper tests.
- Verified required 3 SQL migrations are packaged and RLS/RPC/grant patterns are included.
- Verified ZIP CRC integrity and no local `.env.local` or secret credentials are packaged.

## Not performed / launch blockers

- `npm install`, full `tsc -b`, `vite build`, and Vitest tests could not complete in this container because registry dependencies were unavailable. Run all of them locally/CI.
- SQL migrations could not be executed against a real Postgres/Supabase database without project credentials. Test migrations in a disposable project first.
- Cross-account isolation, concurrent debt repayments and transactional consistency need live Supabase integration tests with two test users.
- Google OAuth, email SMTP, phone OTP/SMS, reset link and Cloudflare deployment need the project owner's provider setup.
- Actual PWA installation, iOS Safari and Android Chrome accessibility/performance require real devices.
- Automated offsite backup, restoration, CAPTCHA/anti-abuse controls and public operational/privacy requirements are not configured by this ZIP.

**Release classification: Public Beta candidate only. Do not market as fully production-tested or a guaranteed-safe sole store of financial records.**
