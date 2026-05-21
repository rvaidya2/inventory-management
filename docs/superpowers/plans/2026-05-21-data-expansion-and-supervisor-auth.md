# Data Expansion & Supervisor Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed chemicals and contacts from embedded JS arrays, dynamically populate technician forms via API endpoints, and add session-based password protection to supervisor pages.

**Architecture:** Two new SQLite tables (`chemicals`, `contacts`) created in `db.js` and populated by a standalone `seed.js`. Two read-only API endpoints (`/api/chemicals`, `/api/contacts`) serve data to the technician forms via client-side fetch. An `express-session` auth middleware guards all `/supervisor` routes behind a login form. The DB path is configurable via `process.env.DB_PATH` so tests can use an in-memory database.

**Tech Stack:** Node.js, Express 5, SQLite3, express-session, dotenv, Jest, Supertest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add express-session, dotenv, jest, supertest; update test script |
| `db.js` | Modify | Use `DB_PATH` env var; add chemicals + contacts tables |
| `seed.js` | Create | Embedded data arrays + DB insert logic |
| `routes/api.js` | Create | GET /api/chemicals, GET /api/contacts |
| `index.js` | Modify | Add dotenv, express-session, /api routes; export app for testing |
| `routes/supervisor.js` | Modify | Auth middleware + login GET/POST routes |
| `views/form1.html` | Modify | Fetch /api/contacts on load, populate supervisor dropdown |
| `views/form2.html` | Modify | Fetch /api/chemicals on load, populate chemical rows dynamically |
| `.env` | Create | SUPERVISOR_PASSWORD + SESSION_SECRET (not committed) |
| `.gitignore` | Create | Exclude .env and node_modules |
| `tests/api.test.js` | Create | Tests for /api/chemicals and /api/contacts |
| `tests/auth.test.js` | Create | Tests for supervisor auth redirect and login POST |

---

### Task 1: Install dependencies and configure Jest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

Run in the project root:
```
npm install express-session dotenv
```

- [ ] **Step 2: Install test dependencies**

```
npm install --save-dev jest supertest
```

- [ ] **Step 3: Update the test script in package.json**

Open `package.json`. Replace the entire file with (keep npm's installed version numbers — only change the `scripts` and `devDependencies` sections):

```json
{
  "name": "pest-inventory-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "jest --testPathPattern=tests/ --forceExit",
    "start": "node index.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "dotenv": "^16.0.0",
    "express": "^5.1.0",
    "express-session": "^1.17.3",
    "sqlite3": "^5.1.7"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.0.0"
  }
}
```

Note: Keep exact version strings from your `package-lock.json` for any already-installed packages.

- [ ] **Step 4: Verify Jest runs (expected to find no tests yet)**

```
npm test
```

Expected output ends with: `No tests found, exiting with code 1`
This is expected at this stage.

- [ ] **Step 5: Commit**

```
git add package.json package-lock.json
git commit -m "chore: add express-session, dotenv, jest, supertest"
```

---

### Task 2: Update db.js — configurable DB path + new tables

**Files:**
- Modify: `db.js`

The `process.env.DB_PATH` variable lets tests inject `:memory:` so they never touch `requests.db`. The two new tables are added inside the existing `db.serialize()` block. The `status` column is also added to `chemical_requests` (it was missing from the original CREATE TABLE but the rest of the app already uses it).

- [ ] **Step 1: Replace db.js entirely**

```js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(process.env.DB_PATH || './requests.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS technician_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    pickup_location TEXT NOT NULL,
    pickup_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chemical_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    chemical TEXT,
    quantity INTEGER,
    unit TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (request_id) REFERENCES technician_requests(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chemicals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_code TEXT UNIQUE,
    product_name TEXT,
    epa_registration TEXT,
    replacement_product TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_name TEXT,
    first_name TEXT,
    phone TEXT,
    email TEXT,
    branch TEXT,
    role TEXT
  )`);
});

module.exports = db;
```

- [ ] **Step 2: Commit**

```
git add db.js
git commit -m "feat: add chemicals and contacts tables, configurable DB path"
```

---

### Task 3: Create seed.js

**Files:**
- Create: `seed.js`

This is the file you edit when adding chemicals or contacts. The data arrays live at the top — each object maps directly to the Excel column names. Run `node seed.js` once; re-running is safe because it uses `INSERT OR IGNORE`.

- [ ] **Step 1: Create seed.js at the project root**

```js
const db = require('./db');

// CHEMICALS — edit this array to add/remove chemicals
// Each entry: material_code, product_name, epa_registration, replacement_product
const chemicals = [
  {
    material_code: 'MAT001',
    product_name: 'Example Chemical A',
    epa_registration: '1234-567',
    replacement_product: 'Example Chemical B'
  },
  // Copy the block above and paste a new one for each additional chemical
];

