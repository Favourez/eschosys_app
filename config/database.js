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

    await conn.execute(`CREATE TABLE IF NOT EXISTS intern_payments (
      InternPaymentID INT AUTO_INCREMENT PRIMARY KEY,
      InternID        INT NOT NULL,
      ReceiptNumber   VARCHAR(100) NOT NULL UNIQUE,
      PayerName       VARCHAR(150),
      TotalFee        DECIMAL(12,2) NOT NULL DEFAULT 0,
      AmountPaid      DECIMAL(12,2) NOT NULL DEFAULT 0,
      Balance         DECIMAL(12,2) NOT NULL DEFAULT 0,
      PaymentMethod   ENUM('Cash','Mobile Money','Bank Transfer') NOT NULL DEFAULT 'Cash',
      PaymentDate     DATE NOT NULL,
      Notes           TEXT,
      RecordedBy      INT,
      CreatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await conn.execute(`CREATE TABLE IF NOT EXISTS file_uploads (
      FileID INT AUTO_INCREMENT PRIMARY KEY,
      StudentID VARCHAR(10),
      InternID INT,
      DocumentType VARCHAR(50) NOT NULL,
      FileName VARCHAR(255) NOT NULL,
      FilePath VARCHAR(500) NOT NULL,
      FileSize INT,
      MimeType VARCHAR(100),
      UploadedBy INT,
      UploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // ── Ensure AUTO_INCREMENT on primary keys that may be missing it ──
    const ensureAutoIncrement = async (table, pkCol) => {
      // 1. Read actual column type + current extras
      const [[col]] = await conn.execute(
        `SELECT EXTRA, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, pkCol]
      );
      if (!col || col.EXTRA.includes('auto_increment')) return; // already fine

      // 2. Drop any child FK constraints that reference this column
      //    (type-mismatch errors only appear when a referencing FK exists)
      const [fkRows] = await conn.execute(
        `SELECT TABLE_NAME, CONSTRAINT_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
           AND REFERENCED_TABLE_NAME   = ?
           AND REFERENCED_COLUMN_NAME  = ?`,
        [table, pkCol]
      );
      await conn.execute('SET FOREIGN_KEY_CHECKS=0');
      for (const fk of fkRows) {
        await conn.execute(
          `ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
        ).catch(() => {}); // ignore if already gone
      }

      // 3. Modify using the column's real type (INT, INT UNSIGNED, BIGINT, …)
      await conn.execute(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${pkCol}\` ${col.COLUMN_TYPE} NOT NULL AUTO_INCREMENT`
      );
      await conn.execute('SET FOREIGN_KEY_CHECKS=1');
    };
    // Fix every table that may be missing AUTO_INCREMENT on its PK
    const aiTables = [
      // STUDENT.StudentID is VARCHAR(10) — ID generated in route, not here
      ['INTERN',      'InternID'],
      ['PAYMENT',     'PaymentID'],
      ['PROGRAM',     'ProgramID'],
      ['COURSE',      'CourseID'],
      ['RESULT',      'ResultID'],
      ['CERTIFICATE', 'CertificateID'],
      ['LECTURER',    'LecturerID'],
      ['STAFF',       'StaffID'],
      ['ENROLLMENT',  'EnrollmentID'],
    ];
    for (const [tbl, col] of aiTables) {
      await ensureAutoIncrement(tbl, col).catch(e =>
        console.warn(`⚠️  AUTO_INCREMENT fix skipped for ${tbl}.${col}: ${e.message}`)
      );
    }

    // ── Add Guardian columns to INTERN if they don't exist ───────
    const addColIfMissing = async (table, col, def) => {
      const [[{ cnt }]] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
      );
      if (cnt === 0) await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
    };
    await addColIfMissing('INTERN',      'GuardianName',         'VARCHAR(150) NULL');
    await addColIfMissing('INTERN',      'GuardianPhone',        'VARCHAR(50)  NULL');
    await addColIfMissing('INTERN',      'GuardianRelationship', 'VARCHAR(100) NULL');
    await addColIfMissing('ENROLLMENT',  'Semester',             'TINYINT NULL COMMENT "1 or 2"');
    await addColIfMissing('ENROLLMENT',  'Level',                'TINYINT NULL COMMENT "1 to 4"');
    await addColIfMissing('ENROLLMENT',  'Exam',                 'VARCHAR(20) NULL COMMENT "HND or Degree"');
    await addColIfMissing('STUDENT',     'RegionOfOrigin',       'VARCHAR(50) NULL');

    // Fix StudentID in file_uploads: must be VARCHAR(10) to match STUDENT.StudentID
    await conn.execute(
      `ALTER TABLE file_uploads MODIFY COLUMN StudentID VARCHAR(10) NULL`
    ).catch(() => {});

    // Widen DocumentType so users can store long document labels
    await conn.execute(
      `ALTER TABLE file_uploads MODIFY COLUMN DocumentType VARCHAR(200) NOT NULL DEFAULT 'document'`
    ).catch(() => {});

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
