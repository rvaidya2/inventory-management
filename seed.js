const db = require('./db');

// CHEMICALS — edit this array to add/remove chemicals
// Each entry: material_code, product_name, epa_registration, replacement_product
const chemicals = [
  {
    material_code: 'MAT001',
    product_name: 'Example Chemical A',
    epa_registration: '1234-567',
    replacement_product: 'Example Chemical B'
  },
  // Copy the block above and paste a new one for each additional chemical
];

// CONTACTS — edit this array to add/remove contacts (supervisors, managers, etc.)
// Each entry: last_name, first_name, phone, email, branch, role
const contacts = [
  {
    last_name: 'Smith',
    first_name: 'John',
    phone: '555-1234',
    email: 'jsmith@example.com',
    branch: 'Miami',
    role: 'Branch Manager'
  },
  // Copy the block above and paste a new one for each additional contact
];

// LOCATIONS — add here when location sheet is received
// const locations = [
//   { name: 'Warehouse 1', address: '...' },
// ];

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
    db.close();
  });
});
