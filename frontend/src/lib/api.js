import { readPrefs, getCurrencyMeta } from './preferences.js';
import { supabase } from './supabaseClient.js';
import { touchActivity, clearActivity, isIdleExpired, markSessionExpired, markAccountSuspended } from './idleSession.js';

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function forceSignOutToLogin() {
  await supabase.auth.signOut();
  clearActivity();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request(path, options = {}) {
  const token = await getToken();

  // Backstop for the idle timeout regardless of whether a JS timer ever got
  // a chance to run — every authenticated call re-checks real elapsed time
  // against the persisted last-activity timestamp before it's allowed through.
  if (token && isIdleExpired()) {
    markSessionExpired();
    await forceSignOutToLogin();
    throw new Error('Session expired due to inactivity');
  }
  if (token) touchActivity();

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    await forceSignOutToLogin();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'unauthorized');
  }

  if (res.status === 304) return null;

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // A suspended account (admin action) keeps a technically-valid Supabase
    // session, so it wouldn't otherwise trip the 401 handler above — every
    // subsequent call would just fail silently on whatever page happened to
    // run first. Treat it the same as an expired session: sign out with a
    // clear, one-time reason shown on the next Login page render.
    if (res.status === 403 && body.error === 'account_suspended') {
      markAccountSuspended();
      await forceSignOutToLogin();
    }
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body || {}) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

// ---- dashboard ----
export const dashboardApi = { get: () => api.get('/dashboard') };

// ---- categories ----
export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (payload) => api.post('/categories', payload),
  update: (id, payload) => api.patch(`/categories/${id}`, payload),
  remove: (id) => api.delete(`/categories/${id}`),
};

// ---- accounts ----
export const accountsApi = {
  list: () => api.get('/accounts'),
  create: (payload) => api.post('/accounts', payload),
  update: (id, payload) => api.patch(`/accounts/${id}`, payload),
  remove: (id) => api.delete(`/accounts/${id}`),
};

// ---- transactions ----
export const transactionsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== 'all')).toString();
    return api.get(`/transactions${qs ? `?${qs}` : ''}`);
  },
  create: (payload) => api.post('/transactions', payload),
  update: (id, payload) => api.patch(`/transactions/${id}`, payload),
  bulk: (rows) => api.post('/transactions/bulk', { rows }),
  remove: (id) => api.delete(`/transactions/${id}`),
};

// ---- budgets (envelope stats are derived; "limit" is an optional manual cap) ----
export const budgetsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
    return api.get(`/budgets${qs ? `?${qs}` : ''}`);
  },
  create: (payload) => api.post('/budgets', payload),
  update: (id, payload) => api.patch(`/budgets/${id}`, payload),
  remove: (id) => api.delete(`/budgets/${id}`),
};

// ---- bills ----
export const billsApi = {
  list: () => api.get('/bills'),
  create: (payload) => api.post('/bills', payload),
  update: (id, payload) => api.patch(`/bills/${id}`, payload),
  run: (id) => api.post(`/bills/${id}/run`),
  remove: (id) => api.delete(`/bills/${id}`),
};

// ---- goals ----
export const goalsApi = {
  list: () => api.get('/goals'),
  create: (payload) => api.post('/goals', payload),
  update: (id, payload) => api.patch(`/goals/${id}`, payload),
  remove: (id) => api.delete(`/goals/${id}`),
  contribute: (id, payload) => api.post(`/goals/${id}/contribute`, payload),
};

// ---- debts ----
export const debtsApi = {
  list: () => api.get('/debts'),
  create: (payload) => api.post('/debts', payload),
  update: (id, payload) => api.patch(`/debts/${id}`, payload),
  remove: (id) => api.delete(`/debts/${id}`),
  pay: (id, payload) => api.post(`/debts/${id}/payment`, payload),
};

// ---- templates ----
export const templatesApi = {
  list: () => api.get('/templates'),
  create: (payload) => api.post('/templates', payload),
  update: (id, payload) => api.patch(`/templates/${id}`, payload),
  remove: (id) => api.delete(`/templates/${id}`),
};

// ---- feedback ----
export const feedbackApi = {
  list: () => api.get('/feedback'),
  get: (id) => api.get(`/feedback/${id}`),
  create: (payload) => api.post('/feedback', payload),
  reply: (id, body) => api.post(`/feedback/${id}/messages`, { body }),
  confirm: (id, payload) => api.post(`/feedback/${id}/confirm`, payload),
};

// ---- notifications ----
export const notificationsApi = {
  list: () => api.get('/notifications'),
  update: (id, payload) => api.patch(`/notifications/${id}`, payload),
  readAll: () => api.post('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
};

// ---- reports ----
export const reportsApi = { get: () => api.get('/reports') };

// ---- AI insights ----
export const aiApi = {
  insights: () => api.get('/ai/insights'),
  monthlyReport: (month) => api.get(`/ai/monthly-report${month ? `?month=${month}` : ''}`),
};

// ---- dashboard layout (custom widget grid, synced across devices) ----
export const dashboardLayoutApi = {
  get: () => api.get('/dashboard-layout'),
  save: (payload) => api.put('/dashboard-layout', payload),
};

// ---- formatting ----
export function formatCurrency(n, symbol) {
  const prefs = readPrefs();
  const meta = getCurrencyMeta(prefs.currency);
  const sym = symbol || meta.symbol;
  const val = Math.abs(Number(n) || 0);
  return `${n < 0 ? '-' : ''}${sym}${val.toLocaleString(meta.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const prefs = readPrefs();
  const day = String(d.getDate()).padStart(2, '0');
  const monNum = String(d.getMonth() + 1).padStart(2, '0');
  const monShort = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  switch (prefs.dateFormat) {
    case 'MM/DD/YYYY':
      return `${monNum}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${monNum}-${day}`;
    case 'DD MMM YYYY':
      return `${day} ${monShort} ${year}`;
    default:
      return `${day}/${monNum}/${year}`;
  }
}
