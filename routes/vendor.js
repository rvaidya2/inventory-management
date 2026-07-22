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

router.get('/print/:location/:requestId', async (req, res) => {
  const requestId = parseInt(req.params.requestId, 10);
  if (!Number.isFinite(requestId)) return res.status(404).send('Not found.');
  const location = decodeURIComponent(req.params.location);
  try {
    const { rows: check } = await db.query(
      `SELECT COUNT(*) AS not_fulfilled
       FROM chemical_requests cr
       JOIN technician_requests tr ON tr.id = cr.request_id
       WHERE cr.request_id = $1 AND tr.branch = $2 AND cr.status != 'fulfilled'`,
      [requestId, location]
    );
    if (parseInt(check[0].not_fulfilled) > 0) {
      return res.send('Cannot print: not all chemicals are fulfilled.');
    }

    const { rows } = await db.query(`
      SELECT tr.name, tr.branch, tr.pickup_date,
        cr.chemical, cr.quantity, cr.unit,
        cr.original_chemical, cr.original_quantity
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      WHERE tr.id = $1 AND tr.branch = $2
      ORDER BY cr.id ASC
    `, [requestId, location]);

    if (rows.length === 0) return res.send('Request not found.');

    const { name, branch, pickup_date } = rows[0];

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Inventory Print - ${esc(name)}</title>
  <link rel="stylesheet" href="/styles.css">
  <style>@media print { .no-print { display: none; } }</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Print</button>
  <h2>Inventory Request</h2>
  <p>
    <strong>Technician:</strong> ${esc(name)} &nbsp;|&nbsp;
    <strong>Branch:</strong> ${esc(branch)} &nbsp;|&nbsp;
    <strong>Pickup Date:</strong> ${esc(pickup_date)}
  </p>
  <table border="1" style="width:100%; border-collapse:collapse;">
    <tr>
      <th>Chemical</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Modified From</th>
      <th>Original Qty</th>
    </tr>`;

    rows.forEach(cr => {
      html += `
    <tr>
      <td>${esc(cr.chemical)}</td>
      <td>${cr.quantity}</td>
      <td>${esc(cr.unit)}</td>
      <td>${cr.original_chemical ? esc(cr.original_chemical) : '&mdash;'}</td>
      <td>${cr.original_quantity !== null ? cr.original_quantity : '&mdash;'}</td>
    </tr>`;
    });

    html += `</table>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error(err);
    res.send('Error generating print view.');
  }
});

router.get('/:location', async (req, res) => {
  const location = decodeURIComponent(req.params.location);

  try {
    const { rows } = await db.query(`
      SELECT
        tr.id AS request_id,
        tr.name,
        tr.branch,
        tr.supervisor,
        tr.pickup_date,
        tr.status,
        cr.id AS chem_id,
        cr.chemical,
        cr.quantity,
        cr.unit,
        cr.status AS chem_status,
        cr.original_chemical,
        cr.original_quantity
      FROM technician_requests tr
      LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
      WHERE tr.status = 'approved'
        AND tr.branch = $1
      ORDER BY tr.pickup_date ASC
    `, [location]);

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.request_id]) {
        grouped[row.request_id] = {
          request_id: row.request_id,
          name: row.name,
          branch: row.branch,
          pickup_date: row.pickup_date,
          chemicals: []
        };
      }
      if (row.chem_id) {
        grouped[row.request_id].chemicals.push({
          chem_id: row.chem_id,
          chemical: row.chemical,
          quantity: row.quantity,
          unit: row.unit,
          status: row.chem_status
        });
      }
    });

    const allRequests = Object.values(grouped);
    const activeRequests = allRequests.filter(r => r.chemicals.some(c => c.status === 'approved'));
    const completedRequests = allRequests.filter(r => r.chemicals.length > 0 && r.chemicals.every(c => c.status === 'fulfilled'));

    let html = `
  <html>
  <head>
    <link rel="stylesheet" href="/styles.css">
    <title>Vendor Pickup List - ${esc(location)}</title>
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
  <body>
    <h2>Approved Requests for Pickup - ${esc(location)}</h2>`;

    activeRequests.forEach(req => {
      const approvedChems = req.chemicals.filter(c => c.status === 'approved');
      if (approvedChems.length === 0) return;

      html += `
    <div style="border:1px solid #ccc; padding:1rem; margin-bottom:1rem;">
      <strong>Technician:</strong> ${esc(req.name)} |
      <strong>Branch (Pickup Location):</strong> ${esc(req.branch)} |
      <strong>Date:</strong> ${esc(req.pickup_date)}
      <br><br>
      <table border="1" style="width:100%;">
        <tr><th>Chemical</th><th>Quantity</th><th>Unit</th><th>Action</th></tr>`;

      approvedChems.forEach(chem => {
        html += `
      <tr>
        <td>${esc(chem.chemical)}</td>
        <td>${chem.quantity}</td>
        <td>${esc(chem.unit)}</td>
        <td>
          <button type="button" onclick="toggleModify('${chem.chem_id}', ${JSON.stringify(chem.chemical).replace(/"/g, '&quot;')}, ${chem.quantity})">Modify</button>
          &nbsp;
          <form method="POST" action="/vendor/fulfill/${encodeURIComponent(location)}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            <button type="submit">Fulfill</button>
          </form>
        </td>
      </tr>
      <tr id="mod-row-${chem.chem_id}" style="display:none">
        <td colspan="4" style="padding:0.5rem; background:#f9f9f9;">
          <form method="POST" action="/vendor/chem-modify/${encodeURIComponent(location)}" style="display:inline;">
            <input type="hidden" name="id" value="${chem.chem_id}">
            Chemical: <select id="mod-chem-${chem.chem_id}" name="chemical" required></select>
            &nbsp;Qty: <input id="mod-qty-${chem.chem_id}" type="number" name="quantity" min="1" required style="width:60px;">
            &nbsp;<button type="submit">Save</button>
            &nbsp;<button type="button" onclick="toggleModify('${chem.chem_id}')">Cancel</button>
          </form>
        </td>
      </tr>`;
      });

      html += `</table></div>`;
    });

    if (completedRequests.length > 0) {
      html += `<h2>Completed</h2>`;
      completedRequests.forEach(req => {
        html += `
      <div style="border:1px solid #aaa; padding:1rem; margin-bottom:1rem; background:#f5fff5;">
        <strong>Technician:</strong> ${esc(req.name)} |
        <strong>Branch:</strong> ${esc(req.branch)} |
        <strong>Date:</strong> ${esc(req.pickup_date)}
        &nbsp;&nbsp;
        <a href="/vendor/print/${encodeURIComponent(location)}/${req.request_id}" target="_blank">
          <button type="button">Print</button>
        </a>
      </div>`;
      });
    }

    html += `</body></html>`;
    res.send(html);
  } catch (err) {
    res.send('Error retrieving vendor data.');
  }
});

