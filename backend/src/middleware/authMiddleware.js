require('dotenv').config();
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'planbmedia.co.th';

/**
 * ตรวจสอบทุก request ที่ต้อง login ว่า
 * 1) มี session อยู่จริง (isAuthenticated)
 * 2) อีเมลยังคงเป็นโดเมนที่อนุญาต (กันกรณี session เก่าค้างอยู่)
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const email = req.user && req.user.email;
    if (email && email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return next();
    }
  }
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบด้วยอีเมลบริษัทก่อนใช้งาน' });
}

module.exports = { ensureAuthenticated };
