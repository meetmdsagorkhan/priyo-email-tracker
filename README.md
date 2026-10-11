# Priyo Email Tracker

Next.js 16 application for campaign tracking, recipient management, and team access. Requires Node.js 24, npm, and PostgreSQL.

## Development

1. Run `npm ci`.
2. Create an ignored `.env.local` with `DATABASE_URL`, `NEXTAUTH_URL` (the application origin), and a securely generated `NEXTAUTH_SECRET`. Set `TRACKING_BASE_URL` and `NEXT_PUBLIC_TRACKING_BASE_URL` to the public tracking origin. Never commit credentials.
3. Run `npm run prisma:generate`, then `DATABASE_URL=... npm run prisma:push` against your development database. Prisma CLI does not read `.env.local`; supply its database URL through the environment or an ignored `.env`.
4. Create your first administrator explicitly with `npm run admin:create`. Supply `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` (at least 12 characters, up to 72 bytes), and optional `DEFAULT_ADMIN_NAME` through secure environment configuration. The command reads `.env.local` if present, creates one account, and refuses to overwrite existing accounts. Login never seeds or reactivates accounts.
5. Start `npm run dev`.

For a production deployment, apply the updated Prisma schema to the intended database before starting the new application. This release adds `User.sessionVersion` (integer, default 0). Existing sessions are invalidated; users sign in again. Use your database backup and schema change process before applying production changes. Build with `npm run build` and run with `npm start`. SMTP sending needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM` / `SMTP_SECURE` or the campaign sending dialog's configuration.

Previously committed default credentials must be rotated using Settings → Change your password or an admin's Reset password control. No default password is shipped or prefilled. Existing unhashed invitation links from earlier releases must be replaced with new invitations.

## Roles and admin controls

| Role             | Read dashboard, analytics, campaigns, recipients, templates | Create campaigns, edit recipients, generate/export tracking, send email | Manage users and invitations |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| Admin            | Yes                                                         | Yes                                                                     | Yes                          |
| Campaign manager | Yes                                                         | Yes                                                                     | No                           |
| Member           | Yes                                                         | No                                                                      | No                           |
| Viewer           | Yes                                                         | No                                                                      | No                           |

Settings lets admins invite any role, change roles, enable/disable accounts, reset passwords, and revoke invitations. You cannot demote or disable your own administrator account, and the server protects the last active admin. Every API checks the current database account and role. Password resets and activation changes invalidate existing sessions permanently. Everyone can change their own password after verifying the current one.

Invitation links expire after seven days, are stored as SHA-256 hashes, and can be accepted only once. Creating another invitation for an email revokes older pending invitations. Share links securely; they grant account access. Tracking pixels and click redirects remain public so email recipients do not need accounts.

Login rejects inactive users and throttles an email after ten failed attempts within fifteen minutes. Failed-attempt metadata stores a hashed email, never a password. Retain/prune audit records according to your operational retention policy. Deploy behind HTTPS and your usual edge request-rate controls.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:auth` with the application running on port 3100 (or `TEST_BASE_URL`) and a **dedicated local** `DATABASE_URL`. The test creates temporary accounts/campaigns, exercises actual credential cookies, all roles, inactive users, session revocation, password changes, invitation races/revocation, public tracking, and page responses, then removes its fixtures. SMTP is tested only against a local capture server; no external mail is sent. Start the test instance with `NEXTAUTH_URL=http://localhost:3100 npm start -- --port 3100` after building.

Each Codex cloud task already uses an isolated checkout. Reuse it without creating a Git worktree. Local database data and ignored environment files are not pushed to GitHub.

The NextAuth Nodemailer peer is overridden to the patched Nodemailer version. This application uses only the credentials provider; mail delivery is checked against a local SMTP capture server.

Build tooling uses a patched PostCSS selector parser override. The full development dependency audit still reports the upstream `braces <=3.0.3` advisory through Tailwind and ESLint tooling; npm currently publishes no patched braces release. Production dependency auditing is clean.
