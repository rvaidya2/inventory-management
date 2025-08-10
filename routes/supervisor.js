const express = require('express');
const db = require('../db');
const router = express.Router();

// View pending technician requests for a specific supervisor
router.get('/:supervisorName', (req, res) => {
  const supervisorName = req.params.supervisorName;

  db.all(`
    SELECT 
      tr.id AS request_id,
      tr.name,
      tr.branch,
      tr.supervisor,
      tr.pickup_location,
      tr.pickup_date,
      tr.status AS request_status,
      cr.id AS chem_id,
      cr.chemical,
      cr.quantity,
      cr.unit,
      cr.status AS chem_status
    FROM technician_requests tr
    LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
    WHERE tr.status = 'pending' AND tr.supervisor = ?
    ORDER BY tr.id DESC
  `, [supervisorName], (err, rows) => {
    if (err) return res.send('Error fetching supervisor data.');

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
        delete grouped[row.request_id].chem_id;
        delete grouped[row.request_id].chem_status;
      }

      grouped[row.request_id].chemicals.push({
        chem_id: row.chem_id,
        chemical: row.chemical,
        quantity: row.quantity,
        unit: row.unit,
        status: row.chem_status
      });
    });

    let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>${supervisorName} - Supervisor Approvals</title></head><body>`;
    html += `<h2>Pending Technician Requests for Supervisor: ${supervisorName}</h2>`;

    if (Object.keys(grouped).length === 0) {
      html += `<p>No pending requests for you.</p>`;
    }

    Object.values(grouped).forEach(req => {
      const allReviewed = req.chemicals.every(c => c.status !== 'pending');

      html += `
        <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1.5rem;">
          <strong>Name:</strong> ${req.name} |
          <strong>Branch:</strong> ${req.branch} |
          <strong>Pickup Date:</strong> ${req.pickup_date}
          <br><br>
          <table border="1" style="width:100%;">
            <tr>
              <th>Chemical</th><th>Quantity</th><th>Unit</th><th>Status</th><th>Action</th>
            </tr>`;

      req.chemicals.forEach(chem => {
        html += `
          <tr>
            <td>${chem.chemical}</td>
            <td>${chem.quantity}</td>
            <td>${chem.unit}</td>
            <td id="status-${chem.chem_id}">${chem.status}</td>
            <td>
              ${chem.status === 'pending' ? `
                <form method="POST" action="/supervisor/chem-approve" style="display:inline;" onsubmit="setTimeout(() => location.reload(), 100);">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <input type="hidden" name="supervisorName" value="${supervisorName}">
                  <button type="submit">Approve</button>
                </form>
                <form method="POST" action="/supervisor/chem-reject" style="display:inline;" onsubmit="setTimeout(() => location.reload(), 100);">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <input type="hidden" name="supervisorName" value="${supervisorName}">
                  <button type="submit">Reject</button>
                </form>
              ` : chem.status.charAt(0).toUpperCase() + chem.status.slice(1)}
            </td>
          </tr>`;
      });

      html += `</table><br>
        <form method="POST" action="/supervisor/final-approve" onsubmit="setTimeout(() => location.reload(), 100);">
          <input type="hidden" name="id" value="${req.request_id}">
          <input type="hidden" name="supervisorName" value="${supervisorName}">
          <button type="submit" ${!allReviewed ? 'disabled title="Review all chemicals first"' : ''}>Finalize Form Approval</button>
        </form>
      </div>`;
    });

    html += `</body></html>`;
    res.send(html);
  });
});

// Approve chemical
router.post('/chem-approve', (req, res) => {
  const { id, supervisorName } = req.body;
  db.run(`UPDATE chemical_requests SET status = 'approved' WHERE id = ?`, [id], err => {
    if (err) return res.send('Error approving chemical.');
    res.redirect(`/supervisor/${supervisorName}`);
  });
});

// Reject chemical
router.post('/chem-reject', (req, res) => {
  const { id, supervisorName } = req.body;
  db.run(`UPDATE chemical_requests SET status = 'rejected' WHERE id = ?`, [id], err => {
    if (err) return res.send('Error rejecting chemical.');
    res.redirect(`/supervisor/${supervisorName}`);
  });
});

// Finalize form approval
router.post('/final-approve', (req, res) => {
  const { id, supervisorName } = req.body;
  db.get(`
    SELECT COUNT(*) AS pending_count FROM chemical_requests 
    WHERE request_id = ? AND status = 'pending'
  `, [id], (err, result) => {
    if (err) return res.send('Error checking chemical status.');

    if (result.pending_count === 0) {
      db.run(`UPDATE technician_requests SET status = 'approved' WHERE id = ?`, [id], err => {
        if (err) return res.send('Error approving form.');
        res.redirect(`/supervisor/${supervisorName}`);
      });
    } else {
      res.send('You must review all chemicals before finalizing.');
    }
  });
});

module.exports = router;
