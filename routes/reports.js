const router = require('express').Router();
const { query, queryOne } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/reports/students  — students by program (paginated)
router.get('/students', async (req, res) => {
  try {
    const { programId, status, fromDate, toDate, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    let where = '1=1'; const params = [];
    if (programId) { where += ' AND e.ProgramID=?'; params.push(programId); }
    if (status)    { where += ' AND s.Status=?';    params.push(status); }
    if (fromDate)  { where += ' AND s.RegistrationDate>=?'; params.push(fromDate); }
    if (toDate)    { where += ' AND s.RegistrationDate<=?'; params.push(toDate); }
    const [{ total }] = await query(
      `SELECT COUNT(DISTINCT s.StudentID) as total FROM student s
       LEFT JOIN enrollment e ON s.StudentID=e.StudentID LEFT JOIN program p ON e.ProgramID=p.ProgramID
       WHERE ${where}`, params);
    const rows = await query(
      `SELECT s.StudentID, s.FirstName, s.LastName, s.Gender, s.Phone, s.Email, s.Status, s.RegistrationDate,
              p.ProgramName, e.Status as EnrollmentStatus, e.EnrollmentDate
       FROM student s LEFT JOIN enrollment e ON s.StudentID=e.StudentID LEFT JOIN program p ON e.ProgramID=p.ProgramID
       WHERE ${where} ORDER BY s.LastName, s.FirstName LIMIT ${+limit} OFFSET ${offset}`, params);
    res.json({ success: true, data: rows, pagination: { total, page:+page, limit:+limit, totalPages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/reports/payments  — financial report (paginated)
router.get('/payments', async (req, res) => {
  try {
    const { fromDate, toDate, method, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    let where = '1=1'; const params = [];
    if (fromDate) { where += ' AND p.PaymentDate>=?'; params.push(fromDate); }
    if (toDate)   { where += ' AND p.PaymentDate<=?'; params.push(toDate); }
    if (method)   { where += ' AND p.PaymentMethod=?'; params.push(method); }
    const [{ total }] = await query(`SELECT COUNT(*) as total FROM payment p WHERE ${where}`, params);
    const rows = await query(
      `SELECT p.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, s.Email
       FROM payment p JOIN student s ON p.StudentID=s.StudentID WHERE ${where}
       ORDER BY p.PaymentDate DESC LIMIT ${+limit} OFFSET ${offset}`, params);
    const [summary] = await query(
      `SELECT COALESCE(SUM(AmountPaid),0) as totalPaid, COALESCE(SUM(Balance),0) as totalBalance,
              COUNT(*) as transactionCount FROM payment p WHERE ${where}`, params);
    res.json({ success: true, data: rows, summary, pagination: { total, page:+page, limit:+limit, totalPages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/reports/outstanding
router.get('/outstanding', async (req, res) => {
  try {
    const rows = await query(
      `SELECT s.StudentID, CONCAT(s.FirstName,' ',s.LastName) as StudentName, s.Email, s.PhoneNumber,
              p.ProgramName, COALESCE(SUM(pay.Balance),0) as OutstandingBalance, COALESCE(SUM(pay.AmountPaid),0) as TotalPaid
       FROM student s LEFT JOIN enrollment e ON s.StudentID=e.StudentID LEFT JOIN program p ON e.ProgramID=p.ProgramID
       LEFT JOIN payment pay ON s.StudentID=pay.StudentID
       GROUP BY s.StudentID, p.ProgramName HAVING OutstandingBalance > 0 ORDER BY OutstandingBalance DESC`);
    const [summary] = await query('SELECT COALESCE(SUM(Balance),0) as totalOutstanding FROM payment');
    res.json({ success: true, data: rows, summary, total: rows.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/reports/results  — academic performance
router.get('/results', async (req, res) => {
  try {
    const { semesterId, courseId } = req.query;
    let where = '1=1'; const params = [];
    if (semesterId) { where += ' AND r.SemesterID=?'; params.push(semesterId); }
    if (courseId)   { where += ' AND r.CourseID=?';   params.push(courseId); }
    const rows = await query(
      `SELECT r.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, c.CourseName, c.CourseCode, sem.SemesterName
       FROM result r JOIN student s ON r.StudentID=s.StudentID JOIN course c ON r.CourseID=c.CourseID
       LEFT JOIN semester sem ON r.SemesterID=sem.SemesterID WHERE ${where}
       ORDER BY sem.SemesterName, c.CourseName`, params);
    const [stats] = await query(
      `SELECT AVG(FinalGrade) as avgGrade, MAX(FinalGrade) as maxGrade, MIN(FinalGrade) as minGrade,
              SUM(CASE WHEN FinalGrade>=50 THEN 1 ELSE 0 END) as passed, SUM(CASE WHEN FinalGrade<50 THEN 1 ELSE 0 END) as failed
       FROM result r WHERE ${where}`, params);
    res.json({ success: true, data: rows, stats, total: rows.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/reports/interns
router.get('/interns', async (req, res) => {
  try {
    const rows = await query('SELECT *, CASE WHEN InternshipEndDate < CURDATE() THEN "Completed" ELSE "Active" END as InternStatus FROM intern ORDER BY InternshipStartDate DESC');
    const activeCount    = rows.filter(r => r.InternStatus === 'Active').length;
    const completedCount = rows.filter(r => r.InternStatus === 'Completed').length;
    res.json({ success: true, data: rows, summary: { total: rows.length, active: activeCount, completed: completedCount } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
