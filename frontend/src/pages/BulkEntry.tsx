import { useState } from 'react';
import { Upload } from 'lucide-react';
import { cardApi, pageApi } from '../services/api';
import type { CreateCard } from '../types';
import { CONDITIONS } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface CellForm {
  playerName: string;
  year: string;
  setName: string;
  cardNumber: string;
  team: string;
  estimatedCondition: string;
  valueRangeLow: string;
  valueRangeHigh: string;
  notes: string;
}

const emptyCell: CellForm = {
  playerName: '',
  year: '',
  setName: '',
  cardNumber: '',
  team: '',
  estimatedCondition: 'UNKNOWN',
  valueRangeLow: '',
  valueRangeHigh: '',
  notes: '',
};

export default function BulkEntry() {
  const navigate = useNavigate();
  const [binderNumber, setBinderNumber] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageImage, setPageImage] = useState<File | null>(null);
  const [pageImagePreview, setPageImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [cells, setCells] = useState<CellForm[][]>([
    [{ ...emptyCell }, { ...emptyCell }, { ...emptyCell }],
    [{ ...emptyCell }, { ...emptyCell }, { ...emptyCell }],
    [{ ...emptyCell }, { ...emptyCell }, { ...emptyCell }],
  ]);

  const [defaultSetName, setDefaultSetName] = useState('');
  const [defaultYear, setDefaultYear] = useState('');
  const [defaultManufacturer, setDefaultManufacturer] = useState('');

  const updateCell = (row: number, col: number, field: keyof CellForm, value: string) => {
    setCells(prev => {
      const updated = prev.map(r => r.map(c => ({ ...c })));
      updated[row][col] = { ...updated[row][col], [field]: value };
      return updated;
    });
  };

  const handlePageImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPageImage(file);
    const reader = new FileReader();
    reader.onload = () => setPageImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const applyDefaults = () => {
    setCells(prev =>
      prev.map(row =>
        row.map(cell => ({
          ...cell,
          setName: cell.setName || defaultSetName,
          year: cell.year || defaultYear,
        }))
      )
    );
    toast.success('Defaults applied to empty fields');
  };

  const handleSaveAll = async () => {
    const cards: CreateCard[] = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = cells[r][c];
        if (!cell.playerName.trim()) continue;

        cards.push({
          binderNumber,
          pageNumber,
          row: r + 1,
          column: c + 1,
          playerName: cell.playerName.trim(),
          year: parseInt(cell.year) || new Date().getFullYear(),
          setName: cell.setName.trim() || defaultSetName || 'Unknown',
          cardNumber: cell.cardNumber || undefined,
          team: cell.team || undefined,
          manufacturer: defaultManufacturer || undefined,
          estimatedCondition: cell.estimatedCondition,
          valueRangeLow: cell.valueRangeLow ? parseFloat(cell.valueRangeLow) : undefined,
          valueRangeHigh: cell.valueRangeHigh ? parseFloat(cell.valueRangeHigh) : undefined,
          notes: cell.notes || undefined,
          isGraded: false,
        });
      }
    }

    if (cards.length === 0) {
      toast.error('Enter at least one card (player name required)');
      return;
    }

    setSaving(true);
    try {
      if (pageImage) {
        await pageApi.uploadPageImage(binderNumber, pageNumber, pageImage);
      }

      const created = await cardApi.bulkCreate(cards);
      toast.success(`${created.length} card${created.length !== 1 ? 's' : ''} created!`);
      navigate('/collection');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save cards';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page bulk-entry-page">
      <h1 className="page-title">Bulk Entry</h1>
      <p className="page-subtitle">Enter up to 9 cards from a single binder page at once.</p>

      <div className="bulk-header">
        <div className="bulk-header-fields">
          <div className="form-row">
            <div className="form-group">
              <label>Binder Number</label>
              <input
                type="number"
                value={binderNumber}
                onChange={e => setBinderNumber(parseInt(e.target.value) || 1)}
                min={1}
              />
            </div>
            <div className="form-group">
              <label>Page Number</label>
              <input
                type="number"
                value={pageNumber}
                onChange={e => setPageNumber(parseInt(e.target.value) || 1)}
                min={1}
              />
            </div>
          </div>

          <h3 className="form-section-title">Defaults (applied to empty fields)</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Default Set Name</label>
              <input
                type="text"
                value={defaultSetName}
                onChange={e => setDefaultSetName(e.target.value)}
                placeholder="e.g. Topps"
              />
            </div>
            <div className="form-group">
              <label>Default Year</label>
              <input
                type="text"
                value={defaultYear}
                onChange={e => setDefaultYear(e.target.value)}
                placeholder="e.g. 1987"
              />
            </div>
            <div className="form-group">
              <label>Default Manufacturer</label>
              <input
                type="text"
                value={defaultManufacturer}
                onChange={e => setDefaultManufacturer(e.target.value)}
                placeholder="e.g. Topps"
              />
            </div>
            <div className="form-group form-group-btn">
              <button type="button" className="btn btn-secondary" onClick={applyDefaults}>
                Apply Defaults
              </button>
            </div>
          </div>
        </div>

        <div className="bulk-header-image">
          <label>Page Photo (optional)</label>
          <div className="page-image-upload">
            {pageImagePreview ? (
              <img src={pageImagePreview} alt="Page" className="page-image-preview" />
            ) : (
              <div className="page-image-placeholder">
                <Upload size={24} />
                <span>Upload page photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePageImageChange}
              className="image-input"
            />
          </div>
        </div>
      </div>

      <div className="bulk-grid">
        {cells.map((row, ri) => (
          <div key={ri} className="bulk-row">
            {row.map((cell, ci) => (
              <div key={ci} className="bulk-cell">
                <div className="bulk-cell-header">
                  <span>R{ri + 1} - C{ci + 1}</span>
                </div>
                <div className="bulk-cell-fields">
                  <input
                    type="text"
                    placeholder="Player Name *"
                    value={cell.playerName}
                    onChange={e => updateCell(ri, ci, 'playerName', e.target.value)}
                    className="bulk-input-primary"
                  />
                  <div className="bulk-cell-row">
                    <input
                      type="text"
                      placeholder="Year"
                      value={cell.year}
                      onChange={e => updateCell(ri, ci, 'year', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Set"
                      value={cell.setName}
                      onChange={e => updateCell(ri, ci, 'setName', e.target.value)}
                    />
                  </div>
                  <div className="bulk-cell-row">
                    <input
                      type="text"
                      placeholder="Card #"
                      value={cell.cardNumber}
                      onChange={e => updateCell(ri, ci, 'cardNumber', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Team"
                      value={cell.team}
                      onChange={e => updateCell(ri, ci, 'team', e.target.value)}
                    />
                  </div>
                  <select
                    value={cell.estimatedCondition}
                    onChange={e => updateCell(ri, ci, 'estimatedCondition', e.target.value)}
                  >
                    {CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <div className="bulk-cell-row">
                    <input
                      type="text"
                      placeholder="$ Low"
                      value={cell.valueRangeLow}
                      onChange={e => updateCell(ri, ci, 'valueRangeLow', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="$ High"
                      value={cell.valueRangeHigh}
                      onChange={e => updateCell(ri, ci, 'valueRangeHigh', e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Notes"
                    value={cell.notes}
                    onChange={e => updateCell(ri, ci, 'notes', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="bulk-actions">
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleSaveAll}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save All Cards'}
        </button>
      </div>
    </div>
  );
}
