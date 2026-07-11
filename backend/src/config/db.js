const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/photos.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// WAL mode = อ่าน/เขียนพร้อมกันได้ดีขึ้น ไม่ค้างเวลามีคนค้นหาพร้อมกับ scanner กำลังทำงาน
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ---- ตาราง photos: เก็บ metadata ของรูปทั้งหมดที่สแกนมาจาก Google Drive ----
// นี่คือตารางหลักที่หน้าเว็บจะ query ค้นหา (ไม่ได้ยิงไป Google Drive ตรงๆ ทำให้เร็ว)
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,               -- Google Drive file id
    name TEXT NOT NULL,
    folder_path TEXT NOT NULL,         -- path เต็ม เช่น /2025/งานเปิดตัวสินค้า
    parent_folder_id TEXT,
    mime_type TEXT,
    taken_date TEXT,                   -- ISO date เช่น 2025-06-01T10:00:00Z (จากวันที่ถ่ายจริงถ้ามี ไม่งั้น fallback เป็น createdTime)
    created_time TEXT,
    modified_time TEXT,
    size INTEGER,
    thumbnail_link TEXT,
    web_view_link TEXT,
    web_content_link TEXT,
    year INTEGER,
    month INTEGER,
    indexed_at TEXT NOT NULL
  );

  -- index สำคัญ: ทำให้ค้นหาตามช่วงวันที่/ปี เร็วมาก แม้มีรูปเป็นแสนเป็นล้าน
  CREATE INDEX IF NOT EXISTS idx_photos_taken_date ON photos(taken_date);
  CREATE INDEX IF NOT EXISTS idx_photos_year ON photos(year);
  CREATE INDEX IF NOT EXISTS idx_photos_folder ON photos(folder_path);
  CREATE INDEX IF NOT EXISTS idx_photos_name ON photos(name);

  -- ตาราง scan_log: เก็บประวัติการสแกน เอาไว้ debug และดูสถานะ
  CREATE TABLE IF NOT EXISTS scan_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    files_scanned INTEGER DEFAULT 0,
    folders_scanned INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',     -- running | success | error
    error TEXT
  );
`);

module.exports = db;
