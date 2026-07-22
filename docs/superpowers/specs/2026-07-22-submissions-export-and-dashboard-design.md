# Submissions Excel Export & Dashboard Design

**Date:** 2026-07-22
**Status:** Approved

## Overview

The `/submissions` page (`routes/technician.js`) lists every technician request as an HTML table with no way to get the data out or see it summarized. This adds two independent, public (no login) features reachable from that page:

1. **Excel export** — a flat data dump of every submission/chemical line item as a downloadable `.xlsx`.
2. **Dashboard** — a separate page with four in-browser charts (Chart.js via CDN) summarizing the same data, fed by a new JSON API endpoint.

Both derive from the same underlying data as `/submissions`'s existing query (`technician_requests` LEFT JOIN `chemical_requests`). Neither embeds charts inside the Excel file — that was considered and dropped in favor of this simpler split (data export vs. in-browser dashboard).

## 1. Excel Export

**Route:** `GET /export-submissions.xlsx` (`routes/technician.js`, alongside the existing `/submissions` route)

**New dependency:** `exceljs`

**Query:** identical shape to `/submissions`'s existing query:
```sql
SELECT
  tr.id AS request_id, tr.name, tr.branch, tr.supervisor, tr.pickup_date, tr.status,
  cr.chemical, cr.quantity, cr.unit
FROM technician_requests tr
LEFT JOIN chemical_requests cr ON tr.id = cr.request_id
ORDER BY tr.id DESC
```

**Workbook:** single sheet named `Submissions`. Header row: `Request ID | Technician | Branch | Supervisor | Pickup Date | Status | Chemical | Quantity | Unit`. One row per query result row (i.e., one row per chemical line item; a request with no chemicals — `LEFT JOIN` producing nulls — gets one row with blank Chemical/Quantity/Unit cells, matching how `/submissions` already renders that case).

**Response:** builds the workbook with `exceljs`, sets:
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="submissions.xlsx"`

and writes the buffer to `res` via `workbook.xlsx.write(res)`.

## 2. Dashboard

**Page route:** `GET /dashboard` (`routes/technician.js`) — serves a new static view file `views/dashboard.html`, following the same convention as `form1.html`/`form2.html` (plain HTML, vanilla `<script>`, no build step, `<link rel="stylesheet" href="/styles.css">`).

**Chart library:** Chart.js loaded from a CDN script tag (`<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`) — no new backend or npm dependency for this part.

**Data route:** `GET /api/dashboard-data` (`routes/api.js`) — returns one JSON object with four aggregates:

```json
{
  "chemicalQuantities": [{ "chemical": "string", "totalQuantity": 0 }],
  "branchCounts": [{ "branch": "string", "requestCount": 0 }],
  "requestsOverTime": [{ "pickupDate": "string", "requestCount": 0 }],
  "technicianQuantities": [{ "name": "string", "totalQuantity": 0 }]
}
```

Backing queries:
- `chemicalQuantities`: `SELECT chemical, SUM(quantity) AS total_quantity FROM chemical_requests WHERE chemical IS NOT NULL GROUP BY chemical ORDER BY total_quantity DESC`
- `branchCounts`: `SELECT branch, COUNT(*) AS request_count FROM technician_requests GROUP BY branch ORDER BY request_count DESC`
- `requestsOverTime`: `SELECT pickup_date, COUNT(*) AS request_count FROM technician_requests GROUP BY pickup_date ORDER BY pickup_date ASC`
- `technicianQuantities`: `SELECT tr.name, SUM(cr.quantity) AS total_quantity FROM technician_requests tr JOIN chemical_requests cr ON cr.request_id = tr.id WHERE cr.quantity IS NOT NULL GROUP BY tr.name ORDER BY total_quantity DESC` (only technicians who have actually submitted at least one chemical line item appear — not every seeded technician)

**`views/dashboard.html`:** four `<canvas>` elements, one per chart, each rendered as a Chart.js **bar chart** (including "requests over time" — a bar per `pickupDate`, chronologically ordered, matching the query's `ORDER BY pickup_date ASC`). On `DOMContentLoaded`, `fetch('/api/dashboard-data')` then construct four `new Chart(ctx, { type: 'bar', ... })` instances, one per aggregate, each with its own title.

## 3. `/submissions` Page Changes

In `routes/technician.js`'s `GET /submissions` handler, add two links near the top of the generated HTML, above the existing per-request listing: "Export to Excel" (`href="/export-submissions.xlsx"`) and "View Dashboard" (`href="/dashboard"`), styled using the existing `button` class from `public/styles.css` (e.g. `<a class="button" href="...">`).

## Access

All new routes (`/export-submissions.xlsx`, `/dashboard`, `/api/dashboard-data`) are public/unauthenticated, matching `/submissions` today. No new auth work.

## Tests

- `GET /export-submissions.xlsx`: returns 200, correct `Content-Type`/`Content-Disposition` headers, and the response buffer is a valid workbook — verified by loading it back with `exceljs` (`new Workbook().xlsx.load(buffer)`) and asserting the `Submissions` sheet exists with the expected header row and a row matching known fixture data.
- `GET /api/dashboard-data`: returns 200 with the four expected top-level keys, and — using known fixture data inserted in the test — asserts a specific chemical/branch/date/technician appears with the correct aggregated number.
- `GET /dashboard`: returns 200 and the response body references the Chart.js CDN script tag and four `<canvas>` elements.
- `GET /submissions`: existing tests continue to pass; a new assertion checks the response contains links to `/export-submissions.xlsx` and `/dashboard`.

## Out of Scope

- No charts embedded inside the Excel file itself (considered, dropped — see Overview).
- No filtering/date-range controls on the export or dashboard — both always reflect all submissions, matching `/submissions`'s current all-data, no-filter behavior.
- No authentication changes to any existing or new route.
