'use client';
import { memo, useEffect, useRef, useState } from 'react';
import Lightbox from './Lightbox';
import { thumb } from '@/lib/img';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Play, Pause } from 'lucide-react';

function isVideo(u: string) {
  return u.includes('.mp4') || u.includes('.webm');
}

function SmartImg({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [real, setReal] = useState(false);
  return (
    <div className="w-full min-h-[280px] bg-card-2">
      <img
        src={real ? src : thumb(src, 720)}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => { if (!real) setReal(true); }}
        className={'w-full h-auto transition-opacity duration-300 ' + (loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}

function AutoVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const ob = new IntersectionObserver(
      function (entries) {
        for (const en of entries) {
          if (en.isIntersecting) {
            if (!v.dataset.userpaused) v.play().catch(function () {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: 0.6 }
    );
    ob.observe(v);
    return function () { ob.disconnect(); };
  }, [src]);

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { delete v.dataset.userpaused; v.play().catch(function () {}); }
    else { v.dataset.userpaused = '1'; v.pause(); }
  }
  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }
  function seek(val: number) {
    const v = ref.current;
    if (!v || !dur) return;
    v.currentTime = (val / 100) * dur;
  }

  return (
    <div>
      <div className="relative">
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="none"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration) setProg((v.currentTime / v.duration) * 100);
          }}
          className="w-full h-auto max-h-[75vh] bg-black cursor-pointer"
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-3 rounded-full bg-black/60 text-white">
              <Play className="h-6 w-6" />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-card-2 border-t border-line">
        <button onClick={togglePlay} className="p-1.5 text-ink" aria-label="Putar atau jeda">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={prog}
          onChange={(e) => seek(Number(e.target.value))}
          className="flex-1 accent-acc"
          aria-label="Progres video"
        />
        <button onClick={toggleMute} className="p-1.5 text-ink" aria-label="Suara">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <a href={src} download className="text-xs font-semibold text-acc hover:underline px-1">
          Download
        </a>
      </div>
    </div>
  );
}

function PostMediaInner({ urls }: { urls: string[] }) {
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
            <AutoVideo src={urls[0]} />
          ) : (
            <button onClick={() => setOpen(0)} className="block w-full" aria-label="Lihat detail">
              <SmartImg src={urls[0]} />
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
                <AutoVideo src={url} />
              ) : (
                <button onClick={() => setOpen(i)} className="block w-full" aria-label="Lihat detail">
                  <SmartImg src={url} />
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

export default memo(PostMediaInner);
