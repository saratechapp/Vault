import { supabase } from './supabaseClient.js';

// Near-identical to frontend/src/lib/api.js's request wrapper, just pointed
// at /api/admin and without the idle-timeout/preferences plumbing that only
// makes sense for the consumer app.
async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function forceSignOutToLogin() {
  await supabase.auth.signOut();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request(path, options = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/admin${path}`, { ...options, headers });

  if (res.status === 401) {
    await forceSignOutToLogin();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
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
