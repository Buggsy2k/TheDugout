import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, RotateCw } from 'lucide-react';
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
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showAllBacks, setShowAllBacks] = useState(false);

  const toggleFlip = (cardId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleAllBacks = () => {
    const newShowAll = !showAllBacks;
    setShowAllBacks(newShowAll);
    setFlippedCards(new Set());
  };

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
        {pageCards.some(c => c.backImagePath) && (
          <button
            className={`btn btn-sm${showAllBacks ? ' btn-accent' : ''}`}
            onClick={toggleAllBacks}
          >
            <RotateCw size={14} />
            {showAllBacks ? ' Show Fronts' : ' Show Backs'}
          </button>
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
                      {(() => {
                        const isFlipped = flippedCards.has(card.id) ? !showAllBacks : showAllBacks;
                        const currentImage = isFlipped ? card.backImagePath : card.imagePath;
                        return currentImage ? (
                          <img src={`${API_BASE}${currentImage}`} alt={`${card.playerName}${isFlipped ? ' (back)' : ''}`} loading="lazy" />
                        ) : (
                          <div className="binder-cell-text">
                            <span className="binder-cell-name">{card.playerName}</span>
                            <span className="binder-cell-year">{card.year} {card.setName}</span>
                          </div>
                        );
                      })()}
                      {card.backImagePath && (
                        <button
                          className={`card-flip-btn${flippedCards.has(card.id) ? ' flipped' : ''}`}
                          onClick={(e) => toggleFlip(card.id, e)}
                          title={flippedCards.has(card.id) ? 'Show front' : 'Show back'}
                        >
                          <RotateCw size={14} />
                        </button>
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
