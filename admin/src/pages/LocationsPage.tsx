import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Location } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  MapPin,
  Plus,
  X,
  Download,
  Edit3,
  Trash2,
  QrCode,
  ListChecks,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showQR, setShowQR] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: '', description: '', address: '' });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const data = await api.getLocations();
      setLocations(data.locations || []);
    } catch (err) {
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLocation(form);
      toast.success('Location created!');
      setShowCreate(false);
      setForm({ name: '', description: '', address: '' });
      fetchLocations();
    } catch (err) {
      toast.error('Failed to create location');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this location?')) return;
    try {
      await api.deleteLocation(id);
      toast.success('Location deactivated');
      fetchLocations();
    } catch (err) {
      toast.error('Failed to deactivate location');
    }
  };

  const downloadQR = (location: Location) => {
    const svg = document.getElementById(`qr-${location.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 56, 56, 400, 400);
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(location.name, 256, 490);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${location.name.replace(/\s+/g, '_').toLowerCase()}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="animate-in">
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
      }} />

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">Manage QR-mapped task locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Location
        </button>
      </div>

      {/* Locations Grid */}
      {loading ? (
        <div className="empty-state"><p>Loading locations...</p></div>
      ) : locations.length === 0 ? (
        <div className="empty-state">
          <MapPin size={64} />
          <h3>No locations yet</h3>
          <p>Create your first location to generate a QR code for task assignment</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Location
          </button>
        </div>
      ) : (
        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {locations.map((loc) => (
            <div key={loc.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="stat-icon primary" style={{ width: 40, height: 40 }}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{loc.name}</h3>
                    {loc.address && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{loc.address}</p>
                    )}
                  </div>
                </div>
                <span className={`badge ${loc.isActive ? 'badge-success' : 'badge-danger'}`}>
                  {loc.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {loc.description && (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  {loc.description}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ListChecks size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{loc.taskCount ?? 0} tasks</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowQR(loc)}>
                  <QrCode size={14} /> View QR
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(loc.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Location</h2>
              <button className="btn-icon" style={{ background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowCreate(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" placeholder="e.g., Building A - Floor 3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="Optional description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="Physical address..." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Location</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title">{showQR.name}</h2>
              <button className="btn-icon" style={{ background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowQR(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="qr-container" style={{ margin: '20px auto', maxWidth: 300 }}>
              <QRCodeSVG
                id={`qr-${showQR.id}`}
                value={showQR.qrCodeValue}
                size={220}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
              <div className="qr-label">{showQR.name}</div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 20px', fontFamily: 'monospace' }}>
              {showQR.qrCodeValue}
            </p>
            <button className="btn btn-primary" onClick={() => downloadQR(showQR)}>
              <Download size={16} /> Download PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
