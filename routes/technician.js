const express = require('express');
const path = require('path');
const db = require('../db');
const ExcelJS = require('exceljs');
const router = express.Router();

let technicianData = null;

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/form1.html'));
});

router.post('/form2', (req, res) => {
  technicianData = req.body;
  res.sendFile(path.join(__dirname, '../views/form2.html'));
});

router.post('/submit-request', async (req, res) => {
  const chemicals = [].concat(req.body.chemical);
  const quantities = [].concat(req.body.quantity);
  const units = [].concat(req.body.unit);

  try {
    const result = await db.query(
      `INSERT INTO technician_requests (name, branch, supervisor, pickup_date, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [
        technicianData.name,
        technicianData.branch,
        technicianData.supervisor,
        technicianData.pickup_date
      ]
    );

    const requestId = result.rows[0].id;

    for (let i = 0; i < chemicals.length; i++) {
      await db.query(
        `INSERT INTO chemical_requests (request_id, chemical, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [requestId, chemicals[i], quantities[i], units[i]]
      );
    }

    res.sendFile(path.join(__dirname, '../views/success.html'));
  } catch (err) {
    console.error(err);
    res.send('Error saving request.');
  }
});

router.get('/submissions', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        tr.id AS request_id,
        tr.name,
        tr.branch,
        tr.supervisor,
        tr.pickup_date,
        tr.status,
        cr.chemical,
        cr.quantity,
        cr.unit
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      ORDER BY tr.id DESC
    `);

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.request_id]) {
        grouped[row.request_id] = { ...row, chemicals: [] };
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

    let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>All Submissions</title></head><body>
      <h2>Submitted Requests with Chemicals</h2>
      <a class="button" href="/export-submissions.xlsx">Export to Excel</a>
      <a class="button" href="/dashboard">View Dashboard</a>`;

    Object.values(grouped).forEach(req => {
      html += `
        <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
          <strong>Name:</strong> ${req.name} |
          <strong>Branch (Pickup Location):</strong> ${req.branch} |
          <strong>Supervisor:</strong> ${req.supervisor} |
          <strong>Date:</strong> ${req.pickup_date} |
          <strong>Status:</strong> ${req.status}
          <br><br>
          <table border="1" style="width:100%;">
            <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>`;

      req.chemicals.forEach(chem => {
        html += `<tr><td>${chem.chemical}</td><td>${chem.quantity}</td><td>${chem.unit}</td></tr>`;
      });

      html += `</table></div>`;
    });

    html += '</body></html>';
    res.send(html);
  } catch (err) {
    res.send('Error retrieving data.');
  }
});

router.get('/export-submissions.xlsx', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        tr.id AS request_id,
        tr.name,
        tr.branch,
        tr.supervisor,
        tr.pickup_date,
        tr.status,
        cr.chemical,
        cr.quantity,
        cr.unit
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      ORDER BY tr.id DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Submissions');
    sheet.addRow([
      'Request ID', 'Technician', 'Branch', 'Supervisor', 'Pickup Date', 'Status', 'Chemical', 'Quantity', 'Unit'
    ]);
    rows.forEach(row => {
      sheet.addRow([
        row.request_id, row.name, row.branch, row.supervisor, row.pickup_date, row.status,
        row.chemical, row.quantity, row.unit
      ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating export.');
  }
});

router.get('/dashboard', (req, res) => {
  // dotfiles: 'allow' works around dev checkouts whose absolute path contains a dot segment
  // (e.g. a .claude/worktrees/... directory), which Express's default dotfile handling 404s on.
  // The path here is a fixed literal, not user input, so this carries no traversal risk.
  res.sendFile(path.join(__dirname, '../views/dashboard.html'), { dotfiles: 'allow' });
});

module.exports = router;
