const express = require('express');
const db = require('../db');
const mailer = require('../lib/mailer');
const router = express.Router();

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

router.get('/:supervisorName', requireSupervisorAuth, async (req, res) => {
  const supervisorName = req.params.supervisorName;

  try {
    const { rows } = await db.query(`
      SELECT
        tr.id AS request_id,
        tr.name,
        tr.branch,
        tr.supervisor,
        tr.pickup_date,
        tr.status AS request_status,
        cr.id AS chem_id,
        cr.chemical,
        cr.quantity,
        cr.unit,
        cr.status AS chem_status
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      WHERE tr.status = 'pending' AND tr.supervisor = $1
      ORDER BY tr.id DESC
    `, [supervisorName]);

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.request_id]) {
        grouped[row.request_id] = { ...row, chemicals: [] };
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

    let html = `<html>
<head>
  <link rel="stylesheet" href="/styles.css">
  <title>Supervisor Approvals</title>
  <script>
    let _chemicals = [];
    fetch('/api/chemicals').then(r => r.json()).then(data => { _chemicals = data; });

    function toggleModify(id, currentChem, currentQty) {
      const row = document.getElementById('mod-row-' + id);
      if (row.style.display === 'none') {
        row.style.display = '';
        const sel = document.getElementById('mod-chem-' + id);
        if (sel.options.length === 0) {
          _chemicals.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.product_name;
            opt.textContent = c.product_name + ' (' + c.unit + ')';
            if (c.product_name === currentChem) opt.selected = true;
            sel.appendChild(opt);
          });
        }
        document.getElementById('mod-qty-' + id).value = currentQty;
      } else {
        row.style.display = 'none';
      }
    }
  <\/script>
</head>
<body>`;
    html += `<h2>Pending Technician Requests for ${esc(supervisorName)}</h2>`;

    Object.values(grouped).forEach(req => {
      const allReviewed = req.chemicals.every(c => c.status !== 'pending');

      html += `
        <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1.5rem;">
          <strong>Name:</strong> ${esc(req.name)} |
          <strong>Branch:</strong> ${esc(req.branch)} |
          <strong>Pickup Date:</strong> ${esc(req.pickup_date)}
          <br><br>
          <table border="1" style="width:100%;">
            <tr><th>Chemical</th><th>Quantity</th><th>Unit</th><th>Status</th><th>Action</th></tr>`;

      req.chemicals.forEach(chem => {
        html += `
          <tr>
            <td>${esc(chem.chemical)}</td>
            <td>${chem.quantity}</td>
            <td>${esc(chem.unit)}</td>
            <td>${esc(chem.status)}</td>
            <td>
              ${(chem.status === 'pending' || chem.status === 'modified') ? `
                <form method="POST" action="/supervisor/chem-approve/${esc(supervisorName)}" style="display:inline;">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <button type="submit">Approve</button>
                </form>
                <form method="POST" action="/supervisor/chem-reject/${esc(supervisorName)}" style="display:inline;">
                  <input type="hidden" name="id" value="${chem.chem_id}">
                  <button type="submit">Reject</button>
                </form>
                <button type="button" onclick="toggleModify('${chem.chem_id}', ${JSON.stringify(chem.chemical).replace(/"/g, '&quot;')}, ${chem.quantity})">Modify</button>
              ` : esc(chem.status.charAt(0).toUpperCase() + chem.status.slice(1))}
            </td>
          </tr>
          <tr id="mod-row-${chem.chem_id}" style="display:none">
            <td colspan="5" style="padding:0.5rem; background:#f9f9f9;">
              <form method="POST" action="/supervisor/chem-modify/${esc(supervisorName)}" style="display:inline;">
                <input type="hidden" name="id" value="${chem.chem_id}">
                Chemical: <select id="mod-chem-${chem.chem_id}" name="chemical" required></select>
                &nbsp;Qty: <input id="mod-qty-${chem.chem_id}" type="number" name="quantity" min="1" required style="width:60px;">
                &nbsp;<button type="submit">Save</button>
                &nbsp;<button type="button" onclick="toggleModify('${chem.chem_id}')">Cancel</button>
              </form>
            </td>
          </tr>`;
      });

      html += `</table><br>
        <form method="POST" action="/supervisor/final-approve/${esc(supervisorName)}">
          <input type="hidden" name="id" value="${req.request_id}">
          <button type="submit" ${!allReviewed ? 'disabled title="Review all chemicals before finalizing"' : ''}>
            Finalize Form Approval
          </button>
        </form>
      </div>`;
    });

    html += '</body></html>';
    res.send(html);
  } catch (err) {
    res.send('Error fetching supervisor data.');
  }
});

