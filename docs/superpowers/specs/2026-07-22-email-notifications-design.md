# Email Notifications for Request Workflow

**Date:** 2026-07-22
**Status:** Approved

## Overview

The technician → supervisor → vendor workflow currently has no notifications. Everyone finds out about a new request, an approval, or a fulfillment only by manually checking the site. This adds three email alerts, one per workflow transition:

1. Technician submits a request → email the **supervisor**, with a link to their queue.
2. Supervisor gives final approval → email the **vendor/supplier**, with a link to that branch's fulfillment page.
3. Vendor fulfills the last chemical on a request → email the **technician**, letting them know the order is ready for pickup.

## Email Transport

Add `nodemailer` as a dependency. New module `lib/mailer.js` creates a single SMTP transporter from env vars and exports `sendMail({ to, subject, html })`.

```js
// lib/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function sendMail({ to, subject, html }) {
  if (!to) {
    console.warn(`Skipping email "${subject}": no recipient address on file.`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${to}:`, err);
  }
}

module.exports = { sendMail };
```

**Error handling policy:** `sendMail` never throws. A missing recipient or an SMTP failure is logged and swallowed. Sending an email is never allowed to block or fail the underlying request/approve/fulfill action — those are the actual business operations and must succeed independent of notification delivery.

**New env vars** (added to `.env` locally and to Render's environment for production):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — mailbox credentials for the sending account.
- `VENDOR_EMAIL` — the single fixed supplier address that receives fulfillment requests for every branch.
- `APP_BASE_URL` — base URL used to build links in emails (e.g. `https://inventory-management-hiyg.onrender.com`). Falls back to constructing from `req.protocol`/`req.get('host')` if unset, so local dev links still work.

## Data Model Change

`technicians` table gains an `email` column:

```sql
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS email TEXT
```

`seed.js`'s `technicians` array gains an `email` field per entry. **Known limitation:** the existing ~100+ seeded technicians don't have real email addresses on file yet; they'll seed with `email: null` until real addresses are supplied and the seed data updated. Trigger 3 (pickup-ready email) silently no-ops for any technician without an email on file (via the same "skip + log" path as a missing supervisor/vendor address) — it doesn't block fulfillment.

## Trigger 1: Submit → Notify Supervisor

In `routes/technician.js`, `POST /submit-request`, after the insert transaction succeeds (before `res.sendFile(success.html)`):

1. Look up the supervisor's email: `SELECT email FROM contacts WHERE first_name || ' ' || last_name = $1` using `technicianData.supervisor`.
2. `sendMail({ to, subject: 'New chemical request submitted', html })` with a body containing technician name, branch, pickup date, and a link to `${APP_BASE_URL}/supervisor/${encodeURIComponent(supervisor)}` (the supervisor still needs to log in — the link just takes them to the right queue).

This is fire-and-forget: call it without `await`-blocking the response (or `await` it before responding — either way, wrap in the mailer's own try/catch so it can't throw).

## Trigger 2: Final Approval → Notify Vendor

In `routes/supervisor.js`, `POST /final-approve/:supervisorName`, after `technician_requests.status` is updated to `'approved'`:

1. Recipient is the fixed `VENDOR_EMAIL`.
2. `sendMail({ to: VENDOR_EMAIL, subject: 'Request approved — ready to fulfill', html })` with technician name, branch, pickup date, approved chemical list, and a link to `${APP_BASE_URL}/vendor/${encodeURIComponent(branch)}`.

## Trigger 3: Last Fulfillment → Notify Technician

In `routes/vendor.js`, `POST /fulfill/:location`, after the `UPDATE chemical_requests SET status = 'fulfilled'` for the given chemical:

1. Check whether any chemicals remain non-fulfilled for that request: `SELECT COUNT(*) FROM chemical_requests WHERE request_id = $1 AND status != 'fulfilled'`.
2. If zero remain, look up the technician's email: `SELECT email FROM technicians WHERE first_name || ' ' || last_name = $1 AND branch = $2 AND supervisor = $3` (mirrors the exact tuple the technician dropdown already ties together at submission time, and matches the table's existing `UNIQUE(first_name, last_name, branch, supervisor)` constraint).
3. `sendMail({ to, subject: 'Your order is ready for pickup', html })` with branch, pickup date, and the full chemical list. Links to `/submissions` (the only technician-facing view that exists today; there's no per-technician authenticated page to link to instead).

## Email Content

All three emails are simple HTML: a one-line summary, a small table of chemicals (name/quantity/unit) where relevant, and a link. Reuse the existing `esc()` HTML-escaping helper pattern from `routes/supervisor.js`/`routes/vendor.js` for any interpolated values to avoid HTML injection in email bodies.

## Tests

- `tests/api.test.js`'s chemicals-insert setup is unaffected.
- New/updated tests mock `lib/mailer.js` (`jest.mock('../lib/mailer')`) so no real network calls happen during test runs. Assertions check `sendMail` was called with the expected `to`/`subject` for each of the three triggers, including the "no email on file → not called, no error thrown" case.
- Existing tests that hit `/submit-request`, `/final-approve/:name`, and `/fulfill/:location` continue to pass unmodified aside from the mailer mock being in place.

## Out of Scope

- Vendor route authentication (still open/unauthenticated — pre-existing, unrelated to this feature).
- Per-branch vendor contacts (single fixed `VENDOR_EMAIL` for now).
- SMS/text notifications.
- A technician-facing login or per-technician status page (the pickup email links to the existing unauthenticated `/submissions` page).
- Backfilling real email addresses for existing seeded technicians and contacts.
