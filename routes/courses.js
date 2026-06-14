const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const rows = await query(`SELECT c.*, GROUP_CONCAT(p.ProgramName SEPARATOR ', ') as Programs
      FROM course c LEFT JOIN program_course pc ON c.CourseID = pc.CourseID
      LEFT JOIN program p ON pc.ProgramID = p.ProgramID
      GROUP BY c.CourseID ORDER BY c.CourseName`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const course = await queryOne('SELECT * FROM course WHERE CourseID = ?', [req.params.id]);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });
    const programs  = await query('SELECT p.* FROM program p JOIN program_course pc ON p.ProgramID=pc.ProgramID WHERE pc.CourseID=?', [req.params.id]);
    const lecturers = await query('SELECT l.*, sem.SemesterName FROM lecturer l JOIN course_assignment ca ON l.LecturerID=ca.LecturerID LEFT JOIN semester sem ON ca.SemesterID=sem.SemesterID WHERE ca.CourseID=?', [req.params.id]);
    res.json({ success: true, data: { ...course, programs, lecturers } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('Administrator'), async (req, res) => {
  try {
    const { CourseCode, CourseName, CreditValue, Description } = req.body;
    if (!CourseName || !CourseCode) return res.status(400).json({ success: false, message: 'Course code and name are required.' });
    const r = await execute('INSERT INTO course (CourseCode,CourseName,CreditValue,Description) VALUES (?,?,?,?)', [CourseCode, CourseName, CreditValue||3, Description||null]);
    res.status(201).json({ success: true, message: 'Course created.', data: await queryOne('SELECT * FROM course WHERE CourseID=?', [r.insertId]) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Course code already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const { CourseCode, CourseName, CreditValue, Description } = req.body;
    await execute('UPDATE course SET CourseCode=?,CourseName=?,CreditValue=?,Description=? WHERE CourseID=?', [CourseCode, CourseName, CreditValue||3, Description||null, req.params.id]);
    res.json({ success: true, message: 'Course updated.', data: await queryOne('SELECT * FROM course WHERE CourseID=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM course WHERE CourseID = ?', [req.params.id]);
    res.json({ success: true, message: 'Course deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Assign course to program
router.post('/:id/assign-program', authorize('Administrator'), async (req, res) => {
  try {
    const { ProgramID } = req.body;
    await execute('INSERT IGNORE INTO program_course (ProgramID,CourseID) VALUES (?,?)', [ProgramID, req.params.id]);
    res.json({ success: true, message: 'Course assigned to program.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
