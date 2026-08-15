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

// === PART PLAYLIST: PLAYLIST PRIBADI PER ANGGOTA ===

wf('app/music/page.tsx', `'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { useMusic } from '@/components/music/MusicProvider';
import { uploadTrack, deleteTrack } from '@/lib/auth/music-actions';
import { Music, Play, Trash2, Search, Loader2, ListMusic, Plus, X, ArrowLeft } from 'lucide-react';

const MAX_SIZE = 8 * 1024 * 1024;
const OK_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'opus'];

export default function MusicPage() {
  const supabase = createClient();
  const { playTrack } = useMusic();
  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'mine' | 'pl'>('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [openPlId, setOpenPlId] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<any | null>(null);
  const [newPl, setNewPl] = useState('');
  const [plName, setPlName] = useState('');

  async function load() {
    const { data } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
    setTracks(data ?? []);
  }

  async function loadPl() {
    if (!profile) return;
    const { data } = await supabase.from('playlists').select('*').eq('user_id', profile.user_id).order('created_at');
    setPlaylists(data ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p) setProfile(p);
      load();
    })();
  }, []);

  useEffect(() => {
    loadPl();
  }, [profile ? profile.user_id : '']);

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    setMsg('');
    const f = fileRef.current?.files?.[0];
    if (!f) { setErr('Pilih file audio dulu.'); setBusy(false); return; }
    if (f.size > MAX_SIZE) { setErr('Maksimal 8MB per lagu.'); setBusy(false); return; }
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (OK_EXT.indexOf(ext) === -1) { setErr('Format harus mp3/m4a/aac/ogg/opus. FLAC & WAV ditolak.'); setBusy(false); return; }
    const res = await uploadTrack(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      setMsg('Lagu terunggah ✓');
      if (fileRef.current) fileRef.current.value = '';
      load();
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus lagu ini?')) return;
    const res = await deleteTrack(id);
    if (res && res.error) setErr(res.error);
    else load();
  }

  async function createPl() {
    if (!profile || !plName.trim()) return;
    setErr('');
    const { error } = await supabase.from('playlists').insert({ user_id: profile.user_id, name: plName.trim() });
    if (error) setErr(error.message);
    else { setPlName(''); loadPl(); }
  }

  async function createPlQuick() {
    if (!profile || !newPl.trim() || !addTo) return;
    setErr('');
    const { error } = await supabase.from('playlists').insert({ user_id: profile.user_id, name: newPl.trim(), track_ids: [addTo.id] });
    if (error) setErr(error.message);
    else {
      setMsg('Playlist "' + newPl.trim() + '" dibuat + lagu masuk ✓');
      setNewPl('');
      setAddTo(null);
      loadPl();
    }
  }

  async function deletePl(id: string) {
    if (!window.confirm('Hapus playlist ini?')) return;
    await supabase.from('playlists').delete().eq('id', id).eq('user_id', profile.user_id);
    setOpenPlId(null);
    loadPl();
  }

  async function addToPl(plId: string, trackId: string) {
    const pl = playlists.find((p) => p.id === plId);
    if (!pl) return;
    const ids = pl.track_ids || [];
    if (ids.indexOf(trackId) !== -1) { setMsg('Udah ada di "' + pl.name + '".'); setAddTo(null); return; }
    const { error } = await supabase.from('playlists').update({ track_ids: [...ids, trackId] }).eq('id', plId);
    if (error) setErr(error.message);
    else { setAddTo(null); setMsg('Ditambahkan ke "' + pl.name + '" ✓'); loadPl(); }
  }

  async function removeFromPl(plId: string, trackId: string) {
    const pl = playlists.find((p) => p.id === plId);
    if (!pl) return;
    const { error } = await supabase.from('playlists').update({ track_ids: (pl.track_ids || []).filter((t: string) => t !== trackId) }).eq('id', plId);
    if (!error) loadPl();
  }

  if (!profile) return <div className="min-h-screen" />;

  const mine = tracks.filter((t) => t.user_id === profile.user_id);
  const list = (tab === 'all' ? tracks : mine).filter((t) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (t.title || '').toLowerCase().indexOf(s) !== -1 || (t.artist || '').toLowerCase().indexOf(s) !== -1;
  });
  const playable = list.map((t) => ({ id: t.id, title: t.title, artist: t.artist, url: t.url }));

  const openPl = playlists.find((p) => p.id === openPlId) || null;
  const plTracks = openPl ? (openPl.track_ids || []).map((id: string) => tracks.find((t) => t.id === id)).filter(Boolean) : [];
  const plPlayable = plTracks.map((t: any) => ({ id: t.id, title: t.title, artist: t.artist, url: t.url }));

  const inputCls = 'px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';
  const tabCls = (active: boolean) => 'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (active ? 'bg-acc text-acc-ink' : 'bg-line text-mut hover:text-ink');

  return (
    <AppLayout profile={profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Music className="h-6 w-6 text-acc" />
          Musik Kelas
        </h1>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="bg-card border border-line rounded-2xl p-4 space-y-3"
        >
          <div className="grid sm:grid-cols-2 gap-2">
            <input name="title" placeholder="Judul lagu" required className={inputCls} />
            <input name="artist" placeholder="Artis (opsional)" className={inputCls} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              name="file"
              type="file"
              accept=".mp3,.m4a,.aac,.ogg,.opus,audio/mpeg,audio/mp4,audio/aac,audio/ogg"
              className="flex-1 text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
            />
            <button disabled={busy} className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Mengunggah...' : 'Unggah'}
            </button>
          </div>
          <div className="text-xs text-mut">
            Slot upload kamu: <span className="font-bold text-ink">{mine.length}/8</span> • Maks 8MB • Format: mp3, m4a, aac, ogg (FLAC/WAV ditolak)
          </div>
        </form>

        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
        {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">{msg}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setTab('all'); setOpenPlId(null); }} className={tabCls(tab === 'all')}>Semua Musik ({tracks.length})</button>
          <button onClick={() => { setTab('mine'); setOpenPlId(null); }} className={tabCls(tab === 'mine')}>Upload Saya ({mine.length})</button>
          <button onClick={() => { setTab('pl'); setOpenPlId(null); }} className={tabCls(tab === 'pl')}>Playlist Saya ({playlists.length})</button>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="h-4 w-4 text-mut absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul atau artis..." className={inputCls + ' w-full pl-9'} />
          </div>
        </div>

        {tab !== 'pl' && (
          list.length === 0 ? (
            <div className="text-center py-16 text-mut">Belum ada lagu di sini.</div>
          ) : (
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-card border border-line rounded-2xl p-3">
                  <button
                    onClick={() => playTrack({ id: t.id, title: t.title, artist: t.artist, url: t.url }, playable)}
                    className="p-2.5 rounded-full bg-acc text-acc-ink shrink-0"
                    aria-label="Putar"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{t.title}</div>
                    <div className="text-xs text-mut truncate">{t.artist || 'Tidak diketahui'}</div>
                  </div>
                  <button onClick={() => setAddTo(t)} className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line" aria-label="Tambah ke playlist">
                    <ListMusic className="h-4 w-4" />
                  </button>
                  {(t.user_id === profile.user_id || profile.role !== 'student') && (
                    <button onClick={() => remove(t.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg shrink-0" aria-label="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'pl' && !openPl && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input value={plName} onChange={(e) => setPlName(e.target.value)} placeholder="Nama playlist baru..." className={inputCls + ' flex-1'} />
              <button onClick={createPl} className="px-4 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold inline-flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Buat
              </button>
            </div>
            {playlists.length === 0 ? (
              <div className="text-center py-12 text-mut">Belum ada playlist. Bikin yang pertama!</div>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => setOpenPlId(pl.id)}
                  className="w-full flex items-center gap-3 bg-card border border-line rounded-2xl p-4 hover:border-acc/40 text-left"
                >
                  <div className="p-2.5 rounded-xl bg-acc/10 text-acc">
                    <ListMusic className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{pl.name}</div>
                    <div className="text-xs text-mut">{(pl.track_ids || []).length} lagu</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'pl' && openPl && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setOpenPlId(null)} className="p-2 text-mut hover:text-ink" aria-label="Kembali">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{openPl.name}</div>
                <div className="text-xs text-mut">{plTracks.length} lagu</div>
              </div>
              {plPlayable.length > 0 && (
                <button
                  onClick={() => playTrack(plPlayable[0], plPlayable)}
                  className="px-3 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Play className="h-3.5 w-3.5" />
                  Putar Semua
                </button>
              )}
              <button onClick={() => deletePl(openPl.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Hapus playlist">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {plTracks.length === 0 ? (
              <div className="text-center py-12 text-mut">Playlist kosong. Tambah lagu lewat ikon list di tab Semua Musik.</div>
            ) : (
              plTracks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 bg-card border border-line rounded-2xl p-3">
                  <button
                    onClick={() => playTrack({ id: t.id, title: t.title, artist: t.artist, url: t.url }, plPlayable)}
                    className="p-2.5 rounded-full bg-acc text-acc-ink shrink-0"
                    aria-label="Putar"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{t.title}</div>
                    <div className="text-xs text-mut truncate">{t.artist || 'Tidak diketahui'}</div>
                  </div>
                  <button onClick={() => removeFromPl(openPl.id, t.id)} className="p-2 text-mut hover:text-red-400 rounded-lg" aria-label="Keluarkan dari playlist">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {addTo && (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={() => setAddTo(null)}>
            <div className="bg-card border border-line rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">Tambah ke Playlist</h3>
                <button onClick={() => setAddTo(null)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="text-xs text-mut truncate">
                Lagu: <span className="text-ink font-semibold">{addTo.title}</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {playlists.length === 0 && <div className="text-center py-6 text-mut text-sm">Belum ada playlist.</div>}
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => addToPl(pl.id, addTo.id)}
                    className="w-full flex items-center gap-2 p-3 rounded-xl bg-card-2 border border-line hover:border-acc/40 text-left"
                  >
                    <ListMusic className="h-4 w-4 text-acc shrink-0" />
                    <span className="flex-1 text-sm truncate">{pl.name}</span>
                    <Plus className="h-4 w-4 text-mut" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <input value={newPl} onChange={(e) => setNewPl(e.target.value)} placeholder="Playlist baru langsung..." className={inputCls + ' flex-1'} />
                <button onClick={createPlQuick} className="px-3 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold shrink-0">
                  Buat+
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] PART PLAYLIST done: playlist pribadi per anggota');

// === PART TASK STAFF SUBMIT: ADMIN BIKIN TUGAS, ADMIN JUGA NGUMPULIN ===

wf('components/tasks/TaskCard.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitTask } from '@/lib/auth/task-actions';
import SubmissionsSheet from './SubmissionsSheet';
import { Users, Paperclip } from 'lucide-react';

export default function TaskCard({ task, mySub, subCount, isStaff, userId }: any) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const late = !mySub && new Date(task.deadline) < new Date();

  async function submit(fd: FormData) {
    setBusy(true);
    setErr('');
    try {
      const res = await submitTask(fd);
      if (res && res.error) setErr(res.error);
      else router.refresh();
    } catch (e: any) {
      setErr('Error: ' + (e && e.message ? e.message : 'gagal mengirim'));
    }
    setBusy(false);
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{task.title}</div>
          <div className="text-xs text-mut">{task.subject}</div>
        </div>
        {mySub ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-acc/10 text-acc font-semibold">
            {mySub.status === 'graded' ? 'Nilai: ' + mySub.grade : mySub.status === 'late' ? 'Terlambat' : 'Dikumpulkan'}
          </span>
        ) : late ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 font-semibold">Lewat deadline</span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold">Aktif</span>
        )}
      </div>

      {task.description && <p className="text-sm text-mut whitespace-pre-wrap">{task.description}</p>}

      {task.attachment_url && (
        <a href={task.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-acc hover:underline">
          <Paperclip className="h-3 w-3" />
          Lampiran tugas
        </a>
      )}

      <div className="text-xs text-mut">
        Deadline: {new Date(task.deadline).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </div>

      {mySub && mySub.feedback && (
        <div className="p-3 rounded-xl bg-card-2 border border-line text-sm">
          <span className="font-semibold text-acc">Feedback:</span> {mySub.feedback}
        </div>
      )}

      {!mySub && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-line"
        >
          <input name="task_id" type="hidden" value={task.id} />
          <input
            name="file"
            type="file"
            required
            className="flex-1 text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
          />
          <button disabled={busy} className="px-3 py-2 rounded-lg bg-acc text-acc-ink text-xs font-semibold hover:bg-acc-strong disabled:opacity-50">
            {busy ? 'Mengunggah...' : 'Kumpulkan'}
          </button>
          {err && <div className="w-full text-xs text-red-400">{err}</div>}
        </form>
      )}

      {isStaff && (
        <button
          onClick={() => setOpenSubs(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
        >
          <Users className="h-3.5 w-3.5" />
          Lihat Submission ({subCount})
        </button>
      )}

      {openSubs && <SubmissionsSheet taskId={task.id} onClose={() => setOpenSubs(false)} />}
    </div>
  );
}
`);

