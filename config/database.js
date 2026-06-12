const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  database:         process.env.DB_NAME     || 'EschosysDB',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       0,
  charset:          'utf8mb4',
  timezone:         '+00:00',
});

// ── Query Helpers ─────────────────────────────────────────────
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function execute(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

// ── Setup Additional Tables (create only if not exists) ───────
async function setupAdditionalTables() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`CREATE TABLE IF NOT EXISTS roles (
      RoleID INT AUTO_INCREMENT PRIMARY KEY,
      RoleName VARCHAR(50) NOT NULL UNIQUE,
      Description TEXT,
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS users (
      UserID INT AUTO_INCREMENT PRIMARY KEY,
      Username VARCHAR(100) NOT NULL UNIQUE,
      PasswordHash VARCHAR(255) NOT NULL,
      Email VARCHAR(150),
      FullName VARCHAR(150) NOT NULL,
      RoleID INT,
      IsActive TINYINT(1) DEFAULT 1,
      LastLogin DATETIME,
      Avatar VARCHAR(255),
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (RoleID) REFERENCES roles(RoleID) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS notifications (
      NotificationID INT AUTO_INCREMENT PRIMARY KEY,
      UserID INT,
      Title VARCHAR(200) NOT NULL,
      Message TEXT NOT NULL,
      Type ENUM('info','success','warning','danger') DEFAULT 'info',
      IsRead TINYINT(1) DEFAULT 0,
      Link VARCHAR(300),
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS audit_logs (
      LogID INT AUTO_INCREMENT PRIMARY KEY,
      UserID INT,
      Action VARCHAR(100) NOT NULL,
      Module VARCHAR(50) NOT NULL,
      RecordID INT,
      OldValues JSON,
      NewValues JSON,
      IPAddress VARCHAR(45),
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS file_uploads (
      FileID INT AUTO_INCREMENT PRIMARY KEY,
      StudentID INT,
      InternID INT,
      DocumentType VARCHAR(50) NOT NULL,
      FileName VARCHAR(255) NOT NULL,
      FilePath VARCHAR(500) NOT NULL,
      FileSize INT,
      MimeType VARCHAR(100),
      UploadedBy INT,
      UploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Seed roles
    await conn.execute(`INSERT IGNORE INTO roles (RoleName, Description) VALUES
      ('Administrator','Full system access'),
      ('Registrar','Student registration and records'),
      ('Accountant','Payment and financial management'),
      ('Lecturer','Course delivery and results entry')`);

    // Seed default admin user if none exists
    const [users] = await conn.execute('SELECT COUNT(*) as cnt FROM users');
    if (users[0].cnt === 0) {
      const hash = await bcrypt.hash('Admin@123', 12);
      const [role] = await conn.execute("SELECT RoleID FROM roles WHERE RoleName='Administrator' LIMIT 1");
      if (role[0]) {
        await conn.execute(
          `INSERT INTO users (Username,PasswordHash,Email,FullName,RoleID) VALUES
           ('admin',?,  'admin@eschosys.com','System Administrator',?),
           ('registrar',?,'registrar@eschosys.com','Head Registrar',2),
           ('accountant',?,'accounts@eschosys.com','Chief Accountant',3),
           ('lecturer',?, 'lecturer@eschosys.com','Lead Lecturer',4)`,
          [hash, role[0].RoleID, hash, hash, hash]
        );
      }
    }
    console.log('✅ Additional tables ready.');
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, queryOne, execute, setupAdditionalTables };
