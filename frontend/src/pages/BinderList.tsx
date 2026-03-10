import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, BookOpen, Trash2, Edit } from 'lucide-react';
import { binderApi } from '../services/api';
import type { Binder, CreateBinder } from '../types';
import { formatValueRange } from '../types';
import LoadingSkeleton from '../components/LoadingSkeleton';
import toast from 'react-hot-toast';

export default function BinderList() {
  const navigate = useNavigate();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBinder, setEditingBinder] = useState<Binder | null>(null);
  const [form, setForm] = useState<CreateBinder>({ name: '', description: '', totalPages: undefined });

  const fetchBinders = () => {
    setLoading(true);
    binderApi.getBinders()
      .then(setBinders)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBinders(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      if (editingBinder) {
        await binderApi.updateBinder(editingBinder.id, form);
        toast.success('Binder updated');
      } else {
        await binderApi.createBinder(form);
        toast.success('Binder created');
      }
      setShowForm(false);
      setEditingBinder(null);
      setForm({ name: '', description: '', totalPages: undefined });
      fetchBinders();
    } catch {
      toast.error('Failed to save binder');
    }
  };

  const handleDelete = async (binder: Binder) => {
    if (!confirm(`Delete "${binder.name}"? ${binder.cardCount > 0 ? `This binder has ${binder.cardCount} cards.` : ''}`)) return;
    try {
      await binderApi.deleteBinder(binder.id, true);
      toast.success('Binder deleted');
      fetchBinders();
    } catch {
      toast.error('Failed to delete binder');
    }
  };

  const startEdit = (binder: Binder) => {
    setEditingBinder(binder);
    setForm({ name: binder.name, description: binder.description || '', totalPages: binder.totalPages ?? undefined });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">Binders</h1>
        <LoadingSkeleton type="row" count={4} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="collection-header">
        <h1 className="page-title">Binders</h1>
        <button className="btn btn-primary" onClick={() => { setEditingBinder(null); setForm({ name: '', description: '', totalPages: undefined }); setShowForm(true); }}>
          <Plus size={16} /> New Binder
        </button>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingBinder ? 'Edit Binder' : 'New Binder'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Vintage Pre-1970"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Notes about this binder..."
                />
              </div>
              <div className="form-group">
                <label>Total Pages</label>
                <input
                  type="number"
                  value={form.totalPages || ''}
                  onChange={e => setForm({ ...form, totalPages: e.target.value ? parseInt(e.target.value) : undefined })}
                  min={1}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingBinder ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {binders.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} />
          <p>No binders yet. Create one to start organizing your collection.</p>
        </div>
      ) : (
        <div className="binder-list">
          {binders.map(binder => (
            <div key={binder.id} className="binder-card">
              <div className="binder-card-main" onClick={() => navigate(`/binders/${binder.id}`)}>
                <div className="binder-card-icon"><BookOpen size={32} /></div>
                <div className="binder-card-info">
                  <h3>{binder.name}</h3>
                  {binder.description && <p>{binder.description}</p>}
                  <div className="binder-card-stats">
                    <span>{binder.cardCount} card{binder.cardCount !== 1 ? 's' : ''}</span>
                    {binder.totalPages && <span>{binder.totalPages} pages</span>}
                    <span>Value: {formatValueRange(binder.totalValueLow, binder.totalValueHigh)}</span>
                  </div>
                </div>
              </div>
              <div className="binder-card-actions">
                <button className="btn btn-icon btn-ghost" onClick={() => startEdit(binder)} title="Edit">
                  <Edit size={16} />
                </button>
                <button className="btn btn-icon btn-ghost btn-danger" onClick={() => handleDelete(binder)} title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
