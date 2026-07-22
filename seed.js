const db = require('./db');

// CHEMICALS — edit this array to add/remove chemicals
// Each entry: material_code, product_name, unit
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

// CONTACTS — edit this array to add/remove contacts (supervisors, managers, etc.)
// Each entry: last_name, first_name, phone, email, branch, role
const contacts = [
  { last_name: 'Chase', first_name: 'Alex', phone: '(401) 349-9030', email: 'achase@suburbanpestcontrollc.com', branch: 'Amherst', role: 'Branch Manager' },
  { last_name: 'Kamara', first_name: 'Michael', phone: '(917) 648-8280', email: 'mkamara@havenopests.com', branch: 'Colony, Metro Pest & Select', role: 'Service Manager' },
  { last_name: 'Murphy', first_name: 'Kieon', phone: '(516) 909-1224', email: 'kmurphy@akaselect.com', branch: 'Colony, Metro Pest & Select', role: 'Service Manager' },
  { last_name: "O'Reilly", first_name: 'Thomas', phone: '(347) 612-5748', email: 'toreilly@havenopests.com', branch: 'Colony, Metro Pest & Select', role: 'Area Manager' },
  { last_name: 'Petho', first_name: 'Justin', phone: '(201) 410-2160', email: 'jpetho@akaselect.com', branch: 'Colony, Metro Pest & Select', role: 'Service Manager' },
  { last_name: 'Savastino', first_name: 'Jennifer', phone: '(315) 447-6723', email: 'jennifer@gannonpestcontrol.com', branch: 'Gannon', role: 'Branch Manager' },
  { last_name: 'Cambareri', first_name: 'Rocco', phone: '(203) 938-3595', email: 'rocco@insectax.com', branch: 'Insecta X', role: 'Branch Manager' },
  { last_name: 'Martin', first_name: 'Glen', phone: '(401) 349-9824', email: 'glenn@lincolnpestcontrol.com', branch: 'Lincoln', role: 'Service Manager' },
  { last_name: 'Chase', first_name: 'Melissa', phone: '(401) 578-3111', email: 'melissa@lincolnpestcontrol.com', branch: 'Lincoln & Pestex', role: 'Branch Manager' },
  { last_name: 'Jones', first_name: 'Peter', phone: '(718) 717-4901', email: 'pjones@havenopests.com', branch: 'Metro Pest', role: 'Area Manager' },
  { last_name: 'LaRue', first_name: 'Matt', phone: '(908) 821-7811', email: 'matt@onthespotpestcontrol.com', branch: 'On The Spot', role: 'Service Manager' },
  { last_name: 'Netland', first_name: 'Michael', phone: '(862) 774-1789', email: 'mnetland@akaselect.com', branch: 'On The Spot', role: 'Branch Manager' },
  { last_name: 'Costa', first_name: 'Shawn', phone: '(508) 838-3722', email: 'shawn@pestexinc.com', branch: 'Pestex', role: 'Branch Manager' },
  { last_name: 'Greeley', first_name: 'Bill', phone: '(617) 590-9151', email: 'bill@pestexinc.com', branch: 'Pestex', role: 'Service Manager' },
  { last_name: 'Badillo', first_name: 'Lizette', phone: '(347) 476-5280', email: 'lbadillo@akaselect.com', branch: 'Select', role: 'Region Director' },
  { last_name: 'Canales', first_name: 'Pavel', phone: '(631) 487-7293', email: 'pcanales@akaselect.com', branch: 'Select', role: 'Service Manager' },
  { last_name: 'Hernandez', first_name: 'Danny', phone: '(516) 988-3864', email: 'dhernandez@akaselect.com', branch: 'Select', role: 'Branch Manager' },
  { last_name: 'Alarco', first_name: 'Robert', phone: '(516) 578-7689', email: 'ralarco@akaselect.com', branch: 'Select - LI Commercial & Residential', role: 'Branch Manager' },
  { last_name: 'Roach', first_name: 'Thomas', phone: '(631) 747-7791', email: 'troach@akaselect.com', branch: 'Select - LI Commercial & Residential', role: 'Service Manager' },
  { last_name: 'Barna', first_name: 'Jeff', phone: '(516) 912-3966', email: 'jbarna@akaselect.com', branch: 'Vermin Control', role: 'Regional Manager' },
  { last_name: 'Swaney', first_name: 'Mary', phone: '', email: 'mswaney@vermincontrol.com', branch: 'Vermin Control', role: 'Office Manager' },
  { last_name: 'Jerez', first_name: 'Kenny', phone: '', email: 'kjerez@akaselect.com', branch: 'Select', role: 'Service Manager' },
  { last_name: 'Smith', first_name: 'Craig', phone: '', email: 'csmith@akaselect.com', branch: 'Select', role: 'Service Manager' },
];

