# ระบบค้นหารูปภาพองค์กร (Photo Search System) — Planbmedia

ระบบเว็บไซต์สำหรับค้นหารูปภาพที่เก็บอยู่ใน Google Drive ขององค์กร รองรับรูปภาพ
100,000+ ไฟล์ ค้นหาตามช่วงเวลาได้ อ่านทุก Folder/Sub-folder อัตโนมัติ และ
บังคับ Login เฉพาะอีเมล `@planbmedia.co.th`

## 1. โครงสร้างระบบ

```
photo-search-system/
├── backend/     Node.js + Express API (Auth, Search, Scanner)
└── frontend/    React + Vite (หน้าเว็บค้นหารูปภาพ)
```

**หลักการสำคัญ:** เว็บไซต์ "ไม่ได้" ไปอ่าน Google Drive สดๆ ทุกครั้งที่ค้นหา
เพราะจะช้ามากเมื่อมีรูปเป็นแสนไฟล์ แทนที่จะทำแบบนั้น ระบบมี **Scanner**
ที่วิ่งไล่อ่านทุก Folder/Sub-folder ใน Google Drive เป็นระยะ (ตั้งเวลาอัตโนมัติ)
แล้วบันทึก "ข้อมูลรูปภาพ" (ชื่อ, วันที่, ลิงก์รูป ฯลฯ) ลงฐานข้อมูล SQLite ของเราเอง
หน้าเว็บจะค้นหาจากฐานข้อมูลนี้เท่านั้น ทำให้ค้นหาเร็วมากแม้มีรูปเป็นแสนเป็นล้านไฟล์

```
Google Drive (เก็บรูปจริง)
        │
        │  1) Scanner สแกนทุก Folder/Sub-folder ตามรอบเวลา
        ▼
SQLite Database (เก็บ metadata: ชื่อ, วันที่, ลิงก์ thumbnail)
        │
        │  2) หน้าเว็บ query จากฐานข้อมูลนี้ (เร็ว)
        ▼
   ผู้ใช้ค้นหา/ดูรูปผ่านเว็บไซต์
```

## 2. สิ่งที่ต้องเตรียมก่อนติดตั้ง

### 2.1 สร้าง Google Cloud Project
ไปที่ https://console.cloud.google.com แล้วสร้างโปรเจกต์ใหม่ (หรือใช้ของเดิม)
เปิดใช้งาน API: **Google Drive API**

### 2.2 สร้าง OAuth Client (สำหรับหน้า Login ของผู้ใช้)
1. ไปที่ **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs: `http://localhost:4000/auth/google/callback`
   (ตอน deploy จริงเปลี่ยนเป็นโดเมนจริง เช่น `https://photos.planbmedia.co.th/auth/google/callback`)
4. คัดลอก **Client ID** และ **Client Secret** ไปใส่ในไฟล์ `.env` ของ backend

### 2.3 สร้าง Service Account (สำหรับ Scanner อ่านไฟล์ใน Drive)
1. ไปที่ **APIs & Services → Credentials → Create Credentials → Service Account**
2. สร้างเสร็จแล้วเข้าไปที่ Service Account นั้น → แท็บ **Keys → Add Key → JSON**
3. ดาวน์โหลดไฟล์ JSON มาวางไว้ที่ `backend/service-account-key.json`
4. **สำคัญ:** คัดลอกอีเมลของ Service Account (รูปแบบ `xxx@xxx.iam.gserviceaccount.com`)
   แล้วไปที่ Google Drive → คลิกขวาที่โฟลเดอร์หลักที่เก็บรูปทั้งหมด → **Share**
   → นำอีเมลนี้ไปแชร์สิทธิ์ **Viewer**
   (ถ้าใช้ Shared Drive ให้เพิ่ม Service Account เป็นสมาชิกของ Shared Drive แทน)

### 2.4 หา Folder ID ของโฟลเดอร์หลัก
เปิดโฟลเดอร์หลักที่เก็บรูปทั้งหมดใน Google Drive แล้วดู URL:
```
https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt
                                          └────────┬────────┘
                                          นี่คือ DRIVE_ROOT_FOLDER_ID
```

## 3. วิธีติดตั้งและรัน (Development)

### Backend
```bash
cd backend
cp .env.example .env
# แก้ไขค่าต่างๆ ใน .env ตามที่เตรียมไว้ในข้อ 2
npm install
npm run dev          # รันที่ http://localhost:4000
```

ทดสอบว่า Scanner ต่อ Google Drive ได้ถูกต้องหรือไม่ (ไม่ต้องเปิด server ก็รันได้):
```bash
npm run scan:now
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev           # รันที่ http://localhost:5173
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:5173` แล้วกด "เข้าสู่ระบบด้วย Google"
ระบบจะอนุญาตเฉพาะบัญชีที่ลงท้ายด้วย `@planbmedia.co.th` เท่านั้น

## 4. Deploy ขึ้นใช้งานจริง (ให้คนอื่นเข้าถึงได้ — ตรงข้อ 6)

แนะนำแนวทางที่ทำได้ง่ายและดูแลรักษาง่าย:

