const express = require('express');
const db = require('../config/db');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(ensureAuthenticated);

const MAX_PAGE_SIZE = 100;

/**
 * GET /api/photos/search
 * Query params:
 *   q          - คำค้นหาจากชื่อไฟล์ (optional)
 *   year       - ปี ค.ศ. เช่น 2025 (optional) -> ใช้ index idx_photos_year ทำให้เร็ว
 *   startDate  - วันที่เริ่มต้น รูปแบบ YYYY-MM-DD (optional)
 *   endDate    - วันที่สิ้นสุด รูปแบบ YYYY-MM-DD (optional)
 *   folder     - ค้นเฉพาะ path โฟลเดอร์ที่ขึ้นต้นด้วยค่านี้ (optional)
 *   page       - หน้า เริ่มที่ 1 (default 1)
 *   pageSize   - จำนวนต่อหน้า (default 40, สูงสุด 100)
 *
 * ทุกเงื่อนไข query จากฐานข้อมูล SQLite ที่มี index ไว้แล้ว
 * ไม่มีการเรียก Google Drive API สดในขั้นตอนนี้ -> ตอบเร็วแม้มีรูปเป็นแสน
 */
router.get('/search', (req, res) => {
  const { q, year, startDate, endDate, folder } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 40, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = {};

  if (q) {
    where.push('name LIKE @q');
    params.q = `%${q}%`;
  }
  if (year) {
    where.push('year = @year');
    params.year = Number(year);
  }
  if (startDate) {
    where.push('taken_date >= @startDate');
    params.startDate = new Date(startDate).toISOString();
  }
  if (endDate) {
    // รวมถึงวันสิ้นสุดทั้งวัน
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    where.push('taken_date <= @endDate');
    params.endDate = end.toISOString();
  }
  if (folder) {
    where.push('folder_path LIKE @folder');
    params.folder = `${folder}%`;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM photos ${whereClause}`)
    .get(params);

  const rows = db
    .prepare(
      `SELECT id, name, folder_path, taken_date, thumbnail_link, web_view_link,
              web_content_link, size, year, month
       FROM photos
       ${whereClause}
       ORDER BY taken_date DESC
       LIMIT @pageSize OFFSET @offset`
    )
    .all({ ...params, pageSize, offset });

  res.json({
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize),
    items: rows,
  });
});

// รายละเอียดรูปเดี่ยว (ใช้ตอนเปิด Lightbox)
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'ไม่พบรูปภาพ' });
  res.json(row);
});

// รายชื่อปีทั้งหมดที่มีรูป (ใช้ทำ dropdown ตัวกรองปีในหน้าเว็บ)
router.get('/meta/years', (req, res) => {
  const rows = db
    .prepare(
      `SELECT year, COUNT(*) AS count FROM photos WHERE year IS NOT NULL GROUP BY year ORDER BY year DESC`
    )
    .all();
  res.json(rows);
});

module.exports = router;
