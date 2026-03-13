import { useState, useEffect, useRef } from 'react';
import { Upload, Sparkles, LayoutGrid, Columns, RotateCw } from 'lucide-react';
import { cardApi, pageApi, aiApi, binderApi } from '../services/api';
import type { CreateCard, Card, NextAvailableSuggestion, ExtractedCardImage, CardImageAssignment } from '../types';
import { CONDITIONS } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTokenUsage } from '../contexts/TokenUsageContext';
import ConflictOverwriteDialog from '../components/ConflictOverwriteDialog';

type PageLayout = '3x3' | '6x3';

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

function buildEmptyGrid(cols: number): CellForm[][] {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: cols }, () => ({ ...emptyCell }))
  );
}

export default function BulkEntry() {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<PageLayout>('3x3');
  const [binderNumber, setBinderNumber] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageImage, setPageImage] = useState<File | null>(null);
  const [pageImagePreview, setPageImagePreview] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { updateTokenUsage } = useTokenUsage();

  // Conflict dialog state
  const [conflictCards, setConflictCards] = useState<Card[]>([]);
  const [conflictSuggestion, setConflictSuggestion] = useState<NextAvailableSuggestion | undefined>();
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingCards, setPendingCards] = useState<CreateCard[]>([]);

  const numCols = layout === '6x3' ? 6 : 3;
  const [cells, setCells] = useState<CellForm[][]>(buildEmptyGrid(3));

  const [defaultSetName, setDefaultSetName] = useState('');
  const [defaultYear, setDefaultYear] = useState('');
  const [defaultManufacturer, setDefaultManufacturer] = useState('');

  const [binderTotalPages, setBinderTotalPages] = useState<number | null>(null);
  const [binderAtCapacity, setBinderAtCapacity] = useState(false);
  const isInitialMount = useRef(true);

  // Auto-update page number when binder number changes
  useEffect(() => {
    // Skip the initial mount so we don't override the default page 1
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const binder = await binderApi.getBinder(binderNumber);
        const maxPage = binder.cards.length > 0
          ? Math.max(...binder.cards.map(c => c.pageNumber))
          : 0;
        const nextPage = maxPage + 1;
        const total = binder.totalPages ?? null;
        setBinderTotalPages(total);

        if (total && nextPage > total) {
          setPageNumber(maxPage || 1);
          setBinderAtCapacity(true);
          toast('This binder is full — all pages are in use', { icon: '⚠️' });
        } else {
          setPageNumber(nextPage);
          setBinderAtCapacity(false);
        }
      } catch {
        // Binder doesn't exist yet — reset to page 1
        setBinderTotalPages(null);
        setBinderAtCapacity(false);
        setPageNumber(1);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [binderNumber]);

  const handleLayoutChange = (newLayout: PageLayout) => {
    const newCols = newLayout === '6x3' ? 6 : 3;
    setLayout(newLayout);
    setCells(buildEmptyGrid(newCols));
    setPageImage(null);
    setPageImagePreview(null);
    setBackImage(null);
    setBackImagePreview(null);
  };

  const updateCell = (row: number, col: number, field: keyof CellForm, value: string) => {
    setCells(prev => {
      const updated = prev.map(r => r.map(c => ({ ...c })));
      updated[row][col] = { ...updated[row][col], [field]: value };
      return updated;
    });
  };

  const isTiff = (file: File) =>
    /\.tiff?$/i.test(file.name) || file.type === 'image/tiff';

  const convertTiffToPng = async (file: File): Promise<{ pngFile: File; previewUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch('http://localhost:5137/api/pages/convert-preview', {
      method: 'POST',
      body: formData,
    });
    const blob = await resp.blob();
    const pngName = file.name.replace(/\.tiff?$/i, '.png');
    const pngFile = new File([blob], pngName, { type: 'image/png' });
    const previewUrl = URL.createObjectURL(blob);
    return { pngFile, previewUrl };
  };

  const handlePageImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isTiff(file)) {
      try {
        const { pngFile, previewUrl } = await convertTiffToPng(file);
        setPageImage(pngFile);
        setPageImagePreview(previewUrl);
      } catch {
        setPageImage(file);
        setPageImagePreview(null);
      }
    } else {
      setPageImage(file);
      const reader = new FileReader();
      reader.onload = () => setPageImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isTiff(file)) {
      try {
        const { pngFile, previewUrl } = await convertTiffToPng(file);
        setBackImage(pngFile);
        setBackImagePreview(previewUrl);
      } catch {
        setBackImage(file);
        setBackImagePreview(null);
      }
    } else {
      setBackImage(file);
      const reader = new FileReader();
      reader.onload = () => setBackImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
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

  const handleScanWithAi = async () => {
    if (!pageImage) {
      toast.error('Upload a page photo first');
      return;
    }
    setScanning(true);
    try {
      const response = await aiApi.identifyPage(pageImage, layout, backImage ?? undefined);
      const result = response.result;
      updateTokenUsage(response.tokenUsage);
      setCells(prev => {
        const updated = prev.map(r => r.map(c => ({ ...c })));
        for (const item of result.cards) {
          const ri = item.row - 1;
          const ci = item.column - 1;
          if (ri >= 0 && ri < 3 && ci >= 0 && ci < numCols && !item.isEmpty && item.card) {
            updated[ri][ci] = {
              playerName: item.card.playerName || '',
              year: item.card.year?.toString() || '',
              setName: item.card.setName || '',
              cardNumber: item.card.cardNumber || '',
              team: item.card.team || '',
              estimatedCondition: item.card.estimatedCondition || 'UNKNOWN',
              valueRangeLow: item.card.valueRangeLow?.toString() || '',
              valueRangeHigh: item.card.valueRangeHigh?.toString() || '',
              notes: item.card.notes || '',
            };
          }
        }
        return updated;
      });
      const identified = result.cards.filter(c => !c.isEmpty).length;
      toast.success(`AI identified ${identified} card${identified !== 1 ? 's' : ''} on this page`);
    } catch (err: unknown) {
      let msg = 'AI page scan failed';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: string } };
        if (typeof axiosErr.response?.data === 'string' && axiosErr.response.data) {
          msg = axiosErr.response.data;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const handleSaveAll = async () => {
    const cards = buildCardList();
    if (cards.length === 0) {
      toast.error('Enter at least one card (player name required)');
      return;
    }

    // Check for page conflicts before saving
    const targetPages = [...new Set(cards.map(c => c.pageNumber))];
    try {
      const conflict = await cardApi.checkPageConflicts(binderNumber, targetPages);
      if (conflict.hasConflicts) {
        setConflictCards(conflict.conflictingCards);
        setConflictSuggestion(conflict.suggestion);
        setPendingCards(cards);
        setShowConflictDialog(true);
        return;
      }
    } catch {
      // If conflict check fails, proceed anyway
    }

    await executeSave(cards);
  };

  const handleConflictUseSuggestion = (suggestion: NextAvailableSuggestion) => {
    setShowConflictDialog(false);
    setPageNumber(suggestion.pageNumber);
    toast.success(`Page updated to ${suggestion.pageNumber}`);
  };

  const handleConflictOverwrite = async () => {
    setShowConflictDialog(false);
    const idsToUnassign = conflictCards.map(c => c.id);
    try {
      await cardApi.unassignCards(idsToUnassign);
      toast.success(`${idsToUnassign.length} existing card${idsToUnassign.length !== 1 ? 's' : ''} unassigned`);
    } catch {
      toast.error('Failed to unassign existing cards');
      return;
    }
    await executeSave(pendingCards);
  };

  const buildCardList = (): CreateCard[] => {
    const cards: CreateCard[] = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = cells[r][c];
        if (!cell.playerName.trim()) continue;

        const isRightPage = layout === '6x3' && c >= 3;
        const cardPageNumber = isRightPage ? pageNumber + 1 : pageNumber;
        const cardColumn = isRightPage ? c - 2 : c + 1;

        cards.push({
          binderNumber,
          pageNumber: cardPageNumber,
          row: r + 1,
          column: cardColumn,
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
    return cards;
  };

  const executeSave = async (cards: CreateCard[]) => {
    setSaving(true);
    try {
      if (pageImage) {
        await pageApi.uploadPageImage(binderNumber, pageNumber, pageImage);
        if (layout === '6x3') {
          await pageApi.uploadPageImage(binderNumber, pageNumber + 1, pageImage);
        }
      }

      const created = await cardApi.bulkCreate(cards);

      // Extract individual card images from page photos
      if (pageImage && created.length > 0) {
        try {
          const frontExtracts = await pageApi.extractCards(pageImage, layout, binderNumber, pageNumber, 'front');
          let backExtracts: ExtractedCardImage[] = [];
          if (backImage) {
            backExtracts = await pageApi.extractCards(backImage, layout, binderNumber, pageNumber, 'back');
          }

          const assignments: CardImageAssignment[] = [];
          // Number of columns per physical page (always 3 for a standard binder page)
          const colsPerPage = 3;
          for (const card of created) {
            // Match extracted images to created cards by row/column
            // For 6x3, right-page cards (page+1) have cols 1-3 but were extracted as cols 4-6
            const gridCol = card.pageNumber === pageNumber + 1 && layout === '6x3'
              ? card.column + 3
              : card.column;

            const front = frontExtracts.find(e => e.row === card.row && e.column === gridCol);

            // Back photo is a mirror of the front — columns are reversed within each page
            // e.g. for 3x3: front col 1 = back col 3, front col 2 = back col 2
            // For 6x3: mirror within each 3-col half (cols 1-3 and cols 4-6 independently)
            const pageColOffset = gridCol > colsPerPage ? colsPerPage : 0;
            const localCol = gridCol - pageColOffset;
            const mirroredCol = (colsPerPage + 1 - localCol) + pageColOffset;
            const back = backExtracts.find(e => e.row === card.row && e.column === mirroredCol);
            if (front || back) {
              assignments.push({
                cardId: card.id,
                frontImagePath: front?.imagePath,
                backImagePath: back?.imagePath,
              });
            }
          }

          if (assignments.length > 0) {
            await pageApi.assignExtractedImages(assignments);
          }
          toast.success(`${created.length} card${created.length !== 1 ? 's' : ''} created with images!`);
        } catch {
          // Image extraction failed but cards were created successfully
          toast.success(`${created.length} card${created.length !== 1 ? 's' : ''} created (image extraction failed)`);
        }
      } else {
        toast.success(`${created.length} card${created.length !== 1 ? 's' : ''} created!`);
      }

      navigate(`/binders/${binderNumber}?page=${pageNumber}`);
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
      <p className="page-subtitle">
        {layout === '6x3'
          ? `Enter up to 18 cards from two consecutive binder pages (${pageNumber} & ${pageNumber + 1}).`
          : 'Enter up to 9 cards from a single binder page at once.'}
      </p>

      <div className="bulk-header">
        <div className="bulk-header-fields">
          <div className="form-row">
            <div className="form-group">
              <label>Layout</label>
              <div className="layout-toggle">
                <button
                  type="button"
                  className={`layout-btn ${layout === '3x3' ? 'active' : ''}`}
                  onClick={() => handleLayoutChange('3x3')}
                >
                  <LayoutGrid size={16} />
                  3×3
                </button>
                <button
                  type="button"
                  className={`layout-btn ${layout === '6x3' ? 'active' : ''}`}
                  onClick={() => handleLayoutChange('6x3')}
                >
                  <Columns size={16} />
                  6×3
                </button>
              </div>
            </div>
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
              <label>{layout === '6x3' ? 'Left Page Number' : 'Page Number'}</label>
              <input
                type="number"
                value={pageNumber}
                onChange={e => setPageNumber(parseInt(e.target.value) || 1)}
                min={1}
              />
              {binderTotalPages && (
                <small className={`page-capacity-hint ${binderAtCapacity ? 'at-capacity' : ''}`}>
                  {binderAtCapacity
                    ? `Binder full (${binderTotalPages} pages)`
                    : `of ${binderTotalPages} pages`}
                </small>
              )}
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
          <label>Page Photo — Front (optional)</label>
          <div className="page-image-upload">
            {pageImagePreview ? (
              <img src={pageImagePreview} alt="Page" className="page-image-preview" />
            ) : (
              <div className="page-image-placeholder">
                <Upload size={24} />
                <span>Upload front photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/tiff"
              onChange={handlePageImageChange}
              className="image-input"
            />
          </div>
          {pageImage && (
            <button
              type="button"
              className="btn btn-accent btn-ai"
              onClick={handleScanWithAi}
              disabled={scanning}
            >
              <Sparkles size={16} />
              {scanning ? 'Scanning...' : 'Scan Page with AI'}
            </button>
          )}
          <label style={{ marginTop: '0.75rem' }}>Page Photo — Back (optional)</label>
          <div className="page-image-upload">
            {backImagePreview ? (
              <img src={backImagePreview} alt="Back" className="page-image-preview" />
            ) : (
              <div className="page-image-placeholder">
                <RotateCw size={24} />
                <span>Upload back photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/tiff"
              onChange={handleBackImageChange}
              className="image-input"
            />
          </div>
        </div>
      </div>

      <div className="bulk-grid">
        {cells.map((row, ri) => (
          <div key={ri} className={`bulk-row ${layout === '6x3' ? 'bulk-row-6' : ''}`}>
            {row.map((cell, ci) => {
              const isRightPage = layout === '6x3' && ci >= 3;
              const displayPage = isRightPage ? pageNumber + 1 : pageNumber;
              const displayCol = isRightPage ? ci - 2 : ci + 1;
              return (
              <div key={ci} className={`bulk-cell ${layout === '6x3' && ci === 3 ? 'bulk-cell-divider' : ''}`}>
                <div className="bulk-cell-header">
                  <span>{layout === '6x3' ? `P${displayPage} R${ri + 1}-C${displayCol}` : `R${ri + 1} - C${ci + 1}`}</span>
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
            );
            })}
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

      {showConflictDialog && (
        <ConflictOverwriteDialog
          mode="page"
          conflictingCards={conflictCards}
          suggestion={conflictSuggestion}
          onCancel={() => setShowConflictDialog(false)}
          onUseSuggestion={handleConflictUseSuggestion}
          onOverwrite={handleConflictOverwrite}
        />
      )}
    </div>
  );
}
