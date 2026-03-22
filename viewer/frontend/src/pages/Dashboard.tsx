import { useEffect, useState } from 'react';
import { BarChart3, CreditCard } from 'lucide-react';
import { cardApi } from '../services/api';
import type { CollectionStats } from '../types';
import CardTile from '../components/CardTile';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConditionBadge from '../components/ConditionBadge';

export default function Dashboard() {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cardApi.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">Dashboard</h1>
        <LoadingSkeleton type="stat" count={2} />
        <LoadingSkeleton count={6} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="page">
        <h1 className="page-title">Dashboard</h1>
        <div className="empty-state">
          <p>Unable to load collection stats. Make sure the backend is running.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><CreditCard size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Total Cards</span>
            <span className="stat-value">{stats.totalCards.toLocaleString()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><BarChart3 size={24} /></div>
          <div className="stat-content">
            <span className="stat-label">Sets Represented</span>
            <span className="stat-value">{stats.bySet.length}</span>
          </div>
        </div>
      </div>

      {stats.byDecade.length > 0 && (
        <section className="dashboard-section">
          <h2>Cards by Decade</h2>
          <div className="decade-bars">
            {stats.byDecade.map(d => {
              const maxCount = Math.max(...stats.byDecade.map(x => x.count));
              const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
              return (
                <div key={d.decade} className="decade-bar-row">
                  <span className="decade-label">{d.decade}</span>
                  <div className="decade-bar-track">
                    <div className="decade-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="decade-count">{d.count}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {stats.byCondition.length > 0 && (
        <section className="dashboard-section">
          <h2>Condition Breakdown</h2>
          <div className="condition-grid">
            {stats.byCondition.map(c => (
              <div key={c.condition} className="condition-item">
                <ConditionBadge condition={c.condition} size="md" />
                <span className="condition-count">{c.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.recentAdditions.length > 0 && (
        <section className="dashboard-section">
          <h2>Recent Additions</h2>
          <div className="card-grid">
            {stats.recentAdditions.map(card => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {stats.totalCards === 0 && (
        <div className="empty-state">
          <h2>Welcome to The Dugout!</h2>
          <p>No cards in the collection yet.</p>
        </div>
      )}
    </div>
  );
}
