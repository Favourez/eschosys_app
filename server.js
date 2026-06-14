require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const { setupAdditionalTables } = require('./config/database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'] }));

// ── Body Parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate Limiting ─────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many login attempts. Try again later.' } }));
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 300 }));

// ── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/students',     require('./routes/students'));
app.use('/api/interns',      require('./routes/interns'));
app.use('/api/programs',     require('./routes/programs'));
app.use('/api/courses',      require('./routes/courses'));
app.use('/api/lecturers',    require('./routes/lecturers'));
app.use('/api/staff',        require('./routes/staff'));
app.use('/api/payments',         require('./routes/payments'));
app.use('/api/intern-payments',  require('./routes/intern-payments'));
app.use('/api/results',      require('./routes/results'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/enrollment',   require('./routes/enrollment'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/search',       require('./routes/search'));
app.use('/api/files',        require('./routes/files'));
app.use('/api/notifications',require('./routes/notifications'));

// ── SPA Fallback ─────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ── Start Server ──────────────────────────────────────────────
async function start() {
  try {
    await setupAdditionalTables();
    app.listen(PORT, () => {
      console.log(`\n🎓 ESIMS Server running → http://localhost:${PORT}`);
      console.log(`📦 Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
