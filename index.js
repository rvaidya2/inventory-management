require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();

const db = require('./db');
const seed = require('./seed');
const technicianRoutes = require('./routes/technician');
const supervisorRoutes = require('./routes/supervisor');
const vendorRoutes = require('./routes/vendor');
const apiRoutes = require('./routes/api');

seed(db);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use('/api', apiRoutes);
app.use('/', technicianRoutes);
app.use('/supervisor', supervisorRoutes);
app.use('/vendor', express.urlencoded({ extended: true }), vendorRoutes);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
