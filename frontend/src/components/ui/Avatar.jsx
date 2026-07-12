import { useState } from 'react';

function initialsOf(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// Falls back to the user's initials on a solid background whenever the
// external avatar URL (dicebear, Google profile photo, ...) fails to load —
// blocked by an ad-blocker/privacy extension, offline, expired, etc. — so
// the UI never shows a blank/broken image.
export function Avatar({ src, name, className = '' }) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-brand-500 to-accent-purple font-display font-bold text-white ${className}`}
      >
        {initialsOf(name)}
      </div>
    );
  }

  return <img src={src} alt="" onError={() => setErrored(true)} className={className} />;
}

export default Avatar;
