const express = require('express');
const db = require('../config/db');
const { runFullScan } = require('../services/driveScanner');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(ensureAuthenticated);

let isScanning = false;

// สั่งสแกนทันที (เช่น กดปุ่ม "Sync ตอนนี้" จากหน้าเว็บ)
router.post('/trigger', async (req, res) => {
  if (isScanning) {
    return res.status(409).json({ error: 'กำลังสแกนอยู่ กรุณารอให้เสร็จก่อน' });
  }
  isScanning = true;
  res.json({ message: 'เริ่มการสแกนแล้ว ระบบจะทำงานเบื้องหลัง' });

  try {
    await runFullScan();
  } catch (err) {
    console.error(err);
  } finally {
    isScanning = false;
  }
});

// ดูประวัติ/สถานะการสแกนล่าสุด
router.get('/status', (req, res) => {
  const logs = db
    .prepare('SELECT * FROM scan_log ORDER BY id DESC LIMIT 10')
    .all();
  const totalPhotos = db.prepare('SELECT COUNT(*) AS c FROM photos').get().c;
  res.json({ isScanning, totalPhotos, recentLogs: logs });
});

module.exports = router;
