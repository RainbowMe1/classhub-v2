'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMusic } from './MusicProvider';
import { uploadTrack, deleteTrack } from '@/lib/auth/music-actions';
import { Play, Pause, Music as MusicIcon, Trash2, Search, Upload } from 'lucide-react';

export default function MusicRoom({ userId, isStaff }: { userId: string; isStaff: boolean }) {
  const supabase = createClient();
  const { current, playing, playTrack, toggle } = useMusic();
  const [tracks, setTracks] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
    setTracks(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = tracks.filter((t) => {
    const matchTab = tab === 'all' ? true : t.created_by === userId;
    const s = q.trim().toLowerCase();
    const matchQ = !s || (t.title || '').toLowerCase().includes(s) || (t.artist || '').toLowerCase().includes(s);
    return matchTab && matchQ;
  });

  async function upload(fd: FormData) {
    setBusy(true);
    setErr('');
    const res = await uploadTrack(fd);
    setBusy(false);
    if (res && res.error) setErr(res.error);
    else load();
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus lagu ini?')) return;
    const res = await deleteTrack(id);
    if (res && res.error) setErr(res.error);
    else load();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <MusicIcon className="h-6 w-6 text-acc" />
        Musik Kelas
      </h1>

      <form
        onSubmit={(e) => { e.preventDefault(); upload(new FormData(e.currentTarget)); }}
        className="bg-card border border-line rounded-2xl p-4 grid md:grid-cols-4 gap-3"
      >
        <input name="title" required placeholder="Judul lagu" className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        <input name="artist" placeholder="Artis (opsional)" className="px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50" />
        <input name="file" type="file" accept="audio/*" required className="text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink" />
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold disabled:opacity-50">
          <Upload className="h-4 w-4" />
          {busy ? '...' : 'Unggah'}
        </button>
        {err && <div className="md:col-span-4 text-xs text-red-400">{err}</div>}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab('all')}
          className={'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (tab === 'all' ? 'bg-acc text-acc-ink' : 'bg-card border border-line text-mut')}
        >
          Semua Musik ({tracks.length})
        </button>
        <button
          onClick={() => setTab('mine')}
          className={'px-3 py-1.5 rounded-lg text-xs font-semibold ' + (tab === 'mine' ? 'bg-acc text-acc-ink' : 'bg-card border border-line text-mut')}
        >
          Upload Saya
        </button>
        <div className="flex-1 min-w-[160px] relative">
          <Search className="h-4 w-4 text-mut absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari judul atau artis..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-mut">
            {q ? 'Tidak ada hasil untuk "' + q + '".' : 'Belum ada lagu di perpustakaan. Unggah yang pertama!'}
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              className={'flex items-center gap-3 p-3 rounded-xl border ' + (current && current.id === t.id ? 'bg-acc/10 border-acc/30' : 'bg-card border-line')}
            >
              <button
                onClick={() => (current && current.id === t.id ? toggle() : playTrack(t, filtered))}
                className="p-2 rounded-full bg-acc text-acc-ink"
                aria-label="Putar"
              >
                {current && current.id === t.id && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{t.title}</div>
                <div className="text-xs text-mut truncate">{t.artist || 'Tidak diketahui'}</div>
              </div>
              {(isStaff || t.created_by === userId) && (
                <button onClick={() => remove(t.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
