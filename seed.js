const db = require.main === module ? require('./db') : null;

// CHEMICALS — edit this array to add/remove chemicals
// Each entry: material_code, product_name, epa_registration, replacement_product
const chemicals = [
  { material_code: 'ADVION Ant Gel', product_name: 'ADVION Ant Gel', epa_registration: '100-1498', replacement_product: '' },
  { material_code: 'ADVION Cockroach Gel Bait', product_name: 'ADVION Cockroach Gel Bait', epa_registration: '100-1484', replacement_product: '' },
  { material_code: 'ALLURE MATING DISRUPTION SYS', product_name: 'Allure Mating Disruption For Stored Product Moths', epa_registration: '73813-3-499', replacement_product: '' },
  { material_code: 'ALPINE FLY BAIT', product_name: 'PT ALPINE Pressurized Insecticide', epa_registration: '499-568', replacement_product: '' },
  { material_code: 'ALPINE WSG (Limited Outdoor Application In NY)', product_name: 'ALPINE Water Soluble Granule Insecticide', epa_registration: '499-561', replacement_product: '' },
  { material_code: 'APREHEND', product_name: 'APREHEND', epa_registration: '89186-1', replacement_product: '' },
  { material_code: 'BACAZAP', product_name: 'BACAZAP Bio-Sanitation Liquid', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'BIFEN I/T', product_name: 'BIFEN I/T', epa_registration: '53883-118', replacement_product: '' },
  { material_code: 'BIFEN L/P', product_name: 'BIFEN L/P Insecticide Granules', epa_registration: '53883-124', replacement_product: '' },
  { material_code: 'BP-100', product_name: 'ULD BP-100 II', epa_registration: '1021-2838', replacement_product: '' },
  { material_code: 'BP-300', product_name: 'ULD BP-300 II', epa_registration: '1021-2841', replacement_product: '' },
  { material_code: 'CIDETRAK IMM DISRUPTION SYS', product_name: 'Cidetrak Indian Meal Moth Mating Disruption System', epa_registration: '51934-9', replacement_product: '' },
  { material_code: 'CIDETRAK IMM MEC', product_name: 'Cidetrak IMM MME Mating Disruption Formulation', epa_registration: '51934-22', replacement_product: '' },
  { material_code: 'CIMEXA', product_name: 'Cimexa Insecticide Dust', epa_registration: '73079-12', replacement_product: '' },
  { material_code: 'CO2 RODENT BURROW TREATMENT', product_name: 'IGI Carbon Dioxide', epa_registration: '7173-313', replacement_product: '' },
  { material_code: 'CONTRAC All-Weather Blox', product_name: 'CONTRAC All-Weather Blox', epa_registration: '12455-79', replacement_product: '' },
  { material_code: 'CONTRAC Pellets', product_name: 'CONTRAC Pellets', epa_registration: '12455-69', replacement_product: '' },
  { material_code: 'CONTRAC SOFT BAIT', product_name: 'CONTRAC SOFT BAIT', epa_registration: '12455-146', replacement_product: '' },
  { material_code: 'CROSSFIRE', product_name: 'CROSSFIRE Bed Bug Concentrate', epa_registration: '1021-2776', replacement_product: '' },
  { material_code: 'CROSSFIRE AEROSOL', product_name: 'CROSSFIRE Aerosol', epa_registration: '1021-2788', replacement_product: '' },
  { material_code: 'DETEX BLOX', product_name: 'DETEX BLOX', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'DETEX SOFT BAIT', product_name: 'DETEX SOFT BAIT', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'D-FENSE DUST', product_name: 'D-FENSE DUST Insecticide', epa_registration: '53883-283', replacement_product: '' },
  { material_code: 'D-FENSE NXT', product_name: 'D-Fense NXT Aerosol', epa_registration: '53883-415', replacement_product: '' },
  { material_code: 'DITRAC', product_name: 'DITRAC Tracking Powder', epa_registration: '12455-56', replacement_product: '' },
  { material_code: 'DOXEM NXT', product_name: 'DOXEM NXT Aerosol', epa_registration: '53883-455', replacement_product: '' },
  { material_code: 'DOXEM PRECISE', product_name: 'Doxem Precise Insecticide', epa_registration: '53883-438', replacement_product: '' },
  { material_code: 'DSV', product_name: 'Nisus DSV', epa_registration: '10324-80-64405', replacement_product: '' },
  { material_code: 'EcoPCO ACU', product_name: 'EcoPCO ACU', epa_registration: '89459-59', replacement_product: '' },
  { material_code: 'EcoPCO AR*X', product_name: 'EcoPCO AR*X', epa_registration: '89459-60', replacement_product: '' },
  { material_code: 'ECOVIA CA 25B EXEMPT', product_name: 'Eco Via CA 25B Exempt Contact Insecticide', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'ECOVIA EC', product_name: 'Eco Via EC Emulsifiable Concentrate 25B EXEMPT', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'ECOVIA G', product_name: 'Eco Via G Granular Insecticide 25B EXEMPT', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'ESSENTRIA G', product_name: 'ESSENTRIA GRANULAR INSECTICIDE', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'ESSENTRIA IC-PRO', product_name: 'ESSENTRIA IC-PRO CONCENTRATE', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'EXCITER', product_name: 'EXCITER', epa_registration: '89459-41', replacement_product: '' },
  { material_code: 'FIRST STRIKE SOFT BAIT', product_name: 'FIRST STRIKE SOFT BAIT', epa_registration: '7173-258', replacement_product: '' },
  { material_code: 'FLY WEB FRUIT FLY SPRAY CONCENTRATE', product_name: 'Fly Web Fruit Fly Spray Concentrate', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'FOAM FRESH', product_name: 'FOAM FRESH Bio-Sanitation Foam', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'FW-590T FRUIT FLY SPRAY 25B', product_name: 'FLYWEB FRUIT FLY SPRAY - READY TO USE 25B EXEMPT', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'GENTROL POINT SOURCE', product_name: 'Gentrol Point Source', epa_registration: '2724-469', replacement_product: '' },
  { material_code: 'HOT SPOT AEROSOL', product_name: 'INVADE HOT SPOT', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'INDIAN MEAL MOTH SUPPRESSION', product_name: 'Insects Limited Moth Suppression Traps', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'INTICE 10 Granular Bait', product_name: 'INTICE 10 Granular Bait', epa_registration: '73079-6', replacement_product: '' },
  { material_code: 'INVADE BIO FOAM', product_name: 'INVADE BIO FOAM', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'MAXFORCE COMPLETE', product_name: 'MAXFORCE COMPLETE BRAND Granular Insect Bait', epa_registration: '101563-45', replacement_product: '' },
  { material_code: 'MAXFORCE FC Ant Killer Bait St', product_name: 'MAXFORCE FC Ant Killer Bait Stations', epa_registration: '101563-46', replacement_product: '' },
  { material_code: 'MAXFORCE FC MAGNUM', product_name: 'MAXFORCE FC MAGNUM Roach Killer Bait Gel', epa_registration: '101563-122', replacement_product: '' },
  { material_code: 'MAXFORCE FC Roach Bait Stations', product_name: 'MAXFORCE Roach Bait Stations - Small', epa_registration: '101563-47', replacement_product: '' },
  { material_code: 'MAXFORCE FLY SPOT BAIT', product_name: 'MAXFORCE Fly Spot Bait', epa_registration: '101563-119', replacement_product: '' },
  { material_code: 'MAXFORCE GRANULAR FLY BAIT', product_name: 'MAXFORCE Granular Fly Bait', epa_registration: '101563-94', replacement_product: '' },
  { material_code: 'MOSQUITO DUNKS', product_name: 'MOSQUITO DUNKS', epa_registration: '6218-47', replacement_product: '' },
  { material_code: 'NATURAL CATCH PLUS FRUIT FLY TRAP', product_name: 'NATURAL CATCH PLUS FRUIT FLY TRAP', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'NIBAN Granular Bait', product_name: 'NIBAN Granular Bait', epa_registration: '64405-2', replacement_product: '' },
  { material_code: 'NIBOR-D', product_name: 'Nibor-D Insecticide', epa_registration: '64405-8', replacement_product: '' },
  { material_code: 'NIBOR-D INSECTICIDE FOAM + IGR', product_name: 'Nibor-D Insecticide + IGR', epa_registration: '64405-37', replacement_product: '' },
  { material_code: 'NUVAN PROSTRIPS', product_name: 'Nuvan Prostrips', epa_registration: '5481-553', replacement_product: '' },
  { material_code: 'NYGUARD IGR', product_name: 'NyGuard IGR Concentrate', epa_registration: '1021-1603', replacement_product: '' },
  { material_code: 'ONEGUARD', product_name: 'OneGuard Multi MoA Concentrate', epa_registration: '1021-2807', replacement_product: '' },
  { material_code: 'PRO-PELL MICE & RAT REPELLENT', product_name: 'PRO-PELL MICE & RAT REPELLENT', epa_registration: '25(b) EXEMPT', replacement_product: '' },
  { material_code: 'PT 4', product_name: 'PT 4 INDIAN MEAL MOTH TRAP', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'PT PRO-CONTROL PLUS FOGGER', product_name: 'PT PRO-CONTROL PLUS FOGGER', epa_registration: '499-462', replacement_product: '' },
  { material_code: 'PT ULTRACIDE Pressurized Flea IGR', product_name: 'ULTRACIDE Pressurized Flea IGR', epa_registration: '499-404', replacement_product: '' },
  { material_code: 'RECRUIT HD', product_name: 'RECRUIT HD', epa_registration: '62719-608', replacement_product: '' },
  { material_code: 'RECRUIT IV AG', product_name: 'RECRUIT IV AG TERMITE BAIT', epa_registration: '62719-454', replacement_product: '' },
  { material_code: 'SHOCKWAVE 1', product_name: 'Shockwave 1 Flushing, Killing & Residual Aerosol', epa_registration: '1021-2804', replacement_product: '' },
  { material_code: 'SHOCKWAVE FOGGING CONCENTRATE', product_name: 'SHOCKWAVE Fogging Concentrate', epa_registration: '1021-1810', replacement_product: '' },
  { material_code: 'STERI-FAB', product_name: 'STERI-FAB', epa_registration: '397-13', replacement_product: '' },
  { material_code: 'STRYKER 54', product_name: 'STRYKER 54', epa_registration: '53883-329', replacement_product: '' },
  { material_code: 'STRYKER WASP & HORNET KILLER', product_name: 'STRYKER WASP AND HORNET KILLER', epa_registration: '53883-384', replacement_product: '' },
  { material_code: 'SUSPEND SC', product_name: 'SUSPEND SC', epa_registration: '432-763', replacement_product: '' },
  { material_code: 'TALPRID', product_name: 'TALPRID', epa_registration: '12455-101', replacement_product: '' },
  { material_code: 'TALSTAR P', product_name: 'Talstar Pro', epa_registration: '279-3206', replacement_product: '' },
  { material_code: 'TAURUS SC-NY', product_name: 'TAURUS SC-NY Insecticide', epa_registration: '53883-279', replacement_product: '' },
  { material_code: 'TEKKO PRO', product_name: 'TEKKO PRO Insect Growth Regulator', epa_registration: '53883-335', replacement_product: '' },
  { material_code: 'TEMPO 1% DUST', product_name: 'TEMPO 1% DUST', epa_registration: '101563-93', replacement_product: '' },
  { material_code: 'TEMPRID FX', product_name: 'Temprid FX Insecticide', epa_registration: '432-1544', replacement_product: '' },
  { material_code: 'TERMIDOR FOAM', product_name: 'TERMIDOR FOAM', epa_registration: '499-563', replacement_product: '' },
  { material_code: 'TRANSPORT MIKRON', product_name: 'TRANSPORT Mikron Insecticide', epa_registration: '8033-109-279', replacement_product: '' },
  { material_code: 'VENDETTA NITRO', product_name: 'Vendetta Nitro Cockroach Gel Bait', epa_registration: '1021-2796', replacement_product: '' },
  { material_code: 'VENDETTA PLUS', product_name: 'Vendetta Plus Cockroach Gel Bait', epa_registration: '1021-2593', replacement_product: '' },
  { material_code: 'XLURE COMBO 4', product_name: 'XLure Ready To Use Diamond Traps For IMM & Beetles', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'XLURE FLOOR TRAP', product_name: 'XLure Multi Species Beetle Floor Trap & Cartridge', epa_registration: 'N/A', replacement_product: '' },
  { material_code: 'ZP Tracking Powder', product_name: 'ZP Tracking Powder', epa_registration: '12455-16', replacement_product: '' },
];

