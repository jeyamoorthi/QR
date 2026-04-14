import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CheckCircle, Clock, MapPin, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

export default function EmployeeDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.getEmployeeMyStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load employee stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Workspace</h1>
          <p className="page-subtitle" style={{ margin: 0, marginTop: 4 }}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>
      
      <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: 16, marginBottom: 24,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-info)',
        }}>
        <Smartphone size={24} style={{ flexShrink: 0 }} />
        <div>
          <strong>Note:</strong> To complete tasks and scan QR codes, please use the <strong>QR Task Manager Mobile App</strong>. This portal is for reviewing your performance and past tasks.
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-icon primary"><CheckCircle size={22} /></div>
          <div>
            <div className="stat-value">{stats?.todayCompleted ?? 0}</div>
            <div className="stat-label">Tasks Today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success"><CheckCircle size={22} /></div>
          <div>
            <div className="stat-value">{stats?.weeklyCompleted ?? 0}</div>
            <div className="stat-label">Tasks This Week</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning"><Clock size={22} /></div>
          <div>
            <div className="stat-value">{stats?.currentStreak ?? 0} Days</div>
            <div className="stat-label">Current Streak</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info"><MapPin size={22} /></div>
          <div>
            <div className="stat-value">{stats?.assignedLocations ?? 0}</div>
            <div className="stat-label">Assigned Locations</div>
          </div>
        </div>
      </div>
    </div>
  );
}
