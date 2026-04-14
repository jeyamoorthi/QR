import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AppUser, UserRole, Location } from '../types';
import { ROLE_LABELS, ROLE_COLORS, canManageRole } from '../types';
import { useAuth } from '../auth/AuthContext';
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  RefreshCw,
  Plus,
  X,
  MapPin,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { format } from 'date-fns';

export default function UsersPage() {
  const { role: currentUserRole, user: currentAuthUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignableRoles, setAssignableRoles] = useState<UserRole[]>([]);
  const [currentTab, setCurrentTab] = useState<'employees' | 'pending'>('employees');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<AppUser | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    email: '',
    displayName: '',
    role: 'employee' as UserRole,
  });
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, pendingData, rolesData, locData] = await Promise.all([
        api.getUsers(), // Assuming getUsers backend now only returns active/approved users, or we filter in UI
        api.getPendingApprovals(),
        api.getAvailableRoles(),
        api.getLocations(),
      ]);
      setUsers(usersData.users || []);
      setPendingUsers(pendingData.users || []);
      setAssignableRoles(rolesData.assignableRoles || []);
      setLocations(locData.locations || []);
    } catch (err) {
      toast.error('Failed to load users data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await api.toggleUserStatus(userId);
      toast.success('Status updated');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await api.approveEmployee(userId);
      toast.success('Employee approved');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to approve employee');
    }
  };

  const handleReject = async (userId: string) => {
    if (!window.confirm("Are you sure you want to reject this employee? They will not be able to log in.")) return;
    try {
      await api.rejectEmployee(userId);
      toast.success('Employee rejected');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to reject employee');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createUser({
        email: createForm.email,
        displayName: createForm.displayName,
        role: createForm.role,
      });
      toast.success('User created successfully');
      setShowCreateModal(false);
      setCreateForm({ email: '', displayName: '', role: 'employee' });
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignLocations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal) return;
    setSubmitting(true);
    try {
      await api.assignLocations(showAssignModal.id, selectedLocations);
      toast.success('Locations assigned');
      setShowAssignModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to assign locations');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignModal = (user: AppUser) => {
    setShowAssignModal(user);
    setSelectedLocations(user.assignedLocations || []);
  };

  const toggleLocationSelection = (locId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  // Backend returns all company users; this view only shows users ready for work.
  const activeUsers = users.filter((u) => u.status === 'active' || u.status === 'approved');

  const getRoleStats = (role: UserRole) => activeUsers.filter((u) => u.role === role).length;

  return (
    <div className="animate-in">
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
      }} />

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Users & Employees</h1>
          <p className="page-subtitle">Manage accounts, roles, and approvals</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} /> Refresh
          </button>
          {assignableRoles.length > 0 && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        <button
           onClick={() => setCurrentTab('employees')}
           style={{
             padding: '12px 16px',
             background: 'transparent',
             border: 'none',
             borderBottom: currentTab === 'employees' ? '2px solid var(--color-primary)' : '2px solid transparent',
             color: currentTab === 'employees' ? 'var(--color-primary)' : 'var(--text-muted)',
             fontWeight: currentTab === 'employees' ? 600 : 500,
             cursor: 'pointer',
             display: 'flex',
             alignItems: 'center',
             gap: 8,
             fontSize: 15
           }}
        >
          <Users size={18} /> Active Employees ({activeUsers.length})
        </button>
        <button
           onClick={() => setCurrentTab('pending')}
           style={{
             padding: '12px 16px',
             background: 'transparent',
             border: 'none',
             borderBottom: currentTab === 'pending' ? '2px solid var(--color-warning)' : '2px solid transparent',
             color: currentTab === 'pending' ? 'var(--color-warning)' : 'var(--text-muted)',
             fontWeight: currentTab === 'pending' ? 600 : 500,
             cursor: 'pointer',
             display: 'flex',
             alignItems: 'center',
             gap: 8,
             fontSize: 15
           }}
        >
          <Clock size={18} /> Pending Approvals 
          {pendingUsers.length > 0 && (
            <span style={{ background: 'var(--color-warning)', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {currentTab === 'employees' ? (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 32 }}>
            <div className="stat-card">
              <div className="stat-icon info"><Users size={22} /></div>
              <div>
                <div className="stat-value">{activeUsers.length}</div>
                <div className="stat-label">Total Users</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ color: ROLE_COLORS.super_admin, background: `${ROLE_COLORS.super_admin}15` }}>
                <Shield size={22} />
              </div>
              <div>
                <div className="stat-value">{getRoleStats('super_admin') + getRoleStats('admin')}</div>
                <div className="stat-label">Admins</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ color: ROLE_COLORS.supervisor, background: `${ROLE_COLORS.supervisor}15` }}>
                <Users size={22} />
              </div>
              <div>
                <div className="stat-value">{getRoleStats('supervisor')}</div>
                <div className="stat-label">Supervisors</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon success"><UserCheck size={22} /></div>
              <div>
                <div className="stat-value">{getRoleStats('employee')}</div>
                <div className="stat-label">Employees</div>
              </div>
            </div>
          </div>

          {/* Active Users Table */}
          {loading ? (
            <div className="empty-state"><p>Loading users...</p></div>
          ) : activeUsers.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Users size={64} />
                <h3>No employees yet</h3>
                <p>Approve pending registrations to see them here.</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Account Access</th>
                      <th>Assigned Locations</th>
                      <th>Joined</th>
                      <th style={{ width: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.map((user) => {
                      const canManageThisUser = canManageRole(currentUserRole, user.role) && user.uid !== currentAuthUser?.uid;

                      return (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div className="activity-avatar" style={{ width: 36, height: 36 }}>
                                {(user.displayName || user.email).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {user.displayName || '—'}
                                  {user.uid === currentAuthUser?.uid && ' (You)'}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {canManageThisUser ? (
                              <select
                                className="form-control"
                                style={{ 
                                  width: 140, 
                                  padding: '4px 8px', 
                                  backgroundColor: `${ROLE_COLORS[user.role]}15`,
                                  color: ROLE_COLORS[user.role],
                                  borderColor: `${ROLE_COLORS[user.role]}40`,
                                  fontWeight: 600,
                                  fontSize: 13
                                }}
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                              >
                                <option value={user.role} disabled>{ROLE_LABELS[user.role]}</option>
                                {assignableRoles.map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                            ) : (
                              <span 
                                className="badge" 
                                style={{ 
                                  backgroundColor: `${ROLE_COLORS[user.role]}15`,
                                  color: ROLE_COLORS[user.role],
                                  border: `1px solid ${ROLE_COLORS[user.role]}40`
                                }}
                              >
                                {ROLE_LABELS[user.role]}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                              {user.isActive ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td>
                            {user.assignedLocations?.length > 0 ? (
                              <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>
                                <MapPin size={12} style={{ marginRight: 4 }} />
                                {user.assignedLocations.length} location(s)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</span>
                            )}
                          </td>
                          <td style={{ fontSize: 13 }}>
                            {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {canManageThisUser && (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => openAssignModal(user)}
                                  title="Assign Locations"
                                >
                                  <MapPin size={13} /> Assign
                                </button>
                              )}
                              {canManageThisUser && (
                                <button
                                  className="btn btn-sm"
                                  style={{
                                    background: user.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                    color: user.isActive ? 'var(--color-danger)' : 'var(--color-success)',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleToggleStatus(user.id)}
                                >
                                  {user.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Pending Users Tab */
        <>
          {loading ? (
             <div className="empty-state"><p>Loading pending users...</p></div>
          ) : pendingUsers.length === 0 ? (
             <div className="card">
               <div className="empty-state">
                 <CheckCircle size={64} style={{ color: 'var(--color-success)', opacity: 0.5, marginBottom: 16 }} />
                 <h3>All Caught Up!</h3>
                 <p>There are no pending employee registrations.</p>
               </div>
             </div>
          ) : (
             <div className="card" style={{ padding: 0 }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Registered On</th>
                      <th style={{ width: 220 }}>Review Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div className="activity-avatar" style={{ width: 36, height: 36, background: 'var(--color-warning)', color: '#000' }}>
                                {(user.displayName || user.email).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {user.displayName || '—'}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy h:mm a') : '—'}
                          </td>
                          <td>
                             <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => handleApprove(user.id)}
                                  style={{
                                    background: 'rgba(16,185,129,0.1)',
                                    color: 'var(--color-success)',
                                    border: 'none', cursor: 'pointer',
                                    fontWeight: 600
                                  }}
                                >
                                   <CheckCircle size={16} style={{marginRight: 6}} /> Approve
                                </button>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => handleReject(user.id)}
                                  style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    color: 'var(--color-danger)',
                                    border: 'none', cursor: 'pointer',
                                    fontWeight: 600
                                  }}
                                >
                                   <XCircle size={16} style={{marginRight: 6}} /> Deny
                                </button>
                             </div>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             </div>
          )}
        </>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal card animate-in">
            <div className="modal-header">
              <h2>Create New User</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={createForm.displayName}
                  onChange={e => setCreateForm({...createForm, displayName: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={createForm.email}
                  onChange={e => setCreateForm({...createForm, email: e.target.value})}
                  placeholder="user@example.com"
                />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Password is not set here. The user will set it on first login.
              </p>
              <div className="form-group">
                <label>Role</label>
                <select
                  className="form-control"
                  value={createForm.role}
                  onChange={e => setCreateForm({...createForm, role: e.target.value as UserRole})}
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Locations Modal */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal card animate-in" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Assign Locations</h2>
              <button className="btn-close" onClick={() => setShowAssignModal(null)}><X size={20} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Select the locations where <strong>{showAssignModal.displayName || showAssignModal.email}</strong> will work.
            </p>
            <form onSubmit={handleAssignLocations}>
              <div className="form-group" style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                {locations.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>No locations available.</p>
                ) : (
                  locations.map((loc) => (
                    <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedLocations.includes(loc.id)}
                        onChange={() => toggleLocationSelection(loc.id)}
                        style={{ width: 18, height: 18 }}
                      />
                      <span>{loc.name}</span>
                    </label>
                  ))
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
