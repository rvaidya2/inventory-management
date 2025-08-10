const express = require('express');
const db = require('../db');
const router = express.Router();

// View approved requests for a specific pickup location
router.get('/:pickupLocation', (req, res) => {
  const pickupLocation = req.params.pickupLocation;

  db.all(`
    SELECT 
      tr.id AS request_id,
      tr.name,
      tr.branch,
      tr.supervisor,
      tr.pickup_location,
      tr.pickup_date,
      tr.status AS request_status,
      cr.chemical,
      cr.quantity,
      cr.unit
    FROM technician_requests tr
    LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
    WHERE tr.status = 'approved' AND tr.pickup_location = ?
    ORDER BY tr.pickup_date ASC
  `, [pickupLocation], (err, rows) => {
    if (err) return res.send('Error fetching vendor data.');

    const grouped = {};
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

    let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>Vendor - ${pickupLocation}</title></head><body>`;
    html += `<h2>Approved Requests for Pickup Location: ${pickupLocation}</h2>`;

    if (Object.keys(grouped).length === 0) {
      html += `<p>No approved requests for this pickup location.</p>`;
    }

    Object.values(grouped).forEach(req => {
      html += `
        <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1.5rem;">
          <strong>Technician:</strong> ${req.name} |
          <strong>Branch:</strong> ${req.branch} |
          <strong>Supervisor:</strong> ${req.supervisor} |
          <strong>Pickup Location:</strong> ${req.pickup_location} |
          <strong>Pickup Date:</strong> ${req.pickup_date}
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

      html += `</table><br>
        <form method="POST" action="/vendor/${pickupLocation}/fulfill" onsubmit="setTimeout(() => location.reload(), 100);">
          <input type="hidden" name="id" value="${req.request_id}">
          <button type="submit">Mark as Fulfilled</button>
        </form>
      </div>`;
    });

    html += `</body></html>`;
    res.send(html);
  });
});

// Mark request as fulfilled for a specific pickup location
router.post('/:pickupLocation/fulfill', (req, res) => {
  const pickupLocation = req.params.pickupLocation;
  db.run(`UPDATE technician_requests SET status = 'fulfilled' WHERE id = ?`, [req.body.id], err => {
    if (err) return res.send('Error updating request status.');
    res.redirect(`/vendor/${pickupLocation}`);
  });
});

module.exports = router;
