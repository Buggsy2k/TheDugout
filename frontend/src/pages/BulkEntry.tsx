import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Sparkles, LayoutGrid, Columns, RotateCw, Crop, ImageIcon, Eye } from 'lucide-react';
import { cardApi, pageApi, aiApi, binderApi, API_BASE } from '../services/api';
import type { CreateCard, Card, NextAvailableSuggestion, ExtractedCardImage, CardImageAssignment } from '../types';
import ImageCropDialog from '../components/ImageCropDialog';
import { CONDITIONS } from '../types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '../hooks';
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
  const [binderNumber, setBinderNumber] = useLocalStorage('bulk-binder-number', 1);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageImage, setPageImage] = useState<File | null>(null);
  const [pageImagePreview, setPageImagePreview] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Conflict dialog state
  const [conflictCards, setConflictCards] = useState<Card[]>([]);
  const [conflictSuggestion, setConflictSuggestion] = useState<NextAvailableSuggestion | undefined>();
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingCards, setPendingCards] = useState<CreateCard[]>([]);

  const numCols = layout === '6x3' ? 6 : 3;
  const [cells, setCells] = useState<CellForm[][]>(buildEmptyGrid(3));

  // Per-cell manually cropped images: croppedImages[row][col] = { file, previewUrl }
  const [croppedImages, setCroppedImages] = useState<({ file: File; previewUrl: string } | null)[][]>(
    () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => null))
  );
  const [croppedBackImages, setCroppedBackImages] = useState<({ file: File; previewUrl: string } | null)[][]>(
    () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => null))
  );
  const [cropTarget, setCropTarget] = useState<{ row: number; col: number; side: 'front' | 'back' } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; row: number; col: number; side: 'front' | 'back' } | null>(null);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [lightboxCropMode, setLightboxCropMode] = useState(false);
  const [lightboxCropRect, setLightboxCropRect] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [lightboxDrawing, setLightboxDrawing] = useState(false);
  const lightboxCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightboxImgRef = useRef<HTMLImageElement | null>(null);
  const lightboxScaleRef = useRef(1);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [mosaicSide, setMosaicSide] = useState<'front' | 'back'>('front');
  const [showMosaic, setShowMosaic] = useState(false);

  // Auto-extracted image paths per cell (populated after AI scan)
  const [extractedImages, setExtractedImages] = useState<({ front?: string; back?: string } | null)[][]>(
    () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => null))
  );

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
    setCroppedImages(Array.from({ length: 3 }, () => Array.from({ length: newCols }, () => null)));
    setCroppedBackImages(Array.from({ length: 3 }, () => Array.from({ length: newCols }, () => null)));
    setExtractedImages(Array.from({ length: 3 }, () => Array.from({ length: newCols }, () => null)));
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

  const openLightbox = (src: string, row: number, col: number, side: 'front' | 'back') => {
    setLightbox({ src, row, col, side });
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    setLightboxCropRect(null);
  };

  const closeLightbox = () => {
    setLightbox(null);
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    setLightboxCropRect(null);
    lightboxImgRef.current = null;
  };

  const drawLightboxCanvas = useCallback((rect: typeof lightboxCropRect) => {
    const canvas = lightboxCanvasRef.current;
    const img = lightboxImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect) {
      const x = Math.min(rect.startX, rect.endX);
      const y = Math.min(rect.startY, rect.endY);
      const w = Math.abs(rect.endX - rect.startX);
      const h = Math.abs(rect.endY - rect.startY);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  }, []);

  // Initialize crop canvas when entering crop mode
  useEffect(() => {
    if (!lightboxCropMode || !lightbox) return;
    const canvas = lightboxCanvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      lightboxImgRef.current = img;
      const maxW = window.innerWidth * 0.85;
      const maxH = window.innerHeight * 0.7;
      const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      lightboxScaleRef.current = s;
      canvas.width = img.naturalWidth * s;
      canvas.height = img.naturalHeight * s;
      drawLightboxCanvas(null);
    };
    img.src = lightbox.src;
  }, [lightboxCropMode, lightbox, drawLightboxCanvas]);

  const applyLightboxRotation = () => {
    if (!lightbox || lightboxRotation === 0) return;

    const loadAndRotate = (img: HTMLImageElement) => {
      const rad = (lightboxRotation * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const newW = Math.round(img.naturalWidth * absCos + img.naturalHeight * absSin);
      const newH = Math.round(img.naturalWidth * absSin + img.naturalHeight * absCos);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(newW / 2, newH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      canvas.toBlob(blob => {
        if (!blob || !lightbox) return;
        const file = new File([blob], `rotated_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        const setter = lightbox.side === 'front' ? setCroppedImages : setCroppedBackImages;
        setter(prev => {
          const updated = prev.map(r => [...r]);
          if (updated[lightbox.row][lightbox.col]) {
            URL.revokeObjectURL(updated[lightbox.row][lightbox.col]!.previewUrl);
          }
          updated[lightbox.row][lightbox.col] = { file, previewUrl };
          return updated;
        });

        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';
        newImg.onload = () => { lightboxImgRef.current = newImg; };
        newImg.src = previewUrl;
        setLightbox({ ...lightbox, src: previewUrl });
        setLightboxRotation(0);
        setRotationDegrees(0);
        toast.success(`Rotation applied (${lightboxRotation}°)`);
      }, 'image/jpeg', 0.95);
    };

    if (lightboxImgRef.current && lightboxImgRef.current.complete) {
      loadAndRotate(lightboxImgRef.current);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        lightboxImgRef.current = img;
        loadAndRotate(img);
      };
      img.src = lightbox.src;
    }
  };

  const handleLightboxCropConfirm = () => {
    if (!lightboxCropRect || !lightbox) return;
    const img = lightboxImgRef.current;
    if (!img || !img.complete) {
      toast.error('Image not loaded yet');
      return;
    }
    const s = lightboxScaleRef.current;
    const x = Math.min(lightboxCropRect.startX, lightboxCropRect.endX) / s;
    const y = Math.min(lightboxCropRect.startY, lightboxCropRect.endY) / s;
    const w = Math.abs(lightboxCropRect.endX - lightboxCropRect.startX) / s;
    const h = Math.abs(lightboxCropRect.endY - lightboxCropRect.startY) / s;

    if (w < 10 || h < 10) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(w);
    cropCanvas.height = Math.round(h);
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      Math.round(x), Math.round(y), Math.round(w), Math.round(h),
      0, 0, cropCanvas.width, cropCanvas.height
    );

    try {
      cropCanvas.toBlob(blob => {
        if (!blob || !lightbox) return;
        const file = new File([blob], `crop_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);

        const setter = lightbox.side === 'front' ? setCroppedImages : setCroppedBackImages;
        setter(prev => {
          const updated = prev.map(r => [...r]);
          if (updated[lightbox.row][lightbox.col]) {
            URL.revokeObjectURL(updated[lightbox.row][lightbox.col]!.previewUrl);
          }
          updated[lightbox.row][lightbox.col] = { file, previewUrl };
          return updated;
        });

        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';
        newImg.onload = () => { lightboxImgRef.current = newImg; };
        newImg.src = previewUrl;
        setLightbox({ ...lightbox, src: previewUrl });
        setLightboxCropMode(false);
        setLightboxCropRect(null);
        toast.success('Image cropped');
      }, 'image/jpeg', 0.95);
    } catch {
      toast.error('Crop failed — try using the Crop button on the cell instead');
    }
  };

  const isTiff = (file: File) =>
    /\.tiff?$/i.test(file.name) || file.type === 'image/tiff';

  const convertTiffToPng = async (file: File): Promise<{ pngFile: File; previewUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(`${API_BASE}/api/pages/convert-preview`, {
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

  const extractCardImages = async () => {
    if (!pageImage) return;
    setExtracting(true);
    try {
      const frontExtracts = await pageApi.extractCards(pageImage, layout, binderNumber, pageNumber, 'front');
      let backExtracts: ExtractedCardImage[] = [];
      if (backImage) {
        backExtracts = await pageApi.extractCards(backImage, layout, binderNumber, pageNumber, 'back');
      }
      setExtractedImages(() => {
        const fresh: ({ front?: string; back?: string } | null)[][] =
          Array.from({ length: 3 }, () => Array.from({ length: numCols }, () => null));
        for (const ext of frontExtracts) {
          const ri = ext.row - 1;
          const ci = ext.column - 1;
          if (ri >= 0 && ri < 3 && ci >= 0 && ci < numCols) {
            fresh[ri][ci] = { ...fresh[ri][ci], front: ext.imagePath };
          }
        }
        // Back image columns are mirrored within each 3-col page
        const colsPerPage = 3;
        for (const ext of backExtracts) {
          const ri = ext.row - 1;
          const physicalCol = ext.column - 1; // 0-based
          const pageOffset = physicalCol >= colsPerPage ? colsPerPage : 0;
          const localCol = physicalCol - pageOffset;
          const mirroredCol = (colsPerPage - 1 - localCol) + pageOffset;
          if (ri >= 0 && ri < 3 && mirroredCol >= 0 && mirroredCol < numCols) {
            fresh[ri][mirroredCol] = { ...fresh[ri][mirroredCol], back: ext.imagePath };
          }
        }
        return fresh;
      });
      const frontCount = frontExtracts.length;
      toast.success(`Extracted ${frontCount} card image${frontCount !== 1 ? 's' : ''}${backExtracts.length > 0 ? ' (front + back)' : ''}`);
    } catch {
      toast.error('Image extraction failed');
    } finally {
      setExtracting(false);
    }
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

      // Auto-extract card images after AI scan if not already extracted
      const hasAnyExtracted = extractedImages.some(row => row.some(c => c !== null));
      if (!hasAnyExtracted) {
        await extractCardImages();
      }
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

      // Upload manually cropped images first
      const fullyAssignedIds = new Set<number>();
      for (const card of created) {
        const gridCol = card.pageNumber === pageNumber + 1 && layout === '6x3'
          ? card.column + 3 - 1
          : card.column - 1;
        const gridRow = card.row - 1;
        const cropped = croppedImages[gridRow]?.[gridCol];
        const croppedBack = croppedBackImages[gridRow]?.[gridCol];
        if (cropped) {
          try {
            await cardApi.uploadImage(card.id, cropped.file);
          } catch { /* will fall back to extracted */ }
        }
        if (croppedBack) {
          try {
            await cardApi.uploadBackImage(card.id, croppedBack.file);
          } catch { /* will fall back to extracted */ }
        }
        // Track if both sides are covered by manual crops
        if (cropped && croppedBack) fullyAssignedIds.add(card.id);
      }

      // Assign pre-extracted images (from AI scan step) for cards not fully manually cropped
      const assignments: CardImageAssignment[] = [];
      for (const card of created) {
        if (fullyAssignedIds.has(card.id)) continue;

        const gridCol = card.pageNumber === pageNumber + 1 && layout === '6x3'
          ? card.column + 3 - 1
          : card.column - 1;
        const gridRow = card.row - 1;
        const extracted = extractedImages[gridRow]?.[gridCol];
        const hasCropFront = !!croppedImages[gridRow]?.[gridCol];
        const hasCropBack = !!croppedBackImages[gridRow]?.[gridCol];

        const frontPath = !hasCropFront && extracted?.front ? extracted.front : undefined;
        const backPath = !hasCropBack && extracted?.back ? extracted.back : undefined;

        if (frontPath || backPath) {
          assignments.push({
            cardId: card.id,
            frontImagePath: frontPath,
            backImagePath: backPath,
          });
        }
      }

      if (assignments.length > 0) {
        try {
          await pageApi.assignExtractedImages(assignments);
        } catch { /* image assignment failed but cards saved */ }
      }

      toast.success(`${created.length} card${created.length !== 1 ? 's' : ''} created!`);

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
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={extractCardImages}
                disabled={extracting || scanning}
                style={{ marginBottom: '0.5rem' }}
              >
                <ImageIcon size={16} />
                {extracting ? 'Extracting...' : 'Extract Card Images'}
              </button>
              <button
                type="button"
                className="btn btn-accent btn-ai"
                onClick={handleScanWithAi}
                disabled={scanning || extracting}
              >
                <Sparkles size={16} />
                {scanning ? 'Scanning...' : 'Scan Page with AI'}
              </button>
            </>
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

      {/* Composite mosaic of all extracted images */}
      {extractedImages.some(row => row.some(c => c !== null)) && (
        <div className="mosaic-section">
          <div className="mosaic-header">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowMosaic(!showMosaic)}
            >
              <Eye size={16} /> {showMosaic ? 'Hide' : 'Show'} Extraction Overview
            </button>
            {showMosaic && (
              <div className="mosaic-toggle">
                <button
                  type="button"
                  className={`btn btn-sm ${mosaicSide === 'front' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMosaicSide('front')}
                >
                  Fronts
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${mosaicSide === 'back' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMosaicSide('back')}
                >
                  Backs
                </button>
              </div>
            )}
          </div>
          {showMosaic && (
            <div className={`mosaic-grid mosaic-cols-${numCols}`}>
              {extractedImages.flatMap((row, ri) =>
                row.map((cell, ci) => {
                  const cropped = mosaicSide === 'front' ? croppedImages[ri]?.[ci] : croppedBackImages[ri]?.[ci];
                  const extractedPath = mosaicSide === 'front' ? cell?.front : cell?.back;
                  const src = cropped
                    ? cropped.previewUrl
                    : extractedPath ? `${API_BASE}${extractedPath}` : null;
                  return (
                    <div key={`${ri}-${ci}`} className={`mosaic-cell${!src ? ' mosaic-cell-empty' : ''}`}>
                      {src ? (
                        <img src={src} alt={`R${ri + 1}C${ci + 1}`} onClick={() => openLightbox(src, ri, ci, mosaicSide)} />
                      ) : (
                        <span className="mosaic-cell-label">R{ri + 1}C{ci + 1}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

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
                  {pageImagePreview && (
                    <button
                      type="button"
                      className="btn-crop-cell"
                      title="Crop front card image"
                      onClick={() => setCropTarget({ row: ri, col: ci, side: 'front' })}
                    >
                      <Crop size={14} /> Front
                    </button>
                  )}
                  {backImagePreview && (
                    <button
                      type="button"
                      className="btn-crop-cell"
                      title="Crop back card image"
                      onClick={() => setCropTarget({ row: ri, col: ci, side: 'back' })}
                    >
                      <Crop size={14} /> Back
                    </button>
                  )}
                </div>
                {/* Show cropped or auto-extracted image previews */}
                {(() => {
                  const hasCropFront = !!croppedImages[ri]?.[ci];
                  const hasCropBack = !!croppedBackImages[ri]?.[ci];
                  const extracted = extractedImages[ri]?.[ci];
                  const frontSrc = hasCropFront
                    ? croppedImages[ri][ci]!.previewUrl
                    : extracted?.front ? `${API_BASE}${extracted.front}` : null;
                  const backSrc = hasCropBack
                    ? croppedBackImages[ri][ci]!.previewUrl
                    : extracted?.back ? `${API_BASE}${extracted.back}` : null;
                  if (!frontSrc && !backSrc) return null;
                  return (
                    <div className="bulk-cell-crop-preview">
                      {frontSrc && <img src={frontSrc} alt="Front" onClick={() => openLightbox(frontSrc, ri, ci, 'front')} />}
                      {backSrc && <img src={backSrc} alt="Back" onClick={() => openLightbox(backSrc, ri, ci, 'back')} />}
                    </div>
                  );
                })()}
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

      {cropTarget && (
        (cropTarget.side === 'front' ? pageImagePreview : backImagePreview) && (
        <ImageCropDialog
          imageUrl={(cropTarget.side === 'front' ? pageImagePreview : backImagePreview)!}
          cellLabel={`${cropTarget.side === 'back' ? 'Back — ' : ''}${layout === '6x3'
            ? `P${cropTarget.col >= 3 ? pageNumber + 1 : pageNumber} R${cropTarget.row + 1}-C${cropTarget.col >= 3 ? cropTarget.col - 2 : cropTarget.col + 1}`
            : `R${cropTarget.row + 1} - C${cropTarget.col + 1}`}`}
          onCrop={(file) => {
            const previewUrl = URL.createObjectURL(file);
            const setter = cropTarget.side === 'front' ? setCroppedImages : setCroppedBackImages;
            const getter = cropTarget.side === 'front' ? croppedImages : croppedBackImages;
            setter(prev => {
              const updated = prev.map(r => [...r]);
              if (updated[cropTarget.row][cropTarget.col]) {
                URL.revokeObjectURL(updated[cropTarget.row][cropTarget.col]!.previewUrl);
              }
              updated[cropTarget.row][cropTarget.col] = { file, previewUrl };
              return updated;
            });
            setCropTarget(null);
            toast.success(`${cropTarget.side === 'back' ? 'Back' : 'Front'} image cropped`);
          }}
          onCancel={() => setCropTarget(null)}
        />
      ))}

      {lightbox && (
        <div className="dialog-overlay" onClick={closeLightbox}>
          <div className="lightbox-editor" onClick={e => e.stopPropagation()}>
            <div className="lightbox-toolbar">
              <span className="lightbox-label">
                R{lightbox.row + 1}C{lightbox.col + 1} — {lightbox.side === 'front' ? 'Front' : 'Back'}
                {lightboxRotation !== 0 && <span className="rotation-preview-badge">{lightboxRotation}°</span>}
              </span>
              <div className="lightbox-rotate-controls">
                <button className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev - 90)} title="Rotate 90° left" disabled={lightboxCropMode}>
                  ↺ 90°
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev + 90)} title="Rotate 90° right" disabled={lightboxCropMode}>
                  ↻ 90°
                </button>
                <input
                  type="number"
                  className="rotate-degrees-input"
                  value={rotationDegrees}
                  onChange={e => setRotationDegrees(Number(e.target.value))}
                  min={-360}
                  max={360}
                  step={1}
                  title="Custom rotation degrees"
                  disabled={lightboxCropMode}
                />
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => { setLightboxRotation(prev => prev + rotationDegrees); setRotationDegrees(0); }}
                  disabled={rotationDegrees === 0 || lightboxCropMode}
                  title="Add custom rotation"
                >
                  <RotateCw size={14} /> Rotate
                </button>
              </div>
              {lightboxRotation !== 0 && (
                <button className="btn btn-sm btn-primary" onClick={applyLightboxRotation} title="Commit rotation">
                  Apply Rotation
                </button>
              )}
              <button
                className={`btn btn-sm ${lightboxCropMode ? 'btn-accent' : 'btn-secondary'}`}
                onClick={() => {
                  if (!lightboxCropMode) {
                    setLightboxCropMode(true);
                    setLightboxCropRect(null);
                  } else {
                    setLightboxCropMode(false);
                    setLightboxCropRect(null);
                  }
                }}
                title={lightboxRotation !== 0 ? 'Apply rotation first' : 'Crop'}
                disabled={lightboxRotation !== 0}
              >
                <Crop size={16} /> {lightboxCropMode ? 'Cancel Crop' : 'Crop'}
              </button>
              {lightboxCropMode && lightboxCropRect &&
                Math.abs(lightboxCropRect.endX - lightboxCropRect.startX) > 10 &&
                Math.abs(lightboxCropRect.endY - lightboxCropRect.startY) > 10 && (
                <button className="btn btn-sm btn-primary" onClick={handleLightboxCropConfirm}>
                  Apply Crop
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={closeLightbox} style={{ marginLeft: 'auto' }}>✕</button>
            </div>
            {lightboxCropMode ? (
              <div className="lightbox-canvas-wrap">
                <canvas
                  ref={lightboxCanvasRef}
                  onMouseDown={e => {
                    const rect = lightboxCanvasRef.current!.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    setLightboxCropRect({ startX: x, startY: y, endX: x, endY: y });
                    setLightboxDrawing(true);
                  }}
                  onMouseMove={e => {
                    if (!lightboxDrawing || !lightboxCropRect) return;
                    const rect = lightboxCanvasRef.current!.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const updated = { ...lightboxCropRect, endX: x, endY: y };
                    setLightboxCropRect(updated);
                    drawLightboxCanvas(updated);
                  }}
                  onMouseUp={() => setLightboxDrawing(false)}
                  onMouseLeave={() => setLightboxDrawing(false)}
                  className="crop-canvas"
                />
              </div>
            ) : (
              <img
                src={lightbox.src}
                alt="Full size preview"
                className="lightbox-image"
                style={lightboxRotation !== 0 ? { transform: `rotate(${lightboxRotation}deg)` } : undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
