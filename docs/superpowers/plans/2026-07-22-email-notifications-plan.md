# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send an email at each handoff in the request workflow — supervisor gets notified when a technician submits a request, the vendor gets notified when a supervisor finishes approving it, and the technician gets notified once the vendor has fulfilled every chemical on their order.

**Architecture:** A new `lib/mailer.js` wraps `nodemailer` behind a single `sendMail({ to, subject, html })` function that never throws (missing recipient or SMTP failure is logged and swallowed, so a broken mailbox can never block the underlying request/approve/fulfill action). Each of the three routes (`routes/technician.js`, `routes/supervisor.js`, `routes/vendor.js`) calls `sendMail` at its trigger point. The `technicians` table gains a nullable `email` column, populated from a small `technicianEmails` lookup map in `seed.js` (keyed by name+branch+supervisor) rather than editing the existing 153-entry `technicians` array — that keeps the real-address backfill (a future step once addresses are supplied) to one line per technician in one place, and `ON CONFLICT ... DO UPDATE SET email = EXCLUDED.email` means re-seeding always reconciles the DB to match the map.

**Tech Stack:** Node/Express, `pg` (Postgres), `nodemailer` (new dependency), Jest + Supertest.

## Global Constraints

- Per the approved design (`docs/superpowers/specs/2026-07-22-email-notifications-design.md`): sending an email must never block or fail the underlying business action (submit / final-approve / fulfill) — `sendMail` catches its own errors and a missing recipient is a no-op, not an error.
- Vendor recipient is a single fixed `VENDOR_EMAIL` env var for all branches (not per-branch contacts).
- Pickup-ready email fires once, when the last chemical on a request is fulfilled — matching the exact "fully fulfilled" criterion the app already uses to gate printing (`routes/vendor.js`'s `/print/:location/:requestId`: zero chemicals with `status != 'fulfilled'`, which does **not** exclude `rejected` rows). Trigger 3 reuses that identical criterion so pickup-ready timing never disagrees with print-eligibility.
- `technicians.email` is nullable. Technicians without a matched address in `technicianEmails` seed with `email = NULL`, and `sendMail` silently skips (logs a warning) rather than erroring.
- Do not add `email` to `routes/api.js`'s `GET /technicians` — that endpoint is unauthenticated and feeds the public request-form dropdown; exposing every technician's email there would be a new information disclosure beyond what this feature requires.
- Populating real addresses into `technicianEmails` (and correcting any `contacts` emails) is explicitly **out of scope for this plan** — it happens once the user returns the filled-in `emails-to-fill.csv`. Every task here must work correctly with `technicianEmails` empty (i.e., all technician emails `NULL`).

---

### Task 1: Mail transport (`lib/mailer.js`)

**Files:**
- Create: `lib/mailer.js`
- Create: `tests/mailer.test.js`
- Modify: `package.json` (add `nodemailer` dependency)

**Interfaces:**
- Produces: `sendMail({ to, subject, html }) => Promise<void>`. Never rejects. Skips (logs a warning, doesn't call the transport) when `to` is falsy. Logs and swallows any error the transport throws. Tasks 3-5 call this exclusively — they never touch `nodemailer` directly.

- [ ] **Step 1: Add the `nodemailer` dependency to `package.json`**

In the `"dependencies"` block, add (keeping alphabetical order with the existing entries):

```json
    "nodemailer": "^6.9.0",
```

So the full `dependencies` block reads:

```json
  "dependencies": {
    "dotenv": "^16.0.0",
    "express": "^5.1.0",
    "express-session": "^1.17.3",
    "nodemailer": "^6.9.0",
    "pg": "^8.11.0"
  },
```

- [ ] **Step 2: Install it**

Run: `npm install`
Expected: `package-lock.json` updates to include `nodemailer` and its transitive dependencies; `node_modules/nodemailer` exists afterward.

- [ ] **Step 3: Write the failing tests in `tests/mailer.test.js`**

```js
process.env.NODE_ENV = 'test';

jest.mock('nodemailer');
const nodemailer = require('nodemailer');

describe('lib/mailer sendMail', () => {
  let sendMailMock;

  beforeEach(() => {
    jest.resetModules();
    sendMailMock = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
  });

  it('skips sending when no recipient is given', async () => {
    const { sendMail } = require('../lib/mailer');
    await sendMail({ to: '', subject: 'Test', html: '<p>hi</p>' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends mail with the given recipient, subject, and html', async () => {
    const { sendMail } = require('../lib/mailer');
    await sendMail({ to: 'someone@test.com', subject: 'Test Subject', html: '<p>hi</p>' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'someone@test.com', subject: 'Test Subject', html: '<p>hi</p>' })
    );
  });

  it('swallows errors from the transport instead of throwing', async () => {
    sendMailMock.mockRejectedValue(new Error('SMTP down'));
    const { sendMail } = require('../lib/mailer');
    await expect(
      sendMail({ to: 'someone@test.com', subject: 'Test', html: '<p>hi</p>' })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx jest tests/mailer.test.js -v`
Expected: FAIL — `Cannot find module '../lib/mailer'` (it doesn't exist yet).

- [ ] **Step 5: Create `lib/mailer.js`**

```js
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
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html
    });
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${to}:`, err);
  }
}