router.post('/fulfill/:location', async (req, res) => {
  const location = decodeURIComponent(req.params.location);
  try {
    const { rows: updated } = await db.query(
      `UPDATE chemical_requests cr SET status = 'fulfilled'
       FROM technician_requests tr
       WHERE cr.id = $1 AND cr.request_id = tr.id AND tr.branch = $2 AND cr.status != 'fulfilled'
       RETURNING cr.request_id`,
      [req.body.id, location]
    );

    if (updated.length > 0) {
      const requestId = updated[0].request_id;
      const { rows: remaining } = await db.query(
        `SELECT COUNT(*) AS count FROM chemical_requests WHERE request_id = $1 AND status != 'fulfilled'`,
        [requestId]
      );

      if (parseInt(remaining[0].count, 10) === 0) {
        const { rows: reqRows } = await db.query(
          `SELECT name, branch, pickup_date, supervisor FROM technician_requests WHERE id = $1`,
          [requestId]
        );
        const { rows: chemRows } = await db.query(
          `SELECT chemical, quantity, unit FROM chemical_requests WHERE request_id = $1`,
          [requestId]
        );
        const { name, branch, pickup_date, supervisor } = reqRows[0];

        const { rows: techRows } = await db.query(
          `SELECT email FROM technicians
           WHERE first_name || ' ' || last_name = $1 AND branch = $2 AND supervisor = $3`,
          [name, branch, supervisor]
        );
        const technicianEmail = techRows[0] && techRows[0].email;
        const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const chemRowsHtml = chemRows.map(c =>
          `<tr><td>${esc(c.chemical)}</td><td>${esc(c.quantity)}</td><td>${esc(c.unit)}</td></tr>`
        ).join('');

        await mailer.sendMail({
          to: technicianEmail,
          subject: 'Your order is ready for pickup',
          html: `
            <p>Your chemical order is ready for pickup.</p>
            <p><strong>Branch:</strong> ${esc(branch)} &nbsp;|&nbsp;
               <strong>Pickup Date:</strong> ${esc(pickup_date)}</p>
            <table border="1" cellpadding="4" style="border-collapse:collapse;">
              <tr><th>Chemical</th><th>Quantity</th><th>Unit</th></tr>
              ${chemRowsHtml}
            </table>
            <p><a href="${baseUrl}/submissions">View submissions</a></p>
          `
        });
      }
    }

    res.redirect(`/vendor/${encodeURIComponent(location)}`);
  } catch (err) {
    res.send('Error fulfilling chemical.');
  }
});

router.post('/chem-modify/:location', async (req, res) => {
  const location = decodeURIComponent(req.params.location);
  const { id, chemical, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty) || qty < 1) return res.status(400).send('Invalid quantity.');
  try {
    const { rows } = await db.query(
      `SELECT cr.chemical, cr.quantity, cr.original_chemical
       FROM chemical_requests cr
       JOIN technician_requests tr ON tr.id = cr.request_id
       WHERE cr.id = $1 AND tr.branch = $2`,
      [id, location]
    );
    if (rows.length === 0) return res.status(404).send('Chemical not found for this location.');

    const row = rows[0];
    if (row.original_chemical === null) {
      await db.query(
        `UPDATE chemical_requests
         SET original_chemical = $1, original_quantity = $2,
             chemical = $3, quantity = $4
         WHERE id = $5`,
        [row.chemical, row.quantity, chemical, qty, id]
      );
    } else {
      await db.query(
        `UPDATE chemical_requests SET chemical = $1, quantity = $2 WHERE id = $3`,
        [chemical, qty, id]
      );
    }
    res.redirect(`/vendor/${encodeURIComponent(location)}`);
  } catch (err) {
    console.error(err);
    res.send('Error modifying chemical.');
  }
});

module.exports = router;
