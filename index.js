const express = require('express');
const path = require('path');
const bodyparser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
if (fs.existsSync('./config.env')) {
  dotenv.config({ path: './config.env' });
}

// Database Connection
const connectDB = require('./config/db');
connectDB();

// Passport Config
const passport = require('./config/passport');

const app = express();

// View Engine & Static Files Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Body Parser Middleware
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.json());

// Session Middleware
app.use(session({
  secret: "Node",
  resave: true,
  saveUninitialized: true,
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Global Locals Middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Register Routes
app.use('/', authRoutes);
app.use('/', productRoutes);
app.use('/', cartRoutes);
app.use('/', orderRoutes);
app.use('/', adminRoutes);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
