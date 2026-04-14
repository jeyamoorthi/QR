import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DashboardData } from '../types';
import { ROLE_LABELS } from '../types';
import { useAuth, db as firestoreDb } from '../auth/AuthContext';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  MapPin,
  Shield,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { companyId, firebaseConfigured } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'live'>('idle');

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !firestoreDb || !companyId) return;

    // Listen to today's company logs and refresh dashboard on each change.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStart = Timestamp.fromDate(startOfDay);

    const logsQuery = query(
      collection(firestoreDb, 'task_logs'),
      where('companyId', '==', companyId),
      where('completedAt', '>=', todayStart),
      orderBy('completedAt', 'desc'),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      () => {
        setLiveStatus('live');
        fetchDashboard();
      },
      (err) => {
        console.error('Realtime dashboard listener failed:', err);
        setLiveStatus('idle');
      },
    );

    return () => unsubscribe();
  }, [companyId, firebaseConfigured]);

  const fetchDashboard = async () => {
    try {
      const result = await api.getDashboard();
      setData(result);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
      </div>
    );
  }

  const summary = data?.summary;
  const pieData = summary ? [
    { name: 'Completed', value: summary.completedToday, color: '#10b981' },
    { name: 'Pending', value: Math.max(0, summary.totalTasks - summary.completedToday - summary.issuesReported), color: '#64748b' },
    { name: 'Issues', value: summary.issuesReported, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const barData = data?.locationStats?.map((loc) => ({
    name: loc.locationName.length > 15 ? loc.locationName.substring(0, 15) + '...' : loc.locationName,
    Completed: loc.completed,
    Pending: loc.pending,
    Issues: loc.issues,
  })) || [];

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {data?.date ? format(new Date(data.date), 'EEEE, MMMM d, yyyy') : 'Today'}
            </p>
            {data?.callerRole && (
              <span className="badge" style={{ background: 'var(--bg-tertiary)' }}>
                <Shield size={12} style={{ marginRight: 4 }} />
                {ROLE_LABELS[data.callerRole as keyof typeof ROLE_LABELS] || data.callerRole} View
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={fetchDashboard}>
          <TrendingUp size={16} /> Refresh
        </button>
      </div>
      {liveStatus === 'live' && (
        <div style={{ marginBottom: 12, color: 'var(--color-success)', fontSize: 13 }}>
          Live sync active
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary"><CheckCircle size={22} /></div>
          <div>
            <div className="stat-value">{summary?.completedToday ?? 0}</div>
            <div className="stat-label">Completed Today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-value">{summary?.completionRate ?? 0}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning"><AlertTriangle size={22} /></div>
          <div>
            <div className="stat-value">{summary?.issuesReported ?? 0}</div>
            <div className="stat-label">Issues Reported</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info"><Users size={22} /></div>
          <div>
            <div className="stat-value">{summary?.activeEmployees ?? 0}</div>
            <div className="stat-label">Active Employees</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 32 }}>
        {/* Location Performance Bar Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Location Performance</h3>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
                <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pending" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Issues" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <MapPin size={40} />
              <p>No location data yet</p>
            </div>
          )}
        </div>

        {/* Completion Donut */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Task Status Distribution</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}>
              <Clock size={40} />
              <p>No tasks submitted today</p>
            </div>
          )}
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
            {pieData.map((d) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Activity</h3>
        </div>
        {data?.recentActivity && data.recentActivity.length > 0 ? (
          data.recentActivity.map((activity, i) => (
            <div key={i} className="activity-item">
              <div className="activity-avatar">
                {activity.employeeName.charAt(0).toUpperCase()}
              </div>
              <div className="activity-content">
                <div className="activity-name">{activity.employeeName}</div>
                <div className="activity-desc">
                  Completed {activity.tasksCompleted} task{activity.tasksCompleted !== 1 ? 's' : ''} at {activity.locationName}
                </div>
              </div>
              <div className="activity-time">
                {activity.completedAt
                  ? format(new Date(activity.completedAt), 'HH:mm')
                  : '—'}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <Clock size={40} />
            <h3>No activity yet</h3>
            <p>Employee activity will appear here as tasks are completed</p>
          </div>
        )}
      </div>
    </div>
  );
}
