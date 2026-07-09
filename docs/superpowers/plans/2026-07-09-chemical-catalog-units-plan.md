# Chemical Catalog & Per-Chemical Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic 84-item chemical catalog with the real 177-item vendor supply list (each with its own unit), and make the chemical request form auto-fill the correct unit for whichever chemical is selected instead of offering a fixed case/box/individual choice.

**Architecture:** `chemicals` table gets a `unit` column (replacing `epa_registration`/`replacement_product`); `seed.js` self-heals from the old dataset to the new one on first run after deploy, then stays idempotent. `views/form2.html`'s chemical `<select>` carries a `data-idx` per option (same pattern as the technician dropdown in `views/form1.html`) so a `change` handler can look up the exact chemical record and fill a read-only unit input. The supervisor/vendor "modify chemical" dropdowns get the same `Product Name (UNIT)` label for consistency.

**Tech Stack:** Node/Express, `pg` (Postgres), vanilla client-side JS, Jest + Supertest.

## Global Constraints

- Per the approved design (`docs/superpowers/specs/2026-07-09-chemical-catalog-units-design.md`): replace the chemical catalog entirely (no merge with old 84-item list); include every line of the vendor list (chemicals and equipment alike); one row per pack-size/unit variant, even for repeated product names; `material_code` is `NULL` when the vendor list has no Item number; unit is auto-filled and **not** user-selectable; chemical dropdown options always display `Product Name (UNIT)`.
- Don't touch `chemical_requests` schema — its `unit` column is already `TEXT` and accepts the new unit vocabulary (`CS`, `BX`, `BT`, `CN`, `PL`, `JG`, `PK`, `JR`, `GL`, `KT`, `EA`) with no migration.
- Don't change approval/fulfillment/print logic in `routes/supervisor.js` / `routes/vendor.js` beyond the modify-dropdown label — they already treat `unit` as opaque display text.

---

### Task 1: Migrate `chemicals` schema and update `/api/chemicals`

**Files:**
- Modify: `db.js:29-35`
- Modify: `routes/api.js:5-14`
- Modify: `tests/api.test.js:15-19`, `tests/api.test.js:40-47`

**Interfaces:**
- Produces: `chemicals` table shape `{ id, material_code (nullable), product_name, unit }`. `GET /api/chemicals` returns `{ material_code, product_name, unit }[]`. Later tasks (2-5) read `unit` off this shape.

These three files must change together: dropping the old columns from the DB while `routes/api.js` still selects them by name would make `GET /api/chemicals` error, and the test fixture inserts into columns that are about to disappear. There's no way to land one without the others and keep tests green, so they're one task.

- [ ] **Step 1: Update the test fixture and assertions in `tests/api.test.js`**

Replace the `beforeAll` insert (lines 15-19):

```js
  await db.query(
    `INSERT INTO chemicals (material_code, product_name, unit)
     VALUES ('MAT001', 'Test Chemical', 'CS')
     ON CONFLICT (material_code) DO NOTHING`
  );
```

Replace the `'each item has the expected fields'` test (lines 40-47):

```js
  it('each item has the expected fields', async () => {
    const res = await request(app).get('/api/chemicals');
    const item = res.body.find(c => c.material_code === 'MAT001');
    expect(item).toHaveProperty('material_code');
    expect(item).toHaveProperty('product_name');
    expect(item).toHaveProperty('unit');
  });
```

Add a new schema test directly after the existing `describe('technician_requests schema', ...)` block (after line 77, before `describe('POST /submit-request', ...)`):

```js
describe('chemicals schema', () => {
  it('has a unit column and no epa_registration/replacement_product columns', async () => {
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'chemicals'
    `);
    const names = rows.map(r => r.column_name);
    expect(names).toContain('unit');
    expect(names).not.toContain('epa_registration');
    expect(names).not.toContain('replacement_product');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/api.test.js -t "chemicals schema|GET /api/chemicals" -v`
Expected: FAIL — either `column "unit" of relation "chemicals" does not exist` (insert fails in `beforeAll`) or, if the insert is skipped by `ON CONFLICT`, the field/column assertions fail because `db.js` and `routes/api.js` haven't changed yet.

- [ ] **Step 3: Migrate the schema in `db.js`**

Replace the `chemicals` table block (`db.js:29-35`):

```js
  await pool.query(`CREATE TABLE IF NOT EXISTS chemicals (
    id SERIAL PRIMARY KEY,
    material_code TEXT UNIQUE,
    product_name TEXT,
    unit TEXT
  )`);

  await pool.query(`ALTER TABLE chemicals ADD COLUMN IF NOT EXISTS unit TEXT`);
  await pool.query(`ALTER TABLE chemicals DROP COLUMN IF EXISTS epa_registration`);
  await pool.query(`ALTER TABLE chemicals DROP COLUMN IF EXISTS replacement_product`);
