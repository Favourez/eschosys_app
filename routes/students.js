const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/students  (list with search & pagination)
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const gender = req.query.gender || '';
    const programId = req.query.program || '';

    let where = '1=1'; const params = [];
    if (search) {
      where += ` AND (s.FirstName LIKE ? OR s.LastName LIKE ? OR s.StudentID LIKE ? OR s.Email LIKE ? OR s.PhoneNumber LIKE ?)`;
      const q = `%${search}%`;
      params.push(q, q, q, q, q);
    }
    if (gender)    { where += ' AND s.Gender = ?';    params.push(gender); }
    if (programId) { where += ' AND e.ProgramID = ?'; params.push(programId); }

    const joinClause = programId ? 'LEFT JOIN ENROLLMENT e ON s.StudentID = e.StudentID' : 'LEFT JOIN ENROLLMENT e ON s.StudentID = e.StudentID';
    const baseSql = `FROM STUDENT s ${joinClause} LEFT JOIN PROGRAM p ON e.ProgramID = p.ProgramID WHERE ${where}`;

    const [{ total }] = await query(`SELECT COUNT(DISTINCT s.StudentID) as total ${baseSql}`, params);
    const rows = await query(`SELECT DISTINCT s.*, p.ProgramName ${baseSql} ORDER BY s.RegistrationDate DESC LIMIT ${limit} OFFSET ${offset}`, params);

    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/students/:id  (full profile)
router.get('/:id', async (req, res) => {
  try {
    const student = await queryOne('SELECT * FROM STUDENT WHERE StudentID = ?', [req.params.id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const [enrollments, payments, results, certificates, files] = await Promise.all([
      query(`SELECT e.*, p.ProgramName, sem.SemesterName FROM ENROLLMENT e
             JOIN PROGRAM p ON e.ProgramID = p.ProgramID
             LEFT JOIN SEMESTER sem ON e.SemesterID = sem.SemesterID
             WHERE e.StudentID = ? ORDER BY e.EnrollmentDate DESC`, [req.params.id]),
      query('SELECT * FROM PAYMENT WHERE StudentID = ? ORDER BY PaymentDate DESC', [req.params.id]),
      query(`SELECT r.*, c.CourseName, c.CourseCode, sem.SemesterName FROM RESULT r
             JOIN COURSE c ON r.CourseID = c.CourseID
             LEFT JOIN SEMESTER sem ON r.SemesterID = sem.SemesterID
             WHERE r.StudentID = ? ORDER BY r.SemesterID`, [req.params.id]),
      query(`SELECT cert.*, p.ProgramName FROM CERTIFICATE cert
             LEFT JOIN PROGRAM p ON cert.ProgramID = p.ProgramID
             WHERE cert.StudentID = ?`, [req.params.id]),
      query('SELECT * FROM file_uploads WHERE StudentID = ? ORDER BY UploadedAt DESC', [req.params.id]),
    ]);

    const totalPaid    = payments.reduce((s, p) => s + parseFloat(p.AmountPaid || 0), 0);
    const totalBalance = payments.reduce((s, p) => s + parseFloat(p.Balance    || 0), 0);

    res.json({ success: true, data: { ...student, enrollments, payments, results, certificates, files, totalPaid, totalBalance } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Helper: generate next StudentID in ST001 … ST999 format
async function nextStudentID() {
  const rows = await query(
    `SELECT StudentID FROM STUDENT WHERE StudentID REGEXP '^ST[0-9]+$' ORDER BY CAST(SUBSTRING(StudentID,3) AS UNSIGNED) DESC LIMIT 1`
  );
  if (!rows.length) return 'ST001';
  const num = parseInt(rows[0].StudentID.replace(/^ST/, ''), 10) + 1;
  return 'ST' + String(num).padStart(3, '0');
}

// POST /api/students
router.post('/', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const { FirstName, LastName, Gender, DateOfBirth, PhoneNumber, Email, Address, GuardianName, GuardianContact, NationalIDNumber, RegistrationDate, RegionOfOrigin } = req.body;
    if (!FirstName || !LastName) return res.status(400).json({ success: false, message: 'First name and last name are required.' });

    const studentId = await nextStudentID();
    await execute(
      `INSERT INTO STUDENT (StudentID,FirstName,LastName,Gender,DateOfBirth,PhoneNumber,Email,Address,GuardianName,GuardianContact,NationalIDNumber,RegistrationDate,RegionOfOrigin)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [studentId, FirstName, LastName, Gender||'Male', DateOfBirth||null, PhoneNumber||null, Email||null, Address||null, GuardianName||null, GuardianContact||null, NationalIDNumber||null, RegistrationDate||new Date().toISOString().split('T')[0], RegionOfOrigin||null]
    );
    const newStudent = await queryOne('SELECT * FROM STUDENT WHERE StudentID = ?', [studentId]);
    res.status(201).json({ success: true, message: 'Student registered successfully.', data: newStudent });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'A student with this email already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id
router.put('/:id', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const { FirstName, LastName, Gender, DateOfBirth, PhoneNumber, Email, Address, GuardianName, GuardianContact, NationalIDNumber, RegionOfOrigin } = req.body;
    await execute(
      `UPDATE STUDENT SET FirstName=?,LastName=?,Gender=?,DateOfBirth=?,PhoneNumber=?,Email=?,Address=?,GuardianName=?,GuardianContact=?,NationalIDNumber=?,RegionOfOrigin=? WHERE StudentID=?`,
      [FirstName, LastName, Gender, DateOfBirth||null, PhoneNumber||null, Email||null, Address||null, GuardianName||null, GuardianContact||null, NationalIDNumber||null, RegionOfOrigin||null, req.params.id]
    );
    const updated = await queryOne('SELECT * FROM STUDENT WHERE StudentID = ?', [req.params.id]);
    res.json({ success: true, message: 'Student updated successfully.', data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/students/:id
router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const student = await queryOne('SELECT * FROM STUDENT WHERE StudentID = ?', [req.params.id]);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    await execute('DELETE FROM STUDENT WHERE StudentID = ?', [req.params.id]);
    res.json({ success: true, message: `Student ${student.FirstName} ${student.LastName} deleted.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
