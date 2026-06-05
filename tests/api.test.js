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
    `INSERT INTO chemicals (material_code, product_name, epa_registration, replacement_product)
     VALUES ('MAT001', 'Test Chemical', '999-1', 'Backup Chemical')
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
    expect(item).toHaveProperty('epa_registration');
    expect(item).toHaveProperty('replacement_product');
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