// CONTACTS — edit this array to add/remove contacts (supervisors, managers, etc.)
// Each entry: last_name, first_name, phone, email, branch, role
const contacts = [
  { last_name: 'Chase', first_name: 'Alex', phone: '(401) 349-9030', email: 'achase@suburbanpestcontrollc.com', branch: 'Amherst & Suburban', role: 'Branch Manager' },
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
];

// LOCATIONS — add here when location sheet is received
// const locations = [
//   { name: 'Warehouse 1', address: '...' },
// ];

function seed(db) {
  db.serialize(() => {
    const chemStmt = db.prepare(
      `INSERT OR IGNORE INTO chemicals (material_code, product_name, epa_registration, replacement_product)
       VALUES (?, ?, ?, ?)`
    );
    chemicals.forEach(c => {
      chemStmt.run(c.material_code, c.product_name, c.epa_registration, c.replacement_product);
    });
    chemStmt.finalize();

    const contactStmt = db.prepare(
      `INSERT OR IGNORE INTO contacts (last_name, first_name, phone, email, branch, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    contacts.forEach(c => {
      contactStmt.run(c.last_name, c.first_name, c.phone, c.email, c.branch, c.role);
    });
    contactStmt.finalize(() => {
      console.log(`Seeded ${chemicals.length} chemicals and ${contacts.length} contacts.`);
    });
  });
}

// Run directly via `node seed.js`
if (require.main === module) {
  seed(db);
  setTimeout(() => db.close(), 1000);
} else {
  module.exports = seed;
}
