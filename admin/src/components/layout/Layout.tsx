import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { roleLevel, UserRole } from '../../types';
import {
  LayoutDashboard,
  MapPin,
  ListChecks,
  Users,
  LogOut,
  QrCode,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();

  const allNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', minRole: 'employee' as UserRole },
    { to: '/locations', icon: MapPin, label: 'Locations', minRole: 'supervisor' as UserRole },
    { to: '/tasks', icon: ListChecks, label: 'Tasks', minRole: 'supervisor' as UserRole },
    { to: '/users', icon: Users, label: 'Users', minRole: 'admin' as UserRole },
  ];

  const navItems = allNavItems.filter(item => roleLevel(role) >= roleLevel(item.minRole));

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <QrCode size={22} color="white" />
          </div>
          <div>
            <div className="sidebar-title">QR Tasks</div>
            <div className="sidebar-subtitle">{role === 'employee' ? 'Employee Workspace' : 'Admin Panel'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section at bottom */}
        <div style={{
          padding: '16px 12px',
          borderTop: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px' }}>
            <div className="activity-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName || 'Admin'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            <button
              onClick={signOut}
              className="btn-icon"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
