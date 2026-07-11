const { getDriveClient } = require('./driveClient');
const db = require('../config/db');
require('dotenv').config();

const FIELDS =
  'nextPageToken, files(id, name, mimeType, parents, createdTime, modifiedTime, size, thumbnailLink, webViewLink, webContentLink, imageMediaMetadata)';

/**
 * ดึงรายการไฟล์/โฟลเดอร์ทั้งหมดที่อยู่ใต้ folderId (พร้อม pagination)
 * รองรับทั้งไฟล์ใน My Drive และ Shared Drive
 */
async function listChildren(drive, folderId) {
  const items = [];
  let pageToken = undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: FIELDS,
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: process.env.DRIVE_SHARED_DRIVE_ID ? 'drive' : 'user',
      driveId: process.env.DRIVE_SHARED_DRIVE_ID || undefined,
    });
    items.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return items;
}

function isFolder(file) {
  return file.mimeType === 'application/vnd.google-apps.folder';
}

function isImage(file) {
  return typeof file.mimeType === 'string' && file.mimeType.startsWith('image/');
}

/**
 * หาวันที่ที่ "ถูกต้องที่สุด" ของรูป:
 * 1) วันที่ถ่ายจริงจาก EXIF (imageMediaMetadata.time) ถ้ามี
 * 2) ไม่งั้น fallback เป็นวันที่ไฟล์ถูกสร้างใน Drive (createdTime)
 */
function resolveTakenDate(file) {
  const exifTime = file.imageMediaMetadata && file.imageMediaMetadata.time;
  return exifTime || file.createdTime;
}

const upsertStmt = db.prepare(`
  INSERT INTO photos (
    id, name, folder_path, parent_folder_id, mime_type,
    taken_date, created_time, modified_time, size,
    thumbnail_link, web_view_link, web_content_link,
    year, month, indexed_at
  ) VALUES (
    @id, @name, @folder_path, @parent_folder_id, @mime_type,
    @taken_date, @created_time, @modified_time, @size,
    @thumbnail_link, @web_view_link, @web_content_link,
    @year, @month, @indexed_at
  )
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    folder_path=excluded.folder_path,
    parent_folder_id=excluded.parent_folder_id,
    mime_type=excluded.mime_type,
    taken_date=excluded.taken_date,
    created_time=excluded.created_time,
    modified_time=excluded.modified_time,
    size=excluded.size,
    thumbnail_link=excluded.thumbnail_link,
    web_view_link=excluded.web_view_link,
    web_content_link=excluded.web_content_link,
    year=excluded.year,
    month=excluded.month,
    indexed_at=excluded.indexed_at
`);

// รวมหลาย insert เข้าใน 1 transaction -> เร็วกว่ายิงทีละแถวมาก (สำคัญมากตอนมีรูปเป็นแสน)
const upsertMany = db.transaction((rows) => {
  for (const row of rows) upsertStmt.run(row);
});

/**
 * สแกนแบบ recursive ไล่ทุก Folder และ Sub-folder เริ่มจาก rootFolderId
 * ใช้ queue (BFS) แทน recursion function call เพื่อไม่ให้ stack ลึกเกินไป
 * เมื่อโครงสร้างโฟลเดอร์ใหญ่มาก
 */
async function scanDrive(rootFolderId, rootPath = '') {
  const drive = getDriveClient();
  const queue = [{ id: rootFolderId, path: rootPath }];

  let filesScanned = 0;
  let foldersScanned = 0;
  const buffer = [];
  const BATCH_SIZE = 500;

  while (queue.length > 0) {
    const { id: folderId, path: folderPath } = queue.shift();
    foldersScanned += 1;

    const children = await listChildren(drive, folderId);

    for (const file of children) {
      if (isFolder(file)) {
        queue.push({ id: file.id, path: `${folderPath}/${file.name}` });
        continue;
      }

      if (!isImage(file)) continue;

      const takenDate = resolveTakenDate(file);
      const dateObj = takenDate ? new Date(takenDate) : null;

      buffer.push({
        id: file.id,
        name: file.name,
        folder_path: folderPath || '/',
        parent_folder_id: folderId,
        mime_type: file.mimeType,
        taken_date: takenDate || null,
        created_time: file.createdTime || null,
        modified_time: file.modifiedTime || null,
        size: file.size ? Number(file.size) : null,
        thumbnail_link: file.thumbnailLink || null,
        web_view_link: file.webViewLink || null,
        web_content_link: file.webContentLink || null,
        year: dateObj ? dateObj.getFullYear() : null,
        month: dateObj ? dateObj.getMonth() + 1 : null,
        indexed_at: new Date().toISOString(),
      });
      filesScanned += 1;

      if (buffer.length >= BATCH_SIZE) {
        upsertMany(buffer.splice(0, buffer.length));
      }
    }
  }

  if (buffer.length > 0) upsertMany(buffer);

  return { filesScanned, foldersScanned };
}

/**
 * ฟังก์ชันหลักที่ถูกเรียกโดย cron job หรือ endpoint /api/scan/trigger
 * บันทึกผลลง scan_log ด้วยเพื่อ debug/ดูสถานะย้อนหลังได้
 */
async function runFullScan() {
  const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId) {
    throw new Error('ยังไม่ได้ตั้งค่า DRIVE_ROOT_FOLDER_ID ใน .env');
  }

  const startedAt = new Date().toISOString();
  const insertLog = db.prepare(
    `INSERT INTO scan_log (started_at, status) VALUES (?, 'running')`
  );
  const logId = insertLog.run(startedAt).lastInsertRowid;

  try {
    const result = await scanDrive(rootFolderId, '');

    db.prepare(
      `UPDATE scan_log SET finished_at = ?, files_scanned = ?, folders_scanned = ?, status = 'success' WHERE id = ?`
    ).run(new Date().toISOString(), result.filesScanned, result.foldersScanned, logId);

    console.log(
      `[Scanner] เสร็จสิ้น: พบรูป ${result.filesScanned} ไฟล์ ใน ${result.foldersScanned} โฟลเดอร์`
    );
    return result;
  } catch (err) {
    db.prepare(
      `UPDATE scan_log SET finished_at = ?, status = 'error', error = ? WHERE id = ?`
    ).run(new Date().toISOString(), String(err.message || err), logId);
    console.error('[Scanner] เกิดข้อผิดพลาด:', err);
    throw err;
  }
}

module.exports = { runFullScan, scanDrive };
