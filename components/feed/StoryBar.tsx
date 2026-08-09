'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, X, Loader2 } from 'lucide-react';
import StoryViewer from './StoryViewer';
import StoryEditor from '../StoryEditor';

export default function StoryBar({ userId }: { userId: string }) {
  const supabase = createClient();
  const [groups, setGroups] = useState<any[]>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: stories } = await supabase
      .from('stories')
      .select('*, profiles(full_name, username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at');
    const map = new Map<string, any>();
    for (const s of stories ?? []) {
      if (!map.has(s.user_id)) map.set(s.user_id, { profile: s.profiles, stories: [], user_id: s.user_id });
      map.get(s.user_id).stories.push(s);
    }
    const gs = Array.from(map.values());
    setGroups(gs);
    const ids: string[] = [];
    for (const g of gs) for (const s of g.stories) ids.push(s.id);
    if (ids.length > 0) {
      const { data: views } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', userId)
        .in('story_id', ids);
      setViewedIds((views ?? []).map((v: any) => v.story_id));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function publish(file: File) {
    setBusy(true);
    setErr('');
    try {
      const { count } = await supabase
        .from('stories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString());
      if ((count ?? 0) >= 8) {
        setErr('Story aktif maksimal 8. Hapus story lama dulu (buka story kamu, tekan ikon tempat sampah).');
        setBusy(false);
        return;
      }
      const storyId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = userId + '/' + storyId + '.' + ext;
      const { error: upErr } = await supabase.storage.from('stories').upload(path, file);
      if (upErr) { setErr('Upload gagal: ' + upErr.message); setBusy(false); return; }
      const url = supabase.storage.from('stories').getPublicUrl(path).data.publicUrl;
      const { error: dbErr } = await supabase.from('stories').insert({
        user_id: userId,
        media_url: url,
        media_type: 'image',
        caption: caption.trim() || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (dbErr) { setErr(dbErr.message); setBusy(false); return; }
      setShowCreate(false);
      setCaption('');
      load();
    } catch {
      setErr('Gagal membuat story.');
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
        <button onClick={() => setShowCreate(true)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="h-16 w-16 rounded-full bg-card border border-line flex items-center justify-center">
            <Plus className="h-6 w-6 text-acc" />
          </div>
          <span className="text-[10px] text-mut">Ceritamu</span>
        </button>
        {groups.map((g, i) => {
          const allViewed = g.stories.every((s: any) => viewedIds.indexOf(s.id) !== -1);
          return (
            <button key={i} onClick={() => setOpen(i)} className="flex flex-col items-center gap-1 shrink-0">
              <div className={'h-16 w-16 rounded-full p-0.5 ' + (allViewed ? 'border border-line-2' : 'border-2 border-acc')}>
                <div className="h-full w-full rounded-full bg-line-2 flex items-center justify-center text-lg font-bold text-ink">
                  {g.profile?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
              <span className="text-[10px] text-mut max-w-[64px] truncate">{g.profile?.full_name}</span>
            </button>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-card border border-line rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">Buat Story</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 text-mut hover:text-ink" aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>
            {err && <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{err}</div>}
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setEditFile(f);
              }}
              className="w-full text-xs text-mut file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-line file:text-xs file:text-ink"
            />
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (opsional)"
              className="w-full px-3 py-2 rounded-lg bg-card-2 border border-line text-sm text-ink focus:outline-none focus:border-acc/50"
            />
            <button
              disabled={busy}
              onClick={() => {
                const f = fileRef.current?.files?.[0];
                if (!f) { setErr('Pilih gambar dulu.'); return; }
                setEditFile(f);
              }}
              className="w-full py-2 rounded-lg bg-acc text-acc-ink text-sm font-semibold hover:bg-acc-strong disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Mengunggah...' : 'Edit & Terbitkan (24 jam)'}
            </button>
          </div>
        </div>
      )}

      {editFile && (
        <StoryEditor
          file={editFile}
          onClose={() => setEditFile(null)}
          onDone={(f) => {
            setEditFile(null);
            publish(f);
          }}
        />
      )}

      {open !== null && groups.length > 0 && (
        <StoryViewer groups={groups} start={open} userId={userId} onClose={() => { setOpen(null); load(); }} />
      )}
    </div>
  );
}
