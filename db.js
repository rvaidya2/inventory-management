const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
    unit TEXT
  )`);

  await pool.query(`ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS unit TEXT`);
  await pool.query(`ALTER TABLE chemicals DROP COLUMN IF EXISTS epa_registration`);
  await pool.query(`ALTER TABLE chemicals DROP COLUMN IF EXISTS replacement_product`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    last_name TEXT,
    first_name TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    branch TEXT,
    role TEXT
  )`);

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

pool.ready = initDb().catch(err => console.error('DB init error:', err));

module.exports = pool;
