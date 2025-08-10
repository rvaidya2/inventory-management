const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./requests.db');

// Create tables if they don’t exist
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
    FOREIGN KEY (request_id) REFERENCES technician_requests(id)
  )`);
});

module.exports = db;
