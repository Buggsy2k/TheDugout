import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { binderApi } from '../services/api';
import type { Binder } from '../types';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function BinderList() {
  const navigate = useNavigate();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    binderApi.getBinders()
      .then(setBinders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
      </div>

      {binders.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} />
          <p>No binders yet.</p>
        </div>
      ) : (
        <div className="binder-list">
          {binders.map(binder => (
            <div key={binder.id} className="binder-card" onClick={() => navigate(`/binders/${binder.id}`)}>
              <div className="binder-card-main">
                <div className="binder-card-icon"><BookOpen size={32} /></div>
                <div className="binder-card-info">
                  <h3>{binder.name}</h3>
                  {binder.description && <p>{binder.description}</p>}
                  <div className="binder-card-stats">
                    <span>{binder.cardCount} card{binder.cardCount !== 1 ? 's' : ''}</span>
                    {binder.totalPages && <span>{binder.totalPages} pages</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
