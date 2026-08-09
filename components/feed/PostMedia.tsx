'use client';
import { useEffect, useRef, useState } from 'react';
import Lightbox from './Lightbox';
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

function AutoVideo({ src, onOpen }: { src: string; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const ob = new IntersectionObserver(
      function (entries) {
        for (const en of entries) {
          if (en.isIntersecting) v.play().catch(function () {});
          else v.pause();
        }
      },
      { threshold: 0.6 }
    );
    ob.observe(v);
    return function () { ob.disconnect(); };
  }, [src]);

  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(function () {});
  }

  return (
    <div className="relative">
      <button onClick={onOpen} className="block w-full" aria-label="Lihat detail">
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="none"
          className="w-full h-auto max-h-[75vh] bg-black"
        />
      </button>
      <button
        onClick={toggleMute}
        className="absolute bottom-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
        aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
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
        <div className="mb-3 mx-auto w-full max-w-md rounded-xl overflow-hidden border border-line bg-card-2">
          {isVideo(urls[0]) ? (
            <AutoVideo src={urls[0]} onOpen={() => setOpen(0)} />
          ) : (
            <button onClick={() => setOpen(0)} className="block w-full" aria-label="Lihat detail">
              <img src={urls[0]} alt="" loading="lazy" decoding="async" className="w-full h-auto" />
            </button>
          )}
        </div>
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
            <div key={i} className="snap-center shrink-0 w-full">
              {isVideo(url) ? (
                <AutoVideo src={url} onOpen={() => setOpen(i)} />
              ) : (
                <button onClick={() => setOpen(i)} className="block w-full" aria-label="Lihat detail">
                  <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-auto" />
                </button>
              )}
            </div>
          ))}
        </div>

        {idx > 0 && (
          <button
            onClick={() => go(idx - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {idx < urls.length - 1 && (
          <button
            onClick={() => go(idx + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
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
