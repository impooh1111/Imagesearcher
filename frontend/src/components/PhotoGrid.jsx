import { useEffect, useRef } from 'react';

/**
 * แสดงรูปแบบ grid โดย:
 * - โหลดรูปทีละหน้า (pagination) ไม่โหลดทั้งแสนรูปพร้อมกัน -> ไม่ค้าง (ข้อ 5)
 * - ใช้ IntersectionObserver ทำ infinite scroll: เลื่อนใกล้ล่างสุดค่อยโหลดหน้าถัดไป
 * - ใช้ thumbnailLink ขนาดเล็กจาก Google Drive ไม่ใช่รูปเต็ม -> โหลดเร็ว
 * - loading="lazy" ให้ browser ช่วยหน่วงโหลดรูปที่ยังไม่เข้า viewport
 */
export default function PhotoGrid({ items, loading, hasMore, onLoadMore, onSelect }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' } // เริ่มโหลดล่วงหน้าก่อนถึงล่างสุดจริงๆ ให้รู้สึกลื่นไม่กระตุก
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!loading && items.length === 0) {
    return <div className="empty-state">ไม่พบรูปภาพที่ตรงกับเงื่อนไขการค้นหา</div>;
  }

  return (
    <>
      <div className="photo-grid">
        {items.map((photo) => (
          <div
            key={photo.id}
            className="photo-card"
            onClick={() => onSelect(photo)}
          >
            <div className="photo-thumb-wrap">
              <img
                src={`http://localhost:4000/api/photos/${photo.id}/thumbnail`}
                alt={photo.name}
                loading="lazy"
                onError={(e) => {
                  e.target.style.opacity = 0.2;
                }}
              />
            </div>
            <div className="photo-info">
              <div className="name" title={photo.name}>
                {photo.name}
              </div>
              <div className="date">
                {photo.taken_date
                  ? new Date(photo.taken_date).toLocaleDateString('th-TH')
                  : '-'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="loading-state">กำลังโหลดรูปภาพ...</div>}
      <div ref={sentinelRef} className="sentinel" />
    </>
  );
}