| ส่วน | แนะนำให้ deploy ที่ | หมายเหตุ |
|---|---|---|
| Source code | **GitHub** (private repository ขององค์กร) | ทีมช่วยกันดูแล/แก้โค้ดได้ |
| Backend API | Railway / Render / เซิร์ฟเวอร์ภายในองค์กร | ต้องตั้ง environment variables ให้ครบ |
| Frontend | Vercel / Netlify | build แล้ว deploy อัตโนมัติจาก GitHub |
| รูปภาพจริง | Google Drive (Shared Drive) | ตามที่ออกแบบไว้ |
| ฐานข้อมูล index | SQLite ไฟล์เดียวบน volume ของ backend server | ถ้าต้องการ scale สูงมากในอนาคต ย้ายไป PostgreSQL ได้ทันที เพราะ query เป็น SQL มาตรฐาน |

**ขั้นตอนคร่าวๆ:**
1. Push โค้ดนี้ขึ้น GitHub repository ขององค์กร (ตั้งเป็น Private)
2. ต่อ backend เข้ากับ Railway/Render → ตั้งค่า Environment Variables ตาม `.env.example`
   → อัปโหลดไฟล์ `service-account-key.json` เป็น Secret File
3. ต่อ frontend เข้ากับ Vercel → ตั้งค่า `VITE_API_URL` เป็น URL ของ backend ที่ deploy แล้ว
4. อัปเดต **Authorized redirect URI** ใน Google Cloud Console ให้เป็นโดเมนจริง
5. เพิ่มโดเมน production ใน `FRONTEND_URL` ของ backend `.env`

## 5. อธิบายการทำงานตามข้อกำหนดแต่ละข้อ

| ข้อ | สิ่งที่ทำ | อยู่ที่ไฟล์ |
|---|---|---|
| 1. ระบบหารูปผ่านเว็บ | เว็บ React ค้นหา + กรอง + preview | `frontend/src/App.jsx` |
| 2. เก็บรูป 1 แสน+ | Metadata อยู่ใน SQLite ที่มี index รองรับได้หลักล้านแถวสบายๆ, รูปจริงเก็บใน Google Drive ไม่จำกัดจำนวนจริงๆ | `backend/src/config/db.js` |
| 3. ค้นหาตามช่วงเวลา เช่น ปี 2025 | Filter `year`, `startDate`, `endDate` ใน API search | `backend/src/routes/photos.js`, `frontend/src/components/DateRangeFilter.jsx` |
| 4. อ่านทุก Folder/Sub-folder | Scanner แบบ BFS recursive ไล่ทุกโฟลเดอร์ | `backend/src/services/driveScanner.js` |
| 5. เร็ว ไม่ค้าง | Query จาก DB (ไม่ยิง Drive สด), index บนคอลัมน์วันที่, thumbnail ขนาดเล็ก, infinite scroll แบ่งหน้าโหลด | `backend/src/config/db.js`, `frontend/src/components/PhotoGrid.jsx` |
| 6. เขียนบน GitHub / รูปบน Google Drive | Source code เก็บบน GitHub repo, รูปเก็บบน Google Drive | โครงสร้างทั้งโปรเจกต์ |
| 7. Login เฉพาะ @planbmedia.co.th | Google OAuth + ตรวจ domain 2 ชั้น (login + ทุก request) | `backend/src/config/passport.js`, `backend/src/middleware/authMiddleware.js` |
| 8. UX/UI ง่าย | หน้าเดียว: ค้นหา + ตัวกรองวันที่แบบปุ่มลัด + grid รูป + preview | `frontend/src/App.jsx` และ components ที่เกี่ยวข้อง |

## 6. คำถามที่พบบ่อย

**Q: ทำไมไม่ใช้ Google Drive API ค้นหาสดๆ เลย ไม่ต้องมีฐานข้อมูลแยก?**
A: Google Drive API มี rate limit และการ query ตามเงื่อนไขซับซ้อน (เช่น ช่วงวันที่ +
ชื่อไฟล์ + โฟลเดอร์) จะช้ามากเมื่อมีไฟล์เป็นแสน การมีฐานข้อมูล index ของเราเอง
ทำให้ค้นหาเร็วระดับมิลลิวินาที ไม่ว่าจะมีรูปกี่แสนไฟล์ก็ตาม

**Q: ถ้ารูปเยอะมากจนต้องการความเร็วสูงขึ้นอีก ทำอย่างไร?**
A: ย้ายจาก SQLite ไป PostgreSQL (โค้ด SQL เกือบเหมือนเดิม แก้ไม่มาก) และเพิ่ม
Redis cache สำหรับคำค้นหาที่ถูกเรียกบ่อย

**Q: ต้องสแกนใหม่ทุกครั้งที่มีรูปเพิ่มไหม?**
A: ระบบตั้งเวลาสแกนอัตโนมัติทุก 15 นาที (ปรับได้ที่ `SCAN_CRON` ใน `.env`)
และมีปุ่ม "🔄 ซิงค์รูปภาพ" ให้กดสแกนทันทีได้จากหน้าเว็บเลย
