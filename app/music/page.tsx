'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { useMusic } from '@/components/music/MusicProvider';
import { uploadTrack, deleteTrack } from '@/lib/auth/music-actions';
import { Music, Play, Trash2, Search, Loader2 } from 'lucide-react';

const MAX_SIZE = 8 * 1024 * 1024;
const OK_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'opus'];

export default function MusicPage() {
  const supabase = createClient();
  const { playTrack } = useMusic();
  const [profile, setProfile] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
    setTracks(data ?? []);
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

  if (!profile) return <div className="min-h-screen" />;

  const mine = tracks.filter((t) => t.user_id === profile.user_id);
  const list = (tab === 'all' ? tracks : mine).filter((t) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (t.title || '').toLowerCase().indexOf(s) !== -1 || (t.artist || '').toLowerCase().indexOf(s) !== -1;
  });
  const playable = list.map((t) => ({ id: t.id, title: t.title, artist: t.artist, url: t.url }));

  const inputCls = 'px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50';

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
          {err && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}
          {msg && <div className="p-2 rounded-lg bg-acc/10 border border-acc/30 text-acc text-sm">{msg}</div>}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('all')}
            className={'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (tab === 'all' ? 'bg-acc text-acc-ink' : 'bg-line text-mut hover:text-ink')}
          >
            Semua Musik ({tracks.length})
          </button>
          <button
            onClick={() => setTab('mine')}
            className={'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (tab === 'mine' ? 'bg-acc text-acc-ink' : 'bg-line text-mut hover:text-ink')}
          >
            Upload Saya ({mine.length})
          </button>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="h-4 w-4 text-mut absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul atau artis..."
              className={inputCls + ' w-full pl-9'}
            />
          </div>
        </div>

        {list.length === 0 ? (
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
                {(t.user_id === profile.user_id || profile.role !== 'student') && (
                  <button onClick={() => remove(t.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg shrink-0" aria-label="Hapus">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
