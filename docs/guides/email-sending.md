# Saved SMTP, Reply-To, and email logs

## Send and track each recipient

Write a campaign once and choose **Send from Here → Campaign send**. Select a recipient group or saved audience. Signalpost queues an individual message and unique tracking token for each eligible recipient. You do not need to export or manually personalize the email when sending from the app.

Open **Analytics → Engagement → Recipient activity** to inspect observed opens and clicks. Remote images must load for an open to be recorded; privacy proxies and forwarding can affect attribution. Sending acceptance is separate from engagement.

## Save sending settings once

A workspace admin can open **Settings → Email sending**, or the **Sending settings** tab in a campaign send dialog:

- SMTP host and port.
- SMTP username and password/app password.
- From address, optionally including a display name.
- Default Reply-To address.
- Implicit TLS for port 465; STARTTLS for other public SMTP connections.

Choose **Save sending settings**. Campaign workers, test emails, and team invitations then reuse the workspace configuration. Existing server SMTP settings are used only when no workspace configuration is saved. Account verification for a brand-new workspace uses the server defaults.

Saved passwords are encrypted with AES-256-GCM and a workspace-bound key. They are never returned by the settings API or stored in browser storage. The password field stays blank after saving; leave it blank to preserve the existing encrypted password. Re-enter it when changing the SMTP host or username. A manager can use the configuration without reading its password; only admins can change or remove it.

Saving does not send mail or verify provider permission. Send a test from a campaign to confirm SMTP acceptance. Configure SPF, DKIM, and your provider's sender verification separately.

## Reply-To

Leave **Reply-To for this send** empty to use the saved default. Enter an address to override it for a test or queued campaign. A campaign's override is stored in its queued email records so later worker requests do not need to resubmit it. Without a Reply-To header, replies go to the From address.

Changing Reply-To does not change the authenticated SMTP account or the From address. It does not receive incoming replies inside Signalpost.

## Inspect email logs

Open **Email logs** in the navigation, or **Email logs** on a campaign page. The log includes queued campaign recipients, test sends, and workspace invitation/verification sends recorded by this version. Search by recipient, subject, or campaign, and filter by type/status. Records include:

- Recipient, subject, campaign, and message type.
- Queue and SMTP acceptance timestamps.
- From and Reply-To used at send time.
- Attempts, failure reason, retry eligibility, and provider message ID.

The page refreshes every 30 seconds while visible. Pagination uses 50 records per page. Campaign status comes from the authoritative delivery queue, including stale-worker recovery and cancellations. Deleting saved SMTP does not delete email logs.

**SMTP accepted** means the server accepted the message. It is not a claim of inbox delivery. Delivered/bounced/complained states are reserved for provider feedback; this app does not currently ingest those provider webhooks. See Analytics for opens/clicks, which also do not prove inbox placement or a human read.

Failed campaign delivery is retried using the existing queue/backoff system. The logged retry timestamp is the earliest eligible time, not a guaranteed dispatch time; actual processing depends on the browser worker or scheduled job. An explicitly known SMTP acceptance followed by a database confirmation failure is held without automatic retry to reduce duplicate sends. A crash or network timeout around SMTP acceptance can still leave delivery uncertain.

## Database and deployment

Apply `20261019000000_saved_smtp_and_email_logs` before running the new sending features. It adds `WorkspaceSmtpSettings` and `EmailLog`, plus their indexes and foreign keys. It does not change or delete existing campaign/contact records. Historical campaign deliveries are backfilled into email logs with their original status/timestamps and provider reference. Old test emails were not persisted and cannot be reconstructed; old From/Reply-To values are not invented.

Follow the repository's production backup and migration-history instructions first, then run `npx prisma migrate deploy` with the production database URL supplied securely. Never use `prisma db push` on production. A missing migration is a deployment blocker for saved SMTP and logs; application code being pushed does not apply it automatically.

Set a stable, random `SMTP_ENCRYPTION_KEY` of at least 32 characters in the server environment, or use the already configured `NEXTAUTH_SECRET` (at least 32 characters). The dedicated key is recommended so authentication-key rotation need not invalidate saved SMTP passwords. Preserve the key across deployments and backups. If it changes, saved credentials cannot decrypt: an admin must enter and save the password again. Do not put keys or passwords in Git or chat.

Existing optional server defaults include `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `SMTP_REPLY_TO`. A workspace configuration overrides these as a complete configuration; another workspace's credentials are never used as fallback fields.

## Local regression

`npm run test:email` requires a running local test app using the dedicated `signalpost_ui_test` database and a stable test encryption key. The suite captures SMTP on loopback only, checks real wire headers and tracking tokens, encrypts/reuses credentials, exercises failures and retries, and verifies tenant/role isolation and log pagination. It rejects production application/database URLs.

`npm run test:email-migration` requires an empty `signalpost_email_migration_test` local database via `TEST_DATABASE_URL`. It replays the old migrations, creates a historical delivery, runs the new migration, and checks preservation and repeat-deploy behavior. It rejects production database URLs and a nonempty database.
