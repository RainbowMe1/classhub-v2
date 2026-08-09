'use client';
import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function Lightbox({ urls, index, onClose }: { urls: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((p) => Math.min(urls.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setI((p) => Math.max(0, p - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length, onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black" onClick={onClose}>
      <button
        className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 text-white/80 hover:text-white"
        aria-label="Tutup"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => Math.max(0, p - 1)); }}
            disabled={i === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 text-white/80 hover:text-white disabled:opacity-20"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => Math.min(urls.length - 1, p + 1)); }}
            disabled={i === urls.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 text-white/80 hover:text-white disabled:opacity-20"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      {isVideo(urls[i]) ? (
        <video
          src={urls[i]}
          controls
          playsInline
          className="absolute inset-0 w-full h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={urls[i]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full h-full object-contain select-none"
        />
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-black/60 text-white/70 text-xs">
          {i + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}
