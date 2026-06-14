const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/intern-payments  — paginated list
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const method = req.query.method || '';

    let where = '1=1'; const params = [];
    if (search) {
      where += ' AND (i.FullName LIKE ? OR ip.ReceiptNumber LIKE ? OR ip.PayerName LIKE ?)';
      const q = `%${search}%`; params.push(q, q, q);
    }
    if (method) { where += ' AND ip.PaymentMethod = ?'; params.push(method); }

    const [{ total }] = await query(
      `SELECT COUNT(*) as total FROM intern_payments ip JOIN intern i ON ip.InternID=i.InternID WHERE ${where}`, params);
    const rows = await query(
      `SELECT ip.*, i.FullName AS InternName, i.Phone AS InternPhone, i.Institution
       FROM intern_payments ip JOIN intern i ON ip.InternID=i.InternID
       WHERE ${where} ORDER BY ip.PaymentDate DESC, ip.CreatedAt DESC
       LIMIT ${limit} OFFSET ${offset}`, params);
    const [totals] = await query(
      `SELECT COALESCE(SUM(AmountPaid),0) as totalPaid, COALESCE(SUM(Balance),0) as totalBalance FROM intern_payments`);

    res.json({ success: true, data: rows, totals, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/intern-payments/intern/:internId — all payments for one intern + summary
router.get('/intern/:internId', async (req, res) => {
  try {
    const payments = await query(
      'SELECT * FROM intern_payments WHERE InternID=? ORDER BY PaymentDate DESC', [req.params.internId]);
    const [summary] = await query(
      `SELECT COALESCE(SUM(AmountPaid),0) as totalPaid,
              COALESCE(MAX(TotalFee),0)   as totalFee,
              COALESCE(MIN(Balance),0)    as latestBalance
       FROM intern_payments WHERE InternID=?`, [req.params.internId]);
    res.json({ success: true, data: payments, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/intern-payments/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await queryOne(
      `SELECT ip.*, i.FullName AS InternName FROM intern_payments ip
       JOIN intern i ON ip.InternID=i.InternID WHERE ip.InternPaymentID=?`, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/intern-payments  — auto-calculates balance
router.post('/', authorize('Administrator', 'Accountant'), async (req, res) => {
  try {
    const { InternID, TotalFee, AmountPaid, PayerName, PaymentDate, PaymentMethod, Notes } = req.body;
    if (!InternID)   return res.status(400).json({ success: false, message: 'Intern is required.' });
    if (!AmountPaid) return res.status(400).json({ success: false, message: 'Amount paid is required.' });
    if (!TotalFee)   return res.status(400).json({ success: false, message: 'Total fee is required.' });

    const intern = await queryOne('SELECT InternID FROM intern WHERE InternID=?', [InternID]);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found.' });

    // Sum all previous payments for this intern
    const [prev] = await query(
      'SELECT COALESCE(SUM(AmountPaid),0) as prevPaid FROM intern_payments WHERE InternID=?', [InternID]);
    const balance = parseFloat(TotalFee) - parseFloat(prev.prevPaid) - parseFloat(AmountPaid);

    const receipt = `INT-RCP-${Date.now()}`;
    const r = await execute(
      `INSERT INTO intern_payments (InternID,ReceiptNumber,PayerName,TotalFee,AmountPaid,Balance,PaymentMethod,PaymentDate,Notes,RecordedBy)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [InternID, receipt, PayerName||null, TotalFee, AmountPaid, Math.max(0, balance),
       PaymentMethod||'Cash', PaymentDate||new Date().toISOString().split('T')[0],
       Notes||null, req.user.UserID]);

    const payment = await queryOne(
      `SELECT ip.*, i.FullName AS InternName FROM intern_payments ip
       JOIN intern i ON ip.InternID=i.InternID WHERE ip.InternPaymentID=?`, [r.insertId]);
    res.status(201).json({ success: true, message: 'Intern payment recorded.', data: payment });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Receipt number already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/intern-payments/:id
router.put('/:id', authorize('Administrator', 'Accountant'), async (req, res) => {
  try {
    const { TotalFee, AmountPaid, PayerName, PaymentDate, PaymentMethod, Notes } = req.body;
    const existing = await queryOne('SELECT * FROM intern_payments WHERE InternPaymentID=?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Payment not found.' });

    // Recalculate: sum of all OTHER payments for this intern
    const [prev] = await query(
      'SELECT COALESCE(SUM(AmountPaid),0) as prevPaid FROM intern_payments WHERE InternID=? AND InternPaymentID!=?',
      [existing.InternID, req.params.id]);
    const balance = parseFloat(TotalFee) - parseFloat(prev.prevPaid) - parseFloat(AmountPaid);

    await execute(
      `UPDATE intern_payments SET TotalFee=?,AmountPaid=?,Balance=?,PayerName=?,PaymentDate=?,PaymentMethod=?,Notes=?
       WHERE InternPaymentID=?`,
      [TotalFee, AmountPaid, Math.max(0, balance), PayerName||null,
       PaymentDate, PaymentMethod||'Cash', Notes||null, req.params.id]);
    const updated = await queryOne(
      `SELECT ip.*, i.FullName AS InternName FROM intern_payments ip
       JOIN intern i ON ip.InternID=i.InternID WHERE ip.InternPaymentID=?`, [req.params.id]);
    res.json({ success: true, message: 'Payment updated.', data: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/intern-payments/:id
router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM intern_payments WHERE InternPaymentID=?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Payment not found.' });
    await execute('DELETE FROM intern_payments WHERE InternPaymentID=?', [req.params.id]);
    res.json({ success: true, message: 'Payment deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