// TECHNICIANS — edit this array to add/remove technicians
// Each entry: last_name, first_name, branch, supervisor (full name)
const technicians = [
  // Select - LI Commercial & Residential (Thomas Roach)
  { last_name: 'Aguilar', first_name: 'Benjamin', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Bartha', first_name: 'Glenn', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Bernier', first_name: 'Youl', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Berry', first_name: 'Michael', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Chioraia', first_name: 'Hector', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Clarke', first_name: 'Romaine', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Egede', first_name: 'Stanley', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Estrada', first_name: 'Pedro', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Guardado', first_name: 'Wilfredo', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Hain', first_name: 'Matthew', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Hill', first_name: 'Samad', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Johnson', first_name: 'Dequan', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Kidd', first_name: 'Delroy', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Kinny', first_name: 'James', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Rose', first_name: 'Thomas', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Thompson', first_name: 'Christopher', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  { last_name: 'Velez', first_name: 'Camilo', branch: 'Select - LI Commercial & Residential', supervisor: 'Thomas Roach' },
  // Select (Pavel Canales)
  { last_name: 'Berberena', first_name: 'James', branch: 'Select', supervisor: 'Pavel Canales' },
  { last_name: 'Holiday', first_name: 'Jamar', branch: 'Select', supervisor: 'Pavel Canales' },
  // Select (Kenny Jerez)
  { last_name: 'Brooks', first_name: 'Hernan', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Diaz', first_name: 'Alfonso', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Gager', first_name: 'Melvin', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Garcia', first_name: 'Juan', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Harrison', first_name: 'Floyd', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Johannes', first_name: 'Antonio', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Mackins', first_name: 'Khalif', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Mann', first_name: 'Dasan', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Murry', first_name: 'Conway', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Okafor', first_name: 'Onyemachi', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Outlaw', first_name: 'Jerome', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Quintero', first_name: 'Luis', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Romero', first_name: 'Restituto', branch: 'Select', supervisor: 'Kenny Jerez' },
  { last_name: 'Williams', first_name: 'Dominique', branch: 'Select', supervisor: 'Kenny Jerez' },
  // Select (Kieon Murphy)
  { last_name: 'Anthony', first_name: 'Carlon', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Avila', first_name: 'Joey', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Bagley', first_name: 'Duval', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Banks', first_name: 'Linwood', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Battle', first_name: 'Lamara', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Bautista', first_name: 'Jose', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Castro', first_name: 'Kevin', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Chambers', first_name: 'Andrew', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Fedee', first_name: 'Cletus', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Gruillon', first_name: 'Jesus', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Narine', first_name: 'Andy', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Pascal', first_name: 'Kornel', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Pascal', first_name: 'Kornil', branch: 'Select', supervisor: 'Kieon Murphy' },
  { last_name: 'Simmons', first_name: 'Robert', branch: 'Select', supervisor: 'Kieon Murphy' },
  // Select (Justin Petho)
  { last_name: 'Bailey', first_name: 'Patrick', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Hare', first_name: 'Mario', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Jordan', first_name: 'Ronald', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Martinez', first_name: 'Aquiles', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Mims', first_name: 'Craig', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Minor', first_name: 'Justin', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Rivera', first_name: 'Julian', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Rivera', first_name: 'Antonio', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Thomas', first_name: 'Glenroy', branch: 'Select', supervisor: 'Justin Petho' },
  { last_name: 'Walker', first_name: 'Jamell', branch: 'Select', supervisor: 'Justin Petho' },
  // Amherst (Alex Chase)
  { last_name: 'Ambrose', first_name: 'Pat', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Bomasuto', first_name: 'Vinny', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Braidich', first_name: 'Tessa', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Ferro', first_name: 'Gigi', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Goodwin', first_name: 'Marc', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Mages', first_name: 'Kam', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Pepe', first_name: 'Sam', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Persch', first_name: 'Trevor', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Price', first_name: 'Simon', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Swanson', first_name: 'Rick', branch: 'Amherst', supervisor: 'Alex Chase' },
  { last_name: 'Thorn', first_name: 'Tom', branch: 'Amherst', supervisor: 'Alex Chase' },
  // Suburban (Alex Chase)
  { last_name: 'Bishop', first_name: 'Dan', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Burke', first_name: 'Greg', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Dole', first_name: 'Ron', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Engelhardt', first_name: 'Jimmy', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Franklin', first_name: 'Josh', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Geercken', first_name: 'Tyler', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Marrano', first_name: 'Davin', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Mazurowski', first_name: 'Kyle', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'McEvoy', first_name: 'Ashton', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'McEvoy', first_name: 'Mike', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Metzinger', first_name: 'Brandon', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Moyer', first_name: 'Devin', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Siska', first_name: 'Jared', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Sortisio', first_name: 'Ryan', branch: 'Suburban', supervisor: 'Alex Chase' },
  { last_name: 'Volk', first_name: 'Quinn', branch: 'Suburban', supervisor: 'Alex Chase' },
  // Colony, Metro Pest & Select (Thomas O'Reilly)
  { last_name: 'Davis', first_name: 'Anthony', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Farmer', first_name: 'Jayden', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Hall', first_name: 'Keyon', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Hartnett', first_name: 'Lester', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Inje', first_name: 'Brian', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Juarez', first_name: 'Abel', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Ortiz', first_name: 'Jordan', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Rodriguez', first_name: 'Ernesto', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Watts-Tarver', first_name: 'Jamal', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  { last_name: 'Wright', first_name: 'Tion', branch: 'Colony, Metro Pest & Select', supervisor: 'Thomas O\'Reilly' },
  // Gannon (Jennifer Savastino)
  { last_name: 'Ben-Simone', first_name: 'Nathan', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  { last_name: 'Bialy-Viau', first_name: 'Kristopher', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  { last_name: 'Carr', first_name: 'Peter', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  { last_name: 'Chapin', first_name: 'Joshua', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  { last_name: 'DeBottis', first_name: 'Joseph', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  { last_name: 'Hoige', first_name: 'Fred', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  { last_name: 'O\'Connor', first_name: 'Colin', branch: 'Gannon', supervisor: 'Jennifer Savastino' },
  // Lincoln (Glen Martin)
  { last_name: 'Amaral', first_name: 'Mike', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Beausolieul', first_name: 'James', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Diaz', first_name: 'Kilvi', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Diaz', first_name: 'Robert', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Mitchell', first_name: 'Nat', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Roy', first_name: 'Shannon', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Shaw', first_name: 'Joe', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Snow', first_name: 'Alex', branch: 'Lincoln', supervisor: 'Glen Martin' },
  { last_name: 'Steeves', first_name: 'Jack', branch: 'Lincoln', supervisor: 'Glen Martin' },
  // Metro Pest (Peter Jones)
  { last_name: 'Barthelemy', first_name: 'Dabre', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Betancur', first_name: 'Juan', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Borja', first_name: 'Marco', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Brown', first_name: 'Raheem', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Conyers', first_name: 'Jamel', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Demedina', first_name: 'Herbert', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Henry', first_name: 'Frederick', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Khan', first_name: 'Mohammad', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Leonor', first_name: 'Edward', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Massiah', first_name: 'Onan', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Miranda', first_name: 'Luis', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Mosquera', first_name: 'Andres', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Rhooms', first_name: 'Brandon', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Siguencia', first_name: 'Luis', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  { last_name: 'Singh', first_name: 'Kumar', branch: 'Metro Pest', supervisor: 'Peter Jones' },
  // On The Spot (Matt LaRue)
  { last_name: 'Anderson', first_name: 'Herron', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  { last_name: 'Brewer', first_name: 'Gilbert', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  { last_name: 'Byars', first_name: 'Steven', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  { last_name: 'Joseph', first_name: 'Carlos', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  { last_name: 'Kennedy', first_name: 'Darryl', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  { last_name: 'Meyer', first_name: 'Charles', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  { last_name: 'Pride', first_name: 'Robert', branch: 'On The Spot', supervisor: 'Matt LaRue' },
  // Pestex (Bill Greeley)
  { last_name: 'Calderwood', first_name: 'Jared', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Coyle', first_name: 'James', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Dudley', first_name: 'Byron', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Garneau', first_name: 'Mike', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Gonzalez', first_name: 'Julio', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Hussey', first_name: 'Marty', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Johnson', first_name: 'Lederick', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Lafleur', first_name: 'Ethan', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Latimer', first_name: 'Howard', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Lavallee', first_name: 'Kaylee', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Russell', first_name: 'Kristian', branch: 'Pestex', supervisor: 'Bill Greeley' },
  { last_name: 'Williams', first_name: 'Brian', branch: 'Pestex', supervisor: 'Bill Greeley' },
  // Vermin Control (Mary Swaney)
  { last_name: 'DeVault', first_name: 'Brendan', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Hendrickson', first_name: 'Stephen', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'McKeel', first_name: 'Patrick', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Nara', first_name: 'Ron', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Riley', first_name: 'Robert', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Sabatula', first_name: 'Evan', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Swaney III', first_name: 'Don', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Swaney Sr', first_name: 'Don', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Tewell', first_name: 'Al', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
  { last_name: 'Walkos', first_name: 'Brian', branch: 'Vermin Control', supervisor: 'Mary Swaney' },
];

// Real technician email addresses, keyed by "First Last|Branch|Supervisor".
// Any technician not listed here seeds with email = NULL (see emails-to-fill.csv for the
// pending backfill). Re-running seed() always reconciles technicians.email to match this map.
const technicianEmails = {
  // 'Benjamin Aguilar|Select - LI Commercial & Residential|Thomas Roach': 'baguilar@example.com',
};

async function seed(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS technicians (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name  TEXT NOT NULL,
    branch     TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    email      TEXT,
    UNIQUE(first_name, last_name, branch, supervisor)
  )`);

  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS email TEXT`);

  const { rows: staleCheck } = await pool.query(
    `SELECT 1 FROM chemicals WHERE product_name = 'ADVION Ant Gel' LIMIT 1`
  );
  if (staleCheck.length > 0) {
    await pool.query('DELETE FROM chemicals');
  }
  for (const c of chemicals) {
    if (c.material_code === null) {
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM chemicals WHERE material_code IS NULL AND product_name = $1 AND unit = $2 LIMIT 1`,
        [c.product_name, c.unit]
      );
      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO chemicals (material_code, product_name, unit) VALUES (NULL, $1, $2)`,
          [c.product_name, c.unit]
        );
      }
    } else {
      await pool.query(
        `INSERT INTO chemicals (material_code, product_name, unit)
         VALUES ($1, $2, $3) ON CONFLICT (material_code) DO NOTHING`,
        [c.material_code, c.product_name, c.unit]
      );
    }
  }
  for (const c of contacts) {
    await pool.query(
      `INSERT INTO contacts (last_name, first_name, phone, email, branch, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET branch = EXCLUDED.branch`,
      [c.last_name, c.first_name, c.phone, c.email, c.branch, c.role]
    );
  }
  for (const t of technicians) {
    const key = `${t.first_name} ${t.last_name}|${t.branch}|${t.supervisor}`;
    const email = technicianEmails[key] || null;
    await pool.query(
      `INSERT INTO technicians (first_name, last_name, branch, supervisor, email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (first_name, last_name, branch, supervisor)
       DO UPDATE SET email = EXCLUDED.email`,
      [t.first_name, t.last_name, t.branch, t.supervisor, email]
    );
  }
  console.log(`Seeded ${chemicals.length} chemicals, ${contacts.length} contacts, ${technicians.length} technicians.`);
}

if (require.main === module) {
  seed(db).then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = seed;
}
