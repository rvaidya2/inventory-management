const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/chemicals', (req, res) => {
  db.all(
    'SELECT material_code, product_name, epa_registration, replacement_product FROM chemicals',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch chemicals.' });
      res.json(rows);
    }
  );
});

router.get('/contacts', (req, res) => {
  db.all(
    'SELECT last_name, first_name, phone, email, branch, role FROM contacts',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch contacts.' });
      res.json(rows);
    }
  );
});

module.exports = router;
