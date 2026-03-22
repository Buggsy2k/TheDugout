import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Sparkles, LayoutGrid, Columns, RotateCw, Crop, Eye, ImagePlus, RefreshCw, Wand2, Undo2, ChevronLeft, ChevronRight, AlignVerticalSpaceAround, ImageOff, Check, X } from 'lucide-react';
import { cardApi, pageApi, aiApi, binderApi, API_BASE } from '../services/api';
import type { CreateCard, Card, NextAvailableSuggestion, ExtractedCardImage, CardImageAssignment } from '../types';
import ImageCropDialog from '../components/ImageCropDialog';
import { CONDITIONS } from '../types';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLocalStorage } from '../hooks';
import { useLightboxCrop } from '../hooks/useLightboxCrop';
import ConflictOverwriteDialog from '../components/ConflictOverwriteDialog';

type PageLayout = '3x3' | '6x3';
type EntryMode = 'new' | 'update-images';

const DEFAULT_EXTRACTION_PARAMS = {
  cannyLow: 30, cannyHigh: 100, blurSize: 5, morphIterations: 2,
  contourPadding: 0.02, fallbackMargin: 0.03, minCardAreaRatio: 0.25,
  minAspectRatio: 0.45, maxAspectRatio: 0.95,
};

type ExtractionParams = typeof DEFAULT_EXTRACTION_PARAMS;
interface ExtractionPreset { name: string; params: ExtractionParams; }

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
  const [searchParams] = useSearchParams();
  const paramBinder = searchParams.get('binder');
  const paramPage = searchParams.get('page');
  const paramMode = searchParams.get('mode');
  const [mode, setMode] = useState<EntryMode>(paramMode === 'update-images' ? 'update-images' : 'new');
  const [layout, setLayout] = useState<PageLayout>('3x3');
  const [binderNumber, setBinderNumber] = useLocalStorage('bulk-binder-number', paramBinder ? parseInt(paramBinder) || 1 : 1);
  const [pageNumber, setPageNumber] = useState(paramPage ? parseInt(paramPage) || 1 : 1);
  const [pageImage, setPageImage] = useState<File | null>(null);
  const [pageImagePreview, setPageImagePreview] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Extraction tuning params (persists last-used settings)
  const [showExtractionSettings, setShowExtractionSettings] = useState(false);
  const [extractionParams, setExtractionParams] = useLocalStorage<ExtractionParams>(
    'bulk-extraction-params', DEFAULT_EXTRACTION_PARAMS
  );
  const [extractionPresets, setExtractionPresets] = useLocalStorage<ExtractionPreset[]>(
    'bulk-extraction-presets', []
  );
  const [selectedPresetName, setSelectedPresetName] = useState('');

  const updateExtractionParam = (key: keyof ExtractionParams, value: number) => {
    setExtractionParams(prev => ({ ...prev, [key]: value }));
    setSelectedPresetName('');
  };

  const savePreset = () => {
    const name = prompt('Preset name:');
    if (!name?.trim()) return;
    const trimmed = name.trim();
    setExtractionPresets(prev => {
      const filtered = prev.filter(p => p.name !== trimmed);
      return [...filtered, { name: trimmed, params: { ...extractionParams } }];
    });
    setSelectedPresetName(trimmed);
  };

  const loadPreset = (name: string) => {
    if (!name) { setSelectedPresetName(''); return; }
    const preset = extractionPresets.find(p => p.name === name);
    if (preset) {
      setExtractionParams(preset.params);
      setSelectedPresetName(name);
    }
  };

  const deletePreset = () => {
    if (!selectedPresetName) return;
    setExtractionPresets(prev => prev.filter(p => p.name !== selectedPresetName));
    setSelectedPresetName('');
  };

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
  const [originalLightboxSrc, setOriginalLightboxSrc] = useState<string | null>(null);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [lightboxCropMode, setLightboxCropMode] = useState(false);
  const lbCrop = useLightboxCrop();
  const cropConfirmRef = useRef<() => void>(() => {});
  const rotateApplyRef = useRef<() => void>(() => {});
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [showOriginalInLightbox, setShowOriginalInLightbox] = useState(false);
  const [mosaicSide, setMosaicSide] = useState<'front' | 'back'>('front');
  const [showMosaic, setShowMosaic] = useState(false);

  // Auto-extracted image paths per cell (populated after AI scan)
  const [extractedImages, setExtractedImages] = useState<({ front?: string; back?: string } | null)[][]>(
    () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => null))
  );

  const [defaultSetName, setDefaultSetName] = useState('');
  const [defaultYear, setDefaultYear] = useState('');
  const [defaultManufacturer, setDefaultManufacturer] = useState('');

  // Update-images mode: existing cards on the page
  const [existingCards, setExistingCards] = useState<Card[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [binderTotalPages, setBinderTotalPages] = useState<number | null>(null);
  const [binderAtCapacity, setBinderAtCapacity] = useState(false);
  const isInitialMount = useRef(true);
  const skipNextBinderEffect = useRef(!!paramBinder);

  // Override binder/page from URL params (takes priority over localStorage)
  useEffect(() => {
    if (paramBinder) setBinderNumber(parseInt(paramBinder) || 1);
    if (paramPage) setPageNumber(parseInt(paramPage) || 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update page number when binder number changes (only in new mode)
  useEffect(() => {
    // Skip the initial mount so we don't override the default page 1
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Skip when URL params set the binder initially
    if (skipNextBinderEffect.current) {
      skipNextBinderEffect.current = false;
      return;
    }
    // Don't auto-advance page in update-images mode
    if (mode === 'update-images') return;

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

  // Load existing cards when in update-images mode and binder/page changes
  useEffect(() => {
    if (mode !== 'update-images') return;
    const load = async () => {
      setLoadingExisting(true);
      try {
        const cards = await pageApi.getPageCards(binderNumber, pageNumber);
        setExistingCards(cards);
        // Also load right page for 6x3
        if (layout === '6x3') {
          const rightCards = await pageApi.getPageCards(binderNumber, pageNumber + 1);
          setExistingCards(prev => [...cards, ...rightCards]);
        }
      } catch {
        setExistingCards([]);
      } finally {
        setLoadingExisting(false);
      }
    };
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [mode, binderNumber, pageNumber, layout]);

  // Helper to find existing card at a grid position
  const getExistingCardAt = (gridRow: number, gridCol: number): Card | undefined => {
    const isRightPage = layout === '6x3' && gridCol >= 3;
    const cardPageNumber = isRightPage ? pageNumber + 1 : pageNumber;
    const cardColumn = isRightPage ? gridCol - 2 : gridCol + 1;
    const cardRow = gridRow + 1;
    return existingCards.find(c => c.pageNumber === cardPageNumber && c.row === cardRow && c.column === cardColumn);
  };

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
    setOriginalLightboxSrc(src);
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    setShowOriginalInLightbox(false);
    lbCrop.reset();
  };

  const closeLightbox = () => {
    setLightbox(null);
    setOriginalLightboxSrc(null);
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    setShowOriginalInLightbox(false);
    lbCrop.reset();
  };

  // Resolve the image src for a given cell and side
  const getCellImageSrc = useCallback((row: number, col: number, side: 'front' | 'back'): string | null => {
    const cropped = side === 'front' ? croppedImages[row]?.[col] : croppedBackImages[row]?.[col];
    if (cropped) return cropped.previewUrl;
    const extracted = extractedImages[row]?.[col];
    const extractedPath = side === 'front' ? extracted?.front : extracted?.back;
    if (extractedPath) return `${API_BASE}${extractedPath}`;
    if (mode === 'update-images') {
      const card = getExistingCardAt(row, col);
      const cardPath = side === 'front' ? card?.imagePath : card?.backImagePath;
      if (cardPath) return `${API_BASE}${cardPath}`;
    }
    return null;
  }, [croppedImages, croppedBackImages, extractedImages, mode, existingCards, layout, pageNumber]);

  // Navigate to next/prev image in sequence: r0c0-front, r0c0-back, r0c1-front, ...
  const navigateLightbox = useCallback((direction: 1 | -1) => {
    if (!lightbox || lightboxCropMode || lightboxRotation !== 0) return;
    const numRows = 3;
    const slots: { row: number; col: number; side: 'front' | 'back' }[] = [];
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        slots.push({ row: r, col: c, side: 'front' });
        slots.push({ row: r, col: c, side: 'back' });
      }
    }
    const currentIdx = slots.findIndex(
      s => s.row === lightbox.row && s.col === lightbox.col && s.side === lightbox.side
    );
    if (currentIdx < 0) return;

    // Search in direction, wrapping around, for a slot with an image
    for (let i = 1; i < slots.length; i++) {
      const nextIdx = (currentIdx + direction * i + slots.length) % slots.length;
      const next = slots[nextIdx];
      const src = getCellImageSrc(next.row, next.col, next.side);
      if (src) {
        openLightbox(src, next.row, next.col, next.side);
        return;
      }
    }
  }, [lightbox, lightboxCropMode, lightboxRotation, numCols, getCellImageSrc]);

  // Arrow key navigation when lightbox is open
  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      // Escape cancels pending rotation or crop mode
      if (e.key === 'Escape') {
        if (lightboxRotation !== 0) {
          e.preventDefault();
          setLightboxRotation(0);
          setRotationDegrees(0);
          return;
        }
        if (lightboxCropMode) {
          e.preventDefault();
          setLightboxCropMode(false);
          lbCrop.reset();
          return;
        }
      }
      // Enter applies pending rotation or crop
      if (e.key === 'Enter') {
        e.preventDefault();
        if (lightboxRotation !== 0) {
          rotateApplyRef.current();
          return;
        }
        if (lightboxCropMode) {
          if (lbCrop.hasSelection) {
            cropConfirmRef.current();
          } else {
            setLightboxCropMode(false);
            lbCrop.reset();
          }
          return;
        }
      }
      if (lightboxCropMode || lightboxRotation !== 0) return;
      // Don't navigate when an input element has focus
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateLightbox(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateLightbox(-1); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, lightboxCropMode, lightboxRotation, navigateLightbox]);

  const handleRevertLightbox = () => {
    if (!lightbox || !originalLightboxSrc) return;
    // Remove the cropped image for this cell
    const setter = lightbox.side === 'front' ? setCroppedImages : setCroppedBackImages;
    setter(prev => {
      const updated = prev.map(r => [...r]);
      if (updated[lightbox.row][lightbox.col]) {
        URL.revokeObjectURL(updated[lightbox.row][lightbox.col]!.previewUrl);
        updated[lightbox.row][lightbox.col] = null;
      }
      return updated;
    });
    setLightbox({ ...lightbox, src: originalLightboxSrc });
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    lbCrop.reset();
    toast.success('Reverted to original');
  };

  // Get the server-saved existing image for the current lightbox cell (update-images mode)
  const getExistingImageSrc = useCallback((): string | null => {
    if (!lightbox || mode !== 'update-images') return null;
    const card = getExistingCardAt(lightbox.row, lightbox.col);
    if (!card) return null;
    const path = lightbox.side === 'front' ? card.imagePath : card.backImagePath;
    return path ? `${API_BASE}${path}` : null;
  }, [lightbox, mode, existingCards, layout, pageNumber]);

  // Check if current lightbox cell has a new image (cropped or extracted) different from existing
  const hasNewImage = useCallback((): boolean => {
    if (!lightbox) return false;
    const cropped = lightbox.side === 'front' ? croppedImages[lightbox.row]?.[lightbox.col] : croppedBackImages[lightbox.row]?.[lightbox.col];
    if (cropped) return true;
    const extracted = extractedImages[lightbox.row]?.[lightbox.col];
    const extractedPath = lightbox.side === 'front' ? extracted?.front : extracted?.back;
    return !!extractedPath;
  }, [lightbox, croppedImages, croppedBackImages, extractedImages]);

  // Discard the new image for this cell, keeping the existing one
  const handleKeepOriginal = () => {
    if (!lightbox) return;
    // Clear cropped image
    const setter = lightbox.side === 'front' ? setCroppedImages : setCroppedBackImages;
    setter(prev => {
      const updated = prev.map(r => [...r]);
      if (updated[lightbox.row][lightbox.col]) {
        URL.revokeObjectURL(updated[lightbox.row][lightbox.col]!.previewUrl);
        updated[lightbox.row][lightbox.col] = null;
      }
      return updated;
    });
    // Clear extracted image for this cell/side
    setExtractedImages(prev => {
      const updated = prev.map(r => [...r]);
      const existing = updated[lightbox.row]?.[lightbox.col];
      if (existing) {
        if (lightbox.side === 'front') {
          updated[lightbox.row][lightbox.col] = existing.back ? { back: existing.back } : null;
        } else {
          updated[lightbox.row][lightbox.col] = existing.front ? { front: existing.front } : null;
        }
      }
      return updated;
    });
    // Switch lightbox to show the existing image
    const existingSrc = getExistingImageSrc();
    if (existingSrc) {
      setLightbox({ ...lightbox, src: existingSrc });
      setOriginalLightboxSrc(existingSrc);
    } else {
      closeLightbox();
    }
    setShowOriginalInLightbox(false);
    toast.success('Keeping original image');
  };

  // Initialize crop canvas when entering crop mode
  useEffect(() => {
    if (!lightboxCropMode || !lightbox) return;
    lbCrop.initCanvas(lightbox.src);
  }, [lightboxCropMode, lightbox, lbCrop.initCanvas]);

  const applyLightboxRotation = (angle?: number) => {
    const deg = angle ?? lightboxRotation;
    if (!lightbox || deg === 0) return;

    const loadAndRotate = (img: HTMLImageElement) => {
      const rad = (deg * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const newW = Math.round(img.naturalWidth * absCos + img.naturalHeight * absSin);
      const newH = Math.round(img.naturalWidth * absSin + img.naturalHeight * absCos);

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, newW, newH);
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
        newImg.onload = () => { lbCrop.imgRef.current = newImg; };
        newImg.src = previewUrl;
        setLightbox({ ...lightbox, src: previewUrl });
        setLightboxRotation(0);
        setRotationDegrees(0);
        toast.success(`Rotation applied (${deg}°)`);
      }, 'image/jpeg', 0.95);
    };

    // Always load from the current lightbox.src to avoid stale imgRef
    // (imgRef may still point to a previously edited image)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      lbCrop.imgRef.current = img;
      loadAndRotate(img);
    };
    img.src = lightbox.src;
  };
  rotateApplyRef.current = () => applyLightboxRotation();

  const handleLightboxCropConfirm = () => {
    if (!lbCrop.cropRect || !lightbox) return;
    const img = lbCrop.imgRef.current;
    if (!img || !img.complete) {
      toast.error('Image not loaded yet');
      return;
    }
    const s = lbCrop.scaleRef.current;
    const x = Math.min(lbCrop.cropRect.startX, lbCrop.cropRect.endX) / s;
    const y = Math.min(lbCrop.cropRect.startY, lbCrop.cropRect.endY) / s;
    const w = Math.abs(lbCrop.cropRect.endX - lbCrop.cropRect.startX) / s;
    const h = Math.abs(lbCrop.cropRect.endY - lbCrop.cropRect.startY) / s;

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
        newImg.onload = () => { lbCrop.imgRef.current = newImg; };
        newImg.src = previewUrl;
        setLightbox({ ...lightbox, src: previewUrl });
        setLightboxCropMode(false);
        lbCrop.reset();
        toast.success('Image cropped');
      }, 'image/jpeg', 0.95);
    } catch {
      toast.error('Crop failed — try using the Crop button on the cell instead');
    }
  };
  cropConfirmRef.current = handleLightboxCropConfirm;

  const [autoCropping, setAutoCropping] = useState(false);
  const handleAutoCrop = async () => {
    if (!lightbox) return;
    setAutoCropping(true);
    try {
      const resp = await fetch(lightbox.src);
      const srcBlob = await resp.blob();
      const srcFile = new File([srcBlob], 'crop.jpg', { type: srcBlob.type || 'image/jpeg' });
      const croppedBlob = await pageApi.autoCrop(srcFile);
      const previewUrl = URL.createObjectURL(croppedBlob);
      const file = new File([croppedBlob], `autocrop_${Date.now()}.jpg`, { type: 'image/jpeg' });

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
      newImg.onload = () => { lbCrop.imgRef.current = newImg; };
      newImg.src = previewUrl;
      setLightbox({ ...lightbox, src: previewUrl });
      setLightboxCropMode(false);
      lbCrop.reset();
      toast.success('Auto crop applied');
    } catch {
      toast.error('Auto crop failed');
    } finally {
      setAutoCropping(false);
    }
  };

  const [autoRotating, setAutoRotating] = useState(false);
  const handleAutoRotate = async () => {
    if (!lightbox) return;
    setAutoRotating(true);
    try {
      const resp = await fetch(lightbox.src);
      const srcBlob = await resp.blob();
      const srcFile = new File([srcBlob], 'rotate.jpg', { type: srcBlob.type || 'image/jpeg' });
      const rotatedBlob = await pageApi.autoRotate(srcFile);
      const previewUrl = URL.createObjectURL(rotatedBlob);
      const file = new File([rotatedBlob], `autorotate_${Date.now()}.jpg`, { type: 'image/jpeg' });

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
      newImg.onload = () => { lbCrop.imgRef.current = newImg; };
      newImg.src = previewUrl;
      setLightbox({ ...lightbox, src: previewUrl });
      toast.success('Auto rotate applied');
    } catch {
      toast.error('Auto rotate failed');
    } finally {
      setAutoRotating(false);
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
    // Clear manual crops so re-extracted images are visible
    setCroppedImages(Array.from({ length: 3 }, () => Array.from({ length: numCols }, () => null)));
    setCroppedBackImages(Array.from({ length: 3 }, () => Array.from({ length: numCols }, () => null)));
    try {
      const frontExtracts = await pageApi.extractCards(pageImage, layout, binderNumber, pageNumber, 'front', extractionParams);
      let backExtracts: ExtractedCardImage[] = [];
      if (backImage) {
        backExtracts = await pageApi.extractCards(backImage, layout, binderNumber, pageNumber, 'back', extractionParams);
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

  // Auto-extract card images when front or back page image changes
  useEffect(() => {
    if (!pageImage) return;
    const extract = async () => {
      setExtracting(true);
      try {
        const frontExtracts = await pageApi.extractCards(pageImage, layout, binderNumber, pageNumber, 'front', extractionParams);
        let backExtracts: ExtractedCardImage[] = [];
        if (backImage) {
          backExtracts = await pageApi.extractCards(backImage, layout, binderNumber, pageNumber, 'back', extractionParams);
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
          const colsPerPage = 3;
          for (const ext of backExtracts) {
            const ri = ext.row - 1;
            const physicalCol = ext.column - 1;
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
    extract();
  }, [pageImage, backImage]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleUpdateImages = async () => {
    if (existingCards.length === 0) {
      toast.error('No existing cards found on this page');
      return;
    }

    const hasAnyImage = croppedImages.some(row => row.some(c => c !== null))
      || croppedBackImages.some(row => row.some(c => c !== null))
      || extractedImages.some(row => row.some(c => c !== null));
    if (!hasAnyImage) {
      toast.error('Upload a page photo first to extract images');
      return;
    }

    setSaving(true);
    let updatedCount = 0;
    try {
      // Upload page source image
      if (pageImage) {
        await pageApi.uploadPageImage(binderNumber, pageNumber, pageImage);
        if (layout === '6x3') {
          await pageApi.uploadPageImage(binderNumber, pageNumber + 1, pageImage);
        }
      }

      // Upload manually cropped images
      const fullyAssignedIds = new Set<number>();
      for (let ri = 0; ri < 3; ri++) {
        for (let ci = 0; ci < numCols; ci++) {
          const card = getExistingCardAt(ri, ci);
          if (!card) continue;
          const cropped = croppedImages[ri]?.[ci];
          const croppedBack = croppedBackImages[ri]?.[ci];
          if (cropped) {
            try {
              await cardApi.uploadImage(card.id, cropped.file);
              updatedCount++;
            } catch { /* continue */ }
          }
          if (croppedBack) {
            try {
              await cardApi.uploadBackImage(card.id, croppedBack.file);
              if (!cropped) updatedCount++;
            } catch { /* continue */ }
          }
          if (cropped && croppedBack) fullyAssignedIds.add(card.id);
        }
      }

      // Assign auto-extracted images for cards not fully manually cropped
      const assignments: CardImageAssignment[] = [];
      for (let ri = 0; ri < 3; ri++) {
        for (let ci = 0; ci < numCols; ci++) {
          const card = getExistingCardAt(ri, ci);
          if (!card || fullyAssignedIds.has(card.id)) continue;
          const extracted = extractedImages[ri]?.[ci];
          const hasCropFront = !!croppedImages[ri]?.[ci];
          const hasCropBack = !!croppedBackImages[ri]?.[ci];
          const frontPath = !hasCropFront && extracted?.front ? extracted.front : undefined;
          const backPath = !hasCropBack && extracted?.back ? extracted.back : undefined;
          if (frontPath || backPath) {
            assignments.push({ cardId: card.id, frontImagePath: frontPath, backImagePath: backPath });
            updatedCount++;
          }
        }
      }

      if (assignments.length > 0) {
        await pageApi.assignExtractedImages(assignments);
      }

      toast.success(`Images updated for ${updatedCount} card${updatedCount !== 1 ? 's' : ''}`);
      navigate(`/binders/${binderNumber}?page=${pageNumber}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update images';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page bulk-entry-page">
      <div className="bulk-mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === 'new' ? 'active' : ''}`}
          onClick={() => setMode('new')}
        >
          <Upload size={16} />
          New Cards
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'update-images' ? 'active' : ''}`}
          onClick={() => setMode('update-images')}
        >
          <ImagePlus size={16} />
          Update Images
        </button>
      </div>

      <h1 className="page-title">{mode === 'update-images' ? 'Update Page Images' : 'Bulk Entry'}</h1>
      <p className="page-subtitle">
        {mode === 'update-images'
          ? `Upload new front and/or back photos for existing cards on binder ${binderNumber}, page ${pageNumber}${layout === '6x3' ? ` & ${pageNumber + 1}` : ''}.`
          : layout === '6x3'
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

          {mode === 'new' && (
            <>
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
            </>
          )}
          {mode === 'update-images' && (
            <div className="update-images-status">
              {loadingExisting ? (
                <span className="loading-hint"><RefreshCw size={14} className="spin" /> Loading existing cards...</span>
              ) : existingCards.length > 0 ? (
                <span className="existing-count">{existingCards.length} card{existingCards.length !== 1 ? 's' : ''} found on this page</span>
              ) : (
                <span className="no-cards-hint">No existing cards on this page — use New Cards mode instead</span>
              )}
            </div>
          )}
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
              onClick={e => { (e.target as HTMLInputElement).value = ''; }}
              className="image-input"
            />
          </div>
          {pageImage && mode === 'new' && (
            <>
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
              onClick={e => { (e.target as HTMLInputElement).value = ''; }}
              className="image-input"
            />
          </div>
        </div>
      </div>

      {/* Extraction Settings */}
      {pageImage && (
        <div className="extraction-settings-section">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setShowExtractionSettings(!showExtractionSettings)}
          >
            {showExtractionSettings ? '▾ Hide' : '▸ Show'} Extraction Settings
          </button>
          {showExtractionSettings && (
            <div className="extraction-settings-grid">
              <div className="extraction-setting">
                <label>Canny Low <span className="hint">({extractionParams.cannyLow})</span></label>
                <input type="range" min={5} max={150} step={5} value={extractionParams.cannyLow}
                  onChange={e => updateExtractionParam('cannyLow', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Canny High <span className="hint">({extractionParams.cannyHigh})</span></label>
                <input type="range" min={30} max={300} step={5} value={extractionParams.cannyHigh}
                  onChange={e => updateExtractionParam('cannyHigh', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Blur Size <span className="hint">({extractionParams.blurSize})</span></label>
                <input type="range" min={1} max={15} step={2} value={extractionParams.blurSize}
                  onChange={e => updateExtractionParam('blurSize', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Morph Iterations <span className="hint">({extractionParams.morphIterations})</span></label>
                <input type="range" min={1} max={5} step={1} value={extractionParams.morphIterations}
                  onChange={e => updateExtractionParam('morphIterations', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Contour Padding <span className="hint">({(extractionParams.contourPadding * 100).toFixed(0)}%)</span></label>
                <input type="range" min={0} max={0.1} step={0.005} value={extractionParams.contourPadding}
                  onChange={e => updateExtractionParam('contourPadding', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Fallback Margin <span className="hint">({(extractionParams.fallbackMargin * 100).toFixed(0)}%)</span></label>
                <input type="range" min={0} max={0.15} step={0.005} value={extractionParams.fallbackMargin}
                  onChange={e => updateExtractionParam('fallbackMargin', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Min Card Area <span className="hint">({(extractionParams.minCardAreaRatio * 100).toFixed(0)}%)</span></label>
                <input type="range" min={0.1} max={0.5} step={0.05} value={extractionParams.minCardAreaRatio}
                  onChange={e => updateExtractionParam('minCardAreaRatio', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Min Aspect Ratio <span className="hint">({extractionParams.minAspectRatio.toFixed(2)})</span></label>
                <input type="range" min={0.2} max={0.8} step={0.05} value={extractionParams.minAspectRatio}
                  onChange={e => updateExtractionParam('minAspectRatio', Number(e.target.value))} />
              </div>
              <div className="extraction-setting">
                <label>Max Aspect Ratio <span className="hint">({extractionParams.maxAspectRatio.toFixed(2)})</span></label>
                <input type="range" min={0.7} max={1.0} step={0.05} value={extractionParams.maxAspectRatio}
                  onChange={e => updateExtractionParam('maxAspectRatio', Number(e.target.value))} />
              </div>
              <div className="extraction-setting extraction-preset-actions">
                <select
                  value={selectedPresetName}
                  onChange={e => loadPreset(e.target.value)}
                  className="preset-select"
                >
                  <option value="">— Presets —</option>
                  {extractionPresets.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm btn-secondary" onClick={savePreset} title="Save current settings as preset">
                  Save
                </button>
                {selectedPresetName && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={deletePreset} title="Delete selected preset">
                    Delete
                  </button>
                )}
              </div>
              <div className="extraction-setting extraction-setting-actions">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => {
                  setExtractionParams(DEFAULT_EXTRACTION_PARAMS);
                  setSelectedPresetName('');
                }}>
                  Reset Defaults
                </button>
                <button type="button" className="btn btn-sm btn-primary" onClick={extractCardImages} disabled={extracting}>
                  {extracting ? 'Re-extracting...' : 'Re-extract with Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Composite mosaic of all current images */}
      {(extractedImages.some(row => row.some(c => c !== null)) || (mode === 'update-images' && existingCards.some(c => c.imagePath || c.backImagePath))) && (
        <div className="mosaic-section">
          <div className="mosaic-header">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowMosaic(!showMosaic)}
            >
              <Eye size={16} /> {showMosaic ? 'Hide' : 'Show'} Images Overview
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
              {cells.flatMap((row, ri) =>
                row.map((_, ci) => {
                  const cropped = mosaicSide === 'front' ? croppedImages[ri]?.[ci] : croppedBackImages[ri]?.[ci];
                  const extracted = extractedImages[ri]?.[ci];
                  const extractedPath = mosaicSide === 'front' ? extracted?.front : extracted?.back;
                  const existingCard = mode === 'update-images' ? getExistingCardAt(ri, ci) : undefined;
                  const existingPath = mosaicSide === 'front' ? existingCard?.imagePath : existingCard?.backImagePath;
                  const src = cropped
                    ? cropped.previewUrl
                    : extractedPath ? `${API_BASE}${extractedPath}`
                    : existingPath ? `${API_BASE}${existingPath}` : null;
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
              <div key={ci} className={`bulk-cell ${layout === '6x3' && ci === 3 ? 'bulk-cell-divider' : ''}${mode === 'update-images' ? ' bulk-cell-update' : ''}`}>
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
                  const existingCard = mode === 'update-images' ? getExistingCardAt(ri, ci) : undefined;
                  const frontSrc = hasCropFront
                    ? croppedImages[ri][ci]!.previewUrl
                    : extracted?.front ? `${API_BASE}${extracted.front}` : null;
                  const backSrc = hasCropBack
                    ? croppedBackImages[ri][ci]!.previewUrl
                    : extracted?.back ? `${API_BASE}${extracted.back}` : null;
                  // In update-images mode, show existing card images as fallback
                  const displayFrontSrc = frontSrc || (existingCard?.imagePath ? `${API_BASE}${existingCard.imagePath}` : null);
                  const displayBackSrc = backSrc || (existingCard?.backImagePath ? `${API_BASE}${existingCard.backImagePath}` : null);
                  const showFront = mode === 'update-images' ? displayFrontSrc : frontSrc;
                  const showBack = mode === 'update-images' ? displayBackSrc : backSrc;
                  if (!showFront && !showBack) return null;
                  return (
                    <div className="bulk-cell-crop-preview">
                      {showFront && <img src={showFront} alt="Front" onClick={() => openLightbox(showFront, ri, ci, 'front')}
                        className={frontSrc ? 'has-new-image' : ''} />}
                      {showBack && <img src={showBack} alt="Back" onClick={() => openLightbox(showBack, ri, ci, 'back')}
                        className={backSrc ? 'has-new-image' : ''} />}
                    </div>
                  );
                })()}
                {mode === 'update-images' ? (
                  <div className="bulk-cell-existing">
                    {(() => {
                      const existingCard = getExistingCardAt(ri, ci);
                      if (!existingCard) return <span className="empty-slot">Empty slot</span>;
                      return (
                        <>
                          <span className="existing-player">{existingCard.playerName}</span>
                          <span className="existing-detail">{existingCard.year} {existingCard.setName}{existingCard.cardNumber ? ` #${existingCard.cardNumber}` : ''}</span>
                          {existingCard.team && <span className="existing-detail">{existingCard.team}</span>}
                        </>
                      );
                    })()}
                  </div>
                ) : (
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
                )}
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
        {mode === 'update-images' ? (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleUpdateImages}
            disabled={saving || existingCards.length === 0}
          >
            <ImagePlus size={18} />
            {saving ? 'Updating...' : 'Update Images'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save All Cards'}
          </button>
        )}
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
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => navigateLightbox(-1)}
                  disabled={lightboxCropMode || lightboxRotation !== 0}
                  title="Previous image (← arrow key)"
                >
                  <ChevronLeft size={18} />
                </button>
                R{lightbox.row + 1}C{lightbox.col + 1} {lightbox.side === 'front' ? 'F' : 'B'}
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => navigateLightbox(1)}
                  disabled={lightboxCropMode || lightboxRotation !== 0}
                  title="Next image (→ arrow key)"
                >
                  <ChevronRight size={18} />
                </button>
              </span>
              <div className="lightbox-rotate-controls">
                <div className="rotate-dropdown">
                  <button className="btn btn-sm btn-secondary" disabled={lightboxCropMode || lightboxRotation !== 0}>
                    90° ▾
                  </button>
                  <div className="rotate-dropdown-menu">
                    <button onClick={() => applyLightboxRotation(-90)} disabled={lightboxCropMode || lightboxRotation !== 0}>
                      ↺ 90° left
                    </button>
                    <button onClick={() => applyLightboxRotation(90)} disabled={lightboxCropMode || lightboxRotation !== 0}>
                      ↻ 90° right
                    </button>
                  </div>
                </div>
                <div className="rotate-dropdown">
                  <button className="btn btn-sm btn-secondary" disabled={lightboxCropMode || lightboxRotation !== 0}>
                    Custom ▾
                  </button>
                  <div className="rotate-dropdown-menu rotate-custom-menu">
                    <div className="rotate-custom-row" onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        className="rotate-degrees-input"
                        value={rotationDegrees}
                        onChange={e => setRotationDegrees(Number(e.target.value))}
                        onKeyDown={e => {
                          if (e.key === '-') {
                            e.preventDefault();
                            setRotationDegrees(prev => -prev);
                          }
                        }}
                        min={-360}
                        max={360}
                        step={1}
                        title="Custom rotation degrees (press - to toggle sign)"
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
                  </div>
                </div>
                <div className="rotate-btn-group">
                  <button className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev - 0.5)} title="Rotate 0.5° left" disabled={lightboxCropMode}>
                    -.5
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev - 0.2)} title="Rotate 0.2° left" disabled={lightboxCropMode}>
                    -.2
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev + 0.2)} title="Rotate 0.2° right" disabled={lightboxCropMode}>
                    +.2
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev + 0.5)} title="Rotate 0.5° right" disabled={lightboxCropMode}>
                    +.5
                  </button>
                </div>
                {lightboxRotation !== 0 && (
                  <button className="btn btn-sm btn-primary btn-icon-only" onClick={() => applyLightboxRotation()} title="Apply rotation">
                    <Check size={16} />
                  </button>
                )}
                {lightboxRotation !== 0 && (
                  <button className="btn btn-sm btn-ghost" onClick={() => { setLightboxRotation(0); setRotationDegrees(0); }} title="Cancel rotation (Esc)">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                className={`btn btn-sm ${lightboxCropMode ? 'btn-accent' : 'btn-secondary'}`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (lightboxCropMode) { setLightboxCropMode(false); lbCrop.reset(); return; }
                  setLightboxCropMode(true);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                title={lightboxRotation !== 0 ? 'Apply rotation first' : 'Crop'}
                disabled={lightboxRotation !== 0}
              >
                <Crop size={16} /> Crop
              </button>
              {lightboxCropMode && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setLightboxCropMode(false); lbCrop.reset(); }} title="Cancel crop">
                  <X size={14} />
                </button>
              )}
              {lightboxCropMode && lbCrop.hasSelection && (
                <button className="btn btn-sm btn-primary btn-icon-only" onClick={handleLightboxCropConfirm} title="Apply crop">
                  <Check size={16} />
                </button>
              )}
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleAutoCrop}
                disabled={autoCropping || lightboxCropMode || lightboxRotation !== 0}
                title="Auto-detect card edges and crop"
              >
                <Wand2 size={16} /> {autoCropping ? 'Cropping...' : 'Auto Crop'}
              </button>
              {/* Auto Rotate hidden — detection needs improvement
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleAutoRotate}
                disabled={autoRotating || lightboxCropMode || lightboxRotation !== 0}
                title="Auto-detect skew and straighten"
              >
                <AlignVerticalSpaceAround size={16} /> {autoRotating ? 'Rotating...' : 'Auto Rotate'}
              </button>
              */}
              {lightbox && originalLightboxSrc && lightbox.src !== originalLightboxSrc && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleRevertLightbox}
                  disabled={lightboxCropMode}
                  title="Revert to original image"
                >
                  <Undo2 size={16} /> Revert
                </button>
              )}
              {mode === 'update-images' && getExistingImageSrc() && hasNewImage() && (
                <>
                  <button
                    className={`btn btn-sm ${showOriginalInLightbox ? 'btn-accent' : 'btn-secondary'}`}
                    onClick={() => setShowOriginalInLightbox(prev => !prev)}
                    disabled={lightboxCropMode || lightboxRotation !== 0}
                    title={showOriginalInLightbox ? 'View new image' : 'View existing image'}
                  >
                    <Eye size={16} /> {showOriginalInLightbox ? 'View New' : 'View Original'}
                  </button>
                  {showOriginalInLightbox && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={handleKeepOriginal}
                      title="Discard new image and keep the existing one"
                    >
                      <ImageOff size={16} /> Keep Original
                    </button>
                  )}
                </>
              )}
              <button className="btn btn-sm btn-ghost" onClick={closeLightbox} style={{ marginLeft: 'auto' }}>✕</button>
            </div>
            {lightboxCropMode ? (
              <div className="lightbox-canvas-wrap">
                <canvas
                  ref={lbCrop.canvasRef}
                  onMouseDown={lbCrop.handleMouseDown}
                  onMouseMove={lbCrop.handleCanvasHover}
                  className="crop-canvas"
                />
              </div>
            ) : (
              <>
                <div className="lightbox-image-container">
                  <img
                    src={showOriginalInLightbox && getExistingImageSrc() ? getExistingImageSrc()! : lightbox.src}
                    alt="Full size preview"
                    className="lightbox-image"
                    style={lightboxRotation !== 0 && !showOriginalInLightbox ? { transform: `rotate(${lightboxRotation}deg)` } : undefined}
                  />
                  {lightboxRotation !== 0 && !showOriginalInLightbox && <div className="rotation-grid-overlay" />}
                </div>
                {showOriginalInLightbox && (
                  <div style={{ textAlign: 'center', padding: '4px 0', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 500 }}>
                    Viewing existing image
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
