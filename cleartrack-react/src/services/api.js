export const API_ROOT = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper: get auth headers
const authHeaders = () => {
  const token = localStorage.getItem('cleartrack_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Generic request
const request = async (method, path, body = null, isFormData = false) => {
  const headers = { ...authHeaders() };
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : null
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
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

// OCR
export const ocrAPI = {
  processOCR: (requestId) => request('POST', `/ocr/process/${requestId}`),
  confirmOCR: (requestId, data) => request('PATCH', `/ocr/confirm/${requestId}`, data),
};

// User API (Profile)
export const userAPI = {
  getProfile: () => request('GET', '/users/profile'), // fallback to auth/me if /users/profile doesn't exist
  updateProfile: (data) => request('PATCH', '/users/profile', data)
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