// CONTACTS — edit this array to add/remove contacts (supervisors, managers, etc.)
// Each entry: last_name, first_name, phone, email, branch, role
const contacts = [
  {
    last_name: 'Smith',
    first_name: 'John',
    phone: '555-1234',
    email: 'jsmith@example.com',
    branch: 'Miami',
    role: 'Branch Manager'
  },
  // Copy the block above and paste a new one for each additional contact
];

// LOCATIONS — add here when location sheet is received
// const locations = [
//   { name: 'Warehouse 1', address: '...' },
// ];

db.serialize(() => {
  const chemStmt = db.prepare(
    `INSERT OR IGNORE INTO chemicals (material_code, product_name, epa_registration, replacement_product)
     VALUES (?, ?, ?, ?)`
  );
  chemicals.forEach(c => {
    chemStmt.run(c.material_code, c.product_name, c.epa_registration, c.replacement_product);
  });
  chemStmt.finalize();

  const contactStmt = db.prepare(
    `INSERT OR IGNORE INTO contacts (last_name, first_name, phone, email, branch, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  contacts.forEach(c => {
    contactStmt.run(c.last_name, c.first_name, c.phone, c.email, c.branch, c.role);
  });
  contactStmt.finalize(() => {
    console.log(`Seeded ${chemicals.length} chemicals and ${contacts.length} contacts.`);
    db.close();
  });
});
```

- [ ] **Step 2: Replace the example entries with real Excel data**

In `seed.js`, replace the placeholder objects in `chemicals` and `contacts` with the actual rows from your Excel file. Each row in Excel = one `{ ... }` object in the array.

- [ ] **Step 3: Run the seed script**

```
node seed.js
```

Expected output (numbers will match your actual data):
```
Seeded 42 chemicals and 15 contacts.
```

- [ ] **Step 4: Commit**

```
git add seed.js
git commit -m "feat: add seed.js with chemicals and contacts data"
```

---

### Task 4: Create routes/api.js and tests, update index.js

**Files:**
- Create: `routes/api.js`
- Create: `tests/api.test.js`
- Modify: `index.js`

`index.js` must export the Express `app` (without calling `listen`) so supertest can import it in tests. The `listen` call is wrapped in `require.main === module` so it only runs when started directly.

- [ ] **Step 1: Write the failing tests first**

Create the directory `tests/` and create `tests/api.test.js`:

```js
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.SUPERVISOR_PASSWORD = 'testpass';

const request = require('supertest');

let app, db;

beforeAll(done => {
  jest.resetModules();
  db = require('../db');
  app = require('../index');
  db.serialize(() => {
    db.run(
      `INSERT INTO chemicals (material_code, product_name, epa_registration, replacement_product)
       VALUES ('MAT001', 'Test Chemical', '999-1', 'Backup Chemical')`,
      () => {
        db.run(
          `INSERT INTO contacts (last_name, first_name, phone, email, branch, role)
           VALUES ('Doe', 'Jane', '555-0000', 'jane@example.com', 'Miami', 'Branch Manager')`,
          done
        );
      }
    );
  });
});

afterAll(done => {
  db.close(done);
});

describe('GET /api/chemicals', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/chemicals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each item has the expected fields', async () => {
    const res = await request(app).get('/api/chemicals');
    const item = res.body[0];
    expect(item).toHaveProperty('material_code');
    expect(item).toHaveProperty('product_name');
    expect(item).toHaveProperty('epa_registration');
    expect(item).toHaveProperty('replacement_product');
  });
});

describe('GET /api/contacts', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each item has the expected fields', async () => {
    const res = await request(app).get('/api/contacts');
    const item = res.body[0];
    expect(item).toHaveProperty('first_name');
    expect(item).toHaveProperty('last_name');
    expect(item).toHaveProperty('branch');
    expect(item).toHaveProperty('role');
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```
npm test
```

Expected: FAIL — `routes/api.js` and updated `index.js` don't exist yet. Error will mention missing module.

- [ ] **Step 3: Create routes/api.js**

```js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/chemicals', (req, res) => {
  db.all(
    'SELECT material_code, product_name, epa_registration, replacement_product FROM chemicals',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch chemicals.' });
      res.json(rows);
    }
  );
});

router.get('/contacts', (req, res) => {
  db.all(
    'SELECT last_name, first_name, phone, email, branch, role FROM contacts',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch contacts.' });
      res.json(rows);
    }
  );
});

