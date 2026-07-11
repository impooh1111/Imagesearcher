import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// withCredentials: true -> จำเป็นเพื่อส่ง session cookie ไปกับทุก request
// (ระบบใช้ session-based auth ผ่าน Google OAuth ไม่ใช่ token ที่เก็บใน localStorage)
export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const API_BASE = API_URL;

export async function fetchCurrentUser() {
  const res = await apiClient.get('/auth/me');
  return res.data.user;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}

export async function searchPhotos(params) {
  const res = await apiClient.get('/api/photos/search', { params });
  return res.data;
}

export async function fetchYears() {
  const res = await apiClient.get('/api/photos/meta/years');
  return res.data;
}

export async function fetchPackages() {
  const res = await apiClient.get('/api/photos/meta/packages');
  return res.data;
}

export async function fetchFolders(params) {
  const res = await apiClient.get('/api/photos/meta/folders', { params });
  return res.data;
}

export async function fetchProducts(params) {
  const res = await apiClient.get('/api/photos/meta/products', { params });
  return res.data;
}

export async function triggerScan() {
  const res = await apiClient.post('/api/scan/trigger');
  return res.data;
}

export async function fetchScanStatus() {
  const res = await apiClient.get('/api/scan/status');
  return res.data;
}
