'use client';
/* eslint-disable @next/next/no-img-element -- Native image rendering preserves animated GIF album covers. */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useMusic, type MusicTrack } from '@/components/music/MusicProvider';
import { createTrackUpload, deleteTrack, reorderTracks, saveUploadedTrack, updateTrack } from '@/lib/auth/music-actions';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock3,
  Headphones,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';

const MAX_SIZE = 8 * 1024 * 1024;
const OK_EXT = ['mp3', 'm4a', 'aac', 'ogg', 'opus'];
const AUDIO_MIMES: Record<string, string[]> = {
  mp3: ['audio/mpeg'],
  m4a: ['audio/mp4'],
  aac: ['audio/aac'],
  ogg: ['audio/ogg'],
  opus: ['audio/opus', 'audio/ogg'],
};

type Track = MusicTrack & {
  user_id: string;
  sort_order?: number | null;
  duration_seconds?: number | null;
};

type Playlist = {
  id: string;
  name: string;
  track_ids: string[] | null;
};

function formatTime(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return '—:——';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ':' + String(secs).padStart(2, '0');
}

function AlbumArt({ track, className = '' }: { track: Track | MusicTrack; className?: string }) {
  return (
    <div className={'relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-acc/30 via-card-2 to-indigo-500/20 ' + className}>
      {track.cover_url ? (
        <img src={track.cover_url} alt={'Cover ' + track.title} className="h-full w-full object-cover" />
      ) : (
        <Music2 className="h-8 w-8 text-acc/80" aria-hidden="true" />
      )}
    </div>
  );
}

