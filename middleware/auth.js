const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'EschosysSecret2024';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided. Please login.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await queryOne(
      'SELECT u.UserID, u.Username, u.FullName, u.Email, u.RoleID, u.Avatar, r.RoleName FROM users u LEFT JOIN roles r ON u.RoleID = r.RoleID WHERE u.UserID = ? AND u.IsActive = 1',
      [decoded.userId]
    );
    if (!user) return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized.' });
    if (roles.length && !roles.includes(req.user.RoleName)) {
      return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
}

function auditLog(action, module) {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode < 400 && req.user) {
        try {
          const { execute } = require('../config/database');
          await execute(
            'INSERT INTO audit_logs (UserID, Action, Module, RecordID, IPAddress) VALUES (?,?,?,?,?)',
            [req.user.UserID, action, module, req.params.id || null, req.ip]
          );
        } catch (_) {}
      }
    });
    next();
  };
}

module.exports = { generateToken, authenticate, authorize, auditLog };
