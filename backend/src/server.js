require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cron = require('node-cron');

const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const photoRoutes = require('./routes/photos');
const scanRoutes = require('./routes/scan');
const { runFullScan } = require('./services/driveScanner');

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true, // จำเป็นเพื่อให้ cookie session ทำงานข้ามโดเมน frontend/backend
  })
);
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // ใน production ต้องรันผ่าน HTTPS
      maxAge: 1000 * 60 * 60 * 8, // session อยู่ได้ 8 ชั่วโมง
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/scan', scanRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`✅ Photo Search backend running at http://localhost:${PORT}`);

  // ---- ตั้งเวลาสแกน Google Drive อัตโนมัติตามที่กำหนดใน .env (SCAN_CRON) ----
  const cronExpr = process.env.SCAN_CRON || '*/15 * * * *';
  cron.schedule(cronExpr, () => {
    console.log('[Cron] เริ่มสแกน Google Drive ตามรอบเวลา...');
    runFullScan().catch((err) => console.error('[Cron] สแกนล้มเหลว:', err.message));
  });
  console.log(`⏰ ตั้งเวลาสแกนอัตโนมัติ: ${cronExpr}`);

  // สแกนทันทีตอนเปิดเซิร์ฟเวอร์ครั้งแรก (ปิดได้ผ่าน SCAN_ON_STARTUP=false)
  if (process.env.SCAN_ON_STARTUP !== 'false') {
    runFullScan().catch((err) =>
      console.error('[Startup Scan] ล้มเหลว:', err.message)
    );
  }
});
