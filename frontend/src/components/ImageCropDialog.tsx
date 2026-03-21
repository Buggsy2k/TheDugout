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

type DragHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move' | null;

export default function ImageCropDialog({ imageUrl, cellLabel, onCrop, onCancel }: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [scale, setScale] = useState(1);
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const dragOrigin = useRef<{ x: number; y: number; rect: CropRect } | null>(null);

  const clamp = useCallback((val: number, min: number, max: number) => Math.max(min, Math.min(max, val)), []);

  const getNormRect = useCallback((rect: CropRect) => {
    const x = Math.min(rect.startX, rect.endX);
    const y = Math.min(rect.startY, rect.endY);
    return { x, y, w: Math.abs(rect.endX - rect.startX), h: Math.abs(rect.endY - rect.startY) };
  }, []);

  const drawCanvas = useCallback((rect: CropRect | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect) {
      const { x, y, w, h } = {
        x: Math.min(rect.startX, rect.endX),
        y: Math.min(rect.startY, rect.endY),
        w: Math.abs(rect.endX - rect.startX),
        h: Math.abs(rect.endY - rect.startY),
      };

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

      // Draw resize handles
      if (w > 20 && h > 20) {
        const handleSize = 8;
        ctx.fillStyle = '#60a5fa';
        const handles = [
          [x, y], [x + w, y], [x, y + h], [x + w, y + h], // corners
          [x + w / 2, y], [x + w / 2, y + h], // top/bottom centers
          [x, y + h / 2], [x + w, y + h / 2], // left/right centers
        ];
        for (const [hx, hy] of handles) {
          ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        }
      }
    }
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

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

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(clientX - rect.left, 0, canvas.width),
      y: clamp(clientY - rect.top, 0, canvas.height),
    };
  }, [clamp]);

  const hitTestHandle = useCallback((x: number, y: number, rect: CropRect): DragHandle => {
    const { x: rx, y: ry, w, h } = {
      x: Math.min(rect.startX, rect.endX),
      y: Math.min(rect.startY, rect.endY),
      w: Math.abs(rect.endX - rect.startX),
      h: Math.abs(rect.endY - rect.startY),
    };
    const t = 10; // hit tolerance
    const nearLeft = Math.abs(x - rx) < t;
    const nearRight = Math.abs(x - (rx + w)) < t;
    const nearTop = Math.abs(y - ry) < t;
    const nearBottom = Math.abs(y - (ry + h)) < t;
    const midX = Math.abs(x - (rx + w / 2)) < t;
    const midY = Math.abs(y - (ry + h / 2)) < t;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop && midX) return 'n';
    if (nearBottom && midX) return 's';
    if (nearLeft && midY) return 'w';
    if (nearRight && midY) return 'e';
    if (x > rx && x < rx + w && y > ry && y < ry + h) return 'move';
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // Check if clicking on an existing selection handle
    if (cropRect) {
      const handle = hitTestHandle(x, y, cropRect);
      if (handle) {
        setActiveHandle(handle);
        dragOrigin.current = { x, y, rect: { ...cropRect } };
        setDrawing(true);
        e.preventDefault();
        return;
      }
    }

    // Start new selection
    setCropRect({ startX: x, startY: y, endX: x, endY: y });
    setActiveHandle(null);
    setDrawing(true);
    e.preventDefault();
  }, [cropRect, getCanvasCoords, hitTestHandle]);

  // Window-level mousemove/mouseup so dragging works outside the canvas
  useEffect(() => {
    if (!drawing) return;

    const handleMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);

      setCropRect(prev => {
        if (!prev) return prev;

        if (activeHandle && dragOrigin.current) {
          const orig = dragOrigin.current;
          const dx = x - orig.x;
          const dy = y - orig.y;
          const r = orig.rect;
          // Normalize to x/y/w/h
          const nx = Math.min(r.startX, r.endX);
          const ny = Math.min(r.startY, r.endY);
          const nw = Math.abs(r.endX - r.startX);
          const nh = Math.abs(r.endY - r.startY);

          let newX = nx, newY = ny, newW = nw, newH = nh;

          if (activeHandle === 'move') {
            newX = clamp(nx + dx, 0, canvas.width - nw);
            newY = clamp(ny + dy, 0, canvas.height - nh);
          } else {
            if (activeHandle.includes('w')) { newX = clamp(nx + dx, 0, nx + nw - 10); newW = nx + nw - newX; }
            if (activeHandle.includes('e')) { newW = clamp(nw + dx, 10, canvas.width - nx); }
            if (activeHandle.includes('n')) { newY = clamp(ny + dy, 0, ny + nh - 10); newH = ny + nh - newY; }
            if (activeHandle.includes('s')) { newH = clamp(nh + dy, 10, canvas.height - ny); }
          }

          const updated = { startX: newX, startY: newY, endX: newX + newW, endY: newY + newH };
          drawCanvas(updated);
          return updated;
        }

        // Drawing new selection
        const updated = { ...prev, endX: x, endY: y };
        drawCanvas(updated);
        return updated;
      });
    };

    const handleUp = () => {
      setDrawing(false);
      setActiveHandle(null);
      dragOrigin.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [drawing, activeHandle, getCanvasCoords, clamp, drawCanvas]);

  // Update cursor based on hover position
  const handleCanvasHover = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawing) return;
    const canvas = canvasRef.current;
    if (!canvas || !cropRect) { if (canvas) canvas.style.cursor = 'crosshair'; return; }
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const handle = hitTestHandle(x, y, cropRect);
    const cursorMap: Record<string, string> = {
      nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
      n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move',
    };
    canvas.style.cursor = handle ? cursorMap[handle] : 'crosshair';
  }, [drawing, cropRect, getCanvasCoords, hitTestHandle]);

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
        <p className="crop-dialog-hint">Click and drag to select the card area. Drag edges or corners to adjust.</p>
        <div className="crop-canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleCanvasHover}
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
