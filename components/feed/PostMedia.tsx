'use client';
import { useRef, useState } from 'react';
import Lightbox from './Lightbox';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

export default function PostMedia({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  if (urls.length === 1) {
    return (
      <>
        <button
          onClick={() => setOpen(0)}
          className="mb-3 rounded-xl overflow-hidden border border-line bg-card-2 mx-auto block w-fit max-w-full"
          aria-label="Lihat detail"
        >
          {isVideo(urls[0]) ? (
            <video src={urls[0]} muted preload="metadata" playsInline className="max-h-[520px] w-auto max-w-full" />
          ) : (
            <img src={urls[0]} alt="" loading="lazy" className="max-h-[520px] w-auto max-w-full object-contain" />
          )}
        </button>
        {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="relative mb-3 mx-auto w-full max-w-md">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-xl border border-line bg-card-2 no-scrollbar"
        >
          {urls.map((url, i) => (
            <button
              key={i}
              onClick={() => setOpen(i)}
              className="snap-center shrink-0 w-full"
              aria-label="Lihat detail"
            >
              {isVideo(url) ? (
                <video src={url} muted preload="metadata" playsInline className="w-full h-auto max-h-[520px] object-contain" />
              ) : (
                <img src={url} alt="" loading="lazy" className="w-full h-auto max-h-[520px] object-contain" />
              )}
            </button>
          ))}
        </div>

        {idx > 0 && (
          <button
            onClick={() => go(idx - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-ink hover:bg-black/80"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < urls.length - 1 && (
          <button
            onClick={() => go(idx + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-ink hover:bg-black/80"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-ink text-xs">
          {idx + 1}/{urls.length}
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <div
              key={i}
              className={'h-1.5 rounded-full transition-all ' + (i === idx ? 'w-4 bg-acc' : 'w-1.5 bg-white/40')}
            />
          ))}
        </div>
      </div>

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
