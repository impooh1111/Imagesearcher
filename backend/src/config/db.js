const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// โฟลเดอร์เก็บไฟล์ฐานข้อมูล SQLite
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'photos.db'));

// ปรับ performance ให้เหมาะกับงานอ่านเป็นหลัก
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ---- สร้างตารางหลัก (ถ้ายังไม่มี) ----
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder_path TEXT,
    taken_date TEXT,
    thumbnail_link TEXT,
    web_view_link TEXT,
    web_content_link TEXT,
    size INTEGER,
    year INTEGER,
    month INTEGER,
    mime_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// ---- Index สำหรับ query ที่ใช้บ่อย ----
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_year ON photos(year)');
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_month ON photos(month)');
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_taken_date ON photos(taken_date)');
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_folder_path ON photos(folder_path)');
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_name ON photos(name)');

// ---- Migration: เพิ่มคอลัมน์ package_name, product_name ถ้ายังไม่มี (สำหรับฐานข้อมูลเก่า) ----
const photoCols = db.prepare("PRAGMA table_info(photos)").all().map((c) => c.name);
if (!photoCols.includes('package_name')) {
  db.exec('ALTER TABLE photos ADD COLUMN package_name TEXT');
}
if (!photoCols.includes('product_name')) {
  db.exec('ALTER TABLE photos ADD COLUMN product_name TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_package ON photos(package_name)');
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_product ON photos(product_name)');

// ---- Migration: เพิ่มคอลัมน์ period_folder (ชื่อโฟลเดอร์ "ช่วงวันที่" เช่น "01 Jan 2026 1-15") ----
if (!photoCols.includes('period_folder')) {
  db.exec('ALTER TABLE photos ADD COLUMN period_folder TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_photos_period_folder ON photos(period_folder)');

// ---- Migration: เพิ่มคอลัมน์ parent_folder_id (driveScanner.js ใช้แต่ตารางเดิมอาจยังไม่มี) ----
if (!photoCols.includes('parent_folder_id')) {
  db.exec('ALTER TABLE photos ADD COLUMN parent_folder_id TEXT');
}

module.exports = db;
