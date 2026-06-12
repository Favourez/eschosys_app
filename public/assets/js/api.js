/* ============================================================
   ESIMS API Client
   ============================================================ */
const API_BASE = '/api';

const Auth = {
  key: 'esims_auth',
  get()     { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; } },
  set(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  clear()   { localStorage.removeItem(this.key); },
  token()   { return this.get()?.token || ''; },
  user()    { return this.get()?.user || null; },
  isLoggedIn() { return !!this.token(); }
};

async function _fetch(method, endpoint, data = null, isForm = false) {
  const headers = { Authorization: `Bearer ${Auth.token()}` };
  if (!isForm && data) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (data) opts.body = isForm ? data : JSON.stringify(data);

  try {
    const res = await fetch(API_BASE + endpoint, opts);
    if (res.status === 401) {
      Auth.clear();
      window.location.href = '/index.html?expired=1';
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('API error:', err);
    return { success: false, message: 'Network error. Please check your connection.' };
  }
}

const API = {
  get:    (ep, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return _fetch('GET', ep + (qs ? '?' + qs : ''));
  },
  post:   (ep, data)     => _fetch('POST',   ep, data),
  put:    (ep, data)     => _fetch('PUT',    ep, data),
  patch:  (ep, data)     => _fetch('PATCH',  ep, data),
  delete: (ep)           => _fetch('DELETE', ep),
  upload: (ep, formData) => _fetch('POST',   ep, formData, true),

  // Shorthand modules
  auth:         { login: d => API.post('/auth/login', d), me: () => API.get('/auth/me'), logout: () => API.post('/auth/logout'), changePwd: d => API.put('/auth/change-password', d) },
  dashboard:    { stats: () => API.get('/dashboard/stats'), enrollTrend: () => API.get('/dashboard/enrollment-trend'), revenueTrend: () => API.get('/dashboard/revenue-trend'), programDist: () => API.get('/dashboard/program-distribution'), recentStudents: () => API.get('/dashboard/recent-students'), recentPayments: () => API.get('/dashboard/recent-payments'), genderDist: () => API.get('/dashboard/gender-distribution') },
  students:     { list: p => API.get('/students', p), get: id => API.get(`/students/${id}`), create: d => API.post('/students', d), update: (id,d) => API.put(`/students/${id}`, d), delete: id => API.delete(`/students/${id}`) },
  interns:      { list: p => API.get('/interns', p), get: id => API.get(`/interns/${id}`), create: d => API.post('/interns', d), update: (id,d) => API.put(`/interns/${id}`, d), delete: id => API.delete(`/interns/${id}`) },
  programs:     { list: () => API.get('/programs'), get: id => API.get(`/programs/${id}`), create: d => API.post('/programs', d), update: (id,d) => API.put(`/programs/${id}`, d), delete: id => API.delete(`/programs/${id}`) },
  courses:      { list: () => API.get('/courses'), get: id => API.get(`/courses/${id}`), create: d => API.post('/courses', d), update: (id,d) => API.put(`/courses/${id}`, d), delete: id => API.delete(`/courses/${id}`) },
  lecturers:    { list: p => API.get('/lecturers', p), get: id => API.get(`/lecturers/${id}`), create: d => API.post('/lecturers', d), update: (id,d) => API.put(`/lecturers/${id}`, d), delete: id => API.delete(`/lecturers/${id}`) },
  staff:        { list: p => API.get('/staff', p), get: id => API.get(`/staff/${id}`), create: d => API.post('/staff', d), update: (id,d) => API.put(`/staff/${id}`, d), delete: id => API.delete(`/staff/${id}`) },
  payments:     { list: p => API.get('/payments', p), get: id => API.get(`/payments/${id}`), byStudent: sid => API.get(`/payments/student/${sid}`), create: d => API.post('/payments', d), update: (id,d) => API.put(`/payments/${id}`, d), delete: id => API.delete(`/payments/${id}`) },
  results:      { list: p => API.get('/results', p), transcript: sid => API.get(`/results/transcript/${sid}`), create: d => API.post('/results', d), update: (id,d) => API.put(`/results/${id}`, d), delete: id => API.delete(`/results/${id}`) },
  certificates: { list: p => API.get('/certificates', p), get: id => API.get(`/certificates/${id}`), create: d => API.post('/certificates', d), update: (id,d) => API.put(`/certificates/${id}`, d), delete: id => API.delete(`/certificates/${id}`) },
  enrollment:   { list: p => API.get('/enrollment', p), create: d => API.post('/enrollment', d), update: (id,d) => API.put(`/enrollment/${id}`, d), delete: id => API.delete(`/enrollment/${id}`) },
  reports:      { students: p => API.get('/reports/students', p), payments: p => API.get('/reports/payments', p), outstanding: () => API.get('/reports/outstanding'), results: p => API.get('/reports/results', p), interns: () => API.get('/reports/interns') },
  users:        { list: () => API.get('/users'), roles: () => API.get('/users/roles'), auditLogs: p => API.get('/users/audit-logs', p), create: d => API.post('/users', d), update: (id,d) => API.put(`/users/${id}`, d), delete: id => API.delete(`/users/${id}`) },
  search:       q => API.get('/search', { q }),
  files:        { list: p => API.get('/files', p), upload: (ep,fd) => API.upload(ep, fd), delete: id => API.delete(`/files/${id}`) },
  notifs:       { list: () => API.get('/notifications'), readAll: () => API.put('/notifications/read-all'), read: id => API.put(`/notifications/${id}/read`) },
};
