import { useRef, useState, useEffect, useCallback } from 'react';
import { Crop, X, Check } from 'lucide-react';

interface ImageCropDialogProps {
  imageUrl: string;
  cellLabel: string;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

interface CropRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function ImageCropDialog({ imageUrl, cellLabel, onCrop, onCancel }: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [scale, setScale] = useState(1);

  const drawCanvas = useCallback((rect: CropRect | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
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

      // Dim area outside selection
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);

      // Selection border
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Fit image in viewport (max 90vw x 75vh)
      const maxW = window.innerWidth * 0.9;
      const maxH = window.innerHeight * 0.75;
      const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setScale(s);

      canvas.width = img.naturalWidth * s;
      canvas.height = img.naturalHeight * s;
      drawCanvas(null);
    };
    img.src = imageUrl;
  }, [imageUrl, drawCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    setCropRect({ startX: x, startY: y, endX: x, endY: y });
    setDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !cropRect) return;
    const { x, y } = getCanvasCoords(e);
    const updated = { ...cropRect, endX: x, endY: y };
    setCropRect(updated);
    drawCanvas(updated);
  };

  const handleMouseUp = () => {
    setDrawing(false);
  };

  const handleConfirm = () => {
    if (!cropRect || !imgRef.current) return;

    // Convert canvas coordinates back to image coordinates
    const x = Math.min(cropRect.startX, cropRect.endX) / scale;
    const y = Math.min(cropRect.startY, cropRect.endY) / scale;
    const w = Math.abs(cropRect.endX - cropRect.startX) / scale;
    const h = Math.abs(cropRect.endY - cropRect.startY) / scale;

    if (w < 10 || h < 10) return;

    // Crop from the original full-res image
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(w);
    cropCanvas.height = Math.round(h);
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      Math.round(x), Math.round(y), Math.round(w), Math.round(h),
      0, 0, cropCanvas.width, cropCanvas.height
    );

    cropCanvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `crop_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCrop(file);
      }
    }, 'image/jpeg', 0.95);
  };

  const hasSelection = cropRect &&
    Math.abs(cropRect.endX - cropRect.startX) > 10 &&
    Math.abs(cropRect.endY - cropRect.startY) > 10;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="crop-dialog" onClick={e => e.stopPropagation()}>
        <div className="crop-dialog-header">
          <Crop size={20} />
          <h2>Crop Card Image — {cellLabel}</h2>
          <button className="btn btn-ghost btn-sm crop-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="crop-dialog-hint">Click and drag to select the card area</p>
        <div className="crop-canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="crop-canvas"
          />
        </div>
        <div className="crop-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            <X size={16} /> Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!hasSelection}
          >
            <Check size={16} /> Use Selection
          </button>
        </div>
      </div>
    </div>
  );
}
