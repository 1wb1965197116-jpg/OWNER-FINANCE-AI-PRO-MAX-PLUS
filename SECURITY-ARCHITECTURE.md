# Security and cloud-data foundation

## Status
The repository now contains the first PostgreSQL schema migration. It is preparation only: no database has been created, no database credentials have been added, and the live application still stores workspace data in browser localStorage.

## Data model
- `app_users`: normalized account email, password hash, status and timestamps.
- `app_sessions`: SHA-256 token hashes, expiry and revocation. Raw session tokens must never be stored.
- `workspace_records`: one encrypted record envelope per user and record type. Payloads are encrypted in the application with AES-256-GCM before database writes.
- `audit_events`: minimal event trail for login, data changes, approvals and integration changes. Never log secrets or full documents.

Workspace record types cover deals, seller leads/interactions, buyer offers, contracts, diligence, closing milestones, portfolio values, investment profiles, autopilot plans and user settings.

## Required application security before enabling cloud sync
1. Use a PostgreSQL application role that is not the table owner and does not have `BYPASSRLS`.
2. Authenticate users with scrypt password hashes and per-user random salts. Never store plaintext passwords.
3. Generate high-entropy opaque session tokens; store only their SHA-256 hashes. Set cookies `HttpOnly`, `Secure`, and `SameSite=Lax`; rotate and revoke sessions.
4. Rate-limit registration and login; normalize and validate email; use generic login errors.
5. Set `app.user_id` with transaction-local `set_config('app.user_id', user_id, true)` after validating the session. Never trust a user ID supplied by the browser.
6. Encrypt workspace JSON in the server with AES-256-GCM before database writes. Keep the encryption key only in Render secret environment variables, version keys for rotation, and never return them to the browser or log them.
7. Protect state-changing requests against CSRF; validate origin and content type; cap request sizes; use parameterized SQL.
8. Record approvals as audit events. Sending, signing, accepting offers, and moving money must remain separate actions requiring fresh explicit user confirmation.
9. Provide account recovery and backup/restore before enabling production accounts. Do not enable public self-registration until recovery, abuse controls and initial-owner setup are complete.

## Row-level security
Migration 001 enables and forces RLS on all user-owned tables. Each request that accesses user data must run in a transaction and set the authenticated user context transaction-locally. The application database role must not own the tables and must not bypass RLS. Database-owner or migration credentials must never be used by the web application.

## Deployment sequence
1. Review and test migration 001 in a disposable database.
2. Obtain explicit approval before provisioning any paid Render Postgres instance or storage service.
3. Configure the internal Render connection string as a secret environment variable.
4. Deploy the authenticated session and encrypted-record API only after migrations, backups, key management and recovery are tested.
5. Migrate browser records only through an authenticated, user-confirmed import. Keep the encrypted browser backup available until the cloud copy is verified.

## Current limitations
This migration alone does not provide login, cloud sync, document storage, account recovery, or an operational security guarantee. The deployed app remains localStorage-based until the later application and database phases are implemented and tested.
