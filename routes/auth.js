const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { queryOne, execute } = require('../config/database');
const { generateToken, authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required.' });

    const user = await queryOne(
      'SELECT u.*, r.RoleName FROM users u LEFT JOIN roles r ON u.RoleID = r.RoleID WHERE u.Username = ? AND u.IsActive = 1',
      [username.trim()]
    );
    if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password.' });

    const valid = await bcrypt.compare(password, user.PasswordHash);
    if (!valid) {
      await execute('INSERT INTO audit_logs (Action, Module, IPAddress) VALUES (?,?,?)', ['login_failed', 'auth', req.ip]);
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = generateToken({ userId: user.UserID, role: user.RoleName });
    await execute('UPDATE users SET LastLogin = NOW() WHERE UserID = ?', [user.UserID]);
    await execute('INSERT INTO audit_logs (UserID, Action, Module, IPAddress) VALUES (?,?,?,?)', [user.UserID, 'login', 'auth', req.ip]);

    res.json({
      success: true,
      message: `Welcome back, ${user.FullName}!`,
      token,
      user: { id: user.UserID, username: user.Username, fullName: user.FullName, email: user.Email, role: user.RoleName, avatar: user.Avatar }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, user: { id: req.user.UserID, username: req.user.Username, fullName: req.user.FullName, email: req.user.Email, role: req.user.RoleName, avatar: req.user.Avatar } });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await execute('INSERT INTO audit_logs (UserID, Action, Module, IPAddress) VALUES (?,?,?,?)', [req.user.UserID, 'logout', 'auth', req.ip]);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords are required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    const user = await queryOne('SELECT PasswordHash FROM users WHERE UserID = ?', [req.user.UserID]);
    const valid = await bcrypt.compare(currentPassword, user.PasswordHash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await execute('UPDATE users SET PasswordHash = ? WHERE UserID = ?', [hash, req.user.UserID]);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
