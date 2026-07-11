const { google } = require('googleapis');
require('dotenv').config();

let driveClient = null;

/**
 * สร้าง Google Drive API client โดยใช้ Service Account
 * Service Account ต้องถูก "แชร์" ให้เข้าถึง Shared Drive/โฟลเดอร์หลักไว้ล่วงหน้า
 * (ทำครั้งเดียวตอนตั้งค่าระบบ ไม่เกี่ยวกับ user ที่ login เข้าเว็บ)
 */
function getDriveClient() {
  if (driveClient) return driveClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

module.exports = { getDriveClient };