module.exports = router;
```

- [ ] **Step 4: Replace index.js**

```js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();

const technicianRoutes = require('./routes/technician');
const supervisorRoutes = require('./routes/supervisor');
const vendorRoutes = require('./routes/vendor');
const apiRoutes = require('./routes/api');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use('/api', apiRoutes);
app.use('/', technicianRoutes);
app.use('/supervisor', supervisorRoutes);
app.use('/vendor', express.urlencoded({ extended: true }), vendorRoutes);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 5: Run tests — expect them to pass**

```
npm test
```

Expected output:
```
PASS tests/api.test.js
  GET /api/chemicals
    ✓ returns 200 with an array
    ✓ each item has the expected fields
  GET /api/contacts
    ✓ returns 200 with an array
    ✓ each item has the expected fields

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

- [ ] **Step 6: Commit**

```
git add routes/api.js index.js tests/api.test.js
git commit -m "feat: add /api/chemicals and /api/contacts endpoints"
```

---

### Task 5: Create .env and .gitignore

**Files:**
- Create: `.env`
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore` in the project root:

```
.env
node_modules/
```

- [ ] **Step 2: Create .env**

Create `.env` in the project root:

```
SUPERVISOR_PASSWORD=changeme
SESSION_SECRET=replace-with-a-long-random-string
```

Replace `changeme` with the actual password supervisors will use.
Replace `replace-with-a-long-random-string` with any long random string (e.g., `xK9mP2vL8nQ4rT7`).

**This file must never be committed — .gitignore prevents it.**

- [ ] **Step 3: Commit .gitignore only**

```
git add .gitignore
git commit -m "chore: add .gitignore"
```

---

### Task 6: Add supervisor auth middleware and login

**Files:**
- Create: `tests/auth.test.js`
- Modify: `routes/supervisor.js`

The login form is built as an HTML string inside the route (consistent with the existing pattern in the app). The `/supervisor/login` route must be registered **before** the auth middleware so the login page itself is accessible without authentication.

- [ ] **Step 1: Write the failing auth tests**

Create `tests/auth.test.js`:

```js
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.SUPERVISOR_PASSWORD = 'testpassword';
process.env.SESSION_SECRET = 'test-secret';

const request = require('supertest');

let app, db;

beforeAll(done => {
  jest.resetModules();
  db = require('../db');
  app = require('../index');
  db.serialize(done);
});

afterAll(done => {
  db.close(done);
});

describe('Supervisor auth', () => {
  it('redirects unauthenticated GET /supervisor/:name to /supervisor/login', async () => {
    const res = await request(app).get('/supervisor/TestSupervisor');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/supervisor/login');
  });

  it('GET /supervisor/login returns 200 and contains a password field', async () => {
    const res = await request(app).get('/supervisor/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('type="password"');
  });

  it('POST /supervisor/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/supervisor/login')
      .type('form')
      .send({ password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.text).toContain('Incorrect password');
  });

  it('POST /supervisor/login with correct password redirects to /supervisor', async () => {
    const res = await request(app)
      .post('/supervisor/login')
      .type('form')
      .send({ password: 'testpassword' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/supervisor');
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```
npm test -- tests/auth.test.js
```

Expected: FAIL — auth routes and middleware don't exist yet.

- [ ] **Step 3: Replace routes/supervisor.js with the full updated version**

```js
const express = require('express');
const db = require('../db');
const router = express.Router();

function requireSupervisorAuth(req, res, next) {
  if (req.session && req.session.supervisorAuthed) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/supervisor/login');
}

function loginPage(error = false) {
  return `
    <html>
    <head><title>Supervisor Login</title><link rel="stylesheet" href="/styles.css"></head>
    <body>
      <h2>Supervisor Login</h2>
      <form action="/supervisor/login" method="POST">
        <label>Password:</label>
        <input type="password" name="password" required><br><br>
        <button type="submit">Login</button>
      </form>
      ${error ? '<p style="color:red;">Incorrect password. Please try again.</p>' : ''}
    </body>
    </html>`;
}

router.get('/login', (req, res) => {
  res.send(loginPage());
});

router.post('/login', (req, res) => {
  if (req.body.password === process.env.SUPERVISOR_PASSWORD) {
    req.session.supervisorAuthed = true;
    const returnTo = req.session.returnTo || '/supervisor';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } else {
    res.status(401).send(loginPage(true));
  }
});

