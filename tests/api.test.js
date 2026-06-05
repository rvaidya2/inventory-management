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
