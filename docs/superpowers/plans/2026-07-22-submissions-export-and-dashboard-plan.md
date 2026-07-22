# Submissions Excel Export & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone viewing `/submissions` download the raw data as an Excel file, and view four summary charts on a separate in-browser dashboard page.

**Architecture:** A new `GET /export-submissions.xlsx` route (`routes/technician.js`) reuses `/submissions`'s existing query shape to build a single-sheet workbook via `exceljs`, streamed as a download — no charts in the file itself. A new `GET /api/dashboard-data` route (`routes/api.js`) returns four pre-aggregated JSON arrays (SQL `GROUP BY`/`SUM`/`COUNT`, no client-side aggregation). A new static `views/dashboard.html` (matching the existing `form1.html`/`form2.html` convention: plain HTML, vanilla `<script>`, no build step) fetches that JSON and renders four Chart.js bar charts, with Chart.js loaded from a CDN script tag. `/submissions` gets two new links to both.

**Tech Stack:** Node/Express, `pg` (Postgres), `exceljs` (new dependency), Chart.js (CDN, no npm dependency), Jest + Supertest.

## Global Constraints

- Per the approved design (`docs/superpowers/specs/2026-07-22-submissions-export-and-dashboard-design.md`): no charts embedded in the Excel file — that was considered and explicitly dropped in favor of a separate in-browser dashboard.
- All new routes (`/export-submissions.xlsx`, `/dashboard`, `/api/dashboard-data`) are public/unauthenticated, matching `/submissions` today. No auth changes anywhere.
- No filtering/date-range controls — the export and dashboard always reflect all submissions, matching `/submissions`'s current all-data behavior.
- `requestsOverTime` groups by the exact `pickup_date` value (not bucketed by month/week) and is ordered chronologically ascending.
- `technicianQuantities` includes only technicians who have actually submitted at least one chemical line item — not every seeded technician.
- All four dashboard charts are Chart.js **bar** charts (including "requests over time").

## Environment Note (read before dispatching any task)

This environment has no system-installed Node/npm, but a portable Node v22.14.0 was extracted to `$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64` during the previous feature's work and is still there. Every task below can and should run real `npm`/`npx` commands — prepend this to any PowerShell command that needs `node`/`npm`/`npx`:

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
```

**However, there is no reachable Postgres in this environment** (no `DATABASE_URL`, no local Postgres server). Any test that hits the database (via `tests/api.test.js`'s shared `beforeAll`, which inserts fixture rows) will fail with `ECONNREFUSED`/`AggregateError` from `pg-pool` — for every test in that file, not just new ones, including tests that predate this plan. This is a pre-existing environment limitation, not a code defect. When running tests:
- Run them for real (`npx jest ...`) — don't skip execution or fall back to hand-tracing by default.
- If a test fails, read the failure: if it's an `ECONNREFUSED`/`AggregateError` from `pg-pool` (i.e., the DB connection itself), that's the expected, pre-existing environment limitation — note it and move on. If it's any *other* kind of failure (a syntax error, a thrown error from your own code, an assertion mismatch not rooted in a DB connection error), that's a real bug — fix it.
- One task in this plan (Task 3) adds a test to a **new, separate file** that deliberately avoids the DB-fixture-dependent `beforeAll`, specifically so it can pass for real in this environment — treat any failure there as a real bug, full stop.

---

### Task 1: Excel export route

**Files:**
- Modify: `package.json` (add `exceljs` dependency)
- Modify: `routes/technician.js` (add `const ExcelJS = require('exceljs');` to the top requires; add a new `GET /export-submissions.xlsx` route after the existing `GET /submissions` route)
- Modify: `tests/api.test.js` (add a new `describe` block)

**Interfaces:**
- Produces: `GET /export-submissions.xlsx` — streams an `.xlsx` workbook with one sheet named `Submissions`. No other task depends on this route directly (Task 4 only links to it by URL string).

- [ ] **Step 1: Add the `exceljs` dependency to `package.json`**

In the `"dependencies"` block, add (keeping alphabetical order):

```json
    "exceljs": "^4.4.0",
```

So the block reads:

```json
  "dependencies": {
    "dotenv": "^16.0.0",
    "exceljs": "^4.4.0",
    "express": "^5.1.0",
    "express-session": "^1.17.3",
    "pg": "^8.11.0"
  },
