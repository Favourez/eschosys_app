const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

function calcGrade(final) {
  if (final >= 90) return 'A+'; if (final >= 80) return 'A';
  if (final >= 75) return 'B+'; if (final >= 70) return 'B';
  if (final >= 65) return 'C+'; if (final >= 60) return 'C';
  if (final >= 50) return 'D';  return 'F';
}

// GET /api/results
router.get('/', async (req, res) => {
  try {
    const { studentId, courseId, semesterId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = '1=1'; const params = [];
    if (studentId)  { where += ' AND r.StudentID=?';  params.push(studentId); }
    if (courseId)   { where += ' AND r.CourseID=?';   params.push(courseId); }
    if (semesterId) { where += ' AND r.SemesterID=?'; params.push(semesterId); }

    const [{ total }] = await query(`SELECT COUNT(*) as total FROM result r WHERE ${where}`, params);
    const rows = await query(
      `SELECT r.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, c.CourseName, c.CourseCode, sem.SemesterName
       FROM result r JOIN student s ON r.StudentID=s.StudentID JOIN course c ON r.CourseID=c.CourseID
       LEFT JOIN semester sem ON r.SemesterID=sem.SemesterID WHERE ${where}
       ORDER BY r.SemesterID, c.CourseName LIMIT ${limit} OFFSET ${offset}`, params);
    res.json({ success: true, data: rows, pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/results/transcript/:studentId
router.get('/transcript/:studentId', async (req, res) => {
  try {
    const student = await queryOne('SELECT s.*, p.ProgramName FROM student s LEFT JOIN enrollment e ON s.StudentID=e.StudentID LEFT JOIN program p ON e.ProgramID=p.ProgramID WHERE s.StudentID=? LIMIT 1', [req.params.studentId]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    const results = await query(
      `SELECT r.*, c.CourseName, c.CourseCode, c.CreditValue, sem.SemesterName, sem.AcademicYear
       FROM result r JOIN course c ON r.CourseID=c.CourseID LEFT JOIN semester sem ON r.SemesterID=sem.SemesterID
       WHERE r.StudentID=? ORDER BY sem.StartDate, c.CourseName`, [req.params.studentId]);
    const gpa = results.length ? results.reduce((s,r) => s + parseFloat(r.FinalGrade||0), 0) / results.length : 0;
    res.json({ success: true, data: { student, results, gpa: gpa.toFixed(2) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/results
router.post('/', authorize('Administrator','Lecturer'), async (req, res) => {
  try {
    const { StudentID, CourseID, SemesterID, CAGrade, ExamGrade } = req.body;
    if (!StudentID || !CourseID) return res.status(400).json({ success: false, message: 'Student and course are required.' });
    const ca    = Math.min(30,  parseFloat(CAGrade)   || 0);
    const exam  = Math.min(70,  parseFloat(ExamGrade) || 0);
    const final = parseFloat((ca + exam).toFixed(2)); // CA/30 + Exam/70 = /100

    const existing = await queryOne('SELECT ResultID FROM result WHERE StudentID=? AND CourseID=? AND SemesterID=?', [StudentID, CourseID, SemesterID||null]);
    if (existing) {
      await execute('UPDATE result SET CAGrade=?,ExamGrade=?,FinalGrade=? WHERE ResultID=?', [ca, exam, final, existing.ResultID]);
      return res.json({ success: true, message: 'Result updated.', data: { CAGrade: ca, ExamGrade: exam, FinalGrade: final, grade: calcGrade(final) } });
    }
    const r = await execute('INSERT INTO result (StudentID,CourseID,SemesterID,CAGrade,ExamGrade,FinalGrade) VALUES (?,?,?,?,?,?)', [StudentID, CourseID, SemesterID||null, ca, exam, final]);
    res.status(201).json({ success: true, message: 'Result recorded.', data: { ResultID: r.insertId, FinalGrade: final, grade: calcGrade(final) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/results/:id
router.put('/:id', authorize('Administrator','Lecturer'), async (req, res) => {
  try {
    const { CAGrade, ExamGrade } = req.body;
    const ca = Math.min(30, parseFloat(CAGrade)||0);
    const exam = Math.min(70, parseFloat(ExamGrade)||0);
    const final = parseFloat((ca + exam).toFixed(2));
    await execute('UPDATE result SET CAGrade=?,ExamGrade=?,FinalGrade=? WHERE ResultID=?', [ca, exam, final, req.params.id]);
    res.json({ success: true, message: 'Result updated.', data: { FinalGrade: final, grade: calcGrade(final) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/results/:id
router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM result WHERE ResultID = ?', [req.params.id]);
    res.json({ success: true, message: 'Result deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
