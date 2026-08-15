'use client';
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
