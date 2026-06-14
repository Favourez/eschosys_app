const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = '1=1'; const params = [];
    if (search) { where += ' AND (CONCAT(s.FirstName," ",s.LastName) LIKE ? OR c.CertificateNumber LIKE ?)'; const q=`%${search}%`; params.push(q,q); }
    if (status) { where += ' AND c.Status=?'; params.push(status); }
    const [{ total }] = await query(`SELECT COUNT(*) as total FROM certificate c LEFT JOIN student s ON c.StudentID=s.StudentID WHERE ${where}`, params);
    const rows = await query(
      `SELECT c.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, p.ProgramName
       FROM certificate c LEFT JOIN student s ON c.StudentID=s.StudentID LEFT JOIN program p ON c.ProgramID=p.ProgramID
       WHERE ${where} ORDER BY c.IssueDate DESC LIMIT ${limit} OFFSET ${offset}`, params);
    const [summary] = await query(
      `SELECT SUM(Status='Issued') as issued, SUM(Status='Draft') as draft, SUM(Status='Revoked') as revoked FROM certificate`);
    res.json({ success: true, data: rows, summary, pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const cert = await queryOne(`SELECT c.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, s.Email as StudentEmail, p.ProgramName FROM certificate c LEFT JOIN student s ON c.StudentID=s.StudentID LEFT JOIN program p ON c.ProgramID=p.ProgramID WHERE c.CertificateID=?`, [req.params.id]);
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found.' });
    res.json({ success: true, data: cert });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('Administrator','Registrar'), async (req, res) => {
  try {
    const { CertificateNumber, StudentID, ProgramID, IssueDate, Status } = req.body;
    if (!StudentID) return res.status(400).json({ success: false, message: 'Student is required.' });
    const certNum = CertificateNumber || `CERT-${Date.now()}`;
    const r = await execute('INSERT INTO certificate (CertificateNumber,StudentID,ProgramID,IssueDate,Status) VALUES (?,?,?,?,?)',
      [certNum, StudentID, ProgramID||null, IssueDate||new Date().toISOString().split('T')[0], Status||'Issued']);
    res.status(201).json({ success: true, message: 'Certificate issued.', data: await queryOne('SELECT * FROM certificate WHERE CertificateID=?', [r.insertId]) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Certificate number already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const { CertificateNumber, StudentID, ProgramID, IssueDate, Status } = req.body;
    await execute('UPDATE certificate SET CertificateNumber=?,StudentID=?,ProgramID=?,IssueDate=?,Status=? WHERE CertificateID=?',
      [CertificateNumber, StudentID, ProgramID||null, IssueDate, Status, req.params.id]);
    res.json({ success: true, message: 'Certificate updated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM certificate WHERE CertificateID = ?', [req.params.id]);
    res.json({ success: true, message: 'Certificate deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
