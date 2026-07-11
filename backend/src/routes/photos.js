const express = require('express');
const db = require('../config/db');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const { getDriveClient } = require('../services/driveClient');

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
 *   folder     - Subfolder ช่วงวันที่ เช่น "01 Jan 2026 1-15" (optional, ตรงตัวเป๊ะ)
 *   page       - หน้า เริ่มที่ 1 (default 1)
 *   pageSize   - จำนวนต่อหน้า (default 40, สูงสุด 100)
 *
 * ทุกเงื่อนไข query จากฐานข้อมูล SQLite ที่มี index ไว้แล้ว
 * ไม่มีการเรียก Google Drive API สดในขั้นตอนนี้ -> ตอบเร็วแม้มีรูปเป็นแสน
 */
router.get('/search', (req, res) => {
  const { q, year, startDate, endDate, folder, package: pkg, product } = req.query;
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
    where.push('period_folder = @folder');
    params.folder = folder;
  }
  if (pkg) {
    where.push('package_name = @package');
    params.package = pkg;
  }
  if (product) {
    where.push('product_name = @product');
    params.product = product;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM photos ${whereClause}`)
    .get(params);

  const sortMap = {
    year: 'year DESC, month DESC, taken_date DESC',
    month: 'month DESC, year DESC, taken_date DESC',
    product: 'product_name ASC, taken_date DESC',
    package: 'package_name ASC, taken_date DESC',
    date: 'taken_date DESC',
  };
  const sortKey = sortMap[req.query.sort] ? req.query.sort : 'date';
  const orderClause = sortMap[sortKey];

  const rows = db
    .prepare(
      `SELECT id, name, folder_path, taken_date, thumbnail_link, web_view_link,
              web_content_link, size, year, month, package_name, product_name, period_folder
       FROM photos
       ${whereClause}
       ORDER BY ${orderClause}
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

// รายชื่อ Package ทั้งหมดที่มีรูป (ใช้ทำ dropdown ตัวกรอง Package ในหน้าเว็บ)
router.get('/meta/packages', (req, res) => {
  const rows = db
    .prepare(
      `SELECT package_name, COUNT(*) AS count
       FROM photos
       WHERE package_name IS NOT NULL AND package_name != ''
       GROUP BY package_name
       ORDER BY package_name ASC`
    )
    .all();
  res.json(rows);
});

// รายชื่อ Subfolder (ช่วงวันที่) ทั้งหมดที่มีรูป (ใช้ทำ dropdown ตัวกรอง Subfolder ในหน้าเว็บ)
// ถ้าส่ง query param package มา จะกรองเฉพาะ subfolder ที่อยู่ภายใต้ package นั้น
router.get('/meta/folders', (req, res) => {
  const { package: pkg } = req.query;
  const where = ["period_folder IS NOT NULL", "period_folder != ''"];
  const params = {};
  if (pkg) {
    where.push('package_name = @package');
    params.package = pkg;
  }
  const rows = db
    .prepare(
      `SELECT period_folder AS folder_path, COUNT(*) AS count
       FROM photos
       WHERE ${where.join(' AND ')}
       GROUP BY period_folder
       ORDER BY period_folder ASC`
    )
    .all(params);
  res.json(rows);
});

// รายชื่อสินค้าทั้งหมดที่มีรูป (ใช้ทำ dropdown ตัวกรองสินค้าในหน้าเว็บ)
// กรองตาม package และ/หรือ subfolder ที่เลือกไว้ก่อนหน้าได้ (ถ้าส่งมา)
router.get('/meta/products', (req, res) => {
  const { package: pkg, folder } = req.query;
  const where = ["product_name IS NOT NULL", "product_name != ''"];
  const params = {};
  if (pkg) {
    where.push('package_name = @package');
    params.package = pkg;
  }
  if (folder) {
    where.push('period_folder = @folder');
    params.folder = folder;
  }
  const rows = db
    .prepare(
      `SELECT product_name, COUNT(*) AS count
       FROM photos
       WHERE ${where.join(' AND ')}
       GROUP BY product_name
       ORDER BY product_name ASC`
    )
    .all(params);
  res.json(rows);
});

/**
 * GET /api/photos/:id/thumbnail
 * Proxy รูปจาก Google Drive ผ่าน backend
 * (เบราว์เซอร์ผู้ใช้เข้าถึง Google Drive ตรงๆ ไม่ได้ ต้องผ่าน Service Account เท่านั้น)
 */
router.get('/:id/thumbnail', async (req, res) => {
  try {
    const drive = getDriveClient();
    const fileRes = await drive.files.get(
      { fileId: req.params.id, alt: 'media' },
      { responseType: 'stream' }
    );
    res.set('Cache-Control', 'public, max-age=86400');
    fileRes.data
      .on('error', () => res.status(500).end())
      .pipe(res);
  } catch (err) {
    res.status(404).end();
  }
});

module.exports = router;
