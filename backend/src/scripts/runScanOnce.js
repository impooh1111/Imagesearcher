// รันด้วยคำสั่ง: npm run scan:now
// ใช้ทดสอบว่า Service Account และ DRIVE_ROOT_FOLDER_ID ตั้งค่าถูกต้องหรือไม่
// โดยไม่ต้องเปิด server ทั้งระบบ
require('dotenv').config();
const { runFullScan } = require('../services/driveScanner');

(async () => {
  console.log('เริ่มสแกน Google Drive...');
  try {
    const result = await runFullScan();
    console.log('สแกนสำเร็จ:', result);
    process.exit(0);
  } catch (err) {
    console.error('สแกนล้มเหลว:', err);
    process.exit(1);
  }
})();
