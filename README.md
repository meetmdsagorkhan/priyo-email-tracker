# Priyo Email Tracker

Next.js 16 application for campaign tracking, recipient management, and team access. Requires Node.js 24, npm, and PostgreSQL.

## Development

1. Run `npm ci`.
2. Create an ignored `.env.local` with `DATABASE_URL`, `NEXTAUTH_URL` (the application origin), and a securely generated `NEXTAUTH_SECRET`. Set `TRACKING_BASE_URL` and `NEXT_PUBLIC_TRACKING_BASE_URL` to the public tracking origin. Never commit credentials.
3. Run `npm run prisma:generate`, then `DATABASE_URL=... npm run prisma:push` against your development database. Prisma CLI does not read `.env.local`; supply its database URL through the environment or an ignored `.env`.
4. Create your first administrator explicitly with `npm run admin:create`. Supply `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` (at least 12 characters, up to 72 bytes), and optional `DEFAULT_ADMIN_NAME` through secure environment configuration. The command reads `.env.local` if present, creates one account, and refuses to overwrite existing accounts. Login never seeds or reactivates accounts.
5. Start `npm run dev`.

For production, use the checked-in Prisma migrations; do not use `prisma db push` against production. The first migration represents the pre-SaaS schema, and the SaaS foundation migration backfills existing records into one legacy workspace. Before applying it, test against a production-like database copy and take a restorable backup. For a fresh database, run `npx prisma migrate deploy`. For an existing database created before migrations, first verify that its schema matches the pre-SaaS baseline, mark only `20261011000000_legacy_baseline` as applied with `npx prisma migrate resolve --applied 20261011000000_legacy_baseline`, then run `npx prisma migrate deploy`. Do not mark the SaaS foundation migration as applied. Existing users must sign in again if their session state is invalidated.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in the server environment (optionally `SMTP_FROM` and `SMTP_SECURE`) to keep SMTP configuration available to the background delivery worker. Credentials entered in the campaign dialog are used only for one-off test messages; they are not stored or used for queued campaign sends. When starting a direct audience campaign, managers can choose a batch size (1–100 recipients) and delay (0–3600 seconds) between batches. The campaign page must remain open while these paced batches run; if it closes, remaining messages stay queued for the background worker. Set a long, random `CRON_SECRET` in the server environment to protect the scheduled worker endpoint. The checked-in Vercel schedule runs `/api/cron/deliveries` once daily to stay compatible with the Hobby plan; queued and failed deliveries may wait until the next run. A Pro plan or another scheduler that supports more frequent jobs is needed for near-real-time queue processing. Each background run processes up to 100 messages with bounded concurrency. Failed SMTP sends are retried with increasing delays, up to five attempts. If the worker lease expires after SMTP may have accepted a message, an automatic retry could duplicate it; this uncertainty is recorded on the delivery.

Set `TRACKING_BASE_URL` to the public HTTPS hostname for generated click redirects and open pixels; if it is unset, production uses the configured application origin rather than localhost. Regenerate tracked HTML after changing the tracking URL because already-generated HTML keeps its original links.