```

- [ ] **Step 4: Update the query in `routes/api.js`**

Replace lines 5-14:

```js
router.get('/chemicals', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT material_code, product_name, unit FROM chemicals ORDER BY product_name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chemicals.' });
  }
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest tests/api.test.js -t "chemicals schema|GET /api/chemicals" -v`
Expected: PASS (3 tests: schema check, "returns 200 with an array", "each item has the expected fields")

- [ ] **Step 6: Commit**

```bash
git add db.js routes/api.js tests/api.test.js
git commit -m "feat: replace chemical EPA/replacement columns with a unit column"
```

---

### Task 2: Replace the chemical catalog seed data

**Files:**
- Modify: `seed.js:5-91` (the `chemicals` array), `seed.js:302-308` (the seeding loop)
- Modify: `tests/api.test.js` (add tests after the `'chemicals schema'` describe block added in Task 1)

**Interfaces:**
- Consumes: `chemicals` table shape from Task 1 (`material_code`, `product_name`, `unit`).
- Produces: 177 rows in `chemicals`, one per vendor-list line. Task 3 (`views/form2.html`) and Tasks 4-5 (supervisor/vendor dropdowns) consume this data through `/api/chemicals`, unchanged from Task 1.

Seeding runs on every app start (`index.js:13`: `db.ready.then(() => seed(db))`), across every test file that requires `../index`. A plain `DELETE FROM chemicals` followed by re-insert would race with any test file's fixture rows if two app instances start concurrently (Jest runs test files in parallel workers by default). Instead, `seed()` only wipes the table when it detects the *old* catalog is still present (checking for `'ADVION Ant Gel'`, a name unique to the old 84-item list) — a one-time self-heal. Once migrated, every subsequent run — including concurrent ones — only does `ON CONFLICT (material_code) DO NOTHING` inserts, which are non-destructive.

- [ ] **Step 1: Write the failing tests in `tests/api.test.js`**

Add after the `describe('chemicals schema', ...)` block added in Task 1:

```js
describe('chemicals catalog seed data', () => {
  it('replaces the old generic catalog with the vendor supply list', async () => {
    const { rows: total } = await db.query(`SELECT COUNT(*) AS count FROM chemicals`);
    expect(parseInt(total[0].count, 10)).toBe(178); // 177 seeded + 1 test fixture row (MAT001)

    const { rows: xcluder } = await db.query(
      `SELECT unit FROM chemicals WHERE product_name = $1`,
      [`XCLUDER FILL FABRIC 4''X10FT 5/CS 162707`]
    );
    expect(xcluder).toHaveLength(1);
    expect(xcluder[0].unit).toBe('CS');

    const { rows: stale } = await db.query(
      `SELECT 1 FROM chemicals WHERE product_name = 'ADVION Ant Gel'`
    );
    expect(stale).toHaveLength(0);
  });

  it('removes stale rows and reseeds when the old catalog is detected', async () => {
    const seed = require('../seed');
    await db.query(
      `INSERT INTO chemicals (material_code, product_name, unit)
       VALUES ('OLD1', 'ADVION Ant Gel', 'EA')
       ON CONFLICT (material_code) DO NOTHING`
    );
    await seed(db);

    const { rows } = await db.query(
      `SELECT 1 FROM chemicals WHERE product_name = 'ADVION Ant Gel'`
    );
    expect(rows).toHaveLength(0);
  });
});
```

This second test must run after the tests that depend on the `MAT001` fixture row (the `GET /api/chemicals` and `chemicals catalog seed data` count/xcluder assertions) since it triggers a full wipe-and-reseed — placing it as the last test in the `'chemicals catalog seed data'` describe block, as above, satisfies that.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest tests/api.test.js -t "chemicals catalog seed data" -v`
Expected: FAIL — total count is 85 (84 old + 1 fixture), not 178; the `XCLUDER...` lookup returns 0 rows; `'ADVION Ant Gel'` is still present.

- [ ] **Step 3: Replace the seed data and seeding logic in `seed.js`**

Replace the `chemicals` array (`seed.js:5-91`, from `const chemicals = [` through its closing `];`) with:

