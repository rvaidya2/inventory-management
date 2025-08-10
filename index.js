const express = require('express');
const path = require('path');
const app = express();

// Load route modules
const technicianRoutes = require('./routes/technician');
const supervisorRoutes = require('./routes/supervisor');
const vendorRoutes = require('./routes/vendor');

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use('/', technicianRoutes);
app.use('/supervisor', supervisorRoutes);
app.use('/vendor', express.urlencoded({ extended: true }), vendorRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

