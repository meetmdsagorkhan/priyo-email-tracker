# Recipient groups and bulk actions

Use groups to organize contacts by agency, customer, project, or another audience. For example, create **Priyo Agency** and add the people you work with there. Each contact can belong to multiple groups.

1. Open **Recipients**. Select individual checkboxes, or use the header checkbox to select every visible row. Search narrows the visible rows; existing selection is preserved when searching. Changing the group filter clears selection.
2. Enter a group name and choose **Create group** to include selected contacts immediately. You can create an empty group too.
3. For an existing group, choose it under **Bulk action group**, then choose **Add selected** or **Remove selected**. Up to 1000 contacts can be changed per action. Adding a contact twice does not duplicate its membership.
4. Use the group filter buttons to view members. If your directory has more than 100 contacts, choose **Load more recipients** to include older contacts in searching, filtering, or selection. The page explains this boundary; selection never silently includes unloaded contacts.
5. Choose an existing group in the bulk controls and expand **Manage** to rename or delete it. Removing membership or deleting a group preserves contacts, consent, tracking history, and already queued campaigns.

## Send a campaign to a group

In the campaign HTML studio, open the send dialog and choose **Campaign send**. Select **Send to a recipient group**. The group replaces the campaign/default audience, and the confirmation names the group. A saved engagement segment and a group cannot be selected together.

The eligible count excludes unknown consent, unsubscribed contacts, and suppressed email addresses. Eligibility and quotas are checked again when the campaign is queued. An empty or ineligible group is rejected; it never falls back to sending to the whole directory. Group membership never grants consent or resubscribes a contact.

Recipients are frozen into the existing delivery queue when sending is admitted. Subsequent group changes do not rewrite queued recipients. Existing unsubscribe/suppression checks still protect queued delivery. The current sending limit is 1000 target contacts per campaign.

## Access and storage

Admins and campaign managers can change groups; read-only users can view them. All operations are workspace scoped. Bulk mutations validate every supplied recipient before committing, so a foreign/missing contact aborts the entire action. Membership changes serialize on the workspace lock to preserve concurrent edits.

Static groups use the existing `Segment` audience store with a distinct `kind: "GROUP"` JSON definition containing recipient IDs. Engagement segments retain their original definition and endpoints. This release requires no Prisma schema change or production database migration.

## Local regression

Run `npm run test:groups` against a locally running app with the same dedicated test database:

```sh
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/signalpost_ui_test \
TEST_BASE_URL=http://localhost:3150 npm run test:groups
```

The regression rejects production database/application URLs, creates isolated fixtures, verifies group membership, permissions, tenant boundaries, concurrent edits, consent exclusions, queue admission, and pagination, and removes its fixtures. It queues only local test records and does not process deliveries or send email.
