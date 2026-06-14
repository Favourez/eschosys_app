const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT p.*, COUNT(DISTINCT e.StudentID) as EnrolledCount FROM program p LEFT JOIN enrollment e ON p.ProgramID = e.ProgramID GROUP BY p.ProgramID ORDER BY p.ProgramName');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const program = await queryOne('SELECT * FROM program WHERE ProgramID = ?', [req.params.id]);
    if (!program) return res.status(404).json({ success: false, message: 'Program not found.' });
    const courses  = await query(`SELECT c.* FROM course c JOIN program_course pc ON c.CourseID = pc.CourseID WHERE pc.ProgramID = ?`, [req.params.id]);
    const students = await query(`SELECT s.StudentID, s.FirstName, s.LastName, s.Email, e.EnrollmentDate, e.Status
      FROM student s JOIN enrollment e ON s.StudentID = e.StudentID WHERE e.ProgramID = ?`, [req.params.id]);
    res.json({ success: true, data: { ...program, courses, students } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('Administrator'), async (req, res) => {
  try {
    const { ProgramName, Duration, TuitionFee, Description } = req.body;
    if (!ProgramName) return res.status(400).json({ success: false, message: 'Program name is required.' });
    const r = await execute('INSERT INTO program (ProgramName,Duration,TuitionFee,Description) VALUES (?,?,?,?)', [ProgramName, Duration||null, TuitionFee||0, Description||null]);
    const prog = await queryOne('SELECT * FROM program WHERE ProgramID = ?', [r.insertId]);
    res.status(201).json({ success: true, message: 'Program created.', data: prog });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const { ProgramName, Duration, TuitionFee, Description } = req.body;
    await execute('UPDATE program SET ProgramName=?,Duration=?,TuitionFee=?,Description=? WHERE ProgramID=?', [ProgramName, Duration||null, TuitionFee||0, Description||null, req.params.id]);
    res.json({ success: true, message: 'Program updated.', data: await queryOne('SELECT * FROM program WHERE ProgramID=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM program WHERE ProgramID = ?', [req.params.id]);
    res.json({ success: true, message: 'Program deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
