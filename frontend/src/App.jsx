import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  API_BASE,
  fetchCurrentUser,
  logout,
  searchPhotos,
  fetchYears,
  triggerScan,
} from './api/client';
import DateRangeFilter from './components/DateRangeFilter';
import PhotoGrid from './components/PhotoGrid';
import Lightbox from './components/Lightbox';

const PAGE_SIZE = 40;

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = ยังไม่เช็ค, null = ยังไม่ login
  const [loginError, setLoginError] = useState(null);

  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebouncedValue(searchText, 400);
  const [filters, setFilters] = useState({ year: '', startDate: '', endDate: '' });
  const [years, setYears] = useState([]);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [scanMessage, setScanMessage] = useState('');

  // เช็คสถานะ login ตอนเปิดหน้าเว็บ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'domain_not_allowed') {
      setLoginError('อนุญาตเฉพาะอีเมลบริษัท (@planbmedia.co.th) เท่านั้น');
    }
    fetchCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user) {
      fetchYears().then(setYears).catch(() => {});
    }
  }, [user]);

  const queryParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      year: filters.year || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, filters]
  );

  // เมื่อเงื่อนไขค้นหาเปลี่ยน ให้เริ่มหน้า 1 ใหม่เสมอ
  useEffect(() => {
    if (!user) return;
    setPage(1);
    setItems([]);
    loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryParams]);

  const loadPage = useCallback(
    async (pageToLoad, replace = false) => {
      setLoading(true);
      try {
        const data = await searchPhotos({ ...queryParams, page: pageToLoad });
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(pageToLoad);
      } finally {
        setLoading(false);
      }
    },
    [queryParams]
  );

  const handleLoadMore = () => {
    if (page < totalPages && !loading) {
      loadPage(page + 1, false);
    }
  };

  const handleScan = async () => {
    setScanMessage('กำลังสั่งซิงค์รูปภาพจาก Google Drive...');
    try {
      await triggerScan();
      setScanMessage('เริ่มซิงค์แล้ว ระบบจะอัปเดตรูปใหม่ในเบื้องหลัง (ใช้เวลาสักครู่)');
    } catch (e) {
      setScanMessage('ซิงค์ไม่สำเร็จ: ' + (e?.response?.data?.error || e.message));
    }
    setTimeout(() => setScanMessage(''), 5000);
  };

  // ---- หน้า Login ----
  if (user === undefined) {
    return <div className="loading-state">กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</div>;
  }

  if (user === null) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>ระบบค้นหารูปภาพองค์กร</h1>
          <p>เข้าสู่ระบบด้วยอีเมลบริษัท (@planbmedia.co.th) เท่านั้น</p>
          {loginError && <div className="login-error">{loginError}</div>}
          <a className="btn btn-primary" href={`${API_BASE}/auth/google`} style={{ display: 'inline-block', width: '100%' }}>
            เข้าสู่ระบบด้วย Google
          </a>
        </div>
      </div>
    );
  }

  // ---- หน้าเว็บหลัก ----
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="dot" />
          Photo Search — Planbmedia
        </div>
        <div className="user-box">
          <button className="btn" onClick={handleScan} title="ดึงรูปใหม่ล่าสุดจาก Google Drive">
            🔄 ซิงค์รูปภาพ
          </button>
          {user.avatar && <img src={user.avatar} alt="" />}
          <span>{user.email}</span>
          <button
            className="btn"
            onClick={async () => {
              await logout();
              setUser(null);
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </header>

      {scanMessage && <div className="result-meta">{scanMessage}</div>}

      <div className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="ค้นหาชื่อไฟล์รูปภาพ..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <DateRangeFilter years={years} filters={filters} onChange={setFilters} />
      </div>

      <div className="result-meta">
        พบทั้งหมด {total.toLocaleString('th-TH')} รูป
      </div>

      <PhotoGrid
        items={items}
        loading={loading}
        hasMore={page < totalPages}
        onLoadMore={handleLoadMore}
        onSelect={setSelectedPhoto}
      />

      <Lightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
    </div>
  );
}
