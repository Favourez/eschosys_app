const router = require('express').Router();
const { query, queryOne } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [students]  = await query('SELECT COUNT(*) as cnt FROM STUDENT');
    const [interns]   = await query('SELECT COUNT(*) as cnt FROM INTERN');
    const [programs]  = await query('SELECT COUNT(*) as cnt FROM PROGRAM');
    const [courses]   = await query('SELECT COUNT(*) as cnt FROM COURSE');
    const [lecturers] = await query('SELECT COUNT(*) as cnt FROM LECTURER');
    const [staff]     = await query('SELECT COUNT(*) as cnt FROM STAFF');
    const revenue     = await queryOne('SELECT COALESCE(SUM(AmountPaid),0) as total FROM PAYMENT');
    const balance     = await queryOne('SELECT COALESCE(SUM(Balance),0) as total FROM PAYMENT');

    res.json({ success: true, data: {
      students:  students.cnt,
      interns:   interns.cnt,
      programs:  programs.cnt,
      courses:   courses.cnt,
      lecturers: lecturers.cnt,
      staff:     staff.cnt,
      totalRevenue:       parseFloat(revenue.total),
      outstandingBalance: parseFloat(balance.total),
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/dashboard/enrollment-trend
router.get('/enrollment-trend', async (req, res) => {
  try {
    const rows = await query(`
      SELECT DATE_FORMAT(EnrollmentDate,'%Y-%m') as month, COUNT(*) as count
      FROM ENROLLMENT
      WHERE EnrollmentDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month ASC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/dashboard/revenue-trend
router.get('/revenue-trend', async (req, res) => {
  try {
    const rows = await query(`
      SELECT DATE_FORMAT(PaymentDate,'%Y-%m') as month, SUM(AmountPaid) as total
      FROM PAYMENT
      WHERE PaymentDate >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month ASC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/dashboard/program-distribution
router.get('/program-distribution', async (req, res) => {
  try {
    const rows = await query(`
      SELECT p.ProgramName, COUNT(e.StudentID) as count
      FROM PROGRAM p LEFT JOIN ENROLLMENT e ON p.ProgramID = e.ProgramID
      GROUP BY p.ProgramID, p.ProgramName ORDER BY count DESC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/dashboard/recent-students
router.get('/recent-students', async (req, res) => {
  try {
    const rows = await query('SELECT StudentID, FirstName, LastName, Email, RegistrationDate FROM STUDENT ORDER BY RegistrationDate DESC LIMIT 8');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/dashboard/recent-payments
router.get('/recent-payments', async (req, res) => {
  try {
    const rows = await query(`
      SELECT p.PaymentID, p.ReceiptNumber, p.AmountPaid, p.PaymentDate, p.PaymentMethod,
             CONCAT(s.FirstName,' ',s.LastName) as StudentName
      FROM PAYMENT p JOIN STUDENT s ON p.StudentID = s.StudentID
      ORDER BY p.PaymentDate DESC LIMIT 8`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/dashboard/gender-distribution
router.get('/gender-distribution', async (req, res) => {
  try {
    const rows = await query('SELECT Gender, COUNT(*) as count FROM STUDENT GROUP BY Gender');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
