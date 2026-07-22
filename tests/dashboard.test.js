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
