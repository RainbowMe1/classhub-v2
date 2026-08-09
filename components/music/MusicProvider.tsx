'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Play, Pause, SkipBack, SkipForward, Music as MusicIcon } from 'lucide-react';

type Track = { id: string; title: string; artist: string | null; url: string };

const MusicCtx = createContext<{
  current: Track | null;
  playing: boolean;
  playTrack: (t: Track, list: Track[]) => void;
  toggle: () => void;
  step: (d: number) => void;
}>({ current: null, playing: false, playTrack: function () {}, toggle: function () {}, step: function () {} });

export function useMusic() {
  return useContext(MusicCtx);
}

export default function MusicProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/') {
      const a = audioRef.current;
      if (a) a.pause();
      setCurrent(null);
      setPlaying(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (current && audioRef.current) {
      audioRef.current.src = current.url;
      audioRef.current.play().catch(function () {});
    }
  }, [current ? current.id : '']);

  function playTrack(t: Track, list: Track[]) {
    setQueue(list);
    setCurrent(t);
  }

  function toggle() {
    const a = audioRef.current;
    if (!a || !current) return;
    if (playing) a.pause();
    else a.play().catch(function () {});
  }

  function step(dir: number) {
    if (!current || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === current.id);
    setCurrent(queue[(idx + dir + queue.length) % queue.length]);
  }

  return (
    <MusicCtx.Provider value={{ current, playing, playTrack, toggle, step }}>
      {children}
      <audio ref={audioRef} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => step(1)} />
      {current && (
        <div className="fixed bottom-20 left-3 right-3 md:bottom-4 md:left-auto md:right-4 md:w-96 z-40 bg-card border border-line rounded-2xl p-3 shadow-xl">
          <div className="flex items-center gap-3">
            <MusicIcon className="h-4 w-4 text-acc shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{current.title}</div>
              <div className="text-xs text-mut truncate">{current.artist || 'Musik Kelas'}</div>
            </div>
            <button onClick={() => step(-1)} className="p-2 text-mut hover:text-ink" aria-label="Sebelumnya">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={toggle} className="p-2.5 rounded-full bg-acc text-acc-ink" aria-label="Putar atau jeda">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={() => step(1)} className="p-2 text-mut hover:text-ink" aria-label="Berikutnya">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </MusicCtx.Provider>
  );
}