```js
const chemicals = [
  { material_code: '387700', product_name: 'ACTISOL COMPACT UNIT B290300', unit: 'EA' },
  { material_code: '808460', product_name: 'ACTIVEGUARD DBL/FU 6/CS 75X54X14', unit: 'EA' },
  { material_code: '808462', product_name: 'ACTIVEGUARD KG 6/CS 80X76X14', unit: 'EA' },
  { material_code: '808461', product_name: 'ACTIVEGUARD QN 6/CS 80X60X14', unit: 'EA' },
  { material_code: '808457', product_name: 'ACTIVEGUARD TN/SNGL 6/CS 75X38X14', unit: 'EA' },
  { material_code: null, product_name: 'ADVANCE TBS 10/BX', unit: 'BX' },
  { material_code: null, product_name: 'ADVION ANT GEL BAIT 4X30GM/BX 5/CS', unit: 'EA' },
  { material_code: '838076', product_name: 'ADVION ANT GEL MASTER CS 40X30GM/CS 64374 AGCY', unit: 'CS' },
  { material_code: '807757', product_name: 'ADVION CR GEL BAIT 4X30GM/BX 5/CS', unit: 'BX' },
  { material_code: '888107', product_name: 'ADVION CR GEL BAIT 4X30GM/PK 5/CS 88501 AGCY', unit: 'PK' },
  { material_code: '838077', product_name: 'ADVION CR GEL MASTER CS 40X30GM/CS 64372 AGCY', unit: 'CS' },
  { material_code: '840946', product_name: 'ADVION WDG 16.5OZ BT 4/CS 63953 AGCY', unit: 'BT' },
  { material_code: '623441', product_name: 'ALLURE MOTH KIT 24/CS 4059014530', unit: 'CS' },
  { material_code: '810150', product_name: 'ALPINE WSG 500GM JAR 4/CS 4059014217', unit: 'JR' },
  { material_code: '651723', product_name: 'ALTOSID 30 DAY BRIQUET 100/CASE 37090C WELLMARK MATL', unit: 'CS' },
  { material_code: '834260', product_name: 'APREHEND 16/OZ BOTTLE 6/CS APRD016', unit: 'BT' },
  { material_code: null, product_name: 'BAC-A-ZAP 12X1QT/CS', unit: 'EA' },
  { material_code: null, product_name: 'BAC-A-ZAP 4X1GL/CS', unit: 'EA' },
  { material_code: null, product_name: 'BASE OIL', unit: 'EA' },
  { material_code: null, product_name: 'BIFEN GRANULAR 25 LB BAG', unit: 'EA' },
  { material_code: '742679', product_name: 'BIFEN I/T 7.9 1GL 4/CS T&M 82004435 DOM', unit: 'JG' },
  { material_code: null, product_name: 'BORACTIN DUST 12X1LB/CS BAIP001-12', unit: 'EA' },
  { material_code: null, product_name: 'BORACTIN DUST 25LB PL BAIP025', unit: 'EA' },
  { material_code: '833683', product_name: 'BURROW RX COMMRCL UNIT BRX1', unit: 'EA' },
  { material_code: null, product_name: 'CIMEXA INSECT DUST 4OZ 12/CS CXID032-12', unit: 'EA' },
  { material_code: null, product_name: 'CIMEXA INSECTICIDE DUST 5LB/PL', unit: 'EA' },
  { material_code: '740649', product_name: 'CLOTHES MOTH TRAP 2X12/BX 051-PRO-CM2-12', unit: 'BX' },
  { material_code: '825032', product_name: 'CM MC TRAP BLK CLR LID 12/CS 612MC-BLK', unit: 'EA' },
  { material_code: '735733', product_name: 'CM MC TRAP METAL CLR LID 612MC 12/CS', unit: 'EA' },
  { material_code: '787005', product_name: 'CM MC TRAP METAL SD LID 12/CS 612MCS', unit: 'EA' },
  { material_code: null, product_name: 'CM MOUSE GLBD F/614 SLIM 2X72/BX 72TC3', unit: 'BX' },
  { material_code: '886667', product_name: 'CM MOUSE 4LB BANANA SCENT GLBD 72DNTBA', unit: 'BX' },
  { material_code: null, product_name: "CM RAT GLBD 24X2/BX 48WRG WHITE - COOL TEMP GLUE", unit: 'BX' },
  { material_code: null, product_name: 'CM RAT GLBD BULK PACK 48/BX ECONO 1448 BLACK', unit: 'BX' },
  { material_code: '886075', product_name: 'COMPACT 70 DEHUMIDIFIER W/A2L 4044110', unit: 'EA' },
  { material_code: '820637', product_name: 'CONTRAC BLOX 18LB PL CB4051', unit: 'PL' },
  { material_code: '402860', product_name: 'CONTRAC PEL BAIT BULK CP4082', unit: 'PL' },
  { material_code: '828108', product_name: 'CROSSFIRE AERSL 17OZ CN 12/CS FLOOR', unit: 'CN' },
  { material_code: '825005', product_name: 'CROSSFIRE BB CONC 13/OZ 10/CS FLOOR', unit: 'BT' },
  { material_code: '838707', product_name: 'CYZMIC CS QUART BT 6/CS 82002403', unit: 'BT' },
  { material_code: '642215', product_name: 'DELTADUST INSECTICIDE 24X1LB/CS DOM', unit: 'BT' },
  { material_code: '847291', product_name: 'DEMAND CS INSECTICIDE 8/OZ 12/CS 70783 DOM', unit: 'BT' },
  { material_code: '790017', product_name: 'DEO BASE OIL 5GL PL', unit: 'PL' },
  { material_code: null, product_name: 'D-FENSE INSECT DUST 12X1LB/CS 2479', unit: 'EA' },
  { material_code: '837858', product_name: 'D-FENSE NXT AERSL 15OZ 12/CS FLOOR', unit: 'CN' },
  { material_code: '405190', product_name: 'DITRAC TRAC POWDER RUP 25LB/PL DI5067', unit: 'PL' },
  { material_code: '405180', product_name: 'DITRAC TRAC POWDER RUP 4X6LB/CS DI5066', unit: 'PL' },
  { material_code: '847511', product_name: 'DOXEM NXT AEROSOL 15/OZ 12/CS 82770012 FLOOR', unit: 'CN' },
  { material_code: '393540', product_name: 'DR-5 PRESSURE DUSTER 5/LT 116-257-01', unit: 'EA' },
  { material_code: '613778', product_name: 'DUSTICK 21/FT COMPLETE 6/CS DU1000', unit: 'EA' },
  { material_code: '393380', product_name: 'DUST-R 2250 ELEC 110V 15015605', unit: 'EA' },
  { material_code: '845702', product_name: 'ECOPCO AR-X AEROSOL CAN 15OZ 12/CS 100545630', unit: 'CN' },
  { material_code: null, product_name: 'ECOVIA CA 16OZ CN 12/CS EVCA016-12', unit: 'CN' },
  { material_code: '809081', product_name: 'ECOVIA EC 64OZ BT 4/CS', unit: 'JG' },
  { material_code: '835946', product_name: 'ECOVIA MT CONC T&M 64OZ 4/CS EVMT064', unit: 'BT' },
  { material_code: '808816', product_name: 'ENDZONE STICKER 20/PK 12PK/BX 6BX/CS 11008504', unit: 'PK' },
  { material_code: '818866', product_name: 'EXCITER 16OZ BOTTLE 8/CASE 100208927', unit: 'BT' },
  { material_code: '882825', product_name: 'EZ KAT BAIT STATION 12/BOX 1-V-KAT', unit: 'EA' },
  { material_code: '845475', product_name: 'EZ KLEAN RBS BLK 6/CS PVTL SELECT', unit: 'EA' },
  { material_code: null, product_name: 'FENDONA CS INSECTICIDE 16OZ 6/CS', unit: 'BX' },
  { material_code: '827788', product_name: 'FIREBACK BED BUG SPRAY 17OZ 12/CS', unit: 'CN' },
  { material_code: '781686', product_name: 'FIRSTSTRIKE SOFT BAIT 10GM 16LB/PL', unit: 'PL' },
  { material_code: '826228', product_name: 'FIRSTSTRIKE SOFT BAIT 4LB/BG 4BG/BX 80000558', unit: 'BX' },
  { material_code: '883391', product_name: 'FLOWZONE BKPK TYPHOON 3 18V 4GL 5 POS VAR PUMP LITHIUM FLOOR', unit: 'EA' },
  { material_code: '884987', product_name: 'FLOWZONE STORM PRTBLE SPRYR W/SWAP TANK 2GL FZVAQP FLOOR', unit: 'EA' },
  { material_code: '602929', product_name: 'FLYING LION INSECT LITE 711', unit: 'EA' },
  { material_code: '802098', product_name: 'FLYLITE BULB 16 36W 50/CS EL-12', unit: 'EA' },
  { material_code: '646030', product_name: 'FLYLITE ELEC GRID TRAP AG-969', unit: 'EA' },
  { material_code: '757880', product_name: 'FLYLITE GLBD CM 907 BLK 12/BX 12/CS', unit: 'BX' },
  { material_code: '845643', product_name: 'FOAM FRESH 18OZ 8/CS FLOOR', unit: 'CN' },
  { material_code: '810222', product_name: 'GENERATION MINI BLOCKS 20GM 16LB/PL', unit: 'PL' },
  { material_code: '671751', product_name: 'GENTROL AEROSOL IGR 16OZ CAN 12/CASE WELLMARK MATL', unit: 'CN' },
  { material_code: '619907', product_name: 'GENTROL IGR CONCENTRATE 16OZ BOTTLE 6/CASE WLMRK 37880A', unit: 'BT' },
  { material_code: '687508', product_name: 'GLBD CM 72MB 4LB PVTL SELECT EXT', unit: 'BX' },
  { material_code: '821680', product_name: 'GLBD MOUSE 72MAX PNUT PVTL PESTEX', unit: 'BX' },
  { material_code: '835375', product_name: 'GLOBAL MISC EQUIP DIRECT ONLY', unit: 'EA' },
  { material_code: null, product_name: 'GLO STIKS', unit: 'EA' },
  { material_code: null, product_name: 'GLOVES NITRILE POWDER FREE LG 100/BX 20BX/CS 7005PFL', unit: 'BX' },
  { material_code: null, product_name: 'GLOVES NITRILE POWDER FREE LG 100/BX BES-7500PFL', unit: 'BX' },
  { material_code: null, product_name: 'GLOVES NITRILE POWDER FREE MD 100/BX BES-7500PFM', unit: 'BX' },
  { material_code: null, product_name: 'GLOVES NITRILE POWDER FREE XL 100/BX 20BX/CS 7005PFXL', unit: 'BX' },
  { material_code: null, product_name: 'GLOVES NITRILE POWDER FREE XL 100/BX BES-7500PFXL', unit: 'BX' },
  { material_code: null, product_name: 'GLVE NITRILE COBALT BLUE PF XL 100/BX N274', unit: 'BX' },
  { material_code: null, product_name: 'GOLDEN MALRIN FLY BAIT 10LB PAIL 100527078', unit: 'EA' },
  { material_code: null, product_name: 'GOLDSTICK FLY TRAP LARGE 962 24/CS', unit: 'EA' },
  { material_code: null, product_name: 'GOURMET ANT BAIT GEL 6X1.5OZ/BX 8/CS', unit: 'BX' },
  { material_code: '754793', product_name: 'GOTCHA SPRAYER PRO ADAPT GSP0205', unit: 'EA' },
  { material_code: '602534', product_name: 'INSECT TRAP 288I 72/BX 4/CS', unit: 'BX' },
  { material_code: '845482', product_name: 'INSECT TRAP 288I 72/BX PVTL SELECT', unit: 'BX' },
  { material_code: '805642', product_name: 'INTICE 10 PERIMETER BAIT 40LB BX', unit: 'BX' },
  { material_code: '775405', product_name: 'INVADE BIO FOAM W/ PUMP 1GL 4/CS', unit: 'GL' },
  { material_code: '847279', product_name: 'INVADE HOT SPOT PLUS FOAM 19/OZ 12/CS', unit: 'CN' },
  { material_code: '414520', product_name: "KETCH-ALL W/ METAL LID 12/CS 101-0-007", unit: 'EA' },
  { material_code: '824314', product_name: 'LOCK-UP STD MAT CVR QN 6/CS 83QUENC', unit: 'EA' },
  { material_code: '811702', product_name: 'MAXF IMPACT CR GEL 5BX/CS 4X30GM/BX', unit: 'BX' },
  { material_code: null, product_name: 'MAXFORCE COMPLETE GRAN BAIT 8OZ 6/CS D00000949', unit: 'EA' },
  { material_code: null, product_name: 'MAXFORCE FC ANT BAIT STATION 24/BG 4/CS D00000950', unit: 'EA' },
  { material_code: null, product_name: 'MAXFORCE FC COCKROACH BAIT STATION 72/BG 4BG/CS D00000954', unit: 'EA' },
  { material_code: null, product_name: 'MAXFORCE FC MAGNUM CR RESERVOIR 33GM/BX 12/CS D00000951', unit: 'BX' },
  { material_code: null, product_name: 'MAXFORCE FC SELECT ROACH BAIT GEL 4X30GM/BX 5/CS D00000953', unit: 'BX' },
  { material_code: null, product_name: 'MAXFORCE FLEET ANT BAIT GEL 4X27GM/BX 5/CS D00000955', unit: 'BX' },
  { material_code: '885879', product_name: 'MAXFORCE FLY SPOT BAIT 2OZ PK 50/CS D00000956', unit: 'BX' },
  { material_code: null, product_name: 'MAXFORCE FLY SPOT BAIT 2OZ PK 50/CS D00000956', unit: 'EA' },
  { material_code: null, product_name: 'MAXFORCE GRANULAR FLY BAIT 4X5LB/CS 79365306', unit: 'BX' },
  { material_code: null, product_name: 'MAXFORCE GRANULAR FLY BAIT 5LB 4/CS D00000958', unit: 'EA' },
  { material_code: '885885', product_name: 'MAXFORCE QUANTUM ANT BAIT 120GM 6/CS D00000959', unit: 'BT' },
  { material_code: '847623', product_name: 'MBS MOUSE BAIT STATION BLACK 12/BX PVTL PESTEX', unit: 'BX' },
  { material_code: '784524', product_name: 'MBS MOUSE BAIT STN MBS BLK 12/BX', unit: 'BX' },
  { material_code: '884935', product_name: 'MBS+2 BLOCK STATION 12/BX 4 BX/CS', unit: 'EA' },
  { material_code: '790405', product_name: `ML SS SPIKES 3"x50'/BX UNV2001/3`, unit: 'BX' },
  { material_code: '603469', product_name: 'ML VESERIS SPRAYER 1027 CC 9 1GL 11004001', unit: 'EA' },
  { material_code: '798652', product_name: 'MOUSE GLBD 72MAX 72/BX NO SCENT', unit: 'BX' },
  { material_code: '788221', product_name: 'MOUSE GLBD 72MAX 72/BX PNUT', unit: 'BX' },
  { material_code: '640537', product_name: 'MOUSE GLBD 72MB 4.5 72/BX PNUT', unit: 'BX' },
  { material_code: '845322', product_name: 'NIBAN GRAN BAIT 40LBS D2D', unit: 'BX' },
  { material_code: '882747', product_name: 'NIBOR-D INSECTICIDE FOAM PLUS IGR 21OZ CAN 6/CASE FLOOR', unit: 'CN' },
  { material_code: '812645', product_name: 'NUVAN DIRECTED SPRAY AEROSOL 17OZ CN 12/CS 13891 FLOOR', unit: 'CN' },
  { material_code: '885472', product_name: 'NUVAN PROSTRIPS 12X16G/PK 6PK/BX 6BX/CS 14877 RUP FLOOR', unit: 'PK' },
  { material_code: '802958', product_name: 'NYGUARD IGR CONC 10X140ML/CS', unit: 'BT' },
  { material_code: '833484', product_name: 'ONEGUARD MULTI MOA CONC 2X1GL/CS FLOOR DOM', unit: 'JG' },
  { material_code: '833481', product_name: 'ONEGUARD MULTI MOA CONC 6X32OZ/CS FLOOR DOM', unit: 'BT' },
  { material_code: '803774', product_name: 'ONSLAUGHT FCAP S&S PT BT 6/CS 2964-D05', unit: 'BT' },
  { material_code: '749573', product_name: 'ONSLAUGHT MC 16/OZ 6/CS', unit: 'BT' },
  { material_code: '834955', product_name: 'ORTHENE PCO PELLETS 10PK/BX 12BX/CS', unit: 'BX' },
  { material_code: '800150', product_name: 'PROTECTA EVO EXPRESS STN W/BR 1/EA BLACK EV8001', unit: 'EA' },
  { material_code: '835871', product_name: 'PROTECTA EVO WEIGHTED LANDSCAPE STN W/BR STONE 2/CS', unit: 'CS' },
  { material_code: '658988', product_name: 'PROTECTA RTU MOUSE STN 12/BX PR2620', unit: 'BX' },
  { material_code: '813117', product_name: 'PT ALPINE FLY BAIT AERSL 6X16OZ/CS', unit: 'CN' },
  { material_code: '883206', product_name: 'PT FENDONA AERSL 14 OZ 12/CS 4059026313', unit: 'CN' },
  { material_code: '882751', product_name: 'PT WASP FREEZE II INSECTICIDE 14OZ CAN 12/CASE 4059026305', unit: 'CN' },
  { material_code: '837773', product_name: 'PUFFY D DUSTER 512 12/CS', unit: 'EA' },
  { material_code: '401110', product_name: 'RAT GLBD GIANT 24GRB 24/BX MAXCATCH', unit: 'BX' },
  { material_code: '733063', product_name: 'RBS EZ KLEAN RAT BAIT STN BLACK 6/CS', unit: 'EA' },
  { material_code: '847624', product_name: 'RBS EZ SECURED STATION BLACK PVTL PESTEX', unit: 'EA' },
  { material_code: '744884', product_name: 'RBS EZ SECURED STN BLK 60/PAL 240/MPAL', unit: 'EA' },
  { material_code: '801311', product_name: 'RESOLV SOFT BAIT 12GM 16LB/PL', unit: 'PL' },
  { material_code: '826227', product_name: 'RESOLV SOFT BAIT 12GM 4X4LB/BX', unit: 'BX' },
  { material_code: '886117', product_name: 'RIDESCO WG 950GM/BT 6/CS 4059031018', unit: 'BT' },
  { material_code: '837963', product_name: 'SHOCKWAVE 1 AERSL 17OZ 12/CS DOM FLOOR', unit: 'CN' },
  { material_code: '775569', product_name: 'SHOCKWAVE FOGGING CONC 4X1GL/CS DOM', unit: 'JG' },
  { material_code: '745602', product_name: 'SIDEKICK RAT STN 6/CS SK4500', unit: 'EA' },
  { material_code: '414390', product_name: 'SNAP-E RAT TRAP 180/CS BULK 103-0-014', unit: 'EA' },
  { material_code: '832236', product_name: 'STEAMER CIMEX ERADICATOR PTNA0004', unit: 'BX' },
  { material_code: '665223', product_name: 'STERI-FAB 4X1GL JG/CS', unit: 'JG' },
  { material_code: '835872', product_name: 'STRYKER 54 AERSL 15OZ CN 12/CS FLOOR', unit: 'CN' },
  { material_code: '835668', product_name: 'STRYKER WASP/HORNET 15OZ 12/CS FLOOR', unit: 'CN' },
  { material_code: '604461', product_name: 'SUPER BEE POLE CMPLT', unit: 'EA' },
  { material_code: '832340', product_name: 'SUREKILL ADV FLUSHER 17OZ 12/CS 0101011 DOM FLOOR', unit: 'CN' },
  { material_code: '885317', product_name: 'SUSPEND POLYZONE 16OZ 16/CS D00000994', unit: 'BT' },
  { material_code: '885906', product_name: 'SUSPEND SC INSECTICIDE 1GL 4/CS D00000997', unit: 'JG' },
  { material_code: '885315', product_name: 'SUSPEND SC INSECTICIDE 1PT 16/CS D00000993', unit: 'BT' },
  { material_code: '676787', product_name: 'SUSPEND SC INSECTICIDE 4X1GL/CS DOM', unit: 'JG' },
  { material_code: '738614', product_name: 'TALPIRID MOL BAIT 2X10/BX 5BX/CS MO7150', unit: 'BX' },
  { material_code: '754968', product_name: 'TALSTAR PRO INSECTICIDE 3/4GL JUG 4/CASE 11008458 DOM', unit: 'JG' },
  { material_code: '810442', product_name: 'TAURUS SC NY 4X20OZ/CS 82003596', unit: 'BT' },
  { material_code: '811120', product_name: 'TEKKO PRO IGR 16OZ 6/CS 82100005', unit: 'BT' },
  { material_code: '844807', product_name: 'TEKKO TRIO IGR 16OZ 6/CS 82690035 FLOOR', unit: 'BT' },
  { material_code: '886240', product_name: 'TEMPO 1 DUST 1.25LB 12/CS D00001000', unit: 'BT' },
  { material_code: '885313', product_name: 'TEMPO SC ULTRA 240ML BOTTLE 6 BT/CS D00001003', unit: 'BT' },
  { material_code: '834025', product_name: 'TEMPRID FX INSECT 900ML 8/CS NEW LBL', unit: 'BT' },
  { material_code: '885923', product_name: 'TEMPRID FX INSECTICIDE 240ML 6/CS D00001007', unit: 'BT' },
  { material_code: '885925', product_name: 'TEMPRID FX INSECTICIDE 400ML 6/CS D00001008', unit: 'BT' },
  { material_code: '793132', product_name: 'TRANSPORT MIKRON 32OZ BOTTLE 16/CASE 11008490', unit: 'BT' },
  { material_code: '742056', product_name: 'TRAPRITE CARDBOARD MOUSE STN 50/CS 2156', unit: 'CS' },
  { material_code: '776441', product_name: 'TRAPRITE CARDBOARD TUNNEL 50/CS 2158', unit: 'CS' },
  { material_code: '844796', product_name: 'TRELONA TBC 124GM AGCY 4X25 100/CS', unit: 'CS' },
  { material_code: '720177', product_name: 'T-REX RAT SNAP TRAP 12/CS ST2000', unit: 'EA' },
  { material_code: '832180', product_name: 'VENDETTA NITRO 4X30GM/PK 5/CS FLOOR', unit: 'BX' },
  { material_code: '808555', product_name: 'VENDETTA PLUS CR GEL 5BX/CS 4X30GM/BX', unit: 'BX' },
  { material_code: '401920', product_name: 'VESERIS SPRAYER 1028 CC 18 1GL 11004002', unit: 'EA' },
  { material_code: '610415', product_name: 'VICTOR MOUSE SNAP TRAP ET 72/BX M325 M7', unit: 'BX' },
  { material_code: '610416', product_name: 'VICTOR RAT SNAP TRAP ET 12/BX M326 M9', unit: 'BX' },
  { material_code: '884934', product_name: 'VIPER RAT SNAP TRAP 12/BX 6BX/CS', unit: 'EA' },
  { material_code: '688128', product_name: 'WC MOTH FLAT TRAP KIT 10/KT IL-120-10', unit: 'KT' },
  { material_code: '846348', product_name: `XCLUDER 36" STANDARD DOOR SWEEP ALUM XCL-11101036-AL`, unit: 'EA' },
  { material_code: '846345', product_name: `XCLUDER 48" STANDARD DOOR SWEEP BRONZE XCL-11101048-BR`, unit: 'EA' },
  { material_code: '795856', product_name: `XCLUDER FILL FABRIC 4''X10FT 5/CS 162707`, unit: 'CS' },
];
```

Replace the chemicals seeding loop (`seed.js:302-308`):

```js
  const { rows: staleCheck } = await pool.query(
    `SELECT 1 FROM chemicals WHERE product_name = 'ADVION Ant Gel' LIMIT 1`
  );
  if (staleCheck.length > 0) {
    await pool.query('DELETE FROM chemicals');
  }
  for (const c of chemicals) {
    await pool.query(
      `INSERT INTO chemicals (material_code, product_name, unit)
       VALUES ($1, $2, $3) ON CONFLICT (material_code) DO NOTHING`,
      [c.material_code, c.product_name, c.unit]
    );
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest tests/api.test.js -t "chemicals catalog seed data" -v`
Expected: PASS (both tests)

- [ ] **Step 5: Run the full test file to check for regressions from the reseed**

Run: `npx jest tests/api.test.js -v`
Expected: PASS — all tests in the file, including `GET /api/chemicals` and `chemicals schema` from Task 1.

- [ ] **Step 6: Commit**

```bash
git add seed.js tests/api.test.js
git commit -m "feat: reseed chemicals from the real vendor supply list with per-item units"
```

---

### Task 3: Auto-fill unit on the chemical request form

**Files:**
- Modify: `views/form2.html` (entire file)
- Modify: `tests/api.test.js` (add a test after the `describe('POST /submit-request', ...)` block)

**Interfaces:**
- Consumes: `/api/chemicals` response shape from Task 1 (`{ material_code, product_name, unit }[]`).
- Produces: no new interfaces — `chemical[]` / `unit[]` form field names are unchanged, so `POST /submit-request` (`routes/technician.js:17-49`) needs no changes.

- [ ] **Step 1: Write the failing test in `tests/api.test.js`**

Add after the `describe('POST /submit-request', ...)` block:

```js
describe('POST /form2 rendered markup', () => {
  it('renders a read-only unit field instead of a unit dropdown', async () => {
    const res = await request(app)
      .post('/form2')
      .type('form')
      .send({ name: 'Test Tech', branch: 'Select', supervisor: 'Jane Doe', pickup_date: '2026-07-01' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('class="unit-display"');
    expect(res.text).not.toContain('<option value="case">');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/api.test.js -t "POST /form2 rendered markup" -v`
Expected: FAIL — `class="unit-display"` not found in the response body.

- [ ] **Step 3: Rewrite `views/form2.html`**

Replace the entire file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Chemical Request Sheet</title>
  <link rel="stylesheet" href="/styles.css">
  <script>
    let chemicalsData = [];

    function chemOptionsHtml() {
      return chemicalsData
        .map((c, i) => `<option value="${c.product_name}" data-idx="${i}">${c.product_name} (${c.unit})</option>`)
        .join('');
    }

    function fillUnitForSelect(select) {
      const row = select.closest('tr');
      const unitInput = row.querySelector('.unit-display');
      const opt = select.options[select.selectedIndex];
      unitInput.value = (opt && opt.dataset.idx !== undefined) ? chemicalsData[opt.dataset.idx].unit : '';
    }

    function buildChemSelect() {
      return `<select name="chemical[]" required>${chemOptionsHtml()}</select>`;
    }

    function addRow() {
      const table = document.getElementById('chemicals-table');
      const row = table.insertRow(-1);

      row.insertCell(0).innerHTML = buildChemSelect();
      row.insertCell(1).innerHTML = '<input type="number" name="quantity[]" min="1" required>';
      row.insertCell(2).innerHTML =
        '<input type="text" name="unit[]" class="unit-display" readonly required style="background:#f0f0f0; cursor:not-allowed;">';

      fillUnitForSelect(row.querySelector('select[name="chemical[]"]'));
    }

    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('chemicals-table').addEventListener('change', (event) => {
        if (event.target.matches('select[name="chemical[]"]')) {
          fillUnitForSelect(event.target);
        }
      });

      fetch('/api/chemicals')
        .then(r => r.json())
        .then(data => {
          chemicalsData = data;
          const firstSelect = document.getElementById('first-chemical-select');
          firstSelect.innerHTML = chemOptionsHtml();
          fillUnitForSelect(firstSelect);
        })
        .catch(() => {
          document.getElementById('first-chemical-select').innerHTML =
            '<option value="">Error loading chemicals</option>';
        });
    });
  </script>
</head>
<body>
  <h2>Chemical Request Sheet</h2>

  <form action="/submit-request" method="POST">
    <table id="chemicals-table" border="1">
      <tr>
        <th>Chemical</th>
        <th>Quantity</th>
        <th>Unit</th>
      </tr>
      <tr>
        <td>
          <select id="first-chemical-select" name="chemical[]" required>
            <option value="">Loading chemicals...</option>
          </select>
        </td>
        <td><input type="number" name="quantity[]" min="1" required></td>
        <td>
          <input type="text" name="unit[]" class="unit-display" readonly required style="background:#f0f0f0; cursor:not-allowed;">
        </td>
      </tr>
    </table>
    <br>
    <button type="button" onclick="addRow()">Add Another Row</button>
    <br><br>
    <button type="submit">Submit Request</button>
  </form>
</body>
</html>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/api.test.js -t "POST /form2 rendered markup" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add views/form2.html tests/api.test.js
git commit -m "feat: auto-fill chemical unit on the request form instead of a fixed dropdown"
```

---

### Task 4: Label the supervisor "modify chemical" dropdown with product name and unit

**Files:**
- Modify: `routes/supervisor.js:107-113`
- Modify: `tests/api.test.js` (add a test after the `describe('POST /supervisor/chem-modify/:supervisorName', ...)` block)

**Interfaces:**
- Consumes: `/api/chemicals` response shape from Task 1.

- [ ] **Step 1: Write the failing test in `tests/api.test.js`**

Add after the `describe('POST /supervisor/chem-modify/:supervisorName', ...)` block:

```js
describe('GET /supervisor/:name chemical modify dropdown', () => {
  it('labels chemical options with product name and unit', async () => {
    const agent = request.agent(app);
    await agent.post('/supervisor/login').type('form').send({ password: 'testpass' });

    const res = await agent.get('/supervisor/Jane%20Doe');
    expect(res.status).toBe(200);
    expect(res.text).toContain("opt.textContent = c.product_name + ' (' + c.unit + ')';");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/api.test.js -t "GET /supervisor/:name chemical modify dropdown" -v`
Expected: FAIL — the old `opt.textContent = c.product_name;` line doesn't match.

- [ ] **Step 3: Update the option label in `routes/supervisor.js`**

Replace (`routes/supervisor.js:107-113`):

```js
          _chemicals.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.product_name;
            opt.textContent = c.product_name + ' (' + c.unit + ')';
            if (c.product_name === currentChem) opt.selected = true;
            sel.appendChild(opt);
          });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/api.test.js -t "GET /supervisor/:name chemical modify dropdown" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/supervisor.js tests/api.test.js
git commit -m "feat: show unit alongside product name in supervisor modify dropdown"
```

---

### Task 5: Label the vendor "modify chemical" dropdown with product name and unit

**Files:**
- Modify: `routes/vendor.js:157-163`
- Modify: `tests/api.test.js` (add a test after the `describe('POST /vendor/chem-modify/:location', ...)` block)

**Interfaces:**
- Consumes: `/api/chemicals` response shape from Task 1.

- [ ] **Step 1: Write the failing test in `tests/api.test.js`**

Add after the `describe('POST /vendor/chem-modify/:location', ...)` block:

```js
describe('GET /vendor/:location chemical modify dropdown', () => {
  it('labels chemical options with product name and unit', async () => {
    const res = await request(app).get('/vendor/Pestex');
    expect(res.status).toBe(200);
    expect(res.text).toContain("opt.textContent = c.product_name + ' (' + c.unit + ')';");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/api.test.js -t "GET /vendor/:location chemical modify dropdown" -v`
Expected: FAIL — the old `opt.textContent = c.product_name;` line doesn't match.

- [ ] **Step 3: Update the option label in `routes/vendor.js`**

Replace (`routes/vendor.js:157-163`):

```js
            _chemicals.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.product_name;
              opt.textContent = c.product_name + ' (' + c.unit + ')';
              if (c.product_name === currentChem) opt.selected = true;
              sel.appendChild(opt);
            });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/api.test.js -t "GET /vendor/:location chemical modify dropdown" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add routes/vendor.js tests/api.test.js
git commit -m "feat: show unit alongside product name in vendor modify dropdown"
```

---

### Task 6: Full regression run and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All test suites pass (`tests/api.test.js`, `tests/auth.test.js`), no failures.

- [ ] **Step 2: Start the app and walk through the technician flow**

Run: `npm start`, then in a browser visit `http://localhost:3000/`:
- Select a technician on form1, submit to reach form2.
- Confirm the chemical dropdown lists entries as `Product Name (UNIT)` (e.g. `ADVION CR GEL BAIT 4X30GM/BX 5/CS (BX)`).
- Confirm the Unit field is greyed out/read-only and shows the correct unit for the default-selected chemical on page load.
- Change the chemical selection and confirm the Unit field updates to match.
- Click "Add Another Row" and confirm the new row's Unit field is pre-filled correctly for its default-selected chemical, and updates when changed.
- Submit the request.

- [ ] **Step 3: Walk through supervisor and vendor modify dropdowns**

- Log into `/supervisor/login`, open a pending request, click "Modify" on a chemical row, and confirm the dropdown options read `Product Name (UNIT)`.
- Log into the vendor view for the request's branch, click "Modify" on an approved chemical row, and confirm the same labeling.

- [ ] **Step 4: No commit for this task** — it's verification only. If any step surfaces a bug, fix it in the relevant task's files and re-run that task's tests before re-verifying here.
