export default function Lightbox({ photo, onClose }) {
  if (!photo) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="ปิด">
        ✕
      </button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-img-wrap">
          {/* ใช้ thumbnail ขนาดใหญ่ขึ้นแทนไฟล์เต็มเพื่อความเร็ว
              ถ้าต้องการไฟล์ต้นฉบับจริง ให้กดปุ่ม "เปิดใน Drive" ด้านล่าง */}
          <img
            src={photo.thumbnail_link?.replace(/=s\d+$/, '=s1600')}
            alt={photo.name}
          />
        </div>
        <div className="lightbox-footer">
          <div>
            <div className="name">{photo.name}</div>
            <div className="meta">
              {photo.folder_path} ·{' '}
              {photo.taken_date
                ? new Date(photo.taken_date).toLocaleDateString('th-TH')
                : 'ไม่ทราบวันที่'}
            </div>
          </div>
          <div className="actions">
            <a
              className="btn"
              href={photo.web_view_link}
              target="_blank"
              rel="noreferrer"
            >
              เปิดใน Drive
            </a>
            <a
              className="btn btn-primary"
              href={photo.web_content_link}
              target="_blank"
              rel="noreferrer"
            >
              ดาวน์โหลด
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
