const express = require('express');
const passport = require('passport');
require('dotenv').config();

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'planbmedia.co.th';

// เริ่ม flow login ผ่าน Google
// parameter "hd" ช่วยให้ Google โชว์เฉพาะบัญชีในโดเมนองค์กรตั้งแต่หน้าเลือกบัญชี (UX ดีขึ้น)
// แต่ตัวความปลอดภัยจริงเช็คซ้ำที่ passport.js และ authMiddleware.js เสมอ
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    hd: ALLOWED_DOMAIN,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?error=domain_not_allowed`,
  }),
  (req, res) => {
    res.redirect(`${FRONTEND_URL}/`);
  }
);

router.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});

// ให้ frontend เช็คได้ว่า login อยู่ไหม และเป็นใคร
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ user: req.user });
  }
  res.json({ user: null });
});

module.exports = router;