module.exports = { sendMail };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest tests/mailer.test.js -v`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/mailer.js tests/mailer.test.js
git commit -m "feat: add nodemailer-backed mail transport"
```

---

### Task 2: `technicians.email` column and seed lookup

**Files:**
- Modify: `seed.js:215-437` (technicians table creation, a new `technicianEmails` map, and the technicians seeding loop)
- Modify: `tests/api.test.js` (add a new describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `technicians` table shape `{ id, first_name, last_name, branch, supervisor, email (nullable) }`. Task 5 queries this table by `(first_name || ' ' || last_name, branch, supervisor)` to find a technician's email.

- [ ] **Step 1: Write the failing tests in `tests/api.test.js`**

Add a new describe block after the existing `describe('chemicals catalog seed data', ...)` block:

```js
describe('technicians schema and email seeding', () => {
  it('has a nullable email column', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'technicians' AND column_name = 'email'
    `);
    expect(rows).toHaveLength(1);
  });

  it('seeds technicians with a null email when not listed in technicianEmails', async () => {
    const { rows } = await db.query(
      `SELECT email FROM technicians
       WHERE first_name = 'Benjamin' AND last_name = 'Aguilar' AND branch = 'Select - LI Commercial & Residential'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBeNull();
  });

  it('reconciles a manually-changed email back to the seed-defined value on reseed', async () => {
    await db.query(
      `UPDATE technicians SET email = 'stale@example.com'
       WHERE first_name = 'Benjamin' AND last_name = 'Aguilar' AND branch = 'Select - LI Commercial & Residential'`
    );
    const seed = require('../seed');
    await seed(db);

    const { rows } = await db.query(
      `SELECT email FROM technicians
       WHERE first_name = 'Benjamin' AND last_name = 'Aguilar' AND branch = 'Select - LI Commercial & Residential'`
    );
    expect(rows[0].email).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/api.test.js -t "technicians schema and email seeding" -v`
Expected: FAIL — the `email` column doesn't exist yet, so the first assertion fails (0 rows) and the others error on the missing column.

- [ ] **Step 3: Add the `email` column in `seed.js`'s `CREATE TABLE` block**

Replace (`seed.js:386-393`):

```js
  await pool.query(`CREATE TABLE IF NOT EXISTS technicians (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name  TEXT NOT NULL,
    branch     TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    email      TEXT,
    UNIQUE(first_name, last_name, branch, supervisor)
  )`);

  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS email TEXT`);
```

- [ ] **Step 4: Add the `technicianEmails` lookup map in `seed.js`**

Add immediately after the `technicians` array's closing `];` (`seed.js:383`), before `async function seed(pool) {`:

```js

// Real technician email addresses, keyed by "First Last|Branch|Supervisor".
// Any technician not listed here seeds with email = NULL (see emails-to-fill.csv for the
// pending backfill). Re-running seed() always reconciles technicians.email to match this map.
const technicianEmails = {
  // 'Benjamin Aguilar|Select - LI Commercial & Residential|Thomas Roach': 'baguilar@example.com',
};
```

- [ ] **Step 5: Update the technicians seeding loop**

Replace (`seed.js:429-436`, the `for (const t of technicians)` loop):

```js
  for (const t of technicians) {
    const key = `${t.first_name} ${t.last_name}|${t.branch}|${t.supervisor}`;
    const email = technicianEmails[key] || null;
    await pool.query(
      `INSERT INTO technicians (first_name, last_name, branch, supervisor, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (first_name, last_name, branch, supervisor)
       DO UPDATE SET email = EXCLUDED.email`,
      [t.first_name, t.last_name, t.branch, t.supervisor, email]
    );
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest tests/api.test.js -t "technicians schema and email seeding" -v`
Expected: PASS (3 tests)

- [ ] **Step 7: Run the full test file to check for regressions**

Run: `npx jest tests/api.test.js -v`
Expected: PASS — all existing tests still pass (the `technicians` table change is additive).

- [ ] **Step 8: Commit**

```bash
git add seed.js tests/api.test.js
git commit -m "feat: add technicians.email column with a seed-time lookup map"
```

---

### Task 3: Notify supervisor when a technician submits a request

**Files:**
- Modify: `routes/technician.js:1-49`
- Modify: `tests/api.test.js` (top-of-file mock setup + the `describe('POST /submit-request', ...)` block)

**Interfaces:**
- Consumes: `sendMail` from `lib/mailer.js` (Task 1).
- Produces: the `jest.mock('../lib/mailer')` + `const mailer = require('../lib/mailer')` setup and `process.env.VENDOR_EMAIL = 'vendor@test.com'` added to the top of `tests/api.test.js` in Step 1 — Tasks 4 and 5's tests reuse both without re-declaring them.

- [ ] **Step 1: Add the mailer mock and import at the top of `tests/api.test.js`**

Replace the top of the file (the three `process.env` lines and the `request` require):

```js
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.SUPERVISOR_PASSWORD = 'testpass';
process.env.VENDOR_EMAIL = 'vendor@test.com';

jest.mock('../lib/mailer');
const mailer = require('../lib/mailer');
const request = require('supertest');
```

- [ ] **Step 2: Write the failing test in `tests/api.test.js`**

In the existing `describe('POST /submit-request', ...)` block, add `mailer.sendMail.mockClear();` to the end of the existing `afterEach`, and add a new test after the existing one:

```js
describe('POST /submit-request', () => {
  let insertedRequestId;

  afterEach(async () => {
    if (insertedRequestId) {
      await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [insertedRequestId]);
      await db.query(`DELETE FROM technician_requests WHERE id = $1`, [insertedRequestId]);
      insertedRequestId = null;
    }
    mailer.sendMail.mockClear();
  });

  it('submits a request using branch as location with no pickup_location field', async () => {
    // ... unchanged, existing test body ...
  });

  it('emails the supervisor with a link to their queue', async () => {
    await request(app)
      .post('/form2')
      .type('form')
      .send({ name: 'Test Tech', branch: 'Select', supervisor: 'Jane Doe', pickup_date: '2026-07-01' });

    const res = await request(app)
      .post('/submit-request')
      .type('form')
      .send({ chemical: 'Test Chemical', quantity: '2', unit: 'Case' });

    expect(res.status).toBe(200);
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@test.com',
        subject: 'New chemical request submitted'
      })
    );

    const { rows } = await db.query(
      `SELECT id FROM technician_requests WHERE name = 'Test Tech' ORDER BY id DESC LIMIT 1`
    );
    insertedRequestId = rows[0].id;
  });
});
```

(The `jane@test.com` / `'Jane Doe'` fixture contact is already inserted in this file's `beforeAll`.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest tests/api.test.js -t "emails the supervisor with a link to their queue" -v`
Expected: FAIL — `mailer.sendMail` was never called.

