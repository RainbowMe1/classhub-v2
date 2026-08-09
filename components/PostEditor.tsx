'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function PostEditor({ file, onDone, onClose }: { file: File; onDone: (f: File) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = function () {
      imgRef.current = i;
      draw();
    };
    i.src = url;
    return function () { URL.revokeObjectURL(url); };
  }, [file]);

  function dims(img: HTMLImageElement) {
    const W = 1080;
    const H = Math.min(1620, Math.max(540, Math.round((W * img.height) / img.width)));
    return { W, H };
  }

  function draw() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const { W, H } = dims(img);
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const base = Math.max(W / img.width, H / img.height);
    const scale = base * zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = W / 2 - pos.x * dw;
    const dy = H / 2 - pos.y * dh;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  useEffect(() => {
    draw();
  }, [zoom, pos]);

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
  }
  function move(e: React.PointerEvent) {
    const d = dragRef.current;
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!d || !img || !c) return;
    const base = Math.max(c.width / img.width, c.height / img.height);
    const dw = img.width * base * zoom;
    const dh = img.height * base * zoom;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const fx = dw / rect.width;
    const fy = dh / rect.height;
    setPos({
      x: Math.min(1, Math.max(0, d.px - ((e.clientX - d.sx) * fx) / dw)),
      y: Math.min(1, Math.max(0, d.py - ((e.clientY - d.sy) * fy) / dh)),
    });
  }
  function up() {
    dragRef.current = null;
  }

  function save() {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(function (b) {
      if (b) onDone(new File([b], 'post.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl p-4 space-y-3 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Atur Foto</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Lewati">
            <X className="h-5 w-5" />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          className="w-full h-auto rounded-xl border border-line touch-none cursor-move"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-mut shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-acc"
          />
        </div>
        <p className="text-xs text-mut">Geser buat atur posisi, zoom buat ukuran. Rasio foto tetap asli.</p>
        <button onClick={save} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold">
          Pakai Foto Ini
        </button>
      </div>
    </div>
  );
}
