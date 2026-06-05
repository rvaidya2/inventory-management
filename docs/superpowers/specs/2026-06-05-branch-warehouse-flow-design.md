# Branch as Pickup Location — Design Spec

**Date:** 2026-06-05
**Status:** Approved

## Overview

Simplify the technician form by making branch the single identifier for where chemicals are picked up. The separate "Pickup Location" field is removed; the branch a technician selects is implicitly the warehouse they pick up from. Vendors access a branch-scoped page via a dedicated URL.

---

## Form 1 Changes

- The `Pickup Location` dropdown is removed entirely.
- The `Branch` field label is updated to **"Branch (Pickup Location)"** to make clear to technicians that selecting their branch also sets their pickup location.
- Form 1 fields become: Name, Branch (Pickup Location), Supervisor, Pickup Date.

---

## Backend & Database Changes

- The `pickup_location` column is dropped from the `technician_requests` table via a DB migration.
- The `INSERT` statement in `routes/technician.js` is updated to remove `pickup_location`.
- The `branch` value from Form 1 is stored in the existing `branch` column and serves as the sole location identifier for both supervisor/vendor filtering.
- Existing rows in the database lose the `pickup_location` column; `branch` already captures the same information.

---

## Vendor Page Changes

- Vendor routes change from warehouse-based filtering to branch-based URL routing: `/vendor/:branch`.
- Each branch gets a dedicated, shareable URL (e.g., `/vendor/select`, `/vendor/pestex`).
- Branches with spaces or special characters work via URL encoding — Express auto-decodes the param, and browsers display the decoded form in the address bar.
- The existing warehouse dropdown on the vendor page is removed.
- The vendor query changes from `WHERE pickup_location = ?` to `WHERE branch = ?` using the decoded URL param.

### Example vendor URLs

| Branch | URL |
|--------|-----|
| Select | `/vendor/Select` |
| Pestex | `/vendor/Pestex` |
| Lincoln | `/vendor/Lincoln` |
| Select - LI Commercial & Residential | `/vendor/Select%20-%20LI%20Commercial%20%26%20Residential` |

---

## What Is Not Changing

- The branch dropdown values in Form 1 remain the same 12 hardcoded options.
- Supervisor filtering by branch is unchanged.
- The supervisor approval workflow is unchanged.
- No vendor authentication is added — vendors access their page via URL only.
