const router = require('express').Router();
const { query, execute } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/semesters
router.get('/', async (req, res) => {
  try {
    let rows = await query('SELECT * FROM semester ORDER BY StartDate DESC');

    // Seed default semesters if the table is empty
    if (!rows.length) {
      const seeds = [
        ['Semester 1 – 2023/2024', '2023/2024', '2023-09-01', '2024-01-31'],
        ['Semester 2 – 2023/2024', '2023/2024', '2024-02-01', '2024-06-30'],
        ['Semester 1 – 2024/2025', '2024/2025', '2024-09-01', '2025-01-31'],
        ['Semester 2 – 2024/2025', '2024/2025', '2025-02-01', '2025-06-30'],
        ['Semester 1 – 2025/2026', '2025/2026', '2025-09-01', '2026-01-31'],
        ['Semester 2 – 2025/2026', '2025/2026', '2026-02-01', '2026-06-30'],
      ];
      for (const [name, year, start, end] of seeds) {
        await execute(
          'INSERT IGNORE INTO semester (SemesterName, AcademicYear, StartDate, EndDate) VALUES (?,?,?,?)',
          [name, year, start, end]
        ).catch(() => {}); // ignore if columns differ
      }
      rows = await query('SELECT * FROM semester ORDER BY StartDate DESC');
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
