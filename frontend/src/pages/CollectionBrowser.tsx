import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Grid, List, Filter, X, Trash2, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { cardApi, binderApi, aiApi } from '../services/api';
import type { Card, CardQueryParams, PaginatedResult, Binder } from '../types';
import { CONDITIONS } from '../types';
import { useDebounce, useLocalStorage } from '../hooks';
import CardTile from '../components/CardTile';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Pagination from '../components/Pagination';
import ConditionBadge from '../components/ConditionBadge';
import { formatValueRange, formatLocation } from '../types';
import toast from 'react-hot-toast';

export default function CollectionBrowser() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResult<Card> | null>(null);
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('collection-view', 'grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  // Filter states from URL params
  const search = searchParams.get('search') || '';
  const binderNumber = searchParams.get('binderNumber') || '';
  const year = searchParams.get('year') || '';
  const setName = searchParams.get('setName') || '';
  const team = searchParams.get('team') || '';
  const manufacturer = searchParams.get('manufacturer') || '';
  const tags = searchParams.get('tags') || '';
  const isGraded = searchParams.get('isGraded') || '';
  const isUnassigned = searchParams.get('isUnassigned') || '';
  const sortBy = searchParams.get('sortBy') || 'playerName';
  const sortDir = searchParams.get('sortDir') || 'asc';
  const pageNum = parseInt(searchParams.get('pageNum') || '1');

  const debouncedSearch = useDebounce(search, 300);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params: CardQueryParams = {
        search: debouncedSearch || undefined,
        binderNumber: binderNumber ? parseInt(binderNumber) : undefined,
        year: year ? parseInt(year) : undefined,
        setName: setName || undefined,
        team: team || undefined,
        manufacturer: manufacturer || undefined,
        tags: tags || undefined,
        isGraded: isGraded === 'true' ? true : isGraded === 'false' ? false : undefined,
        isUnassigned: isUnassigned === 'true' ? true : isUnassigned === 'false' ? false : undefined,
        sortBy,
        sortDir,
        pageNum,
        pageSize: 20,
      };
      const data = await cardApi.getCards(params);
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, binderNumber, year, setName, team, manufacturer, tags, isGraded, isUnassigned, sortBy, sortDir, pageNum]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    binderApi.getBinders().then(setBinders).catch(console.error);
  }, []);

  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'pageNum') newParams.set('pageNum', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasFilters = binderNumber || year || setName || team || manufacturer || tags || isGraded || isUnassigned;

  const toggleSelect = (cardId: number) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!result) return;
    const allOnPage = result.items.map(c => c.id);
    const allSelected = allOnPage.every(id => selectedCards.has(id));
    setSelectedCards(prev => {
      const next = new Set(prev);
      allOnPage.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const deleteSelected = async () => {
    if (selectedCards.size === 0) return;
    if (!confirm(`Delete ${selectedCards.size} selected card(s)? This cannot be undone.`)) return;
    try {
      const ids = Array.from(selectedCards);
      await cardApi.bulkDeleteCards(ids);
      toast.success(`Deleted ${ids.length} card(s)`);
      setSelectedCards(new Set());
      setSelectMode(false);
      fetchCards();
    } catch {
      toast.error('Failed to delete cards');
    }
  };

  const rescanSelected = async () => {
    if (selectedCards.size === 0) return;
    if (!confirm(`Rescan ${selectedCards.size} selected card(s) with AI? This will update card info using the latest AI analysis.`)) return;
    setRescanning(true);
    try {
      const ids = Array.from(selectedCards);
      const result = await aiApi.bulkRescan(ids);
      const parts: string[] = [];
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      toast.success(`AI Rescan: ${parts.join(', ')}`);
      setSelectedCards(new Set());
      setSelectMode(false);
      fetchCards();
    } catch {
      toast.error('AI rescan failed');
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div className="page collection-page">
      <div className="collection-header">
        <h1 className="page-title">Collection</h1>
        <div className="collection-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} /> Filters {hasFilters && <span className="filter-dot" />}
          </button>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </button>
          </div>
          <select
            className="sort-select"
            value={`${sortBy}-${sortDir}`}
            onChange={e => {
              const [sb, sd] = e.target.value.split('-');
              updateParam('sortBy', sb);
              const newParams = new URLSearchParams(searchParams);
              newParams.set('sortBy', sb);
              newParams.set('sortDir', sd);
              newParams.set('pageNum', '1');
              setSearchParams(newParams);
            }}
          >
            <option value="playerName-asc">Name A→Z</option>
            <option value="playerName-desc">Name Z→A</option>
            <option value="year-asc">Year ↑</option>
            <option value="year-desc">Year ↓</option>
            <option value="setName-asc">Set A→Z</option>
            <option value="valueHigh-desc">Value High→Low</option>
            <option value="valueHigh-asc">Value Low→High</option>
            <option value="dateAdded-desc">Newest First</option>
            <option value="dateAdded-asc">Oldest First</option>
            <option value="binder-asc">Binder Location</option>
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => navigate('/cards/new')}>
            + Add Card
          </button>
          <button
            className={`btn btn-sm${selectMode ? ' btn-accent' : ' btn-secondary'}`}
            onClick={() => { setSelectMode(!selectMode); setSelectedCards(new Set()); }}
          >
            <CheckSquare size={16} /> Select
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="selection-bar">
          <button className="btn btn-sm btn-secondary" onClick={toggleSelectAll}>
            {result && result.items.every(c => selectedCards.has(c.id)) ? <CheckSquare size={14} /> : <Square size={14} />}
            {' '}Select All on Page
          </button>
          <span>{selectedCards.size} selected</span>
          {selectedCards.size > 0 && (
            <>
              <button className="btn btn-sm btn-accent" onClick={rescanSelected} disabled={rescanning}>
                <RefreshCw size={14} className={rescanning ? 'spin' : ''} /> {rescanning ? 'Rescanning...' : 'Rescan with AI'}
              </button>
              <button className="btn btn-sm btn-danger" onClick={deleteSelected}>
                <Trash2 size={14} /> Delete Selected
              </button>
            </>
          )}
        </div>
      )}

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Binder</label>
              <select value={binderNumber} onChange={e => updateParam('binderNumber', e.target.value)}>
                <option value="">All Binders</option>
                {binders.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Year</label>
              <input
                type="number"
                placeholder="e.g. 1987"
                value={year}
                onChange={e => updateParam('year', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Set Name</label>
              <input
                type="text"
                placeholder="e.g. Topps"
                value={setName}
                onChange={e => updateParam('setName', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Team</label>
              <input
                type="text"
                placeholder="e.g. Yankees"
                value={team}
                onChange={e => updateParam('team', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Manufacturer</label>
              <input
                type="text"
                placeholder="e.g. Topps"
                value={manufacturer}
                onChange={e => updateParam('manufacturer', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Tags</label>
              <input
                type="text"
                placeholder="e.g. rookie,hall-of-fame"
                value={tags}
                onChange={e => updateParam('tags', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Graded</label>
              <select value={isGraded} onChange={e => updateParam('isGraded', e.target.value)}>
                <option value="">All</option>
                <option value="true">Graded Only</option>
                <option value="false">Ungraded Only</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Assignment</label>
              <select value={isUnassigned} onChange={e => updateParam('isUnassigned', e.target.value)}>
                <option value="">Assigned Only</option>
                <option value="true">Unassigned Only</option>
              </select>
            </div>
          </div>
          {hasFilters && (
            <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
              <X size={14} /> Clear All Filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={8} type={viewMode === 'list' ? 'row' : 'card'} />
      ) : result && result.items.length > 0 ? (
        <>
          <p className="result-count">{result.totalCount.toLocaleString()} card{result.totalCount !== 1 ? 's' : ''} found</p>

          {viewMode === 'grid' ? (
            <div className="card-grid">
              {result.items.map(card => (
                <div key={card.id} className={`card-grid-item${selectMode && selectedCards.has(card.id) ? ' selected' : ''}`}>
                  {selectMode && (
                    <button className="card-select-btn" onClick={() => toggleSelect(card.id)}>
                      {selectedCards.has(card.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  )}
                  <CardTile card={card} />
                </div>
              ))}
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  {selectMode && <th className="select-col"></th>}
                  <th>Player</th>
                  <th>Year</th>
                  <th>Set</th>
                  <th>Team</th>
                  <th>Condition</th>
                  <th>Value</th>
                  <th>Location</th>
                  <th>Last Audited</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map(card => (
                  <tr key={card.id} className={`clickable-row${selectMode && selectedCards.has(card.id) ? ' selected' : ''}`}
                    onClick={() => selectMode ? toggleSelect(card.id) : navigate(`/cards/${card.id}`)}>
                    {selectMode && (
                      <td className="select-col">
                        {selectedCards.has(card.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </td>
                    )}
                    <td className="player-cell">{card.playerName}</td>
                    <td>{card.year}</td>
                    <td>{card.setName}</td>
                    <td>{card.team || '—'}</td>
                    <td><ConditionBadge condition={card.estimatedCondition} /></td>
                    <td>{formatValueRange(card.valueRangeLow, card.valueRangeHigh)}</td>
                    <td>{formatLocation(card.binderNumber, card.pageNumber, card.row, card.column)}</td>
                    <td className="audit-cell">{card.lastAuditedAt ? new Date(card.lastAuditedAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Pagination
            currentPage={result.pageNum}
            totalPages={result.totalPages}
            onPageChange={p => updateParam('pageNum', p.toString())}
          />
        </>
      ) : (
        <div className="empty-state">
          <p>No cards found{search ? ` matching "${search}"` : ''}.</p>
          <button className="btn btn-primary" onClick={() => navigate('/cards/new')}>Add Your First Card</button>
        </div>
      )}
    </div>
  );
}
