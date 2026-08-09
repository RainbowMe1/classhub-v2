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
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <button
        className="absolute top-4 right-4 p-2 text-ink/70 hover:text-ink z-10"
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
            className="absolute left-1 md:left-6 p-2 text-ink/70 hover:text-ink disabled:opacity-20 z-10"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setI((p) => Math.min(urls.length - 1, p + 1)); }}
            disabled={i === urls.length - 1}
            className="absolute right-1 md:right-6 p-2 text-ink/70 hover:text-ink disabled:opacity-20 z-10"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {isVideo(urls[i]) ? (
        <video src={urls[i]} controls playsInline className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
      ) : (
        <img
          src={urls[i]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain select-none rounded-lg"
        />
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-4 text-xs text-ink/60">{i + 1} / {urls.length}</div>
      )}
    </div>
  );
}
