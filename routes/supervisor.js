const express = require('express');
const db = require('../db');
const router = express.Router();

function requireSupervisorAuth(req, res, next) {
  if (req.session && req.session.supervisorAuthed) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/supervisor/login');
}

function loginPage(error = false) {
  return `
    <html>
    <head><title>Supervisor Login</title><link rel="stylesheet" href="/styles.css"></head>
    <body>
      <h2>Supervisor Login</h2>
      <form action="/supervisor/login" method="POST">
        <label>Password:</label>
        <input type="password" name="password" required><br><br>
        <button type="submit">Login</button>
      </form>
      ${error ? '<p style="color:red;">Incorrect password. Please try again.</p>' : ''}
    </body>
    </html>`;
}

router.get('/login', (req, res) => {
  res.send(loginPage());
});

router.post('/login', (req, res) => {
  if (req.body.password === process.env.SUPERVISOR_PASSWORD) {
    req.session.supervisorAuthed = true;
    const returnTo = req.session.returnTo || '/supervisor';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } else {
    res.status(401).send(loginPage(true));
  }
});

router.get('/:supervisorName', requireSupervisorAuth, (req, res) => {
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

    let html = `<html><head><link rel="stylesheet" href="/styles.css"><title>Supervisor Approvals</title></head><body>`;
    html += `<h2>Pending Technician Requests for ${supervisorName}</h2>`;

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
            <td>${chem.status}</td>
            <td>
              ${chem.status === 'pending' ? `
                <form method="POST" action="/supervisor/chem-approve/${supervisorName}" style="display:inline;">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <button type="submit">Approve</button>
                </form>
                <form method="POST" action="/supervisor/chem-reject/${supervisorName}" style="display:inline;">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <button type="submit">Reject</button>
                </form>
              ` : chem.status.charAt(0).toUpperCase() + chem.status.slice(1)}
            </td>
          </tr>`;
      });

      html += `</table><br>`;

      html += `
        <form method="POST" action="/supervisor/final-approve/${supervisorName}">
          <input type="hidden" name="id" value="${req.request_id}">
          <button type="submit" ${!allReviewed ? 'disabled title="Review all chemicals before finalizing"' : ''}>
            Finalize Form Approval
          </button>
        </form>
      </div>`;
    });

    html += `</body></html>`;
    res.send(html);
  });
});

router.post('/chem-approve/:supervisorName', requireSupervisorAuth, (req, res) => {
  db.run(`UPDATE chemical_requests SET status = 'approved' WHERE id = ?`, [req.body.id], err => {
    if (err) return res.send('Error approving chemical.');
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  });
});

router.post('/chem-reject/:supervisorName', requireSupervisorAuth, (req, res) => {
  db.run(`UPDATE chemical_requests SET status = 'rejected' WHERE id = ?`, [req.body.id], err => {
    if (err) return res.send('Error rejecting chemical.');
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  });
});

router.post('/final-approve/:supervisorName', requireSupervisorAuth, (req, res) => {
  const requestId = req.body.id;

  db.get(`
    SELECT COUNT(*) AS pending_count
    FROM chemical_requests
    WHERE request_id = ? AND status = 'pending'
  `, [requestId], (err, result) => {
    if (err) return res.send('Error checking chemical status.');

    if (result.pending_count === 0) {
      db.run(`UPDATE technician_requests SET status = 'approved' WHERE id = ?`, [requestId], err => {
        if (err) return res.send('Error approving form.');
        res.redirect(`/supervisor/${req.params.supervisorName}`);
      });
    } else {
      res.send('You must review all chemicals before finalizing.');
    }
  });
});

module.exports = router;
