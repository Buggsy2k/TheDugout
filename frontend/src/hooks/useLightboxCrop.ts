import { useRef, useState, useEffect, useCallback } from 'react';

interface CropRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

type DragHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move' | null;

const HANDLE_SIZE = 8;
const HIT_TOLERANCE = 10;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function hitTestHandle(x: number, y: number, rect: CropRect): DragHandle {
  const rx = Math.min(rect.startX, rect.endX);
  const ry = Math.min(rect.startY, rect.endY);
  const w = Math.abs(rect.endX - rect.startX);
  const h = Math.abs(rect.endY - rect.startY);
  const t = HIT_TOLERANCE;
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
}

const cursorMap: Record<string, string> = {
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move',
};

export function useLightboxCrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const dragOrigin = useRef<{ x: number; y: number; rect: CropRect } | null>(null);

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

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Draw resize handles
      if (w > 20 && h > 20) {
        ctx.fillStyle = '#60a5fa';
        const handles = [
          [x, y], [x + w, y], [x, y + h], [x + w, y + h],
          [x + w / 2, y], [x + w / 2, y + h],
          [x, y + h / 2], [x + w, y + h / 2],
        ];
        for (const [hx, hy] of handles) {
          ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }
      }
    }
  }, []);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return {
      x: clamp(clientX - r.left, 0, canvas.width),
      y: clamp(clientY - r.top, 0, canvas.height),
    };
  }, []);

  const initCanvas = useCallback((src: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const maxW = window.innerWidth * 0.85;
      const maxH = window.innerHeight * 0.7;
      const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      scaleRef.current = s;
      canvas.width = img.naturalWidth * s;
      canvas.height = img.naturalHeight * s;
      drawCanvas(null);
    };
    img.src = src;
  }, [drawCanvas]);

  const reset = useCallback(() => {
    setCropRect(null);
    setDrawing(false);
    setActiveHandle(null);
    dragOrigin.current = null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

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

    setCropRect({ startX: x, startY: y, endX: x, endY: y });
    setActiveHandle(null);
    setDrawing(true);
    e.preventDefault();
  }, [cropRect, getCanvasCoords]);

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
  }, [drawing, activeHandle, getCanvasCoords, drawCanvas]);

  const handleCanvasHover = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawing) return;
    const canvas = canvasRef.current;
    if (!canvas || !cropRect) { if (canvas) canvas.style.cursor = 'crosshair'; return; }
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const handle = hitTestHandle(x, y, cropRect);
    canvas.style.cursor = handle ? cursorMap[handle] : 'crosshair';
  }, [drawing, cropRect, getCanvasCoords]);

  const hasSelection = cropRect != null &&
    Math.abs(cropRect.endX - cropRect.startX) > 10 &&
    Math.abs(cropRect.endY - cropRect.startY) > 10;

  return {
    canvasRef,
    imgRef,
    scaleRef,
    cropRect,
    hasSelection,
    initCanvas,
    reset,
    handleMouseDown,
    handleCanvasHover,
  };
}
