const router = require('express').Router();
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const search = req.query.search?.trim() || '';
    let where = '1=1'; const params = [];
    if (search) { where += ' AND (FullName LIKE ? OR Position LIKE ? OR Email LIKE ?)'; const q=`%${search}%`; params.push(q,q,q); }
    const rows = await query(`SELECT * FROM staff WHERE ${where} ORDER BY FullName`, params);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const staff = await queryOne('SELECT * FROM staff WHERE StaffID = ?', [req.params.id]);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found.' });
    res.json({ success: true, data: staff });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('Administrator'), async (req, res) => {
  try {
    const { FullName, Position, Phone, Email, DateEmployed } = req.body;
    if (!FullName || !Position) return res.status(400).json({ success: false, message: 'Full name and position are required.' });
    const r = await execute('INSERT INTO staff (FullName,Position,Phone,Email,DateEmployed) VALUES (?,?,?,?,?)', [FullName, Position, Phone||null, Email||null, DateEmployed||null]);
    res.status(201).json({ success: true, message: 'Staff added.', data: await queryOne('SELECT * FROM staff WHERE StaffID=?', [r.insertId]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('Administrator'), async (req, res) => {
  try {
    const { FullName, Position, Phone, Email, DateEmployed } = req.body;
    await execute('UPDATE staff SET FullName=?,Position=?,Phone=?,Email=?,DateEmployed=? WHERE StaffID=?', [FullName, Position, Phone||null, Email||null, DateEmployed||null, req.params.id]);
    res.json({ success: true, message: 'Staff updated.', data: await queryOne('SELECT * FROM staff WHERE StaffID=?', [req.params.id]) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('Administrator'), async (req, res) => {
  try {
    await execute('DELETE FROM staff WHERE StaffID = ?', [req.params.id]);
    res.json({ success: true, message: 'Staff deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
