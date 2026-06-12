const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { query, queryOne, execute } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('Administrator'));

router.get('/', async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.UserID, u.Username, u.FullName, u.Email,
              u.IsActive, u.LastLogin, u.CreatedAt, r.RoleName as Role,
              CASE WHEN u.IsActive=1 THEN 'active' ELSE 'inactive' END as Status
       FROM users u LEFT JOIN roles r ON u.RoleID=r.RoleID ORDER BY u.FullName`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/roles', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM roles ORDER BY RoleName');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { page=1, limit=25, userId='', action='' } = req.query;
    const offset = (page-1)*limit;
    let where = '1=1'; const params = [];
    if (userId) { where += ' AND al.UserID=?'; params.push(userId); }
    if (action) { where += ' AND al.Action=?'; params.push(action); }
    const [{ total }] = await query(`SELECT COUNT(*) as total FROM audit_logs al WHERE ${where}`, params);
    const rows = await query(
      `SELECT al.*, u.FullName, u.Username FROM audit_logs al LEFT JOIN users u ON al.UserID=u.UserID
       WHERE ${where} ORDER BY al.CreatedAt DESC LIMIT ${+limit} OFFSET ${offset}`, params);
    res.json({ success: true, data: rows, pagination: { total, page:+page, limit:+limit, totalPages: Math.ceil(total/limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

async function resolveRoleID(roleName) {
  if (!roleName) return null;
  const role = await queryOne('SELECT RoleID FROM roles WHERE RoleName=?', [roleName]);
  return role?.RoleID || null;
}

router.post('/', async (req, res) => {
  try {
    const { Username, Password, FullName, Email, Role, Status } = req.body;
    if (!Username || !Password || !FullName) return res.status(400).json({ success: false, message: 'Username, password and full name are required.' });
    if (Password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    const hash = await bcrypt.hash(Password, 12);
    const RoleID = await resolveRoleID(Role);
    const IsActive = Status === 'inactive' ? 0 : 1;
    const r = await execute('INSERT INTO users (Username,PasswordHash,FullName,Email,RoleID,IsActive) VALUES (?,?,?,?,?,?)', [Username, hash, FullName, Email||null, RoleID, IsActive]);
    const user = await queryOne('SELECT UserID,Username,FullName,Email,IsActive,CreatedAt FROM users WHERE UserID=?', [r.insertId]);
    res.status(201).json({ success: true, message: 'User created successfully.', data: user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Username already exists.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { FullName, Email, Role, Status, Password } = req.body;
    const RoleID = await resolveRoleID(Role);
    const IsActive = Status === 'inactive' ? 0 : 1;
    if (Password) {
      if (Password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      const hash = await bcrypt.hash(Password, 12);
      await execute('UPDATE users SET FullName=?,Email=?,RoleID=?,IsActive=?,PasswordHash=? WHERE UserID=?', [FullName, Email||null, RoleID, IsActive, hash, req.params.id]);
    } else {
      await execute('UPDATE users SET FullName=?,Email=?,RoleID=?,IsActive=? WHERE UserID=?', [FullName, Email||null, RoleID, IsActive, req.params.id]);
    }
    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.UserID) return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    await execute('DELETE FROM users WHERE UserID = ?', [req.params.id]);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