```

- [ ] **Step 2: Install it for real**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npm install
```

Expected: `package-lock.json` updates to include `exceljs`; `node_modules/exceljs` exists afterward. This must succeed — unlike the DB, npm registry access doesn't depend on this environment's missing Postgres.

- [ ] **Step 3: Write the failing test in `tests/api.test.js`**

Add near the top of the file (once, alongside the other top-level requires — check whether a prior task already added something similar before duplicating):

```js
const ExcelJS = require('exceljs');
```

Add a new describe block after the existing `describe('GET /vendor/:location chemical modify dropdown', ...)` block (the last one in the file):

```js
describe('GET /export-submissions.xlsx', () => {
  let requestId, chemId;

  beforeEach(async () => {
    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Export Test Tech', 'Pestex', 'Jane Doe', '2026-08-10', 'pending') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Test Chemical', 5, 'CS', 'pending') RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('returns a valid xlsx workbook containing the submission data', async () => {
    const res = await request(app).get('/export-submissions.xlsx');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.headers['content-disposition']).toContain('submissions.xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheet = workbook.getWorksheet('Submissions');
    expect(sheet).toBeDefined();

    const headerRow = sheet.getRow(1).values.filter(v => v !== undefined && v !== null);
    expect(headerRow).toEqual([
      'Request ID', 'Technician', 'Branch', 'Supervisor', 'Pickup Date', 'Status', 'Chemical', 'Quantity', 'Unit'
    ]);

    let found = false;
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      if (row.getCell(1).value === requestId) {
        expect(row.getCell(2).value).toBe('Export Test Tech');
        expect(row.getCell(3).value).toBe('Pestex');
        expect(row.getCell(7).value).toBe('Test Chemical');
        expect(row.getCell(8).value).toBe(5);
        expect(row.getCell(9).value).toBe('CS');
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -t "GET /export-submissions.xlsx" -v
```

