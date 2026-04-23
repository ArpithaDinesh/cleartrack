export const API_ROOT = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
console.log('📡 ClearTrack API Base URL:', BASE_URL);

// Helper: get auth headers
const authHeaders = () => {
  const token = localStorage.getItem('cleartrack_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Generic request with timeout support
const request = async (method, path, body = null, isFormData = false, timeoutMs = 30000) => {
  const headers = { ...authHeaders() };
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

// Auth
export const authAPI = {
  loginStudent: (email, password) => request('POST', '/auth/login', { email, password, role: 'student' }),
  loginTeacher: (email, password) => request('POST', '/auth/login', { email, password, role: 'staff' }),
  loginAdmin: (email, password) => request('POST', '/auth/login', { email, password, role: 'admin' }),
  registerStudent: (data) => request('POST', '/auth/register/student', data),
  registerTeacher: (data) => request('POST', '/auth/register/staff-public', { ...data, role: 'staff' }),
  registerAdmin: (data) => request('POST', '/auth/register/staff-public', { ...data, role: 'admin' }),
  getMe: () => request('GET', '/auth/me'),
};

// Clearance
export const clearanceAPI = {
  submitRequest: (formData) => request('POST', '/clearance/submit', formData, true),
  submitAllRequests: () => request('POST', '/clearance/submit-all'),
  getMyRequests: () => request('GET', '/clearance/my'),
  getRequest: (id) => request('GET', `/clearance/${id}`),
  getRequestLogs: (id) => request('GET', `/clearance/${id}/logs`),
  getDepartmentPending: () => request('GET', '/clearance/department/pending'),
  reviewRequest: (id, decision, remarks) => request('PATCH', `/clearance/${id}/review`, { decision, remarks }),
  getAllRequests: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/clearance/admin/all?${q}`);
  },
};

// OCR — longer timeout since Tesseract can take up to 30s
export const ocrAPI = {
  processOCR: (requestId) => request('POST', `/ocr/process/${requestId}`, null, false, 60000),
  confirmOCR: (requestId, data) => request('PATCH', `/ocr/confirm/${requestId}`, data),
};

// User API (Profile)
export const userAPI = {
  getProfile: () => request('GET', '/users/profile'), // fallback to auth/me if /users/profile doesn't exist
  updateProfile: (data) => request('PATCH', '/users/profile', data),
  getMyStudents: () => request('GET', '/users/my-students')
};

// Admin
export const adminAPI = {
  getStats: () => request('GET', '/admin/stats'),
  getUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/admin/users?${q}`);
  },
  toggleUser: (id) => request('PATCH', `/admin/users/${id}/toggle`),
  createStaff: (data) => request('POST', '/admin/staff', data),
  getLogs: () => request('GET', '/admin/logs'),
};

// Bus Routes
export const busAPI = {
  getRoutes: () => request('GET', '/bus-routes'),
  createRoute: (data) => request('POST', '/bus-routes', data),
  updateRoute: (id, data) => request('PUT', `/bus-routes/${id}`, data),
  deleteRoute: (id) => request('DELETE', `/bus-routes/${id}`),
  seedRoutes: () => request('POST', '/bus-routes/seed')
};

export const tuitionFeeAPI = {
  getFees: () => request('GET', '/tuition-fees'),
  updateFee: (data) => request('POST', '/tuition-fees/update', data)
};
