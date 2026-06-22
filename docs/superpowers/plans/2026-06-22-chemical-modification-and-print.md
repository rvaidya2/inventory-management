# Chemical Modification & Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow supervisors and vendors to modify chemicals on a request (inline, no page reload), and let vendors print a before/after summary after all chemicals are fulfilled.

**Architecture:** All changes are additive to existing routes. Two new columns on `chemical_requests` track the original submission values. Three new POST/GET routes handle modification and print. HTML is generated server-side as strings (matching existing pattern). Inline expand/collapse is handled with vanilla JS embedded in the page.

**Tech Stack:** Node.js, Express 5, PostgreSQL (`pg`), vanilla JS, Jest + Supertest

## Global Constraints

- Chemical values stored as `product_name` string (e.g. `'ADVION Ant Gel'`) — matches form2.html and existing chemical_requests rows
- All HTML responses are built as template strings server-side — no separate view files
- Session auth (`req.session.supervisorAuthed`) is required for all supervisor routes
- Vendor routes have no auth
- Run tests with: `npm test`

---

### Task 1: DB Migration — add original_chemical and original_quantity columns

**Files:**
- Modify: `db.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Produces: `chemical_requests.original_chemical TEXT` (null = never modified), `chemical_requests.original_quantity INTEGER`

- [ ] **Step 1: Write the failing test**

Add to `tests/api.test.js` inside a new `describe` block after the existing ones:

```js
describe('chemical_requests schema', () => {
  it('has original_chemical and original_quantity columns', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'chemical_requests'
        AND column_name IN ('original_chemical', 'original_quantity')
    `);
    const names = rows.map(r => r.column_name);
    expect(names).toContain('original_chemical');
    expect(names).toContain('original_quantity');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: FAIL — `original_chemical` and `original_quantity` not in results

- [ ] **Step 3: Add ALTER TABLE statements to initDb() in db.js**

Open `db.js`. After the existing `CREATE TABLE IF NOT EXISTS technicians` block (line 54), add before the closing brace of `initDb`:

```js
  await pool.query(`ALTER TABLE chemical_requests ADD COLUMN IF NOT EXISTS original_chemical TEXT`);
  await pool.query(`ALTER TABLE chemical_requests ADD COLUMN IF NOT EXISTS original_quantity INTEGER`);
```

The end of `initDb` should look like:

```js
  await pool.query(`CREATE TABLE IF NOT EXISTS technicians (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name  TEXT NOT NULL,
    branch     TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    UNIQUE(first_name, last_name, branch, supervisor)
  )`);

  await pool.query(`ALTER TABLE chemical_requests ADD COLUMN IF NOT EXISTS original_chemical TEXT`);
  await pool.query(`ALTER TABLE chemical_requests ADD COLUMN IF NOT EXISTS original_quantity INTEGER`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: PASS — both columns found

- [ ] **Step 5: Commit**

```bash
git add db.js tests/api.test.js
git commit -m "feat: add original_chemical and original_quantity columns to chemical_requests"
```

---

### Task 2: Supervisor modify route

**Files:**
- Modify: `routes/supervisor.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Consumes: `chemical_requests.original_chemical` (from Task 1)
- Produces: `POST /supervisor/chem-modify/:supervisorName` — reads `id`, `chemical`, `quantity` from body; sets `original_*` on first modification; sets `status = 'modified'`

- [ ] **Step 1: Write the failing tests**

Add to `tests/api.test.js`:

```js
describe('POST /supervisor/chem-modify/:supervisorName', () => {
  let agent;
  let requestId, chemId;

  beforeEach(async () => {
    agent = request.agent(app);
    await agent
      .post('/supervisor/login')
      .type('form')
      .send({ password: 'testpass' });

    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Mod Test Tech', 'Select', 'Jane Doe', '2026-07-01', 'pending') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Test Chemical', 3, 'case', 'pending') RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('saves original values on first modification and sets status to modified', async () => {
    const res = await agent
      .post('/supervisor/chem-modify/Jane%20Doe')
      .type('form')
      .send({ id: chemId, chemical: 'BIFEN I/T', quantity: '5' });

    expect(res.status).toBe(302);

    const { rows } = await db.query(
      `SELECT * FROM chemical_requests WHERE id = $1`, [chemId]
    );
    expect(rows[0].chemical).toBe('BIFEN I/T');
    expect(rows[0].quantity).toBe(5);
    expect(rows[0].original_chemical).toBe('Test Chemical');
    expect(rows[0].original_quantity).toBe(3);
    expect(rows[0].status).toBe('modified');
  });

  it('keeps original values on second modification', async () => {
    await agent
      .post('/supervisor/chem-modify/Jane%20Doe')
      .type('form')
      .send({ id: chemId, chemical: 'BIFEN I/T', quantity: '5' });

    await agent
      .post('/supervisor/chem-modify/Jane%20Doe')
      .type('form')
      .send({ id: chemId, chemical: 'TALSTAR P', quantity: '2' });

    const { rows } = await db.query(
      `SELECT * FROM chemical_requests WHERE id = $1`, [chemId]
    );
    expect(rows[0].chemical).toBe('TALSTAR P');
    expect(rows[0].original_chemical).toBe('Test Chemical');
    expect(rows[0].original_quantity).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: FAIL — route does not exist

- [ ] **Step 3: Add the route to routes/supervisor.js**

Add before `module.exports = router;` in `routes/supervisor.js`:

```js
router.post('/chem-modify/:supervisorName', requireSupervisorAuth, async (req, res) => {
  const { id, chemical, quantity } = req.body;
  try {
    const { rows } = await db.query(
      `SELECT chemical, quantity, original_chemical FROM chemical_requests WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.send('Chemical not found.');

    const row = rows[0];
    if (row.original_chemical === null) {
      await db.query(
        `UPDATE chemical_requests
         SET original_chemical = $1, original_quantity = $2,
             chemical = $3, quantity = $4, status = 'modified'
         WHERE id = $5`,
        [row.chemical, row.quantity, chemical, parseInt(quantity), id]
      );
    } else {
      await db.query(
        `UPDATE chemical_requests SET chemical = $1, quantity = $2, status = 'modified' WHERE id = $3`,
        [chemical, parseInt(quantity), id]
      );
    }
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  } catch (err) {
    console.error(err);
    res.send('Error modifying chemical.');
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/supervisor.js tests/api.test.js
git commit -m "feat: add supervisor chemical modify route"
```

---

### Task 3: Supervisor UI — inline Modify button and expand form

**Files:**
- Modify: `routes/supervisor.js`

**Interfaces:**
- Consumes: `POST /supervisor/chem-modify/:supervisorName` (Task 2), `GET /api/chemicals`

- [ ] **Step 1: Add JS block to the supervisor page HTML**

In `routes/supervisor.js`, find where the HTML string starts:

```js
let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>Supervisor Approvals</title></head><body>`;
```

Replace with:

```js
let html = `<html>
<head>
  <link rel="stylesheet" href="/styles.css">
  <title>Supervisor Approvals</title>
  <script>
    let _chemicals = [];
    fetch('/api/chemicals').then(r => r.json()).then(data => { _chemicals = data; });

    function toggleModify(id, currentChem, currentQty) {
      const row = document.getElementById('mod-row-' + id);
      if (row.style.display === 'none') {
        row.style.display = '';
        const sel = document.getElementById('mod-chem-' + id);
        if (sel.options.length === 0) {
          _chemicals.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.product_name;
            opt.textContent = c.product_name;
            if (c.product_name === currentChem) opt.selected = true;
            sel.appendChild(opt);
          });
        }
        document.getElementById('mod-qty-' + id).value = currentQty;
      } else {
        row.style.display = 'none';
      }
    }
  <\/script>
</head>
<body>`;
```

- [ ] **Step 2: Add Modify button to each pending chemical row**

Find the section that builds the chemical rows. It currently looks like:

```js
req.chemicals.forEach(chem => {
  html += `
    <tr>
      <td>${chem.chemical}</td>
      <td>${chem.quantity}</td>
      <td>${chem.unit}</td>
      <td>${chem.status}</td>
      <td>
        ${chem.status === 'pending' ? `
          <form method="POST" action="/supervisor/chem-approve/${supervisorName}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            <button type="submit">Approve</button>
          </form>
          <form method="POST" action="/supervisor/chem-reject/${supervisorName}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            <button type="submit">Reject</button>
          </form>
        ` : chem.status.charAt(0).toUpperCase() + chem.status.slice(1)}
      </td>
    </tr>`;
});
```

Replace with:

```js
req.chemicals.forEach(chem => {
  html += `
    <tr>
      <td>${chem.chemical}</td>
      <td>${chem.quantity}</td>
      <td>${chem.unit}</td>
      <td>${chem.status}</td>
      <td>
        ${chem.status === 'pending' ? `
          <form method="POST" action="/supervisor/chem-approve/${supervisorName}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            <button type="submit">Approve</button>
          </form>
          <form method="POST" action="/supervisor/chem-reject/${supervisorName}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            <button type="submit">Reject</button>
          </form>
          <button type="button" onclick="toggleModify('${chem.chem_id}', ${JSON.stringify(chem.chemical)}, ${chem.quantity})">Modify</button>
        ` : chem.status.charAt(0).toUpperCase() + chem.status.slice(1)}
      </td>
    </tr>
    <tr id="mod-row-${chem.chem_id}" style="display:none">
      <td colspan="5" style="padding:0.5rem; background:#f9f9f9;">
        <form method="POST" action="/supervisor/chem-modify/${supervisorName}" style="display:inline;">
          <input type="hidden" name="id" value="${chem.chem_id}">
          Chemical: <select id="mod-chem-${chem.chem_id}" name="chemical" required></select>
          &nbsp;Qty: <input id="mod-qty-${chem.chem_id}" type="number" name="quantity" min="1" required style="width:60px;">
          &nbsp;<button type="submit">Save</button>
          &nbsp;<button type="button" onclick="toggleModify('${chem.chem_id}')">Cancel</button>
        </form>
      </td>
    </tr>`;
});
```

- [ ] **Step 3: Verify manually**

Start the app locally (`npm start`), navigate to `/supervisor/login`, log in, open a supervisor view that has pending chemicals. Confirm:
- Three buttons appear: Approve, Reject, Modify
- Clicking Modify expands a row with a chemicals dropdown and quantity input
- Clicking Cancel hides it again
- Submitting Save redirects back and the chemical is updated with status `modified`

- [ ] **Step 4: Commit**

```bash
git add routes/supervisor.js
git commit -m "feat: add inline modify form to supervisor chemical rows"
```

---

### Task 4: Vendor modify route

**Files:**
- Modify: `routes/vendor.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Consumes: `chemical_requests.original_chemical` (from Task 1)
- Produces: `POST /vendor/chem-modify/:location` — same first-modification/subsequent logic as supervisor route, but no status change (vendor modify keeps current status)

- [ ] **Step 1: Write the failing tests**

Add to `tests/api.test.js`:

```js
describe('POST /vendor/chem-modify/:location', () => {
  let requestId, chemId;

  beforeEach(async () => {
    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Vendor Mod Tech', 'Pestex', 'Jane Doe', '2026-07-01', 'approved') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Test Chemical', 3, 'case', 'approved') RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('saves original values on first modification', async () => {
    const res = await request(app)
      .post('/vendor/chem-modify/Pestex')
      .type('form')
      .send({ id: chemId, chemical: 'BIFEN I/T', quantity: '2' });

    expect(res.status).toBe(302);

    const { rows } = await db.query(
      `SELECT * FROM chemical_requests WHERE id = $1`, [chemId]
    );
    expect(rows[0].chemical).toBe('BIFEN I/T');
    expect(rows[0].quantity).toBe(2);
    expect(rows[0].original_chemical).toBe('Test Chemical');
    expect(rows[0].original_quantity).toBe(3);
  });

  it('keeps original values on second modification', async () => {
    await request(app)
      .post('/vendor/chem-modify/Pestex')
      .type('form')
      .send({ id: chemId, chemical: 'BIFEN I/T', quantity: '2' });

    await request(app)
      .post('/vendor/chem-modify/Pestex')
      .type('form')
      .send({ id: chemId, chemical: 'TALSTAR P', quantity: '1' });

    const { rows } = await db.query(
      `SELECT * FROM chemical_requests WHERE id = $1`, [chemId]
    );
    expect(rows[0].chemical).toBe('TALSTAR P');
    expect(rows[0].original_chemical).toBe('Test Chemical');
    expect(rows[0].original_quantity).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: FAIL — route does not exist

- [ ] **Step 3: Add the route to routes/vendor.js**

Add before `module.exports = router;` in `routes/vendor.js`:

```js
router.post('/chem-modify/:location', async (req, res) => {
  const location = decodeURIComponent(req.params.location);
  const { id, chemical, quantity } = req.body;
  try {
    const { rows } = await db.query(
      `SELECT chemical, quantity, original_chemical FROM chemical_requests WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.send('Chemical not found.');

    const row = rows[0];
    if (row.original_chemical === null) {
      await db.query(
        `UPDATE chemical_requests
         SET original_chemical = $1, original_quantity = $2,
             chemical = $3, quantity = $4
         WHERE id = $5`,
        [row.chemical, row.quantity, chemical, parseInt(quantity), id]
      );
    } else {
      await db.query(
        `UPDATE chemical_requests SET chemical = $1, quantity = $2 WHERE id = $3`,
        [chemical, parseInt(quantity), id]
      );
    }
    res.redirect(`/vendor/${encodeURIComponent(location)}`);
  } catch (err) {
    console.error(err);
    res.send('Error modifying chemical.');
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/vendor.js tests/api.test.js
git commit -m "feat: add vendor chemical modify route"
```

---

### Task 5: Vendor UI — inline Modify button, completed section, and Print button

**Files:**
- Modify: `routes/vendor.js`

**Interfaces:**
- Consumes: `POST /vendor/chem-modify/:location` (Task 4), `GET /api/chemicals`, `GET /vendor/print/:requestId` (Task 6)

- [ ] **Step 1: Update the vendor query to include all chemicals (not just approved)**

In `routes/vendor.js`, find the `router.get('/:location', ...)` handler. Change the SQL query from:

```js
WHERE tr.status = 'approved'
  AND tr.branch = $1
  AND cr.status = 'approved'
ORDER BY tr.pickup_date ASC
```

To:

```js
WHERE tr.status = 'approved'
  AND tr.branch = $1
ORDER BY tr.pickup_date ASC
```

Also add `cr.original_chemical, cr.original_quantity` to the SELECT:

```js
const { rows } = await db.query(`
  SELECT
    tr.id AS request_id,
    tr.name,
    tr.branch,
    tr.supervisor,
    tr.pickup_date,
    tr.status,
    cr.id AS chem_id,
    cr.chemical,
    cr.quantity,
    cr.unit,
    cr.status AS chem_status,
    cr.original_chemical,
    cr.original_quantity
  FROM technician_requests tr
  LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
  WHERE tr.status = 'approved'
    AND tr.branch = $1
  ORDER BY tr.pickup_date ASC
`, [location]);
```

- [ ] **Step 2: Update the grouping logic to push all chemicals**

Find the grouping block. Currently it has an `if (row.chem_status === 'approved')` guard. Change the `forEach` to push all chemicals:

```js
const grouped = {};
rows.forEach(row => {
  if (!grouped[row.request_id]) {
    grouped[row.request_id] = {
      request_id: row.request_id,
      name: row.name,
      branch: row.branch,
      pickup_date: row.pickup_date,
      chemicals: []
    };
  }
  if (row.chem_id) {
    grouped[row.request_id].chemicals.push({
      chem_id: row.chem_id,
      chemical: row.chemical,
      quantity: row.quantity,
      unit: row.unit,
      status: row.chem_status
    });
  }
});
```

- [ ] **Step 3: Replace the HTML generation with active + completed sections**

Replace the entire HTML building block (from `let html =` to `res.send(html)`) with:

```js
const allRequests = Object.values(grouped);
const activeRequests = allRequests.filter(r => r.chemicals.some(c => c.status === 'approved'));
const completedRequests = allRequests.filter(r => r.chemicals.every(c => c.status === 'fulfilled'));

let html = `
  <html>
  <head>
    <link rel="stylesheet" href="/styles.css">
    <title>Vendor Pickup List - ${location}</title>
    <script>
      let _chemicals = [];
      fetch('/api/chemicals').then(r => r.json()).then(data => { _chemicals = data; });

      function toggleModify(id, currentChem, currentQty) {
        const row = document.getElementById('mod-row-' + id);
        if (row.style.display === 'none') {
          row.style.display = '';
          const sel = document.getElementById('mod-chem-' + id);
          if (sel.options.length === 0) {
            _chemicals.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.product_name;
              opt.textContent = c.product_name;
              if (c.product_name === currentChem) opt.selected = true;
              sel.appendChild(opt);
            });
          }
          document.getElementById('mod-qty-' + id).value = currentQty;
        } else {
          row.style.display = 'none';
        }
      }
    <\/script>
  </head>
  <body>
    <h2>Approved Requests for Pickup - ${location}</h2>`;

activeRequests.forEach(req => {
  const approvedChems = req.chemicals.filter(c => c.status === 'approved');
  if (approvedChems.length === 0) return;

  html += `
    <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
      <strong>Technician:</strong> ${req.name} |
      <strong>Branch (Pickup Location):</strong> ${req.branch} |
      <strong>Date:</strong> ${req.pickup_date}
      <br><br>
      <table border="1" style="width:100%;">
        <tr><th>Chemical</th><th>Quantity</th><th>Unit</th><th>Action</th></tr>`;

  approvedChems.forEach(chem => {
    html += `
      <tr>
        <td>${chem.chemical}</td>
        <td>${chem.quantity}</td>
        <td>${chem.unit}</td>
        <td>
          <button type="button" onclick="toggleModify('${chem.chem_id}', ${JSON.stringify(chem.chemical)}, ${chem.quantity})">Modify</button>
          &nbsp;
          <form method="POST" action="/vendor/fulfill/${encodeURIComponent(location)}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            <button type="submit">Fulfill</button>
          </form>
        </td>
      </tr>
      <tr id="mod-row-${chem.chem_id}" style="display:none">
        <td colspan="4" style="padding:0.5rem; background:#f9f9f9;">
          <form method="POST" action="/vendor/chem-modify/${encodeURIComponent(location)}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            Chemical: <select id="mod-chem-${chem.chem_id}" name="chemical" required></select>
            &nbsp;Qty: <input id="mod-qty-${chem.chem_id}" type="number" name="quantity" min="1" required style="width:60px;">
            &nbsp;<button type="submit">Save</button>
            &nbsp;<button type="button" onclick="toggleModify('${chem.chem_id}')">Cancel</button>
          </form>
        </td>
      </tr>`;
  });

  html += `</table></div>`;
});

if (completedRequests.length > 0) {
  html += `<h2>Completed</h2>`;
  completedRequests.forEach(req => {
    html += `
      <div style="border:1px solid #aaa; padding:1rem; margin-bottom:1rem; background:#f5fff5;">
        <strong>Technician:</strong> ${req.name} |
        <strong>Branch:</strong> ${req.branch} |
        <strong>Date:</strong> ${req.pickup_date}
        &nbsp;&nbsp;
        <a href="/vendor/print/${req.request_id}" target="_blank">
          <button type="button">Print</button>
        </a>
      </div>`;
  });
}

html += `</body></html>`;
res.send(html);
```

- [ ] **Step 4: Verify manually**

Start the app locally (`npm start`). Set up an approved request in the DB and navigate to `/vendor/<branch>`. Confirm:
- Active section shows Modify + Fulfill buttons
- Clicking Modify expands inline form with chemicals dropdown
- After fulfilling all chemicals, the request moves to the Completed section
- Print button appears in the Completed section

- [ ] **Step 5: Commit**

```bash
git add routes/vendor.js
git commit -m "feat: add inline modify form and completed section with print button to vendor view"
```

---

### Task 6: Print view route

**Files:**
- Modify: `routes/vendor.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Consumes: `chemical_requests.original_chemical`, `chemical_requests.original_quantity` (Task 1)
- Produces: `GET /vendor/print/:requestId` — HTML page with original vs. final table; only accessible when all chemicals are fulfilled

- [ ] **Step 1: Write the failing tests**

Add to `tests/api.test.js`:

```js
describe('GET /vendor/print/:requestId', () => {
  let requestId, chemId;

  beforeEach(async () => {
    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Print Test Tech', 'Pestex', 'Jane Doe', '2026-07-15', 'approved') RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests
         (request_id, chemical, quantity, unit, status, original_chemical, original_quantity)
       VALUES ($1, 'BIFEN I/T', 2, 'case', 'fulfilled', 'Test Chemical', 3) RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [requestId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('returns 200 with technician name and both original and modified chemical', async () => {
    const res = await request(app).get(`/vendor/print/${requestId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Print Test Tech');
    expect(res.text).toContain('BIFEN I/T');
    expect(res.text).toContain('Test Chemical');
  });

  it('returns error when not all chemicals are fulfilled', async () => {
    await db.query(
      `UPDATE chemical_requests SET status = 'approved' WHERE id = $1`, [chemId]
    );
    const res = await request(app).get(`/vendor/print/${requestId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Cannot print');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: FAIL — route does not exist

- [ ] **Step 3: Add the print route to routes/vendor.js**

Add before `module.exports = router;` in `routes/vendor.js`:

```js
router.get('/print/:requestId', async (req, res) => {
  const requestId = req.params.requestId;
  try {
    const { rows: check } = await db.query(
      `SELECT COUNT(*) AS not_fulfilled FROM chemical_requests
       WHERE request_id = $1 AND status != 'fulfilled'`,
      [requestId]
    );
    if (parseInt(check[0].not_fulfilled) > 0) {
      return res.send('Cannot print: not all chemicals are fulfilled.');
    }

    const { rows } = await db.query(`
      SELECT tr.name, tr.branch, tr.pickup_date,
        cr.chemical, cr.quantity, cr.unit,
        cr.original_chemical, cr.original_quantity
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      WHERE tr.id = $1
      ORDER BY cr.id ASC
    `, [requestId]);

    if (rows.length === 0) return res.send('Request not found.');

    const { name, branch, pickup_date } = rows[0];

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Inventory Print - ${name}</title>
  <link rel="stylesheet" href="/styles.css">
  <style>@media print { .no-print { display: none; } }</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Print</button>
  <h2>Inventory Request</h2>
  <p>
    <strong>Technician:</strong> ${name} &nbsp;|&nbsp;
    <strong>Branch:</strong> ${branch} &nbsp;|&nbsp;
    <strong>Pickup Date:</strong> ${pickup_date}
  </p>
  <table border="1" style="width:100%; border-collapse:collapse;">
    <tr>
      <th>Chemical</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Modified From</th>
      <th>Original Qty</th>
    </tr>`;

    rows.forEach(cr => {
      html += `
    <tr>
      <td>${cr.chemical}</td>
      <td>${cr.quantity}</td>
      <td>${cr.unit}</td>
      <td>${cr.original_chemical || '&mdash;'}</td>
      <td>${cr.original_quantity !== null ? cr.original_quantity : '&mdash;'}</td>
    </tr>`;
    });

    html += `</table>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error(err);
    res.send('Error generating print view.');
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --testPathPattern=tests/api.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/vendor.js tests/api.test.js
git commit -m "feat: add vendor print view for fulfilled requests"
```

---

### Task 7: Push and verify on Render

- [ ] **Step 1: Run the full test suite**

```
npm test
```
Expected: All tests PASS

- [ ] **Step 2: Push to main**

```bash
git push
```

- [ ] **Step 3: Verify on Render**

Open https://inventory-management-hiyg.onrender.com. Check:
- Supervisor view shows Approve / Reject / Modify per chemical
- Modify expands inline form with chemicals dropdown
- Vendor view shows Modify + Fulfill per chemical
- After all chemicals fulfilled, completed section appears with Print button
- Print page shows correct before/after table