router.get('/:supervisorName', requireSupervisorAuth, (req, res) => {
  const supervisorName = req.params.supervisorName;

  db.all(`
    SELECT 
      tr.id AS request_id,
      tr.name,
      tr.branch,
      tr.supervisor,
      tr.pickup_location,
      tr.pickup_date,
      tr.status AS request_status,
      cr.id AS chem_id,
      cr.chemical,
      cr.quantity,
      cr.unit,
      cr.status AS chem_status
    FROM technician_requests tr
    LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
    WHERE tr.status = 'pending' AND tr.supervisor = ?
    ORDER BY tr.id DESC
  `, [supervisorName], (err, rows) => {
    if (err) return res.send('Error fetching supervisor data.');

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.request_id]) {
        grouped[row.request_id] = {
          ...row,
          chemicals: []
        };
        delete grouped[row.request_id].chemical;
        delete grouped[row.request_id].quantity;
        delete grouped[row.request_id].unit;
        delete grouped[row.request_id].chem_id;
        delete grouped[row.request_id].chem_status;
      }

      grouped[row.request_id].chemicals.push({
        chem_id: row.chem_id,
        chemical: row.chemical,
        quantity: row.quantity,
        unit: row.unit,
        status: row.chem_status
      });
    });

    let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>Supervisor Approvals</title></head><body>`;
    html += `<h2>Pending Technician Requests for ${supervisorName}</h2>`;

    Object.values(grouped).forEach(req => {
      const allReviewed = req.chemicals.every(c => c.status !== 'pending');

      html += `
        <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1.5rem;">
          <strong>Name:</strong> ${req.name} |
          <strong>Branch:</strong> ${req.branch} |
          <strong>Pickup Date:</strong> ${req.pickup_date}
          <br><br>
          <table border="1" style="width:100%;">
            <tr>
              <th>Chemical</th><th>Quantity</th><th>Unit</th><th>Status</th><th>Action</th>
            </tr>`;

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

      html += `</table><br>`;

      html += `
        <form method="POST" action="/supervisor/final-approve/${supervisorName}">
          <input type="hidden" name="id" value="${req.request_id}">
          <button type="submit" ${!allReviewed ? 'disabled title="Review all chemicals before finalizing"' : ''}>
            Finalize Form Approval
          </button>
        </form>
      </div>`;
    });

    html += `</body></html>`;
    res.send(html);
  });
});

router.post('/chem-approve/:supervisorName', requireSupervisorAuth, (req, res) => {
  db.run(`UPDATE chemical_requests SET status = 'approved' WHERE id = ?`, [req.body.id], err => {
    if (err) return res.send('Error approving chemical.');
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  });
});

router.post('/chem-reject/:supervisorName', requireSupervisorAuth, (req, res) => {
  db.run(`UPDATE chemical_requests SET status = 'rejected' WHERE id = ?`, [req.body.id], err => {
    if (err) return res.send('Error rejecting chemical.');
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  });
});

router.post('/final-approve/:supervisorName', requireSupervisorAuth, (req, res) => {
  const requestId = req.body.id;

  db.get(`
    SELECT COUNT(*) AS pending_count
    FROM chemical_requests 
    WHERE request_id = ? AND status = 'pending'
  `, [requestId], (err, result) => {
    if (err) return res.send('Error checking chemical status.');

    if (result.pending_count === 0) {
      db.run(`UPDATE technician_requests SET status = 'approved' WHERE id = ?`, [requestId], err => {
        if (err) return res.send('Error approving form.');
        res.redirect(`/supervisor/${req.params.supervisorName}`);
      });
    } else {
      res.send('You must review all chemicals before finalizing.');
    }
  });
});

module.exports = router;
```

- [ ] **Step 4: Run all tests — expect them to pass**

```
npm test
```

Expected output:
```
PASS tests/api.test.js
PASS tests/auth.test.js

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

- [ ] **Step 5: Commit**

```
git add routes/supervisor.js tests/auth.test.js
git commit -m "feat: add supervisor auth middleware and login page"
```

---

### Task 7: Update form1.html — dynamic supervisor dropdown

**Files:**
- Modify: `views/form1.html`

The supervisor dropdown is populated by fetching `/api/contacts` on page load. The hardcoded `<option>` entries for supervisors are removed; the branch and pickup location options remain (no data sheet for those yet).

- [ ] **Step 1: Replace views/form1.html**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Technician Request Form</title>
  <link rel="stylesheet" href="/styles.css">
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      fetch('/api/contacts')
        .then(r => r.json())
        .then(contacts => {
          const select = document.getElementById('supervisor-select');
          contacts.forEach(c => {
            const fullName = c.first_name + ' ' + c.last_name;
            const opt = document.createElement('option');
            opt.value = fullName;
            opt.textContent = fullName.toUpperCase();
            select.appendChild(opt);
          });
        })
        .catch(() => {
          const select = document.getElementById('supervisor-select');
          select.innerHTML = '<option value="">Error loading supervisors</option>';
        });
    });
  </script>
</head>
<body>
  <h2>Technician Request</h2>
  <form action="/form2" method="POST">
    <label>Name:</label>
    <input type="text" name="name" required><br><br>

    <label>Branch:</label>
    <select name="branch" required>
      <option value="">-- Select Branch --</option>
      <option value="Select">SELECT</option>
      <option value="Yankee">YANKEE</option>
      <option value="Metro">METRO</option>
    </select><br><br>

    <label>Supervisor:</label>
    <select id="supervisor-select" name="supervisor" required>
      <option value="">-- Loading supervisors... --</option>
    </select><br><br>

    <label>Pickup Location:</label>
    <select name="pickup_location" required>
      <option value="">-- Select Location --</option>
      <option value="Warehouse 1">Warehouse 1</option>
      <option value="Warehouse 2">Warehouse 2</option>
    </select><br><br>

    <label>Pickup Date:</label>
    <input type="date" name="pickup_date" required><br><br>

    <button type="submit">Next</button>
  </form>
</body>
</html>
```

