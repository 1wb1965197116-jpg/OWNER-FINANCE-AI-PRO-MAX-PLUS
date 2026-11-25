# OWNER FINANCE AI PRO MAX PLUS

A nationwide real-estate investment workspace for analyzing cash purchases and creative-finance opportunities, tracking deals, preparing non-binding offer discussion drafts, and optionally using an AI assistant.

## Current build (1.0)

- Nationwide property deal workspace
- Personal and LLC investment profiles
- Cash purchase, seller financing, subject-to, lease-option and hybrid strategy labels
- Deal calculator for loan payment, estimated cash required, rent spread, equity spread and rent/payment ratio
- Deal pipeline with editable stages
- Non-binding offer discussion draft generator
- Explicit user approval flag for offer drafts; nothing is transmitted
- JSON export and local workspace deletion
- Optional server-side AI analysis endpoint; API key is never placed in browser code
- Human approval boundary: no automatic offers, contract signatures, seller contact, payments or money movement

## Run locally

Requires Node.js 20 or newer.

```bash
npm start
```

Open http://localhost:3000

No third-party package installation is required.

## Enable AI

1. Create an API key with your AI provider.
2. Set `OPENAI_API_KEY` in the server environment (never in app.js or a public file).
3. Optionally set `OPENAI_MODEL` to a model available to your API account.
4. Restart/redeploy the app. The Settings and AI Assistant screens show whether the server detects a key.

For Render: create a **Web Service** from this GitHub repository, choose the Node runtime, use build command `npm install` (or leave blank; there are no dependencies), start command `npm start`, then add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` under Environment. Do not commit a real key.

## Connect live property listings (RentCast)\n\n1. Create a RentCast API account and obtain an API key from its API dashboard. The provider currently documents 50 free developer requests per month; paid plans and overage fees may apply.\n2. In Render, open the service Environment settings and add `RENTCAST_API_KEY` with your key. Do not put the key in GitHub, the browser, or this chat.\n3. Save the environment change and allow Render to redeploy.\n4. In Acquisition Search, enter a ZIP code, a two-letter state abbreviation (such as NJ), or `City, ST`, set an optional price range, and tap **Search live property listings**.\n\nThe app requests up to 20 active sale listings per search. RentCast documents nationwide residential listing coverage, but listing coverage is not a guarantee that every property is present or current. This integration does not verify seller financing, title, liens, condition, ownership authority, taxes or rent.\n\n## Data and privacy

Deal records are currently stored in browser localStorage on the device/browser where they are entered. They do not automatically sync between devices, and clearing browser data can erase them. Export regular backups. This is not a secure financial vault or multi-user database. Do not enter bank credentials, Social Security numbers, full account numbers, or highly sensitive personal data.

## Important limitations

This is a working first application foundation, not a nationwide MLS, title, public-record, comps, rent, lender, payment, e-signature or closing integration. The app does not independently verify property facts, market values, title, liens, taxes, zoning, insurance, seller authority, lender consent, or legal compliance. Estimates depend on user-entered data and are not appraisals, underwriting, tax advice, legal advice, or investment advice.

Creative-finance transactions are state- and fact-specific. Subject-to and seller-financing arrangements may raise due-on-sale, loan-consent, insurance, title, servicing, disclosure, licensing, usury, foreclosure, consumer-protection and tax issues. Have a qualified local real-estate attorney and relevant professionals review each transaction.

## Project roadmap

1. Secure account login, PostgreSQL database, encrypted records and role-based permissions.
2. Property data, public records, comps and rental data providers with source/date tracking.
3. State-by-state compliance and attorney-reviewed document templates.
4. Lead sourcing, CRM, task automation and email/SMS integrations.
5. Offer approval workflow, e-sign provider and audit logs (no action without explicit authorization).
6. LLC/entity records, bookkeeping exports, lender and servicing integrations.
7. Multi-user team dashboard, notifications, backups and monitoring.

Every external action involving offers, contracts or money must remain behind an explicit user approval step.

## Account API foundation (not activated)
The server now includes a first-owner bootstrap, login, logout and session-inspection API. It is intentionally unavailable until `DATABASE_URL` is configured and migration 001 is applied. The first owner is created only with a one-time bootstrap secret; public registration is disabled. Passwords use Node scrypt, session cookies are HttpOnly/Secure in production/SameSite=Strict, and only session-token hashes are stored.

Do not set the database connection or bootstrap secret until the database has been approved and provisioned. When that stage is authorized:
- Set `DATABASE_URL` to the Render internal connection string.
- Set `OWNER_BOOTSTRAP_TOKEN` to a random secret of at least 32 characters, use it once to create the owner, then remove the variable immediately.
- Apply `database/migrations/001_secure_workspace.sql` before attempting login.
- Use a dedicated application database role without table ownership or BYPASSRLS privileges.

The account API is a security foundation only. Workspace cloud sync, account recovery, multi-factor authentication, and production end-to-end security testing are not yet implemented. Existing browser-local data remains separate and unchanged.
