'use client';
/* eslint-disable @next/next/no-img-element -- Native image rendering preserves animated GIF album covers. */

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Music as MusicIcon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';

export type MusicTrack = {
  id: string;
  title: string;
  artist: string | null;
  url: string;
  cover_url?: string | null;
  duration_seconds?: number | null;
};

export type RepeatMode = 'off' | 'all' | 'one';

type MusicContextValue = {
  current: MusicTrack | null;
  playing: boolean;
  pos: number;
  dur: number;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playTrack: (track: MusicTrack, list: MusicTrack[]) => void;
  toggle: () => void;
  stop: () => void;
  step: (direction: number) => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  setShuffle: (shuffle: boolean) => void;
  cycleRepeat: () => void;
};

const MusicCtx = createContext<MusicContextValue>({
  current: null,
  playing: false,
  pos: 0,
  dur: 0,
  volume: 0.8,
  shuffle: false,
  repeatMode: 'off',
  playTrack: function () {},
  toggle: function () {},
  stop: function () {},
  step: function () {},
  seek: function () {},
  setVolume: function () {},
  setShuffle: function () {},
  cycleRepeat: function () {},
});

export function useMusic() {
  return useContext(MusicCtx);
}

const GRADS = [
  'from-pink-500 to-rose-700',
  'from-acc to-teal-600',
  'from-blue-500 to-indigo-700',
  'from-orange-500 to-red-700',
  'from-purple-500 to-fuchsia-700',
];

function hashOf(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ':' + String(secs).padStart(2, '0');
}

function CoverArt({ track, className }: { track: MusicTrack; className: string }) {
  return (
    <div className={'flex items-center justify-center overflow-hidden bg-gradient-to-br from-acc/30 via-card-2 to-indigo-500/20 ' + className}>
      {track.cover_url ? (
        <img src={track.cover_url} alt={'Cover ' + track.title} className="h-full w-full object-cover" />
      ) : (
        <MusicIcon className="h-8 w-8 text-white/80" aria-hidden="true" />
      )}
    </div>
  );
}