- [ ] **Step 2: Start the server and verify the supervisor dropdown loads**

```
npm start
```

Open `http://localhost:3000` in a browser. The Supervisor dropdown should populate with names from the database (seeded in Task 3). If you haven't seeded yet, run `node seed.js` first.

- [ ] **Step 3: Commit**

```
git add views/form1.html
git commit -m "feat: populate supervisor dropdown from contacts API"
```

---

### Task 8: Update form2.html — dynamic chemicals list

**Files:**
- Modify: `views/form2.html`

Chemicals are fetched once on page load and stored in `window.chemicalsData`. Both the initial row and rows added by `addRow()` use the same fetched list. The hardcoded chemical options are removed.

- [ ] **Step 1: Replace views/form2.html**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Chemical Request Sheet</title>
  <link rel="stylesheet" href="/styles.css">
  <script>
    let chemicalsData = [];

    function buildChemSelect() {
      return '<select name="chemical[]" required>' +
        chemicalsData.map(c => `<option value="${c.product_name}">${c.product_name}</option>`).join('') +
        '</select>';
    }

    function addRow() {
      const table = document.getElementById('chemicals-table');
      const row = table.insertRow(-1);

      row.insertCell(0).innerHTML = buildChemSelect();
      row.insertCell(1).innerHTML = '<input type="number" name="quantity[]" min="1" required>';
      row.insertCell(2).innerHTML = `
        <select name="unit[]" required>
          <option value="case">Case</option>
          <option value="box">Box</option>
          <option value="individual">Individual</option>
        </select>`;
    }

    window.addEventListener('DOMContentLoaded', () => {
      fetch('/api/chemicals')
        .then(r => r.json())
        .then(data => {
          chemicalsData = data;
          const firstSelect = document.getElementById('first-chemical-select');
          firstSelect.innerHTML = data
            .map(c => `<option value="${c.product_name}">${c.product_name}</option>`)
            .join('');
        })
        .catch(() => {
          document.getElementById('first-chemical-select').innerHTML =
            '<option value="">Error loading chemicals</option>';
        });
    });
  </script>
</head>
<body>
  <h2>Chemical Request Sheet</h2>

  <form action="/submit-request" method="POST">
    <table id="chemicals-table" border="1">
      <tr>
        <th>Chemical</th>
        <th>Quantity</th>
        <th>Unit</th>
      </tr>
      <tr>
        <td>
          <select id="first-chemical-select" name="chemical[]" required>
            <option value="">Loading chemicals...</option>
          </select>
        </td>
        <td><input type="number" name="quantity[]" min="1" required></td>
        <td>
          <select name="unit[]" required>
            <option value="case">Case</option>
            <option value="box">Box</option>
            <option value="individual">Individual</option>
          </select>
        </td>
      </tr>
    </table>
    <br>
    <button type="button" onclick="addRow()">Add Another Row</button>
    <br><br>
    <button type="submit">Submit Request</button>
  </form>
</body>
</html>
```

- [ ] **Step 2: Start the server and verify the chemicals dropdown loads**

```
npm start
```

Open `http://localhost:3000`, fill out Form 1 and click Next. Form 2 should show your seeded chemicals in the dropdown. Click "Add Another Row" — the new row should also show the full chemicals list.

- [ ] **Step 3: Run all tests one final time to confirm nothing is broken**

```
npm test
```

Expected:
```
Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
```

- [ ] **Step 4: Commit**

```
git add views/form2.html
git commit -m "feat: populate chemicals dropdown from chemicals API"
```
