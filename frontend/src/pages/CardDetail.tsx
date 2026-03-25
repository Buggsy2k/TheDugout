import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Trash2, ArrowLeft, Upload, Sparkles, RotateCw, Camera, Crop, Wand2, Undo2, AlignVerticalSpaceAround, Check, X, Grid3x3 } from 'lucide-react';
import { cardApi, binderApi, aiApi, pageApi, API_BASE } from '../services/api';
import type { Card, CreateCard, UpdateCard, Binder, NextAvailableSuggestion } from '../types';
import { CONDITIONS } from '../types';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConflictOverwriteDialog from '../components/ConflictOverwriteDialog';
import toast from 'react-hot-toast';
import { useLightboxCrop } from '../hooks/useLightboxCrop';

const emptyCard: CreateCard = {
  binderNumber: 1,
  pageNumber: 1,
  row: 1,
  column: 1,
  playerName: '',
  year: new Date().getFullYear(),
  setName: '',
  cardNumber: undefined,
  team: undefined,
  manufacturer: undefined,
  estimatedCondition: 'UNKNOWN',
  conditionNotes: undefined,
  valueRangeLow: undefined,
  valueRangeHigh: undefined,
  notes: undefined,
  tags: undefined,
  isGraded: false,
  gradingService: undefined,
  gradeValue: undefined,
};

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [form, setForm] = useState<CreateCard | UpdateCard>({ ...emptyCard });
  const [existingCard, setExistingCard] = useState<Card | null>(null);
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [showBack, setShowBack] = useState(false);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);

  // Lightbox editor state
  const [lightbox, setLightbox] = useState<{ src: string; side: 'front' | 'back' } | null>(null);
  const [originalLightboxSrc, setOriginalLightboxSrc] = useState<string | null>(null);
  const [originalLightboxFile, setOriginalLightboxFile] = useState<{ file: File | null; preview: string | null } | null>(null);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [gridWhite, setGridWhite] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [lightboxCropMode, setLightboxCropMode] = useState(false);
  const lbCrop = useLightboxCrop();
  const cropConfirmRef = useRef<() => void>(() => {});
  const rotateApplyRef = useRef<() => void>(() => {});

  // Conflict dialog state
  const [conflictCards, setConflictCards] = useState<Card[]>([]);
  const [conflictSuggestion, setConflictSuggestion] = useState<NextAvailableSuggestion | undefined>();
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  useEffect(() => {
    binderApi.getBinders().then(setBinders).catch(console.error);
  }, []);

  useEffect(() => {
    if (isNew) {
      const binder = searchParams.get('binder');
      const page = searchParams.get('page');
      const row = searchParams.get('row');
      const col = searchParams.get('col');
      setForm({
        ...emptyCard,
        binderNumber: binder ? parseInt(binder) : 1,
        pageNumber: page ? parseInt(page) : 1,
        row: row ? parseInt(row) : 1,
        column: col ? parseInt(col) : 1,
      });
      return;
    }

    setLoading(true);
    cardApi.getCard(parseInt(id!))
      .then(card => {
        setExistingCard(card);
        setForm({
          binderNumber: card.binderNumber,
          pageNumber: card.pageNumber,
          row: card.row,
          column: card.column,
          playerName: card.playerName,
          year: card.year,
          setName: card.setName,
          cardNumber: card.cardNumber ?? undefined,
          team: card.team ?? undefined,
          manufacturer: card.manufacturer ?? undefined,
          estimatedCondition: card.estimatedCondition,
          conditionNotes: card.conditionNotes ?? undefined,
          valueRangeLow: card.valueRangeLow ?? undefined,
          valueRangeHigh: card.valueRangeHigh ?? undefined,
          notes: card.notes ?? undefined,
          tags: card.tags ?? undefined,
          isGraded: card.isGraded,
          gradingService: card.gradingService ?? undefined,
          gradeValue: card.gradeValue ?? undefined,
        });
        if (card.imagePath) {
          setImagePreview(`${API_BASE}${card.imagePath}`);
        }
        if (card.backImagePath) {
          setBackImagePreview(`${API_BASE}${card.backImagePath}`);
        }
      })
      .catch(() => toast.error('Card not found'))
      .finally(() => setLoading(false));
  }, [id, isNew, searchParams]);

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isTiff(file)) {
      try {
        const { pngFile, previewUrl } = await convertTiffToPng(file);
        setImageFile(pngFile);
        setImagePreview(previewUrl);
      } catch {
        setImageFile(file);
        setImagePreview(null);
      }
    } else {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isTiff(file)) {
      try {
        const { pngFile, previewUrl } = await convertTiffToPng(file);
        setBackImageFile(pngFile);
        setBackImagePreview(previewUrl);
      } catch {
        setBackImageFile(file);
        setBackImagePreview(null);
      }
    } else {
      setBackImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setBackImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Lightbox editor functions
  const openLightbox = (src: string, side: 'front' | 'back') => {
    setLightbox({ src, side });
    setOriginalLightboxSrc(src);
    setOriginalLightboxFile({
      file: side === 'front' ? imageFile : backImageFile,
      preview: side === 'front' ? imagePreview : backImagePreview,
    });
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    lbCrop.reset();
  };

  const closeLightbox = () => {
    setLightbox(null);
    setOriginalLightboxSrc(null);
    setOriginalLightboxFile(null);
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    lbCrop.reset();
  };

  const handleRevertLightbox = () => {
    if (!lightbox || !originalLightboxSrc || !originalLightboxFile) return;
    if (lightbox.side === 'front') {
      setImageFile(originalLightboxFile.file);
      setImagePreview(originalLightboxFile.preview);
    } else {
      setBackImageFile(originalLightboxFile.file);
      setBackImagePreview(originalLightboxFile.preview);
    }
    setLightbox({ ...lightbox, src: originalLightboxSrc });
    setLightboxRotation(0);
    setRotationDegrees(0);
    setLightboxCropMode(false);
    lbCrop.reset();
    toast.success('Reverted to original');
  };

  useEffect(() => {
    if (!lightboxCropMode || !lightbox) return;
    lbCrop.initCanvas(lightbox.src);
  }, [lightboxCropMode, lightbox, lbCrop.initCanvas]);

  // Escape cancels, Enter applies pending rotation or crop
  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
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
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, lightboxRotation, lightboxCropMode, lbCrop.hasSelection]);

  const applyLightboxRotation = (angle?: number) => {
    const deg = angle ?? lightboxRotation;
    if (!lightbox || deg === 0) return;
    const doRotate = (img: HTMLImageElement) => {
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const byteStr = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const blob = new Blob([ab], { type: 'image/jpeg' });
      const file = new File([blob], `rotated_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      if (lightbox.side === 'front') {
        setImageFile(file);
        setImagePreview(previewUrl);
      } else {
        setBackImageFile(file);
        setBackImagePreview(previewUrl);
      }
      const newImg = new Image();
      newImg.crossOrigin = 'anonymous';
      newImg.onload = () => { lbCrop.imgRef.current = newImg; };
      newImg.src = previewUrl;
      setLightbox({ ...lightbox, src: previewUrl });
      setLightboxRotation(0);
      setRotationDegrees(0);
      toast.success(`Rotation applied (${deg}°)`);
    };
    // Always load from the current lightbox.src to avoid stale imgRef
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { lbCrop.imgRef.current = img; doRotate(img); };
    img.src = lightbox.src;
  };
  rotateApplyRef.current = () => applyLightboxRotation();

  const handleLightboxCropConfirm = () => {
    if (!lbCrop.cropRect || !lightbox) return;
    const img = lbCrop.imgRef.current;
    if (!img || !img.complete) { toast.error('Image not loaded yet'); return; }
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
    ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, cropCanvas.width, cropCanvas.height);
    try {
      const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.95);
      const byteStr = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const blob = new Blob([ab], { type: 'image/jpeg' });
      const file = new File([blob], `crop_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      if (lightbox.side === 'front') {
        setImageFile(file);
        setImagePreview(previewUrl);
      } else {
        setBackImageFile(file);
        setBackImagePreview(previewUrl);
      }
      const newImg = new Image();
      newImg.crossOrigin = 'anonymous';
      newImg.onload = () => { lbCrop.imgRef.current = newImg; };
      newImg.src = previewUrl;
      setLightbox({ ...lightbox, src: previewUrl });
      setLightboxCropMode(false);
      lbCrop.reset();
      toast.success('Image cropped');
    } catch { toast.error('Crop failed'); }
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

      if (lightbox.side === 'front') {
        setImageFile(file);
        setImagePreview(previewUrl);
      } else {
        setBackImageFile(file);
        setBackImagePreview(previewUrl);
      }

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

      if (lightbox.side === 'front') {
        setImageFile(file);
        setImagePreview(previewUrl);
      } else {
        setBackImageFile(file);
        setBackImagePreview(previewUrl);
      }

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

  const handleIdentifyWithAi = async () => {
    if (!imageFile) {
      toast.error('Upload an image first');
      return;
    }
    setIdentifying(true);
    try {
      const response = await aiApi.identifyCard(imageFile, backImageFile || undefined, id ? parseInt(id) : undefined);
      const result = response.result;
      setForm(prev => ({
        ...prev,
        playerName: result.playerName || prev.playerName,
        year: result.year ?? prev.year,
        setName: result.setName || prev.setName,
        cardNumber: result.cardNumber ?? prev.cardNumber,
        team: result.team ?? prev.team,
        manufacturer: result.manufacturer ?? prev.manufacturer,
        estimatedCondition: result.estimatedCondition || prev.estimatedCondition,
        conditionNotes: result.conditionNotes ?? prev.conditionNotes,
        valueRangeLow: result.valueRangeLow ?? prev.valueRangeLow,
        valueRangeHigh: result.valueRangeHigh ?? prev.valueRangeHigh,
        notes: result.notes ?? prev.notes,
        tags: result.tags ?? prev.tags,
      }));
      toast.success(`Card identified! (${Math.round(result.confidence * 100)}% confidence)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI identification failed';
      toast.error(msg);
    } finally {
      setIdentifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.playerName.trim() || !form.setName.trim()) {
      toast.error('Player name and set name are required');
      return;
    }

    // Check for slot conflicts when creating or when position changed
    const positionChanged = !isNew && existingCard && (
      existingCard.binderNumber !== form.binderNumber ||
      existingCard.pageNumber !== form.pageNumber ||
      existingCard.row !== form.row ||
      existingCard.column !== form.column
    );

    if (isNew || positionChanged) {
      try {
        const conflict = await cardApi.checkSlotConflict(
          form.binderNumber, form.pageNumber, form.row, form.column
        );
        if (conflict.hasConflicts) {
          setConflictCards(conflict.conflictingCards);
          setConflictSuggestion(conflict.suggestion);
          setShowConflictDialog(true);
          return;
        }
      } catch {
        // If conflict check fails, proceed anyway
      }
    }

    await executeSave();
  };

  const handleConflictUseSuggestion = (suggestion: NextAvailableSuggestion) => {
    setShowConflictDialog(false);
    setForm(prev => ({
      ...prev,
      binderNumber: suggestion.binderNumber,
      pageNumber: suggestion.pageNumber,
      row: suggestion.row ?? prev.row,
      column: suggestion.column ?? prev.column,
    }));
    toast.success(`Position updated to B${suggestion.binderNumber}/P${suggestion.pageNumber}/R${suggestion.row}-C${suggestion.column}`);
  };

  const handleConflictOverwrite = async () => {
    setShowConflictDialog(false);
    const idsToUnassign = conflictCards.map(c => c.id);
    try {
      await cardApi.unassignCards(idsToUnassign);
      toast.success(`Existing card unassigned`);
    } catch {
      toast.error('Failed to unassign existing card');
      return;
    }
    await executeSave();
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      let savedCard: Card;
      if (isNew) {
        savedCard = await cardApi.createCard(form as CreateCard);
        toast.success('Card created!');
      } else {
        savedCard = await cardApi.updateCard(parseInt(id!), form as UpdateCard);
        toast.success('Card updated!');
      }

      if (imageFile) {
        await cardApi.uploadImage(savedCard.id, imageFile);
      }
      if (backImageFile) {
        await cardApi.uploadBackImage(savedCard.id, backImageFile);
      }

      navigate(`/cards/${savedCard.id}`, { replace: !isNew });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save card';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this card? This cannot be undone.')) return;
    try {
      await cardApi.deleteCard(parseInt(id!));
      toast.success('Card deleted');
      navigate('/collection');
    } catch {
      toast.error('Failed to delete card');
    }
  };

  const updateField = <K extends keyof CreateCard>(field: K, value: CreateCard[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="page">
        <LoadingSkeleton count={1} />
      </div>
    );
  }

  return (
    <div className="page card-detail-page">
      <div className="card-detail-header">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="page-title">{isNew ? 'Add New Card' : `Edit: ${existingCard?.playerName}`}</h1>
      </div>

      <form className="card-form" onSubmit={handleSubmit}>
        <div className="card-form-grid">
          {/* Image section */}
          <div className="card-form-image">
            <div className="image-upload-area">
              {(showBack ? backImagePreview : imagePreview) ? (
                <>
                  <img
                    src={(showBack ? backImagePreview : imagePreview)!}
                    alt={`Card preview${showBack ? ' (back)' : ''}`}
                    className="image-preview"
                    onClick={() => {
                      const src = (showBack ? backImagePreview : imagePreview)!;
                      openLightbox(src, showBack ? 'back' : 'front');
                    }}
                    style={{ cursor: 'pointer' }}
                    title="Click to edit image"
                  />
                  <label className="image-replace-hint" title="Replace image">
                    <Camera size={16} />
                    <span>Replace</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/tiff"
                      onChange={showBack ? handleBackImageChange : handleImageChange}
                      onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              ) : (
                <div className="image-placeholder">
                  <Upload size={32} />
                  <span>{showBack ? 'Upload Back Image' : 'Upload Image'}</span>
                </div>
              )}
              {!(showBack ? backImagePreview : imagePreview) && (
                showBack ? (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/tiff"
                    onChange={handleBackImageChange}
                    onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                    className="image-input"
                  />
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/tiff"
                    onChange={handleImageChange}
                    onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                    className="image-input"
                  />
                )
              )}
            </div>
            {(imagePreview || backImagePreview) && (
              <button
                type="button"
                className={`btn btn-sm btn-secondary card-detail-flip-btn${showBack ? ' flipped' : ''}`}
                onClick={() => setShowBack(prev => !prev)}
              >
                <RotateCw size={14} />
                {showBack ? 'Show Front' : 'Show Back'}
              </button>
            )}
            {imageFile && !showBack && (
              <button
                type="button"
                className="btn btn-accent btn-ai"
                onClick={handleIdentifyWithAi}
                disabled={identifying}
              >
                <Sparkles size={16} />
                {identifying ? 'Identifying...' : 'Identify with AI'}
              </button>
            )}
          </div>

          {/* Card info fields */}
          <div className="card-form-fields">
            <div className="form-row">
              <div className="form-group">
                <label>Player Name *</label>
                <input
                  type="text"
                  value={form.playerName}
                  onChange={e => updateField('playerName', e.target.value)}
                  required
                  placeholder="e.g. Mickey Mantle"
                />
              </div>
              <div className="form-group">
                <label>Year *</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => updateField('year', parseInt(e.target.value) || 0)}
                  required
                  min={1800}
                  max={2100}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Set Name *</label>
                <input
                  type="text"
                  value={form.setName}
                  onChange={e => updateField('setName', e.target.value)}
                  required
                  placeholder="e.g. Topps"
                />
              </div>
              <div className="form-group">
                <label>Card Number</label>
                <input
                  type="text"
                  value={form.cardNumber || ''}
                  onChange={e => updateField('cardNumber', e.target.value || undefined)}
                  placeholder="e.g. 150"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Team</label>
                <input
                  type="text"
                  value={form.team || ''}
                  onChange={e => updateField('team', e.target.value || undefined)}
                  placeholder="e.g. New York Yankees"
                />
              </div>
              <div className="form-group">
                <label>Manufacturer</label>
                <input
                  type="text"
                  value={form.manufacturer || ''}
                  onChange={e => updateField('manufacturer', e.target.value || undefined)}
                  placeholder="e.g. Topps"
                />
              </div>
            </div>

            <h3 className="form-section-title">Location</h3>
            <div className="form-row form-row-4">
              <div className="form-group">
                <label>Binder</label>
                <input
                  type="number"
                  value={form.binderNumber}
                  onChange={e => updateField('binderNumber', parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="form-group">
                <label>Page</label>
                <input
                  type="number"
                  value={form.pageNumber}
                  onChange={e => updateField('pageNumber', parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="form-group">
                <label>Row</label>
                <input
                  type="number"
                  value={form.row}
                  onChange={e => updateField('row', parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="form-group">
                <label>Column</label>
                <input
                  type="number"
                  value={form.column}
                  onChange={e => updateField('column', parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
            </div>

            <h3 className="form-section-title">Condition & Value</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Estimated Condition {!form.isGraded && <span className="hint">(owner's estimate)</span>}</label>
                <select
                  value={form.estimatedCondition}
                  onChange={e => updateField('estimatedCondition', e.target.value)}
                >
                  {CONDITIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Condition Notes</label>
              <input
                type="text"
                value={form.conditionNotes || ''}
                onChange={e => updateField('conditionNotes', e.target.value || undefined)}
                placeholder="e.g. visible crease across center"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Value Range Low ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valueRangeLow ?? ''}
                  onChange={e => updateField('valueRangeLow', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <div className="form-group">
                <label>Value Range High ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valueRangeHigh ?? ''}
                  onChange={e => updateField('valueRangeHigh', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>

            <h3 className="form-section-title">Grading</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.isGraded}
                    onChange={e => updateField('isGraded', e.target.checked)}
                  />
                  <span>Professionally Graded</span>
                </label>
              </div>
            </div>
            {form.isGraded && (
              <div className="form-row">
                <div className="form-group">
                  <label>Grading Service</label>
                  <select
                    value={form.gradingService || ''}
                    onChange={e => updateField('gradingService', e.target.value || undefined)}
                  >
                    <option value="">Select...</option>
                    <option value="PSA">PSA</option>
                    <option value="BGS">BGS (Beckett)</option>
                    <option value="SGC">SGC</option>
                    <option value="CGC">CGC</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Grade</label>
                  <input
                    type="text"
                    value={form.gradeValue || ''}
                    onChange={e => updateField('gradeValue', e.target.value || undefined)}
                    placeholder="e.g. 8"
                  />
                </div>
              </div>
            )}

            <h3 className="form-section-title">Additional Info</h3>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={form.notes || ''}
                onChange={e => updateField('notes', e.target.value || undefined)}
                placeholder="e.g. NL All-Stars subset, double printed"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Tags <span className="hint">(comma-separated)</span></label>
              <input
                type="text"
                value={form.tags || ''}
                onChange={e => updateField('tags', e.target.value || undefined)}
                placeholder="e.g. rookie,hall-of-fame,error"
              />
            </div>
          </div>
        </div>

        <div className="card-form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          {!isNew && (
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : isNew ? 'Create Card' : 'Save Changes'}
          </button>
        </div>

        {!isNew && existingCard && (
          <div className="card-metadata">
            <span>Last AI Audit: {existingCard.lastAuditedAt ? new Date(existingCard.lastAuditedAt).toLocaleString() : 'Never'}</span>
          </div>
        )}
      </form>

      {showConflictDialog && (
        <ConflictOverwriteDialog
          mode="slot"
          conflictingCards={conflictCards}
          suggestion={conflictSuggestion}
          onCancel={() => setShowConflictDialog(false)}
          onUseSuggestion={handleConflictUseSuggestion}
          onOverwrite={handleConflictOverwrite}
        />
      )}

      {lightbox && (
        <div className="dialog-overlay" onClick={closeLightbox}>
          <div className="lightbox-editor" onClick={e => e.stopPropagation()}>
            <div className="lightbox-toolbar">
              <span className="lightbox-label">
                {lightbox.side === 'front' ? 'Front' : 'Back'} Image
              </span>
              <div className="lightbox-rotate-controls">
                <div className="rotate-dropdown">
                  <button type="button" className="btn btn-sm btn-secondary" disabled={lightboxCropMode || lightboxRotation !== 0}>
                    90° ▾
                  </button>
                  <div className="rotate-dropdown-menu">
                    <button type="button" onClick={() => applyLightboxRotation(-90)} disabled={lightboxCropMode || lightboxRotation !== 0}>
                      ↺ 90° left
                    </button>
                    <button type="button" onClick={() => applyLightboxRotation(90)} disabled={lightboxCropMode || lightboxRotation !== 0}>
                      ↻ 90° right
                    </button>
                  </div>
                </div>
                <div className="rotate-dropdown">
                  <button type="button" className="btn btn-sm btn-secondary" disabled={lightboxCropMode || lightboxRotation !== 0}>
                    Custom ▾
                  </button>
                  <div className="rotate-dropdown-menu rotate-custom-menu">
                    <div className="rotate-custom-row" onClick={e => e.stopPropagation()}>
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
                        type="button"
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
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev - 0.5)} title="Rotate 0.5° left" disabled={lightboxCropMode}>
                    -.5
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev - 0.1)} title="Rotate 0.1° left" disabled={lightboxCropMode}>
                    -.1
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev + 0.1)} title="Rotate 0.1° right" disabled={lightboxCropMode}>
                    +.1
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLightboxRotation(prev => prev + 0.5)} title="Rotate 0.5° right" disabled={lightboxCropMode}>
                    +.5
                  </button>
                </div>
              </div>
              {!lightboxCropMode && (
                <div className="lightbox-apply-group">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary btn-icon-only"
                    onClick={() => applyLightboxRotation()}
                    disabled={lightboxRotation === 0}
                    title="Apply rotation"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => { setLightboxRotation(0); setRotationDegrees(0); }}
                    disabled={lightboxRotation === 0}
                    title="Cancel rotation (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <button
                type="button"
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
                <div className="lightbox-apply-group">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary btn-icon-only"
                    onClick={handleLightboxCropConfirm}
                    disabled={!lbCrop.hasSelection}
                    title="Apply crop"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => { setLightboxCropMode(false); lbCrop.reset(); }}
                    title="Cancel crop (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleAutoCrop}
                disabled={autoCropping || lightboxCropMode || lightboxRotation !== 0}
                title="Auto-detect card edges and crop"
              >
                <Wand2 size={16} /> {autoCropping ? 'Cropping...' : 'Auto Crop'}
              </button>
              {/* Auto Rotate hidden — detection needs improvement
              <button
                type="button"
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
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleRevertLightbox}
                  disabled={lightboxCropMode}
                  title="Revert to original image"
                >
                  <Undo2 size={16} /> Revert
                </button>
              )}
              <button type="button" className="btn btn-sm btn-ghost" onClick={closeLightbox} style={{ marginLeft: 'auto' }}>✕</button>
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
              <div className="lightbox-image-container">
                <img
                  src={lightbox.src}
                  alt="Full size preview"
                  className="lightbox-image"
                  style={lightboxRotation !== 0 ? { transform: `rotate(${lightboxRotation}deg)` } : undefined}
                />
                {lightboxRotation !== 0 && (
                  <>
                    <div className={`rotation-grid-overlay${gridWhite ? ' grid-white' : ''}`} />
                    <button
                      className={`grid-toggle-btn${gridWhite ? ' grid-white' : ''}`}
                      onClick={() => setGridWhite(g => !g)}
                      title={gridWhite ? 'Switch grid to black' : 'Switch grid to white'}
                    >
                      <Grid3x3 size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