export default function MusicProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [current, setCurrent] = useState<MusicTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [full, setFull] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  useEffect(() => {
    if (pathname === '/login' || pathname === '/') {
      const timer = window.setTimeout(() => {
        audioRef.current?.pause();
        setCurrent(null);
        setPlaying(false);
        setFull(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [pathname]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!current || !audio) return;
    audio.src = current.url;
    audio.currentTime = 0;
    setPos(0);
    setDur(current.duration_seconds || 0);
    audio.play().catch(() => setPlaying(false));
    setCollapsed(false);
  }, [current]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function playTrack(track: MusicTrack, list: MusicTrack[]) {
    setQueue(list);
    if (current?.id === track.id) {
      toggle();
      return;
    }
    setCurrent(track);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }

  function step(direction: number) {
    if (!current || queue.length === 0) return;
    const index = queue.findIndex((track) => track.id === current.id);
    if (direction > 0 && shuffle && queue.length > 1) {
      const candidates = queue.filter((track) => track.id !== current.id);
      setCurrent(candidates[Math.floor(Math.random() * candidates.length)]);
      return;
    }
    setCurrent(queue[(index + direction + queue.length) % queue.length]);
  }

  function handleEnded() {
    const audio = audioRef.current;
    if (!current || !audio || queue.length === 0) return;
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => setPlaying(false));
      return;
    }
    const index = queue.findIndex((track) => track.id === current.id);
    if (shuffle && queue.length > 1) {
      const candidates = queue.filter((track) => track.id !== current.id);
      setCurrent(candidates[Math.floor(Math.random() * candidates.length)]);
    } else if (index >= 0 && index < queue.length - 1) {
      setCurrent(queue[index + 1]);
    } else if (repeatMode === 'all') {
      setCurrent(queue[0]);
    } else {
      setPlaying(false);
    }
  }

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setCurrent(null);
    setPlaying(false);
    setPos(0);
    setDur(0);
    setFull(false);
  }

  function seek(position: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(position)) return;
    audio.currentTime = position;
    setPos(position);
  }

  function setVolume(value: number) {
    setVolumeState(Math.max(0, Math.min(1, value)));
  }

  function cycleRepeat() {
    setRepeatMode((mode) => mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off');
  }

  const hash = current ? hashOf(current.title) : 0;
  const gradient = GRADS[hash % GRADS.length];

  return (
    <MusicCtx.Provider value={{
      current,
      playing,
      pos,
      dur,
      volume,
      shuffle,
      repeatMode,
      playTrack,
      toggle,
      stop,
      step,
      seek,
      setVolume,
      setShuffle,
      cycleRepeat,
    }}>
      {children}
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={(event) => setPos(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration)) setDur(duration);
        }}
      />

      {current && full && (
        <div className="fixed inset-0 z-[80] flex justify-center overflow-y-auto bg-bg">
          <div className="grid min-h-full w-full max-w-5xl content-center gap-8 px-5 py-5 md:grid-cols-2 md:items-center md:px-10">
            <div className="flex items-center justify-between md:col-span-2">
              <button onClick={() => setFull(false)} className="rounded-full p-2.5 text-mut transition hover:bg-card hover:text-ink" aria-label="Kecilkan player">
                <ChevronDown className="h-6 w-6" aria-hidden="true" />
              </button>
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-mut">ClassHub Music Room</div>
              <button onClick={stop} className="rounded-full p-2.5 text-mut transition hover:bg-red-500/10 hover:text-red-400" aria-label="Hentikan musik">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className={'relative aspect-square w-full overflow-hidden rounded-[2rem] bg-gradient-to-br ' + gradient + ' shadow-2xl shadow-black/25'}>
              {current.cover_url ? (
                <img src={current.cover_url} alt={'Cover ' + current.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><MusicIcon className={'h-24 w-24 text-white/80 ' + (playing ? 'animate-pulse' : '')} aria-hidden="true" /></div>
              )}
            </div>

            <div className="mx-auto w-full max-w-lg">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-acc/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-acc">
                <span className={'h-1.5 w-1.5 rounded-full ' + (playing ? 'animate-pulse bg-acc' : 'bg-mut')} />
                {playing ? 'Sedang diputar' : 'Dijeda'}
              </div>
              <div className="truncate text-2xl font-bold text-ink sm:text-3xl">{current.title}</div>
              <div className="mt-1 truncate text-sm text-mut">{current.artist || 'Musik kelas'}</div>

              <div className="mt-8">
                <input
                  type="range"
                  min={0}
                  max={dur || 0}
                  step={1}
                  value={Math.min(pos, dur || 0)}
                  onChange={(event) => seek(Number(event.target.value))}
                  disabled={!dur}
                  className="h-1.5 w-full accent-acc disabled:opacity-50"
                  aria-label="Progres lagu"
                />
                <div className="mt-1 flex justify-between text-xs tabular-nums text-mut"><span>{formatTime(pos)}</span><span>{formatTime(dur || current.duration_seconds || 0)}</span></div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button onClick={() => setShuffle(!shuffle)} className={'rounded-lg p-2.5 transition hover:bg-card ' + (shuffle ? 'text-acc' : 'text-mut hover:text-ink')} aria-label="Acak lagu" aria-pressed={shuffle}>
                  <Shuffle className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => step(-1)} className="rounded-full p-2.5 text-ink transition hover:bg-card" aria-label="Lagu sebelumnya"><SkipBack className="h-6 w-6" aria-hidden="true" /></button>
                  <button onClick={toggle} className="flex h-14 w-14 items-center justify-center rounded-full bg-acc text-acc-ink shadow-lg transition hover:scale-[1.03] active:scale-95" aria-label={playing ? 'Jeda' : 'Putar'}>
                    {playing ? <Pause className="h-6 w-6 fill-current" aria-hidden="true" /> : <Play className="h-6 w-6 fill-current" aria-hidden="true" />}
                  </button>
                  <button onClick={() => step(1)} className="rounded-full p-2.5 text-ink transition hover:bg-card" aria-label="Lagu berikutnya"><SkipForward className="h-6 w-6" aria-hidden="true" /></button>
                </div>
                <button onClick={cycleRepeat} className={'rounded-lg p-2.5 transition hover:bg-card ' + (repeatMode !== 'off' ? 'text-acc' : 'text-mut hover:text-ink')} aria-label={'Mode ulang: ' + repeatMode} aria-pressed={repeatMode !== 'off'}>
                  {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" aria-hidden="true" /> : <Repeat className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
              <div className="mt-7 flex items-center gap-3">
                <Volume2 className="h-4 w-4 shrink-0 text-mut" aria-hidden="true" />
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-full accent-acc" aria-label="Volume" />
              </div>
            </div>
          </div>
        </div>
      )}

      {current && !collapsed && !full && (
        <div className="fixed bottom-20 left-3 right-3 z-40 rounded-2xl border border-line bg-card/95 p-2 shadow-xl backdrop-blur-md md:bottom-4 md:left-auto md:right-4 md:w-96">
          <div className="flex items-center gap-2">
            <button onClick={() => setFull(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Buka player penuh">
              <CoverArt track={current} className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{current.title}</div>
                <div className="truncate text-xs text-mut">{current.artist || 'Musik kelas'}</div>
              </div>
            </button>
            <button onClick={() => step(-1)} className="rounded-lg p-2 text-mut hover:bg-bg hover:text-ink" aria-label="Lagu sebelumnya"><SkipBack className="h-4 w-4" aria-hidden="true" /></button>
            <button onClick={toggle} className="rounded-full bg-acc p-2 text-acc-ink" aria-label={playing ? 'Jeda' : 'Putar'}>
              {playing ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
            </button>
            <button onClick={() => step(1)} className="rounded-lg p-2 text-mut hover:bg-bg hover:text-ink" aria-label="Lagu berikutnya"><SkipForward className="h-4 w-4" aria-hidden="true" /></button>
            <button onClick={() => setCollapsed(true)} className="rounded-lg p-1.5 text-mut hover:bg-bg hover:text-ink" aria-label="Kecilkan player"><ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="mt-1 flex items-center gap-2 px-1 text-[10px] tabular-nums text-mut">
            <span>{formatTime(pos)}</span>
            <input type="range" min={0} max={dur || 0} step={1} value={Math.min(pos, dur || 0)} onChange={(event) => seek(Number(event.target.value))} disabled={!dur} className="h-1 flex-1 accent-acc" aria-label="Progres lagu" />
            <span>{formatTime(dur || current.duration_seconds || 0)}</span>
          </div>
        </div>
      )}

      {current && collapsed && !full && (
        <button onClick={() => setFull(true)} className="fixed bottom-20 right-3 z-40 overflow-hidden rounded-full bg-acc p-3 text-acc-ink shadow-xl md:bottom-6 md:right-6" aria-label="Buka player">
          {current.cover_url
            ? <img src={current.cover_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            : <MusicIcon className={'h-5 w-5 ' + (playing ? 'animate-pulse' : '')} aria-hidden="true" />}
        </button>
      )}
    </MusicCtx.Provider>
  );
}
