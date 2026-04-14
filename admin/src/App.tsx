import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LocationsPage from './pages/LocationsPage';
import TasksPage from './pages/TasksPage';
import UsersPage from './pages/UsersPage';
import { roleLevel } from './types';

/**
 * Route guard that checks authentication and minimum role level.
 * super_admin, admin, and supervisor can access the dashboard.
 */
function ProtectedRoute({
  children,
  minRole = 'supervisor',
}: {
  children: React.ReactNode;
  minRole?: 'employee' | 'supervisor' | 'admin' | 'super_admin';
}) {
  const { user, loading, role, status, firebaseConfigured } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="stat-icon primary" style={{ width: 56, height: 56, margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Allow UI preview when Firebase isn't configured
  if (!firebaseConfigured) return <>{children}</>;

  if (!user) return <Navigate to="/login" replace />;

  if (status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: 32 }}>
        <div>
          <h2 style={{ marginBottom: 8, color: 'var(--color-warning)' }}>Approval Pending</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Your account is waiting for password setup or administrator approval before you can access the dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'rejected' || status === 'disabled') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: 32 }}>
        <div>
          <h2 style={{ marginBottom: 8, color: 'var(--color-danger)' }}>Access Revoked</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Your access has been revoked or denied by the administrator.
          </p>
        </div>
      </div>
    );
  }

  if (roleLevel(role) < roleLevel(minRole)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: 32 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            You need at least <strong>{minRole}</strong> access to view this page.
            <br />Your current role: <strong>{role}</strong>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

import EmployeeDashboardPage from './pages/EmployeeDashboardPage';

function HomeWrapper() {
  const { role } = useAuth();
  if (roleLevel(role) >= roleLevel('supervisor')) {
    return <DashboardPage />;
  }
  return <EmployeeDashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute minRole="employee">
              <Layout>
                <Routes>
                  <Route path="/" element={<HomeWrapper />} />
                  <Route 
                    path="/locations" 
                    element={
                      <ProtectedRoute minRole="supervisor">
                        <LocationsPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/tasks" 
                    element={
                      <ProtectedRoute minRole="supervisor">
                        <TasksPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute minRole="admin">
                        <UsersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
