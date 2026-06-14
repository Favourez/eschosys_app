const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/interns
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const status = req.query.status || '';

    let where = '1=1'; const params = [];
    if (search) {
      where += ' AND (FullName LIKE ? OR Email LIKE ? OR Institution LIKE ? OR FieldOfStudy LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (status === 'active')    { where += ' AND InternshipEndDate >= CURDATE()'; }
    if (status === 'completed') { where += ' AND InternshipEndDate < CURDATE()';  }

    const [{ total }] = await query(`SELECT COUNT(*) as total FROM intern WHERE ${where}`, params);
    const rows = await query(
      `SELECT i.*,
        (SELECT COUNT(*) FROM file_uploads fu WHERE fu.InternID = i.InternID) AS DocCount
       FROM intern i WHERE ${where} ORDER BY i.InternshipStartDate DESC LIMIT ${limit} OFFSET ${offset}`, params);
    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/interns/:id
router.get('/:id', async (req, res) => {
  try {
    const intern = await queryOne('SELECT * FROM intern WHERE InternID = ?', [req.params.id]);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found.' });
    const [files, certs] = await Promise.all([
      query('SELECT * FROM file_uploads WHERE InternID = ? ORDER BY UploadedAt DESC', [req.params.id]),
      query('SELECT * FROM certificate WHERE StudentID IS NULL AND CertificateNumber LIKE ? ORDER BY IssueDate DESC', [`INT-${req.params.id}%`]),
    ]);
    res.json({ success: true, data: { ...intern, files, certificates: certs } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/interns
router.post('/', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const {
      FullName, Phone, Email, Institution, FieldOfStudy,
      InternshipStartDate, InternshipEndDate,
      GuardianName, GuardianPhone, GuardianRelationship
    } = req.body;
    if (!FullName) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!Phone)    return res.status(400).json({ success: false, message: 'Phone number is required.' });
    const result = await execute(
      `INSERT INTO intern
         (FullName,Phone,Email,Institution,FieldOfStudy,InternshipStartDate,InternshipEndDate,
          GuardianName,GuardianPhone,GuardianRelationship)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [FullName, Phone||null, Email||null, Institution||null, FieldOfStudy||null,
       InternshipStartDate||null, InternshipEndDate||null,
       GuardianName||null, GuardianPhone||null, GuardianRelationship||null]
    );
    const intern = await queryOne('SELECT * FROM intern WHERE InternID = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Intern registered successfully.', data: intern });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/interns/:id
router.put('/:id', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const {
      FullName, Phone, Email, Institution, FieldOfStudy,
      InternshipStartDate, InternshipEndDate,
      GuardianName, GuardianPhone, GuardianRelationship
    } = req.body;
    await execute(
      `UPDATE intern SET
         FullName=?,Phone=?,Email=?,Institution=?,FieldOfStudy=?,
         InternshipStartDate=?,InternshipEndDate=?,
         GuardianName=?,GuardianPhone=?,GuardianRelationship=?
       WHERE InternID=?`,
      [FullName, Phone||null, Email||null, Institution||null, FieldOfStudy||null,
       InternshipStartDate||null, InternshipEndDate||null,
       GuardianName||null, GuardianPhone||null, GuardianRelationship||null,
       req.params.id]
    );
    const updated = await queryOne('SELECT * FROM intern WHERE InternID = ?', [req.params.id]);
    res.json({ success: true, message: 'Intern updated successfully.', data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/interns/:id
router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const intern = await queryOne('SELECT * FROM intern WHERE InternID = ?', [req.params.id]);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found.' });
    await execute('DELETE FROM intern WHERE InternID = ?', [req.params.id]);
    res.json({ success: true, message: `Intern ${intern.FullName} deleted.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
