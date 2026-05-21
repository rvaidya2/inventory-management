const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/chemicals', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT material_code, product_name, epa_registration, replacement_product FROM chemicals ORDER BY product_name'
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

module.exports = router;
