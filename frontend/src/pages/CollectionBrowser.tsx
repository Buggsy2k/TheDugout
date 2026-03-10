import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Grid, List, Filter, X } from 'lucide-react';
import { cardApi, binderApi } from '../services/api';
import type { Card, CardQueryParams, PaginatedResult, Binder } from '../types';
import { CONDITIONS } from '../types';
import { useDebounce, useLocalStorage } from '../hooks';
import CardTile from '../components/CardTile';
import LoadingSkeleton from '../components/LoadingSkeleton';
import Pagination from '../components/Pagination';
import ConditionBadge from '../components/ConditionBadge';
import { formatValueRange, formatLocation } from '../types';

export default function CollectionBrowser() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<PaginatedResult<Card> | null>(null);
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('collection-view', 'grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filter states from URL params
  const search = searchParams.get('search') || '';
  const binderNumber = searchParams.get('binderNumber') || '';
  const year = searchParams.get('year') || '';
  const setName = searchParams.get('setName') || '';
  const team = searchParams.get('team') || '';
  const manufacturer = searchParams.get('manufacturer') || '';
  const tags = searchParams.get('tags') || '';
  const isGraded = searchParams.get('isGraded') || '';
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
  }, [debouncedSearch, binderNumber, year, setName, team, manufacturer, tags, isGraded, sortBy, sortDir, pageNum]);

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

  const hasFilters = binderNumber || year || setName || team || manufacturer || tags || isGraded;

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
        </div>
      </div>

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
                <CardTile key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <table className="card-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Year</th>
                  <th>Set</th>
                  <th>Team</th>
                  <th>Condition</th>
                  <th>Value</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map(card => (
                  <tr key={card.id} onClick={() => navigate(`/cards/${card.id}`)} className="clickable-row">
                    <td className="player-cell">{card.playerName}</td>
                    <td>{card.year}</td>
                    <td>{card.setName}</td>
                    <td>{card.team || '—'}</td>
                    <td><ConditionBadge condition={card.estimatedCondition} /></td>
                    <td>{formatValueRange(card.valueRangeLow, card.valueRangeHigh)}</td>
                    <td>{formatLocation(card.binderNumber, card.pageNumber, card.row, card.column)}</td>
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
