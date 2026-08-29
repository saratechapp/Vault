import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext.jsx';
import { ThemeModeProvider } from './context/ThemeModeContext.jsx';
import { AdminShell } from './components/layout/AdminShell.jsx';
import { RequirePermission } from './components/guards/RequirePermission.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import UserList from './pages/Users/UserList.jsx';
import UserProfilePage from './pages/Users/UserProfilePage.jsx';
import AdminList from './pages/Admins/AdminList.jsx';
import RoleList from './pages/RBAC/RoleList.jsx';
import RoleEditor from './pages/RBAC/RoleEditor.jsx';
import FeedbackList from './pages/Feedback/FeedbackList.jsx';
import FeedbackDetail from './pages/Feedback/FeedbackDetail.jsx';

function Protected({ children }) {
  const { isAuthed, ready } = useAdminAuth();
  if (!ready) return null;
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AdminShell />
          </Protected>
        }
      >
        <Route index element={<RequirePermission module="dashboard" action="view"><Dashboard /></RequirePermission>} />
        <Route path="users" element={<RequirePermission module="users" action="view"><UserList /></RequirePermission>} />
        <Route path="users/:id" element={<RequirePermission module="users" action="view"><UserProfilePage /></RequirePermission>} />
        <Route path="admins" element={<RequirePermission module="admins" action="view"><AdminList /></RequirePermission>} />
        <Route path="rbac" element={<RequirePermission module="rbac" action="view"><RoleList /></RequirePermission>} />
        <Route path="rbac/:id" element={<RequirePermission module="rbac" action="view"><RoleEditor /></RequirePermission>} />
        <Route path="feedback" element={<RequirePermission module="feedback" action="view"><FeedbackList /></RequirePermission>} />
        <Route path="feedback/:id" element={<RequirePermission module="feedback" action="view"><FeedbackDetail /></RequirePermission>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeModeProvider>
      <AdminAuthProvider>
        <AppRoutes />
      </AdminAuthProvider>
    </ThemeModeProvider>
  );
}
