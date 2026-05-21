process.env.NODE_ENV = 'test';
process.env.SUPERVISOR_PASSWORD = 'testpassword';
process.env.SESSION_SECRET = 'test-secret';

const request = require('supertest');

let app, db;

beforeAll(async () => {
  jest.resetModules();
  db = require('../db');
  app = require('../index');
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(async () => {
  await db.end();
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

  it('POST /supervisor/login with correct password redirects', async () => {
    const res = await request(app)
      .post('/supervisor/login')
      .type('form')
      .send({ password: 'testpassword' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/supervisor');
  });
});