- [ ] **Step 4: Add the mailer call to `routes/technician.js`**

Replace the top of the file (`routes/technician.js:1-4`):

```js
const express = require('express');
const path = require('path');
const db = require('../db');
const mailer = require('../lib/mailer');
const router = express.Router();

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Replace the body of `/submit-request` (`routes/technician.js:17-49`):

```js
router.post('/submit-request', async (req, res) => {
  const chemicals = [].concat(req.body.chemical);
  const quantities = [].concat(req.body.quantity);
  const units = [].concat(req.body.unit);

  try {
    const result = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [
        technicianData.name,
        technicianData.branch,
        technicianData.supervisor,
        technicianData.pickup_date
      ]
    );

    const requestId = result.rows[0].id;

    for (let i = 0; i < chemicals.length; i++) {
      await db.query(
        `INSERT INTO chemical_requests (request_id, chemical, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [requestId, chemicals[i], quantities[i], units[i]]
      );
    }

    const { rows: supervisorRows } = await db.query(
      `SELECT email FROM contacts WHERE first_name || ' ' || last_name = $1`,
      [technicianData.supervisor]
    );
    const supervisorEmail = supervisorRows[0] && supervisorRows[0].email;
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const chemRowsHtml = chemicals.map((chem, i) =>
      `<tr><td>${esc(chem)}</td><td>${esc(quantities[i])}</td><td>${esc(units[i])}</td></tr>`
    ).join('');

    await mailer.sendMail({
      to: supervisorEmail,
      subject: 'New chemical request submitted',
      html: `
        <p><strong>${esc(technicianData.name)}</strong> submitted a chemical request.</p>
        <p><strong>Branch:</strong> ${esc(technicianData.branch)} &nbsp;|&nbsp;
           <strong>Pickup Date:</strong> ${esc(technicianData.pickup_date)}</p>
        <table border="1" cellpadding="4" style="border-collapse:collapse;">
          <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>
          ${chemRowsHtml}
        </table>
        <p><a href="${baseUrl}/supervisor/${encodeURIComponent(technicianData.supervisor)}">Review this request</a></p>
      `
    });

    res.sendFile(path.join(__dirname, '../views/success.html'));
  } catch (err) {
    console.error(err);
    res.send('Error saving request.');
  }
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/api.test.js -t "emails the supervisor with a link to their queue" -v`
Expected: PASS

- [ ] **Step 6: Run the full test file to check for regressions**

Run: `npx jest tests/api.test.js -v`
Expected: PASS — all tests, including the unchanged `'submits a request using branch as location...'` test (mailer is mocked, so it's a no-op there and doesn't affect the DB assertions).

- [ ] **Step 7: Commit**

```bash
git add routes/technician.js tests/api.test.js
git commit -m "feat: email the supervisor when a technician submits a request"
```

---

### Task 4: Notify vendor when a supervisor finishes approving a request

**Files:**
- Modify: `routes/supervisor.js:1-3`, `routes/supervisor.js:206-224`
- Modify: `tests/api.test.js` (add a new describe block)

**Interfaces:**
- Consumes: `sendMail` from `lib/mailer.js` (Task 1); the `jest.mock('../lib/mailer')`/`mailer` require and `process.env.VENDOR_EMAIL` set at the top of `tests/api.test.js` (Task 3, Step 1).
- Produces: no new interfaces for later tasks.

- [ ] **Step 1: Write the failing test in `tests/api.test.js`**

Add after the `describe('POST /supervisor/chem-modify/:supervisorName', ...)` block:

```js
describe('POST /supervisor/final-approve/:supervisorName', () => {
  let agent;
  let requestId, chemId;

  beforeEach(async () => {
    agent = request.agent(app);
    await agent.post('/supervisor/login').type('form').send({ password: 'testpass' });

    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Final Approve Tech', 'Pestex', 'Jane Doe', '2026-08-01', 'pending') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Test Chemical', 4, 'CS', 'approved') RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
    mailer.sendMail.mockClear();
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('emails the vendor with a link to the branch fulfillment page', async () => {
    const res = await agent
      .post('/supervisor/final-approve/Jane%20Doe')
      .type('form')
      .send({ id: requestId });

    expect(res.status).toBe(302);

    const { rows } = await db.query(`SELECT status FROM technician_requests WHERE id = $1`, [requestId]);
    expect(rows[0].status).toBe('approved');

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'vendor@test.com',
        subject: 'Request approved — ready to fulfill'
      })
    );
    const lastCall = mailer.sendMail.mock.calls[mailer.sendMail.mock.calls.length - 1][0];
    expect(lastCall.html).toContain('Pestex');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/api.test.js -t "emails the vendor with a link to the branch fulfillment page" -v`
Expected: FAIL — `mailer.sendMail` was never called.

- [ ] **Step 3: Add the mailer import to `routes/supervisor.js`**

Replace (`routes/supervisor.js:1-3`):

```js
const express = require('express');
const db = require('../db');
const mailer = require('../lib/mailer');
const router = express.Router();
```

- [ ] **Step 4: Add the mailer call to `final-approve`**

Replace the whole handler (`routes/supervisor.js:206-224`):

```js
router.post('/final-approve/:supervisorName', requireSupervisorAuth, async (req, res) => {
  const requestId = req.body.id;
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS pending_count FROM chemical_requests WHERE request_id = $1 AND status = 'pending'`,
      [requestId]
    );

    if (parseInt(rows[0].pending_count) === 0) {
      await db.query(`UPDATE chemical_requests SET status = 'approved' WHERE request_id = $1 AND status = 'modified'`, [requestId]);
      await db.query(`UPDATE technician_requests SET status = 'approved' WHERE id = $1`, [requestId]);

      const { rows: reqRows } = await db.query(
        `SELECT branch, pickup_date FROM technician_requests WHERE id = $1`,
        [requestId]
      );
      const { rows: chemRows } = await db.query(
        `SELECT chemical, quantity, unit FROM chemical_requests WHERE request_id = $1 AND status != 'rejected'`,
        [requestId]
      );
      const { branch, pickup_date } = reqRows[0];
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const chemRowsHtml = chemRows.map(c =>
        `<tr><td>${esc(c.chemical)}</td><td>${esc(c.quantity)}</td><td>${esc(c.unit)}</td></tr>`
      ).join('');

      await mailer.sendMail({
        to: process.env.VENDOR_EMAIL,
        subject: 'Request approved — ready to fulfill',
        html: `
          <p>A chemical request has been approved and is ready to fulfill.</p>
          <p><strong>Branch:</strong> ${esc(branch)} &nbsp;|&nbsp;
             <strong>Pickup Date:</strong> ${esc(pickup_date)}</p>
          <table border="1" cellpadding="4" style="border-collapse:collapse;">
            <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>
            ${chemRowsHtml}
          </table>
          <p><a href="${baseUrl}/vendor/${encodeURIComponent(branch)}">Fulfill this request</a></p>
        `
      });

      res.redirect(`/supervisor/${req.params.supervisorName}`);
    } else {
      res.send('You must review all chemicals before finalizing.');
    }
  } catch (err) {
    res.send('Error approving form.');
  }
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/api.test.js -t "emails the vendor with a link to the branch fulfillment page" -v`
Expected: PASS

- [ ] **Step 6: Run the full test file to check for regressions**

Run: `npx jest tests/api.test.js -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add routes/supervisor.js tests/api.test.js
git commit -m "feat: email the vendor when a supervisor finishes approving a request"
```

---

### Task 5: Notify technician when the last chemical on their request is fulfilled

**Files:**
- Modify: `routes/vendor.js:1-3`, `routes/vendor.js:242-255`
- Modify: `tests/api.test.js` (add a new describe block)

**Interfaces:**
- Consumes: `sendMail` from `lib/mailer.js` (Task 1); `technicians.email` column from Task 2; the `jest.mock('../lib/mailer')`/`mailer` require set at the top of `tests/api.test.js` (Task 3, Step 1).
- Produces: no new interfaces.

- [ ] **Step 1: Write the failing tests in `tests/api.test.js`**

Add after the `describe('GET /vendor/:location chemical modify dropdown', ...)` block:

```js
describe('POST /vendor/fulfill/:location', () => {
  let requestId, chemId;

  beforeEach(async () => {
    await db.query(
      `INSERT INTO technicians (first_name, last_name, branch, supervisor, email)
       VALUES ('Fulfill', 'TestTech', 'Pestex', 'Jane Doe', 'fulfilltech@test.com')
       ON CONFLICT (first_name, last_name, branch, supervisor) DO UPDATE SET email = EXCLUDED.email`
    );

    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Fulfill TestTech', 'Pestex', 'Jane Doe', '2026-08-05', 'approved') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Test Chemical', 2, 'CS', 'approved') RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
    mailer.sendMail.mockClear();
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
    await db.query(`DELETE FROM technicians WHERE first_name = 'Fulfill' AND last_name = 'TestTech'`);
  });

  it('emails the technician once the last chemical on the request is fulfilled', async () => {
    const res = await request(app)
      .post('/vendor/fulfill/Pestex')
      .type('form')
      .send({ id: chemId });

    expect(res.status).toBe(302);

    const { rows } = await db.query(`SELECT status FROM chemical_requests WHERE id = $1`, [chemId]);
    expect(rows[0].status).toBe('fulfilled');

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fulfilltech@test.com',
        subject: 'Your order is ready for pickup'
      })
    );
  });

  it('does not email while other chemicals on the request are still unfulfilled', async () => {
    const c2 = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Second Chemical', 1, 'EA', 'approved') RETURNING id`,
      [requestId]
    );
    const secondChemId = c2.rows[0].id;

    const res = await request(app)
      .post('/vendor/fulfill/Pestex')
      .type('form')
      .send({ id: chemId });

    expect(res.status).toBe(302);
    expect(mailer.sendMail).not.toHaveBeenCalled();

    await db.query(`DELETE FROM chemical_requests WHERE id = $1`, [secondChemId]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/api.test.js -t "POST /vendor/fulfill/:location" -v`
Expected: FAIL — `mailer.sendMail` was never called in the first test (the route doesn't send email yet); the second test passes vacuously (also not called) but is kept to lock in the negative case once Task 5 is implemented.

- [ ] **Step 3: Add the mailer import to `routes/vendor.js`**

Replace (`routes/vendor.js:1-3`):

```js
const express = require('express');
const db = require('../db');
const mailer = require('../lib/mailer');
const router = express.Router();
```

- [ ] **Step 4: Add the mailer call to `/fulfill/:location`**

Replace the whole handler (`routes/vendor.js:242-255`):

```js
router.post('/fulfill/:location', async (req, res) => {
  const location = decodeURIComponent(req.params.location);
  try {
    const { rows: updated } = await db.query(
      `UPDATE chemical_requests cr SET status = 'fulfilled'
       FROM technician_requests tr
       WHERE cr.id = $1 AND cr.request_id = tr.id AND tr.branch = $2
       RETURNING cr.request_id`,
      [req.body.id, location]
    );

    if (updated.length > 0) {
      const requestId = updated[0].request_id;
      const { rows: remaining } = await db.query(
        `SELECT COUNT(*) AS count FROM chemical_requests WHERE request_id = $1 AND status != 'fulfilled'`,
        [requestId]
      );

      if (parseInt(remaining[0].count, 10) === 0) {
        const { rows: reqRows } = await db.query(
          `SELECT name, branch, pickup_date, supervisor FROM technician_requests WHERE id = $1`,
          [requestId]
        );
        const { rows: chemRows } = await db.query(
          `SELECT chemical, quantity, unit FROM chemical_requests WHERE request_id = $1`,
          [requestId]
        );
        const { name, branch, pickup_date, supervisor } = reqRows[0];

        const { rows: techRows } = await db.query(
          `SELECT email FROM technicians
           WHERE first_name || ' ' || last_name = $1 AND branch = $2 AND supervisor = $3`,
          [name, branch, supervisor]
        );
        const technicianEmail = techRows[0] && techRows[0].email;
        const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const chemRowsHtml = chemRows.map(c =>
          `<tr><td>${esc(c.chemical)}</td><td>${esc(c.quantity)}</td><td>${esc(c.unit)}</td></tr>`
        ).join('');

        await mailer.sendMail({
          to: technicianEmail,
          subject: 'Your order is ready for pickup',
          html: `
            <p>Your chemical order is ready for pickup.</p>
            <p><strong>Branch:</strong> ${esc(branch)} &nbsp;|&nbsp;
               <strong>Pickup Date:</strong> ${esc(pickup_date)}</p>
            <table border="1" cellpadding="4" style="border-collapse:collapse;">
              <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>
              ${chemRowsHtml}
            </table>
            <p><a href="${baseUrl}/submissions">View submissions</a></p>
          `
        });
      }
    }

    res.redirect(`/vendor/${encodeURIComponent(location)}`);
  } catch (err) {
    res.send('Error fulfilling chemical.');
  }
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/api.test.js -t "POST /vendor/fulfill/:location" -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full test file to check for regressions**

Run: `npx jest tests/api.test.js -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add routes/vendor.js tests/api.test.js
git commit -m "feat: email the technician when their order is ready for pickup"
```

---

### Task 6: Environment configuration, full regression, and manual verification

**Files:**
- Modify: `.env` (not committed — gitignored)

**Interfaces:** none — this task wires up configuration and verifies Tasks 1-5 end to end.

- [ ] **Step 1: Add the new env vars to `.env`**

Append to `.env` (fill in real values — an SMTP account's host/port/credentials, and the vendor's real email address):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
VENDOR_EMAIL=
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 2: Add the same env vars on Render**

In the Render dashboard for this service's Environment tab, add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `VENDOR_EMAIL`, and set `APP_BASE_URL` to the production URL (`https://inventory-management-hiyg.onrender.com`).

- [ ] **Step 3: Run the full automated test suite**

Run: `npm test`
Expected: All test suites pass (`tests/api.test.js`, `tests/auth.test.js`, `tests/mailer.test.js`), no failures.

- [ ] **Step 4: Manually verify the submit → supervisor email**

Run: `npm start`. In a browser, submit a request through `/` using a technician whose supervisor is a real contact with a real email address (check `seed.js`'s `contacts` array or `/api/contacts`). Confirm an email arrives at that address with a link to `/supervisor/<name>`, and that following the link reaches that supervisor's pending-request queue.

- [ ] **Step 5: Manually verify the final-approve → vendor email**

Log into `/supervisor/login`, approve every chemical on the test request from Step 4, then click final approve. Confirm an email arrives at `VENDOR_EMAIL` with a link to `/vendor/<branch>`, and that the link reaches that branch's fulfillment queue with the approved chemicals visible.

- [ ] **Step 6: Manually verify the fulfill → technician email**

This will only send if the technician used in Step 4 has a non-null `email` in the `technicians` table — since `technicianEmails` is empty until the completed CSV is applied (out of scope for this plan), temporarily add one entry to `technicianEmails` in `seed.js` for your test technician, restart the app (so it reseeds), then fulfill every chemical on the test request from the vendor page for that branch. Confirm an email arrives at that technician's address. Afterward, remove the temporary `technicianEmails` entry (or leave it — it's harmless, but shouldn't be committed as part of this plan since it's fake test data).

- [ ] **Step 7: No commit for this task** — it's configuration and verification only. If any step surfaces a bug, fix it in the relevant task's files and re-run that task's tests before re-verifying here.
