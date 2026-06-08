# Technician Dropdown with Auto-fill Supervisor — Design Spec

**Date:** 2026-06-08
**Status:** Approved

## Overview

Replace the free-text Name field in form1.html with a technician dropdown. Selecting a technician pre-selects their branch and auto-fills their supervisor (read-only). Technician data is stored in a new `technicians` DB table seeded from the provided spreadsheet.

---

## Data Model

### New `technicians` table

```sql
CREATE TABLE IF NOT EXISTS technicians (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  branch     TEXT NOT NULL,
  supervisor TEXT NOT NULL
);
```

- `branch` matches the exact values used in the form's branch dropdown (e.g. `Select`, `Amherst`, `Suburban`)
- `supervisor` stores the full name as it will appear in `technician_requests.supervisor` (e.g. `Kenny Jerez`, `Thomas Roach`)
- No unique constraint on name — duplicates are allowed (technicians with identical names can be disambiguated later if needed)

### Branch name changes

`Amherst & Suburban` is split into two separate branches everywhere:

| Old | New |
|-----|-----|
| `Amherst & Suburban` | `Amherst` and `Suburban` (two separate values) |

This affects: form1.html branch dropdown, vendor routes, contacts seed data.

### Contacts table additions/updates

- **Kenny Jerez** added: branch `Select`, role `Service Manager`
- **Craig Smith** added: branch `Select`, role `Service Manager`
- **Alex Chase** updated: branch changes from `Amherst & Suburban` → `Amherst` (he supervises both Amherst and Suburban technicians; his supervisor page shows all requests where `supervisor = 'Alex Chase'` regardless of branch)

---

## API

### New endpoint

```
GET /api/technicians
```

Returns all technicians sorted by `last_name`, `first_name`:

```json
[
  { "first_name": "Benjamin", "last_name": "Aguilar", "branch": "Select - LI Commercial & Residential", "supervisor": "Thomas Roach" },
  ...
]
```

Added to `routes/api.js` following the same pattern as `/api/contacts`.

---

## Form Changes (form1.html)

### Field order
1. Technician (new)
2. Branch (Pickup Location) (existing, modified)
3. Supervisor (existing, modified)
4. Pickup Date (unchanged)

### Technician field
- Replaces `<input type="text" name="name">`
- New `<select name="name" id="technician-select" required>`
- Populated from `/api/technicians` on `DOMContentLoaded`
- Options display as `LAST NAME, First Name` (last name uppercased for readability), sorted alphabetically by last name
- Default option: `-- Select Technician --`

### Branch field
- Remains `<select name="branch" required>`
- `Amherst & Suburban` option replaced with two options: `Amherst` and `Suburban`
- When a technician is selected, branch pre-selects to their branch value
- Remains fully editable after pre-selection

### Supervisor field
- Changes from `<select id="supervisor-select" name="supervisor">` to `<input type="text" id="supervisor-display" name="supervisor" readonly required>`
- Auto-fills with the technician's supervisor on selection
- Styled to visually indicate it is read-only (e.g. greyed background)
- Empty string when no technician selected — form cannot submit without selecting a technician first (which populates supervisor)

### JavaScript logic
- On page load: fetch `/api/technicians`, build dropdown options, store full technician array in memory
- On technician select change: find matching technician object, set branch `<select>` value, set supervisor `<input>` value
- On technician select reset (back to default): clear branch selection, clear supervisor field

---

## Vendor Route Changes

Two new vendor URLs replace the single `Amherst & Suburban` URL:

| Branch | URL |
|--------|-----|
| Amherst | `/vendor/Amherst` |
| Suburban | `/vendor/Suburban` |

No route code changes needed — the existing `/vendor/:location` pattern handles these automatically.

---

## Seed Data

Technicians by branch and supervisor (from spreadsheet, June 2026):

### Select - LI Commercial & Residential (Thomas Roach) — 17 technicians
Aguilar Benjamin, Bartha Glenn, Bernier Youl, Berry Michael, Chioraia Hector, Clarke Romaine, Egede Stanley, Estrada Pedro, Guardado Wilfredo, Hain Matthew, Hill Samad, Johnson Dequan, Kidd Delroy, Kinny James, Rose Thomas, Thompson Christopher, Velez Camilo