Expected: FAIL — either a 404 (route doesn't exist yet) or, if it fails with an `ECONNREFUSED`/`AggregateError` from the `beforeEach` insert, that's this environment's DB limitation (see Environment Note) — in that case, re-read the test carefully to confirm the *logic* is right by inspection, since you can't get a real pass/fail signal from this specific test here. Either way, proceed to implement.

- [ ] **Step 5: Implement the route in `routes/technician.js`**

Add to the top requires (after `const db = require('../db');`):

```js
const ExcelJS = require('exceljs');
```

Add after the existing `router.get('/submissions', ...)` handler, before `module.exports = router;`:

```js
router.get('/export-submissions.xlsx', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        tr.id AS request_id,
        tr.name,
        tr.branch,
        tr.supervisor,
        tr.pickup_date,
        tr.status,
        cr.chemical,
        cr.quantity,
        cr.unit
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      ORDER BY tr.id DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Submissions');
    sheet.addRow([
      'Request ID', 'Technician', 'Branch', 'Supervisor', 'Pickup Date', 'Status', 'Chemical', 'Quantity', 'Unit'
    ]);
    rows.forEach(row => {
      sheet.addRow([
        row.request_id, row.name, row.branch, row.supervisor, row.pickup_date, row.status,
        row.chemical, row.quantity, row.unit
      ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating export.');
  }
});
```

- [ ] **Step 6: Run the test again**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -t "GET /export-submissions.xlsx" -v
```

Expected: PASS if a real Postgres becomes reachable; if it still fails with `ECONNREFUSED`/`AggregateError`, that confirms it's the environment's DB limitation (not this code) — verify correctness by careful code review instead, and say so explicitly in your report.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json routes/technician.js tests/api.test.js
git commit -m "feat: add Excel export route for submissions"
```

---

### Task 2: Dashboard data API

**Files:**
- Modify: `routes/api.js` (add `GET /dashboard-data`)
- Modify: `tests/api.test.js` (add a new `describe` block)

**Interfaces:**
- Produces: `GET /api/dashboard-data` → `{ chemicalQuantities: [{chemical, totalQuantity}], branchCounts: [{branch, requestCount}], requestsOverTime: [{pickupDate, requestCount}], technicianQuantities: [{name, totalQuantity}] }`. Task 3's `views/dashboard.html` consumes this exact shape — field names must match exactly (`chemical`/`totalQuantity`, `branch`/`requestCount`, `pickupDate`/`requestCount`, `name`/`totalQuantity`).

- [ ] **Step 1: Write the failing test in `tests/api.test.js`**

Add after the `describe('GET /export-submissions.xlsx', ...)` block added in Task 1:

```js
describe('GET /api/dashboard-data', () => {
  let requestId, chemId;

  beforeEach(async () => {
    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Dashboard Test Tech', 'Dashboard Test Branch', 'Jane Doe', '2026-09-01', 'pending') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Dashboard Test Chemical', 7, 'CS', 'pending') RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('returns aggregated data including the known fixture rows', async () => {
    const res = await request(app).get('/api/dashboard-data');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('chemicalQuantities');
    expect(res.body).toHaveProperty('branchCounts');
    expect(res.body).toHaveProperty('requestsOverTime');
    expect(res.body).toHaveProperty('technicianQuantities');

    const chem = res.body.chemicalQuantities.find(c => c.chemical === 'Dashboard Test Chemical');
    expect(chem).toEqual({ chemical: 'Dashboard Test Chemical', totalQuantity: 7 });

    const branch = res.body.branchCounts.find(b => b.branch === 'Dashboard Test Branch');
    expect(branch).toEqual({ branch: 'Dashboard Test Branch', requestCount: 1 });

    const day = res.body.requestsOverTime.find(d => d.pickupDate === '2026-09-01');
    expect(day).toEqual({ pickupDate: '2026-09-01', requestCount: 1 });

    const tech = res.body.technicianQuantities.find(t => t.name === 'Dashboard Test Tech');
    expect(tech).toEqual({ name: 'Dashboard Test Tech', totalQuantity: 7 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -t "GET /api/dashboard-data" -v
```

Expected: FAIL (404 — route doesn't exist yet — or an `ECONNREFUSED`/`AggregateError` per the Environment Note).

- [ ] **Step 3: Implement the route in `routes/api.js`**

Add before `module.exports = router;`:

```js
router.get('/dashboard-data', async (req, res) => {
  try {
    const [chemicalRes, branchRes, timeRes, techRes] = await Promise.all([
      db.query(
        `SELECT chemical, SUM(quantity) AS total_quantity
         FROM chemical_requests
         WHERE chemical IS NOT NULL
         GROUP BY chemical
         ORDER BY total_quantity DESC`
      ),
      db.query(
        `SELECT branch, COUNT(*) AS request_count
         FROM technician_requests
         GROUP BY branch
         ORDER BY request_count DESC`
      ),
      db.query(
        `SELECT pickup_date, COUNT(*) AS request_count
         FROM technician_requests
         GROUP BY pickup_date
         ORDER BY pickup_date ASC`
      ),
      db.query(
        `SELECT tr.name, SUM(cr.quantity) AS total_quantity
         FROM technician_requests tr
         JOIN chemical_requests cr ON cr.request_id = tr.id
         WHERE cr.quantity IS NOT NULL
         GROUP BY tr.name
         ORDER BY total_quantity DESC`
      )
    ]);

    res.json({
      chemicalQuantities: chemicalRes.rows.map(r => ({
        chemical: r.chemical,
        totalQuantity: parseInt(r.total_quantity, 10)
      })),
      branchCounts: branchRes.rows.map(r => ({
        branch: r.branch,
        requestCount: parseInt(r.request_count, 10)
      })),
      requestsOverTime: timeRes.rows.map(r => ({
        pickupDate: r.pickup_date,
        requestCount: parseInt(r.request_count, 10)
      })),
      technicianQuantities: techRes.rows.map(r => ({
        name: r.name,
        totalQuantity: parseInt(r.total_quantity, 10)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});
```

- [ ] **Step 4: Run the test again**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -t "GET /api/dashboard-data" -v
```

Expected: PASS if Postgres is reachable; otherwise confirm the failure is `ECONNREFUSED`/`AggregateError`-rooted per the Environment Note, and verify correctness by code review instead.

- [ ] **Step 5: Commit**

```bash
git add routes/api.js tests/api.test.js
git commit -m "feat: add dashboard data aggregation API"
```

---

### Task 3: Dashboard page

**Files:**
- Create: `views/dashboard.html`
- Modify: `routes/technician.js` (add `GET /dashboard`)
- Create: `tests/dashboard.test.js` (deliberately separate from `tests/api.test.js` — see below)

**Interfaces:**
- Consumes: `/api/dashboard-data`'s JSON shape from Task 2 (client-side `fetch`, not tested server-side here).
- Produces: `GET /dashboard` → the static dashboard page. No other task depends on this.

This task's test goes in a **new** file, `tests/dashboard.test.js`, modeled on the lightweight pattern in `tests/auth.test.js` (boots the app once, no DB-fixture `beforeAll`). `GET /dashboard` just serves a static file and never touches the database, so — unlike every test in `tests/api.test.js` — this test can genuinely pass in this environment even without a reachable Postgres. Treat any failure here as a real bug, not an environment limitation.

- [ ] **Step 1: Write the failing test in `tests/dashboard.test.js`**

```js
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.SUPERVISOR_PASSWORD = 'testpass';

const request = require('supertest');

let app, db;

beforeAll(async () => {
  jest.resetModules();
  db = require('../db');
  app = require('../index');
});

afterAll(async () => {
  await db.end();
});

describe('GET /dashboard', () => {
  it('serves the dashboard page with four chart canvases and the Chart.js CDN script', async () => {
    const res = await request(app).get('/dashboard');

    expect(res.status).toBe(200);
    expect(res.text).toContain('cdn.jsdelivr.net/npm/chart.js');
    expect(res.text).toContain('id="chemical-chart"');
    expect(res.text).toContain('id="branch-chart"');
    expect(res.text).toContain('id="time-chart"');
    expect(res.text).toContain('id="technician-chart"');
    expect(res.text).toContain("fetch('/api/dashboard-data')");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/dashboard.test.js -v
```

Expected: FAIL for real (404 — route doesn't exist yet). This should be a genuine failure, not an environment-limitation one — there's no DB involved.

- [ ] **Step 3: Create `views/dashboard.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Submissions Dashboard</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h2>Submissions Dashboard</h2>

  <canvas id="chemical-chart" width="800" height="400"></canvas>
  <canvas id="branch-chart" width="800" height="400"></canvas>
  <canvas id="time-chart" width="800" height="400"></canvas>
  <canvas id="technician-chart" width="800" height="400"></canvas>

  <script>
    fetch('/api/dashboard-data')
      .then(r => r.json())
      .then(data => {
        new Chart(document.getElementById('chemical-chart'), {
          type: 'bar',
          data: {
            labels: data.chemicalQuantities.map(d => d.chemical),
            datasets: [{ label: 'Total Quantity Requested', data: data.chemicalQuantities.map(d => d.totalQuantity) }]
          },
          options: { plugins: { title: { display: true, text: 'Total Quantity Requested per Chemical' } } }
        });

        new Chart(document.getElementById('branch-chart'), {
          type: 'bar',
          data: {
            labels: data.branchCounts.map(d => d.branch),
            datasets: [{ label: 'Requests', data: data.branchCounts.map(d => d.requestCount) }]
          },
          options: { plugins: { title: { display: true, text: 'Requests per Branch' } } }
        });

        new Chart(document.getElementById('time-chart'), {
          type: 'bar',
          data: {
            labels: data.requestsOverTime.map(d => d.pickupDate),
            datasets: [{ label: 'Requests', data: data.requestsOverTime.map(d => d.requestCount) }]
          },
          options: { plugins: { title: { display: true, text: 'Requests Over Time' } } }
        });

        new Chart(document.getElementById('technician-chart'), {
          type: 'bar',
          data: {
            labels: data.technicianQuantities.map(d => d.name),
            datasets: [{ label: 'Total Quantity Ordered', data: data.technicianQuantities.map(d => d.totalQuantity) }]
          },
          options: { plugins: { title: { display: true, text: 'Total Quantity Ordered per Technician' } } }
        });
      })
      .catch(() => {
        document.body.innerHTML += '<p>Error loading dashboard data.</p>';
      });
  </script>
</body>
</html>
```

- [ ] **Step 4: Add the route in `routes/technician.js`**

Add after the existing `router.get('/submissions', ...)` handler (or after Task 1's export route if that's already present in the file):

```js
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});
```

- [ ] **Step 5: Run the test again**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/dashboard.test.js -v
```

Expected: PASS for real — this test doesn't depend on Postgres, so a failure here means a real bug (fix it before moving on).

- [ ] **Step 6: Commit**

```bash
git add views/dashboard.html routes/technician.js tests/dashboard.test.js
git commit -m "feat: add in-browser submissions dashboard with Chart.js"
```

---

### Task 4: Link the export and dashboard from `/submissions`

**Files:**
- Modify: `public/styles.css` (add an `a.button` style — the existing `button` rule only targets `<button>` elements, not links)
- Modify: `routes/technician.js` (add two links to the `/submissions` handler's generated HTML)
- Modify: `tests/api.test.js` (add a new `describe` block)

**Interfaces:**
- Consumes: the URLs `/export-submissions.xlsx` (Task 1) and `/dashboard` (Task 3) — as literal strings in an `href`, not a code-level dependency.

- [ ] **Step 1: Write the failing test in `tests/api.test.js`**

Add after the `describe('GET /api/dashboard-data', ...)` block added in Task 2:

```js
describe('GET /submissions links', () => {
  it('links to the Excel export and the dashboard', async () => {
    const res = await request(app).get('/submissions');
    expect(res.status).toBe(200);
    expect(res.text).toContain('href="/export-submissions.xlsx"');
    expect(res.text).toContain('href="/dashboard"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -t "GET /submissions links" -v
```

Expected: FAIL — links not present yet (or an `ECONNREFUSED`/`AggregateError` per the Environment Note, since this route queries the DB before rendering).

- [ ] **Step 3: Add the `a.button` style to `public/styles.css`**

Add after the existing `button:hover { background-color: #2980b9; }` rule:

```css
a.button {
  display: inline-block;
  background-color: #3498db;
  color: white;
  padding: 0.7rem 1.5rem;
  margin-top: 1rem;
  margin-right: 1rem;
  border-radius: 4px;
  text-decoration: none;
}

a.button:hover {
  background-color: #2980b9;
}
```

- [ ] **Step 4: Add the links in `routes/technician.js`'s `/submissions` handler**

Replace the `let html = ...` line (the one starting the response body):

```js
    let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>All Submissions</title></head><body>
      <h2>Submitted Requests with Chemicals</h2>
      <a class="button" href="/export-submissions.xlsx">Export to Excel</a>
      <a class="button" href="/dashboard">View Dashboard</a>`;
```

- [ ] **Step 5: Run the test again**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -t "GET /submissions links" -v
```

Expected: PASS if Postgres is reachable; otherwise confirm the failure is `ECONNREFUSED`/`AggregateError`-rooted, and verify correctness by code review instead.

- [ ] **Step 6: Run the full `tests/api.test.js` file to check for regressions**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npx jest tests/api.test.js -v
```

Expected: same pass/fail pattern as before this task for every pre-existing test (no new regressions introduced) — every DB-dependent test fails identically due to the environment's missing Postgres, not because of this change.

- [ ] **Step 7: Commit**

```bash
git add public/styles.css routes/technician.js tests/api.test.js
git commit -m "feat: link Excel export and dashboard from the submissions page"
```

---

### Task 5: Full regression and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

```powershell
$env:PATH = "$env:LOCALAPPDATA\node-portable\node-v22.14.0-win-x64;$env:PATH"
npm test
```

Expected: `tests/mailer.test.js` (if present on this branch) and `tests/dashboard.test.js` pass for real. `tests/api.test.js` and `tests/auth.test.js`'s DB-touching tests fail with `ECONNREFUSED`/`AggregateError` — expected in this environment; note the exact count so the PR description can state "N pre-existing DB-dependent tests fail here due to no local Postgres; verified via Render deploy" rather than silently omitting it.

- [ ] **Step 2: Push and verify via the live Render deploy**

Per this project's established workflow, push the branch and verify all three new features against the real production database:
- Visit `/submissions`, confirm both new links render and are styled as buttons.
- Click "Export to Excel", confirm a `submissions.xlsx` downloads and opens with a `Submissions` sheet containing real data.
- Click "View Dashboard", confirm all four charts render with real data and no console errors (check the browser's dev tools console for any Chart.js or fetch errors).

- [ ] **Step 3: No commit for this task** — verification only. If any step surfaces a bug, fix it in the relevant task's files and re-run that task's tests before re-verifying here.