Public signup creates a free workspace and requires server SMTP configuration to send email verification. Recipient imports default to unknown consent; only explicitly opted-in recipients can be sent campaign mail. Sends include an unsubscribe link and one-click unsubscribe headers, and suppressions are enforced for that workspace. Saved segments can target delivered recipients who opened, did not open, clicked, or did not click; opens are estimates and may be affected by privacy proxies. Free/starter/growth/business recipient and monthly-email limits are enforced. Stripe Checkout, the billing portal, and signed subscription webhooks are implemented but require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, and `STRIPE_PRICE_BUSINESS` in the server environment. Configure Stripe to deliver `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and `invoice.payment_succeeded` to `/api/billing/webhook`. Campaigns can be queued and tracked, but scheduled campaign sends, provider delivery/bounce/complaint webhooks, and a multi-provider sending service are not implemented. SMTP retry is at-least-once, so rare duplicates are possible after an uncertain timeout.

Previously committed default credentials must be rotated using Settings → Change your password or an admin's Reset password control. No default password is shipped or prefilled. Existing unhashed invitation links from earlier releases must be replaced with new invitations.

## Roles and admin controls

| Role             | Read dashboard, analytics, campaigns, recipients, templates | Create campaigns, edit recipients, generate/export tracking, send email | Manage users and invitations |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| Admin            | Yes                                                         | Yes                                                                     | Yes                          |
| Campaign manager | Yes                                                         | Yes                                                                     | No                           |
| Member           | Yes                                                         | No                                                                      | No                           |
| Viewer           | Yes                                                         | No                                                                      | No                           |

Settings lets admins invite any role, change roles, enable/disable membership in their current workspace, reset passwords, and revoke invitations. Workspace access is isolated by membership; membership changes invalidate sessions for that workspace, while changing a password remains an account-wide action and invalidates the account's sessions everywhere. You cannot demote or disable your own administrator membership, and the server protects the last active workspace admin. Every protected API checks the current database account, active membership, and role.

Admins and campaign managers can delete campaigns from the campaign list. Deletion permanently removes the campaign's tracking links, recipients, and event history; campaigns currently sending cannot be deleted.

Invitation links expire after seven days, are stored as SHA-256 hashes, and can be accepted only once. Creating another invitation for an email revokes older pending invitations. Share links securely; they grant account access. Tracking pixels and click redirects remain public so email recipients do not need accounts.

Login rejects inactive or unverified accounts and throttles an email after ten failed attempts within fifteen minutes. Failed-attempt metadata stores a hashed email, never a password. Retain/prune audit records according to your operational retention policy. Deploy behind HTTPS and your usual edge request-rate controls.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:auth` with the application running on port 3100 (or `TEST_BASE_URL`) and a **dedicated local** `DATABASE_URL`. Set the same `CRON_SECRET` in the app and test processes; configure dummy server `SMTP_USER`/`SMTP_PASS` values for queue admission. The test creates temporary accounts/campaigns, exercises actual credential cookies, all roles, inactive users, session revocation, password changes, invitation races/revocation, public tracking, the delivery queue, and page responses, then removes its fixtures. SMTP is tested only against a local capture server; no external mail is sent. Start the test instance with `NEXTAUTH_URL=http://localhost:3100 npm start -- --port 3100` after building.

Each Codex cloud task already uses an isolated checkout. Reuse it without creating a Git worktree. Local database data and ignored environment files are not pushed to GitHub.

The NextAuth Nodemailer peer is overridden to the patched Nodemailer version. This application uses only the credentials provider; mail delivery is checked against a local SMTP capture server.

Build tooling uses a patched PostCSS selector parser override. The full development dependency audit still reports the upstream `braces <=3.0.3` advisory through Tailwind and ESLint tooling; npm currently publishes no patched braces release. Production dependency auditing is clean.

## Production login and custom domain

This is the owner's personal project used for work at Priyo. The production origin is `https://track.drdoom.world`, independent of the Vercel deployment alias.

In Vercel Project Settings:

1. Attach `track.drdoom.world` to this project and follow Vercel's displayed DNS instructions. Mark it as the primary production domain.
2. Set production `APP_URL` and `NEXTAUTH_URL` to `https://track.drdoom.world`. Set `TRACKING_BASE_URL` and `NEXT_PUBLIC_TRACKING_BASE_URL` to the same origin. Keep the existing secret `NEXTAUTH_SECRET` and production `DATABASE_URL`; never paste these into chat or commit them.
3. Back up the production database and test the migrations against a staging copy. For the existing pre-SaaS database, verify schema compatibility, then mark the baseline as applied and run `npx prisma migrate deploy` as described above. Do not use `npm run prisma:push` on production. Run `npm run auth:check` after the migration. This workspace's local database is separate from Vercel's database.
4. If there is no admin account, supply `DEFAULT_ADMIN_EMAIL` and a new `DEFAULT_ADMIN_PASSWORD` securely and run `npm run admin:create` against that database. Existing users are never overwritten. If an account exists but its password is unknown, another active admin can reset it in Settings. If you are locked out of every admin account, supply `ADMIN_RESET_EMAIL` and a new `ADMIN_RESET_PASSWORD` securely and run `npm run admin:reset` from the trusted production shell. This explicitly recovers only an existing admin, clears its login lockout, and revokes old sessions; it never promotes a non-admin. Remove the temporary recovery password variables afterward.
5. Redeploy after changing Vercel environment variables. Sign in at `https://track.drdoom.world/login`; old-domain session cookies cannot be reused on the new domain.

Production login/page requests on the Vercel alias redirect to the owner domain; preview deployments keep their preview origin. NextAuth's CSRF checks protect authentication routes, and the separate API origin guard protects application mutations. Database failures show a setup error rather than incorrectly claiming that the password is wrong. After ten failed attempts on an email, wait fifteen minutes before retrying.
