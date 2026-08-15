const fs = require('fs');
const path = require('path');

function wf(p, c) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
  console.log('[OK] ' + p);
}

console.log('=== generate-v2: ClassHub ===');

// === PART SW FIX: HTML SELALU FRESH, CACHE LAMA DIBUANG ===

wf('public/sw.js', `var CACHE = 'classhub-v2';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var accept = e.request.headers.get('accept') || '';
  if (accept.indexOf('text/html') !== -1) return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          c.put(e.request, copy);
        }).catch(function () {});
        return res;
      })
      .catch(function () {
        return caches.match(e.request);
      })
  );
});
`);

console.log('[OK] Part SW Fix done: HTML selalu fresh');

// === PART NOTIF v2: HAPUS SATUAN + HAPUS YANG DIBACA ===

wf('components/notifications/NotificationsClient.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

export default function NotificationsClient({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function markAll() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function remove(id: string) {
    const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
    if (error) setErr('Gagal hapus: ' + error.message);
    else setItems((prev) => prev.filter((n) => n.id !== id));
  }

  async function removeRead() {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId).eq('is_read', true);
    if (error) setErr('Gagal hapus: ' + error.message);
    else setItems((prev) => prev.filter((n) => !n.is_read));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-acc" />
          Notifikasi
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={markAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-acc hover:underline">
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </button>
          <button onClick={removeRead} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:underline">
            <Trash2 className="h-4 w-4" />
            Hapus yang dibaca
          </button>
        </div>
      </div>

      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

      {items.length === 0 ? (
        <div className="bg-card border border-line rounded-2xl p-10 text-center text-mut">Belum ada notifikasi 🎉</div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={'bg-card border border-line rounded-2xl p-4 flex items-start gap-3 ' + (n.is_read ? '' : 'border-l-2 border-l-acc')}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{n.title}</div>
              {n.message && <p className="text-sm text-mut mt-0.5">{n.message}</p>}
              <div className="text-xs text-mut mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
            </div>
            <button
              onClick={() => remove(n.id)}
              className="p-2 text-mut hover:text-red-400 rounded-lg hover:bg-red-500/10 shrink-0"
              aria-label="Hapus notifikasi"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
`);

console.log('[OK] PART NOTIF v2 done: hapus satuan + hapus yang dibaca');

// === PART FULL PLAYER: MINI BAR -> FULL PLAYER ===

wf('components/music/MusicProvider.tsx', `'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Play, Pause, SkipBack, SkipForward, Music as MusicIcon, ChevronDown, X } from 'lucide-react';

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

const GRADS = ['from-pink-500 to-rose-700', 'from-acc to-teal-600', 'from-blue-500 to-indigo-700', 'from-orange-500 to-red-700', 'from-purple-500 to-fuchsia-700'];

function hashOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function fmt(t: number) {
  if (!isFinite(t) || t <= 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

export default function MusicProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [full, setFull] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/') {
      audioRef.current?.pause();
      setCurrent(null);
      setPlaying(false);
      setFull(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (current && audioRef.current) {
      audioRef.current.src = current.url;
      audioRef.current.play().catch(function () {});
      setCollapsed(false);
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

  function step(d: number) {
    if (!current || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === current.id);
    setCurrent(queue[(idx + d + queue.length) % queue.length]);
  }

  function stopAll() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
    }
    setCurrent(null);
    setPlaying(false);
    setFull(false);
  }

  function seek(v: number) {
    const a = audioRef.current;
    if (!a || !dur) return;
    a.currentTime = v;
    setPos(v);
  }

  const hash = current ? hashOf(current.title) : 0;
  const grad = GRADS[hash % GRADS.length];
  const bars: number[] = [];
  for (let i = 0; i < 40; i++) bars.push(25 + ((hash * (i + 7)) % 65));

  return (
    <MusicCtx.Provider value={{ current, playing, playTrack, toggle, step }}>
      {children}
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => step(1)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
      />

      {current && full && (
        <div className="fixed inset-0 z-[80] bg-bg flex justify-center">
          <div className="w-full max-w-md flex flex-col px-6 py-4 h-full overflow-y-auto">
            <div className="flex items-center justify-between pb-4">
              <button onClick={() => setFull(false)} className="p-2 text-mut hover:text-ink" aria-label="Kecilkan player">
                <ChevronDown className="h-6 w-6" />
              </button>
              <div className="text-xs uppercase tracking-[0.25em] text-mut">ClassHub Musik</div>
              <button onClick={stopAll} className="p-2 text-mut hover:text-red-400" aria-label="Stop musik">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={'relative aspect-square rounded-3xl bg-gradient-to-br ' + grad + ' flex items-center justify-center overflow-hidden shadow-2xl'}>
              <MusicIcon className={'h-24 w-24 text-white/80 ' + (playing ? 'animate-pulse' : '')} />
            </div>

            <div className="pt-8">
              <div className="text-xl font-bold truncate">{current.title}</div>
              <div className="text-sm text-mut truncate">{current.artist || 'Musik Kelas'}</div>
            </div>

            <div className="flex items-end gap-[3px] h-14 pt-6 overflow-hidden">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={'flex-1 rounded-full bg-ink/30 ' + (playing ? 'animate-pulse' : '')}
                  style={{ height: h + '%', animationDelay: ((i * 60) % 900) + 'ms' }}
                />
              ))}
            </div>

            <div className="pt-4">
              <input
                type="range"
                min={0}
                max={dur || 0}
                step={1}
                value={pos}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full accent-acc"
                aria-label="Progres lagu"
              />
              <div className="flex justify-between text-xs text-mut pt-1">
                <span>{fmt(pos)}</span>
                <span>{fmt(dur)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8 pt-4 pb-6">
              <button onClick={() => step(-1)} className="p-3 text-ink hover:text-acc" aria-label="Sebelumnya">
                <SkipBack className="h-7 w-7" />
              </button>
              <button
                onClick={toggle}
                className="p-5 rounded-full bg-acc text-acc-ink shadow-xl active:scale-95 transition"
                aria-label="Putar atau jeda"
              >
                {playing ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              </button>
              <button onClick={() => step(1)} className="p-3 text-ink hover:text-acc" aria-label="Berikutnya">
                <SkipForward className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      )}

      {current && !collapsed && !full && (
        <div className="fixed bottom-20 left-3 right-3 md:bottom-4 md:left-auto md:right-4 md:w-96 z-40 bg-card border border-line rounded-2xl p-2 shadow-xl">
          <div className="flex items-center gap-2">
            <button onClick={() => setFull(true)} className="flex items-center gap-2 flex-1 min-w-0 text-left" aria-label="Buka player penuh">
              <div className={'h-10 w-10 rounded-lg bg-gradient-to-br ' + grad + ' flex items-center justify-center shrink-0'}>
                <MusicIcon className="h-4 w-4 text-white/90" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{current.title}</div>
                <div className="text-xs text-mut truncate">{current.artist || 'Musik Kelas'}</div>
              </div>
            </button>
            <button onClick={toggle} className="p-2 rounded-full bg-acc text-acc-ink" aria-label="Putar atau jeda">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={() => step(1)} className="p-2 text-mut hover:text-ink" aria-label="Berikutnya">
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={() => setCollapsed(true)} className="p-1.5 text-mut hover:text-ink" aria-label="Kecilkan jadi bubble">
              <ChevronDown className="h-4 w-4" />
            </button>
            <button onClick={stopAll} className="p-1.5 text-mut hover:text-red-400" aria-label="Stop musik">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {current && collapsed && !full && (
        <button
          onClick={() => setFull(true)}
          className="fixed bottom-20 right-3 md:bottom-6 md:right-6 z-40 p-3 rounded-full bg-acc text-acc-ink shadow-xl"
          aria-label="Buka player"
        >
          <MusicIcon className={'h-5 w-5 ' + (playing ? 'animate-pulse' : '')} />
        </button>
      )}
    </MusicCtx.Provider>
  );
}
`);

console.log('[OK] PART FULL PLAYER done: mini bar -> full player');