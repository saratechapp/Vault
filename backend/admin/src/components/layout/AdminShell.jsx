import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, Typography, IconButton, Avatar, Chip, Menu, MenuItem, Divider, Badge, Button,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import SecurityIcon from '@mui/icons-material/GppGoodOutlined';
import FeedbackIcon from '@mui/icons-material/ForumOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsOutlined';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { useThemeMode } from '../../context/ThemeModeContext.jsx';
import { hasPermission } from '../../lib/permissions.js';
import { api } from '../../lib/api.js';

const NOTIF_POLL_MS = 45_000;
const NOTIF_TONE_COLOR = { danger: 'error.main', warning: 'warning.main', info: 'info.main', success: 'success.main' };

function NotificationBell() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const [notifs, setNotifs] = useState([]);

  function load() {
    api.get('/notifications').then(setNotifs).catch(() => {
      // best-effort — the bell just stays at its last known count on failure
    });
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, NOTIF_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  function openTicket(n) {
    setAnchor(null);
    navigate(`/feedback/${n.feedbackId}`);
    // The detail view's own GET stamps admin_last_read_at server-side —
    // this just gets the bell's count to catch up without waiting a full
    // poll cycle for the reply-driven notifications that read-state clears.
    setTimeout(load, 800);
  }

  async function markAllRead() {
    await api.post('/notifications/read-all');
    load();
  }

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Notifications">
        <Badge badgeContent={notifs.length} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} PaperProps={{ sx: { width: 360, maxHeight: 420 } }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Notifications</Typography>
          <Button size="small" onClick={markAllRead} disabled={!notifs.length}>Mark all read</Button>
        </Box>
        <Divider />
        {notifs.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">You're all caught up.</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {notifs.map((n) => (
              <ListItemButton key={n.id} onClick={() => openTicket(n)} sx={{ alignItems: 'flex-start', gap: 1.25, py: 1.25 }}>
                <Box sx={{ mt: 0.75, width: 8, height: 8, borderRadius: '50%', bgcolor: NOTIF_TONE_COLOR[n.tone] || 'grey.500', flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{n.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{n.body}</Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </Menu>
    </>
  );
}

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, module: 'dashboard', end: true },
  { to: '/users', label: 'Users', icon: PeopleIcon, module: 'users' },
  { to: '/admins', label: 'Admins', icon: AdminPanelSettingsIcon, module: 'admins' },
  { to: '/rbac', label: 'Roles & Permissions', icon: SecurityIcon, module: 'rbac' },
  { to: '/feedback', label: 'Feedback', icon: FeedbackIcon, module: 'feedback' },
  { to: '/subscriptions', label: 'Subscriptions', icon: PaymentsIcon, module: 'subscriptions' },
];

export function AdminShell() {
  const { admin, logout } = useAdminAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(admin, item.module, 'view'));

  async function handleLogout() {
    setMenuAnchor(null);
    await logout();
    navigate('/login');
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Box component="img" src="/logo.svg" alt="Vault" sx={{ height: 28, width: 28, borderRadius: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>Vault Admin</Typography>
          <IconButton onClick={toggleMode} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          {hasPermission(admin, 'feedback', 'view') && <NotificationBell />}
          <Chip
            label={admin?.isSuperAdmin ? 'Super Admin' : admin?.roleName || 'Admin'}
            size="small"
            color={admin?.isSuperAdmin ? 'primary' : 'default'}
            sx={{ mr: 1 }}
          />
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <Avatar src={admin?.avatar} sx={{ width: 32, height: 32 }}>{admin?.name?.[0] || admin?.email?.[0] || '?'}</Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{admin?.name || admin?.email}</Typography>
              <Typography variant="caption" color="text.secondary">{admin?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{ width: DRAWER_WIDTH, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
      >
        <Toolbar />
        <List sx={{ px: 1, pt: 1 }}>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              sx={{
                borderRadius: 2, mb: 0.5,
                '&.active': { bgcolor: 'primary.main', color: '#fff', '& .MuiListItemIcon-root': { color: '#fff' } },
              }}
            >
              <ListItemIcon><item.icon /></ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Toolbar />
        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default AdminShell;
