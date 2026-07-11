import { useState } from 'react';

const currentYear = new Date().getFullYear();

/**
 * ตัวกรองช่วงเวลา:
 * - ปุ่มลัด "ปีนี้ / ปีที่แล้ว / กำหนดเอง" ตามข้อ 8 (UX เข้าใจง่าย)
 * - ถ้าเลือก "กำหนดเอง" จะโชว์ date picker 2 ช่อง (startDate / endDate)
 * - ถ้าเลือกปีจาก dropdown จะ query ด้วย year (เร็วกว่า เพราะมี index เฉพาะ)
 */
export default function DateRangeFilter({ years, filters, onChange }) {
  const [mode, setMode] = useState('all'); // all | thisYear | lastYear | custom

  function selectYear(year) {
    onChange({ ...filters, year, startDate: '', endDate: '' });
  }

  function handleQuick(key) {
    setMode(key);
    if (key === 'all') {
      onChange({ ...filters, year: '', startDate: '', endDate: '' });
    } else if (key === 'thisYear') {
      selectYear(currentYear);
    } else if (key === 'lastYear') {
      selectYear(currentYear - 1);
    }
  }

  return (
    <>
      <div className="quick-filters">
        <button
          className={`chip ${mode === 'all' ? 'active' : ''}`}
          onClick={() => handleQuick('all')}
        >
          ทั้งหมด
        </button>
        <button
          className={`chip ${mode === 'thisYear' ? 'active' : ''}`}
          onClick={() => handleQuick('thisYear')}
        >
          ปีนี้ ({currentYear})
        </button>
        <button
          className={`chip ${mode === 'lastYear' ? 'active' : ''}`}
          onClick={() => handleQuick('lastYear')}
        >
          ปีที่แล้ว ({currentYear - 1})
        </button>
        <button
          className={`chip ${mode === 'custom' ? 'active' : ''}`}
          onClick={() => setMode('custom')}
        >
          กำหนดช่วงเอง
        </button>
      </div>

      <select
        value={filters.year || ''}
        onChange={(e) => {
          setMode('year-select');
          onChange({ ...filters, year: e.target.value, startDate: '', endDate: '' });
        }}
      >
        <option value="">เลือกปี...</option>
        {years.map((y) => (
          <option key={y.year} value={y.year}>
            {y.year} ({y.count.toLocaleString('th-TH')} รูป)
          </option>
        ))}
      </select>

      {mode === 'custom' && (
        <>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              onChange({ ...filters, year: '', startDate: e.target.value })
            }
          />
          <span style={{ color: '#6b7280' }}>ถึง</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onChange({ ...filters, year: '', endDate: e.target.value })}
          />
        </>
      )}
    </>
  );
}
