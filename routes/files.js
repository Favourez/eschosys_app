const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const upload = require('../middleware/upload');
const { query, execute } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/files?studentId=&internId=
router.get('/', async (req, res) => {
  try {
    const { studentId, internId } = req.query;
    let where = '1=1'; const params = [];
    if (studentId) { where += ' AND StudentID=?'; params.push(studentId); }
    if (internId)  { where += ' AND InternID=?';  params.push(internId); }
    const files = await query(`SELECT * FROM file_uploads WHERE ${where} ORDER BY UploadedAt DESC`, params);
    res.json({ success: true, data: files });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/files/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const { studentId, internId, documentType } = req.body;
    if (!studentId && !internId) return res.status(400).json({ success: false, message: 'studentId or internId is required.' });

    const sub      = internId ? 'interns' : 'students';
    const filePath = `uploads/${sub}/${req.file.filename}`;

    const r = await execute(
      'INSERT INTO file_uploads (StudentID,InternID,DocumentType,FileName,FilePath,FileSize,MimeType,UploadedBy) VALUES (?,?,?,?,?,?,?,?)',
      [studentId||null, internId||null, documentType||'document', req.file.originalname, filePath, req.file.size, req.file.mimetype, req.user.UserID]
    );
    res.status(201).json({ success: true, message: 'File uploaded.', data: { FileID: r.insertId, FilePath: filePath, FileName: req.file.originalname, MimeType: req.file.mimetype, FileSize: req.file.size } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/files/:id
router.delete('/:id', async (req, res) => {
  try {
    const [file] = await query('SELECT * FROM file_uploads WHERE FileID = ?', [req.params.id]);
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });
    const fullPath = path.join(__dirname, '..', file.FilePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    await execute('DELETE FROM file_uploads WHERE FileID = ?', [req.params.id]);
    res.json({ success: true, message: 'File deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
