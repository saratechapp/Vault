// Stable per-browser-install id for this web client, so the backend's
// per-device session table (0022_sessions.sql) and the email-OTP 2FA
// step-up gate (0023) — both previously mobile-only because only the mobile
// app sent `x-session-id` — also work on the web.
//
// The id is a random UUID kept in localStorage. It is NOT user-scoped: it
// identifies the browser install, and the backend pairs it with the user id
// on `POST /api/login-events`. Clearing site data starts a new "device".

const KEY = 'wallet-web-session-id';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getWebSessionId() {
  if (typeof localStorage === 'undefined') return null;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// A short human label for the Sessions list ("Chrome on macOS · Web").
export function getWebDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Web';
  return `${browser} on ${os} · Web`;
}
