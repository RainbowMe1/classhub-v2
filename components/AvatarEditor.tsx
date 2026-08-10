'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function AvatarEditor({ file, onDone, onClose }: { file: File; onDone: (f: File) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const S = 512;

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

  function draw() {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const base = Math.max(S / img.width, S / img.height);
    const scale = base * zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = S / 2 - pos.x * dw;
    const dy = S / 2 - pos.y * dh;
    ctx.clearRect(0, 0, S, S);
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
    if (!d || !img) return;
    const base = Math.max(S / img.width, S / img.height);
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
      if (b) onDone(new File([b], 'avatar.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl p-4 space-y-3 w-full max-w-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Atur Foto Profil</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          className="w-56 h-56 mx-auto block rounded-full border-2 border-line touch-none cursor-move bg-card-2"
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
        <p className="text-xs text-mut">Geser buat atur posisi. Preview bulat = hasil akhir.</p>
        <button onClick={save} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold">
          Simpan Foto
        </button>
      </div>
    </div>
  );
}