export default function MusicPage() {
  const supabase = useMemo(() => createClient(), []);
  const { current, playing, playTrack, toggle, stop, step, pos, dur, seek, volume, setVolume, shuffle, setShuffle, repeatMode, cycleRepeat } = useMusic();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tab, setTab] = useState<'all' | 'mine' | 'playlists'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadDuration, setUploadDuration] = useState(0);
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<Track | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [editing, setEditing] = useState<Track | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  const loadTracks = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('tracks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (loadError) {
      setError('Musik gagal dimuat: ' + loadError.message);
      return;
    }
    setTracks((data ?? []) as Track[]);
  }, [supabase]);

  const loadPlaylists = useCallback(async () => {
    if (!profile) return;
    const { data, error: loadError } = await supabase
      .from('playlists')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: true });
    if (loadError) {
      setError('Playlist gagal dimuat: ' + loadError.message);
      return;
    }
    setPlaylists((data ?? []) as Playlist[]);
  }, [profile, supabase]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (active) {
          setError(authError?.message || 'Sesi pengguna tidak ditemukan.');
          setLoading(false);
        }
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError || !data) {
        if (active) {
          setError(profileError?.message || 'Profil pengguna tidak ditemukan.');
          setLoading(false);
        }
        return;
      }

      if (active) setProfile(data as Profile);
      const { data: trackData, error: trackError } = await supabase
        .from('tracks')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (!active) return;
      if (trackError) setError('Musik gagal dimuat: ' + trackError.message);
      else setTracks((trackData ?? []) as Track[]);
      setLoading(false);
    }
    initialize().catch((loadError: unknown) => {
      if (active) {
        setError(loadError instanceof Error ? loadError.message : 'Musik gagal dimuat.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase]);

  const profileUserId = profile?.user_id;
  useEffect(() => {
    if (!profileUserId) return;
    const userId = profileUserId;
    let active = true;
    async function load() {
      const { data, error: loadError } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (!active) return;
      if (loadError) setError('Playlist gagal dimuat: ' + loadError.message);
      else setPlaylists((data ?? []) as Playlist[]);
    }
    load().catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Playlist gagal dimuat.');
    });
    return () => { active = false; };
  }, [profileUserId, supabase]);

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';
  const mine = tracks.filter((track) => track.user_id === profile?.user_id);
  const filteredTracks = (tab === 'mine' ? mine : tracks).filter((track) => {
    const needle = query.trim().toLowerCase();
    return !needle || (track.title || '').toLowerCase().includes(needle) || (track.artist || '').toLowerCase().includes(needle);
  });
  const playable = filteredTracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    url: track.url,
    cover_url: track.cover_url,
    duration_seconds: track.duration_seconds,
  }));
  const selectedPlaylist = playlists.find((playlist) => playlist.id === openPlaylistId) || null;
  const playlistTracks = selectedPlaylist
    ? (selectedPlaylist.track_ids || []).map((id) => tracks.find((track) => track.id === id)).filter((track): track is Track => Boolean(track))
    : [];
  const playlistPlayable = playlistTracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    url: track.url,
    cover_url: track.cover_url,
    duration_seconds: track.duration_seconds,
  }));
  const activeTrack = tracks.find((track) => track.id === current?.id) || null;
  const displayedDuration = dur || activeTrack?.duration_seconds || 0;
  const canReorder = Boolean(isStaff && tab === 'all' && !query.trim());

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const file = formData.get('file');
      if (!(file instanceof File)) {
        setError('Pilih file audio dulu.');
        return;
      }

      const details = {
        title: String(formData.get('title') || ''),
        artist: String(formData.get('artist') || ''),
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        durationSeconds: uploadDuration,
      };
      const prepared = await createTrackUpload(details);
      if (!('upload' in prepared) || !prepared.upload) {
        setError(prepared.error || 'Upload gagal disiapkan. Coba lagi.');
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from('music')
        .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
          contentType: prepared.upload.contentType,
          upsert: false,
        });
      if (uploadError) {
        setError('Upload gagal: ' + uploadError.message);
        return;
      }

      const result = await saveUploadedTrack({
        path: prepared.upload.path,
        title: details.title,
        artist: details.artist,
        durationSeconds: details.durationSeconds,
      });
      if (result?.error) setError(result.error);
      else {
        setNotice('Lagu berhasil ditambahkan ke perpustakaan.');
        uploadFormRef.current?.reset();
        setUploadDuration(0);
        await loadTracks();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? 'Upload gagal: ' + actionError.message : 'Upload gagal. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  function readDuration(file?: File) {
    setUploadDuration(0);
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = file.type.split(';')[0].trim().toLowerCase();
    if (!OK_EXT.includes(ext) || (mime && !(AUDIO_MIMES[ext] || []).includes(mime))) {
      setError('Format file dan MIME harus cocok: MP3, M4A, AAC, OGG, atau OPUS.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Maksimal 8MB per lagu.');
      return;
    }
    setError('');
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      setUploadDuration(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
      URL.revokeObjectURL(objectUrl);
    };
    audio.onerror = () => URL.revokeObjectURL(objectUrl);
    audio.src = objectUrl;
  }

  async function removeTrack(track: Track) {
    if (!window.confirm('Hapus lagu “' + track.title + '”?')) return;
    setError('');
    setNotice('');
    setDeletingId(track.id);
    try {
      const result = await deleteTrack(track.id);
      if (result?.error) setError(result.error);
      else {
        setNotice(result?.warning || 'Lagu berhasil dihapus.');
        if (current?.id === track.id) stop();
        await loadTracks();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Lagu gagal dihapus.');
    } finally {
      setDeletingId(null);
    }
  }

  async function saveTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError('');
    setNotice('');
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const cover = coverRef.current?.files?.[0];
    if (cover?.size) form.set('cover', cover);
    else form.delete('cover');
    try {
      const result = await updateTrack(editing.id, form);
      if (result?.error) setError(result.error);
      else {
        setNotice(result?.warning || 'Detail lagu berhasil diperbarui.');
        setEditing(null);
        await loadTracks();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Perubahan lagu gagal disimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function moveTrack(track: Track, direction: -1 | 1) {
    const from = tracks.findIndex((item) => item.id === track.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= tracks.length) return;
    const next = [...tracks];
    [next[from], next[to]] = [next[to], next[from]];
    setReordering(true);
    setError('');
    setNotice('');
    try {
      const result = await reorderTracks(next.map((item) => item.id));
      if (result?.error) setError(result.error);
      else {
        setTracks(next);
        setNotice('Urutan lagu diperbarui.');
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Urutan lagu gagal disimpan.');
    } finally {
      setReordering(false);
    }
  }

  async function createPlaylist() {
    if (!profile || !playlistName.trim()) return;
    setError('');
    setNotice('');
    const { error: insertError } = await supabase.from('playlists').insert({
      user_id: profile.user_id,
      name: playlistName.trim(),
    });
    if (insertError) setError('Playlist gagal dibuat: ' + insertError.message);
    else {
      setPlaylistName('');
      setNotice('Playlist berhasil dibuat.');
      await loadPlaylists();
    }
  }

  async function createPlaylistWithTrack() {
    if (!profile || !newPlaylistName.trim() || !addTo) return;
    setError('');
    setNotice('');
    const { error: insertError } = await supabase.from('playlists').insert({
      user_id: profile.user_id,
      name: newPlaylistName.trim(),
      track_ids: [addTo.id],
    });
    if (insertError) setError('Playlist gagal dibuat: ' + insertError.message);
    else {
      setNotice('Playlist "' + newPlaylistName.trim() + '" dibuat dan lagu ditambahkan.');
      setNewPlaylistName('');
      setAddTo(null);
      await loadPlaylists();
    }
  }

  async function addTrackToPlaylist(playlist: Playlist, track: Track) {
    const ids = playlist.track_ids || [];
    if (ids.includes(track.id)) {
      setNotice('Lagu sudah ada di "' + playlist.name + '".');
      setAddTo(null);
      return;
    }
    const { error: updateError } = await supabase
      .from('playlists')
      .update({ track_ids: [...ids, track.id] })
      .eq('id', playlist.id);
    if (updateError) setError('Lagu gagal ditambahkan ke playlist: ' + updateError.message);
    else {
      setNotice('Lagu ditambahkan ke "' + playlist.name + '".');
      setAddTo(null);
      await loadPlaylists();
    }
  }

  async function removeFromPlaylist(playlist: Playlist, trackId: string) {
    const { error: updateError } = await supabase
      .from('playlists')
      .update({ track_ids: (playlist.track_ids || []).filter((id) => id !== trackId) })
      .eq('id', playlist.id);
    if (updateError) setError('Lagu gagal dikeluarkan dari playlist: ' + updateError.message);
    else await loadPlaylists();
  }

  async function removePlaylist(playlist: Playlist) {
    if (!profile || !window.confirm('Hapus playlist "' + playlist.name + '"?')) return;
    const { error: deleteError } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlist.id)
      .eq('user_id', profile.user_id);
    if (deleteError) setError('Playlist gagal dihapus: ' + deleteError.message);
    else {
      setOpenPlaylistId(null);
      setNotice('Playlist berhasil dihapus.');
      await loadPlaylists();
    }
  }

  const inputClass = 'w-full rounded-xl border border-line bg-card-2 px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-mut/70 focus:border-acc/60 focus:ring-2 focus:ring-acc/15';
  const tabClass = (active: boolean) => 'rounded-xl px-4 py-2.5 text-sm font-semibold transition ' +
    (active ? 'bg-acc text-acc-ink shadow-sm' : 'text-mut hover:bg-card-2 hover:text-ink');

  if (loading || !profile) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-4">
        {error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-400" role="alert">{error}</div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-mut"><Loader2 className="h-5 w-5 animate-spin" /> Menyiapkan ruang musik…</div>
        )}
      </div>
    );
  }

  return (
    <AppLayout profile={profile}>
      <main className="mx-auto max-w-6xl space-y-7 px-4 pb-32 pt-6 sm:px-6 lg:pt-9">
        <header className="relative overflow-hidden rounded-[2rem] border border-line bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-acc/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-acc/20 bg-acc/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-acc">
                <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                CLASSHUB · MUSIC ROOM
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Musik kelas, <span className="text-acc">dalam satu ruang.</span></h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-mut sm:text-base">
                Dengarkan koleksi bersama, simpan lagu favorit ke playlist, dan temukan soundtrack untuk hari ini.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="min-w-[82px] rounded-2xl border border-line bg-bg/70 px-3 py-3 text-center sm:min-w-[100px]">
                <div className="text-xl font-bold text-ink">{tracks.length}</div>
                <div className="mt-0.5 text-[11px] text-mut">koleksi</div>
              </div>
              <div className="min-w-[82px] rounded-2xl border border-line bg-bg/70 px-3 py-3 text-center sm:min-w-[100px]">
                <div className="text-xl font-bold text-ink">{mine.length}<span className="text-sm font-medium text-mut">/8</span></div>
                <div className="mt-0.5 text-[11px] text-mut">upload kamu</div>
              </div>
              <div className="min-w-[82px] rounded-2xl border border-line bg-bg/70 px-3 py-3 text-center sm:min-w-[100px]">
                <div className="text-xl font-bold text-ink">{playlists.length}</div>
                <div className="mt-0.5 text-[11px] text-mut">playlist</div>
              </div>
            </div>
          </div>
        </header>

        {(error || notice) && (
          <div className="space-y-2" aria-live="polite">
            {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">{error}</div>}
            {notice && <div className="rounded-xl border border-acc/25 bg-acc/10 px-4 py-3 text-sm text-acc" role="status">{notice}</div>}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-card p-5 sm:p-6">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-acc/10 to-transparent" />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-acc">Sedang diputar</div>
                <h2 className="mt-1 text-lg font-bold text-ink">Now playing</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-bg px-3 py-1.5 text-xs text-mut">
                <span className={'h-2 w-2 rounded-full ' + (playing ? 'animate-pulse bg-acc' : 'bg-mut/50')} />
                {playing ? 'LIVE' : 'READY'}
              </span>
            </div>

            <div className="relative mt-5 flex min-w-0 items-center gap-4">
              {activeTrack ? (
                <AlbumArt track={activeTrack} className="h-20 w-20 rounded-2xl shadow-lg sm:h-24 sm:w-24" />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-acc/20 to-indigo-500/20 text-acc sm:h-24 sm:w-24">
                  <Music2 className="h-8 w-8" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold text-ink sm:text-xl">{activeTrack?.title || 'Pilih lagu untuk mulai'}</div>
                <div className="mt-1 truncate text-sm text-mut">{activeTrack?.artist || (activeTrack ? 'Artis tidak diketahui' : 'Koleksi musik kelas')}</div>
                {activeTrack && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-mut">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatTime(displayedDuration)}
                    {activeTrack.user_id === profile.user_id && <span className="rounded-full bg-acc/10 px-2 py-0.5 font-medium text-acc">Upload kamu</span>}
                  </div>
                )}
              </div>
              {!activeTrack && tracks[0] && (
                <button onClick={() => playTrack(playable[0] || tracks[0], playable.length ? playable : tracks)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-acc text-acc-ink transition hover:brightness-110" aria-label="Putar lagu pertama">
                  <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                </button>
              )}
            </div>

            {activeTrack && (
              <>
                <div className="mt-5">
                  <input
                    type="range"
                    min={0}
                    max={displayedDuration || 0}
                    step={1}
                    value={Math.min(pos, displayedDuration || 0)}
                    onChange={(event) => seek(Number(event.target.value))}
                    disabled={!displayedDuration}
                    className="h-1.5 w-full cursor-pointer accent-acc disabled:cursor-not-allowed"
                    aria-label="Posisi lagu"
                  />
                  <div className="mt-1 flex justify-between text-[11px] tabular-nums text-mut">
                    <span>{formatTime(pos)}</span><span>{formatTime(displayedDuration)}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShuffle(!shuffle)} className={'rounded-lg p-2.5 transition hover:bg-bg ' + (shuffle ? 'text-acc' : 'text-mut hover:text-ink')} aria-label="Acak lagu" aria-pressed={shuffle}>
                      <Shuffle className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button onClick={cycleRepeat} className={'rounded-lg p-2.5 transition hover:bg-bg ' + (repeatMode !== 'off' ? 'text-acc' : 'text-mut hover:text-ink')} aria-label={'Mode ulang: ' + repeatMode} aria-pressed={repeatMode !== 'off'}>
                      {repeatMode === 'one' ? <Repeat1 className="h-4 w-4" aria-hidden="true" /> : <Repeat className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    <div className="hidden items-center gap-2 pl-2 sm:flex">
                      <Volume2 className="h-4 w-4 text-mut" aria-hidden="true" />
                      <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-20 accent-acc" aria-label="Volume" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => step(-1)} disabled={tracks.length === 0} className="rounded-full p-2.5 text-mut transition hover:bg-bg hover:text-ink disabled:opacity-40" aria-label="Lagu sebelumnya">
                      <SkipBack className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button onClick={toggle} className="flex h-11 w-11 items-center justify-center rounded-full bg-acc text-acc-ink shadow-md transition hover:scale-[1.03] active:scale-95" aria-label={playing ? 'Jeda' : 'Putar'}>
                      {playing ? <Pause className="h-5 w-5 fill-current" aria-hidden="true" /> : <Play className="h-5 w-5 fill-current" aria-hidden="true" />}
                    </button>
                    <button onClick={() => step(1)} disabled={tracks.length === 0} className="rounded-full p-2.5 text-mut transition hover:bg-bg hover:text-ink disabled:opacity-40" aria-label="Lagu berikutnya">
                      <SkipForward className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <form ref={uploadFormRef} onSubmit={submitUpload} className="rounded-[1.75rem] border border-line bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc/10 text-acc">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-bold text-ink">Bagikan lagu</h2>
                <p className="mt-1 text-xs leading-5 text-mut">Tambahkan lagu ke koleksi bersama teman sekelas.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-medium text-mut">
                  Judul lagu
                  <input name="title" placeholder="Contoh: Senja di kelas" maxLength={140} required className={inputClass} />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-mut">
                  Artis <span className="font-normal">(opsional)</span>
                  <input name="artist" placeholder="Nama artis" maxLength={140} className={inputClass} />
                </label>
              </div>
              <label className="block space-y-1.5 text-xs font-medium text-mut">
                File audio
                <input
                  name="file"
                  type="file"
                  required
                  accept=".mp3,.m4a,.aac,.ogg,.opus,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/opus"
                  onChange={(event) => readDuration(event.currentTarget.files?.[0])}
                  className="block w-full text-xs text-mut file:mr-3 file:rounded-lg file:border-0 file:bg-bg file:px-3 file:py-2.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-line"
                />
              </label>
              <input type="hidden" name="duration_seconds" value={uploadDuration} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-mut">Maks 8MB · MP3, M4A, AAC, OGG, OPUS · slot {mine.length}/8</p>
                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-acc px-4 py-2.5 text-sm font-semibold text-acc-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {saving ? 'Mengunggah…' : 'Unggah lagu'}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-acc">Perpustakaan</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Temukan musik</h2>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mut" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul atau artis…" className={inputClass + ' pl-10'} aria-label="Cari musik" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-card p-1.5">
            <button onClick={() => { setTab('all'); setOpenPlaylistId(null); }} className={tabClass(tab === 'all')}>Semua <span className="ml-1 opacity-70">{tracks.length}</span></button>
            <button onClick={() => { setTab('mine'); setOpenPlaylistId(null); }} className={tabClass(tab === 'mine')}>Upload saya <span className="ml-1 opacity-70">{mine.length}</span></button>
            <button onClick={() => { setTab('playlists'); setOpenPlaylistId(null); }} className={tabClass(tab === 'playlists')}>Playlist <span className="ml-1 opacity-70">{playlists.length}</span></button>
            {canReorder && <span className="ml-auto hidden pr-3 text-[11px] text-mut sm:inline">Gunakan panah untuk mengatur urutan</span>}
          </div>

          {tab !== 'playlists' ? (
            filteredTracks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
                <Music2 className="mx-auto h-9 w-9 text-mut/50" aria-hidden="true" />
                <p className="mt-3 font-semibold text-ink">Belum ada lagu di sini</p>
                <p className="mt-1 text-sm text-mut">{query ? 'Coba kata kunci lain.' : 'Jadilah yang pertama membagikan lagu.'}</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredTracks.map((track, index) => {
                  const isCurrent = current?.id === track.id;
                  const ownsTrack = track.user_id === profile.user_id;
                  return (
                    <article key={track.id} className={'group flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-3 transition hover:border-acc/35 hover:shadow-md ' + (isCurrent ? 'border-acc/40 ring-1 ring-acc/10' : 'border-line')}>
                      <button
                        onClick={() => isCurrent ? toggle() : playTrack(track, playable)}
                        className="group/play relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc"
                        aria-label={(isCurrent && playing ? 'Jeda ' : 'Putar ') + track.title}
                      >
                        <AlbumArt track={track} className="h-full w-full" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition group-hover/play:bg-black/35">
                          {isCurrent && playing ? <Pause className="h-5 w-5 fill-current opacity-100" aria-hidden="true" /> : <Play className="h-5 w-5 fill-current opacity-0 transition group-hover/play:opacity-100" aria-hidden="true" />}
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-ink">{track.title}</h3>
                          {isCurrent && <span className="flex h-2 w-2 shrink-0 rounded-full bg-acc shadow-[0_0_10px] shadow-acc/70" title={playing ? 'Sedang diputar' : 'Lagu aktif'} />}
                        </div>
                        <p className="mt-1 truncate text-xs text-mut">{track.artist || 'Artis tidak diketahui'}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-mut">
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{formatTime(track.duration_seconds)}</span>
                          {ownsTrack && <span className="rounded-full bg-acc/10 px-2 py-0.5 font-medium text-acc">Upload kamu</span>}
                          {!ownsTrack && track.user_id && <span className="truncate">Koleksi kelas</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button onClick={() => setAddTo(track)} className="rounded-lg p-2 text-mut transition hover:bg-bg hover:text-acc" aria-label={'Tambahkan ' + track.title + ' ke playlist'}>
                          <ListMusic className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {canReorder && (
                          <div className="hidden flex-col sm:flex">
                            <button onClick={() => moveTrack(track, -1)} disabled={index === 0 || reordering} className="rounded p-1 text-mut transition hover:bg-bg hover:text-ink disabled:opacity-25" aria-label={'Pindahkan ' + track.title + ' ke atas'}>
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button onClick={() => moveTrack(track, 1)} disabled={index === filteredTracks.length - 1 || reordering} className="rounded p-1 text-mut transition hover:bg-bg hover:text-ink disabled:opacity-25" aria-label={'Pindahkan ' + track.title + ' ke bawah'}>
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                        {isStaff && (
                          <button onClick={() => setEditing(track)} className="rounded-lg p-2 text-mut transition hover:bg-bg hover:text-ink" aria-label={'Edit ' + track.title}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {(ownsTrack || isStaff) && (
                          <button onClick={() => removeTrack(track)} disabled={deletingId === track.id} className="rounded-lg p-2 text-mut transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50" aria-label={'Hapus ' + track.title}>
                            {deletingId === track.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {!selectedPlaylist ? (
                <>
                  <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 sm:flex-row">
                    <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Nama playlist baru…" maxLength={80} className={inputClass + ' flex-1'} aria-label="Nama playlist baru" />
                    <button onClick={createPlaylist} disabled={!playlistName.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-acc px-4 py-2.5 text-sm font-semibold text-acc-ink transition hover:brightness-110 disabled:opacity-50">
                      <Plus className="h-4 w-4" aria-hidden="true" /> Buat playlist
                    </button>
                  </div>
                  {playlists.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-line bg-card/60 px-6 py-14 text-center text-sm text-mut">Belum ada playlist. Buat playlist pertamamu di atas.</div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {playlists.map((playlist) => {
                        const firstTrack = (playlist.track_ids || []).map((id) => tracks.find((track) => track.id === id)).find(Boolean);
                        return (
                          <button key={playlist.id} onClick={() => setOpenPlaylistId(playlist.id)} className="group flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left transition hover:border-acc/35 hover:shadow-md">
                            {firstTrack ? <AlbumArt track={firstTrack} className="h-14 w-14 rounded-xl" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-acc/10 text-acc"><ListMusic className="h-6 w-6" aria-hidden="true" /></div>}
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold text-ink">{playlist.name}</div>
                              <div className="mt-1 text-xs text-mut">{(playlist.track_ids || []).length} lagu</div>
                            </div>
                            <ArrowDown className="h-4 w-4 -rotate-90 text-mut transition group-hover:translate-x-0.5 group-hover:text-acc" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-3">
                    <button onClick={() => setOpenPlaylistId(null)} className="rounded-lg p-2 text-mut hover:bg-bg hover:text-ink" aria-label="Kembali ke playlist">
                      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-ink">{selectedPlaylist.name}</h3>
                      <p className="text-xs text-mut">{playlistTracks.length} lagu</p>
                    </div>
                    {playlistPlayable.length > 0 && (
                      <button onClick={() => playTrack(playlistPlayable[0], playlistPlayable)} className="inline-flex items-center gap-2 rounded-xl bg-acc px-3 py-2 text-xs font-semibold text-acc-ink">
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Putar semua
                      </button>
                    )}
                    <button onClick={() => removePlaylist(selectedPlaylist)} className="rounded-lg p-2 text-mut hover:bg-red-500/10 hover:text-red-400" aria-label="Hapus playlist">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  {playlistTracks.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-line bg-card/60 px-6 py-14 text-center text-sm text-mut">Playlist ini masih kosong. Tambahkan lagu melalui ikon daftar lagu.</div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {playlistTracks.map((track) => (
                        <article key={track.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-card p-3">
                          <button onClick={() => playTrack(track, playlistPlayable)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acc text-acc-ink" aria-label={'Putar ' + track.title}>
                            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          </button>
                          <AlbumArt track={track} className="h-12 w-12 rounded-lg" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-ink">{track.title}</div>
                            <div className="truncate text-xs text-mut">{track.artist || 'Artis tidak diketahui'}</div>
                          </div>
                          <button onClick={() => removeFromPlaylist(selectedPlaylist, track.id)} className="rounded-lg p-2 text-mut hover:bg-red-500/10 hover:text-red-400" aria-label={'Keluarkan ' + track.title + ' dari playlist'}>
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {addTo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onClick={() => setAddTo(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title" className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="playlist-dialog-title" className="font-bold text-ink">Tambahkan ke playlist</h3>
                  <p className="mt-1 truncate text-xs text-mut">{addTo.title}</p>
                </div>
                <button onClick={() => setAddTo(null)} className="rounded-lg p-2 text-mut hover:bg-bg hover:text-ink" aria-label="Tutup">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {playlists.length === 0 && <p className="py-4 text-center text-sm text-mut">Belum ada playlist.</p>}
                {playlists.map((playlist) => (
                  <button key={playlist.id} onClick={() => addTrackToPlaylist(playlist, addTo)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg p-3 text-left hover:border-acc/40">
                    <ListMusic className="h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{playlist.name}</span>
                    <Plus className="h-4 w-4 text-mut" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
                <input value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} placeholder="Buat playlist baru…" maxLength={80} className={inputClass + ' flex-1'} aria-label="Buat playlist baru" />
                <button onClick={createPlaylistWithTrack} disabled={!newPlaylistName.trim()} className="rounded-xl bg-acc px-4 py-2.5 text-sm font-semibold text-acc-ink disabled:opacity-50">Buat + tambah</button>
              </div>
            </div>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onClick={() => setEditing(null)}>
            <form role="dialog" aria-modal="true" aria-labelledby="edit-track-title" onSubmit={saveTrack} className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="edit-track-title" className="font-bold text-ink">Edit lagu</h3>
                  <p className="mt-1 text-xs text-mut">Perbarui judul, artis, atau cover album.</p>
                </div>
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-mut hover:bg-bg hover:text-ink" aria-label="Tutup edit lagu">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <label className="block space-y-1.5 text-xs font-medium text-mut">
                Judul lagu
                <input name="title" defaultValue={editing.title} maxLength={140} required className={inputClass} />
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-mut">
                Artis
                <input name="artist" defaultValue={editing.artist || ''} maxLength={140} className={inputClass} />
              </label>
              <label className="block space-y-1.5 text-xs font-medium text-mut">
                Cover album <span className="font-normal">(PNG, JPG, WebP, GIF · maks 4MB)</span>
                <input ref={coverRef} name="cover" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" className="block w-full text-xs text-mut file:mr-3 file:rounded-lg file:border-0 file:bg-bg file:px-3 file:py-2.5 file:text-xs file:font-semibold file:text-ink" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-mut hover:bg-bg">Batal</button>
                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-acc px-4 py-2.5 text-sm font-semibold text-acc-ink disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Simpan perubahan
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </AppLayout>
  );
}
