process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.SUPERVISOR_PASSWORD = 'testpass';

const request = require('supertest');

let app, db;

beforeAll(async () => {
  jest.resetModules();
  db = require('../db');
  app = require('../index');
  // Wait for tables to be created
  await new Promise(resolve => setTimeout(resolve, 500));
  await db.query(
    `INSERT INTO chemicals (material_code, product_name, unit)
     VALUES ('MAT001', 'Test Chemical', 'CS')
     ON CONFLICT (material_code) DO NOTHING`
  );
  await db.query(
    `INSERT INTO contacts (last_name, first_name, phone, email, branch, role)
     VALUES ('Doe', 'Jane', '555-0000', 'jane@test.com', 'Miami', 'Branch Manager')
     ON CONFLICT (email) DO NOTHING`
  );
});

afterAll(async () => {
  await db.query(`DELETE FROM chemicals WHERE material_code = 'MAT001'`);
  await db.query(`DELETE FROM contacts WHERE email = 'jane@test.com'`);
  await db.end();
});

describe('GET /api/chemicals', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/chemicals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each item has the expected fields', async () => {
    const res = await request(app).get('/api/chemicals');
    const item = res.body.find(c => c.material_code === 'MAT001');
    expect(item).toHaveProperty('material_code');
    expect(item).toHaveProperty('product_name');
    expect(item).toHaveProperty('unit');
  });
});

describe('GET /api/contacts', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each item has the expected fields', async () => {
    const res = await request(app).get('/api/contacts');
    const item = res.body.find(c => c.email === 'jane@test.com');
    expect(item).toHaveProperty('first_name');
    expect(item).toHaveProperty('last_name');
    expect(item).toHaveProperty('branch');
    expect(item).toHaveProperty('role');
  });
});

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

describe('chemicals schema', () => {
  it('has a unit column and no epa_registration/replacement_product columns', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'chemicals'
    `);
    const names = rows.map(r => r.column_name);
    expect(names).toContain('unit');
    expect(names).not.toContain('epa_registration');
    expect(names).not.toContain('replacement_product');
  });
});

describe('chemicals catalog seed data', () => {
  it('replaces the old generic catalog with the vendor supply list', async () => {
    const { rows: total } = await db.query(`SELECT COUNT(*) AS count FROM chemicals`);
    expect(parseInt(total[0].count, 10)).toBe(178); // 177 seeded + 1 test fixture row (MAT001)

    const { rows: xcluder } = await db.query(
      `SELECT unit FROM chemicals WHERE product_name = $1`,
      [`XCLUDER FILL FABRIC 4''X10FT 5/CS 162707`]
    );
    expect(xcluder).toHaveLength(1);
    expect(xcluder[0].unit).toBe('CS');

    const { rows: stale } = await db.query(
      `SELECT 1 FROM chemicals WHERE product_name = 'ADVION Ant Gel'`
    );
    expect(stale).toHaveLength(0);
  });

  it('removes stale rows and reseeds when the old catalog is detected', async () => {
    const seed = require('../seed');
    await db.query(
      `INSERT INTO chemicals (material_code, product_name, unit)
       VALUES ('OLD1', 'ADVION Ant Gel', 'EA')
       ON CONFLICT (material_code) DO NOTHING`
    );
    await seed(db);

    const { rows } = await db.query(
      `SELECT 1 FROM chemicals WHERE product_name = 'ADVION Ant Gel'`
    );
    expect(rows).toHaveLength(0);
  });

  it('does not duplicate null-material_code rows when seeded twice in a row', async () => {
    const seed = require('../seed');
    const { rows: before } = await db.query(`SELECT COUNT(*) AS count FROM chemicals`);

    await seed(db);
    await seed(db);

    const { rows: after } = await db.query(`SELECT COUNT(*) AS count FROM chemicals`);
    expect(parseInt(after[0].count, 10)).toBe(parseInt(before[0].count, 10));

    const { rows: dupes } = await db.query(`
      SELECT product_name, unit, COUNT(*) AS c
      FROM chemicals
      WHERE material_code IS NULL
      GROUP BY product_name, unit
      HAVING COUNT(*) > 1
    `);
    expect(dupes).toHaveLength(0);
  });
});

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

describe('POST /form2 rendered markup', () => {
  it('renders a read-only unit field instead of a unit dropdown', async () => {
    const res = await request(app)
      .post('/form2')
      .type('form')
      .send({ name: 'Test Tech', branch: 'Select', supervisor: 'Jane Doe', pickup_date: '2026-07-01' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('class="unit-display"');
    expect(res.text).not.toContain('<option value="case">');
  });
});

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

describe('GET /supervisor/:name chemical modify dropdown', () => {
  it('labels chemical options with product name and unit', async () => {
    const agent = request.agent(app);
    await agent.post('/supervisor/login').type('form').send({ password: 'testpass' });

    const res = await agent.get('/supervisor/Jane%20Doe');
    expect(res.status).toBe(200);
    expect(res.text).toContain("opt.textContent = c.product_name + ' (' + c.unit + ')';");
  });
});

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
    const res = await request(app).get(`/vendor/print/Pestex/${requestId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Print Test Tech');
    expect(res.text).toContain('BIFEN I/T');
    expect(res.text).toContain('Test Chemical');
  });

  it('returns error when not all chemicals are fulfilled', async () => {
    await db.query(
      `UPDATE chemical_requests SET status = 'approved' WHERE id = $1`, [chemId]
    );
    const res = await request(app).get(`/vendor/print/Pestex/${requestId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Cannot print');
  });
});

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
