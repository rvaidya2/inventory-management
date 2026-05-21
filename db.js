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
