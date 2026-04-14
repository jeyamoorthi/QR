import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Location, Task } from '../types';
import {
  ListChecks,
  Plus,
  X,
  Trash2,
  Edit3,
  MapPin,
  Clock,
  ChevronDown,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'badge-danger',
  high: 'badge-warning',
  medium: 'badge-info',
  low: 'badge-success',
};

export default function TasksPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    frequencyType: 'daily',
    estimatedMinutes: '',
    order: 0,
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) fetchTasks(selectedLocation);
  }, [selectedLocation]);

  const fetchLocations = async () => {
    try {
      const data = await api.getLocations();
      const locs = data.locations || [];
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].id);
      }
    } catch (err) {
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (locationId: string) => {
    try {
      const data = await api.getLocationTasks(locationId);
      setTasks(data.tasks || []);
    } catch (err) {
      toast.error('Failed to load tasks');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTask({
        title: form.title,
        description: form.description || undefined,
        locationId: selectedLocation,
        priority: form.priority,
        frequencyType: form.frequencyType,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
        order: form.order,
      });
      toast.success('Task created!');
      setShowCreate(false);
      resetForm();
      fetchTasks(selectedLocation);
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    try {
      await api.updateTask(editTask.id, {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        frequencyType: form.frequencyType,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
        order: form.order,
      });
      toast.success('Task updated!');
      setEditTask(null);
      resetForm();
      fetchTasks(selectedLocation);
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this task?')) return;
    try {
      await api.deleteTask(id);
      toast.success('Task deactivated');
      fetchTasks(selectedLocation);
    } catch (err) {
      toast.error('Failed to deactivate task');
    }
  };

  const openEdit = (task: Task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      frequencyType: task.frequencyType,
      estimatedMinutes: task.estimatedMinutes?.toString() || '',
      order: task.order,
    });
    setEditTask(task);
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      priority: 'medium',
      frequencyType: 'daily',
      estimatedMinutes: '',
      order: 0,
    });
  };

  const currentLocation = locations.find((l) => l.id === selectedLocation);

  return (
    <div className="animate-in">
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
      }} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Assign and manage tasks per location</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowCreate(true); }}
          disabled={!selectedLocation}
        >
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Location Selector */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <MapPin size={18} color="var(--color-primary-light)" />
          <div className="form-group" style={{ margin: 0, flex: 1, maxWidth: 400 }}>
            <select
              className="form-select"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.taskCount ?? 0} tasks)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <ListChecks size={64} />
            <h3>No tasks yet</h3>
            <p>
              {currentLocation
                ? `Add tasks for "${currentLocation.name}" that employees will complete`
                : 'Select a location first'}
            </p>
            {currentLocation && (
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { resetForm(); setShowCreate(true); }}>
                <Plus size={16} /> Add First Task
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Frequency</th>
                  <th>Est. Time</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, i) => (
                  <tr key={task.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</div>
                      {task.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                          {task.description.length > 60 ? task.description.substring(0, 60) + '...' : task.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${PRIORITY_STYLES[task.priority] || 'badge-info'}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{task.frequencyType.replace('_', ' ')}</td>
                    <td>
                      {task.estimatedMinutes ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={14} color="var(--text-muted)" /> {task.estimatedMinutes}m
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${task.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {task.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-icon"
                          style={{ background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: 32, height: 32, borderRadius: 'var(--radius-sm)' }}
                          onClick={() => openEdit(task)}
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', width: 32, height: 32, borderRadius: 'var(--radius-sm)' }}
                          onClick={() => handleDelete(task.id)}
                          title="Deactivate"
                        >
                          <Trash2 size={14} />
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

      {/* Create / Edit Modal */}
      {(showCreate || editTask) && (
        <div className="modal-overlay" onClick={() => { setShowCreate(false); setEditTask(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editTask ? 'Edit Task' : 'New Task'}</h2>
              <button className="btn-icon" style={{ background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => { setShowCreate(false); setEditTask(null); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={editTask ? handleUpdate : handleCreate}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  placeholder="e.g., Sanitize workstations"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  placeholder="Detailed instructions..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <select className="form-select" value={form.frequencyType} onChange={(e) => setForm({ ...form, frequencyType: e.target.value })}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="one_time">One Time</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Est. Minutes</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="480"
                    placeholder="15"
                    value={form.estimatedMinutes}
                    onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditTask(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
