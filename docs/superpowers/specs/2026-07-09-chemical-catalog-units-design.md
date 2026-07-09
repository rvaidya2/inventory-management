# Chemical Catalog & Per-Chemical Units Design

**Date:** 2026-07-09
**Status:** Approved

## Overview

The chemical request form (`views/form2.html`) currently lets a technician pick any chemical from a generic 84-item catalog and separately pick a unit from a fixed dropdown (case/box/individual) that applies identically to every chemical. In reality, each product has its own actual packaging unit (case, box, bottle, can, each, etc.), and the current catalog doesn't reflect the real product/vendor list.

This replaces the chemical catalog with the real vendor supply list (~177 items) and makes the unit auto-fill based on the chosen chemical instead of being a free choice.

## Data Model

`chemicals` table changes:
- Drop `epa_registration` and `replacement_product` columns (not present in the new data source, unused elsewhere).
- Add `unit` column (`TEXT`).
- `material_code` stays `UNIQUE` but becomes nullable — set from the vendor list's Item number when present, else `NULL` (Postgres permits multiple `NULL`s under a `UNIQUE` constraint, so this doesn't conflict with the existing `ON CONFLICT (material_code) DO NOTHING` seeding logic).

Final shape:
```sql
CREATE TABLE IF NOT EXISTS chemicals (
  id SERIAL PRIMARY KEY,
  material_code TEXT UNIQUE,
  product_name TEXT,
  unit TEXT
)
```

**Seed data** (`seed.js`): the existing 84-entry `chemicals` array is replaced entirely by the list below, transcribed from the vendor supply list. One row per line as given — including non-chemical supply/equipment items, and separate rows for the same product name at different pack sizes/units (both are used as-is, not deduped or filtered). Where the source had no Item number, `material_code` is `null`.

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

(177 rows, transcribed from the vendor supply list. Entries with embedded double quotes or apostrophes use backtick template literals so `seed.js` stays valid JS.)

## API

`GET /api/chemicals` (`routes/api.js`) selects `material_code, product_name, unit` (drops the EPA/replacement columns from the query).

## Request Form (`views/form2.html`)

- The unit `<select>` (currently case/box/individual) is replaced with a read-only text input, auto-filled once a chemical is chosen. Same visual treatment as the read-only Supervisor field in `views/form1.html` (`background:#f0f0f0; cursor:not-allowed;`).
- Every chemical `<option>` displays `Product Name (UNIT)`, e.g. `MAXFORCE FLY SPOT BAIT 2OZ PK 50/CS D00000956 (BX)` vs. `(EA)` — this keeps the label unambiguous for the one product name that repeats under two different units, and is applied consistently to all entries rather than as a special case.
- Each `<option>` carries a `data-idx` attribute pointing into the fetched `chemicalsData` array (mirroring the technician dropdown pattern already in `views/form1.html`). On `change`, the handler reads `this.options[this.selectedIndex].dataset.idx`, looks up `chemicalsData[idx]`, and fills the row's read-only unit input with `.unit`. This resolves correctly by option identity rather than by matching on `product_name` text, which is needed since a couple of names aren't unique.
- This applies to both the initial row and rows added via `addRow()`. The `change` listener is attached once via event delegation on `#chemicals-table` (rather than per-row), so dynamically added `<select>`s pick up the behavior without extra wiring in `addRow()`.
- Submitted field names stay `chemical[]` and `unit[]`; the value submitted for `chemical[]` remains the plain `product_name` (no `(UNIT)` suffix). `unit[]` is now populated by the read-only input's value rather than by user selection.

## Supervisor & Vendor Modify Dropdowns

`routes/supervisor.js` and `routes/vendor.js` each populate a "Chemical" `<select>` (`#mod-chem-*`) from `/api/chemicals` for the inline modify form. Their option label changes to match form2's convention — `option.textContent = ${c.product_name} (${c.unit})` — for consistency and to disambiguate the repeated-name case. `option.value` stays `c.product_name` (unchanged behavior: these forms only submit/modify `chemical` and `quantity`, never `unit`).

## Tests

`tests/api.test.js`:
- The setup `INSERT INTO chemicals (...)` statement changes from inserting `epa_registration`/`replacement_product` to inserting `unit`.
- The "each item has the expected fields" test asserts `unit` instead of `epa_registration` / `replacement_product`.

## Out of Scope

- `chemical_requests` needs no migration — its `unit` column is already `TEXT` and simply starts receiving new values (`CS`, `BX`, `BT`, `CN`, `PL`, `JG`, `PK`, `JR`, `GL`, `KT`, `EA`) instead of `case`/`box`/`individual`.
- Approval/fulfillment/print logic (`routes/supervisor.js`, `routes/vendor.js`) treats `unit` as opaque display text already (`esc(chem.unit)`), so no logic changes are needed beyond the modify-dropdown label.
- Historical rows in `chemical_requests` keep their old `case`/`box`/`individual` unit values; these are not backfilled.
