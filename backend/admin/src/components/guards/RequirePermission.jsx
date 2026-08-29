import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { hasPermission } from '../../lib/permissions.js';

// Client-side nav/route gating only — the real boundary is
// requirePermission on the server (backend/middleware/adminAuth.js), which
// every route under here still hits regardless of what's shown/hidden.
export function RequirePermission({ module, action, children }) {
  const { admin } = useAdminAuth();
  if (!hasPermission(admin, module, action)) return <Navigate to="/" replace />;
  return children;
}

export default RequirePermission;
