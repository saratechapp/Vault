import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { PreferencesProvider } from './context/PreferencesContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppLayout } from './layouts/AppLayout.jsx';

// Landing + the auth pages are the first thing most visitors load, so they
// stay eager (no loading flash on the entry experience). Everything behind
// login is heavier and only needed post-auth, so it's code-split — Vite
// already chunks on dynamic import, this just wires the app up to use it.
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import CreatePassword from './pages/CreatePassword.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ImpersonateEntry from './pages/ImpersonateEntry.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const AccountDetails = lazy(() => import('./pages/AccountDetails.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const Bills = lazy(() => import('./pages/Bills.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const Debts = lazy(() => import('./pages/Debts.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const MyFeedback = lazy(() => import('./pages/MyFeedback.jsx'));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-500" />
    </div>
  );
}

function Protected({ children }) {
  const { isAuthed, ready, needsPassword } = useAuth();
  if (!ready) return null;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (needsPassword) return <Navigate to="/create-password" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/create-password" element={<CreatePassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/impersonate-entry" element={<ImpersonateEntry />} />

      <Route
        path="/app"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
        <Route path="accounts" element={<Suspense fallback={<RouteFallback />}><Accounts /></Suspense>} />
        <Route path="accounts/:id" element={<Suspense fallback={<RouteFallback />}><AccountDetails /></Suspense>} />
        <Route path="transactions" element={<Suspense fallback={<RouteFallback />}><Transactions /></Suspense>} />
        <Route path="calendar" element={<Suspense fallback={<RouteFallback />}><Calendar /></Suspense>} />
        <Route path="budgets" element={<Suspense fallback={<RouteFallback />}><Budgets /></Suspense>} />
        <Route path="bills" element={<Suspense fallback={<RouteFallback />}><Bills /></Suspense>} />
        <Route path="goals" element={<Suspense fallback={<RouteFallback />}><Goals /></Suspense>} />
        <Route path="debts" element={<Suspense fallback={<RouteFallback />}><Debts /></Suspense>} />
        <Route path="reports" element={<Suspense fallback={<RouteFallback />}><Reports /></Suspense>} />
        <Route path="notifications" element={<Suspense fallback={<RouteFallback />}><Notifications /></Suspense>} />
        <Route path="feedback" element={<Suspense fallback={<RouteFallback />}><MyFeedback /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <AppRoutes />
        </PreferencesProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
