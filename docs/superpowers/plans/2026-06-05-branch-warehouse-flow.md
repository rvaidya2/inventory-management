# Branch as Pickup Location — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the technician's selected branch the sole pickup location identifier, removing the separate Pickup Location field and updating the vendor page to route by branch name.

**Architecture:** Four sequential changes — DB migration (drop column), form update (remove field, relabel), backend update (remove pickup_location from INSERT and submissions view), vendor route update (filter by branch instead of pickup_location). Each is independently commitable.

**Tech Stack:** Node.js, Express, PostgreSQL (pg), server-rendered HTML, Jest + Supertest

---

### Task 1: DB migration — drop pickup_location column

**Files:**
- Modify: `db.js:9-17`
- Modify: `tests/api.test.js`

- [ ] **Step 1: Write the failing test**

Add this test to `tests/api.test.js` inside a new `describe` block after the existing ones:

```js
describe('technician_requests schema', () => {
  it('does not have a pickup_location column', async () => {
    const { rows } = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'technician_requests'
        AND column_name = 'pickup_location'
    `);
    expect(rows.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest tests/api.test.js --testNamePattern="does not have a pickup_location column" --verbose
```

Expected: FAIL — the column still exists.

- [ ] **Step 3: Add migration to db.js**

In `db.js`, after the `CREATE TABLE IF NOT EXISTS technician_requests` block (after line 17), add:

```js
  await pool.query(`ALTER TABLE technician_requests DROP COLUMN IF EXISTS pickup_location`);
```

The full `initDb` function should now look like (note: `pickup_location` is removed from the CREATE TABLE definition AND dropped via migration so both new and existing databases are handled):

```js
async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS technician_requests (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    pickup_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
  )`);

  await pool.query(`ALTER TABLE technician_requests DROP COLUMN IF EXISTS pickup_location`);

  await pool.query(`CREATE TABLE IF NOT EXISTS chemical_requests (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES technician_requests(id),
    chemical TEXT,
    quantity INTEGER,
    unit TEXT,
    status TEXT DEFAULT 'pending'
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS chemicals (
    id SERIAL PRIMARY KEY,
    material_code TEXT UNIQUE,
    product_name TEXT,
    epa_registration TEXT,
    replacement_product TEXT
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    last_name TEXT,
    first_name TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    branch TEXT,
    role TEXT
  )`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx jest tests/api.test.js --testNamePattern="does not have a pickup_location column" --verbose
```

Expected: PASS

- [ ] **Step 5: Run full test suite to confirm no regressions**

```
npx jest --verbose
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add db.js tests/api.test.js
git commit -m "feat: drop pickup_location column, branch is now the pickup identifier"
```

---

### Task 2: Form 1 — relabel Branch and remove Pickup Location

**Files:**
- Modify: `views/form1.html:34,56-61`

- [ ] **Step 1: Update the Branch label**

In `views/form1.html`, change line 34 from:

```html
    <label>Branch:</label>
```

to:

```html
    <label>Branch (Pickup Location):</label>
```

- [ ] **Step 2: Remove the Pickup Location dropdown**

Remove lines 56–61 entirely:

```html
    <label>Pickup Location:</label>
    <select name="pickup_location" required>
      <option value="">-- Select Location --</option>
      <option value="Warehouse 1">Warehouse 1</option>
      <option value="Warehouse 2">Warehouse 2</option>
    </select><br><br>
```

- [ ] **Step 3: Verify the form renders correctly**

Start the app (`npm start`) and open `http://localhost:3000`. Confirm:
- The Branch dropdown is labelled "Branch (Pickup Location)"
- There is no Pickup Location dropdown
- The form has exactly 4 fields: Name, Branch (Pickup Location), Supervisor, Pickup Date

- [ ] **Step 4: Commit**

```bash
git add views/form1.html
git commit -m "feat: relabel branch to 'Branch (Pickup Location)', remove pickup location dropdown"
```

---

### Task 3: Backend — remove pickup_location from INSERT and submissions view

**Files:**
- Modify: `routes/technician.js:23-33,54-113`
- Modify: `tests/api.test.js`

- [ ] **Step 1: Write the failing test**

Add this test to `tests/api.test.js` in a new `describe` block:

```js
describe('POST /submit-request', () => {
  let insertedRequestId;

  afterEach(async () => {
    if (insertedRequestId) {
      await db.query(`DELETE FROM chemical_requests WHERE request_id = $1`, [insertedRequestId]);
      await db.query(`DELETE FROM technician_requests WHERE id = $1`, [insertedRequestId]);
      insertedRequestId = null;
    }
  });

  it('submits a request using branch as location with no pickup_location field', async () => {
    // First POST to /form2 to set technicianData
    await request(app)
      .post('/form2')
      .type('form')
      .send({
        name: 'Test Tech',
        branch: 'Select',
        supervisor: 'Jane Doe',
        pickup_date: '2026-07-01'
      });

    // Then POST to /submit-request with chemicals
    const res = await request(app)
      .post('/submit-request')
      .type('form')
      .send({
        chemical: 'Test Chemical',
        quantity: '2',
        unit: 'Case'
      });

    expect(res.status).toBe(200);

    // Verify row was inserted with branch but no pickup_location
    const { rows } = await db.query(
      `SELECT * FROM technician_requests WHERE name = 'Test Tech' ORDER BY id DESC LIMIT 1`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].branch).toBe('Select');
    expect(rows[0]).not.toHaveProperty('pickup_location');
    insertedRequestId = rows[0].id;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest tests/api.test.js --testNamePattern="submits a request using branch as location" --verbose
```

Expected: FAIL — INSERT still references pickup_location which no longer exists.

- [ ] **Step 3: Update the INSERT in routes/technician.js**

Replace lines 23–33 with:

```js
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
```

- [ ] **Step 4: Update the /submissions SELECT and display**

In the `/submissions` route, remove `tr.pickup_location,` from the SELECT (line 60) and remove the display line (line 95).

The SELECT should become:

```js
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
```

The request display in the `forEach` should become:

```js
      html += `
        <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
          <strong>Name:</strong> ${req.name} |
          <strong>Branch (Pickup Location):</strong> ${req.branch} |
          <strong>Supervisor:</strong> ${req.supervisor} |
          <strong>Date:</strong> ${req.pickup_date} |
          <strong>Status:</strong> ${req.status}
          <br><br>
          <table border="1" style="width:100%;">
            <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>`;
```

- [ ] **Step 5: Run test to verify it passes**

```
npx jest tests/api.test.js --testNamePattern="submits a request using branch as location" --verbose
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```
npx jest --verbose
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add routes/technician.js tests/api.test.js
git commit -m "feat: remove pickup_location from technician INSERT and submissions view"
```

---

### Task 4: Vendor route — filter by branch

**Files:**
- Modify: `routes/vendor.js:9-29,55-68,80`
- Modify: `tests/api.test.js`

- [ ] **Step 1: Write the failing test**

Add this test to `tests/api.test.js`:

```js
describe('GET /vendor/:branch', () => {
  let requestId, chemId;

  beforeEach(async () => {
    const r = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ('Vendor Test Tech', 'Pestex', 'Jane Doe', '2026-07-01', 'approved')
       RETURNING id`
    );
    requestId = r.rows[0].id;
    const c = await db.query(
      `INSERT INTO chemical_requests (request_id, chemical, quantity, unit, status)
       VALUES ($1, 'Test Chemical', 1, 'Case', 'approved')
       RETURNING id`,
      [requestId]
    );
    chemId = c.rows[0].id;
  });

  afterEach(async () => {
    await db.query(`DELETE FROM chemical_requests WHERE id = $1`, [chemId]);
    await db.query(`DELETE FROM technician_requests WHERE id = $1`, [requestId]);
  });

  it('returns approved chemicals for the given branch', async () => {
    const res = await request(app).get('/vendor/Pestex');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Vendor Test Tech');
    expect(res.text).toContain('Test Chemical');
  });

  it('does not return requests from other branches', async () => {
    const res = await request(app).get('/vendor/Select');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Vendor Test Tech');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx jest tests/api.test.js --testNamePattern="vendor" --verbose
```

Expected: FAIL — query still uses `pickup_location` which no longer exists.

- [ ] **Step 3: Update the vendor GET route query**

In `routes/vendor.js`, replace the query in `router.get('/:location', ...)` with:

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
        cr.status AS chem_status
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      WHERE tr.status = 'approved'
        AND tr.branch = $1
        AND cr.status = 'approved'
      ORDER BY tr.pickup_date ASC
    `, [location]);
```

- [ ] **Step 4: Update the vendor HTML display**

In `routes/vendor.js`, replace the request display block inside `Object.values(grouped).forEach` with:

```js
      if (req.chemicals.length > 0) {
        html += `
          <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
            <strong>Technician:</strong> ${req.name} |
            <strong>Branch (Pickup Location):</strong> ${req.branch} |
            <strong>Date:</strong> ${req.pickup_date}
            <br><br>
            <table border="1" style="width:100%;">
              <tr><th>Chemical</th><th>Quantity</th><th>Unit</th><th>Action</th></tr>`;

        req.chemicals.forEach(chem => {
          html += `
            <tr>
              <td>${chem.chemical}</td>
              <td>${chem.quantity}</td>
              <td>${chem.unit}</td>
              <td>
                <form method="POST" action="/vendor/fulfill/${encodeURIComponent(location)}" style="display:inline;">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <button type="submit">Fulfill</button>
                </form>
              </td>
            </tr>`;
        });

        html += `</table></div>`;
      }
```

- [ ] **Step 5: Run vendor tests to verify they pass**

```
npx jest tests/api.test.js --testNamePattern="vendor" --verbose
```

Expected: both vendor tests PASS.

- [ ] **Step 6: Run full test suite**

```
npx jest --verbose
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add routes/vendor.js tests/api.test.js
git commit -m "feat: vendor page now filters by branch instead of pickup_location"
```