### Select (Pavel Canales) — 2 technicians
Berberena James, Holiday Jamar

### Select (Kenny Jerez) — 14 technicians
Brooks Hernan, Diaz Alfonso, Gager Melvin, Garcia Juan, Harrison Floyd, Johannes Antonio, Mackins Khalif, Mann Dasan, Murry Conway, Okafor Onyemachi, Outlaw Jerome, Quintero Luis, Romero Restituto, Williams Dominique

### Select (Kieon Murphy) — 14 technicians
Anthony Carlon, Avila Joey, Bagley Duval, Banks Linwood, Battle Lamara, Bautista Jose, Castro Kevin, Chambers Andrew, Fedee Cletus, Gruillon Jesus, Narine Andy, Pascal Kornel, Pascal Kornil, Simmons Robert

### Select (Justin Petho) — 10 technicians
Bailey Patrick, Hare Mario, Jordan Ronald, Martinez Aquiles, Mims Craig, Minor Justin, Rivera Julian, Rivera Antonio, Thomas Glenroy, Walker Jamell

### Select (Craig Smith) — 0 technicians
No technicians in current data. Craig Smith added to contacts only.

### Amherst (Alex Chase) — 11 technicians
Ambrose Pat, Bomasuto Vinny, Braidich Tessa, Ferro Gigi, Goodwin Marc, Mages Kam, Pepe Sam, Persch Trevor, Price Simon, Swanson Rick, Thorn Tom

### Suburban (Alex Chase) — 15 technicians
Bishop Dan, Burke Greg, Dole Ron, Engelhardt Jimmy, Franklin Josh, Geercken Tyler, Marrano Davin, Mazurowski Kyle, McEvoy Ashton, McEvoy Mike, Metzinger Brandon, Moyer Devin, Siska Jared, Sortisio Ryan, Volk Quinn

### Colony, Metro Pest & Select (Thomas O'Reilly) — 10 technicians
Davis Anthony, Farmer Jayden, Hall Keyon, Hartnett Lester, Inje Brian, Juarez Abel, Ortiz Jordan, Rodriguez Ernesto, Watts-Tarver Jamal, Wright Tion

### Gannon (Jennifer Savastino) — 7 technicians
Ben-Simone Nathan, Bialy-Viau Kristopher, Carr Peter, Chapin Joshua, DeBottis Joseph, Hoige Fred, O'Connor Colin

### Lincoln (Glenn Martin) — 9 technicians
Amaral Mike, Beausolieul James, Diaz Kilvi, Diaz Robert, Mitchell Nat, Roy Shannon, Shaw Joe, Snow Alex, Steeves Jack

### Metro Pest (Peter Jones) — 15 technicians
Barthelemy Dabre, Betancur Juan, Borja Marco, Brown Raheem, Conyers Jamel, Demedina Herbert, Henry Frederick, Khan Mohammad, Leonor Edward, Massiah Onan, Miranda Luis, Mosquera Andres, Rhooms Brandon, Siguencia Luis, Singh Kumar

### On The Spot (Matt LaRue) — 7 technicians
Anderson Herron, Brewer Gilbert, Byars Steven, Joseph Carlos, Kennedy Darryl, Meyer Charles, Pride Robert

### Pestex (Bill Greeley) — 12 technicians
Calderwood Jared, Coyle James, Dudley Byron, Garneau Mike, Gonzalez Julio, Hussey Marty, Johnson Lederick, Lafleur Ethan, Latimer Howard, Lavallee Kaylee, Russell Kristian, Williams Brian

### Vermin Control (Mary Swaney) — 10 technicians
DeVault Brendan, Hendrickson Stephen, McKeel Patrick, Nara Ron, Riley Robert, Sabatula Evan, Swaney III Don, Swaney Sr Don, Tewell Al, Walkos Brian

---

## What Is Not Changing

- The supervisor login and approval workflow
- Chemical request form (form2.html)
- The supervisor route (`/supervisor/:supervisorName`) — works with any supervisor name
- Insecta X, Lincoln & Pestex branches — no technicians in current data, branches remain in dropdown
- Existing submitted requests — not backfilled
