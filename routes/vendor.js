const express = require('express');
const db = require('../db');
const router = express.Router();

// Vendor view by pickup location
router.get('/:location', (req, res) => {
  const location = decodeURIComponent(req.params.location);

  db.all(`
    SELECT 
      tr.id AS request_id,
      tr.name,
      tr.branch,
      tr.supervisor,
      tr.pickup_location,
      tr.pickup_date,
      tr.status,
      cr.id AS chem_id,
      cr.chemical,
      cr.quantity,
      cr.unit,
      cr.status AS chem_status
    FROM technician_requests tr
    LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
    WHERE tr.status = 'approved'
      AND tr.pickup_location = ?
      AND cr.status = 'approved'
    ORDER BY tr.pickup_date ASC
  `, [location], (err, rows) => {
    if (err) return res.send('Error retrieving vendor data.');

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
        delete grouped[row.request_id].chem_status;
        delete grouped[row.request_id].chem_id;
      }

      if (row.chem_status === 'approved') {
        grouped[row.request_id].chemicals.push({
          chem_id: row.chem_id,
          chemical: row.chemical,
          quantity: row.quantity,
          unit: row.unit
        });
      }
    });

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Vendor Pickup List - ${location}</title>
      </head>
      <body>
        <h2>Approved Requests for Pickup - ${location}</h2>
    `;

    Object.values(grouped).forEach(req => {
      if (req.chemicals.length > 0) {
        html += `
          <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
            <strong>Technician:</strong> ${req.name} |
            <strong>Branch:</strong> ${req.branch} |
            <strong>Pickup Location:</strong> ${req.pickup_location} |
            <strong>Date:</strong> ${req.pickup_date}
            <br><br>
            <table border="1" style="width:100%;">
              <tr>
                <th>Chemical</th><th>Quantity</th><th>Unit</th><th>Action</th>
              </tr>
        `;

        req.chemicals.forEach(chem => {
          html += `
            <tr>
              <td>${chem.chemical}</td>
              <td>${chem.quantity}</td>
              <td>${chem.unit}</td>
              <td>
                <form method="POST" action="/vendor/fulfill/${encodeURIComponent(location)}" style="display:inline;">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <button type="submit">Fulfill</button>
                </form>
              </td>
            </tr>
          `;
        });

        html += `</table></div>`;
      }
    });

    html += '</body></html>';
    res.send(html);
  });
});

// Fulfill chemical request
router.post('/fulfill/:location', (req, res) => {
  const location = decodeURIComponent(req.params.location);
  db.run(`UPDATE chemical_requests SET status = 'fulfilled' WHERE id = ?`, [req.body.id], err => {
    if (err) return res.send('Error fulfilling chemical.');
    res.redirect(`/vendor/${encodeURIComponent(location)}`);
  });
});

module.exports = router;
