# Design: Data Expansion & Supervisor Auth

**Date:** 2026-05-20
**Status:** Approved

## Overview

Expand the inventory management app from a hardcoded prototype to a data-driven app using real chemical and contact data from Excel sheets. Add password protection to the supervisor approval page.

## Scope

1. Two new database tables seeded from Excel data
2. A seed script with embedded JS arrays for easy one-off edits
3. Dynamic form population (chemicals dropdown, supervisor dropdown) via API endpoints
4. Session-based password protection on all supervisor pages

Out of scope: locations table (data not yet received — placeholder in seed script).

---

## 1. Database Schema

### New table: `chemicals`

| Column               | Type    | Notes                                      |
|----------------------|---------|--------------------------------------------|
| id                   | INTEGER | Primary key, autoincrement                 |
| material_code        | TEXT    | Unique identifier from Excel               |
| product_name         | TEXT    |                                            |
| epa_registration     | TEXT    |                                            |
| replacement_product  | TEXT    | Alternate product if primary unavailable   |

### New table: `contacts`

| Column     | Type    | Notes                                           |
|------------|---------|-------------------------------------------------|
| id         | INTEGER | Primary key, autoincrement                      |
| last_name  | TEXT    |                                                 |
| first_name | TEXT    |                                                 |
| phone      | TEXT    |                                                 |
| email      | TEXT    |                                                 |
| branch     | TEXT    |                                                 |
| role       | TEXT    | e.g. branch manager, service manager — informational only |

### Future table: `locations` (placeholder)

To be added once location sheet is received. Seed script already has a labeled placeholder section.

Both tables are created by `db.js` on startup (alongside existing tables) and populated by `seed.js`.

---

## 2. Seed Script (`seed.js`)

A single file at the project root. Structure:

```
// CHEMICALS — edit this array to add/remove chemicals
const chemicals = [ ... ];

// CONTACTS — edit this array to add/remove contacts
const contacts = [ ... ];

// LOCATIONS — add here when sheet is received
// const locations = [ ... ];
```

- Data is embedded directly as plain JS arrays — no Excel parsing dependency
- Run once with `node seed.js` to populate the database
- Uses `INSERT OR IGNORE` so re-running is safe (won't duplicate existing records)
- Each array entry mirrors the Excel column names (camelCase) for easy cross-reference

---

## 3. API Endpoints

Two new read-only endpoints added to the Express app:

| Endpoint          | Response                                      |
|-------------------|-----------------------------------------------|
| GET /api/chemicals | Array of `{ material_code, product_name, epa_registration, replacement_product }` |
| GET /api/contacts  | Array of `{ last_name, first_name, phone, email, branch, role }` |

These endpoints require no authentication — they serve reference data only (no sensitive info).

---

## 4. Form Updates

### Form 1 (technician info — `views/form1.html`)

- Supervisor dropdown currently hardcoded
- On page load, fetches `GET /api/contacts` and populates the dropdown with full names (`first_name + last_name`)

### Form 2 (chemical selection — `views/form2.html`)

- Currently has 4 hardcoded chemicals
- On page load, fetches `GET /api/chemicals` and renders the chemical list dynamically
- Each row shows `product_name`; `product_name` is also stored as the submitted value, consistent with the existing `chemical_requests.chemical` column
- `material_code` is available in the API response but not submitted — it's a reference identifier only
- Existing quantity/unit fields per row remain unchanged
- Note: `replacement_product` is stored in the DB and returned by the API but not yet displayed anywhere — vendor page display is out of scope for this change

---

## 5. Supervisor Page — Password Protection

### Dependencies added

- `express-session` — session middleware
- `dotenv` — reads `.env` for the password

### `.env` file (not committed to git)

```
SUPERVISOR_PASSWORD=your_password_here
```

`.env` added to `.gitignore`.

### Login flow

1. Any request to `/supervisor/*` checks for a valid session cookie
2. If no session → redirect to `/supervisor/login`
3. `/supervisor/login` renders a simple password form
4. On POST, if password matches `process.env.SUPERVISOR_PASSWORD` → set `req.session.supervisorAuthed = true`, redirect to original URL
5. Wrong password → re-render login form with an error message
6. Session expires when the browser is closed (default session config)

### Middleware

A small auth middleware function is applied to all `/supervisor` routes in `routes/supervisor.js`. It checks `req.session.supervisorAuthed` and redirects to login if not set.

---

## 6. Affected Files

| File                  | Change                                              |
|-----------------------|-----------------------------------------------------|
| `db.js`               | Add `CREATE TABLE IF NOT EXISTS` for chemicals and contacts |
| `seed.js`             | New file — embedded data arrays + insert logic      |
| `index.js`            | Add `dotenv`, `express-session`, mount `/api` routes |
| `routes/api.js`       | New file — `/api/chemicals` and `/api/contacts`     |
| `routes/supervisor.js`| Add auth middleware, login GET/POST routes           |
| `views/form1.html`    | Fetch contacts, populate supervisor dropdown         |
| `views/form2.html`    | Fetch chemicals, render chemical rows dynamically    |
| `views/supervisor-login.html` | New file — login form                       |
| `.env`                | New file — `SUPERVISOR_PASSWORD` (not committed)    |
| `.gitignore`          | Add `.env`                                          |
| `package.json`        | Add `express-session`, `dotenv`                     |
