const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/search?q=keyword
router.get('/', async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json({ success: true, results: [] });
    const like = `%${q}%`;

    const [students, interns, programs] = await Promise.all([
      query(`SELECT StudentID as id, CONCAT(FirstName,' ',LastName) as name, Email as subtitle, 'Student' as type FROM student
             WHERE FirstName LIKE ? OR LastName LIKE ? OR Email LIKE ? OR PhoneNumber LIKE ? LIMIT 5`, [like,like,like,like]),
      query(`SELECT InternID as id, FullName as name, Institution as subtitle, 'Intern' as type FROM intern
             WHERE FullName LIKE ? OR Email LIKE ? OR Institution LIKE ? LIMIT 5`, [like,like,like]),
      query(`SELECT ProgramID as id, ProgramName as name, Duration as subtitle, 'Program' as type FROM program
             WHERE ProgramName LIKE ? LIMIT 3`, [like]),
    ]);

    const results = [
      ...students.map(s => ({ ...s, url: `/student-profile.html?id=${s.id}`, icon: 'fa-user-graduate' })),
      ...interns.map(i  => ({ ...i, url: `/interns.html?id=${i.id}`,          icon: 'fa-briefcase' })),
      ...programs.map(p => ({ ...p, url: `/programs.html?id=${p.id}`,          icon: 'fa-book-open' })),
    ];
    res.json({ success: true, results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