router.post('/chem-approve/:supervisorName', requireSupervisorAuth, async (req, res) => {
  try {
    await db.query(`UPDATE chemical_requests SET status = 'approved' WHERE id = $1`, [req.body.id]);
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  } catch (err) {
    res.send('Error approving chemical.');
  }
});

router.post('/chem-reject/:supervisorName', requireSupervisorAuth, async (req, res) => {
  try {
    await db.query(`UPDATE chemical_requests SET status = 'rejected' WHERE id = $1`, [req.body.id]);
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  } catch (err) {
    res.send('Error rejecting chemical.');
  }
});

router.post('/final-approve/:supervisorName', requireSupervisorAuth, async (req, res) => {
  const requestId = req.body.id;
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS pending_count FROM chemical_requests WHERE request_id = $1 AND status = 'pending'`,
      [requestId]
    );

    if (parseInt(rows[0].pending_count) === 0) {
      await db.query(`UPDATE chemical_requests SET status = 'approved' WHERE request_id = $1 AND status = 'modified'`, [requestId]);
      await db.query(`UPDATE technician_requests SET status = 'approved' WHERE id = $1`, [requestId]);

      const { rows: reqRows } = await db.query(
        `SELECT branch, pickup_date FROM technician_requests WHERE id = $1`,
        [requestId]
      );
      const { rows: chemRows } = await db.query(
        `SELECT chemical, quantity, unit FROM chemical_requests WHERE request_id = $1 AND status != 'rejected'`,
        [requestId]
      );
      const { branch, pickup_date } = reqRows[0];
      const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const chemRowsHtml = chemRows.map(c =>
        `<tr><td>${esc(c.chemical)}</td><td>${esc(c.quantity)}</td><td>${esc(c.unit)}</td></tr>`
      ).join('');

      await mailer.sendMail({
        to: process.env.VENDOR_EMAIL,
        subject: 'Request approved — ready to fulfill',
        html: `
          <p>A chemical request has been approved and is ready to fulfill.</p>
          <p><strong>Branch:</strong> ${esc(branch)} &nbsp;|&nbsp;
             <strong>Pickup Date:</strong> ${esc(pickup_date)}</p>
          <table border="1" cellpadding="4" style="border-collapse:collapse;">
            <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>
            ${chemRowsHtml}
          </table>
          <p><a href="${baseUrl}/vendor/${encodeURIComponent(branch)}">Fulfill this request</a></p>
        `
      });

      res.redirect(`/supervisor/${req.params.supervisorName}`);
    } else {
      res.send('You must review all chemicals before finalizing.');
    }
  } catch (err) {
    res.send('Error approving form.');
  }
});

router.post('/chem-modify/:supervisorName', requireSupervisorAuth, async (req, res) => {
  const { id, chemical, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).send('Invalid quantity.');
  try {
    const { rows } = await db.query(
      `SELECT cr.chemical, cr.quantity, cr.original_chemical
       FROM chemical_requests cr
       JOIN technician_requests tr ON tr.id = cr.request_id
       WHERE cr.id = $1 AND tr.supervisor = $2`,
      [id, req.params.supervisorName]
    );
    if (rows.length === 0) return res.status(404).send('Chemical not found for this supervisor.');

    const row = rows[0];
    if (row.original_chemical === null) {
      await db.query(
        `UPDATE chemical_requests
         SET original_chemical = $1, original_quantity = $2,
             chemical = $3, quantity = $4, status = 'modified'
         WHERE id = $5`,
        [row.chemical, row.quantity, chemical, qty, id]
      );
    } else {
      await db.query(
        `UPDATE chemical_requests SET chemical = $1, quantity = $2, status = 'modified' WHERE id = $3`,
        [chemical, qty, id]
      );
    }
    res.redirect(`/supervisor/${req.params.supervisorName}`);
  } catch (err) {
    console.error(err);
    res.send('Error modifying chemical.');
  }
});

module.exports = router;
