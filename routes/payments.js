const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/payments
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const method = req.query.method || '';

    let where = '1=1'; const params = [];
    if (search) {
      where += ' AND (s.FirstName LIKE ? OR s.LastName LIKE ? OR p.ReceiptNumber LIKE ? OR p.PayerName LIKE ?)';
      const q = `%${search}%`; params.push(q,q,q,q);
    }
    if (method) { where += ' AND p.PaymentMethod = ?'; params.push(method); }

    const [{ total }] = await query(`SELECT COUNT(*) as total FROM PAYMENT p JOIN STUDENT s ON p.StudentID=s.StudentID WHERE ${where}`, params);
    const rows = await query(
      `SELECT p.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName, s.StudentID
       FROM PAYMENT p JOIN STUDENT s ON p.StudentID=s.StudentID WHERE ${where}
       ORDER BY p.PaymentDate DESC LIMIT ${limit} OFFSET ${offset}`, params);
    const [totals] = await query('SELECT COALESCE(SUM(AmountPaid),0) as totalPaid, COALESCE(SUM(Balance),0) as totalBalance FROM PAYMENT');
    res.json({ success: true, data: rows, totals, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/payments/student/:studentId
router.get('/student/:studentId', async (req, res) => {
  try {
    const payments = await query('SELECT * FROM PAYMENT WHERE StudentID = ? ORDER BY PaymentDate DESC', [req.params.studentId]);
    const [summary] = await query('SELECT COALESCE(SUM(AmountPaid),0) as totalPaid, COALESCE(SUM(Balance),0) as totalBalance FROM PAYMENT WHERE StudentID=?', [req.params.studentId]);
    res.json({ success: true, data: payments, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/payments/:id
router.get('/:id', async (req, res) => {
  try {
    const payment = await queryOne(`SELECT p.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName FROM PAYMENT p JOIN STUDENT s ON p.StudentID=s.StudentID WHERE p.PaymentID=?`, [req.params.id]);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, data: payment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/payments
router.post('/', authorize('Administrator','Accountant'), async (req, res) => {
  try {
    const { StudentID, ReceiptNumber, PayerName, PaymentDate, AmountPaid, Balance, PaymentMethod } = req.body;
    if (!StudentID || !AmountPaid) return res.status(400).json({ success: false, message: 'Student and amount are required.' });
    const receipt = ReceiptNumber || `RCP-${Date.now()}`;
    const r = await execute(
      `INSERT INTO PAYMENT (StudentID,ReceiptNumber,PayerName,PaymentDate,AmountPaid,Balance,PaymentMethod) VALUES (?,?,?,?,?,?,?)`,
      [StudentID, receipt, PayerName||null, PaymentDate||new Date().toISOString().split('T')[0], AmountPaid, Balance||0, PaymentMethod||'Cash']
    );
    const payment = await queryOne(`SELECT p.*, CONCAT(s.FirstName,' ',s.LastName) as StudentName FROM PAYMENT p JOIN STUDENT s ON p.StudentID=s.StudentID WHERE p.PaymentID=?`, [r.insertId]);
    res.status(201).json({ success: true, message: 'Payment recorded.', data: payment });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Receipt number already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/payments/:id
router.put('/:id', authorize('Administrator','Accountant'), async (req, res) => {
  try {
    const { PayerName, PaymentDate, AmountPaid, Balance, PaymentMethod } = req.body;
    await execute('UPDATE PAYMENT SET PayerName=?,PaymentDate=?,AmountPaid=?,Balance=?,PaymentMethod=? WHERE PaymentID=?',
      [PayerName||null, PaymentDate, AmountPaid, Balance||0, PaymentMethod||'Cash', req.params.id]);
    res.json({ success: true, message: 'Payment updated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/payments/:id
router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM PAYMENT WHERE PaymentID = ?', [req.params.id]);
    res.json({ success: true, message: 'Payment deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
