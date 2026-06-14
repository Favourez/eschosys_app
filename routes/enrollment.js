const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', studentId = '', programId = '', status = '' } = req.query;
    const offset = (page - 1) * limit;
    let where = '1=1'; const params = [];
    if (search)    { where += ' AND (s.FirstName LIKE ? OR s.LastName LIKE ?)'; const q=`%${search}%`; params.push(q,q); }
    if (studentId) { where += ' AND e.StudentID=?'; params.push(studentId); }
    if (programId) { where += ' AND e.ProgramID=?';  params.push(programId); }
    if (status)    { where += ' AND e.Status=?';     params.push(status); }

    const [{ total }] = await query(
      `SELECT COUNT(*) as total FROM ENROLLMENT e JOIN STUDENT s ON e.StudentID=s.StudentID WHERE ${where}`, params);
    const rows = await query(
      `SELECT e.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, s.Email, p.ProgramName, sem.SemesterName
       FROM ENROLLMENT e JOIN STUDENT s ON e.StudentID=s.StudentID
       LEFT JOIN PROGRAM p ON e.ProgramID=p.ProgramID
       LEFT JOIN SEMESTER sem ON e.SemesterID=sem.SemesterID WHERE ${where}
       ORDER BY e.EnrollmentDate DESC LIMIT ${+limit} OFFSET ${offset}`, params);
    res.json({ success: true, data: rows, pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const { StudentID, ProgramID, SemesterID, Semester, Level, Exam, EnrollmentDate, Status } = req.body;
    if (!StudentID || !ProgramID) return res.status(400).json({ success: false, message: 'Student and program are required.' });
    const existing = await queryOne('SELECT EnrollmentID FROM ENROLLMENT WHERE StudentID=? AND ProgramID=?', [StudentID, ProgramID]);
    if (existing) return res.status(400).json({ success: false, message: 'Student is already enrolled in this program.' });
    const r = await execute(
      'INSERT INTO ENROLLMENT (StudentID,ProgramID,SemesterID,Semester,Level,Exam,EnrollmentDate,Status) VALUES (?,?,?,?,?,?,?,?)',
      [StudentID, ProgramID, SemesterID||null, Semester||null, Level||null, Exam||null,
       EnrollmentDate||new Date().toISOString().split('T')[0], Status||'Active']);
    res.status(201).json({ success: true, message: 'Student enrolled successfully.', data: { EnrollmentID: r.insertId } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const { Status, SemesterID, Semester, Level, Exam } = req.body;
    await execute(
      'UPDATE ENROLLMENT SET Status=?,SemesterID=?,Semester=?,Level=?,Exam=? WHERE EnrollmentID=?',
      [Status, SemesterID||null, Semester||null, Level||null, Exam||null, req.params.id]);
    res.json({ success: true, message: 'Enrollment updated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM ENROLLMENT WHERE EnrollmentID = ?', [req.params.id]);
    res.json({ success: true, message: 'Enrollment removed.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