console.log('[OK] PART TASK STAFF SUBMIT done: admin juga bisa ngumpulin tugas');




// === PART COMMENT SHEET MOBILE: BOTTOM SHEET, X SELALU KELIHATAN ===

wf('components/feed/CommentsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteCommentAdmin } from '@/lib/auth/moderation-actions';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose, postOwnerId, actorName, isStaff }: any) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('post_id', postId)
      .order('created_at');
    setComments(data ?? []);
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function submit() {
    if (!text.trim()) return;
    setErr('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: text.trim(),
      parent_id: replyTo ? replyTo.id : null,
    });
    if (error) { setErr('Gagal kirim: ' + error.message); return; }
    const target = replyTo ? replyTo.user_id : postOwnerId;
    if (target && target !== userId) {
      await supabase.from('notifications').insert({
        user_id: target,
        type: 'comment',
        title: actorName + (replyTo ? ' membalas komentarmu' : ' mengomentari postinganmu'),
        actor_id: userId,
        target_type: 'post',
        target_id: postId,
      });
    }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string, ownerId: string) {
    if (ownerId === userId) {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (!error) load();
    } else {
      const res = await deleteCommentAdmin(id);
      if (res && res.error) setErr('Gagal hapus: ' + res.error);
      else load();
    }
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card border border-line rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 pt-2 pb-3 px-4 border-b border-line">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Komentar</h3>
            <button onClick={onClose} className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line" aria-label="Tutup komentar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <div className="text-center py-10 text-mut text-sm">Belum ada komentar. Mulai diskusi!</div>
          ) : (
            top.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-line-2 flex items-center justify-center text-xs font-bold text-ink shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-ink">{c.profiles?.full_name}</div>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <button onClick={() => setReplyTo(c)} className="text-xs text-mut hover:text-ink">Balas</button>
                      {(c.user_id === userId || isStaff) && (
                        <button onClick={() => del(c.id, c.user_id)} className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {repliesOf(c.id).map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 pl-8">
                    <div className="h-7 w-7 rounded-full bg-line-2 flex items-center justify-center text-[10px] font-bold text-ink shrink-0">
                      {(r.profiles?.full_name || 'U').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink">{r.profiles?.full_name}</div>
                      <p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>
                      {(r.user_id === userId || isStaff) && (
                        <button onClick={() => del(r.id, r.user_id)} className="text-xs text-red-400 mt-0.5">Hapus</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-line p-3 space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-mut">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-ink" aria-label="Batal membalas">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2.5 rounded-full bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button onClick={submit} className="p-2.5 rounded-full bg-acc text-acc-ink shrink-0" aria-label="Kirim komentar">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

console.log('[OK] COMMENT SHEET MOBILE done: bottom sheet + X selalu kelihatan');

// === PART POLISH3: FIX SHEET TERJEBAK + HAPUS THEME TOGGLE ===

(function () {
  const sp = 'app/globals.css';
  let c = fs.readFileSync(sp, 'utf8');
  if (c.indexOf('anim-fade-up-fix') === -1) {
    c += `
/* anim-fade-up-fix: jangan sisakan transform, biar fixed overlay gak terjebak */
.anim-fade-up { animation-fill-mode: backwards !important; }
`;
    fs.writeFileSync(sp, c, 'utf8');
    console.log('[OK] POLISH3: css fill-mode backwards');
  } else {
    console.log('[SKIP] POLISH3 css');
  }
})();

wf('components/feed/CommentsSheet.tsx', `'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { deleteCommentAdmin } from '@/lib/auth/moderation-actions';
import { X, Send, Trash2 } from 'lucide-react';

export default function CommentsSheet({ postId, userId, onClose, postOwnerId, actorName, isStaff }: any) {
  const supabase = createClient();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('post_id', postId)
      .order('created_at');
    setComments(data ?? []);
  }

  useEffect(() => {
    load();
  }, [postId]);

  async function submit() {
    if (!text.trim()) return;
    setErr('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      content: text.trim(),
      parent_id: replyTo ? replyTo.id : null,
    });
    if (error) { setErr('Gagal kirim: ' + error.message); return; }
    const target = replyTo ? replyTo.user_id : postOwnerId;
    if (target && target !== userId) {
      await supabase.from('notifications').insert({
        user_id: target,
        type: 'comment',
        title: actorName + (replyTo ? ' membalas komentarmu' : ' mengomentari postinganmu'),
        actor_id: userId,
        target_type: 'post',
        target_id: postId,
      });
    }
    setText('');
    setReplyTo(null);
    load();
  }

  async function del(id: string, ownerId: string) {
    if (ownerId === userId) {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (!error) load();
    } else {
      const res = await deleteCommentAdmin(id);
      if (res && res.error) setErr('Gagal hapus: ' + res.error);
      else load();
    }
  }

  const top = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card border border-line rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 pt-2 pb-3 px-4 border-b border-line">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Komentar</h3>
            <button onClick={onClose} className="p-2 text-mut hover:text-ink rounded-lg hover:bg-line" aria-label="Tutup komentar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}
          {top.length === 0 ? (
            <div className="text-center py-10 text-mut text-sm">Belum ada komentar. Mulai diskusi!</div>
          ) : (
            top.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-line-2 flex items-center justify-center text-xs font-bold text-ink shrink-0">
                    {(c.profiles?.full_name || 'U').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-ink">{c.profiles?.full_name}</div>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <button onClick={() => setReplyTo(c)} className="text-xs text-mut hover:text-ink">Balas</button>
                      {(c.user_id === userId || isStaff) && (
                        <button onClick={() => del(c.id, c.user_id)} className="text-xs text-red-400 hover:text-red-300 inline-flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {repliesOf(c.id).map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 pl-8">
                    <div className="h-7 w-7 rounded-full bg-line-2 flex items-center justify-center text-[10px] font-bold text-ink shrink-0">
                      {(r.profiles?.full_name || 'U').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink">{r.profiles?.full_name}</div>
                      <p className="text-sm whitespace-pre-wrap break-words">{r.content}</p>
                      {(r.user_id === userId || isStaff) && (
                        <button onClick={() => del(r.id, r.user_id)} className="text-xs text-red-400 mt-0.5">Hapus</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-line p-3 space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-mut">
              <span>Membalas {replyTo.profiles?.full_name}</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-ink" aria-label="Batal membalas">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Tulis komentar..."
              className="flex-1 px-4 py-2.5 rounded-full bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button onClick={submit} className="p-2.5 rounded-full bg-acc text-acc-ink shrink-0" aria-label="Kirim komentar">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
`);

console.log('[OK] PART POLISH3 done: sheet portal + fill-mode + theme toggle hilang');

// === PART GALLERY v2: MODE EDIT + HAK HAPUS PER OWNER + KUOTA 5 ===

wf('lib/auth/gallery-actions.ts', `'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const STUDENT_MAX = 5;

export async function createAlbum(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').insert({
    name,
    description: description || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: album } = await admin.from('gallery_albums').select('created_by').eq('id', albumId).maybeSingle();
  if (!album) return { error: 'Album tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && album.created_by !== user.id) return { error: 'Kamu bukan pembuat album ini.' };
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function uploadMedia(formData: FormData) {
  const user = await requireUser();
  const albumId = String(formData.get('album_id') || '');
  const file = formData.get('file') as File | null;
  if (!albumId) return { error: 'Album tidak valid.' };
  if (!file || file.size === 0) return { error: 'Pilih file dulu.' };
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return { error: 'Hanya gambar atau video.' };
  if (file.size > 20 * 1024 * 1024) return { error: 'Maksimal 20MB per file.' };
  const isStaff = user.profile.role !== 'student';
  const admin = createAdminClient();
  if (!isStaff) {
    const { count } = await admin
      .from('gallery_media')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) >= STUDENT_MAX) return { error: 'Kamu sudah upload 5 foto/video (maksimal anggota). Hapus punyamu dulu kalau mau ganti.' };
  }
  const id = randomUUID();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = user.id + '/' + id + '.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('gallery')
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('gallery').getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from('gallery_media').insert({
    album_id: albumId,
    user_id: user.id,
    media_url: url,
    media_type: file.type.startsWith('video/') ? 'video' : 'image',
    caption: file.name,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteMedia(mediaId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: m } = await admin.from('gallery_media').select('user_id').eq('id', mediaId).maybeSingle();
  if (!m) return { error: 'Media tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && m.user_id !== user.id) return { error: 'Kamu hanya bisa hapus foto uploadanmu sendiri.' };
  const { error } = await admin.from('gallery_media').delete().eq('id', mediaId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
`);

wf('components/gallery/UploadModal.tsx', `'use client';
import { useRef, useState } from 'react';
import { uploadMedia } from '@/lib/auth/gallery-actions';
import { X, Loader2 } from 'lucide-react';

export default function UploadModal({ albumId, onClose }: { albumId: string; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) { setErr('Pilih foto dulu.'); return; }
    setBusy(true);
    setErr('');
    let lastErr = '';
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append('album_id', albumId);
      fd.append('file', f);
      const res = await uploadMedia(fd);
      if (res && res.error) { lastErr = res.error; break; }
    }
    setBusy(false);
    if (lastErr) setErr(lastErr);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-line rounded-2xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Tambah Foto</h3>
          <button onClick={onClose} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
        <button onClick={upload} disabled={busy} className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Mengunggah...' : 'Unggah'}
        </button>
      </div>
    </div>
  );
}
`);

wf('components/gallery/GalleryAlbum.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { deleteAlbum, deleteMedia } from '@/lib/auth/gallery-actions';
import { Upload, Trash2, Pencil, X } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff, myCount }: { album: any; userId: string; isStaff: boolean; myCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState('');
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);
  const canAlbum = isStaff || album.created_by === userId;
  const canUpload = isStaff || myCount < 5;
  const hasMine = media.some((m: any) => m.user_id === userId);

  async function removeAlbum() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus.')) return;
    setErr('');
    const res = await deleteAlbum(album.id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function removeMedia(id: string) {
    if (!window.confirm('Hapus foto ini?')) return;
    setErr('');
    const res = await deleteMedia(id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{album.name}</div>
          <div className="text-xs text-mut">
            {album.description ? album.description + ' • ' : ''}
            {media.length} foto
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Tambah Foto
            </button>
          )}
          {(canAlbum || hasMine || isStaff) && (
            <button
              onClick={() => setEdit(!edit)}
              className={'p-2 rounded-lg ' + (edit ? 'bg-acc text-acc-ink' : 'bg-line text-mut hover:text-ink')}
              aria-label="Mode edit"
            >
              {edit ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {!isStaff && <div className="text-[11px] text-mut">Upload kamu: {myCount}/5</div>}

      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      {edit && (
        <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs flex items-center justify-between gap-2 flex-wrap">
          Mode edit aktif — ikon hapus muncul di foto yang boleh kamu hapus.
          {canAlbum && (
            <button
              onClick={removeAlbum}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Album
            </button>
          )}
        </div>
      )}

      {media.length === 0 ? (
        <div className="text-center py-8 text-mut text-sm">Album kosong. Tambah foto pertama!</div>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <div key={m.id} className="relative mb-2 w-full rounded-xl overflow-hidden border border-line bg-card-2 break-inside-avoid">
              <button onClick={() => setOpen(i)} className="block w-full" aria-label="Lihat detail">
                {m.media_type === 'video' ? (
                  <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto block" />
                ) : (
                  <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-auto block" />
                )}
              </button>
              {edit && (isStaff || m.user_id === userId) && (
                <button
                  onClick={() => removeMedia(m.id)}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/70 text-red-400 hover:bg-red-500/20"
                  aria-label="Hapus foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
`);

wf('app/gallery/page.tsx', `import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/actions';
import AppLayout from '@/components/layout/AppLayout';
import GalleryAlbum from '@/components/gallery/GalleryAlbum';
import CreateAlbumForm from '@/components/gallery/CreateAlbumForm';
import { Image as ImageIcon } from 'lucide-react';

export default async function GalleryPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const isStaff = user.profile.role !== 'student';

  const [{ data: albums, error: errAlbums }, { data: media, error: errMedia }] = await Promise.all([
    supabase.from('gallery_albums').select('*').order('created_at', { ascending: false }),
    supabase.from('gallery_media').select('*').order('created_at'),
  ]);

  const mediaByAlbum: Record<string, any[]> = {};
  for (const m of media ?? []) {
    if (!mediaByAlbum[m.album_id]) mediaByAlbum[m.album_id] = [];
    mediaByAlbum[m.album_id].push(m);
  }
  const myCount = (media ?? []).filter((m: any) => m.user_id === user.id).length;

  return (
    <AppLayout profile={user.profile}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {(errAlbums || errMedia) && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errAlbums ? 'Error album: ' + errAlbums.message : 'Error media: ' + (errMedia ? errMedia.message : '')}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-acc" />
            Galeri Kelas
          </h1>
          <CreateAlbumForm />
        </div>

        {(albums?.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-mut">Belum ada album. Buat album pertama!</div>
        ) : (
          (albums ?? []).map((a: any) => (
            <GalleryAlbum
              key={a.id}
              album={{ ...a, gallery_media: mediaByAlbum[a.id] ?? [] }}
              userId={user.id}
              isStaff={isStaff}
              myCount={myCount}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
`);

console.log('[OK] PART GALLERY v2 done: mode edit + hak owner + kuota 5');

// === PART GALLERY RENAME: EDIT NAMA + DESKRIPSI ALBUM ===

wf('lib/auth/gallery-actions.ts', `'use server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const STUDENT_MAX = 5;

export async function createAlbum(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { error } = await admin.from('gallery_albums').insert({
    name,
    description: description || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function updateAlbum(formData: FormData) {
  const user = await requireUser();
  const albumId = String(formData.get('album_id') || '');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  if (!albumId) return { error: 'Album tidak valid.' };
  if (!name) return { error: 'Nama album wajib diisi.' };
  const admin = createAdminClient();
  const { data: album } = await admin.from('gallery_albums').select('created_by').eq('id', albumId).maybeSingle();
  if (!album) return { error: 'Album tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && album.created_by !== user.id) return { error: 'Kamu bukan pembuat album ini.' };
  const { error } = await admin
    .from('gallery_albums')
    .update({ name, description: description || null })
    .eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteAlbum(albumId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: album } = await admin.from('gallery_albums').select('created_by').eq('id', albumId).maybeSingle();
  if (!album) return { error: 'Album tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && album.created_by !== user.id) return { error: 'Kamu bukan pembuat album ini.' };
  const { error } = await admin.from('gallery_albums').delete().eq('id', albumId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function uploadMedia(formData: FormData) {
  const user = await requireUser();
  const albumId = String(formData.get('album_id') || '');
  const file = formData.get('file') as File | null;
  if (!albumId) return { error: 'Album tidak valid.' };
  if (!file || file.size === 0) return { error: 'Pilih file dulu.' };
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return { error: 'Hanya gambar atau video.' };
  if (file.size > 20 * 1024 * 1024) return { error: 'Maksimal 20MB per file.' };
  const isStaff = user.profile.role !== 'student';
  const admin = createAdminClient();
  if (!isStaff) {
    const { count } = await admin
      .from('gallery_media')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) >= STUDENT_MAX) return { error: 'Kamu sudah upload 5 foto/video (maksimal anggota). Hapus punyamu dulu kalau mau ganti.' };
  }
  const id = randomUUID();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = user.id + '/' + id + '.' + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('gallery')
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true });
  if (upErr) return { error: 'Upload gagal: ' + upErr.message };
  const url = admin.storage.from('gallery').getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from('gallery_media').insert({
    album_id: albumId,
    user_id: user.id,
    media_url: url,
    media_type: file.type.startsWith('video/') ? 'video' : 'image',
    caption: file.name,
  });
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}

export async function deleteMedia(mediaId: string) {
  const user = await requireUser();
  const admin = createAdminClient();
  const { data: m } = await admin.from('gallery_media').select('user_id').eq('id', mediaId).maybeSingle();
  if (!m) return { error: 'Media tidak ditemukan.' };
  const isStaff = user.profile.role !== 'student';
  if (!isStaff && m.user_id !== user.id) return { error: 'Kamu hanya bisa hapus foto uploadanmu sendiri.' };
  const { error } = await admin.from('gallery_media').delete().eq('id', mediaId);
  if (error) return { error: error.message };
  revalidatePath('/gallery');
  return { success: true };
}
`);

wf('components/gallery/GalleryAlbum.tsx', `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Lightbox from '@/components/feed/Lightbox';
import UploadModal from './UploadModal';
import { updateAlbum, deleteAlbum, deleteMedia } from '@/lib/auth/gallery-actions';
import { Upload, Trash2, Pencil, X, Check } from 'lucide-react';

export default function GalleryAlbum({ album, userId, isStaff, myCount }: { album: any; userId: string; isStaff: boolean; myCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [edit, setEdit] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const media = album.gallery_media ?? [];
  const urls = media.map((m: any) => m.media_url);
  const canAlbum = isStaff || album.created_by === userId;
  const canUpload = isStaff || myCount < 5;
  const hasMine = media.some((m: any) => m.user_id === userId);

  async function removeAlbum() {
    if (!window.confirm('Hapus album "' + album.name + '"? Semua foto di dalamnya ikut terhapus.')) return;
    setErr('');
    const res = await deleteAlbum(album.id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function removeMedia(id: string) {
    if (!window.confirm('Hapus foto ini?')) return;
    setErr('');
    const res = await deleteMedia(id);
    if (res && res.error) setErr(res.error);
    else router.refresh();
  }

  async function rename(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await updateAlbum(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else {
      setShowRename(false);
      router.refresh();
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

  return (
    <div className="bg-card border border-line rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{album.name}</div>
          <div className="text-xs text-mut">
            {album.description ? album.description + ' • ' : ''}
            {media.length} foto
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Tambah Foto
            </button>
          )}
          {(canAlbum || hasMine || isStaff) && (
            <button
              onClick={() => setEdit(!edit)}
              className={'p-2 rounded-lg ' + (edit ? 'bg-acc text-acc-ink' : 'bg-line text-mut hover:text-ink')}
              aria-label="Mode edit"
            >
              {edit ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {!isStaff && <div className="text-[11px] text-mut">Upload kamu: {myCount}/5</div>}

      {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>}

      {edit && (
        <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-xs flex items-center justify-between gap-2 flex-wrap">
          Mode edit aktif — ikon hapus muncul di foto yang boleh kamu hapus.
          {canAlbum && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRename(!showRename)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-line text-ink border border-line text-xs font-semibold hover:bg-line-2"
              >
                <Pencil className="h-3.5 w-3.5" />
                Ganti Nama
              </button>
              <button
                onClick={removeAlbum}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Album
              </button>
            </div>
          )}
        </div>
      )}

      {edit && canAlbum && showRename && (
        <form
          onSubmit={(e) => { e.preventDefault(); rename(new FormData(e.currentTarget)); }}
          className="p-3 rounded-lg bg-card-2 border border-line space-y-2"
        >
          <input name="album_id" type="hidden" value={album.id} />
          <input name="name" defaultValue={album.name} required placeholder="Nama album" className={inputCls} />
          <input name="description" defaultValue={album.description || ''} placeholder="Deskripsi (opsional)" className={inputCls} />
          <div className="flex gap-2">
            <button disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-acc text-acc-ink text-xs font-semibold hover:bg-acc-strong disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />
              {busy ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setShowRename(false)} className="px-3 py-1.5 rounded-lg bg-line text-ink text-xs font-semibold hover:bg-line-2">
              Batal
            </button>
          </div>
        </form>
      )}

      {media.length === 0 ? (
        <div className="text-center py-8 text-mut text-sm">Album kosong. Tambah foto pertama!</div>
      ) : (
        <div className="columns-2 md:columns-3 gap-2">
          {media.map((m: any, i: number) => (
            <div key={m.id} className="relative mb-2 w-full rounded-xl overflow-hidden border border-line bg-card-2 break-inside-avoid">
              <button onClick={() => setOpen(i)} className="block w-full" aria-label="Lihat detail">
                {m.media_type === 'video' ? (
                  <video src={m.media_url} muted preload="metadata" playsInline className="w-full h-auto block" />
                ) : (
                  <img src={m.media_url} alt={m.caption || ''} loading="lazy" className="w-full h-auto block" />
                )}
              </button>
              {edit && (isStaff || m.user_id === userId) && (
                <button
                  onClick={() => removeMedia(m.id)}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/70 text-red-400 hover:bg-red-500/20"
                  aria-label="Hapus foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open !== null && <Lightbox urls={urls} index={open} onClose={() => setOpen(null)} />}
      {showUpload && <UploadModal albumId={album.id} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
`);

console.log('[OK] PART GALLERY RENAME done: ganti nama + deskripsi album');