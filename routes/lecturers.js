const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const search = req.query.search?.trim() || '';
    let where = '1=1'; const params = [];
    if (search) { where += ' AND (FullName LIKE ? OR Email LIKE ? OR Specialization LIKE ?)'; const q=`%${search}%`; params.push(q,q,q); }
    const rows = await query(`SELECT l.*, COUNT(DISTINCT ca.CourseID) as CourseCount FROM lecturer l LEFT JOIN course_assignment ca ON l.LecturerID=ca.LecturerID WHERE ${where} GROUP BY l.LecturerID ORDER BY l.FullName`, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const lec = await queryOne('SELECT * FROM lecturer WHERE LecturerID = ?', [req.params.id]);
    if (!lec) return res.status(404).json({ success: false, message: 'Lecturer not found.' });
    const courses = await query(`SELECT c.*, sem.SemesterName FROM course c JOIN course_assignment ca ON c.CourseID=ca.CourseID LEFT JOIN semester sem ON ca.SemesterID=sem.SemesterID WHERE ca.LecturerID=?`, [req.params.id]);
    res.json({ success: true, data: { ...lec, courses } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('Administrator'), async (req, res) => {
  try {
    const { FullName, Phone, Email, Qualification, Specialization } = req.body;
    if (!FullName) return res.status(400).json({ success: false, message: 'Full name is required.' });
    const r = await execute('INSERT INTO lecturer (FullName,Phone,Email,Qualification,Specialization) VALUES (?,?,?,?,?)', [FullName, Phone||null, Email||null, Qualification||null, Specialization||null]);
    res.status(201).json({ success: true, message: 'Lecturer added.', data: await queryOne('SELECT * FROM lecturer WHERE LecturerID=?', [r.insertId]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const { FullName, Phone, Email, Qualification, Specialization } = req.body;
    await execute('UPDATE lecturer SET FullName=?,Phone=?,Email=?,Qualification=?,Specialization=? WHERE LecturerID=?', [FullName, Phone||null, Email||null, Qualification||null, Specialization||null, req.params.id]);
    res.json({ success: true, message: 'Lecturer updated.', data: await queryOne('SELECT * FROM lecturer WHERE LecturerID=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM lecturer WHERE LecturerID = ?', [req.params.id]);
    res.json({ success: true, message: 'Lecturer deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Assign lecturer to course
router.post('/:id/assign-course', authorize('Administrator'), async (req, res) => {
  try {
    const { CourseID, SemesterID } = req.body;
    await execute('INSERT IGNORE INTO course_assignment (LecturerID,CourseID,SemesterID) VALUES (?,?,?)', [req.params.id, CourseID, SemesterID||null]);
    res.json({ success: true, message: 'Course assigned to lecturer.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
