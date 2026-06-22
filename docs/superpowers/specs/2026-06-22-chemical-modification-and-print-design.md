# Chemical Modification & Print Design

**Date:** 2026-06-22
**Status:** Approved

## Overview

Supervisors and vendors can modify chemicals (chemical name and quantity) on a request before it is fulfilled. After a vendor fulfills all chemicals for a technician's request, a print view shows the original submission alongside any replacements.

## Data Model

Add two columns to `chemical_requests`:

```sql
ALTER TABLE chemical_requests ADD COLUMN IF NOT EXISTS original_chemical TEXT;
ALTER TABLE chemical_requests ADD COLUMN IF NOT EXISTS original_quantity INTEGER;
```

**Rules:**
- `original_chemical` / `original_quantity` are set **once**, on the first modification (by supervisor or vendor), capturing the technician's original submission values.
- `chemical` / `quantity` are updated on every modification (supervisor first, vendor overwrites if they also modify).
- If neither supervisor nor vendor modifies a row, `original_chemical` stays null.
- The print view uses null vs. non-null `original_chemical` to determine whether a modification occurred.

**Example:**
- Technician submits: ADVION Ant Gel, qty 2
- Supervisor modifies to: BIFEN I/T, qty 3 → `original_chemical = 'ADVION Ant Gel'`, `original_quantity = 2`, `chemical = 'BIFEN I/T'`, `quantity = 3`
- Vendor modifies to: TALSTAR P, qty 1 → `original_chemical` stays `'ADVION Ant Gel'`, `chemical = 'TALSTAR P'`, `quantity = 1`
- Print shows: ADVION Ant Gel (2) → TALSTAR P (1)

## Supervisor UI

Each chemical row gets three buttons: **Approve**, **Reject**, **Modify**.

Clicking **Modify** expands an inline form (no page reload) directly below the row with:
- Dropdown of all chemicals from `/api/chemicals` (pre-selected to current)
- Quantity input (pre-filled with current value)
- **Save** button

On save (`POST /supervisor/chem-modify/:supervisorName`):
1. If `original_chemical` is null → copy current chemical + quantity to `original_*`
2. Update `chemical` and `quantity` with new values
3. Set `status = 'modified'`
4. Redirect back to supervisor view

The existing **Finalize** button checks that no chemicals are still `'pending'`. The `'modified'` status satisfies this check alongside `'approved'` and `'rejected'`.

## Vendor UI

Each chemical row gets two buttons: **Modify** and **Fulfill**.

Clicking **Modify** expands an inline form below the row with:
- Dropdown of all chemicals (pre-selected to current)
- Quantity input (pre-filled with current value)
- **Save** button

On save (`POST /vendor/chem-modify/:location`):
1. If `original_chemical` is null → copy current chemical + quantity to `original_*` (handles case where supervisor did not modify)
2. Update `chemical` and `quantity` with new values
3. Redirect back to vendor page

After saving, the row shows updated values with Modify and Fulfill buttons unchanged.

Once **all** chemicals for a technician's request are fulfilled, a **Print** button appears on that request card.

## Print View

Route: `GET /vendor/print/:requestId`

Accessible only when all chemicals for the request have `status = 'fulfilled'`.

**Layout:**
- Header: Technician name, branch, pickup date
- Table columns: Chemical | Qty | Unit | Modified From | Original Qty

**Row logic:**
- `original_chemical` is not null → current chemical/qty in first two columns, original chemical/qty in last two
- `original_chemical` is null → current chemical/qty shown, "—" in last two columns

A **Print** button triggers `window.print()`. Print CSS hides the button so only the header and table print.

## New Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/supervisor/chem-modify/:supervisorName` | Save supervisor chemical modification |
| POST | `/vendor/chem-modify/:location` | Save vendor chemical modification |
| GET | `/vendor/print/:requestId` | Print view for a fulfilled request |

## Files Changed

- `db.js` — add two `ALTER TABLE` statements to `initDb()`
- `routes/supervisor.js` — add Modify button/inline form, add `POST /chem-modify` route
- `routes/vendor.js` — add Modify button/inline form, add `POST /chem-modify` route, add `GET /print/:requestId` route
