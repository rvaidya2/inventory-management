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
