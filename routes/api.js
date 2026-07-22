const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/chemicals', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT material_code, product_name, unit FROM chemicals ORDER BY product_name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chemicals.' });
  }
});

router.get('/contacts', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT last_name, first_name, phone, email, branch, role FROM contacts ORDER BY last_name, first_name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contacts.' });
  }
});

router.get('/technicians', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT first_name, last_name, branch, supervisor FROM technicians ORDER BY last_name, first_name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch technicians.' });
  }
});

router.get('/dashboard-data', async (req, res) => {
  try {
    const [chemicalRes, branchRes, timeRes, techRes] = await Promise.all([
      db.query(
        `SELECT chemical, SUM(quantity) AS total_quantity
         FROM chemical_requests
         WHERE chemical IS NOT NULL
         GROUP BY chemical
         ORDER BY total_quantity DESC`
      ),
      db.query(
        `SELECT branch, COUNT(*) AS request_count
         FROM technician_requests
         GROUP BY branch
         ORDER BY request_count DESC`
      ),
      db.query(
        `SELECT pickup_date, COUNT(*) AS request_count
         FROM technician_requests
         GROUP BY pickup_date
         ORDER BY pickup_date ASC`
      ),
      db.query(
        `SELECT tr.name, SUM(cr.quantity) AS total_quantity
         FROM technician_requests tr
         JOIN chemical_requests cr ON cr.request_id = tr.id
         WHERE cr.quantity IS NOT NULL
         GROUP BY tr.name
         ORDER BY total_quantity DESC`
      )
    ]);

    res.json({
      chemicalQuantities: chemicalRes.rows.map(r => ({
        chemical: r.chemical,
        totalQuantity: parseInt(r.total_quantity, 10)
      })),
      branchCounts: branchRes.rows.map(r => ({
        branch: r.branch,
        requestCount: parseInt(r.request_count, 10)
      })),
      requestsOverTime: timeRes.rows.map(r => ({
        pickupDate: r.pickup_date,
        requestCount: parseInt(r.request_count, 10)
      })),
      technicianQuantities: techRes.rows.map(r => ({
        name: r.name,
        totalQuantity: parseInt(r.total_quantity, 10)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

module.exports = router;
