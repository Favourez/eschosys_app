const router = require('express').Router();
const { query, execute } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM notifications WHERE UserID=? ORDER BY CreatedAt DESC LIMIT 30', [req.user.UserID]);
    const unread = rows.filter(n => !n.IsRead).length;
    res.json({ success: true, data: rows, unread });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/read-all', async (req, res) => {
  try {
    await execute('UPDATE notifications SET IsRead=1 WHERE UserID=?', [req.user.UserID]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/read', async (req, res) => {
  try {
    await execute('UPDATE notifications SET IsRead=1 WHERE NotificationID=? AND UserID=?', [req.params.id, req.user.UserID]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
