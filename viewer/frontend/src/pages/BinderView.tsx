import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronsRight, RotateCw } from 'lucide-react';
import { binderApi, API_BASE } from '../services/api';
import type { BinderDetail, Card } from '../types';
import ConditionBadge from '../components/ConditionBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function BinderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page') || '1') || 1;
  const [binder, setBinder] = useState<BinderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [showAllBacks, setShowAllBacks] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  // Keep URL in sync with current page
  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page') || '1') || 1;
    if (currentPage !== urlPage) {
      const newParams = new URLSearchParams(searchParams);
      if (currentPage === 1) {
        newParams.delete('page');
      } else {
        newParams.set('page', String(currentPage));
      }
      setSearchParams(newParams, { replace: true });
    }
  }, [currentPage]);

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

  const highestCardPage = Math.max(...(binder?.cards.map(c => c.pageNumber) || [1]), 1);
  const maxPage = binder?.totalPages || highestCardPage;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setCurrentPage(p => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setCurrentPage(p => Math.min(maxPage, p + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maxPage]);

  const lastPopulatedPage = binder?.cards.length
    ? Math.max(...binder.cards.map(c => c.pageNumber))
    : 0;

  const jumpToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, maxPage));
    setCurrentPage(clamped);
    setShowJumpInput(false);
    setJumpInput('');
  };

  const pageCards = binder?.cards.filter(c => c.pageNumber === currentPage) || [];

  const getCardAt = (row: number, col: number): Card | undefined => {
    return pageCards.find(c => c.row === row && c.column === col);
  };

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
        {showJumpInput ? (
          <input
            type="number"
            className="input input-sm page-jump-input"
            value={jumpInput}
            min={1}
            max={maxPage}
            autoFocus
            placeholder={`1–${maxPage}`}
            onChange={e => setJumpInput(e.target.value)}
            onBlur={() => { setShowJumpInput(false); setJumpInput(''); }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = parseInt(jumpInput);
                if (!isNaN(val)) jumpToPage(val);
              }
              if (e.key === 'Escape') { setShowJumpInput(false); setJumpInput(''); }
            }}
          />
        ) : (
          <span
            className="page-indicator page-indicator-clickable"
            onClick={() => { setJumpInput(String(currentPage)); setShowJumpInput(true); }}
            title="Click to jump to a page"
          >
            Page {currentPage} of {maxPage}
          </span>
        )}
        <button
          className="btn btn-icon"
          disabled={currentPage >= maxPage}
          onClick={() => setCurrentPage(p => p + 1)}
        >
          <ChevronRight size={20} />
        </button>
        {lastPopulatedPage > 0 && (
          <button
            className="btn btn-sm"
            onClick={() => jumpToPage(lastPopulatedPage)}
            title={`Jump to page ${lastPopulatedPage}`}
            disabled={currentPage === lastPopulatedPage}
          >
            <ChevronsRight size={14} /> Last Card (p.{lastPopulatedPage})
          </button>
        )}
      </div>

      <div className="page-stats">
        <span>{pageCards.length} card{pageCards.length !== 1 ? 's' : ''} on this page</span>
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
                    if (card) navigate(`/cards/${card.id}`);
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
                    <div className="binder-cell-empty-slot">
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
