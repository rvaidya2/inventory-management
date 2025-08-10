const express = require('express');
const path = require('path');
const db = require('../db');
const router = express.Router();

let technicianData = null; // Temporary storage between form1 and form2

// Page 1 – Technician Info
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/form1.html'));
});

// Page 2 – Chemical Form
router.post('/form2', (req, res) => {
  technicianData = req.body;
  res.sendFile(path.join(__dirname, '../views/form2.html'));
});

// Final Submission – Save Both Forms
router.post('/submit-request', (req, res) => {
  const chemicals = req.body.chemical;
  const quantities = req.body.quantity;
  const units = req.body.unit;

  db.run(
    `INSERT INTO technician_requests 
     (name, branch, supervisor, pickup_location, pickup_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      technicianData.name,
      technicianData.branch,
      technicianData.supervisor,
      technicianData.pickup_location,
      technicianData.pickup_date,
      'pending'
    ],
    function (err) {
      if (err) return res.send('Error saving technician data.');

      const requestId = this.lastID;

      const stmt = db.prepare(
        `INSERT INTO chemical_requests (request_id, chemical, quantity, unit)
         VALUES (?, ?, ?, ?)`
      );

      for (let i = 0; i < chemicals.length; i++) {
        stmt.run(requestId, chemicals[i], quantities[i], units[i]);
      }

      stmt.finalize();
      res.sendFile(path.join(__dirname, '../views/success.html'));
    }
  );
});

// View All Submissions (Joined)
router.get('/submissions', (req, res) => {
  db.all(`
    SELECT 
      tr.id AS request_id,
      tr.name,
      tr.branch,
      tr.supervisor,
      tr.pickup_location,
      tr.pickup_date,
      tr.status,
      cr.chemical,
      cr.quantity,
      cr.unit
    FROM technician_requests tr
    LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
    ORDER BY tr.id DESC
  `, (err, rows) => {
    if (err) return res.send('Error retrieving data.');

    let grouped = {};

    rows.forEach(row => {
      if (!grouped[row.request_id]) {
        grouped[row.request_id] = {
          ...row,
          chemicals: []
        };
        delete grouped[row.request_id].chemical;
        delete grouped[row.request_id].quantity;
        delete grouped[row.request_id].unit;
      }

      grouped[row.request_id].chemicals.push({
        chemical: row.chemical,
        quantity: row.quantity,
        unit: row.unit
      });
    });

    let html = `
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
      <title>All Submissions</title>
    </head>
    <body>
      <h2>Submitted Requests with Chemicals</h2>`;

    Object.values(grouped).forEach(req => {
      html += `
      <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
        <strong>Name:</strong> ${req.name} |
        <strong>Branch:</strong> ${req.branch} |
        <strong>Supervisor:</strong> ${req.supervisor} |
        <strong>Pickup Location:</strong> ${req.pickup_location} |
        <strong>Date:</strong> ${req.pickup_date} |
        <strong>Status:</strong> ${req.status}
        <br><br>
        <table border="1" style="width:100%;">
          <tr>
            <th>Chemical</th><th>Quantity</th><th>Unit</th>
          </tr>`;

      req.chemicals.forEach(chem => {
        html += `
          <tr>
            <td>${chem.chemical}</td>
            <td>${chem.quantity}</td>
            <td>${chem.unit}</td>
          </tr>`;
      });

      html += `</table></div>`;
    });

    html += '</body></html>';
    res.send(html);
  });
});

module.exports = router;
