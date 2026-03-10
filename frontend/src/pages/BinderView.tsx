import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { binderApi, pageApi } from '../services/api';
import type { BinderDetail, Card } from '../types';
import { formatCurrency, formatValueRange } from '../types';
import ConditionBadge from '../components/ConditionBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';

const API_BASE = 'http://localhost:5137';

export default function BinderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [binder, setBinder] = useState<BinderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    binderApi.getBinder(parseInt(id))
      .then(setBinder)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const maxPage = binder?.totalPages || Math.max(...(binder?.cards.map(c => c.pageNumber) || [1]), 1);

  const pageCards = binder?.cards.filter(c => c.pageNumber === currentPage) || [];

  const getCardAt = (row: number, col: number): Card | undefined => {
    return pageCards.find(c => c.row === row && c.column === col);
  };

  const pageValueLow = pageCards.reduce((sum, c) => sum + (c.valueRangeLow || 0), 0);
  const pageValueHigh = pageCards.reduce((sum, c) => sum + (c.valueRangeHigh || 0), 0);

  if (loading) {
    return (
      <div className="page">
        <h1 className="page-title">Binder View</h1>
        <LoadingSkeleton count={9} />
      </div>
    );
  }

  if (!binder) {
    return (
      <div className="page">
        <h1 className="page-title">Binder Not Found</h1>
        <button className="btn btn-primary" onClick={() => navigate('/binders')}>Back to Binders</button>
      </div>
    );
  }

  return (
    <div className="page binder-view-page">
      <div className="binder-header">
        <h1 className="page-title">{binder.name}</h1>
        {binder.description && <p className="binder-description">{binder.description}</p>}
      </div>

      <div className="page-nav">
        <button
          className="btn btn-icon"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(p => p - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="page-indicator">Page {currentPage} of {maxPage}</span>
        <button
          className="btn btn-icon"
          disabled={currentPage >= maxPage}
          onClick={() => setCurrentPage(p => p + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="page-stats">
        <span>{pageCards.length} card{pageCards.length !== 1 ? 's' : ''} on this page</span>
        {pageCards.length > 0 && (
          <span>Page value: {formatValueRange(pageValueLow, pageValueHigh)}</span>
        )}
      </div>

      <div className="binder-grid">
        {[1, 2, 3].map(row => (
          <div key={row} className="binder-row">
            {[1, 2, 3].map(col => {
              const card = getCardAt(row, col);
              return (
                <div
                  key={`${row}-${col}`}
                  className={`binder-cell ${card ? 'binder-cell-filled' : 'binder-cell-empty'}`}
                  onClick={() => {
                    if (card) {
                      navigate(`/cards/${card.id}`);
                    } else {
                      navigate(`/cards/new?binder=${binder.id}&page=${currentPage}&row=${row}&col=${col}`);
                    }
                  }}
                >
                  {card ? (
                    <div className="binder-cell-content">
                      {card.imagePath ? (
                        <img src={`${API_BASE}${card.imagePath}`} alt={card.playerName} loading="lazy" />
                      ) : (
                        <div className="binder-cell-text">
                          <span className="binder-cell-name">{card.playerName}</span>
                          <span className="binder-cell-year">{card.year} {card.setName}</span>
                        </div>
                      )}
                      <div className="binder-cell-overlay">
                        <span>{card.playerName}</span>
                        <ConditionBadge condition={card.estimatedCondition} />
                      </div>
                    </div>
                  ) : (
                    <div className="binder-cell-add">
                      <Plus size={24} />
                      <span>Add Card</span>
                      <span className="binder-cell-pos">R{row}-C{col}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
