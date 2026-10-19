# Track a recipient when sending from another tool

Signalpost records requests for tracking images and links. It does not read a recipient’s mailbox or identify people from an IP address.

## Send one identifiable message

1. Add the email to **Recipients** and record its consent. Do not export for an unsubscribed or suppressed contact.
2. Open a campaign, paste your email HTML into the studio, and generate tracking.
3. Find **Sending from Gmail, Outlook, or another tool?** and enter that recipient’s email.
4. Select **Create recipient HTML**. Use **Copy for email editor** for a rich-text composer, or **Copy HTML** / download for a source editor, **for that person only**.
5. Paste the formatted copy into a rich-text composer, or use your sender’s supported **HTML source/import mode** for the source copy. Pasting HTML source into a normal text editor does not create an HTML email. Some editors strip remote images or rewrite links: verify the final message source contains the public `/api/track/open/…` image and `/api/track/click/…` links.
6. Open **Analytics → Engagement → Recipient activity** and refresh after the email client has loaded remote images or followed a tracked link. Manually exported messages appear as **No campaign send recorded**, without an invented delivery time.

For another person, create another copy. Reusing the first person’s HTML attributes later requests to that first token, including forwarded emails. Signalpost cannot determine who actually viewed a forwarded message.

## Shared bulk HTML and mail merge

Shared BULK HTML identifies the campaign only. Adding contacts to the directory does not personalize that HTML. Historical anonymous events cannot be reliably assigned to contacts afterward.

SELECTED merge templates contain `{{SIGNALPOST_TRACKING_TOKEN}}`. Replace that placeholder separately for every recipient using the exported CSV, or use **Create recipient HTML**. Sending the unchanged placeholder produces an unresolvable pixel. Always test your external platform’s merge syntax before sending a larger batch.

## Understand the evidence

- **Observed open:** the image URL was requested. It is not proof that a human read the email.
- **Proxy / scanner:** a known proxy/scanner signature was observed. Gmail/Apple privacy systems can obscure when or whether a person read a message; classification is an estimate.
- **No pixel open observed:** there was no qualifying image request. The person may still have read the message with images blocked, offline, or through a client that removed the pixel.
- **Test activity:** test pixel/link observations are shown separately and excluded from campaign totals. A successful test to an opted-in contact can confirm the recipient mapping. Unknown addresses stay anonymous and are not silently added to your audience.
- **SMTP accepted:** the sending server accepted the message. It is not confirmed inbox delivery. External/manual sending has no delivery claim in Signalpost.

Studio previews remove Signalpost tracking images and disable tracked links to avoid generating engagement simply by previewing a draft.

## Diagnose a missing event

Check the actual message source first: is the URL public, current, and recipient-specific? Then check that tracking is enabled for that campaign, the sender preserved HTML, the recipient loaded images, and Analytics has been refreshed. Click a tracked link as a separate diagnostic; it does not prove an image was loaded. If no public requests arrive, check the deployed tracking domain, HTTPS, application logs, and production database connectivity. A GIF response alone cannot prove the event was saved: verify the matching recipient activity as well.

Do not put database passwords or SMTP credentials into exported HTML, URLs, screenshots, or support messages.
